# Sprint 1 — Foundation: what was built (2026-06-26)

**Approach decision:** built **local-first** with an embedded SQLite DB in Rust.
The schema and the Tauri command surface deliberately mirror the target Postgres
model + future REST API, so the later Supabase/server migration is additive (a
transport swap), not a rewrite. Zero external credentials, fully offline, free.
No OAuth secrets exist yet → nothing can leak. Live publishing is deliberately
impossible (fails honestly) until the backend + token vault arrive.

## Architecture added

```
React views (Library/Composer/Calendar/Platforms/Activity)
        │ invoke(typed commands)            src/api.ts ── src/types.ts ── src/util.ts
        ▼
Rust command surface (src-tauri/src/commands.rs)  ← 1:1 with future REST endpoints
        │
        ├── db.rs      embedded SQLite (WAL), schema mirrors Postgres, typed queries only
        ├── publish.rs capability matrix + MOCK publisher (honesty rules enforced)
        ├── models.rs  serde structs (== TS types)
        └── scheduler.rs  background tokio runner: claim → publish(mock) → done/retry
```

## Deliverable checklist (Sprint 1 task list from doc 04)

| # | Task | Status |
|---|---|---|
| 1 | Repo hygiene & safety | ✅ (Phase 0, prior) |
| 2 | DB + schema (8 tables, RLS-ready shape) | ✅ local SQLite mirror |
| 3 | Auth / workspace | ◑ single local workspace (`ws_local`); server auth deferred to Phase 2 |
| 4 | Media upload pipeline (ffmpeg) | ✅ import, copy, ffprobe (duration/res/aspect), thumbnail, validation |
| 5 | Media Library UI | ✅ grid + detail drawer + metadata edit + archive |
| 6 | Composer v1 (master + per-platform overrides) | ✅ + capability-aware field gating |
| 7 | Calendar v1 (month grid, filters, reschedule/cancel/retry, tz) | ✅ |
| 8 | Publisher contract + MOCK (end-to-end, no network) | ✅ |
| 9 | Audit log + publish_attempts plumbing | ✅ every state transition + failure reason |
| — | Platform capability matrix in-app | ✅ Platforms view + descriptors drive the UI |

## Honesty guarantees (enforced in code, tested)

- `mode=mock` → success with a **clearly-fake** `mock://…` URL.
- `mode=dry_run` → no state change, preview only.
- `mode=live` → **always fails** with a human-readable reason (no account/integration).
- `published` is only set on a confirmed (mock) success; failures store a reason, never a URL.
- Idempotency key per (target, slot) + worker lease → no double-publish.
- Retry/backoff with capped attempts; exhaustion → `failed`.

## Verification (all green)

```
src-tauri$ cargo check         # clean, 0 warnings
src-tauri$ cargo test --lib    # 4 passed: end-to-end mock, live-honesty, retry-exhaust, idempotency
app$       npx tsc --noEmit    # exit 0
app$       npm run build        # vite build ok (40 modules)
app$       npm run app          # boots clean; creates omni.db with 8 tables + ws_local; scheduler runs; no panic
```

DB confirmed at `~/Library/Application Support/tech.makeshiphappen.omnirelease/omni.db`
(WAL mode; tables: workspaces, campaigns, media_assets, posts, post_platform_targets,
scheduled_jobs, publish_attempts, audit_logs).

## Exit criteria — met

A user can: import a video → it appears in the library with extracted metadata →
"Compose" creates a post → enable platform targets with per-platform caption/title/
hashtags/privacy → schedule on the calendar → the background scheduler picks the job
up → the **mock** publisher marks it `published` with a `mock://` URL → the calendar,
composer, and Activity (attempts + audit) all reflect it. No real platform is
connected; live mode fails honestly.

## Not in Sprint 1 (next, per roadmap)

- Server backend (Supabase Auth/Postgres-RLS/Storage) + Cloudflare → real multi-user auth & sync.
- OAuth (PKCE in app / secret + encrypted token vault on server).
- Phase 2: YouTube as the first real publisher (swap mock route for live in `scheduler.rs`/`publish.rs`).
- Drag-and-drop calendar (currently click-to-reschedule), best-time suggestions, analytics fetchers.
