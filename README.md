# 🚀 Solana PumpFun Swap Module

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Web3.js-black.svg)](https://solana.com/)
[![License](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)

A professional, object-oriented TypeScript module for programmatically trading tokens on **Pump.fun**. This module supports standard transactions and **Jito Bundles** for MEV protection and faster execution.

## ✨ Features

- **⚡ Fast & Efficient**: Optimized for speed with low-latency execution.
- **🛡️ Jito Bundle Support**: detailed integration with Jito Block Engine to bypass network congestion and avoid MEV sandwich attacks.
- **🔄 Complete Trading Suite**: Support for `Buy`, `Sell`, and `SellAll` operations.
- **⚙️ Configurable**: Easy customization of slippage, priority fees, and Jito tip amounts per transaction.
- **🏗️ OOP Design**: Clean Class-based architecture for easy integration into larger bot frameworks.
- **🔐 Secure**: Local keypair management with environment variable support.

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
import dotenv from 'dotenv';
dotenv.config();

const trader = new PumpFunSwap({
    rpcUrl: process.env.HELIUS_RPC_URL!,
    privateKey: process.env.PRIVATE_KEY!
});
```

### 2. Standard Buy (Example)

Perform a simple buy transaction on Pump.fun.

```typescript
const result = await trader.buy({
    mint: "Token_CA_Address_Here",
    amount: 0.1,          // Amount in SOL
    slippagePct: 2,       // 2% Slippage
    priorityFee: 0.0001   // Standard Priority Fee
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

## 📜 License

This project is licensed under the **ISC License**.

## ⚠️ Disclaimer

**Use at your own risk.** Trading cryptocurrencies involves significant risk and can result in the loss of your capital. This is a developer tool and should be tested thoroughly before using real funds.