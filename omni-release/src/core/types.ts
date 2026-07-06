/**
 * omni-release — shared type contracts.
 *
 * This file is the single source of truth for the interfaces that flow between
 * every stage of the pipeline. Each peer terminal (t2..t6) imports from here so
 * the modules compose without guesswork.
 *
 * Pipeline data flow (one lane run):
 *
 *   ResearchResult  (t2 research)
 *        |  consumed by
 *        v
 *   CaptionSet      (t3 writing)         --> FactCheckResult (t3) --> QualityGateResult (t3)
 *        |
 *        v
 *   ProofImage      (t4 proof images)
 *        |
 *        v
 *   QueueItem / PublishResult  (t5 publishing)
 *        |
 *        v
 *   LaneRunResult   (t6 orchestrator)
 *
 * NOTE (ESM / NodeNext): relative imports in this project MUST use the `.js`
 * extension, e.g. `import { Logger } from "./logger.js"`. See HANDOFF.md.
 *
 * ─── OWNERSHIP MAP ────────────────────────────────────────────────────────
 * core (t1) is the AUTHORITATIVE home for the cross-cutting "glue":
 *   Platform, LaneId, LaneConfig, SourceCategory, PlatformLimits, Caption,
 *   CaptionSet, PublishMode, QueueItem, Publisher, PublishResult, StageResult,
 *   RunOptions, LaneRunContext, LaneRunResult, RunAllResult.
 * Every module imports THESE from "../core/index.js".
 *
 * The producer modules own their domain PAYLOAD shapes. The definitions below
 * for those payloads are an ALIGNED REFERENCE (so core + the orchestrator type
 * standalone, and the integration test's mocks have a shape to satisfy). At
 * integration the AUTHORITATIVE version lives in the producer module and t6
 * adapts at the boundary:
 *   ResearchResult / ResearchItem / SourceHealth   → owned by t2 (src/research)
 *   FactCheckResult / QualityGateResult / *Log / Duplicate* → owned by t3 (src/content)
 *   ProofImage / ProofMetadata / ProofTemplateInput → owned by t4 (src/proof)
 * See HANDOFF.md "Reconciliation" for the field-by-field adapter notes.
 * ──────────────────────────────────────────────────────────────────────────
 */

import type { Logger } from "./logger.js";

/* ------------------------------------------------------------------ */
/* Platforms & lanes                                                   */
/* ------------------------------------------------------------------ */

/** Social platforms the pipeline can target. `browser` = manual/assisted paste. */
export type Platform = "x" | "linkedin" | "facebook" | "browser";

export const ALL_PLATFORMS: readonly Platform[] = ["x", "linkedin", "facebook", "browser"] as const;

/**
 * A content "lane" is a recurring, themed slot in the release schedule.
 * The dry-run / integration target is the `evening-battle-card` lane.
 */
export type LaneId = string;

export interface LaneConfig {
  /** Stable identifier, e.g. "evening-battle-card". */
  id: LaneId;
  /** Human label, e.g. "Evening Battle Card". */
  name: string;
  /** One-line description of the lane's editorial intent. */
  description: string;
  /** Platforms this lane publishes to. */
  platforms: Platform[];
  /** Source categories this lane draws research from (see SourceCategory). */
  sourceCategories: SourceCategory[];
  /** Whether this lane produces a proof image. */
  proofImage: boolean;
  /** Optional cadence hint, e.g. "daily 18:00". Informational only. */
  cadence?: string;
  /** Free-form tags used by writing/quality layers. */
  tags?: string[];
  /** Keywords used by the research layer to score + (optionally) filter items. */
  keywords?: string[];
  /** Whether the lane is currently active in scheduled runs. */
  enabled: boolean;
}

/* ------------------------------------------------------------------ */
/* Research (t2)                                                       */
/* ------------------------------------------------------------------ */

/**
 * High-level grouping for a source. Lanes select sources by category.
 *
 * CANONICAL TAXONOMY — aligned with the research engine (t2, src/research),
 * which owns source classification. Keep these identical to
 * `src/research/types.ts#SourceCategory` so LaneConfig.sourceCategories selects
 * real sources.
 */
export type SourceCategory =
  | "lab-blog"     // Official AI lab / company announcement + engineering blogs
  | "research"     // Papers / preprints (arXiv, Papers with Code)
  | "aggregator"   // Community surfaces (Hacker News, Reddit)
  | "newsletter"   // Curated AI newsletters
  | "news"         // Tech press AI desks
  | "product"      // Launches / changelogs / trending repos
  | "social";      // X lists, threads — usually browser-gated

export type SourceKind = "rss" | "atom" | "json" | "html" | "api";

export interface SourceDefinition {
  /** Stable id, e.g. "anthropic-news". */
  id: string;
  /** Display name. */
  name: string;
  /** Fetch URL / endpoint. */
  url: string;
  kind: SourceKind;
  category: SourceCategory;
  /** Higher weight = more trusted / higher priority in ranking. 0..1. */
  weight: number;
  /** Whether the source is currently enabled for fetching. */
  enabled: boolean;
}

