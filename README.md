# 🚀 Solana PumpFun Swap SDK (God-Tier Edition)
> **The ultimate TypeScript module for Pump.fun trading, equipped with Sniper-Speed Local Execution, Helius AI Fees, Jito Failover, and Memory-Based Panic Exits.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Web3.js-black.svg)](https://solana.com/)
[![Jito](https://img.shields.io/badge/MEV-Protected-red.svg)](https://jito.wtf/)
[![Helius](https://img.shields.io/badge/RPC-Optimized-orange.svg)](https://helius.dev/)

A professional, object-oriented TypeScript module for programmatically trading tokens on **Pump.fun**. This module has been engineered for **High-Frequency Trading (HFT)**, bypassing standard API latencies by building transactions locally with Anchor and routing them through next-generation infrastructure.

## ✨ God-Tier Features

- **⚡ Local Anchor Engine**: Removed slow HTTP APIs. Transactions are built locally using the IDL, ensuring **Zero-Latency** construction.
- **🧠 Smart Exit System**:
  - **Memory-Based Panic Sell**: Executes exits instantly from RAM (0ms read latency) without fetching balances.
  - **WebSocket Price Feed**: Uses Helius-optimized `onAccountChange` listeners (<200ms) instead of polling loop.
  - **Trailing Stop Loss**: Automatically locks in profits when price surges.
- **🛡️ Jito Enterprise Integration**:
  - **Multi-Region Failover**: Instantly switches between NY, Amsterdam, Frankfurt, and Tokyo block engines if one fails.
  - **Smart Rotation**: Round-robin selection of Tip Accounts to prevent write-lock contention.
  - **Revert Protection**: Bundles ensure you don't pay gas if the trade fails.
- **🤖 Helius AI Priority Fees**: Fetches real-time, high-precision fee estimates specifically for the Pump.fun program, not just general network averages.
- **🔌 Wallet Agnostic**: Implement `IWallet` to use any wallet strategy.

---

## 🚀 Architecture: The "Golden Combo"

This bot uses a hybrid strategy proven to be the fastest setup on Solana:

1.  ** 👀 The Eyes (Helius)**: used for **Reading**.
    *   WebSocket price streaming.
    *   Account balance monitoring.
    *   AI Priority Fee estimation.
2.  ** 🥊 The Hands (Jito)**: used for **Writing**.
    *   Transaction execution via Bundles.
    *   Landing trades during heavy congestion.

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

2. Add your **Helius RPC URL** (Crucial for AI fees & fast sockets) and **Private Key**:
   ```env
   HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
   PRIVATE_KEY=YOUR_WALLET_PRIVATE_KEY_BASE58
   ```

---

## 💻 Usage Code

### 1. Initialize the Trader
```typescript
import { PumpFunSwap } from './src/core/PumpFunSwap';
import { SmartExit } from './src/core/SmartExit';
import { NodeWallet } from './src/index'; 

// ... setup wallet ...

const trader = new PumpFunSwap({
    rpcUrl: process.env.HELIUS_RPC_URL!,
    wallet: wallet
});
```

### 2. Sniper Buy (with Jito & Helius Fees)
```typescript
const result = await trader.buy({
    mint: "Token_CA_Address",
    amount: 0.1,            // 0.1 SOL
    slippagePct: 5,         // 5% Slippage (Optimized for Pump.fun volatility)
    dynamicFee: true,       // ✅ Helius AI Fee Estimation
    useJito: true,          // ✅ Jito Bundle Protection
    jitoTipSol: 0.001       // Tip Amount
});
```

### 3. Smart Exit (Zero-Latency Automation)
Automatically manages the position after a purchase.

```typescript
if (result.success) {
    // 1. Wait for RPC Indexing
    await new Promise(r => setTimeout(r, 3000));
    
    // 2. Fetch Exact Balance
    const balance = await trader.getTokenBalance(TOKEN_CA);
    
    // 3. Initialize Smart Exit (Memory Resident)
    const smartExit = new SmartExit(trader, TOKEN_CA, entryPrice, balance);
    
    // 4. Start WebSocket Monitor
    await smartExit.start();
}
```

---

## 📂 Project Structure

```
solana-pumpfun-module/
├── src/
│   ├── config/
│   │   ├── config.ts        # Jito Regional URLs & Tip Accounts
│   │   └── idl.ts           # Pump.fun Anchor IDL
│   ├── core/
│   │   ├── PumpFunSwap.ts   # Core Logic (Helius Fees, Anchor Builder)
│   │   ├── SmartExit.ts     # WebSocket Monitor & Panic Sell Engine
│   │   └── JitoManager.ts   # Round-Robin Failover System
│   ├── index.ts             # Main Entry Point
└── README.md
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| `Slippage Exceeded` | Default slippage is now 5%. If high volume, increase to 10%+. |
| `Helius Fee Error` | Ensure your RPC URL in `.env` has a valid API Key. |
| `Balance not found` | The code includes a 3s wait after buy. RPCs can be slow to index. |

## ⚠️ Disclaimer

**High-Frequency Trading carries risk.** Use this software at your own risk. The authors are not responsible for any financial losses.