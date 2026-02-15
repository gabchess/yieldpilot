import { NextRequest, NextResponse } from 'next/server';

interface YieldPool {
  pool: string;
  chain: string;
  project: string;
  protocol: string;
  symbol: string;
  tvl: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  stablecoin: boolean;
}

interface Allocation {
  protocol: string;
  chain: string;
  pool: string;
  symbol: string;
  amount: number;
  percentage: number;
  apy: number;
}

interface ClaudeResponse {
  recommendation: string;
  allocations: Allocation[];
  projectedApy: number;
}

const SYSTEM_PROMPT = `You are YieldPilot, an expert DeFi yield analyst and portfolio optimizer. You help users maximize their returns across DeFi protocols and chains while managing risk.

Your capabilities:
- Analyze real-time yield data from major DeFi protocols
- Recommend optimal portfolio allocations across chains and protocols
- Explain risks including smart contract risk, impermanent loss, and depegging risk
- Suggest rebalancing strategies when better opportunities arise

Guidelines:
- Always be specific with numbers: APY, TVL, allocation percentages
- Consider protocol risk, chain risk, and smart contract audit status
- For conservative profiles: stick to battle-tested protocols (Aave, Compound, Lido) with stablecoin-only strategies
- For moderate profiles: include established newer protocols (Morpho, Pendle) with some volatile asset exposure
- For aggressive profiles: include newer protocols and leveraged strategies
- Always mention the risks alongside opportunities
- Use precise, professional language befitting a financial analyst
- When recommending allocations, ensure percentages sum to 100%

IMPORTANT: You MUST respond with valid JSON in this exact format:
{
  "recommendation": "Your detailed analysis and explanation here as a string",
  "allocations": [
    {
      "protocol": "Protocol Name",
      "chain": "Chain Name",
      "pool": "Pool Description",
      "symbol": "TOKEN",
      "amount": 10000,
      "percentage": 20,
      "apy": 5.5
    }
  ],
  "projectedApy": 5.2
}

The "recommendation" field should contain your full analysis as readable text.
The "allocations" array should contain specific protocol/chain allocations if applicable (can be empty [] for general questions).
The "projectedApy" should be the weighted average APY of your recommendation (0 if no specific allocation).
Assume a default portfolio of $50,000 if user doesn't specify an amount, and use that to calculate the "amount" field for each allocation.`;

