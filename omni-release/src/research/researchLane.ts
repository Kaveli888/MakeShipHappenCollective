/**
 * omni-release · research engine · the research lane
 *
 * Public entry point. Selects sources, fetches them, updates health, then
 * dedupes, scores, ranks, and truncates into a single structured
 * `ResearchResult`. This object is the hand-off contract to the writing lane
 * (t3) and the CLI orchestrator (t6).
 *
 *   import { researchLane } from 'omni-release/research';
 *   const result = await researchLane('evening-battle-card', { sinceHours: 24 });
 */

import type {
  ResearchContext,
  ResearchItem,
  ResearchLaneOptions,
  ResearchResult,
  Source,
  SourceAttempt,
} from './types.js';
import { resolveContext } from './context.js';
import { selectSources, SOURCE_REGISTRY } from './sourceRegistry.js';
import { fetchSources, canonicalUrl, type FetchOutcome } from './fetchSources.js';
import { SourceHealthStore } from './sourceHealth.js';

const DEFAULTS: Required<
  Omit<ResearchLaneOptions, 'categories' | 'sourceIds' | 'keywords' | 'sinceHours'>
> = {
  requireKeywordMatch: false,
  maxItemsPerSource: 10,
  maxTotalItems: 40,
  timeoutMs: 12_000,
  concurrency: 6,
  includeBrowserSources: false,
  includeDisabled: false,
};

export async function researchLane(
  lane: string,
  options: ResearchLaneOptions = {},
  context: ResearchContext = {},
): Promise<ResearchResult> {
  const ctx = resolveContext(context);
  const start = ctx.now();
  const notes: string[] = [];

  const opts: ResearchLaneOptions = { ...DEFAULTS, ...options };
  const registry: Source[] = context.sources ?? SOURCE_REGISTRY;

  // 1) select
  const sources = selectSources(
    {
      categories: opts.categories,
      sourceIds: opts.sourceIds,
      includeDisabled: opts.includeDisabled,
      includeBrowserSources: opts.includeBrowserSources,
    },
    registry,
  );

  if (sources.length === 0) {
    notes.push('no sources matched the selection criteria');
    return emptyResult(lane, opts, notes, ctx.now() - start);
  }
  ctx.logger.info(`lane "${lane}" → ${sources.length} source(s)`);

  // 2) fetch
  const outcomes = await fetchSources(
    sources,
    {
      timeoutMs: opts.timeoutMs!,
      maxItemsPerSource: opts.maxItemsPerSource!,
      keywords: opts.keywords,
      concurrency: opts.concurrency!,
    },
    ctx,
  );

  // 3) health
  const health = new SourceHealthStore(ctx);
  await health.load();
  for (const o of outcomes) health.record(o);
  await health.save();

  // 4) collect + filter by recency/keywords
  const sinceMs = opts.sinceHours ? ctx.now() - opts.sinceHours * 3_600_000 : null;
  const keywords = (opts.keywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);

  let collected: ResearchItem[] = [];
  for (const o of outcomes) {
    for (const item of o.items) {
      if (sinceMs !== null && item.publishedAt) {
        const t = Date.parse(item.publishedAt);
        if (!Number.isNaN(t) && t < sinceMs) continue;
      }
      collected.push(item);
    }
  }
  const itemsCollected = collected.length;

  // 5) dedupe (canonical url, else lowercased title)
  const deduped = dedupe(collected);

  // 6) keyword filter (optional hard filter)
  let filtered = deduped;
  if (keywords.length && opts.requireKeywordMatch) {
    filtered = deduped.filter((it) => matchesKeywords(it, keywords));
    if (filtered.length === 0) {
      notes.push(`requireKeywordMatch dropped all ${deduped.length} items; relax keywords?`);
    }
  }

  // 7) score + rank
  for (const it of filtered) scoreItem(it, { keywords, now: ctx.now() });
  filtered.sort((a, b) => b.score - a.score);

  // 8) truncate
  const returned = filtered.slice(0, opts.maxTotalItems);

  // 9) assemble attempts + stats
  const attempts: SourceAttempt[] = outcomes.map(toAttempt);
  const stats = {
    sourcesAttempted: attempts.length,
    sourcesOk: attempts.filter((a) => a.ok).length,
    sourcesFailed: attempts.filter((a) => !a.ok && !a.skipped).length,
    sourcesSkipped: attempts.filter((a) => a.skipped).length,
    itemsCollected,
    itemsAfterDedupe: deduped.length,
    itemsReturned: returned.length,
    durationMs: ctx.now() - start,
  };

  if (stats.sourcesFailed > 0) {
    const failed = attempts.filter((a) => !a.ok && !a.skipped).map((a) => a.sourceId);
    notes.push(`${stats.sourcesFailed} source(s) failed: ${failed.join(', ')}`);
  }
  if (returned.length === 0) notes.push('no items returned — check source health + filters');

  return {
    lane,
    generatedAt: new Date(ctx.now()).toISOString(),
    options: opts,
    items: returned,
    sources: attempts,
    stats,
    notes,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function dedupe(items: ResearchItem[]): ResearchItem[] {
  const seen = new Map<string, ResearchItem>();
  for (const it of items) {
    const key = canonicalUrl(it.url) || it.title.toLowerCase().trim();
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, it);
      continue;
    }
    // Keep the richer record (longer summary), preserve earliest publish date.
    if ((it.summary?.length ?? 0) > (existing.summary?.length ?? 0)) {
      seen.set(key, it);
    }
  }
  return [...seen.values()];
}

