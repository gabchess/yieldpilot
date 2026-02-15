import { NextResponse } from 'next/server';

const SUPPORTED_CHAINS = ['Ethereum', 'Arbitrum', 'Optimism', 'Base', 'Polygon', 'Avalanche'];
const STABLECOINS = ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'GHO', 'crvUSD'];

// Simple in-memory cache
let cachedData: { pools: Pool[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface LlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  poolMeta: string | null;
}

interface Pool {
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

function formatProjectName(slug: string): string {
  const nameMap: Record<string, string> = {
    'aave-v3': 'Aave',
    'aave-v2': 'Aave',
    'compound-v3': 'Compound',
    'compound-v2': 'Compound',
    'morpho-blue': 'Morpho',
    'morpho-aave': 'Morpho',
    'lido': 'Lido',
    'pendle': 'Pendle',
    'yearn-finance': 'Yearn',
    'convex-finance': 'Convex',
    'stargate': 'Stargate',
    'spark': 'Spark',
    'fluid': 'Fluid',
    'ethena': 'Ethena',
    'maker': 'Maker',
    'sky': 'Sky',
    'euler': 'Euler',
    'silo-v2': 'Silo',
    'radiant-v2': 'Radiant',
  };
  return nameMap[slug] || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function GET() {
  try {
    // Return cached data if still valid
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return NextResponse.json({
        pools: cachedData.pools,
        cached: true,
        timestamp: cachedData.timestamp,
      });
    }

    const response = await fetch('https://yields.llama.fi/pools', {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`DeFi Llama API error: ${response.status}`);
    }

    const data = await response.json();
    const allPools: LlamaPool[] = data.data;

    // Filter for stablecoin pools on supported chains with meaningful TVL
    const filteredPools: Pool[] = allPools
      .filter((pool) => {
        // Must be on a supported chain
        if (!SUPPORTED_CHAINS.includes(pool.chain)) return false;

        // Must have meaningful TVL (> $1M)
        if (pool.tvlUsd < 1_000_000) return false;

        // Must have positive APY
        if (!pool.apy || pool.apy <= 0 || pool.apy > 100) return false;

        // Must contain a stablecoin in the symbol
        const hasStablecoin = STABLECOINS.some(stable =>
          pool.symbol.toUpperCase().includes(stable)
        );
        if (!hasStablecoin) return false;

        return true;
      })
      .map((pool) => ({
        pool: pool.pool,
        chain: pool.chain,
        project: pool.project,
        protocol: formatProjectName(pool.project),
        symbol: pool.symbol,
        tvl: pool.tvlUsd,
        apy: Math.round(pool.apy * 100) / 100,
        apyBase: pool.apyBase,
        apyReward: pool.apyReward,
        stablecoin: pool.stablecoin,
      }))
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 50);

    // Update cache
    cachedData = { pools: filteredPools, timestamp: Date.now() };

    return NextResponse.json({
      pools: filteredPools,
      cached: false,
      timestamp: Date.now(),
      totalPoolsScanned: allPools.length,
      filteredCount: filteredPools.length,
    });
  } catch (error) {
    console.error('Error fetching yields:', error);

    // Return cached data if available, even if stale
    if (cachedData) {
      return NextResponse.json({
        pools: cachedData.pools,
        cached: true,
        stale: true,
        timestamp: cachedData.timestamp,
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch yield data' },
      { status: 500 }
    );
  }
}
