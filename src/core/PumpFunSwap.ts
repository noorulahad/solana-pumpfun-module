// PumpFunSwap.ts
import {
    Connection,
    Keypair,
    VersionedTransaction,
    PublicKey,
    SystemProgram,
    TransactionMessage,
    TransactionInstruction
} from '@solana/web3.js';
import bs58 from 'bs58';
import fetch from 'node-fetch';
import { SwapConfig, TradeOptions, TradeResult, TradeAction } from '../types/types';
import { PUMP_PORTAL_API, JITO_BLOCK_ENGINE_URL, getRandomJitoAccount } from '../config/config';

export class PumpFunSwap {
    private connection: Connection;
    private wallet: Keypair;
    private apiKey?: string;

    constructor(config: SwapConfig) {
        if (!config.rpcUrl || !config.privateKey) {
            throw new Error("❌ Configuration Error: RPC URL or Private Key missing.");
        }
        this.connection = new Connection(config.rpcUrl, "confirmed");
        this.wallet = Keypair.fromSecretKey(bs58.decode(config.privateKey));
        this.apiKey = config.apiKey;

        console.log(`🚀 PumpFunSwap Initialized for Wallet: ${this.wallet.publicKey.toBase58()}`);
    }

    /**
     * Public Method: Execute Buy
     */
    public async buy(options: TradeOptions): Promise<TradeResult> {
        return this.executeTrade("buy", options);
    }

    /**
     * Public Method: Execute Sell
     */
    public async sell(options: TradeOptions): Promise<TradeResult> {
        return this.executeTrade("sell", options);
    }

    /**
     * Public Method: Sell Entire Balance
     */
    public async sellAll(options: Omit<TradeOptions, "amount">): Promise<TradeResult> {
        try {
            const balance = await this.getTokenBalance(options.mint);
            if (balance <= 0) {
                return { success: false, error: "No token balance found to sell.", mode: "Standard" };
            }
            console.log(`💰 Balance Found: ${balance} | Selling All...`);
            return this.executeTrade("sell", { ...options, amount: balance });
        } catch (error: any) {
            return { success: false, error: error.message, mode: "Standard" };
        }
    }

    // ================= PRIVATE CORE LOGIC =================

    /**
     * Core Execution Router
     */
    private async executeTrade(action: TradeAction, options: TradeOptions): Promise<TradeResult> {
        const { mint, amount, slippagePct = 1, priorityFee = 0.0001, useJito = false, jitoTipSol = 0.001 } = options;

        console.log(`\n🔄 Processing ${action.toUpperCase()} | Mint: ${mint} | Amt: ${amount}`);

        try {
            // 1. Build the Transaction (From PumpPortal API)
            const swapTx = await this.buildSwapTransaction(action, mint, amount, slippagePct, priorityFee);

            // 2. Route based on Jito preference
            if (useJito) {
                return await this.executeJitoBundle(swapTx, jitoTipSol);
            } else {
                return await this.executeStandardTx(swapTx);
            }

        } catch (error: any) {
            console.error(`🚨 Execution Error:`, error.message);
            return { success: false, error: error.message, mode: useJito ? "Jito" : "Standard" };
        }
    }

    /**
     * Fetch Transaction Buffer from PumpPortal
     */
    private async buildSwapTransaction(
        action: TradeAction,
        mint: string,
        amount: number,
        slippage: number,
        priorityFee: number
    ): Promise<VersionedTransaction> {
        const isSolInput = action === "buy"; // API expects boolean true/false for denominatedInSol

        const payload: any = {
            publicKey: this.wallet.publicKey.toBase58(),
            action: action,
            mint: mint,
            denominatedInSol: isSolInput ? "true" : "false",
            amount: amount,
            slippage: slippage,
            priorityFee: priorityFee,
            pool: "pump"
        };
        if (this.apiKey) payload.apiKey = this.apiKey;

        const response = await fetch(PUMP_PORTAL_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.status !== 200) {
            const err = await response.text();
            throw new Error(`PumpPortal API Error: ${err}`);
        }

        const buffer = await response.arrayBuffer();
        const tx = VersionedTransaction.deserialize(Buffer.from(buffer));
        tx.sign([this.wallet]);
        return tx;
    }

    /**
     * Execute Standard Transaction (Direct RPC)
     */
    private async executeStandardTx(transaction: VersionedTransaction): Promise<TradeResult> {
        console.log("📨 Sending Standard Transaction...");
        try {
            const signature = await this.connection.sendTransaction(transaction, {
                skipPreflight: true,
                maxRetries: 2,
                preflightCommitment: "confirmed",
            });

            const confirmation = await this.connection.confirmTransaction(signature, "confirmed");

            if (confirmation.value.err) throw new Error("Transaction Dropped or Failed");

            console.log(`✅ Success: https://solscan.io/tx/${signature}`);
            return { success: true, signature, mode: "Standard" };
        } catch (e: any) {
            throw new Error(`Standard TX Failed: ${e.message}`);
        }
    }

    /**
     * Execute via Jito Bundle
     */
    private async executeJitoBundle(swapTx: VersionedTransaction, tipAmt: number): Promise<TradeResult> {
        console.log("🛡️ Preparing Jito Bundle...");

        // Create Tip Transaction
        const tipTx = await this.createJitoTipTx(tipAmt);

        // Serialize Transactions
        const b58Txs = [swapTx, tipTx].map(tx => bs58.encode(tx.serialize()));

        // Send to Jito Block Engine
        const response = await fetch(JITO_BLOCK_ENGINE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "sendBundle",
                params: [b58Txs]
            })
        });

        const result: any = await response.json();
        if (result.error) throw new Error(`Jito API Error: ${JSON.stringify(result.error)}`);

        const bundleId = result.result;
        const swapSig = bs58.encode(swapTx.signatures[0]);

        console.log(`✅ Bundle Sent (ID: ${bundleId})`);
        console.log(`🔗 Monitor: https://solscan.io/tx/${swapSig}`);

        // Note: Jito is fire-and-forget. We verify the swap signature.
        const confirmation = await this.connection.confirmTransaction(swapSig, "confirmed");

        if (confirmation.value.err) throw new Error("Bundle transaction not confirmed on-chain");

        return { success: true, signature: swapSig, mode: "Jito" };
    }

    /**
     * Create Jito Tip Transaction
     */
    private async createJitoTipTx(amount: number): Promise<VersionedTransaction> {
        const tipAccount = getRandomJitoAccount();
        const instruction = SystemProgram.transfer({
            fromPubkey: this.wallet.publicKey,
            toPubkey: tipAccount,
            lamports: Math.floor(amount * 1_000_000_000),
        });

        const latestBlockhash = await this.connection.getLatestBlockhash();
        const messageV0 = new TransactionMessage({
            payerKey: this.wallet.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: [instruction],
        }).compileToV0Message();

        const tx = new VersionedTransaction(messageV0);
        tx.sign([this.wallet]);
        return tx;
    }

    /**
     * Helper: Get Token Balance
     */
    private async getTokenBalance(mint: string): Promise<number> {
        try {
            const accounts = await this.connection.getParsedTokenAccountsByOwner(
                this.wallet.publicKey,
                { mint: new PublicKey(mint) }
            );
            return accounts.value[0]?.account.data.parsed.info.tokenAmount.uiAmount || 0;
        } catch {
            return 0;
        }
    }
}