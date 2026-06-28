# omni-release · Research Engine

The research engine (lane **t2**) fetches AI-news sources, normalizes them into a
single ranked feed, and returns one structured `ResearchResult`. It is the first
stage of the pipeline; the writing lane (t3) consumes its output.

> **Design principle — self-contained, injectable.** The engine has **no hard
> dependency** on the shared app modules (logger / config / paths) so it
> compiles and runs standalone. The orchestrator injects real shared services
> through an optional `ResearchContext`. See [Integration contract](#integration-contract).

## Module map (`src/research/`)

| File                 | Responsibility                                                        |
| -------------------- | -------------------------------------------------------------------- |
| `types.ts`           | Type contracts. **Source of truth for `ResearchResult` / `ResearchItem`.** |
| `sourceRegistry.ts`  | In-code source catalog + selection/query helpers.                    |
| `fetchSources.ts`    | Fetch + parse (RSS, Atom, Hacker News, Reddit, generic JSON). No deps.|
| `sourceHealth.ts`    | Persisted per-source health (`SourceHealthStore`).                   |
| `researchLane.ts`    | Orchestrator: select → fetch → health → dedupe → score → rank.       |
| `context.ts`         | Resolves an optional `ResearchContext` into defaults.                |
| `index.ts`           | Public barrel — import everything from here.                         |

## Quick start

```ts
import { researchLane } from 'omni-release/research';

const result = await researchLane('evening-battle-card', {
  categories: ['lab-blog', 'aggregator', 'news'],
  keywords: ['gpt-5', 'claude', 'open-weights'],
  sinceHours: 24,
  maxTotalItems: 30,
});

console.log(result.stats);          // run summary
for (const item of result.items) {  // ranked, deduped
  console.log(item.score, item.title, item.url);
}
```

With injected shared services (from the t6 CLI / t1 app):

```ts
const result = await researchLane('morning-scan', opts, {
  logger: app.logger,         // ResearchLogger-compatible
  dataDir: app.paths.dataDir, // where source-health.json is written
});
```

## Source categories

Seven categories (`SourceCategory`): `lab-blog`, `research`, `aggregator`,
`newsletter`, `news`, `product`, `social`. Full catalog and weights live in
[`../source-list.md`](../source-list.md).

Fetch strategies (`SourceType`):

- **`rss` / `atom`** — parsed by a small, dependency-free tolerant extractor
  (CDATA-aware, entity-decoding, Atom `<link href>` resolution).
- **`json-hn`** — Hacker News via the public Algolia API. `{query}` in the URL
  is replaced with the lane's keywords (`AI OR LLM` when none given). HN/Reddit
  points + comments feed the engagement score component.
- **`json-reddit`** — Reddit `*.json` listings (sent with a descriptive
  User-Agent).
- **`json-generic`** — any JSON API; `itemsPath` dot-selects the array.
- **`manual` / browser-gated** — reported as *skipped*; handed to the t5 browser
  lane. Never counted as a failure.

## The lane pipeline

1. **Select** sources via `selectSources` (category / id / enabled / browser gates).
2. **Fetch** with a bounded concurrency pool (`concurrency`, default 6) and a
   per-source timeout (`timeoutMs`, default 12 s). Fetches never throw — failures
   become `ok:false` outcomes.
3. **Health** — every outcome is folded into `SourceHealthStore` and persisted to
   `<dataDir>/research/source-health.json`.
4. **Filter** by recency (`sinceHours`, when an item's date is known).
5. **Dedupe** by canonical URL (utm/ref/fragment stripped, trailing slash
   normalized), falling back to lowercased title. The richer record wins.
6. **Score & rank** (see below), then **truncate** to `maxTotalItems`.

The result is fully JSON-serializable.

### Scoring

`score` is `0..100`, a weighted blend (`researchLane.scoreItem`):

| Component      | Weight | Definition                                              |
| -------------- | ------ | ------------------------------------------------------- |
| recency        | 0.40   | `1` at now → `~0` at 7 days; unknown date → neutral 0.4 |
| source weight  | 0.25   | registry `weight` (~0.6–1.6) normalized to `0..1`       |
| keyword match  | 0.25   | fraction of lane `keywords` present; no keywords → 0.5  |
| engagement     | 0.10   | log-scaled HN/Reddit points+comments (saturates ~1000)  |

Each item carries a `scoreBreakdown` so downstream lanes/operators can see why
it ranked where it did.

## `ResearchLaneOptions`

| Option                 | Default        | Effect                                                    |
| ---------------------- | -------------- | --------------------------------------------------------- |
| `categories`           | all enabled    | Restrict to these categories.                             |
| `sourceIds`            | —              | Restrict to explicit ids (honored even if disabled).      |
| `keywords`             | —              | Scoring signal + optional hard filter; substituted into HN.|
| `requireKeywordMatch`  | `false`        | Drop items matching no keyword.                            |
| `sinceHours`           | —              | Keep items newer than N hours (when date known).          |
| `maxItemsPerSource`    | `10`           | Cap per source before global ranking.                     |
| `maxTotalItems`        | `40`           | Cap on the final list.                                     |
| `timeoutMs`            | `12000`        | Per-fetch timeout.                                         |
| `concurrency`          | `6`            | Max simultaneous fetches.                                  |
| `includeBrowserSources`| `false`        | Include browser-gated sources (reported as skipped).      |
| `includeDisabled`      | `false`        | Include disabled sources.                                  |

## `ResearchResult` shape

```ts
interface ResearchResult {
  lane: string;
  generatedAt: string;            // ISO
  options: ResearchLaneOptions;   // resolved options used
  items: ResearchItem[];          // ranked, deduped
  sources: SourceAttempt[];       // per-source outcome (ok/failed/skipped)
  stats: {
    sourcesAttempted; sourcesOk; sourcesFailed; sourcesSkipped;
    itemsCollected; itemsAfterDedupe; itemsReturned; durationMs;
  };
  notes: string[];                // non-fatal warnings for the operator
}
```

See `types.ts` for `ResearchItem` and `SourceAttempt` in full.

## Source health

`SourceHealthStore` keeps a rolling record per source: status
(`healthy`/`degraded`/`down`/`unknown`), last success/error, consecutive
failures, success/failure totals, EWMA latency, and last item count. Thresholds:
`degraded` after 2 consecutive failures, `down` after 5. A successful fetch that
returns **zero** items is marked `degraded` (likely a feed format change). Reads
and writes are best-effort — a missing/corrupt file starts fresh and write
failures are logged, never thrown.

```ts
import { SourceHealthStore, resolveContext } from 'omni-release/research';
const store = new SourceHealthStore(resolveContext({ dataDir }));
await store.load();
console.log(store.summary()); // { counts, down, degraded, updatedAt }
```

## Integration contract

What the engine **provides** to other lanes:

- `researchLane(lane, options?, context?) → Promise<ResearchResult>` — the entry
  point. Pure with respect to its inputs except for the health-store side effect.
- The `ResearchResult` / `ResearchItem` types — **t3 (writing) and t6 (CLI)
  should import these from `src/research`** rather than redefining them. If t1
  centralizes shared types, it should re-export these.

What the engine **needs** (all optional, via `ResearchContext`):

- `logger?` — anything matching `ResearchLogger` (`debug/info/warn/error`).
  Defaults to a stderr console logger.
- `dataDir?` — directory for persisted state. Defaults to
  `$OMNI_DATA_DIR` or `<cwd>/.omni`.
- `fetchImpl?` / `now?` / `sources?` — injection points for tests and mocks.

Requires **Node ≥ 18** (global `fetch`, `AbortController`). No runtime
dependencies. Module style is ESM with NodeNext resolution (`.js` import
specifiers) — align `package.json` `"type": "module"` and `tsconfig` `module:
"NodeNext"` accordingly (t1).

### For t6 (CLI orchestrator)

- `omni research run <lane>` → call `researchLane`, print `stats` + top items.
- `omni research sources` → `summarizeRegistry()` / `selectSources()`.
- `omni research health` → `new SourceHealthStore(ctx).load()` then `.summary()`.
- The Evening Battle Card dry-run can mock the network by passing
  `context.fetchImpl`; no module is left incomplete on this lane's side.

## Verification

The engine was smoke-tested with a mocked `fetchImpl` exercising RSS, Atom, HN,
and Reddit payloads: dedupe (cross-source + utm-stripping), recency filtering,
keyword scoring, health persistence, and JSON serialization all pass. `tsc
--strict --noEmit` is clean. To re-run locally once t1's `package.json`/`tsconfig`
land, add a test under the project's test runner using the injection points above.
