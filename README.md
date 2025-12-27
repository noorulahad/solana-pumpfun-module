# 🚀 Solana PumpFun Swap SDK (Trading Bot & Jito Integration)
> **The ultimate TypeScript module for Pump.fun trading, sniping, and selling with built-in Jito MEV Protection.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Web3.js-black.svg)](https://solana.com/)
[![Jito](https://img.shields.io/badge/MEV-Protected-red.svg)](https://jito.wtf/)

A professional, object-oriented TypeScript module for programmatically trading tokens on **Pump.fun**. This module supports standard transactions and **Jito Bundles** for MEV protection and faster execution.

## ✨ Features

- **⚡ Fast & Efficient**: Optimized for speed with low-latency execution.
- **🛡️ Jito Bundle Support**: detailed integration with Jito Block Engine to bypass network congestion and avoid MEV sandwich attacks.
- **📊 Smart Priority Fees**: Automatically calculates fees based on the 75th percentile of network load to ensure transaction confirmation.
- **🔄 Auto-Retry Mechanism**: Built-in exponential backoff to handle network failures gracefully.
- **🔌 Wallet Agnostic**: Implement `IWallet` to use any wallet strategy (Keypair, Ledger, etc.).
- **⚙️ Configurable**: Easy customization of slippage, dynamic fees, and Jito tip amounts.

## ❓ Why Use This SDK?

Unlike basic scripts, this module is engineered for **reliability** and **speed**:

* **🚫 Anti-MEV / Anti-Sandwich:** By using Jito Bundles, your transactions bypass the public mempool, making it impossible for bots to front-run or sandwich your trades.
* **⚡ High-Frequency Friendly:** The `PumpFunSwap` class is persistent, meaning you don't reconnect to RPC for every trade. Perfect for **sniping bots**.
* **🧩 Plug-and-Play:** Designed as a drop-in module for any Telegram Bot, Web App, or CLI tool.

---

## 📦 Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/noorulahad/solana-pumpfun-module.git
cd solana-pumpfun-module
npm install
```

## ⚙️ Configuration

1. Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

2. Add your Solana RPC URL (Helius, QuickNode, etc.) and your Wallet Private Key (Base58 format) to the `.env` file:
   ```env
   HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
   PRIVATE_KEY=YOUR_WALLET_PRIVATE_KEY_BASE58
   ```

---

## 🚀 Usage

### 1. Initialize the Trader

First, import the `PumpFunSwap` class and initialize it with your configuration.

```typescript
import { PumpFunSwap } from './src/core/PumpFunSwap';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';
// Your Wallet Implementation (see index.ts for NodeWallet example)
import { NodeWallet } from './src/index'; 

dotenv.config();

const keypair = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
const wallet = new NodeWallet(keypair);

const trader = new PumpFunSwap({
    rpcUrl: process.env.HELIUS_RPC_URL!,
    wallet: wallet
});
```

### 2. Standard Buy (Example)

Perform a simple buy transaction on Pump.fun.

```typescript
const result = await trader.buy({
    mint: "Token_CA_Address_Here",
    amount: 0.1,          // Amount in SOL
    slippagePct: 2,       // 2% Slippage
    priorityFee: 0.0001,  // Fixed Fee (Fallback)
    dynamicFee: true,     // ✅ Enable Auto Fee Estimation
    maxPriorityFee: 0.01  // ✅ Max Spend Cap
});

if (result.success) {
    console.log(`Buy Successful: https://solscan.io/tx/${result.signature}`);
}
```

### 3. Jito Protected Buy (Advanced)

Use Jito bundles to bribe validators for guaranteed faster entry and MEV protection.

```typescript
const result = await trader.buy({
    mint: "Token_CA_Address_Here",
    amount: 0.1,
    useJito: true,      // Enable Jito
    jitoTipSol: 0.001   // Bribe Amount
});
```

### 4. Sell Tokens

Sell a specific amount of tokens.

```typescript
await trader.sell({
    mint: "Token_CA_Address_Here",
    amount: 100000,    // Amount of TOKENS to sell
    slippagePct: 1
});
```

### 5. Sell All Tokens

Automatically fetch balance and sell 100% of holdings for a given token.

```typescript
await trader.sellAll({
    mint: "Token_CA_Address_Here",
    useJito: true,     // Optional: Use Jito for exit
    jitoTipSol: 0.001
});
```

---

## 📂 Project Structure

```
solana-pumpfun-module/
├── src/
│   ├── config/
│   │   └── config.ts        # API Endpoints & Jito Tip Accounts
│   ├── core/
│   │   └── PumpFunSwap.ts   # Main Trading Logic Class
│   ├── types/
│   │   └── types.ts         # TypeScript Interfaces & Types
│   └── index.ts             # Entry Point / Example Usage
├── .env.example             # Environment Variable Template
├── package.json
└── README.md
```

## 🛠️ Build & Run

**Development Mode:**
```bash
npm run dev
```

**Build for Production:**
```bash
npm run build
npm start
```

## ⭐ Support

If you found this module helpful, please **give it a Star**! 🌟
It helps others find this repo and motivates me to add new features (like Jupiter support).

## 📜 License

This project is licensed under the **ISC License**.

## 🔧 Common Issues & Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `Simulation Error` | Not enough SOL or Slippage too low. | Increase `slippagePct` or ensure you have SOL for gas + rent. |
| `Jito Bundle Dropped` | Tip too low during congestion. | Increase `jitoTipSol` (e.g., to 0.005) during high volume. |
| `401 Unauthorized` | Invalid API Key or RPC URL. | Check your `.env` file and verify RPC subscription. |

## ⚠️ Disclaimer

**Use at your own risk.** Trading cryptocurrencies involves significant risk and can result in the loss of your capital. This is a developer tool and should be tested thoroughly before using real funds.