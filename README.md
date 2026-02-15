# YieldPilot

**Your AI copilot for cross-chain yield optimization**

YieldPilot is an AI-powered DeFi yield optimizer built on Chainlink's Runtime Environment (CRE). It combines real-time yield data, AI-driven strategy analysis, and cross-chain execution to help users maximize their stablecoin returns across multiple chains and protocols.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CRE Workflow                             │
│                                                                 │
│  [HTTP Trigger] ─→ [Fetch Yields] ─→ [Read Balances] ─→        │
│                     (DeFi Llama)     (EVM Client)               │
│                                                                 │
│  ─→ [Price Validation] ─→ [AI Analysis] ─→ [Execute Strategy]  │
│      (Data Feeds)         (Claude API)     (EVM Write + CCIP)   │
│                                                                 │
│  [Cron Trigger] ─→ Periodic rebalancing checks                  │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌─────────────┐   ┌─────────────────┐   ┌──────────────┐
  │  Data Feeds  │   │  YieldPilotVault │   │  CCIPBridge   │
  │  (ETH/USD,   │   │  (Deposits,      │   │  (Cross-chain │
  │   USDC/USD)  │   │   Strategies)    │   │   bridging)   │
  └─────────────┘   └────────┬────────┘   └──────────────┘
                              │
                     ┌────────┴────────┐
                     │ YieldPilotRouter │
                     │ (Aave, Compound) │
                     └─────────────────┘
```

## Chainlink Primitives Used

| Primitive | Usage |
|-----------|-------|
| **CRE Workflow** | Orchestrates the full yield optimization pipeline |
| **CRE HTTP Client** | Fetches DeFi Llama yields, calls Claude API |
| **CRE EVM Client** | Reads on-chain state (balances, Data Feeds) |
| **CRE EVM Write** | Executes deposits, approvals, strategy transactions |
| **CCIP** | Bridges assets to highest-yield chain |
| **Data Feeds** | Price validation for USDC peg monitoring |
| **Cron Trigger** | Periodic rebalancing checks |

## Project Structure

```
yieldpilot/
├── contracts/          # Foundry - Solidity smart contracts
│   ├── src/
│   │   ├── YieldPilotVault.sol    # User deposits + strategy management
│   │   ├── YieldPilotRouter.sol   # Protocol routing (Aave, Compound)
│   │   ├── CCIPBridge.sol         # Cross-chain token bridging
│   │   └── interfaces/            # Protocol interfaces
│   ├── test/                      # Foundry tests
│   └── script/                    # Deployment scripts
├── workflow/           # CRE workflow definitions (TypeScript)
│   └── src/
│       ├── yield-optimizer.ts     # Main workflow
│       └── types.ts               # Shared types
├── frontend/           # Next.js app
│   └── src/
│       ├── app/                   # Pages + API routes
│       └── components/            # Chat UI + Dashboard
└── scripts/            # Deployment & utility scripts
```

## Quick Start

### Prerequisites

- Node.js >= 18
- Foundry (forge, cast, anvil)
- An Anthropic API key

### Setup

```bash
# Clone and install
git clone <repo-url> yieldpilot
cd yieldpilot

# Copy environment variables
cp .env.example .env
# Edit .env with your keys

# Install frontend dependencies
cd frontend && npm install

# Build contracts
cd ../contracts && forge build

# Run contract tests
forge test
```

### Run Frontend

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

### Deploy Contracts

```bash
# Sepolia
cd contracts
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# Arbitrum Sepolia
forge script script/Deploy.s.sol --rpc-url $ARBITRUM_SEPOLIA_RPC_URL --broadcast
```

## Demo Flow

1. User deposits USDC into YieldPilotVault
2. Types: "Optimize my USDC for best yield, medium risk"
3. CRE workflow fires: fetches yields → reads balances → calls AI
4. AI responds: "Recommend 60% Aave/Arbitrum (5.2%), 40% Compound/Ethereum (3.8%)"
5. User approves strategy
6. CCIP bridges portion to Arbitrum, deposits into protocols
7. Cron trigger monitors yields, proposes rebalance if delta exceeds threshold

## Tech Stack

- **Smart Contracts:** Solidity 0.8.20, Foundry
- **Workflow:** Chainlink CRE SDK (TypeScript)
- **Frontend:** Next.js 15, Tailwind CSS, wagmi/viem
- **AI:** Claude claude-sonnet-4-5-20250929 (Anthropic API)
- **Data:** DeFi Llama API
- **Cross-chain:** Chainlink CCIP
- **Testnets:** Sepolia, Arbitrum Sepolia (via Tenderly Virtual TestNet)

## Tracks

- **Primary:** DeFi & Tokenization
- **Secondary:** CRE & AI

## Team

Built by Gabe & Aria for the Chainlink Convergence Hackathon 2026.
