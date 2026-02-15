// ---------------------------------------------------------------------------
// YieldPilot -- shared type definitions
// ---------------------------------------------------------------------------

/** Token symbols supported by the optimizer. */
export type StableToken = "USDC" | "USDT" | "DAI" | "FRAX" | "LUSD";

/** Chain identifiers for supported EVM networks. */
export type ChainId =
  | "ethereum"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "base"
  | "avalanche";

// ---------------------------------------------------------------------------
// DeFi Llama API response types
// ---------------------------------------------------------------------------

/** A single pool entry returned by the DeFi Llama /pools endpoint. */
export interface DefiLlamaPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  rewardTokens: string[] | null;
  pool: string;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  poolMeta: string | null;
  underlyingTokens: string[] | null;
  audits: string | null;
  audit_links: string[] | null;
}

/** Cleaned yield data used internally after filtering DeFi Llama results. */
export interface YieldData {
  protocol: string;
  chain: ChainId;
  pool: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number;
  apyTotal: number;
  apyChange7D: number | null;
  apyChange30D: number | null;
  ilRisk: string;
  audited: boolean;
}

// ---------------------------------------------------------------------------
// User profile & request types
// ---------------------------------------------------------------------------

/** Risk appetite expressed by the user. */
export type RiskTolerance = "conservative" | "moderate" | "aggressive";

/** A user profile describing their preferences and constraints. */
export interface UserProfile {
  /** Ethereum address of the user (EVM, checksummed). */
  walletAddress: string;
  /** Amount of capital in USD to optimize. */
  capitalUsd: number;
  /** Token the user holds. */
  token: StableToken;
  /** Acceptable risk level. */
  riskTolerance: RiskTolerance;
  /** Maximum number of protocols to split across (limits gas costs). */
  maxProtocols: number;
  /** Minimum pool TVL (USD) to consider -- filters out risky small pools. */
  minTvlUsd: number;
  /** Chains the user is willing to deploy on. Empty means all supported. */
  preferredChains: ChainId[];
}

/** Incoming HTTP request body from a user. */
export interface OptimizeRequest {
  userProfile: UserProfile;
  /** Optional free-text instructions, e.g. "avoid Curve pools". */
  additionalInstructions?: string;
}

// ---------------------------------------------------------------------------
// AI analysis types
// ---------------------------------------------------------------------------

/** A single allocation recommended by the AI model. */
export interface AllocationEntry {
  protocol: string;
  chain: ChainId;
  pool: string;
  allocationPct: number;
  allocationUsd: number;
  expectedApyPct: number;
  rationale: string;
}

/** Full recommendation produced by the AI analysis step. */
export interface AllocationRecommendation {
  /** Unique identifier for this recommendation (keccak256 hash). */
  id: string;
  /** ISO-8601 timestamp of when the recommendation was generated. */
  timestamp: string;
  /** The user wallet this recommendation is for. */
  walletAddress: string;
  /** Weighted-average expected APY across the portfolio. */
  blendedApyPct: number;
  /** Estimated annual yield in USD. */
  estimatedAnnualYieldUsd: number;
  /** Individual allocations. */
  allocations: AllocationEntry[];
  /** Short narrative summary from the AI. */
  summary: string;
  /** Risk warnings surfaced by the AI. */
  riskWarnings: string[];
}

// ---------------------------------------------------------------------------
// On-chain result types
// ---------------------------------------------------------------------------

/** Payload written on-chain to the YieldPilot recommendation registry. */
export interface OnChainRecommendation {
  walletAddress: string;
  recommendationId: string;
  blendedApyBps: number;
  allocationsHash: string;
  timestamp: number;
}

/** Result returned after the EVM write transaction is confirmed. */
export interface WriteResult {
  success: boolean;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
}

// ---------------------------------------------------------------------------
// Rebalancing types (cron-triggered)
// ---------------------------------------------------------------------------

/** Summary produced during a periodic rebalance check. */
export interface RebalanceCheck {
  walletAddress: string;
  currentRecommendationId: string;
  newRecommendationId: string | null;
  driftPct: number;
  shouldRebalance: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Workflow configuration
// ---------------------------------------------------------------------------

/** Configuration injected into the CRE runtime. */
export interface YieldPilotConfig {
  /** Cron schedule for periodic rebalancing (e.g. "0 */6 * * *"). */
  schedule: string;
  /** ECDSA public key authorised to invoke the HTTP trigger. */
  publicKey: string;
  /** DeFi Llama base URL. */
  defiLlamaBaseUrl: string;
  /** Anthropic API base URL. */
  anthropicApiBaseUrl: string;
  /** Anthropic API key (provided as a CRE secret). */
  anthropicApiKey: string;
  /** On-chain registry contract address. */
  registryContractAddress: string;
  /** RPC URL for the target settlement chain. */
  rpcUrl: string;
  /** Private key for signing on-chain transactions (CRE secret). */
  signerPrivateKey: string;
  /** Drift threshold (basis points) that triggers a rebalance. */
  rebalanceDriftThresholdBps: number;
}
