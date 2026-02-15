// ---------------------------------------------------------------------------
// YieldPilot -- CRE Workflow: AI-driven yield optimization
// ---------------------------------------------------------------------------
//
// This workflow exposes two triggers:
//   1. HTTP trigger  -- user-initiated optimization requests
//   2. Cron trigger  -- periodic rebalance checks (every 6 hours)
//
// The HTTP pipeline:
//   request --> fetchYields --> analyzeWithClaude --> writeOnChain --> response
//
// The Cron pipeline:
//   tick --> fetchYields --> evaluateDrift --> (optional) writeOnChain
// ---------------------------------------------------------------------------

import {
  CronCapability,
  HTTPCapability,
  handler,
  type Runtime,
  type HTTPPayload,
  decodeJson,
} from "@chainlink/cre-sdk";

import type {
  YieldPilotConfig,
  OptimizeRequest,
  YieldData,
  DefiLlamaPool,
  AllocationRecommendation,
  AllocationEntry,
  OnChainRecommendation,
  WriteResult,
  RebalanceCheck,
  UserProfile,
  ChainId,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_CHAINS: Record<string, ChainId> = {
  Ethereum: "ethereum",
  Arbitrum: "arbitrum",
  Optimism: "optimism",
  Polygon: "polygon",
  Base: "base",
  Avalanche: "avalanche",
};

const DEFI_LLAMA_POOLS_PATH = "/pools";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const CLAUDE_MAX_TOKENS = 4096;

// ABI fragment for the on-chain registry's `storeRecommendation` function.
const REGISTRY_ABI_STORE =
  "function storeRecommendation(address wallet, bytes32 recommendationId, uint256 blendedApyBps, bytes32 allocationsHash, uint256 timestamp)";

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Compute a simple deterministic hex ID from a string (stand-in for keccak256). */
function computeId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return "0x" + Math.abs(hash).toString(16).padStart(64, "0");
}

/** Convert an APY percentage to basis points. */
function apyToBps(apyPct: number): number {
  return Math.round(apyPct * 100);
}

/** Return the current ISO-8601 timestamp. */
function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Step 1 -- Fetch yields from DeFi Llama
// ---------------------------------------------------------------------------

async function fetchYields(
  runtime: Runtime<YieldPilotConfig>,
  profile: UserProfile
): Promise<YieldData[]> {
  const baseUrl = runtime.config.defiLlamaBaseUrl;
  const url = `${baseUrl}${DEFI_LLAMA_POOLS_PATH}`;

  runtime.logger.info(`Fetching yield pools from ${url}`);

  const response = runtime.http.fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const body = decodeJson<{ status: string; data: DefiLlamaPool[] }>(
    await response
  );

  if (!body.data || !Array.isArray(body.data)) {
    throw new Error("DeFi Llama returned an unexpected payload shape");
  }

  // Determine which chains to consider.
  const allowedChains: Set<string> =
    profile.preferredChains.length > 0
      ? new Set(profile.preferredChains)
      : new Set(Object.values(SUPPORTED_CHAINS));

  // Filter and normalise pools.
  const pools: YieldData[] = body.data
    .filter((p) => {
      // Must be a stablecoin pool matching the user's token.
      if (!p.stablecoin) return false;
      if (!p.symbol.toUpperCase().includes(profile.token)) return false;

      // Chain must be supported and within user preferences.
      const normalizedChain = SUPPORTED_CHAINS[p.chain];
      if (!normalizedChain || !allowedChains.has(normalizedChain)) return false;

      // Must meet minimum TVL threshold.
      if (p.tvlUsd < profile.minTvlUsd) return false;

      // Must have a positive total APY.
      if (p.apy <= 0) return false;

      return true;
    })
    .map((p) => ({
      protocol: p.project,
      chain: SUPPORTED_CHAINS[p.chain] as ChainId,
      pool: p.pool,
      symbol: p.symbol,
      tvlUsd: p.tvlUsd,
      apyBase: p.apyBase ?? 0,
      apyReward: p.apyReward ?? 0,
      apyTotal: p.apy,
      apyChange7D: p.apyPct7D,
      apyChange30D: p.apyPct30D,
      ilRisk: p.ilRisk,
      audited: p.audit_links !== null && p.audit_links.length > 0,
    }))
    // Sort by total APY descending, take top 50 to keep the AI context lean.
    .sort((a, b) => b.apyTotal - a.apyTotal)
    .slice(0, 50);

  runtime.logger.info(
    `Filtered ${pools.length} eligible pools for ${profile.token} across ${allowedChains.size} chain(s)`
  );

  return pools;
}

// ---------------------------------------------------------------------------
// Step 2 -- Call Claude (Anthropic) for AI-driven analysis
// ---------------------------------------------------------------------------

