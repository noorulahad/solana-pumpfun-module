import { PumpFunSwap } from '../src/core/PumpFunSwap';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
    // Initialize
    const trader = new PumpFunSwap({
        rpcUrl: process.env.HELIUS_RPC_URL!,
        privateKey: process.env.PRIVATE_KEY!
    });

    const TOKEN_CA = "61V8vBaqAGMpgDQi4JdBybAf9935oJimPls6dC5k1eva"; // Example CA

    // 1. Buy Example (Standard)
    // await trader.buy({
    //     mint: TOKEN_CA,
    //     amount: 0.01, // 0.01 SOL
    //     slippagePct: 2
    // });

    // 2. Buy Example (With Jito Protection)
    const buyResult = await trader.buy({
        mint: TOKEN_CA,
        amount: 0.05,
        useJito: true,
        jitoTipSol: 0.001
    });

    if (buyResult.success) {
        console.log("Buy Done, waiting to sell...");

        // 3. Sell All Example (With Jito)
        await new Promise(r => setTimeout(r, 5000)); // Wait 5 sec
        await trader.sellAll({
            mint: TOKEN_CA,
            useJito: true,
            jitoTipSol: 0.001
        });
    }

})();