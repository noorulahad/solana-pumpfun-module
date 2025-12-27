// types.ts
import { Transaction, VersionedTransaction, PublicKey } from '@solana/web3.js';

// Generic Wallet Interface (Abstracts the Private Key)
export interface IWallet {
    publicKey: PublicKey;
    signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
    signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
}

export type TradeAction = "buy" | "sell";

export interface SwapConfig {
    rpcUrl: string;
    wallet: IWallet; // Ab hum seedha Wallet object pass karenge, Key string nahi
    apiKey?: string;
}

export interface TradeOptions {
    mint: string;
    amount: number;
    slippagePct?: number;
    // Fee Settings
    priorityFee?: number;        // Fixed fee (Fallback)
    dynamicFee?: boolean;        // Enable auto-calculation?
    maxPriorityFee?: number;     // Cap: Is se zyada pay nahi karega (Safety)
    useJito?: boolean;
    jitoTipSol?: number;

    // New Retry Options
    retryAttempts?: number;  // Kitni baar try kare? (Default: 3)
    retryDelayMs?: number;   // Pehli retry se pehle kitna wait kare? (Default: 1000ms)
}

export interface TradeResult {
    success: boolean;
    signature?: string;
    error?: string;
    mode: "Standard" | "Jito";
}