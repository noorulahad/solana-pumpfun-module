// index.ts
import { PumpFunSwap } from './core/PumpFunSwap';
import { SmartExit } from './core/SmartExit';
import { Keypair, VersionedTransaction, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import { IWallet } from './types/types';

dotenv.config();

// Simple Wallet Implementation for Backend (Implements IWallet)
class NodeWallet implements IWallet {
    constructor(private payer: Keypair) { }

    get publicKey() {
        return this.payer.publicKey;
    }

    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
        if (tx instanceof VersionedTransaction) {
            tx.sign([this.payer]);
        } else {
            (tx as Transaction).sign(this.payer);
        }
        return tx;
    }

    async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
        return txs.map((t) => {
            if (t instanceof VersionedTransaction) t.sign([this.payer]);
            else (t as Transaction).sign(this.payer);
            return t;
        });
    }
}

(async () => {
    try {
        // 1. Setup Wallet (Sensitive part isolated here)
        if (!process.env.PRIVATE_KEY) {
            throw new Error("PRIVATE_KEY not found in .env");
        }

        const privateKey = process.env.PRIVATE_KEY!;
        const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
        const wallet = new NodeWallet(keypair);

        // 2. Initialize Trader with Wallet Object
        const trader = new PumpFunSwap({
            rpcUrl: process.env.HELIUS_RPC_URL!,
            wallet: wallet // Pass object, not string
        });

        const TOKEN_CA = "61V8vBaqAGMpgDQi4JdBybAf9935oJimPls6dC5k1eva"; // Example CA

        // 3. Trade Examples (Commented out to prevent accidental spending)

        /*
        // Standard Buy with Dynamic Fee
        console.log("Starting Buy...");
        const buyResult = await trader.buy({
            mint: TOKEN_CA,
            amount: 0.01,
            dynamicFee: true,       // ✅ Enable Auto Estimation
            maxPriorityFee: 0.01    // ✅ Safety Cap (1% SOL max)
        });

        if (buyResult.success) {
            console.log("✅ Buy Successful! Initializing Smart Exit...");

            // 1. Wait for RPC Indexing (Important)
            console.log("⏳ Waiting 3s for RPC to update balance...");
            await new Promise(r => setTimeout(r, 3000));

            // 2. Fetch Actual Token Balance (Public Method)
            const initialBalance = await trader.getTokenBalance(TOKEN_CA);

            if (initialBalance > 0) {
                 // Get Entry Price (Approximation based on current curve)
                const entryPrice = await trader.getTokenPrice(TOKEN_CA);
                
                // ✅ Pass Balance to SmartExit -> ZERO LATENCY SELL READY
                const smartExit = new SmartExit(trader, TOKEN_CA, entryPrice, initialBalance);
                
                // Start Monitoring
                await smartExit.start(); 
            } else {
                 console.error("⚠️ Balance not found after buy! Check RPC node or Transaction logs.");
            }
        }
        */

        console.log("Trader initialized successfully!");
    } catch (e) {
        console.error("Error:", e);
    }
})();