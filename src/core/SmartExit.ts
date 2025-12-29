import { PumpFunSwap } from './PumpFunSwap';

export class SmartExit {
    private trader: PumpFunSwap;
    private mint: string;
    private entryPrice: number; // SOL per token
    private stopLossPrice: number;
    private tokenBalance: number; // ✅ Store Balance Here
    private takeProfitLevelHasTriggered: boolean = false;
    private isRunning: boolean = false;
    private subscriptionId?: number;

    // Request 'initialBalance' in constructor
    constructor(trader: PumpFunSwap, mint: string, entryPrice: number, initialBalance: number) {
        this.trader = trader;
        this.mint = mint;
        this.entryPrice = entryPrice;
        this.tokenBalance = initialBalance; // ✅ Save it locally

        // Initial Stop Loss: -15% (Give some room so we don't get stopped out by noise)
        this.stopLossPrice = entryPrice * 0.85;
    }

    public async start() {
        console.log(`\n🛡️ Smart Exit Activated for ${this.mint}`);
        console.log(`   Holding: ${this.tokenBalance} Tokens`);
        console.log(`   Stop Loss: ${this.stopLossPrice.toFixed(9)} SOL`);

        this.isRunning = true;

        // Use WebSocket Subscription (Event Driven)
        // This effectively replaces the loop
        this.subscriptionId = this.trader.onBondingCurveChange(this.mint, (updatedPrice) => {
            if (!this.isRunning) return;
            this.checkStrategy(updatedPrice);
        });

        console.log(`   🔌 WebSocket Connected (ID: ${this.subscriptionId}). Waiting for price updates...`);

        // Keep the process alive or handle this differently in a real bot structure
        // In a script, we might need to keep the event loop busy if this is the only thing running.
        // For now, we rely on the connection keeping open.
    }

    public stop() {
        console.log("🛑 Smart Exit Stopped.");
        this.isRunning = false;
        if (this.subscriptionId !== undefined) {
            this.trader.removeListener(this.subscriptionId);
            this.subscriptionId = undefined;
        }
    }

    private async checkStrategy(currentPrice: number) {
        const changePct = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;
        process.stdout.write(`\r📉 P/L: ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% | Price: ${currentPrice.toFixed(9)} SOL | Stop: ${this.stopLossPrice.toFixed(9)}     `);

        // 1. Check Stop Loss / Rug
        if (currentPrice <= this.stopLossPrice) {
            console.log(`\n\n🚨 STOP LOSS HIT! Selling immediately from MEMORY...`);
            await this.executeSell();
            return;
        }

        // 2. Trailing Stop Logic (Auto-Compounding Safety) (Hindi: Auto-Compounding Safety)
        if (!this.takeProfitLevelHasTriggered && changePct >= 50) {
            this.takeProfitLevelHasTriggered = true;
            this.stopLossPrice = this.entryPrice * 1.20; // Secure 20% profit
            console.log(`\n\n🚀 MOON DETECTED! Stop Loss moved to +20% locked.`);
        }
    }

    private async executeSell() {
        this.isRunning = false; // Stop listeners first
        this.stop();

        // ⚡ SPEED UPGRADE: Execute trade directly, do not check balance
        const result = await this.trader.sell({
            mint: this.mint,
            amount: this.tokenBalance, // ✅ Use Memory Balance (0ms Latency)
            slippagePct: 15, // Panic Mode needs high slippage
            priorityFee: 0.005,
            dynamicFee: true,
            useJito: true // Must use Jito for exit to ensure landing
        });

        if (result.success) {
            console.log("✅ Smart Exit Executed Successfully!");
        } else {
            console.error("❌ Smart Exit Failed:", result.error);
            // If failed, might need to check balance (Fallback)
        }
    }
}
