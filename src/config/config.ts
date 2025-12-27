// config.ts
import { PublicKey } from '@solana/web3.js';

export const PUMP_PORTAL_API = "https://pumpportal.fun/api/trade-local";
export const JITO_BLOCK_ENGINE_URL = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";

// Updated list of Jito Tip Accounts
export const JITO_TIP_ACCOUNTS = [
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "Hf3g2Q63UPSLFjHpNH3IsV8LX160yALKs4B9roVfF6W",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopDjb6u78m9LRPb2caHgKo520kk",
    "DfXygSm4jCyNCybVYYK6DwvWqjKkf8tX74eb50S9gxtN",
    "ADuUkR4ykGytmnb5qY1RuXD3hY6a5KH483QQz59JTyPt",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnIzKZ6jJ"
];

export const getRandomJitoAccount = (): PublicKey => {
    const address = JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];
    return new PublicKey(address);
};