function buildAnalysisPrompt(
  profile: UserProfile,
  yields: YieldData[],
  additionalInstructions?: string
): string {
  const poolSummaries = yields
    .map(
      (y, i) =>
        `${i + 1}. ${y.protocol} (${y.chain}) -- pool: ${y.symbol}, ` +
        `APY: ${y.apyTotal.toFixed(2)}% (base ${y.apyBase.toFixed(2)}% + reward ${y.apyReward.toFixed(2)}%), ` +
        `TVL: $${(y.tvlUsd / 1e6).toFixed(1)}M, ` +
        `7d trend: ${y.apyChange7D !== null ? y.apyChange7D.toFixed(2) + "%" : "n/a"}, ` +
        `IL risk: ${y.ilRisk}, audited: ${y.audited ? "yes" : "no"}`
    )
    .join("\n");

  return `You are an expert DeFi yield strategist. A user needs you to allocate their stablecoin capital across DeFi protocols to maximize risk-adjusted yield.

USER PROFILE:
- Wallet: ${profile.walletAddress}
- Capital: $${profile.capitalUsd.toLocaleString()} in ${profile.token}
- Risk tolerance: ${profile.riskTolerance}
- Max protocols: ${profile.maxProtocols}
- Min pool TVL: $${(profile.minTvlUsd / 1e6).toFixed(1)}M
- Preferred chains: ${profile.preferredChains.length > 0 ? profile.preferredChains.join(", ") : "all supported"}

AVAILABLE POOLS (sorted by APY descending):
${poolSummaries}

${additionalInstructions ? `ADDITIONAL INSTRUCTIONS: ${additionalInstructions}\n` : ""}
TASK:
1. Select up to ${profile.maxProtocols} pools that best match the user's risk tolerance.
2. For conservative: favour audited protocols, high TVL, stable base APY. Avoid reward-only APY.
3. For moderate: balance yield and safety. Allow some reward APY if the protocol is reputable.
4. For aggressive: maximise total APY, allow smaller TVL pools, accept higher IL risk.
5. Allocate percentages that sum to 100%. Provide a short rationale for each allocation.
6. List any risk warnings.

Respond ONLY with valid JSON matching this exact schema (no markdown, no commentary):
{
  "allocations": [
    {
      "protocol": "<string>",
      "chain": "<string>",
      "pool": "<string>",
      "allocationPct": <number 0-100>,
      "expectedApyPct": <number>,
      "rationale": "<string>"
    }
  ],
  "summary": "<string>",
  "riskWarnings": ["<string>"]
}`;
}

async function analyzeWithClaude(
  runtime: Runtime<YieldPilotConfig>,
  profile: UserProfile,
  yields: YieldData[],
  additionalInstructions?: string
): Promise<AllocationRecommendation> {
  const prompt = buildAnalysisPrompt(profile, yields, additionalInstructions);

  const apiUrl = `${runtime.config.anthropicApiBaseUrl}/v1/messages`;

  runtime.logger.info(
    `Requesting AI analysis from ${apiUrl} using model ${CLAUDE_MODEL}`
  );

  const response = runtime.http.fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": runtime.config.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const anthropicBody = decodeJson<{
    content: Array<{ type: string; text: string }>;
  }>(await response);

  const textBlock = anthropicBody.content.find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error("Anthropic response contained no text block");
  }

  const aiResult = JSON.parse(textBlock.text) as {
    allocations: Array<{
      protocol: string;
      chain: string;
      pool: string;
      allocationPct: number;
      expectedApyPct: number;
      rationale: string;
    }>;
    summary: string;
    riskWarnings: string[];
  };

  // Build the typed recommendation.
  const timestamp = now();
  const recommendationId = computeId(
    `${profile.walletAddress}-${timestamp}-${JSON.stringify(aiResult.allocations)}`
  );

  const allocations: AllocationEntry[] = aiResult.allocations.map((a) => ({
    protocol: a.protocol,
    chain: a.chain as ChainId,
    pool: a.pool,
    allocationPct: a.allocationPct,
    allocationUsd: (a.allocationPct / 100) * profile.capitalUsd,
    expectedApyPct: a.expectedApyPct,
    rationale: a.rationale,
  }));

  const blendedApyPct = allocations.reduce(
    (acc, a) => acc + (a.allocationPct / 100) * a.expectedApyPct,
    0
  );

  const recommendation: AllocationRecommendation = {
    id: recommendationId,
    timestamp,
    walletAddress: profile.walletAddress,
    blendedApyPct,
    estimatedAnnualYieldUsd: (blendedApyPct / 100) * profile.capitalUsd,
    allocations,
    summary: aiResult.summary,
    riskWarnings: aiResult.riskWarnings,
  };

  runtime.logger.info(
    `AI recommendation ${recommendationId}: blended APY ${blendedApyPct.toFixed(2)}%, ` +
      `est. annual yield $${recommendation.estimatedAnnualYieldUsd.toFixed(0)}`
  );

  return recommendation;
}

