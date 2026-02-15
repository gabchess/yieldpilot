// Supported chains configuration
export const CHAINS = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    icon: '/chains/ethereum.svg',
    color: '#627EEA',
    rpcUrl: 'https://eth.llamarpc.com',
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum',
    icon: '/chains/arbitrum.svg',
    color: '#28A0F0',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
  },
  optimism: {
    id: 10,
    name: 'Optimism',
    icon: '/chains/optimism.svg',
    color: '#FF0420',
    rpcUrl: 'https://mainnet.optimism.io',
  },
  base: {
    id: 8453,
    name: 'Base',
    icon: '/chains/base.svg',
    color: '#0052FF',
    rpcUrl: 'https://mainnet.base.org',
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    icon: '/chains/polygon.svg',
    color: '#8247E5',
    rpcUrl: 'https://polygon-rpc.com',
  },
  avalanche: {
    id: 43114,
    name: 'Avalanche',
    icon: '/chains/avalanche.svg',
    color: '#E84142',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  },
} as const;

// Supported DeFi protocols
export const PROTOCOLS = {
  aave: {
    name: 'Aave',
    slug: 'aave-v3',
    category: 'Lending',
    color: '#B6509E',
    url: 'https://aave.com',
  },
  compound: {
    name: 'Compound',
    slug: 'compound-v3',
    category: 'Lending',
    color: '#00D395',
    url: 'https://compound.finance',
  },
  lido: {
    name: 'Lido',
    slug: 'lido',
    category: 'Liquid Staking',
    color: '#00A3FF',
    url: 'https://lido.fi',
  },
  morpho: {
    name: 'Morpho',
    slug: 'morpho-blue',
    category: 'Lending',
    color: '#5B72E4',
    url: 'https://morpho.org',
  },
  pendle: {
    name: 'Pendle',
    slug: 'pendle',
    category: 'Yield Trading',
    color: '#1FC7D4',
    url: 'https://pendle.finance',
  },
  yearn: {
    name: 'Yearn',
    slug: 'yearn-finance',
    category: 'Yield Aggregator',
    color: '#006AE3',
    url: 'https://yearn.fi',
  },
  convex: {
    name: 'Convex',
    slug: 'convex-finance',
    category: 'Yield Aggregator',
    color: '#3A82F7',
    url: 'https://www.convexfinance.com',
  },
  stargate: {
    name: 'Stargate',
    slug: 'stargate',
    category: 'Bridge/LP',
    color: '#FFFFFF',
    url: 'https://stargate.finance',
  },
} as const;

// Supported stablecoins for yield filtering
export const STABLECOINS = [
  'USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'GHO', 'crvUSD', 'USDD', 'TUSD',
] as const;

// Supported chains for DeFi Llama filtering
export const SUPPORTED_CHAIN_NAMES = [
  'Ethereum', 'Arbitrum', 'Optimism', 'Base', 'Polygon', 'Avalanche',
] as const;

// Risk profile definitions
export const RISK_PROFILES = {
  conservative: {
    label: 'Conservative',
    description: 'Blue-chip protocols only, stablecoin yields, minimal IL risk',
    maxProtocolRisk: 1,
    color: '#10b981',
  },
  moderate: {
    label: 'Moderate',
    description: 'Mix of established and newer protocols, some volatile assets',
    maxProtocolRisk: 2,
    color: '#f59e0b',
  },
  aggressive: {
    label: 'Aggressive',
    description: 'Higher yields, newer protocols, leveraged positions',
    maxProtocolRisk: 3,
    color: '#ef4444',
  },
} as const;

// Type definitions
export interface YieldPool {
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

export interface Allocation {
  protocol: string;
  chain: string;
  pool: string;
  symbol: string;
  amount: number;
  percentage: number;
  apy: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  allocations?: Allocation[];
  projectedApy?: number;
}

export interface PortfolioState {
  totalValue: number;
  allocations: Allocation[];
  projectedAnnualYield: number;
  activeStrategy: string | null;
  lastRebalance: Date | null;
}

// Mock portfolio for demo
export const MOCK_PORTFOLIO: PortfolioState = {
  totalValue: 50000,
  allocations: [
    {
      protocol: 'Aave',
      chain: 'Ethereum',
      pool: 'USDC Supply',
      symbol: 'USDC',
      amount: 20000,
      percentage: 40,
      apy: 4.2,
    },
    {
      protocol: 'Compound',
      chain: 'Base',
      pool: 'USDC Supply',
      symbol: 'USDC',
      amount: 12500,
      percentage: 25,
      apy: 5.1,
    },
    {
      protocol: 'Morpho',
      chain: 'Ethereum',
      pool: 'USDC Vault',
      symbol: 'USDC',
      amount: 10000,
      percentage: 20,
      apy: 6.8,
    },
    {
      protocol: 'Stargate',
      chain: 'Arbitrum',
      pool: 'USDC Pool',
      symbol: 'USDC',
      amount: 7500,
      percentage: 15,
      apy: 3.9,
    },
  ],
  projectedAnnualYield: 2520,
  activeStrategy: 'Conservative Stablecoin Yield',
  lastRebalance: new Date('2026-02-10'),
};
