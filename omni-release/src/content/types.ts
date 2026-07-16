/**
 * Content-layer types for omni-release (t3).
 *
 * The cross-pipeline contracts live elsewhere and are imported, not redeclared:
 *  - `Platform`, `LaneId`, `Caption`, `CaptionSet`, `PlatformLimits` → core (t1)
 *  - `ResearchResult`, `ResearchItem` → research engine (t2)
 *
 * This file declares only the types that are *internal* to the writing layer:
 * lane prompt definitions and the pre-format caption draft.
 */

import type { LaneId, Platform } from "../core/index.js";
import type { ResearchResult } from "../research/index.js";

/** Input passed to a lane's `buildUserPrompt`. */
export interface LanePromptInput {
  research: ResearchResult;
  platform: Platform;
  /** Full text of voice-rules.md, injected into the writer prompt. */
  voiceRules: string;
  /** Human-readable hashtag guidance for the platform. */
  hashtagGuidance: string;
}

/** A lane definition: format, tone, targets, and prompt builders. */
export interface LanePrompt {
  lane: LaneId;
  title: string;
  description: string;
  /** Platforms this lane targets by default. */
  platforms: Platform[];
  tone: string;
  /** Ordered structural beats the caption should hit. */
  structure: string[];
  /** Whether this lane expects an accompanying proof image (t4). */
  wantsProofImage: boolean;
  /** Max research items to weave into one post. */
  maxItems: number;
  /** Default call-to-action for the lane (writer may rotate from the bank). */
  cta: string;
  /** System prompt for an LLM writer. */
  system: string;
  /** Builds the user prompt for an LLM given research + voice. */
  buildUserPrompt: (input: LanePromptInput) => string;
}

/**
 * A written caption before platform formatting/clamping. Internal to the writing
 * layer — `formatForPlatform` turns this into a core `Caption`.
 */
export interface CaptionDraft {
  lane: LaneId;
  platform: Platform;
  /** Hook / first line. */
  hook: string;
  /** Body text (may include source URL + CTA), pre-clamp. */
  body: string;
  /** Suggested hashtags (no platform cap applied yet), each starting with `#`. */
  hashtags: string[];
  /** Ids of the research items this draft drew from (→ Caption.citedItemIds). */
  citedItemIds: string[];
  /** True if a proof image should accompany this post. */
  wantsProofImage: boolean;
  /** The CTA used (tracked so the post log can rotate it). */
  cta: string;
}

/**
 * Optional async text-completion function. When supplied to `writeCaptions`, the
 * writer calls an LLM with the lane prompt; otherwise a deterministic template
 * composer is used (keeps the pipeline runnable + testable without an LLM key).
 */
export type CompleteFn = (args: {
  system: string;
  prompt: string;
}) => Promise<string>;
