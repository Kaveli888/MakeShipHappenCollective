/**
 * Quality layer (t3) — public surface.
 *
 * Fact-checking and the editorial quality gate, plus the blocked-phrase loader.
 */

export * from "./types.js";
export {
  factCheck,
  type FactCheckOptions,
} from "./factCheck.js";
export {
  runQualityGate,
  type QualityGateContext,
  type DuplicateSignal,
} from "./qualityGate.js";
export {
  loadBlockedRules,
  findBlocked,
  type BlockedRules,
} from "./blockedPhrases.js";
