# Omni Release

A lightweight, **release engine for solo builders** — not a full social suite. It
turns live AI intelligence into scheduled, proof-backed, platform-ready posts.

Omni Release researches the day's AI news, fact-checks it, writes
platform-specific captions, generates a proof image, and either queues the post
or (opt-in) publishes it — keeping a durable local log so content never repeats.

```
research → write → proof image → fact-check → duplicate-check → quality gate → queue / publish → log
```

## Posting lanes

Three daily lanes, each running the full pipeline:

| Lane                  | Slot      | Id                    | Focus                                        |
|-----------------------|-----------|-----------------------|----------------------------------------------|
| **AI Daily Shift**    | Morning   | `ai-daily-shift`      | The overnight shift in AI for builders       |
| **Model Watch**       | Afternoon | `model-watch`         | New models, weights, benchmarks, leaderboards|
| **Evening Battle Card** | Evening | `evening-battle-card` | End-of-day decisive digest                   |

## Safety model

- **Queue-only by default.** Runs write a platform-ready package to
  `ready-to-post/` and a proof image to `proof-assets/`. **Nothing posts to a
  live network** unless you explicitly opt in (`--mode live` / `OMNI_MODE=live`)
  *and* credentials/a session are configured.
- **Never drops a post.** If live publishing isn't configured or fails, the full
  post is saved to `ready-to-post/` with the failure reason and manual steps.
- **Dry-run** (`--dry-run`) runs the whole pipeline and produces every artifact
  (proof image, captions, ready-to-post package, log entry) but never posts live
  and is excluded from duplicate detection.
- **No secrets in source.** All credentials come from `OMNI_*` env vars.
- **No stale facts.** Rankings/pricing/scores are fetched live each run; failed
  sources are marked, not faked.

## Requirements

- Node.js ≥ 20 (native `fetch`, ESM)

## Install

```sh
npm install
```

## Usage

```sh
npm run dev                      # help / command list

# Run a lane (default mode: queue — no live posting)
npm run run:morning              # AI Daily Shift
npm run run:afternoon            # Model Watch
npm run run:evening              # Evening Battle Card
npm run run:all                  # every enabled lane

# Dry-run the Evening Battle Card lane (full artifacts, never posts live)
npm run dry-run

# Inspect things
npm run research -- --lane evening-battle-card   # research stage only
npm run queue:list                               # list ready-to-post packages
npm run log:latest -- --n 10                     # last N log entries
npm run health                                   # source registry + health
npm run lanes                                    # configured lanes
```

Any lane command accepts: `--mode queue|live`, `--dry-run`,
`--platforms x,linkedin`, `--skip-proof`, `--strict`.

### Scripts

| Script                | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `npm run dev`         | Print the command list                               |
| `npm run build`       | Compile TypeScript to `dist/`                        |
| `npm run typecheck`   | Type-check without emitting                          |
| `npm run run:morning/afternoon/evening` | Run one daily lane               |
| `npm run run:all`     | Run all enabled lanes                                |
| `npm run dry-run`     | Full pipeline, never posts live                      |
| `npm run research`    | Research stage only                                  |
| `npm run queue:list`  | List ready-to-post packages                          |
| `npm run log:latest`  | Show recent log entries                              |
| `npm run health`      | Source + health report                               |
| `npm test`            | Vitest suite (offline pipeline integration)          |

## Where things are stored

| Path                      | What                                                    |
| ------------------------- | ------------------------------------------------------- |
| `proof-assets/`           | Rendered proof images (SVG) + JSON metadata sidecars    |
| `ready-to-post/`          | Per-run markdown packages (the default output)          |
| `social-post-log.jsonl`   | Durable append-only log (dedupe + history)              |
| `logs/run-<id>.json`      | Per-run log artifact                                    |
| `data/research/`          | Per-run source-health snapshots                         |

## Publisher modes

Two modes behind one adapter interface — see
[`publisher-routing.md`](publisher-routing.md):

- **API mode** (X / Meta / LinkedIn) — gated on `OMNI_*` credentials. The gate is
  wired; live API calls are the next step (currently falls back to ready-to-post).
- **Browser-assisted mode** — drive a logged-in session; not yet wired (falls
  back to ready-to-post).

Until either is configured, every run safely produces ready-to-post packages.

## What still needs setup before live posting

- **X:** `OMNI_X_API_KEY`, `OMNI_X_API_SECRET`, `OMNI_X_ACCESS_TOKEN`, `OMNI_X_ACCESS_SECRET`
- **LinkedIn:** `OMNI_LINKEDIN_ACCESS_TOKEN`, `OMNI_LINKEDIN_AUTHOR_URN`
- **Facebook:** `OMNI_FACEBOOK_PAGE_ID`, `OMNI_FACEBOOK_PAGE_TOKEN`
- **Browser:** `OMNI_BROWSER_SESSION` + a session adapter (Playwright / Claude-in-Chrome)

Then run with `--mode live`. The live API/browser send is the one piece left to
implement inside `src/publish/publishers.ts`.

## Adding sources

Edit the in-code registry `src/research/sourceRegistry.ts` (the source of truth),
then mirror it in [`source-list.md`](source-list.md). Each source has a category,
fetch type (`rss`/`atom`/`json-hn`/`json-reddit`/`json-generic`/`manual`), weight,
and `enabled` flag. Failed sources are reported, not faked.

## Adding a future platform

See "Adding a new platform" in [`publisher-routing.md`](publisher-routing.md):
extend the `Platform` union + limits in `src/core/`, add hashtag rules, add
credential keys (or route to browser), and add it to the relevant lanes.

## Configuration (env)

| Variable                        | Default | Meaning                                   |
| ------------------------------- | ------- | ----------------------------------------- |
| `OMNI_MODE`                     | `queue` | `queue` (safe) or `live`                  |
| `OMNI_DUPLICATE_THRESHOLD`      | `0.85`  | Similarity at/above which a post is a dup |
| `OMNI_MIN_QUALITY_SCORE`        | `0.7`   | Quality-gate pass threshold (0..1)        |
| `OMNI_MIN_FACTCHECK_CONFIDENCE` | `0.6`   | Fact-check pass threshold (0..1)          |
| `OMNI_FETCH_TIMEOUT_MS`         | `15000` | Per-source fetch timeout                  |
| `OMNI_MAX_RESEARCH_ITEMS`       | `25`    | Items carried into writing                |
| `OMNI_LOG_LEVEL`                | `info`  | `debug`/`info`/`warn`/`error`             |
| `OMNI_ROOT`                     | repo    | Override project root (tests/sandbox)     |

## Config files

`omni-release.config.md` · `source-list.md` · `voice-rules.md` ·
`publisher-routing.md` · `blocked-phrases.md` · `hashtag-rules.md`

## Layout

```
src/
  core/        shared contracts, config, paths, logger, utils
  research/    fetch & rank live AI-news sources
  content/     lane prompts, caption writing, platform formatting, rule loaders
  quality/     fact-check, quality gate, blocked phrases
  memory/      durable post log + duplicate detection
  proof/       proof-image (SVG) rendering pipeline
  publish/     publisher adapters (API + browser) + ready-to-post fallback
  runs/        runLane / runAll orchestration
  cli/         CLI entry point
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.
