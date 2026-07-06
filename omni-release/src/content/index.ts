/**
 * Content layer (t3) — public surface.
 *
 * The writing + formatting half of omni-release: lane definitions, the caption
 * writer, per-platform formatting, and the rule-file loaders. Cross-pipeline
 * types (`Caption`, `CaptionSet`, `Platform`) come from core; this layer only
 * adds the writing-internal types.
 */

export type { LanePrompt, LanePromptInput, CaptionDraft, CompleteFn } from "./types.js";
export {
  LANE_PROMPTS,
  listLanes,
  getLanePrompt,
  tryGetLanePrompt,
} from "./lanePrompts.js";
export { writeCaptions, writeDrafts, type WriteCaptionsOptions } from "./writeCaptions.js";
export {
  formatForPlatform,
  formatAll,
  capHashtags,
  PLATFORM_LIMITS,
  type FormatOptions,
} from "./platformFormatting.js";
export {
  loadVoiceRules,
  loadHashtagRules,
  loadAllRules,
  hashtagGuidanceFor,
  sectionLines,
  bullets,
  PROJECT_ROOT,
  DEFAULT_CONFIG_DIR,
  type VoiceRules,
  type HashtagRules,
  type PlatformHashtagRule,
  type RequiredElement,
} from "./rules.js";