/** A single normalized item retrieved from a source. */
export interface ResearchItem {
  id: string;
  title: string;
  url: string;
  /** Short normalized summary / excerpt. */
  summary: string;
  sourceId: string;
  sourceName: string;
  category: SourceCategory;
  /** ISO-8601 publish timestamp if known. */
  publishedAt?: string;
  /** Author / byline if known. */
  author?: string;
  /** 0..1 relevance score assigned by the research lane. */
  relevance: number;
  /** Extracted keywords / entities. */
  keywords?: string[];
  /** Raw payload for downstream stages (kept opaque on purpose). */
  raw?: unknown;
}

/**
 * The structured output of a research run. Every research entry point
 * (fetchSources / researchLane) returns this shape.
 */
export interface ResearchResult {
  laneId: LaneId;
  /** ISO timestamp the research run completed. */
  fetchedAt: string;
  /** Ranked items, highest relevance first. */
  items: ResearchItem[];
  /** Ids of sources that were queried. */
  sourcesQueried: string[];
  /** Per-source health captured during this run. */
  health: SourceHealth[];
  /** Non-fatal warnings (e.g. a source timed out). */
  warnings: string[];
}

export type SourceStatus = "ok" | "degraded" | "down" | "skipped";

export interface SourceHealth {
  sourceId: string;
  status: SourceStatus;
  /** Number of items returned on the most recent fetch. */
  itemCount: number;
  /** Round-trip latency in ms, if measured. */
  latencyMs?: number;
  /** ISO timestamp of last successful fetch. */
  lastOkAt?: string;
  /** Error message if status is down/degraded. */
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Writing (t3)                                                        */
/* ------------------------------------------------------------------ */

/** Per-platform character / format limits used by writing & quality layers. */
export interface PlatformLimits {
  platform: Platform;
  maxChars: number;
  maxHashtags: number;
  /** Whether the platform supports/expects an attached image. */
  supportsImage: boolean;
  /** Recommended hashtag count (<= maxHashtags). */
  recommendedHashtags: number;
}

/** A finished caption for a single platform. */
export interface Caption {
  platform: Platform;
  /** The post body, ready to publish (already platform-formatted). */
  body: string;
  hashtags: string[];
  /** Optional alt text for the attached proof image. */
  imageAltText?: string;
  /** Character count of `body` (excluding image). */
  charCount: number;
  /** Source items this caption is grounded in (ResearchItem ids). */
  citedItemIds: string[];
}

/** The full set of captions produced for one lane run, keyed by platform. */
export interface CaptionSet {
  laneId: LaneId;
  /** ISO timestamp written. */
  writtenAt: string;
  captions: Caption[];
  /** The headline / hook shared across platforms (pre-formatting). */
  hook: string;
  /** The single research item this set leads with, if any. */
  leadItemId?: string;
}

/* ------------------------------------------------------------------ */
/* Fact-check & quality gate (t3)                                      */
/* ------------------------------------------------------------------ */

export type ClaimVerdict = "supported" | "unsupported" | "uncertain" | "contradicted";

export interface CheckedClaim {
  /** The claim text extracted from a caption. */
  claim: string;
  verdict: ClaimVerdict;
  /** ResearchItem ids that support/contradict the claim. */
  evidenceItemIds: string[];
  /** Reviewer note. */
  note?: string;
}

export interface FactCheckResult {
  laneId: LaneId;
  platform: Platform;
  /** ISO timestamp checked. */
  checkedAt: string;
  claims: CheckedClaim[];
  /** True when no claim is `unsupported` or `contradicted`. */
  passed: boolean;
  /** 0..1 confidence aggregate. */
  confidence: number;
}

export type QualitySeverity = "info" | "warn" | "block";

export interface QualityIssue {
  /** Stable rule id, e.g. "char-limit", "no-citation", "voice-banned-word". */
  rule: string;
  severity: QualitySeverity;
  message: string;
}

export interface QualityGateResult {
  laneId: LaneId;
  platform: Platform;
  checkedAt: string;
  issues: QualityIssue[];
  /** True when there are zero `block`-severity issues. */
  passed: boolean;
  /** 0..1 composite quality score. */
  score: number;
}

/* ------------------------------------------------------------------ */
/* Memory / dedupe (t3)                                                */
/* ------------------------------------------------------------------ */

/** A record of something the pipeline has previously posted/queued. */
export interface PostLogEntry {
  id: string;
  laneId: LaneId;
  platform: Platform;
  /** Stable content fingerprint used for duplicate detection. */
  contentHash: string;
  /** ResearchItem ids the post was grounded in. */
  citedItemIds: string[];
  /** ISO timestamp logged. */
  loggedAt: string;
  /** Where it ended up: queued markdown path or published id. */
  destination: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  /** Closest prior entry, if any. */
  match?: PostLogEntry;
  /** 0..1 similarity to the closest prior entry. */
  similarity: number;
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Proof images (t4)                                                   */
/* ------------------------------------------------------------------ */

export type ProofImageFormat = "png" | "jpeg" | "webp" | "svg";

/** Inputs a proof template needs to render. */
export interface ProofTemplateInput {
  laneId: LaneId;
  headline: string;
  /** Supporting bullet lines / stats shown on the card. */
  lines: string[];
  /** Source attribution shown on the card. */
  attribution?: string;
  /** Theme / variant name, resolved by the template. */
  variant?: string;
}

/** A rendered proof image plus where it lives on disk. */
export interface ProofImage {
  laneId: LaneId;
  /** Absolute path to the rendered asset. */
  path: string;
  format: ProofImageFormat;
  width: number;
  height: number;
  /** Suggested alt text for accessibility. */
  altText: string;
  metadata: ProofMetadata;
}

export interface ProofMetadata {
  /** Absolute path to the sidecar metadata file (e.g. .json). */
  path: string;
  template: string;
  variant?: string;
  /** ISO timestamp rendered. */
  renderedAt: string;
  /** Content fingerprint of the inputs (for caching/dedupe). */
  inputHash: string;
  /** Bytes on disk. */
  bytes: number;
}

/* ------------------------------------------------------------------ */
/* Publishing & queue (t5)                                             */
/* ------------------------------------------------------------------ */

/** queue-only is the SAFE DEFAULT: nothing is posted live, only written to disk. */
export type PublishMode = "queue" | "live";

export type QueueStatus = "ready" | "posted" | "skipped" | "failed";

/**
 * One queued post = one platform. In queue mode it is serialized to a markdown
 * file under the ready-to-post directory.
 */
export interface QueueItem {
  id: string;
  laneId: LaneId;
  platform: Platform;
  status: QueueStatus;
  caption: Caption;
  /** Absolute path to the attached proof image, if any. */
  imagePath?: string;
  /** Absolute path to the serialized markdown file. */
  markdownPath: string;
  /** ISO timestamp created. */
  createdAt: string;
  /** ISO timestamp of last status change. */
  updatedAt: string;
  /** Content fingerprint, mirrors PostLogEntry.contentHash. */
  contentHash: string;
}

/** Result of asking a publisher to handle a queue item. */
export interface PublishResult {
  queueItemId: string;
  platform: Platform;
  mode: PublishMode;
  status: QueueStatus;
  /** Platform post id / url when live-published. */
  externalId?: string;
  /** Markdown path when queued. */
  markdownPath?: string;
  error?: string;
  publishedAt: string;
}

/** Contract every platform publisher adapter implements (t5). */
export interface Publisher {
  platform: Platform;
  /** Whether this adapter can run live right now (creds present, etc.). */
  canPublishLive(): boolean | Promise<boolean>;
  /** Handle a single queue item under the given mode. */
  publish(item: QueueItem, mode: PublishMode): Promise<PublishResult>;
}

/* ------------------------------------------------------------------ */
/* Orchestration (t6)                                                  */
/* ------------------------------------------------------------------ */

export type StageName =
  | "research"
  | "write"
  | "fact-check"
  | "quality-gate"
  | "proof-image"
  | "duplicate-check"
  | "publish";

export type StageStatus = "ok" | "skipped" | "failed" | "blocked";

export interface StageResult<T = unknown> {
  stage: StageName;
  status: StageStatus;
  /** Wall-clock duration in ms. */
  durationMs: number;
  /** Stage payload (typed by callers). */
  output?: T;
  error?: string;
  notes?: string[];
}

/** Context threaded through a single lane run by the orchestrator. */
export interface LaneRunContext {
  lane: LaneConfig;
  /** Resolved run options (mode, dry-run, etc.). */
  options: RunOptions;
  logger: Logger;
  /** ISO timestamp the run started. */
  startedAt: string;
  /** Stable id for this run, e.g. "evening-battle-card-2026-06-26T18-00". */
  runId: string;
}

export interface RunOptions {
  /** queue (default, safe) or live. */
  mode: PublishMode;
  /** When true, no files are written and no network publish occurs. */
  dryRun: boolean;
  /** Restrict to a subset of platforms (defaults to lane.platforms). */
  platforms?: Platform[];
  /** Skip proof image rendering even if the lane requests it. */
  skipProofImage?: boolean;
  /** Treat quality-gate `warn` issues as blocking. */
  strict?: boolean;
}

export const DEFAULT_RUN_OPTIONS: RunOptions = {
  mode: "queue",
  dryRun: false,
  strict: false,
};

/** The full result of running one lane end-to-end. */
export interface LaneRunResult {
  runId: string;
  laneId: LaneId;
  startedAt: string;
  finishedAt: string;
  status: StageStatus;
  stages: StageResult[];
  /** Items that made it to the queue (or would have, in dry-run). */
  queued: QueueItem[];
  /** Human-readable one-line summary. */
  summary: string;
}

export interface RunAllResult {
  startedAt: string;
  finishedAt: string;
  lanes: LaneRunResult[];
  /** True when every lane finished without a failed stage. */
  ok: boolean;
}