// ---------------------------------------------------------------------------
// Step 3 -- Write recommendation on-chain
// ---------------------------------------------------------------------------

async function writeOnChain(
  runtime: Runtime<YieldPilotConfig>,
  recommendation: AllocationRecommendation
): Promise<WriteResult> {
  const contractAddress = runtime.config.registryContractAddress;

  const allocationsHash = computeId(
    JSON.stringify(recommendation.allocations)
  );

  const payload: OnChainRecommendation = {
    walletAddress: recommendation.walletAddress,
    recommendationId: recommendation.id,
    blendedApyBps: apyToBps(recommendation.blendedApyPct),
    allocationsHash,
    timestamp: Math.floor(Date.now() / 1000),
  };

  runtime.logger.info(
    `Writing recommendation ${payload.recommendationId} to registry at ${contractAddress}`
  );

  // Use EVM write capability via the runtime's contract interaction interface.
  const txResponse = runtime.evm.write({
    contractAddress,
    abi: REGISTRY_ABI_STORE,
    functionName: "storeRecommendation",
    args: [
      payload.walletAddress,
      payload.recommendationId,
      payload.blendedApyBps,
      payload.allocationsHash,
      payload.timestamp,
    ],
    rpcUrl: runtime.config.rpcUrl,
    privateKey: runtime.config.signerPrivateKey,
  });

  const txResult = await txResponse;

  const result: WriteResult = {
    success: true,
    transactionHash: txResult.transactionHash,
    blockNumber: txResult.blockNumber,
    gasUsed: txResult.gasUsed,
  };

  runtime.logger.info(
    `On-chain write confirmed: tx ${result.transactionHash} in block ${result.blockNumber}`
  );

  return result;
}

// ---------------------------------------------------------------------------
// HTTP trigger callback -- full optimization pipeline
// ---------------------------------------------------------------------------

const onHttpTrigger = async (
  runtime: Runtime<YieldPilotConfig>,
  payload: HTTPPayload
): Promise<string> => {
  runtime.logger.info("HTTP trigger received -- starting yield optimization");

  // 1. Parse the incoming request.
  const request = decodeJson<OptimizeRequest>(payload.body);

  const profile = request.userProfile;

  // Validate basic fields.
  if (!profile.walletAddress || !profile.capitalUsd || !profile.token) {
    throw new Error(
      "Invalid request: walletAddress, capitalUsd, and token are required"
    );
  }

  // Apply sensible defaults.
  profile.riskTolerance = profile.riskTolerance ?? "moderate";
  profile.maxProtocols = profile.maxProtocols ?? 5;
  profile.minTvlUsd = profile.minTvlUsd ?? 1_000_000;
  profile.preferredChains = profile.preferredChains ?? [];

  runtime.logger.info(
    `Optimizing $${profile.capitalUsd.toLocaleString()} ${profile.token} ` +
      `for ${profile.walletAddress} (risk: ${profile.riskTolerance})`
  );

  // 2. Fetch current yields from DeFi Llama.
  const yields: YieldData[] = await fetchYields(runtime, profile);

  if (yields.length === 0) {
    return JSON.stringify({
      success: false,
      error: "No eligible yield pools found matching your criteria",
    });
  }

  // 3. Run AI analysis with Claude.
  const recommendation: AllocationRecommendation = await analyzeWithClaude(
    runtime,
    profile,
    yields,
    request.additionalInstructions
  );

  // 4. Write the recommendation on-chain.
  const writeResult: WriteResult = await writeOnChain(runtime, recommendation);

  // 5. Return the full result to the caller.
  return JSON.stringify({
    success: true,
    recommendation,
    onChain: {
      transactionHash: writeResult.transactionHash,
      blockNumber: writeResult.blockNumber,
    },
  });
};

// ---------------------------------------------------------------------------
// Cron trigger callback -- periodic rebalance check
// ---------------------------------------------------------------------------

