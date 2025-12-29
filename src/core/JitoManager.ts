import { PublicKey } from '@solana/web3.js';
import fetch from 'node-fetch';
import { JITO_BLOCK_ENGINE_URLS, JITO_TIP_ACCOUNTS } from '../config/config';

export class JitoManager {
    private static currentEngineIndex = 0;
    private static currentTipIndex = 0;

    /**
     * Get the next Jito Tip Account (Round-Robin)
     * Reduces write-lock contention on a single account during high volume.
     */
    public static getNextTipAccount(): PublicKey {
        const address = JITO_TIP_ACCOUNTS[this.currentTipIndex];
        this.currentTipIndex = (this.currentTipIndex + 1) % JITO_TIP_ACCOUNTS.length;
        return new PublicKey(address);
    }

    /**
     * Send bundle trying multiple regions if one fails (Failover Strategy)
     */
    public static async sendBundle(bundle: string[]): Promise<string> {
        // Try starting from the current "best" engine
        let attempts = 0;
        const maxAttempts = JITO_BLOCK_ENGINE_URLS.length;

        // Clone and reorder based on current index to try the "active" one first
        // [0, 1, 2] -> if index 1 -> [1, 2, 0]
        const enginesToTry = [
            ...JITO_BLOCK_ENGINE_URLS.slice(this.currentEngineIndex),
            ...JITO_BLOCK_ENGINE_URLS.slice(0, this.currentEngineIndex)
        ];

        for (const url of enginesToTry) {
            console.log(`🛡️ Sending to Jito Engine: ${url.split('//')[1].split('/')[0]}...`);

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: 1,
                        method: "sendBundle",
                        params: [bundle]
                    })
                });

                if (response.status !== 200) {
                    throw new Error(`Status ${response.status}`);
                }

                const result: any = await response.json();
                if (result.error) {
                    throw new Error(result.error.message || JSON.stringify(result.error));
                }

                // If success, update the index so we stick with this working engine
                this.currentEngineIndex = JITO_BLOCK_ENGINE_URLS.indexOf(url);
                return result.result; // Bundle ID

            } catch (error: any) {
                console.warn(`⚠️ Engine Failed (${url}): ${error.message}. Switching...`);
                attempts++;
                // If this engine failed, we just continue to the next iteration (next engine)
            }
        }

        throw new Error(`❌ All Jito Engines Failed after ${attempts} attempts.`);
    }
}
