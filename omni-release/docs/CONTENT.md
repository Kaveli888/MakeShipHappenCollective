# CONTENT — Writing, Fact-Check, Quality & Memory (t3)

This document covers the editorial brain of omni-release: how captions are
written, how facts are checked, the rules the quality gate enforces, and how the
memory layer prevents repeats. It's the reference for anyone wiring these layers
into the pipeline (t6) or tuning the rule files.

Owned modules:

```
src/content/   lanePrompts · writeCaptions · platformFormatting · rules (loaders)
src/quality/   factCheck · qualityGate · blockedPhrases (loader)
src/memory/    postLog · duplicateCheck
config files   voice-rules.md · blocked-phrases.md · hashtag-rules.md · omni-release.config.md
```

---

## Pipeline position

```
ResearchResult (t2)
      │
      ▼
 writeCaptions ──► CaptionDraft[]          (one per platform)
      │
      ▼
 formatForPlatform ──► PlatformPost[]      (clamped to platform limits)
      │
      ├──► factCheck ──► FactCheckReport
      ├──► checkDuplicate ──► DuplicateResult
      ▼
 runQualityGate ──► QualityReport          (pass/fail + score + violations)
      │
      ▼  (if passed)
 logPost ──► PostRecord                    (appended to state/post-log.jsonl)
      │
      ▼
 proof image (t4) · publisher/queue (t5)   orchestrated by the CLI (t6)
```

Everything in t3 is **mode-agnostic**: it produces and gates content the same way
in `queue`, `dry-run`, or `live` mode. Only the publisher (t5) acts on the result.

---

## 1. Writing — `writeCaptions`

`writeCaptions(research, options)` → `CaptionDraft[]` (one per target platform).

- **Lane-driven**: the lane id (from `research.lane` or `options.lane`) selects a
  `LanePrompt` from `src/content/lanePrompts.ts` — its tone, target platforms,
  structural beats, CTA, and whether it wants a proof image.
- **Two modes**:
  - *Deterministic* (default): a template composer builds the caption from the
    research items, following the lane's `structure`. No API key needed — this is
    what the dry-run integration (t6) exercises.
  - *LLM*: pass `options.complete` (any `async ({system, prompt}) => string`). The
    lane's system + user prompt are sent, and the reply is parsed into hook/body/
    hashtags. The injected voice rules + research are the only allowed facts.

### Caption requirements

Every `CaptionDraft` MUST satisfy:

| Field           | Requirement                                                        |
|-----------------|--------------------------------------------------------------------|
| `hook`          | Non-empty first line, ideally < 120 chars, no opening rhetorical `?`. |
| `body`          | Follows the lane's structural beats; facts only from research.      |
| `sources`       | ≥ 1 source URL for any news claim (carried from research items).    |
| `sourceItemIds` | Ids of the research items used (provenance for fact-check + dedupe).|
| `claims`        | The factual assertions the post makes (item claims, or item titles).|
| `hashtags`      | Seeded from research tags + the platform's `core` tags.             |
| `cta`           | The lane CTA (rotated against the post log to avoid repeats).       |

Voice requirements (from `voice-rules.md`, enforced later by the gate): specific
over hype, ≤ 1 exclamation point, 0–2 emoji, no banned words, no blocked phrases.

---

## 2. Formatting — `formatForPlatform`

`formatForPlatform(draft, options)` → `PlatformPost`.

- Assembles text in a fixed order: **hook → body → CTA → source → hashtags**
  (CTA/source are skipped if already present in the draft).
- Enforces the hard character limit by truncating **only the body**, at a word
  boundary, with an ellipsis; sets `truncated: true` when it does.
- Applies `hashtag-rules.md`: strips `avoid` tags, dedupes, caps to the platform
  `max`.

Platform limits (`PLATFORM_LIMITS`):

| Platform   | Hard limit |
|------------|-----------|
| x          | 280       |
| linkedin   | 3000      |
| facebook   | 63206     |
| instagram  | 2200      |

---

## 3. Fact-check — `factCheck`

`factCheck(post, research, options)` → `FactCheckReport` (synchronous, no LLM).

- **Claim support**: each claim is matched against research items by token overlap
  (default ≥ 0.5) or near-literal substring. Below threshold → `unsupported`.
- **Figure sourcing**: every statistic in the rendered text — percentages,
  currency, 4-digit years, magnitudes (`10x`, `5k`, `2m`), and 3+ digit numbers —
  must appear in some source. Unmatched figures land in `unsupportedFigures`.
  (Small list-rank integers like `1.` / `2.` are intentionally ignored.)
- `ok` is true only when **all** claims are supported and there are **no**
  unsourced figures. The gate treats `ok === false` as blocking.