const onCronTrigger = async (
  runtime: Runtime<YieldPilotConfig>
): Promise<string> => {
  runtime.logger.info("Cron trigger fired -- starting rebalance check");

  // In a production system this would read active user positions from the
  // on-chain registry. For this workflow we demonstrate the pattern with a
  // placeholder read from the registry contract.

  const activeWallets: string[] = await fetchActiveWallets(runtime);

  const results: RebalanceCheck[] = [];

  for (const walletAddress of activeWallets) {
    try {
      const check = await evaluateRebalance(runtime, walletAddress);
      results.push(check);

      if (check.shouldRebalance && check.newRecommendationId) {
        runtime.logger.info(
          `Rebalance triggered for ${walletAddress}: drift ${check.driftPct.toFixed(2)}% -- ${check.reason}`
        );
      }
    } catch (err) {
      runtime.logger.error(
        `Rebalance check failed for ${walletAddress}: ${String(err)}`
      );
    }
  }

  const rebalanced = results.filter((r) => r.shouldRebalance).length;
  runtime.logger.info(
    `Rebalance check complete: ${rebalanced}/${results.length} wallets flagged for rebalance`
  );

  return JSON.stringify({
    checkedAt: now(),
    totalWallets: results.length,
    rebalancesTriggered: rebalanced,
    details: results,
  });
};

// ---------------------------------------------------------------------------
// Cron helpers
// ---------------------------------------------------------------------------

async function fetchActiveWallets(
  runtime: Runtime<YieldPilotConfig>
): Promise<string[]> {
  // Read the list of active wallets from the on-chain registry via an EVM read.
  const contractAddress = runtime.config.registryContractAddress;

  const result = runtime.evm.read({
    contractAddress,
    abi: "function getActiveWallets() view returns (address[])",
    functionName: "getActiveWallets",
    args: [],
    rpcUrl: runtime.config.rpcUrl,
  });

  const wallets = (await result) as string[];
  runtime.logger.info(
    `Fetched ${wallets.length} active wallet(s) from registry`
  );
  return wallets;
}

async function evaluateRebalance(
  runtime: Runtime<YieldPilotConfig>,
  walletAddress: string
): Promise<RebalanceCheck> {
  const contractAddress = runtime.config.registryContractAddress;

  // Read the current on-chain recommendation for this wallet.
  const stored = runtime.evm.read({
    contractAddress,
    abi: "function getRecommendation(address wallet) view returns (bytes32 recommendationId, uint256 blendedApyBps, uint256 timestamp)",
    functionName: "getRecommendation",
    args: [walletAddress],
    rpcUrl: runtime.config.rpcUrl,
  });

  const onChain = (await stored) as {
    recommendationId: string;
    blendedApyBps: number;
    timestamp: number;
  };

  // Build a minimal profile for re-evaluation. In production this would be
  // loaded from user profile storage; here we use conservative defaults.
  const profile: UserProfile = {
    walletAddress,
    capitalUsd: 10_000,
    token: "USDC",
    riskTolerance: "moderate",
    maxProtocols: 5,
    minTvlUsd: 1_000_000,
    preferredChains: [],
  };

  // Fetch fresh yields.
  const yields = await fetchYields(runtime, profile);

  if (yields.length === 0) {
    return {
      walletAddress,
      currentRecommendationId: onChain.recommendationId,
      newRecommendationId: null,
      driftPct: 0,
      shouldRebalance: false,
      reason: "No eligible pools found; keeping current allocation",
    };
  }

  // Get a fresh recommendation from the AI.
  const newRec = await analyzeWithClaude(runtime, profile, yields);

  // Compute drift as the absolute difference in blended APY.
  const currentApyPct = onChain.blendedApyBps / 100;
  const driftPct = Math.abs(newRec.blendedApyPct - currentApyPct);
  const driftBps = apyToBps(driftPct);

  const shouldRebalance =
    driftBps >= runtime.config.rebalanceDriftThresholdBps;

  let reason: string;
  if (shouldRebalance) {
    reason =
      `Blended APY drifted ${driftPct.toFixed(2)}% ` +
      `(${currentApyPct.toFixed(2)}% -> ${newRec.blendedApyPct.toFixed(2)}%), ` +
      `exceeding threshold of ${runtime.config.rebalanceDriftThresholdBps} bps`;

    // Write the new recommendation on-chain.
    await writeOnChain(runtime, newRec);
  } else {
    reason =
      `Drift of ${driftPct.toFixed(2)}% is within threshold ` +
      `(${runtime.config.rebalanceDriftThresholdBps} bps); no action needed`;
  }

  return {
    walletAddress,
    currentRecommendationId: onChain.recommendationId,
    newRecommendationId: shouldRebalance ? newRec.id : null,
    driftPct,
    shouldRebalance,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Workflow initialisation -- exported for Runner
// ---------------------------------------------------------------------------

export function initWorkflow(config: YieldPilotConfig) {
  const http = new HTTPCapability();
  const cron = new CronCapability();

  return [
    // HTTP trigger -- on-demand optimization requests from users.
    handler(
      http.trigger({
        authorizedKeys: [
          {
            type: "KEY_TYPE_ECDSA_EVM",
            publicKey: config.publicKey,
          },
        ],
      }),
      onHttpTrigger
    ),

    // Cron trigger -- periodic rebalance checks (default: every 6 hours).
    handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
  ];
}
