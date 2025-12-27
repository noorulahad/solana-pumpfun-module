// PumpFunSwap.ts
import { Connection, VersionedTransaction, PublicKey, SystemProgram, TransactionMessage } from '@solana/web3.js';
import fetch from 'node-fetch';
import bs58 from 'bs58';
import { SwapConfig, TradeOptions, TradeResult, TradeAction, IWallet } from '../types/types';
import { PUMP_PORTAL_API, JITO_BLOCK_ENGINE_URL, getRandomJitoAccount } from '../config/config';

// Helper to pause execution
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class PumpFunSwap {
    private connection: Connection;
    private wallet: IWallet;
    private apiKey?: string;

    constructor(config: SwapConfig) {
        if (!config.rpcUrl || !config.wallet) {
            throw new Error("❌ Configuration Error: RPC URL or Wallet implementation missing.");
        }
        this.connection = new Connection(config.rpcUrl, "confirmed");
        this.wallet = config.wallet;
        this.apiKey = config.apiKey;

        console.log(`🚀 PumpFunSwap Initialized for: ${this.wallet.publicKey.toBase58()}`);
    }

    /**
     * Public Method: Execute Buy
     */
    public async buy(options: TradeOptions): Promise<TradeResult> {
        return this.executeWithRetry("buy", options);
    }

    /**
     * Public Method: Execute Sell
     */
    public async sell(options: TradeOptions): Promise<TradeResult> {
        return this.executeWithRetry("sell", options);
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

    // ================= RETRY LOGIC WRAPPER =================

    private async executeWithRetry(action: TradeAction, options: TradeOptions): Promise<TradeResult> {
        const maxRetries = options.retryAttempts ?? 3;
        const initialDelay = options.retryDelayMs ?? 1000;
        let attempt = 0;

        while (true) {
            try {
                // Try executing the trade
                const result = await this.executeTrade(action, options);

                // Agar success ho gaya, return immediately
                if (result.success) {
                    return result;
                }

                // Agar fail hua, check karo ke retry karna chahiye ya nahi
                if (attempt >= maxRetries) {
                    console.error(`❌ Max retries (${maxRetries}) reached. Last Error: ${result.error}`);
                    return result; // Return the last failure
                }

                // FATAL ERROR CHECK: Agar paise hi nahi hain, to retry mat karo
                if (result.error && this.isFatalError(result.error)) {
                    console.error(`⛔ Fatal Error (No Retry): ${result.error}`);
                    return result;
                }

                // Exponential Backoff Logic
                // Delay = Initial * 2^attempt (e.g., 1s, 2s, 4s)
                const delay = initialDelay * Math.pow(2, attempt);
                console.log(`⚠️ Attempt ${attempt + 1} Failed. Retrying in ${delay}ms...`);

                await sleep(delay);
                attempt++;

            } catch (unexpectedError: any) {
                // Ye catch block tab chalega agar executeTrade crash ho jaye (unlikely handled inside)
                console.error(`🚨 Unexpected Crash:`, unexpectedError);
                if (attempt >= maxRetries) return { success: false, error: unexpectedError.message, mode: options.useJito ? "Jito" : "Standard" };
                attempt++;
                await sleep(initialDelay);
            }
        }
    }

    /**
     * Helper: Detect Errors worth Retrying
     */
    private isFatalError(errorMessage: string): boolean {
        const fatalKeywords = [
            "insufficient funds",
            "insufficient lamports",
            "account not found", // Token account missing for sell
            "unauthorized"       // Bad API Key
        ];
        const msg = errorMessage.toLowerCase();
        return fatalKeywords.some(keyword => msg.includes(keyword));
    }

    // ================= PRIVATE CORE LOGIC =================

    /**
     * Internal: Calculate Dynamic Priority Fee
     * Returns fee in SOL
     */
    private async getPriorityFee(options: TradeOptions): Promise<number> {
        const { priorityFee = 0.0001, dynamicFee = false, maxPriorityFee = 0.01 } = options;

        // Agar dynamic fee OFF hai, to fixed value return karo
        if (!dynamicFee) {
            return priorityFee;
        }

        console.log("📊 Calculating Dynamic Priority Fee...");

        try {
            // 1. Get recent fees from RPC (looks at last 150 blocks)
            const recentFees = await this.connection.getRecentPrioritizationFees();

            if (recentFees.length === 0) {
                console.warn("⚠️ No recent fees found, defaulting to fixed.");
                return priorityFee;
            }

            // 2. Sort fees (Highest to Lowest) to find the market rate
            // Note: API returns fee in 'microLamports' per Compute Unit
            const sortedFees = recentFees
                .map(x => x.prioritizationFee)
                .filter(x => x > 0)
                .sort((a, b) => b - a);

            if (sortedFees.length === 0) return priorityFee;

            // 3. Strategy: Take the 75th percentile (Top 25% of the market)
            // Ye ensure karta hai ke hum cheap users se upar hon
            const index = Math.floor(sortedFees.length * 0.25);
            const highPriorityMicroLamports = sortedFees[index];

            // 4. Estimate Compute Units (Standard Swap ~ 200,000 CU max)
            const ESTIMATED_CU = 200_000;

            // Formula: (MicroLamportsPerCU * CU) -> MicroLamports -> Lamports -> SOL
            // 1 SOL = 10^9 Lamports
            // 1 Lamport = 10^6 MicroLamports
            // Total: 1 SOL = 10^15 MicroLamports

            const feeInMicroLamports = highPriorityMicroLamports * ESTIMATED_CU;
            let feeInSol = feeInMicroLamports / 1_000_000_000_000_000; // Divide by 10^15

            // Safety Buffer (Multiply by 1.2x for fluctuation)
            feeInSol = feeInSol * 1.2;

            // 5. Apply Safety Caps
            // Agar fee bohot kam hai (0.000001), to minimum 0.0001 rakho
            // Agar fee bohot zyada hai (User cap), to limit lagao
            const finalFee = Math.min(Math.max(feeInSol, 0.0001), maxPriorityFee);

            console.log(`⚡ Dynamic Fee Calculated: ${finalFee.toFixed(6)} SOL (Based on Network Load)`);
            return finalFee;

        } catch (error) {
            console.error("⚠️ Failed to estimate fee, using default:", error);
            return priorityFee;
        }
    }

    private async executeTrade(action: TradeAction, options: TradeOptions): Promise<TradeResult> {
        // Step 1: Calculate Fee (Dynamic or Fixed)
        const calculatedPriorityFee = await this.getPriorityFee(options);

        const { mint, amount, slippagePct = 1, useJito = false, jitoTipSol = 0.001 } = options;

        console.log(`\n🔄 Processing ${action.toUpperCase()} | Mint: ${mint} | Amt: ${amount} | Fee: ${calculatedPriorityFee} SOL`);

        try {
            // Step 2: Pass calculated fee to builder
            let swapTx = await this.buildSwapTransaction(
                action,
                mint,
                amount,
                slippagePct,
                calculatedPriorityFee // <--- NOW DYNAMIC
            );

            // Step 3: Sign Transaction (Delegated to Wallet)
            swapTx = await this.wallet.signTransaction(swapTx);

            // 3. Route
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

    private async buildSwapTransaction(action: TradeAction, mint: string, amount: number, slippage: number, priorityFee: number): Promise<VersionedTransaction> {
        const isSolInput = action === "buy";
        const payload: any = {
            publicKey: this.wallet.publicKey.toBase58(),
            action,
            mint,
            denominatedInSol: isSolInput ? "true" : "false",
            amount,
            slippage,
            priorityFee,
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
        // Return unsigned transaction
        return VersionedTransaction.deserialize(Buffer.from(buffer));
    }

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

    private async executeJitoBundle(swapTx: VersionedTransaction, tipAmt: number): Promise<TradeResult> {
        console.log("🛡️ Preparing Jito Bundle...");

        // 1. Extract Blockhash from the Swap Transaction (Provided by API)
        const sharedBlockhash = swapTx.message.recentBlockhash;

        // 2. Pass this blockhash to create the Tip Tx
        // Ab dono transactions same blockhash share karengi
        let tipTx = await this.createJitoTipTx(tipAmt, sharedBlockhash);

        // 3. Sign Tip Tx
        tipTx = await this.wallet.signTransaction(tipTx);

        // 4. Bundle & Send
        const b58Txs = [swapTx, tipTx].map(tx => bs58.encode(tx.serialize()));

        try {
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
            if (result.error) throw new Error(`Jito Error: ${JSON.stringify(result.error)}`);

            const bundleId = result.result;
            const swapSig = bs58.encode(swapTx.signatures[0]);

            console.log(`✅ Bundle Sent (ID: ${bundleId})`);
            console.log(`🔗 Monitor: https://solscan.io/tx/${swapSig}`);

            // Confirm Transaction
            const confirmation = await this.connection.confirmTransaction(swapSig, "confirmed");

            if (confirmation.value.err) throw new Error("Bundle transaction not confirmed on-chain");

            return { success: true, signature: swapSig, mode: "Jito" };

        } catch (error: any) {
            throw new Error(`Jito Bundle Failed: ${error.message}`);
        }
    }

    private async createJitoTipTx(amount: number, recentBlockhash: string): Promise<VersionedTransaction> {
        const tipAccount = getRandomJitoAccount();
        const instruction = SystemProgram.transfer({
            fromPubkey: this.wallet.publicKey,
            toPubkey: tipAccount,
            lamports: Math.floor(amount * 1_000_000_000),
        });

        // NO Network Call Here - Use the passed blockhash
        const messageV0 = new TransactionMessage({
            payerKey: this.wallet.publicKey,
            recentBlockhash: recentBlockhash,
            instructions: [instruction],
        }).compileToV0Message();

        return new VersionedTransaction(messageV0);
    }

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