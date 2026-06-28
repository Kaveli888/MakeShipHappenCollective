/**
 * omni-release — configuration.
 *
 * Central, typed config with safe defaults. Everything is overridable through
 * environment variables (prefix `OMNI_`) so no secrets live in source.
 *
 * SAFE DEFAULTS: publish mode is "queue" (nothing is posted live) and dryRun is
 * off. Live publishing requires an explicit opt-in (OMNI_MODE=live or --mode live).
 */

import type {
  LaneConfig,
  Platform,
  PlatformLimits,
  PublishMode,
} from "./types.js";

export interface OmniConfig {
  /** Default publish mode for runs that don't specify one. */
  defaultMode: PublishMode;
  /** Per-platform format limits, keyed by platform. */
  platformLimits: Record<Platform, PlatformLimits>;
  /** Registered content lanes. */
  lanes: LaneConfig[];
  /** Duplicate-check similarity threshold (0..1). At/above => duplicate. */
  duplicateThreshold: number;
  /** Quality-gate minimum passing score (0..1). */
  minQualityScore: number;
  /** Fact-check minimum confidence to pass (0..1). */
  minFactCheckConfidence: number;
  /** Network fetch timeout in ms for the research layer. */
  fetchTimeoutMs: number;
  /** Max research items carried forward into writing. */
  maxResearchItems: number;
}

/* ------------------------------------------------------------------ */
/* Platform limits                                                     */
/* ------------------------------------------------------------------ */

export const DEFAULT_PLATFORM_LIMITS: Record<Platform, PlatformLimits> = {
  x: {
    platform: "x",
    maxChars: 280,
    maxHashtags: 3,
    recommendedHashtags: 2,
    supportsImage: true,
  },
  linkedin: {
    platform: "linkedin",
    maxChars: 3000,
    maxHashtags: 5,
    recommendedHashtags: 3,
    supportsImage: true,
  },
  facebook: {
    platform: "facebook",
    maxChars: 2000,
    maxHashtags: 3,
    recommendedHashtags: 2,
    supportsImage: true,
  },
  browser: {
    platform: "browser",
    maxChars: 5000,
    maxHashtags: 8,
    recommendedHashtags: 3,
    supportsImage: true,
  },
};

/* ------------------------------------------------------------------ */
/* Default lanes                                                       */
/* ------------------------------------------------------------------ */

/**
 * The integration / dry-run target. Keep this lane id stable —
 * tests/eveningBattleCard.test.ts depends on "evening-battle-card".
 */
export const EVENING_BATTLE_CARD: LaneConfig = {
  id: "evening-battle-card",
  name: "Evening Battle Card",
  description:
    "End-of-day digest of the day's most consequential AI moves, framed as a single decisive 'battle card' with a proof image.",
  platforms: ["x", "linkedin"],
  sourceCategories: ["lab-blog", "news", "product"],
  proofImage: true,
  cadence: "daily 18:00",
  tags: ["digest", "ai-news", "flagship"],
  keywords: ["AI", "LLM", "model", "launch", "funding", "benchmark", "agent"],
  enabled: true,
};

/** Morning lane — the day's opening AI briefing. */
export const AI_DAILY_SHIFT: LaneConfig = {
  id: "ai-daily-shift",
  name: "AI Daily Shift",
  description:
    "Morning briefing on the overnight shift in AI: the launches, papers, and moves a solo builder needs before they start shipping.",
  platforms: ["x", "linkedin", "facebook"],
  sourceCategories: ["lab-blog", "news", "newsletter", "product"],
  proofImage: true,
  cadence: "daily 08:00",
  tags: ["briefing", "ai-news", "morning"],
  keywords: ["AI", "LLM", "model", "launch", "release", "agent", "open source"],
  enabled: true,
};

/** Afternoon lane — focused on models, benchmarks, and leaderboards. */
export const MODEL_WATCH: LaneConfig = {
  id: "model-watch",
  name: "Model Watch",
  description:
    "Afternoon deep-cut on models: new weights, benchmark/leaderboard movement, and what actually changed for people building on top.",
  platforms: ["x", "linkedin"],
  sourceCategories: ["lab-blog", "research", "product", "aggregator"],
  proofImage: true,
  cadence: "daily 13:00",
  tags: ["models", "benchmarks", "leaderboards", "afternoon"],
  keywords: ["model", "benchmark", "leaderboard", "weights", "fine-tune", "context window", "eval", "SOTA"],
  enabled: true,
};

export const DEFAULT_LANES: LaneConfig[] = [AI_DAILY_SHIFT, MODEL_WATCH, EVENING_BATTLE_CARD];

/* ------------------------------------------------------------------ */
/* Base config + env loading                                           */
/* ------------------------------------------------------------------ */

export const DEFAULT_CONFIG: OmniConfig = {
  defaultMode: "queue",
  platformLimits: DEFAULT_PLATFORM_LIMITS,
  lanes: DEFAULT_LANES,
  duplicateThreshold: 0.85,
  minQualityScore: 0.7,
  minFactCheckConfidence: 0.6,
  fetchTimeoutMs: 15_000,
  maxResearchItems: 25,
};

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envMode(key: string, fallback: PublishMode): PublishMode {
  const raw = process.env[key];
  return raw === "live" || raw === "queue" ? raw : fallback;
}

/**
 * Build the effective config, layering environment overrides over defaults.
 * Pure aside from reading process.env; never throws.
 */
export function loadConfig(overrides: Partial<OmniConfig> = {}): OmniConfig {
  const base: OmniConfig = {
    ...DEFAULT_CONFIG,
    defaultMode: envMode("OMNI_MODE", DEFAULT_CONFIG.defaultMode),
    duplicateThreshold: envNumber("OMNI_DUPLICATE_THRESHOLD", DEFAULT_CONFIG.duplicateThreshold),
    minQualityScore: envNumber("OMNI_MIN_QUALITY_SCORE", DEFAULT_CONFIG.minQualityScore),
    minFactCheckConfidence: envNumber(
      "OMNI_MIN_FACTCHECK_CONFIDENCE",
      DEFAULT_CONFIG.minFactCheckConfidence,
    ),
    fetchTimeoutMs: envNumber("OMNI_FETCH_TIMEOUT_MS", DEFAULT_CONFIG.fetchTimeoutMs),
    maxResearchItems: envNumber("OMNI_MAX_RESEARCH_ITEMS", DEFAULT_CONFIG.maxResearchItems),
  };
  return { ...base, ...overrides };
}

/** Look up a lane by id from a config (or the defaults). */
export function getLane(id: string, config: OmniConfig = DEFAULT_CONFIG): LaneConfig | undefined {
  return config.lanes.find((l) => l.id === id);
}
