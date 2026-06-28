/**
 * omni-release · research engine · type contracts
 *
 * This file is the source of truth for the *output* of the research lane.
 * Downstream lanes (t3 writing, t6 CLI) should import `ResearchResult` and
 * `ResearchItem` from `src/research` rather than redefining them.
 *
 * The research engine is intentionally self-contained: it does NOT hard-import
 * t1's shared modules (logger/config/paths). Instead it accepts an optional
 * `ResearchContext` so the orchestrator can inject real shared services, while
 * the module still compiles and runs standalone with sensible defaults.
 * See src/research/HANDOFF.md for the integration contract.
 */

/** Broad buckets the registry organizes sources into. */
export type SourceCategory =
  | 'lab-blog' //   Official AI lab / company engineering + announcement blogs
  | 'research' //   Papers and preprints (arXiv, Papers with Code)
  | 'aggregator' // Community surfaces (Hacker News, Reddit)
  | 'newsletter' // Curated AI newsletters
  | 'news' //       Tech press AI desks
  | 'product' //    Launches / changelogs / trending repos
  | 'social'; //    X lists, threads — usually browser-gated

/** How a given source is fetched + parsed. */
export type SourceType =
  | 'rss' //          RSS 2.0 feed
  | 'atom' //         Atom feed
  | 'json-hn' //      Hacker News (Algolia) search JSON
  | 'json-reddit' //  Reddit listing JSON
  | 'json-generic' // Arbitrary JSON with a configured item path
  | 'html' //         Needs HTML scraping (not auto-fetched in MVP)
  | 'manual'; //      Browser / human-in-the-loop only

export type SourceHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

/** A single configured source in the registry. */
export interface Source {
  id: string;
  name: string;
  category: SourceCategory;
  type: SourceType;
  /** Feed / API endpoint. For json-generic, `itemsPath` selects the array. */
  url: string;
  /** Dot-path into a JSON payload to the items array (json-generic only). */
  itemsPath?: string;
  /** Higher weight ranks this source's items higher. Default 1. */
  weight?: number;
  /** Disabled sources are skipped by the lane unless explicitly requested. */
  enabled: boolean;
  /** True when the source can only be reached via the browser lane (t5). */
  needsBrowser?: boolean;
  /** Free-form topical tags used for lane filtering + scoring. */
  tags?: string[];
  /** Human note explaining the source. */
  notes?: string;
}

/** A normalized news item produced from one source. */
export interface ResearchItem {
  /** Stable hash id (sourceId + canonical url|title). */
  id: string;
  sourceId: string;
  sourceName: string;
  category: SourceCategory;
  title: string;
  url: string;
  /** Plain-text summary/excerpt, entity-decoded and length-capped. */
  summary: string;
  /** ISO 8601 string when known, else null. */
  publishedAt: string | null;
  author: string | null;
  tags: string[];
  /** Relevance/recency score assigned by the lane (0..100). */
  score: number;
  /** Provenance — which signals contributed to the score. */
  scoreBreakdown?: {
    recency: number;
    sourceWeight: number;
    keyword: number;
    engagement: number;
  };
}

/** Per-source health snapshot, persisted across runs. */
export interface SourceHealthRecord {
  sourceId: string;
  status: SourceHealthStatus;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  totalSuccess: number;
  totalFailure: number;
  /** Rolling average fetch latency in milliseconds. */
  avgLatencyMs: number;
  /** Items returned on the most recent successful fetch. */
  lastItemCount: number;
}

/** Options that shape a single research-lane run. */
export interface ResearchLaneOptions {
  /** Restrict to these categories (default: all enabled categories). */
  categories?: SourceCategory[];
  /** Restrict to these explicit source ids. */
  sourceIds?: string[];
  /** Keywords used for relevance scoring + optional hard filtering. */
  keywords?: string[];
  /** When true, drop items that match none of `keywords`. Default false. */
  requireKeywordMatch?: boolean;
  /** Only keep items published within this many hours (when date known). */
  sinceHours?: number;
  /** Max items kept per source before global ranking. Default 10. */
  maxItemsPerSource?: number;
  /** Max items in the final result. Default 40. */
  maxTotalItems?: number;
  /** Per-fetch timeout in ms. Default 12000. */
  timeoutMs?: number;
  /** Max concurrent source fetches. Default 6. */
  concurrency?: number;
  /** Include sources flagged needsBrowser (reported as skipped). Default false. */
  includeBrowserSources?: boolean;
  /** Include disabled sources. Default false. */
  includeDisabled?: boolean;
}

/** A source that was attempted, with the outcome of the attempt. */
export interface SourceAttempt {
  sourceId: string;
  sourceName: string;
  category: SourceCategory;
  ok: boolean;
  itemCount: number;
  latencyMs: number;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

/** The structured object every research-lane run returns. */
export interface ResearchResult {
  /** Lane label, e.g. "evening-battle-card". */
  lane: string;
  /** ISO timestamp the run completed. */
  generatedAt: string;
  /** Echo of the resolved options used for the run. */
  options: ResearchLaneOptions;
  /** Ranked, deduped items. */
  items: ResearchItem[];
  /** Outcome per source attempted. */
  sources: SourceAttempt[];
  stats: {
    sourcesAttempted: number;
    sourcesOk: number;
    sourcesFailed: number;
    sourcesSkipped: number;
    itemsCollected: number;
    itemsAfterDedupe: number;
    itemsReturned: number;
    durationMs: number;
  };
  /** Non-fatal notes/warnings surfaced for the operator. */
  notes: string[];
}

/**
 * Shared services the orchestrator may inject. All optional — the engine
 * provides safe defaults so it runs standalone. t1's app should pass its real
 * logger/config/paths here.
 */
export interface ResearchContext {
  logger?: ResearchLogger;
  /** Directory for persisted state (health json). Default: <cwd>/.omni */
  dataDir?: string;
  /** Override the registry (else the built-in registry is used). */
  sources?: Source[];
  /** Custom fetch (for tests/mocks). Default: global fetch. */
  fetchImpl?: typeof fetch;
  /** Wall-clock now() in ms — injectable for deterministic tests. */
  now?: () => number;
}

export interface ResearchLogger {
  debug: (msg: string, meta?: unknown) => void;
  info: (msg: string, meta?: unknown) => void;
  warn: (msg: string, meta?: unknown) => void;
  error: (msg: string, meta?: unknown) => void;
}
