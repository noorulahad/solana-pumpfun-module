// types.ts
import { Keypair, VersionedTransaction } from '@solana/web3.js';

export type TradeAction = "buy" | "sell";

export interface SwapConfig {
    rpcUrl: string;
    privateKey: string;
    apiKey?: string; // Optional PumpPortal API Key
}

export interface TradeOptions {
    mint: string;
    amount: number;         // SOL for Buy, Tokens for Sell
    slippagePct?: number;   // Default: 1%
    priorityFee?: number;   // Default: 0.0001 SOL
    useJito?: boolean;      // Toggle Jito protection
    jitoTipSol?: number;    // Bribe amount for Jito (e.g., 0.001)
}

export interface TradeResult {
    success: boolean;
    signature?: string;
    error?: string;
    mode: "Standard" | "Jito";
}