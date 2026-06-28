# Omni Release — Current-State Audit (2026-06-26)

> Auditor view: senior product architect / full-stack / API integration / security.
> Scope: the Tauri app at `omni-release/app` + the Node/TS engine at `omni-release/`.

## 1. What Omni Release actually is *today*

Omni Release is **not yet a social publishing/scheduling platform.** It is an
**autonomous AI-news → social-content *generation* pipeline** with a thin Tauri
desktop shell. The real product (a Metricool-style "upload once, customize,
schedule, publish, track") is a green-field build that sits *on top of* this
engine — most of it does not exist yet.

What exists and works:

| Layer | Tech | State |
|---|---|---|
| Desktop shell | Tauri v2, React 18 + Vite 5, TS strict | Works. 6 Rust commands, ~1 screen UI. |
| Engine | Node ≥20, TypeScript (NodeNext ESM), tsx/tsc, Vitest | Works. `tsc` clean, **5/5 tests pass**. |
| Pipeline | research → write → fact-check → quality-gate → proof-image → dedupe → queue/publish | Works in **queue/dry-run**. |
| Publish | adapter interface for `x`, `linkedin`, `facebook`, `browser` | **Stubbed** — no live API calls implemented. |
| Storage | flat files: `social-post-log.jsonl`, `ready-to-post/*.md`, `data/`, `logs/` | Works for single-user local. |

### Architecture (current)

```
React UI (App.tsx)  ──invoke──▶  Rust commands (lib.rs)  ──shell out (node)──▶  dist/cli/index.js (engine)
   src/api.ts                      engine_info / list_lanes                       research/write/quality/
   one screen                      run_lane / list_queue                          proof/publish/memory
   queue + log tabs                read_log / open_path                           → ready-to-post/*.md
                                                                                  → social-post-log.jsonl
```

The Rust layer is a **pure pass-through**: every command shells `node dist/cli/index.js <args> --json`
and returns stdout. Single source of truth = the engine. Clean separation, but it means the desktop
app has **no independent state, no DB, no background scheduler, no OAuth** — it can only do what the CLI does.

## 2. What already works (keep it)

- **Safe-by-default publishing posture.** `PublishMode` defaults to `queue`; live requires explicit opt-in.
  Adapters **never throw and never fake success** — when creds are missing or live isn't implemented they
  return `status: "failed"` with a human-readable reason and fall back to a `ready-to-post` package.
  Verified in code (`src/publish/publishers.ts`) and data (all 9 log entries are `status:queued`).
- **No hardcoded secrets.** All credentials are read from `OMNI_*` env vars only. Repo-wide grep found
  zero literal keys/tokens. `core/config.ts` is explicit: "no secrets live in source."
- **Honest audit trail.** `social-post-log.jsonl` records lane/platform/status/hashes/sources/dryRun per post.
- **Quality discipline.** Fact-check (claim→source token overlap), blocked-phrase + voice rules, dedupe
  (content hash + Jaccard similarity), per-platform char/hashtag limits. This is genuinely good content QA.
- **Strong typing & contracts.** `core/types.ts` is a single source of truth for the whole pipeline.
- **Minimal Tauri attack surface.** Capabilities = `core:default` only; no fs/shell/http plugins exposed to JS.

## 3. What is missing (the actual product)

Nothing below exists yet. This is the gap between "content generator" and "publishing command center":

1. **Video / media at all.** The entire engine is **text + a single proof image**. There is no video
   upload, no file storage, no thumbnail/duration/resolution/aspect handling, no media library.
   The target platforms (YT/TikTok/IG/FB/Twitch) are *video-first*. This is the single biggest gap.
2. **The target platforms.** Engine `Platform` type = `x | linkedin | facebook | browser`.
   **No YouTube, no TikTok, no Instagram, no Twitch.** And `browser`/`linkedin` aren't in the brief.
3. **OAuth.** None. Credentials are long-lived env vars pasted by hand. No authorize flow, no token
   exchange, no refresh, no per-account connection model, no scope/expiry tracking.
4. **A backend.** Everything is local CLI. OAuth client secrets, token exchange, and webhook/callback
   handling **cannot** live safely in a desktop client — there is no server to host them.
5. **A database.** Flat JSONL/markdown can't model users, workspaces, accounts, posts×platforms,
   schedules, attempts, analytics. No concurrency, no querying, no multi-user.
6. **Calendar scheduler.** No calendar UI, no schedule store, no timezone handling, no drag/drop/reschedule.
7. **A real job queue / runner.** "Queue" today = writing markdown files. No background scheduled runner,
   no retry/backoff, no idempotency keys, no rate-limit awareness, no partial-success handling.
8. **Composer.** No master-post-with-per-platform-overrides UI. The engine *generates* captions; it does
   not let a human author one post and tailor it per platform.
9. **Analytics.** No post-URL capture from a real publish, no metrics, no snapshots.
10. **Auth / accounts / subscriptions.** No user model, no login, no billing.

## 4. What is unsafe / not production-ready

> None of these are exploited today (single-user, nothing live), but each blocks real users.

| # | Issue | File / location | Risk | Fix |
|---|---|---|---|---|
| S1 | **CSP disabled** (`security.csp: null`) | `app/src-tauri/tauri.conf.json` | XSS / injected script can call any exposed Tauri command | Set a strict CSP before any remote content or webviews. |
| S2 | **`open_path` opens an arbitrary path** via `Command::new("open")` | `app/src-tauri/src/lib.rs` | A crafted path from engine output → opens arbitrary file/app | Validate path is inside the engine root / ready-to-post; whitelist extensions. |
| S3 | **Secrets are plaintext env vars**, long-lived, no rotation | engine env (`OMNI_X_*`, `OMNI_FACEBOOK_*`…) | Token theft = full account takeover; no expiry/refresh | Move to OS keychain now; move to **server-side token vault** for the real product. |
| S4 | **No token encryption at rest** | n/a (none stored yet) | Required before storing any OAuth token | Encrypt at rest (server KMS / OS keychain). |
| S5 | **Client secrets would leak if OAuth done in-app** | future | Desktop binaries are decompilable; a client_secret in the app is public | OAuth **must** use a backend for the token-exchange (`code → token`). PKCE in the app, secret on server. |
| S6 | **Divergent duplicate engine copy** at `~/omni-release` (src only, no dist/app, stale) | `~/omni-release/src/*` (note: uses different folder names: `queue/`, `publishers/linkedin.ts`, etc.) | Edits to the wrong copy silently do nothing | Delete or clearly archive `~/omni-release`. Canonical = `Documents/.../omni-release`. |
| S7 | **No dependency-audit gate** | both `package.json` | Supply-chain drift | Add `npm audit` + `cargo audit` to CI. |
| S8 | **Update mechanism unconfigured** | `tauri.conf.json` (no updater) | No signed-update path for shipping | Configure Tauri updater + code signing before distribution. |
| S9 | **`bundle.targets: "all"`** | `tauri.conf.json` | Builds mobile/all targets unintentionally | Scope to `["dmg","app"]` (or per-OS) for desktop-first. |

## 5. Verification (run at audit time)

```
cd "Documents/Ship Ecosystem/MakeShipHappenCollective/omni-release"
npm run typecheck   # ✅ clean (no errors)
npm test            # ✅ Test Files 1 passed | Tests 5 passed
grep -rniE 'api_key|secret|token|client_secret' src   # ✅ only OMNI_* env reads, no literals
```
Engine builds to `dist/cli/index.js` (present, dated 2026-06-26). App shells out to it successfully
(`.app-dev.log` shows a clean `tauri dev` boot on port 1430).
