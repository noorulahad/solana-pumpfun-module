// PumpFunSwap.ts
import { Connection, VersionedTransaction, PublicKey, SystemProgram, TransactionMessage, Keypair, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN, Wallet } from '@project-serum/anchor';
import { IDL, PUMP_PROGRAM_ID } from '../config/idl';
import { getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { SwapConfig, TradeOptions, TradeResult, TradeAction, IWallet } from '../types/types';
import { JitoManager } from './JitoManager';
// import { JITO_BLOCK_ENGINE_URLS, getRandomJitoAccount } from '../config/config'; // Moved logic to JitoManager

// Helper to pause execution
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const GLOBAL_STATE_SEED = "global";
const BONDING_CURVE_SEED = "bonding-curve";
const FEE_RECIPIENT = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");

export class PumpFunSwap {
    private connection: Connection;
    private wallet: IWallet;
    private provider: AnchorProvider;
    private program: Program;

    constructor(config: SwapConfig) {
        if (!config.rpcUrl || !config.wallet) {
            throw new Error("❌ Configuration Error: RPC URL or Wallet implementation missing.");
        }
        this.connection = new Connection(config.rpcUrl, "confirmed");
        this.wallet = config.wallet;

        // Initialize Anchor Provider
        this.provider = new AnchorProvider(
            this.connection,
            this.wallet as unknown as Wallet,
            { commitment: "confirmed", preflightCommitment: "confirmed" }
        );

        // Initialize Program
        this.program = new Program(IDL as Idl, PUMP_PROGRAM_ID, this.provider);

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

                // If successful, return immediately
                if (result.success) {
                    return result;
                }

                // If failed, check if we should retry
                if (attempt >= maxRetries) {
                    console.error(`❌ Max retries (${maxRetries}) reached. Last Error: ${result.error}`);
                    return result; // Return the last failure
                }

                // FATAL ERROR CHECK: If insufficient funds, do not retry
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
                // This catch block executes if executeTrade crashes (unlikely handled inside)
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

        // If dynamic fee is OFF, return fixed value
        if (!dynamicFee) {
            return priorityFee;
        }

        console.log("📊 Calculating Dynamic Priority Fee (via Helius AI)...");

        try {
            // ⚡ USE HELIUS SPECIFIC API (Much more accurate than getRecentPrioritizationFees)
            // WE are using the connection endpoint which should have the API Key
            const response = await fetch(this.connection.rpcEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'helius-fee',
                    method: 'getPriorityFeeEstimate',
                    params: [{
                        accountKeys: [PUMP_PROGRAM_ID], // Monitor the Pump.fun program specifically
                        options: {
                            includeAllPriorityFeeLevels: true
                        }
                    }]
                }),
            });

            const data: any = await response.json();

            if (data.result?.priorityFeeEstimate) {
                // Helius returns levels: 'min', 'low', 'medium', 'high', 'veryHigh', 'unsafeMax'
                // For sniping/trading, we usually want 'high' or 'veryHigh'
                const recommendedFeeMicroLamports = data.result.priorityFeeEstimate.veryHigh;

                // Convert microLamports to SOL
                // 1 SOL = 10^15 microLamports (approx calculation for unit price vs total fee)
                // Note: Helius returns 'microLamports per Compute Unit'.

                const ESTIMATED_CU = 200_000;
                const feeInMicroLamports = recommendedFeeMicroLamports * ESTIMATED_CU;
                const feeInSol = feeInMicroLamports / 1_000_000_000_000_000;

                console.log(`⚡ Helius AI Fee Estimate: ${feeInSol.toFixed(9)} SOL`);

                // Apply Cap
                return Math.min(feeInSol, maxPriorityFee);
            }

            console.warn("⚠️ Helius API didn't return estimate, falling back.");
            return priorityFee;

        } catch (error) {
            console.error("⚠️ Helius Fee Error:", error);
            // Fallback to standard logic if Helius fails? Or just return default
            return priorityFee;
        }
    }

    private async executeTrade(action: TradeAction, options: TradeOptions): Promise<TradeResult> {
        // Step 1: Calculate Fee (Dynamic or Fixed)
        const calculatedPriorityFee = await this.getPriorityFee(options);

        const { mint, amount, slippagePct = 5, useJito = false, jitoTipSol = 0.001 } = options;

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

    private async buildSwapTransaction(action: TradeAction, mintStr: string, amountInput: number, slippagePct: number, priorityFee: number): Promise<VersionedTransaction> {
        const mint = new PublicKey(mintStr);
        const user = this.wallet.publicKey;

        // 1. Get derived addresses
        const bondingCurve = PublicKey.findProgramAddressSync(
            [Buffer.from(BONDING_CURVE_SEED), mint.toBuffer()],
            this.program.programId
        )[0];

        const associatedBondingCurve = await getAssociatedTokenAddress(
            mint,
            bondingCurve,
            true
        );

        const associatedUser = await getAssociatedTokenAddress(
            mint,
            user,
            false
        );

        // 2. Fetch Bonding Curve State for Calculations
        // We need this to calculate the correct token amount for buys (if input is SOL) 
        // or SOL amount for sells. (Hindi: or SOL amount for sells.)
        const curveState: any = await this.program.account.bondingCurve.fetch(bondingCurve);

        // Calculate Amounts
        let tokenAmount: BN;
        let maxSolCost: BN | undefined;
        let minSolOutput: BN | undefined;

        if (action === "buy") {
            // Input 'amountInput' is SOL. We need to find how many tokens we get.
            const solAmountPoints = new BN(amountInput * LAMPORTS_PER_SOL);

            // Formula: tokens = virtualTokens - (K / (virtualSol + solIn))
            // K = virtualSol * virtualTokens
            const virtualSolReserves = curveState.virtualSolReserves;
            const virtualTokenReserves = curveState.virtualTokenReserves;

            const K = virtualSolReserves.mul(virtualTokenReserves);
            const newVirtualSol = virtualSolReserves.add(solAmountPoints);
            const newVirtualTokens = K.div(newVirtualSol);

            tokenAmount = virtualTokenReserves.sub(newVirtualTokens);

            // Allow for slippage on the SOL cost side? 
            // The instruction is buy(tokenAmount, maxSolCost).
            // Usually we set maxSolCost to (InputSol * (1 + slippage)).
            const slippageMultipler = 1 + (slippagePct / 100);
            maxSolCost = new BN(Math.floor(amountInput * LAMPORTS_PER_SOL * slippageMultipler));

        } else {
            // Action is SELL
            // Input 'amountInput' is Tokens. 
            // If amountInput is float, we assume UI amount. 
            // PumpFun tokens are 6 decimals.
            tokenAmount = new BN(Math.floor(amountInput * 1_000_000));

            // Calculate Min Sol Output
            // solOut = (tokensIn * virtualSol) / (virtualTokens + tokensIn) ? NO, virtualTokens changes
            // Formula: solOut = virtualSol - (K / (virtualTokens + tokensIn))
            // Wait, standard AMM: dy = y - k/(x+dx)

            const virtualSolReserves = curveState.virtualSolReserves;
            const virtualTokenReserves = curveState.virtualTokenReserves;
            const K = virtualSolReserves.mul(virtualTokenReserves);

            const newVirtualTokens = virtualTokenReserves.add(tokenAmount);
            const newVirtualSol = K.div(newVirtualTokens);

            const solOutput = virtualSolReserves.sub(newVirtualSol);

            const slippageMultipler = 1 - (slippagePct / 100);
            minSolOutput = solOutput.mul(new BN(Math.floor(slippageMultipler * 1000))).div(new BN(1000));
        }

        // 3. Build Instruction
        let txInstruction;

        if (action === "buy") {
            txInstruction = await this.program.methods
                .buy(tokenAmount, maxSolCost!)
                .accounts({
                    global: PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_STATE_SEED)], this.program.programId)[0],
                    feeRecipient: FEE_RECIPIENT,
                    mint: mint,
                    bondingCurve: bondingCurve,
                    associatedBondingCurve: associatedBondingCurve,
                    associatedUser: associatedUser,
                    user: user,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
                    eventAuthority: PublicKey.findProgramAddressSync([Buffer.from("__event_authority")], this.program.programId)[0],
                    program: this.program.programId
                })
                .instruction();
        } else {
            txInstruction = await this.program.methods
                .sell(tokenAmount, minSolOutput!)
                .accounts({
                    global: PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_STATE_SEED)], this.program.programId)[0],
                    feeRecipient: FEE_RECIPIENT,
                    mint: mint,
                    bondingCurve: bondingCurve,
                    associatedBondingCurve: associatedBondingCurve,
                    associatedUser: associatedUser,
                    user: user,
                    systemProgram: SystemProgram.programId,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    eventAuthority: PublicKey.findProgramAddressSync([Buffer.from("__event_authority")], this.program.programId)[0],
                    program: this.program.programId
                })
                .instruction();
        }

        // 4. Create Transaction
        const recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

        // Add Priority Fee
        const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: Math.floor(priorityFee * 1_000_000_000_000_000 / 200_000) }); // Est units? better to just use microLamports param or convert
        // options.priorityFee is in SOL.
        // setComputeUnitPrice takes microLamports per CU.
        // If we assumed estimated CU ~ 200k in the calc logic, we should be consistent.

        // Just used the passed priority fee logic from getPriorityFee?
        // getPriorityFee returns fee in SOL.
        // To convert SOL fee to unit price: (SOL * 10^9 * 10^6) / CU_LIMIT
        // 1e15 microLamports per SOL.
        const units = 200_000; // Assumed
        const microLamports = Math.floor((priorityFee * 1_000_000_000_000_000) / units);
        const setComputeUnitIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports });
        const setComputeLimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units });

        const messageV0 = new TransactionMessage({
            payerKey: user,
            recentBlockhash: recentBlockhash,
            instructions: [setComputeUnitIx, setComputeLimitIx, txInstruction]
        }).compileToV0Message();

        return new VersionedTransaction(messageV0);
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
        // Now both transactions will share the same blockhash
        let tipTx = await this.createJitoTipTx(tipAmt, sharedBlockhash);

        // 3. Sign Tip Tx
        tipTx = await this.wallet.signTransaction(tipTx);

        // 4. Bundle & Send
        const b58Txs = [swapTx, tipTx].map(tx => bs58.encode(tx.serialize()));

        try {
            // Use JitoManagers Intelligent Failover
            const bundleId = await JitoManager.sendBundle(b58Txs);
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
        // Intelligent Rotation of Tip Accounts
        const tipAccount = JitoManager.getNextTipAccount();
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

    public getBondingCurveAddress(mintStr: string): PublicKey {
        const mint = new PublicKey(mintStr);
        return PublicKey.findProgramAddressSync(
            [Buffer.from(BONDING_CURVE_SEED), mint.toBuffer()],
            this.program.programId
        )[0];
    }

    public onBondingCurveChange(mintStr: string, callback: (price: number) => void): number {
        const bondingCurve = this.getBondingCurveAddress(mintStr);

        const id = this.connection.onAccountChange(
            bondingCurve,
            (accountInfo) => {
                // Decode account data using Anchor coder
                // This is much faster than fetching.
                // However, deserializing manually or using coder is needed.

                try {
                    // Manually decoding simplest structure to avoid heavy coder usage if possible?
                    // Actually, let's use the program coder if available, or just a buffer layout.
                    // But we already have the IDL loaded in `this.program`.

                    const decoded = this.program.coder.accounts.decode(
                        "BondingCurve",
                        accountInfo.data
                    );

                    const vSol = decoded.virtualSolReserves;
                    const vTokens = decoded.virtualTokenReserves;

                    const solVal = vSol.toNumber();
                    const tokenVal = vTokens.toNumber();
                    const price = (solVal / tokenVal) * 0.001;

                    callback(price);
                } catch (e) {
                    console.error("WebSocket Decode Error:", e);
                }
            },
            "processed" // Get updates as soon as processed by validator (Fastest)
        );

        return id;
    }

    public async removeListener(id: number) {
        await this.connection.removeAccountChangeListener(id);
    }

    public async getTokenPrice(mintStr: string): Promise<number> {
        const mint = new PublicKey(mintStr);
        const bondingCurve = PublicKey.findProgramAddressSync(
            [Buffer.from(BONDING_CURVE_SEED), mint.toBuffer()],
            this.program.programId
        )[0];

        const curveState: any = await this.program.account.bondingCurve.fetch(bondingCurve);

        // Price in SOL per Token
        // virtualSolReserves / virtualTokenReserves
        // Adjust for decimals: 
        // Sol has 9, Token has 6. 
        // Price = (vSol / 1e9) / (vTokens / 1e6) = (vSol/vTokens) * 1e-3

        const vSol = curveState.virtualSolReserves;
        const vTokens = curveState.virtualTokenReserves;

        // Use BN for precision or simple number for monitoring
        // For monitoring, number is fine usually, but let's be careful with large numbers
        const solVal = vSol.toNumber();
        const tokenVal = vTokens.toNumber();

        const priceLamportsPerMicroToken = solVal / tokenVal;
        const priceSolPerToken = priceLamportsPerMicroToken * 0.001; // (10^6 / 10^9)

        return priceSolPerToken;
    }

    public async getTokenBalance(mint: string): Promise<number> {
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