function matchesKeywords(it: ResearchItem, keywords: string[]): boolean {
  const hay = `${it.title} ${it.summary} ${it.tags.join(' ')}`.toLowerCase();
  return keywords.some((k) => hay.includes(k));
}

interface ScoreCtx {
  keywords: string[];
  now: number;
}

/**
 * Score 0..100 = weighted blend of recency, source weight, keyword match, and
 * community engagement (HN/Reddit). Components are normalized then combined.
 */
export function scoreItem(it: ResearchItem, sctx: ScoreCtx): ResearchItem {
  // recency: 1.0 at now → ~0 at 7 days; unknown date → neutral 0.4
  let recency = 0.4;
  if (it.publishedAt) {
    const ageH = Math.max(0, (sctx.now - Date.parse(it.publishedAt)) / 3_600_000);
    recency = clamp01(1 - ageH / (24 * 7));
  }

  // source weight: registry weight (~0.6..1.6) mapped to 0..1
  const rawWeight = it.scoreBreakdown?.sourceWeight || 0;
  const sourceWeight = rawWeight > 0 ? rawWeight : weightFromTagsFallback(it);

  // keyword: fraction of keywords present (no keywords → neutral 0.5)
  let keyword = 0.5;
  if (sctx.keywords.length) {
    const hay = `${it.title} ${it.summary} ${it.tags.join(' ')}`.toLowerCase();
    const hits = sctx.keywords.filter((k) => hay.includes(k)).length;
    keyword = hits / sctx.keywords.length;
  }

  // engagement: log-scaled HN/Reddit points → 0..1 (saturates ~1000)
  const rawEng = it.scoreBreakdown?.engagement || 0;
  const engagement = rawEng > 0 ? clamp01(Math.log10(rawEng + 1) / 3) : 0;

  const blended =
    recency * 0.4 + sourceWeight * 0.25 + keyword * 0.25 + engagement * 0.1;
  it.score = Math.round(clamp01(blended) * 100);
  it.scoreBreakdown = {
    recency: round2(recency),
    sourceWeight: round2(sourceWeight),
    keyword: round2(keyword),
    engagement: round2(engagement),
  };
  return it;
}

function weightFromTagsFallback(_it: ResearchItem): number {
  return 0.5;
}

function toAttempt(o: FetchOutcome): SourceAttempt {
  return {
    sourceId: o.source.id,
    sourceName: o.source.name,
    category: o.source.category,
    ok: o.ok,
    itemCount: o.items.length,
    latencyMs: o.latencyMs,
    skipped: o.skipped || undefined,
    skipReason: o.skipReason,
    error: o.error,
  };
}

function emptyResult(
  lane: string,
  opts: ResearchLaneOptions,
  notes: string[],
  durationMs: number,
): ResearchResult {
  return {
    lane,
    generatedAt: new Date().toISOString(),
    options: opts,
    items: [],
    sources: [],
    stats: {
      sourcesAttempted: 0,
      sourcesOk: 0,
      sourcesFailed: 0,
      sourcesSkipped: 0,
      itemsCollected: 0,
      itemsAfterDedupe: 0,
      itemsReturned: 0,
      durationMs,
    },
    notes,
  };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
