# YieldPilot

**Your AI copilot for cross-chain yield optimization**

[![Built for Chainlink Convergence Hackathon 2026](https://img.shields.io/badge/Chainlink-Convergence%20Hackathon%202026-375BD2?style=for-the-badge&logo=chainlink&logoColor=white)](https://chain.link)
[![Live Demo](https://img.shields.io/badge/Live-Demo-00C853?style=for-the-badge)](https://frontend-drab-three-60.vercel.app)

YieldPilot is an AI-powered DeFi yield optimizer built on Chainlink's Compute Runtime Environment (CRE). It combines real-time yield data from DeFi Llama, AI-driven strategy analysis via Claude, and cross-chain execution through CCIP to help users maximize stablecoin returns across multiple chains and protocols -- all from a single conversational interface.

---

## Screenshots

![YieldPilot Dashboard](screenshot.png)
*Main dashboard -- portfolio overview, live yield rates, and strategy controls.*

![AI Chat Response](screenshot-chat.png)
*Claude analyzes opportunities and recommends an optimal yield allocation.*

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CRE Workflow                             │
│                                                                  │
│  [HTTP Trigger] --> [Fetch Yields] --> [Read Balances] -->       │
│                      (DeFi Llama)      (EVM Client)              │
│                                                                  │
│  --> [Price Validation] --> [AI Analysis] --> [Execute Strategy]  │
│       (Data Feeds)          (Claude API)     (EVM Write + CCIP)  │
│                                                                  │
│  [Cron Trigger] --> Periodic rebalancing checks                  │
└──────────────────────────────────────────────────────────────────┘
          |                     |                     |
          v                     v                     v
   +--------------+   +------------------+   +---------------+
   |  Data Feeds  |   | YieldPilotVault  |   |  CCIPBridge   |
   |  (ETH/USD,   |   |  (Deposits,      |   |  (Cross-chain |
   |   USDC/USD)  |   |   Strategies)    |   |   bridging)   |
   +--------------+   +--------+---------+   +---------------+
                               |
                      +--------+---------+
                      | YieldPilotRouter |
                      | (Aave, Compound) |
                      +------------------+
```

---

## Chainlink Primitives Used

| Primitive | Usage |
|---|---|
| **CRE Workflow** | Orchestrates the full yield optimization pipeline end-to-end |
| **CRE HTTP Client** | Fetches live DeFi Llama yields and calls the Claude API for analysis |
| **CRE EVM Client** | Reads on-chain state including wallet balances and Data Feed prices |
| **CRE EVM Write** | Executes deposits, ERC-20 approvals, and strategy transactions on-chain |
| **CCIP** | Bridges assets cross-chain to whichever chain offers the highest yield |
| **Data Feeds** | USDC price validation and peg monitoring to ensure safe execution |
| **Cron Trigger** | Periodic rebalancing checks to keep allocations optimal over time |

---

## How It Works

1. **Deposit** -- User deposits USDC into the YieldPilotVault and describes their yield goals in natural language (e.g., "Optimize for best yield, medium risk").
2. **Fetch Yields** -- The CRE workflow fires and the HTTP Client pulls live yield rates from DeFi Llama across Ethereum, Arbitrum, and other supported chains.
3. **AI Analysis** -- Claude receives the yield data, on-chain balances, and the user's risk preferences, then recommends a specific allocation (e.g., "60% Aave/Arbitrum at 5.2%, 40% Compound/Ethereum at 3.8%").
4. **User Approval** -- The recommended strategy is presented in the dashboard. The user reviews and approves before any funds move.
5. **Cross-Chain Execution** -- CCIP bridges the appropriate portion of funds to the highest-yield chain, and EVM Write deposits into the target protocols.
6. **Ongoing Monitoring** -- A Cron Trigger periodically checks yield rates and proposes rebalancing when the delta exceeds a configurable threshold.

---

## Project Structure

```
yieldpilot/
├── contracts/                # Foundry -- Solidity smart contracts
│   ├── src/
│   │   ├── YieldPilotVault.sol       # User deposits + strategy management
│   │   ├── YieldPilotRouter.sol      # Protocol routing (Aave, Compound)
│   │   ├── CCIPBridge.sol            # Cross-chain token bridging via CCIP
│   │   └── interfaces/              # Protocol interfaces (IAave, ICompound, etc.)
│   ├── test/
│   │   ├── YieldPilotVault.t.sol     # Vault unit tests
│   │   └── CCIPBridge.t.sol          # CCIP bridge tests (chainlink-local)
│   ├── script/
│   │   └── Deploy.s.sol              # Foundry deployment script
│   └── scripts/
│       ├── deploy-sepolia.sh         # Sepolia deployment helper
│       └── deploy-arb-sepolia.sh     # Arbitrum Sepolia deployment helper
├── workflow/                 # CRE workflow definitions
│   └── src/
│       ├── yield-optimizer.ts        # Main CRE workflow orchestration
│       ├── types.ts                  # Shared type definitions
│       └── index.ts                  # Entry point
├── frontend/                 # Next.js web application
│   └── src/
│       ├── app/
│       │   ├── page.tsx              # Main page
│       │   ├── layout.tsx            # Root layout
│       │   └── api/                  # API routes (chat, yields)
│       ├── components/
│       │   ├── ChatInterface.tsx     # Conversational AI interface
│       │   ├── PortfolioDashboard.tsx# Portfolio overview + allocations
│       │   ├── YieldCard.tsx         # Individual yield opportunity card
│       │   └── Header.tsx            # Navigation header
│       └── lib/                      # Utility functions
└── scripts/                  # Top-level utility scripts
```

---

## Quick Start

### Prerequisites

- Node.js >= 18
- Foundry (`forge`, `cast`, `anvil`)
- An Anthropic API key (for Claude)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/yieldpilot.git
cd yieldpilot

# Copy environment variables and fill in your keys
cp .env.example .env

# Install frontend dependencies
cd frontend && npm install

# Build smart contracts
cd ../contracts && forge build

# Run contract tests
forge test
```

### Run the Frontend

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

### Deploy Contracts

```bash
cd contracts

# Deploy to Sepolia
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# Deploy to Arbitrum Sepolia
forge script script/Deploy.s.sol --rpc-url $ARBITRUM_SEPOLIA_RPC_URL --broadcast
```

---

## Smart Contracts

| Contract | Description |
|---|---|
| **YieldPilotVault.sol** | Core vault contract. Handles user USDC deposits, strategy storage, and fund allocation across protocols. |
| **YieldPilotRouter.sol** | Routes deposits and withdrawals to underlying DeFi protocols (Aave, Compound) based on the active strategy. |
| **CCIPBridge.sol** | Manages cross-chain asset transfers via Chainlink CCIP, enabling funds to move to whichever chain has the best yield. |

All contracts are built with Solidity 0.8.20 and tested using Foundry with [chainlink-local](https://github.com/smartcontractkit/chainlink-local) for CCIP simulation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.20, Foundry |
| Workflow | Chainlink CRE SDK (TypeScript) |
| Frontend | Next.js 15, Tailwind CSS, wagmi, viem |
| AI | Claude claude-sonnet-4-5-20250929 (Anthropic API) |
| Yield Data | DeFi Llama API |
| Cross-Chain | Chainlink CCIP |
| Testnets | Sepolia, Arbitrum Sepolia (Tenderly Virtual TestNets) |

---

## Tracks

| Track | Prize |
|---|---|
| **Primary:** DeFi & Tokenization | $20K |
| **Secondary:** CRE & AI | $17K |

---

## Live Demo

**[https://frontend-drab-three-60.vercel.app](https://frontend-drab-three-60.vercel.app)**

---

## Team

Built by **Gabe & Aria** for the Chainlink Convergence Hackathon 2026.