async function fetchYieldData(): Promise<YieldPool[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/yields`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return data.pools || [];
    }
  } catch (error) {
    console.error('Error fetching yield data for chat:', error);
  }
  return [];
}

function formatYieldContext(pools: YieldPool[], riskProfile: string): string {
  if (pools.length === 0) {
    return 'Note: Live yield data is temporarily unavailable. Use your general knowledge of current DeFi yields to provide recommendations.';
  }

  const top20 = pools.slice(0, 20);
  const context = top20.map(p =>
    `- ${p.protocol} on ${p.chain}: ${p.symbol} pool, APY ${p.apy}%, TVL $${(p.tvl / 1_000_000).toFixed(1)}M`
  ).join('\n');

  return `Current top stablecoin yield opportunities (real-time data from DeFi Llama):
${context}

User's risk profile: ${riskProfile}
Use this data to make specific, data-driven recommendations.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, riskProfile = 'moderate' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    // Fetch current yield data
    const yieldPools = await fetchYieldData();
    const yieldContext = formatYieldContext(yieldPools, riskProfile);

    // If no API key, return intelligent mock response
    if (!apiKey) {
      return NextResponse.json(generateMockResponse(message, yieldPools, riskProfile));
    }

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `${yieldContext}\n\nUser question: ${message}`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', errorText);
      // Fall back to mock response
      return NextResponse.json(generateMockResponse(message, yieldPools, riskProfile));
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content?.[0]?.text || '';

    // Try to parse JSON from Claude's response
    try {
      const parsed: ClaudeResponse = JSON.parse(responseText);
      return NextResponse.json(parsed);
    } catch {
      // If Claude didn't return valid JSON, wrap the text response
      return NextResponse.json({
        recommendation: responseText,
        allocations: [],
        projectedApy: 0,
      });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateMockResponse(message: string, pools: YieldPool[], riskProfile: string): ClaudeResponse {
  const lowerMessage = message.toLowerCase();

  // Use real pool data if available
  const topPools = pools.length > 0 ? pools.slice(0, 8) : [
    { protocol: 'Morpho', chain: 'Ethereum', symbol: 'USDC', apy: 7.2, tvl: 890_000_000 },
    { protocol: 'Aave', chain: 'Base', symbol: 'USDC', apy: 5.8, tvl: 1_200_000_000 },
    { protocol: 'Compound', chain: 'Arbitrum', symbol: 'USDC', apy: 5.1, tvl: 650_000_000 },
    { protocol: 'Pendle', chain: 'Ethereum', symbol: 'USDC', apy: 8.4, tvl: 320_000_000 },
    { protocol: 'Aave', chain: 'Optimism', symbol: 'USDC', apy: 4.5, tvl: 440_000_000 },
    { protocol: 'Stargate', chain: 'Arbitrum', symbol: 'USDC', apy: 3.9, tvl: 280_000_000 },
  ] as YieldPool[];

  // Determine portfolio size from message or default
  let portfolioSize = 50000;
  const amountMatch = message.match(/\$?([\d,]+)k?\b/i);
  if (amountMatch) {
    let val = parseInt(amountMatch[1].replace(/,/g, ''));
    if (message.toLowerCase().includes('k')) val *= 1000;
    if (val > 100) portfolioSize = val;
  }

  if (lowerMessage.includes('best') || lowerMessage.includes('top') || lowerMessage.includes('yield') || lowerMessage.includes('stablecoin')) {
    const selectedPools = topPools.slice(0, 4);
    const allocPercentages = riskProfile === 'conservative'
      ? [40, 30, 20, 10]
      : riskProfile === 'aggressive'
        ? [20, 20, 30, 30]
        : [30, 25, 25, 20];

    const allocations: Allocation[] = selectedPools.map((pool, i) => ({
      protocol: pool.protocol,
      chain: pool.chain,
      pool: `${pool.symbol} Supply`,
      symbol: pool.symbol,
      amount: Math.round(portfolioSize * allocPercentages[i] / 100),
      percentage: allocPercentages[i],
      apy: pool.apy,
    }));

    const projectedApy = allocations.reduce((acc, a) => acc + (a.apy * a.percentage / 100), 0);

    return {
      recommendation: `Based on current market conditions, here are the top stablecoin yield opportunities I've identified across chains.\n\nFor your ${riskProfile} risk profile, I recommend diversifying across ${selectedPools.length} positions. The strategy focuses on ${riskProfile === 'conservative' ? 'battle-tested protocols with the highest TVL' : riskProfile === 'aggressive' ? 'maximizing yield with newer but audited protocols' : 'a balanced mix of established and emerging protocols'}.\n\nKey considerations:\n- All positions are in stablecoins, minimizing impermanent loss risk\n- Diversification across ${new Set(selectedPools.map(p => p.chain)).size} chains reduces single-chain risk\n- The weighted average APY of ${projectedApy.toFixed(2)}% projects to ~$${Math.round(portfolioSize * projectedApy / 100).toLocaleString()} annually on your $${portfolioSize.toLocaleString()} portfolio`,
      allocations,
      projectedApy: Math.round(projectedApy * 100) / 100,
    };
  }

  if (lowerMessage.includes('optimize') || lowerMessage.includes('portfolio') || lowerMessage.includes('allocation')) {
    const allocations: Allocation[] = [
      { protocol: topPools[0]?.protocol || 'Morpho', chain: topPools[0]?.chain || 'Ethereum', pool: 'USDC Vault', symbol: 'USDC', amount: Math.round(portfolioSize * 0.30), percentage: 30, apy: topPools[0]?.apy || 7.2 },
      { protocol: topPools[1]?.protocol || 'Aave', chain: topPools[1]?.chain || 'Base', pool: 'USDC Supply', symbol: 'USDC', amount: Math.round(portfolioSize * 0.25), percentage: 25, apy: topPools[1]?.apy || 5.8 },
      { protocol: topPools[2]?.protocol || 'Compound', chain: topPools[2]?.chain || 'Arbitrum', pool: 'USDC Supply', symbol: 'USDC', amount: Math.round(portfolioSize * 0.25), percentage: 25, apy: topPools[2]?.apy || 5.1 },
      { protocol: topPools[3]?.protocol || 'Pendle', chain: topPools[3]?.chain || 'Ethereum', pool: 'USDC PT', symbol: 'USDC', amount: Math.round(portfolioSize * 0.20), percentage: 20, apy: topPools[3]?.apy || 8.4 },
    ];
    const projectedApy = allocations.reduce((acc, a) => acc + (a.apy * a.percentage / 100), 0);

    return {
      recommendation: `I've analyzed your portfolio and current market yields to create an optimized allocation strategy.\n\nMy recommendation shifts capital toward the highest-yielding opportunities while maintaining protocol diversification. The key changes from a typical allocation:\n\n1. Increase exposure to ${allocations[0].protocol} on ${allocations[0].chain} -- currently offering ${allocations[0].apy}% APY with strong TVL\n2. Maintain core positions in blue-chip lending (${allocations[1].protocol}, ${allocations[2].protocol}) for stability\n3. ${riskProfile === 'conservative' ? 'Conservative allocation keeps 70%+ in top-tier protocols' : 'Allocate 20% to higher-yield opportunities for enhanced returns'}\n\nThis strategy projects a ${projectedApy.toFixed(2)}% weighted APY, generating approximately $${Math.round(portfolioSize * projectedApy / 100).toLocaleString()} annually.`,
      allocations,
      projectedApy: Math.round(projectedApy * 100) / 100,
    };
  }

  if (lowerMessage.includes('compare') || lowerMessage.includes('vs') || lowerMessage.includes('versus')) {
    return {
      recommendation: `Here's a comparison of the protocols you're interested in:\n\nLooking at the current data, the key differentiators are:\n\n1. APY: Rates vary significantly across chains. L2s often offer higher base rates due to lower competition.\n\n2. TVL & Liquidity: Higher TVL generally means better exit liquidity and lower smart contract risk.\n\n3. Risk Profile: Established protocols like Aave and Compound have longer track records and more audits, while newer protocols may offer yield premiums.\n\n4. Chain Risk: Each chain carries its own bridge and sequencer risks. Ethereum L1 is the safest but often has lower yields.\n\nI'd recommend checking the specific pools in the dashboard -- I've highlighted the top opportunities on the right panel.`,
      allocations: [],
      projectedApy: 0,
    };
  }

  if (lowerMessage.includes('risk') || lowerMessage.includes('safe')) {
    const allocations: Allocation[] = [
      { protocol: 'Aave', chain: 'Ethereum', pool: 'USDC Supply', symbol: 'USDC', amount: Math.round(portfolioSize * 0.40), percentage: 40, apy: 4.2 },
      { protocol: 'Compound', chain: 'Ethereum', pool: 'USDC Supply', symbol: 'USDC', amount: Math.round(portfolioSize * 0.30), percentage: 30, apy: 3.8 },
      { protocol: 'Aave', chain: 'Base', pool: 'USDC Supply', symbol: 'USDC', amount: Math.round(portfolioSize * 0.20), percentage: 20, apy: 5.1 },
      { protocol: 'Lido', chain: 'Ethereum', pool: 'stETH', symbol: 'stETH', amount: Math.round(portfolioSize * 0.10), percentage: 10, apy: 3.2 },
    ];
    const projectedApy = allocations.reduce((acc, a) => acc + (a.apy * a.percentage / 100), 0);

    return {
      recommendation: `For a safety-first approach, I recommend focusing on the most battle-tested protocols in DeFi.\n\nThis conservative allocation prioritizes:\n- Protocol safety: Aave and Compound are the most audited lending protocols in DeFi with $10B+ combined TVL\n- Chain safety: 70% on Ethereum mainnet, the most decentralized and secure chain\n- Asset safety: 90% in USDC, the most transparent stablecoin with regular attestations\n- Diversification: Small Lido stETH allocation for ETH staking yield without lockup\n\nRisks to monitor:\n- Stablecoin depegging (mitigated by USDC's track record)\n- Smart contract exploits (mitigated by protocol maturity)\n- Yield compression during low-demand periods`,
      allocations,
      projectedApy: Math.round(projectedApy * 100) / 100,
    };
  }

  // Default response
  return {
    recommendation: `Great question! Let me analyze the current DeFi yield landscape for you.\n\nRight now, I'm seeing strong opportunities across several protocols. The stablecoin yield market is ${topPools[0]?.apy > 5 ? 'quite active' : 'relatively stable'}, with the best rates around ${topPools[0]?.apy || 7}% APY.\n\nHere's what I'd suggest exploring:\n1. Check the top yield opportunities panel on the right for real-time rates\n2. Tell me your portfolio size and risk tolerance for a personalized allocation\n3. Ask me to compare specific protocols or chains\n\nI can help you build a diversified yield strategy across multiple chains and protocols. What's your primary goal -- maximizing yield, minimizing risk, or finding a balance?`,
    allocations: [],
    projectedApy: 0,
  };
}
