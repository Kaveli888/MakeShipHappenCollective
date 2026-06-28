# omni-release — Master Config

Human-facing control surface for the omni-release content pipeline. The runtime
config object lives in `src/core/config.ts` (owned by the project base, t1); this
document is the source of truth for the *content* knobs: which lanes exist, which
platforms each targets, the publish mode, and where the rule files live.

---

## What omni-release does

A daily pipeline that turns fresh AI news into on-brand, fact-checked, deduped
social posts for the Ship ecosystem, and drops them into a review queue.

```
research (t2) → write captions (t3) → format per platform (t3)
  → fact-check (t3) → quality gate (t3) → dedupe vs post log (t3)
  → proof image (t4) → publisher / queue (t5)        orchestrated by CLI (t6)
```

This file and the layers t3 owns (content / quality / memory) are the editorial
brain. Everything here is tuned to keep posts specific, sourced, and non-spammy.

---

## Publish mode

- **Default: `queue`** — nothing is posted automatically. Every approved post is
  written as a ready-to-post markdown package for human review.
- `dry-run` — full pipeline that still produces every artifact (proof image,
  captions, ready-to-post package, log entry) but never posts live; its log
  entries are flagged and excluded from duplicate detection.
- `live` — opt-in only, per-platform, requires configured publisher credentials
  or a browser session (see `publisher-routing.md`).

The content/quality/memory layers are **mode-agnostic**: they always produce and
gate content the same way. Mode only changes what the publisher (t5) does with an
approved post.

---

## Platforms

| Platform   | Key         | Hard char limit | Notes                                  |
|------------|-------------|-----------------|----------------------------------------|
| X          | `x`         | 280             | Threads when a lane needs them.        |
| LinkedIn   | `linkedin`  | 3000            | "So what for your team" angle.         |
| Facebook   | `facebook`  | 2000            | Conversational; assume less context.   |
| Browser    | `browser`   | 5000            | Manual/assisted paste (e.g. Threads).  |

Per-platform limits and hashtag caps are enforced in
`src/content/platformFormatting.ts` and `hashtag-rules.md`.

---

## Lanes

A **lane** is a recurring content format. Each lane has a prompt, a tone, target
platforms, and whether it wants a proof image. Defined in
`src/content/lanePrompts.ts`.

**Daily schedule (the three lanes runs are organized around):**

| Lane id               | Slot      | Purpose                                          | Platforms              | Proof image |
|-----------------------|-----------|--------------------------------------------------|------------------------|-------------|
| `ai-daily-shift`      | Morning   | Briefing on the overnight shift in AI.           | x, linkedin, facebook  | yes         |
| `model-watch`         | Afternoon | New models, weights, benchmark/leaderboard moves.| x, linkedin            | yes         |
| `evening-battle-card` | Evening   | Ranked end-of-day digest of the top AI news.     | x, linkedin            | yes         |

**Additional editorial lanes (available, not on the daily schedule):**

| Lane id               | Purpose                                              | Platforms                       | Proof image |
|-----------------------|------------------------------------------------------|---------------------------------|-------------|
| `proof-drop`          | Show a thing we shipped/measured, with evidence.     | x, linkedin                     | yes         |
| `hot-take`            | One opinionated, sourced take on a single item.      | x, linkedin                     | no          |
| `build-log`           | "Here's what we built today" running log.            | x, linkedin, facebook           | no          |
| `launch`              | Product/feature launch announcement.                 | x, linkedin, facebook, browser  | yes         |

The three daily lanes are registered in `src/core/config.ts` (`DEFAULT_LANES`);
editorial prompts for all lanes live in `src/content/lanePrompts.ts`.

---

## Rule files (single source of truth)

| File                 | Owns                                  | Consumed by                              |
|----------------------|---------------------------------------|------------------------------------------|
| `voice-rules.md`     | Brand voice, banned words, required elements | writer prompt + quality gate        |
| `blocked-phrases.md` | Hard-stop phrases & regex patterns    | quality gate (blocking)                  |
| `hashtag-rules.md`   | Per-platform hashtag caps & lists     | formatting + quality gate                |

Loaders: `src/content/rules.ts` and `src/quality/blockedPhrases.ts`.

---

## Quality gate policy (summary)

A post must pass ALL **blocking** rules to be queued. **Warning** rules lower the
quality score (0–100) but don't block. See `docs/CONTENT.md` for the full table.

- Blocking: over platform limit, contains a blocked phrase/pattern, no source on a
  news claim, unsupported factual claim, exact/near duplicate of a prior post.
- Warning: contains a banned word, over hashtag cap, weak hook, missing CTA,
  CTA repeats the previous post's CTA.

Default minimum score to queue: **70**.

---

## Memory / dedupe

- Post log: append-only JSONL ledger at `social-post-log.jsonl` (configurable).
- Dedupe: exact content-hash match OR Jaccard token similarity ≥ the configured
  threshold (`OMNI_DUPLICATE_THRESHOLD`, default **0.85**). Dry-run entries are
  excluded from dedupe.
- The log also tracks the last CTA per lane so the writer can rotate, plus the
  `topic` and whether it is `reusable` later.

---

## Where to change things

- Reword the brand → `voice-rules.md`.
- Add a forbidden phrase → `blocked-phrases.md`.
- Change hashtag caps → `hashtag-rules.md`.
- Add/edit a lane → `src/content/lanePrompts.ts`.
- Change platform limits → `PLATFORM_LIMITS` in `src/content/platformFormatting.ts`.
- Change dedupe threshold / score floor → pass options to the relevant functions
  (the CLI, t6, threads them through from `src/core/config.ts`).
