/**
 * Quality-layer types for omni-release (t3).
 *
 * The authoritative shapes for fact-check and quality-gate results live in core
 * (`src/core/types.ts`) so the orchestrator (t6) and tests share one contract.
 * They are re-exported here for ergonomic imports from the quality layer.
 */

export type {
  ClaimVerdict,
  CheckedClaim,
  FactCheckResult,
  QualitySeverity,
  QualityIssue,
  QualityGateResult,
} from "../core/index.js";
