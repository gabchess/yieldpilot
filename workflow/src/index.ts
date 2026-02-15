// ---------------------------------------------------------------------------
// YieldPilot -- CRE Workflow Entry Point
// ---------------------------------------------------------------------------
//
// This module bootstraps the Chainlink Runtime Environment runner and
// registers the YieldPilot workflow handlers (HTTP + Cron triggers).
//
// Run with:
//   npx ts-node src/index.ts
//
// Or after building:
//   node dist/index.js
// ---------------------------------------------------------------------------

import { Runner } from "@chainlink/cre-sdk";
import { initWorkflow } from "./yield-optimizer";
import type { YieldPilotConfig } from "./types";

// Re-export types and workflow initialiser for consumers that import this
// package as a library (e.g. test harnesses, composing workflows).
export { initWorkflow } from "./yield-optimizer";
export type {
  YieldPilotConfig,
  OptimizeRequest,
  UserProfile,
  YieldData,
  AllocationRecommendation,
  AllocationEntry,
  OnChainRecommendation,
  WriteResult,
  RebalanceCheck,
} from "./types";

// ---------------------------------------------------------------------------
// Main -- start the CRE runner
// ---------------------------------------------------------------------------

export async function main(): Promise<void> {
  console.log("YieldPilot CRE Workflow starting...");
  console.log("Registering HTTP trigger (on-demand optimization)");
  console.log("Registering Cron trigger (periodic rebalance check)");

  const runner = await Runner.newRunner<YieldPilotConfig>();
  await runner.run(initWorkflow);
}

// Auto-start when executed directly (not imported as a module).
const isDirectExecution =
  typeof require !== "undefined" && require.main === module;

if (isDirectExecution) {
  main().catch((err) => {
    console.error("YieldPilot workflow failed:", err);
    process.exit(1);
  });
}
