#!/bin/bash
# Deploy YieldPilot contracts to Ethereum Sepolia testnet
#
# Prerequisites:
#   - .env file with SEPOLIA_RPC_URL, PRIVATE_KEY, USDC_ADDRESS,
#     USDC_USD_FEED, CCIP_ROUTER, LINK_TOKEN, ETHERSCAN_API_KEY
#   - Run: source .env
#
# Sepolia CCIP Configuration:
#   CCIP Router:  0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59
#   LINK Token:   0x779877A7B0D9E8603169DdbD7836e478b4624789
#   Chain Selector: 16015286601757825753

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ ! -f .env ]; then
    echo "Error: .env file not found. Copy .env.example and fill in values."
    exit 1
fi

source .env

echo "Deploying YieldPilot to Sepolia..."
echo "RPC: $SEPOLIA_RPC_URL"

forge script script/Deploy.s.sol \
    --rpc-url "$SEPOLIA_RPC_URL" \
    --broadcast \
    --verify \
    --etherscan-api-key "$ETHERSCAN_API_KEY" \
    -vvvv

echo "Deployment complete. Check broadcast/ for deployment artifacts."
