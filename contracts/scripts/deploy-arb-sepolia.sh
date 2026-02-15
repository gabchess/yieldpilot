#!/bin/bash
# Deploy YieldPilot contracts to Arbitrum Sepolia testnet
#
# Prerequisites:
#   - .env file with ARB_SEPOLIA_RPC_URL, PRIVATE_KEY, USDC_ADDRESS,
#     USDC_USD_FEED, CCIP_ROUTER, LINK_TOKEN, ARBISCAN_API_KEY
#   - Run: source .env
#
# Arbitrum Sepolia CCIP Configuration:
#   CCIP Router:  0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165
#   LINK Token:   0xb1D4538B4571d411F07960EF2838Ce337FE1E80E
#   Chain Selector: 3478487238524512106

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ ! -f .env ]; then
    echo "Error: .env file not found. Copy .env.example and fill in values."
    exit 1
fi

source .env

echo "Deploying YieldPilot to Arbitrum Sepolia..."
echo "RPC: $ARB_SEPOLIA_RPC_URL"

forge script script/Deploy.s.sol \
    --rpc-url "$ARB_SEPOLIA_RPC_URL" \
    --broadcast \
    --verify \
    --etherscan-api-key "$ARBISCAN_API_KEY" \
    -vvvv

echo "Deployment complete. Check broadcast/ for deployment artifacts."
