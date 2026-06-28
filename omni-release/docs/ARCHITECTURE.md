# omni-release — Architecture

## Purpose

Convert the day's AI developments into fact-checked, platform-formatted social
posts with proof images, **safely** (queue-only by default), organized into
recurring **lanes**.

## Design principles

1. **Queue-only by default.** The pipeline never posts live unless explicitly
   switched to `live` mode. The terminal output of a normal run is markdown
   files in `output/ready-to-post/`.
2. **One direction of data flow.** Each stage consumes the previous stage's
   typed output and produces the next. No stage reaches backwards.
3. **Shared contracts, isolated implementations.** Every cross-stage type lives
   in `src/core/types.ts`. Stage implementations live in their own directories
   and import only the contracts they need.
4. **Deterministic & inspectable.** Hashes, run ids, and scores are computed via
   shared helpers (`src/core/util.ts`) so behavior is reproducible. Dry-run
   produces a full result object with **no** side effects.
5. **No secrets in source.** Configuration and credentials come from `OMNI_*`
   environment variables.

## Stage pipeline

```
            ┌─────────────────────────────────────────────────────────────┐
            │                     LaneRunContext                           │
            │      lane · options · logger · runId · startedAt             │
            └─────────────────────────────────────────────────────────────┘
                                        │
   ┌────────────┐   ResearchResult   ┌──┴───────┐   CaptionSet   ┌──────────────┐
   │  research  │ ─────────────────▶ │  write   │ ─────────────▶ │  fact-check  │
   │   (t2)     │                    │  (t3)    │                │    (t3)      │
   └────────────┘                    └──────────┘                └──────┬───────┘
                                                                        │ FactCheckResult
                                                                        ▼
   ┌────────────┐   QueueItem[]   ┌──────────────┐  ProofImage  ┌───────────────┐
   │  publish   │ ◀────────────── │ proof image  │ ◀─────────── │ quality gate  │
   │   (t5)     │                 │    (t4)      │              │    (t3)       │
   └─────┬──────┘                 └──────────────┘              └───────────────┘
         │ PublishResult / markdown
         ▼
   output/ready-to-post/*.md   ·   data/post-log/   ·   LaneRunResult (t6)
```

### Stages

| Stage           | Owner | Input                         | Output             |
| --------------- | ----- | ----------------------------- | ------------------ |
| research        | t2    | `LaneConfig`                  | `ResearchResult`   |
| write           | t3    | `ResearchResult`, lane prompt | `CaptionSet`       |
| fact-check      | t3    | `Caption`, `ResearchResult`   | `FactCheckResult`  |
| quality-gate    | t3    | `Caption`, `FactCheckResult`  | `QualityGateResult`|
| duplicate-check | t3    | `Caption`, post-log           | `DuplicateCheckResult` |
| proof-image     | t4    | `ProofTemplateInput`          | `ProofImage`       |
| publish         | t5    | `Caption` + `ProofImage`      | `QueueItem` / `PublishResult` |
| orchestrate     | t6    | `LaneConfig` + `RunOptions`   | `LaneRunResult`    |

## Module map

| Path           | Owner | Responsibility |
| -------------- | ----- | -------------- |
| `src/core/`    | t1    | Shared types, config, paths, logger, utils. The contract surface. |
| `src/research/`| t2    | `sourceRegistry`, `fetchSources`, `researchLane`, `sourceHealth`. Returns `ResearchResult`. |
| `src/content/` | t3    | `lanePrompts`, `writeCaptions`, `platformFormatting`, `factCheck`, `qualityGate`, `postLog`, `duplicateCheck`. |
| `src/proof/`   | t4    | `proofTemplate`, `renderProofImage`, `proofAssetStore`, `proofMetadata`. Writes to `output/proof-images/`. |
| `src/publish/` | t5    | `publisherRouter`, per-platform adapters (X/LinkedIn/Facebook/browser), `createQueueItem`, `listQueue`, `markQueueItem`. Writes to `output/ready-to-post/`. |
| `src/cli/`     | t6    | CLI entry + command parsing. |
| `src/runs/`    | t6    | `runLane`, `runAll`, `dryRun` orchestration. |

## Core contracts (src/core)

- **types.ts** — every cross-stage interface. The single source of truth.
- **config.ts** — `OmniConfig`, `loadConfig()`, default platform limits, and the
  default lanes (incl. `evening-battle-card`).
- **paths.ts** — `paths` object + `ensureRuntimeDirs()`. All disk I/O resolves
  through here.
- **logger.ts** — `createLogger()` / `Logger`. Scoped, level-filtered, optional JSON.
- **util.ts** — `nowIso`, `contentHash`, `slugify`, `makeRunId`, `clamp01`,
  `truncate`, `jaccardSimilarity`, `Result`/`ok`/`err`.

## Filesystem layout

```
config/                committed static config (source lists, voice rules…)
data/
  post-log/            append-only history → duplicate detection
  source-health/       per-run source health snapshots
output/
  ready-to-post/       queue-mode markdown (default output)
  proof-images/        rendered proof images + sidecar metadata
logs/                  run logs
```

`ensureRuntimeDirs()` creates the writable `data/`, `output/`, and `logs/`
trees at run startup. `config/` is committed, not generated.

## Run modes

| Mode        | Network publish | Disk writes | Used by             |
| ----------- | --------------- | ----------- | ------------------- |
| `queue`     | no              | yes (md)    | default runs        |
| `live`      | yes (opt-in)    | yes (md+log)| explicit `--mode live` |
| `--dry-run` | no              | no          | tests, previews     |

## Error handling

- A stage that fails records a `StageResult` with `status: "failed"` and an
  `error` string; the orchestrator (t6) decides whether to continue or abort.
- A `block`-severity quality issue or a failed fact-check marks the platform's
  stage `blocked` and the item is **not** queued.
- Research source failures are non-fatal: they surface as `SourceHealth`
  entries with `status: "down"`/`"degraded"` plus `warnings`.

## Extensibility

- **New platform:** add to the `Platform` union (t1), add `PlatformLimits`
  defaults (t1), add an adapter implementing `Publisher` (t5).
- **New lane:** add a `LaneConfig` to `DEFAULT_LANES` (or load externally).
- **New source:** add a `SourceDefinition` to the source registry (t2).