This is the highest-value check: it catches a number or fact in the post that no
source backs — the failure mode most likely to embarrass us.

---

## 4. Quality gate — `runQualityGate`

`runQualityGate(post, ctx)` → `QualityReport { passed, score, violations[] }`.

A post **passes** only when it has **zero error-severity violations** AND
`score ≥ minScore` (default **70**). Score = `100 − 25·errors − 8·warnings`,
clamped to `[0, 100]`.

### Rules

| Rule id            | Severity | Source / condition                                            |
|--------------------|----------|---------------------------------------------------------------|
| `over-limit`       | error    | `charCount` exceeds the platform limit.                       |
| `blocked-phrase`   | error    | Matches a phrase/pattern in `blocked-phrases.md`.             |
| `missing-source`   | error    | `requireSource` (default true) and no source URL.            |
| `unsupported-claim`| error    | Fact-check found an unsupported claim.                        |
| `unsourced-figure` | error    | Fact-check found a figure no source backs.                   |
| `duplicate`        | error    | Duplicate-check flagged a near/exact prior post.             |
| `banned-word`      | warning  | Uses a hype word from `voice-rules.md` (one per match).      |
| `weak-hook`        | warning  | Hook empty, > 120 chars, or ends in `?`.                     |
| `truncated`        | warning  | Body was truncated to fit.                                    |
| `low-specificity`  | warning  | No number or proper noun (per `required: specificity`).      |
| `over-punctuation` | warning  | More than one `!`.                                            |

Fact-check and duplicate results are **passed in** via `ctx` so the gate stays a
pure decision over already-gathered evidence (the CLI/orchestrator, t6, runs
`factCheck` and `checkDuplicate` first, then hands their reports to the gate).

---

## 5. Memory — `postLog` & `duplicateCheck`

- **`postLog`** — append-only JSONL ledger at `state/post-log.jsonl` (override via
  `logPath`/`dataDir`). `logPost(post, extras, options)` builds a `PostRecord`
  (with a `contentHash`) and appends it. `readPostLog` tolerates corrupt lines.
  `lastCtaForLane` powers CTA rotation.
- **`duplicateCheck`** — `checkDuplicate(post, options)` compares against the log:
  exact `contentHash` match → certain duplicate; else max Jaccard token overlap;
  `≥ threshold` (default **0.82**) → near-duplicate. Normalization drops URLs,
  hashtags, punctuation, and casing so reworded reposts are still caught.

---

## Integration contract (for peers)

These layers are written to be **self-contained and independently type-checkable**.
The only external dependency is the shared data contract:

- `Platform`, `LaneId`, `ResearchItem`, `ResearchResult` are declared in
  `src/content/types.ts` as the agreed shapes. The project base (t1) is expected
  to own canonical versions in `src/core/types.ts`. **At integration**, either:
  1. t1 re-exports the same shapes from `src/core/types.ts`, and t3's imports of
     `./types.js` are repointed to `../core/types.js`; **or**
  2. `src/core/types.ts` simply `export * from "../content/types.js"` for these.

  The field names/shapes above are the contract — keep them stable.

- **Research (t2)** must return `ResearchResult` with `items: ResearchItem[]`. For
  best fact-check accuracy, populate `ResearchItem.claims` and `tags`.

- **Orchestrator (t6)** call order per lane:
  `writeCaptions → formatForPlatform → factCheck + checkDuplicate → runQualityGate
  → (if passed) logPost`. Pass the `FactCheckReport` and `DuplicateResult` into
  `runQualityGate` via `ctx`. For dry-runs, omit `options.complete` to use the
  deterministic writer (no API key needed). Mocks can satisfy the small input
  interfaces (`FactCheckInput`, `DuplicateCheckInput`) — both are just
  `{ text, claims? }`-shaped.

- **Publisher (t5)** consumes `PlatformPost` (text + hashtags + sources + the
  `wantsProofImage` flag) and, after publishing, can update the `PostRecord`
  (`status`, `url`, `postedAt`).

- **Proof images (t4)**: lanes with `wantsProofImage: true` (battle-card,
  proof-drop, launch) expect an image; `PlatformPost.wantsProofImage` carries the
  flag downstream.

### Default knobs (override via options/`src/core/config.ts`)

| Setting              | Default | Where                                  |
|----------------------|---------|----------------------------------------|
| Quality min score    | 70      | `runQualityGate` `ctx.minScore`        |
| Duplicate threshold  | 0.82    | `checkDuplicate` `options.threshold`   |
| Claim support thresh | 0.5     | `factCheck` `options.supportThreshold` |
| Require source       | true    | `runQualityGate` `ctx.requireSource`   |
| Post log path        | `state/post-log.jsonl` | `PostLogOptions`        |
