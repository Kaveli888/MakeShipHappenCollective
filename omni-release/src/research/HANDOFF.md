# t2 (research engine) — handoff note

Status: **complete & verified** (tsc --strict clean; full pipeline smoke-tested
with mocked fetch). No files touched outside my scope (`src/research/**`,
`source-list.md`, `docs/RESEARCH.md`).

## What's here

`researchLane(lane, options?, context?) → Promise<ResearchResult>` plus the
registry, fetchers, scorer, and a persisted source-health store. Full docs in
[`../../docs/RESEARCH.md`](../../docs/RESEARCH.md). Public API is `src/research/index.ts`.

## What I need from t1 (base project)

The engine is self-contained and does **not** import shared modules, so nothing
blocks compilation. But to integrate cleanly:

1. **ESM/NodeNext.** I use `.js` import specifiers. Set `"type": "module"` in
   `package.json` and `"module": "NodeNext"` / `"moduleResolution": "NodeNext"`
   in `tsconfig.json`. Node ≥ 18 (for global `fetch`/`AbortController`).
2. **Shared types.** If you centralize cross-lane types, please **re-export**
   `ResearchResult` / `ResearchItem` / `SourceCategory` from `src/research` rather
   than redefining — `src/research/types.ts` is the source of truth for them.
3. **Path/logger injection (optional).** The engine accepts a `ResearchContext`
   with `logger` (a `ResearchLogger`: `debug/info/warn/error`) and `dataDir`. If
   your shared logger/paths match, pass them in; otherwise defaults are fine
   (`$OMNI_DATA_DIR` or `<cwd>/.omni`).

## What downstream lanes consume

- **t3 (writing):** import `ResearchResult` / `ResearchItem` from `src/research`.
  Each item has `title`, `url`, `summary`, `publishedAt`, `author`, `category`,
  `tags`, `score`, and a `scoreBreakdown`.
- **t6 (CLI/tests):** call `researchLane(...)`. For the Evening Battle Card
  dry-run, inject `context.fetchImpl` (and optionally `now`) to mock the network
  deterministically — no module on my side is left as a stub. Suggested commands
  documented in `docs/RESEARCH.md` → "For t6".
- **t5 (publishers/browser):** sources flagged `needsBrowser`/`manual`
  (`producthunt-ai`, `x-ai-list`) are reported as **skipped** in
  `result.sources`, not failed — they're yours to collect.

## Health state

Written to `<dataDir>/research/source-health.json`. Add that path (or the whole
`.omni/` dir) to `.gitignore` (t1 owns root config).
