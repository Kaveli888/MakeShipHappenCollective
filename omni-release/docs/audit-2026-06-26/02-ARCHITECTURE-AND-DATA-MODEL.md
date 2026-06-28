# Target MVP Architecture & Data Model

## 1. The core architectural decision

A desktop app **cannot** be the whole product. OAuth client secrets, token exchange, refresh,
webhooks/callbacks, scheduled background publishing, and rate-limit coordination **must** live on a
server the user doesn't control. The Tauri client must never hold a client_secret or be the thing
that "wakes up at 9am to publish" (it may be closed/asleep).

**Recommended shape (cheapest path that actually works):**

```
┌────────────────────────────┐         ┌─────────────────────────────────────────────┐
│  Tauri desktop client      │  HTTPS  │  Backend API  (Supabase Edge Functions       │
│  (React UI, existing shell)│ ──────▶ │   or a small Node service on Fly/Render)      │
│  - media library UI        │  + JWT  │  - OAuth start/callback (holds client secrets)│
│  - composer                │         │  - token vault (encrypted, server-side)       │
│  - calendar                │         │  - publish job API + scheduled runner         │
│  - local cache (SQLite)    │         │  - per-platform publisher modules             │
│  - chunked media upload    │         │  - audit log, analytics fetchers              │
└────────────────────────────┘         └───────────────┬───────────────────┬──────────┘
                                                        │                   │
                                              ┌─────────▼──────┐   ┌────────▼─────────┐
                                              │ Postgres       │   │ Object storage   │
                                              │ (Supabase)     │   │ (Supabase Storage│
                                              │ RLS per user   │   │  or Cloudflare R2)│
                                              └────────────────┘   └──────────────────┘
                                                        ▲
                                              Cloudflare in front of the public API (DNS/WAF/TLS)
```

### Infrastructure recommendation (free / lowest-cost first)

| Concern | Recommendation | Why |
|---|---|---|
| Auth | **Supabase Auth** | Free tier, email/OAuth, JWT, RLS integration. |
| Database | **Supabase Postgres** | Free tier; relational model fits this domain; RLS = per-user isolation. |
| Object storage (video) | **Supabase Storage** (start) → **Cloudflare R2** (scale) | R2 has no egress fees — important for video. |
| Backend / OAuth / publishing | **Supabase Edge Functions** for OAuth callbacks + light API; a **small Node worker** (Fly.io/Render free tier) for the scheduled job runner & chunked uploads | Edge functions can't run long video uploads or cron reliably; a tiny always-on worker handles publishing jobs. |
| Token vault | Postgres table, encrypted with a server-only KMS key (Supabase Vault / libsodium) | Tokens never reach the client; encrypted at rest. |
| Job scheduling | Postgres-backed queue + worker poll (or `pg_cron` / Supabase Scheduled Functions) | No extra infra; idempotent, retryable. |
| Edge / protection | **Cloudflare** in front of the public API | DNS, WAF, rate limiting, TLS, DDoS — free tier. |
| Desktop local cache | **SQLite** (Tauri SQL plugin) | Offline media library + draft editing; syncs to server. |

> The Tauri app keeps its current role for the **local content engine** (research/quality/proof) and adds
> a thin sync client for the server. Local-only "draft" mode keeps working with no account.

## 2. Database model (Postgres)

> All user-owned tables carry `workspace_id` and are protected by RLS (a user only sees their workspace's rows).
> Tokens are **never** selectable by the client — only the service role / backend reads `platform_accounts.tokens_enc`.

```sql
-- Identity & tenancy ---------------------------------------------------------
users (
  id uuid pk, email text unique, created_at timestamptz, ...
)                                  -- maps to Supabase auth.users

workspaces (                       -- a creator/brand/agency container
  id uuid pk, owner_user_id uuid fk users, name text, plan text,
  created_at timestamptz
)

workspace_members (
  workspace_id uuid fk, user_id uuid fk, role text check (role in
    ('owner','admin','editor','viewer')), primary key (workspace_id,user_id)
)

-- Connected platform accounts (the token vault) -----------------------------
platform_accounts (
  id uuid pk, workspace_id uuid fk,
  platform text check (platform in
    ('youtube','tiktok','instagram','facebook','x','twitch')),
  external_account_id text,        -- channel/page/user id on the platform
  display_name text, avatar_url text,
  scopes text[],                   -- granted OAuth scopes
  tokens_enc bytea,                -- ENCRYPTED access+refresh tokens (server-only)
  token_expires_at timestamptz,
  status text check (status in ('connected','expired','revoked','error')),
  connected_at timestamptz, last_refreshed_at timestamptz,
  unique (workspace_id, platform, external_account_id)
)

-- Media library --------------------------------------------------------------
media_assets (
  id uuid pk, workspace_id uuid fk, uploaded_by uuid fk users,
  storage_key text,                -- object storage path
  filename text, mime_type text, byte_size bigint,
  duration_sec numeric, width int, height int, aspect_ratio text,
  thumbnail_key text,
  title text, description text, tags text[], campaign_id uuid, notes text,
  status text check (status in ('draft','ready','archived')),
  checksum text, created_at timestamptz
)

-- Composer: one master post, many platform targets --------------------------
posts (                            -- the "master" post (upload-once)
  id uuid pk, workspace_id uuid fk, created_by uuid fk users,
  media_asset_id uuid fk media_assets,
  master_caption text, link text, cta text, campaign_id uuid,
  status text check (status in
    ('draft','scheduled','publishing','published','partial','failed','archived')),
  created_at timestamptz, updated_at timestamptz
)

post_platform_targets (            -- per-platform customization of a post
  id uuid pk, post_id uuid fk posts, platform_account_id uuid fk platform_accounts,
  platform text,
  caption_override text, title_override text, hashtags text[],
  thumbnail_media_id uuid, privacy text,          -- e.g. public/unlisted/private
  options jsonb,                                   -- platform-specific (yt category, tiktok flags…)
  status text check (status in
    ('draft','scheduled','queued','publishing','published','failed','skipped')),
  external_post_id text, external_url text,        -- stored ONLY after platform confirms
  published_at timestamptz, failure_reason text
)

-- Calendar / scheduling ------------------------------------------------------
scheduled_jobs (
  id uuid pk, workspace_id uuid fk,
  post_platform_target_id uuid fk post_platform_targets,
  scheduled_for timestamptz, timezone text,        -- store UTC + original tz
  idempotency_key text unique,                      -- prevents double-publish
  status text check (status in
    ('pending','claimed','running','done','failed','canceled')),
  run_after timestamptz, attempts int default 0, max_attempts int default 5,
  locked_by text, locked_at timestamptz,            -- worker lease
  created_at timestamptz
)

publish_attempts (                 -- every attempt, success or fail (audit)
  id uuid pk, scheduled_job_id uuid fk, post_platform_target_id uuid fk,
  attempt_no int, mode text check (mode in ('live','dry_run','mock')),
  started_at timestamptz, finished_at timestamptz,
  outcome text check (outcome in ('success','failure','rate_limited','skipped')),
  external_post_id text, external_url text,
  request_summary jsonb, response_summary jsonb,    -- redacted, no tokens
  error_code text, error_message text
)

audit_logs (                       -- security/compliance: who did what
  id uuid pk, workspace_id uuid fk, actor_user_id uuid,
  action text,                      -- 'connect_account','publish','revoke','schedule'…
  target_type text, target_id uuid, metadata jsonb, ip inet, created_at timestamptz
)

-- Analytics (design now, fill later) ----------------------------------------
analytics_snapshots (
  id uuid pk, post_platform_target_id uuid fk,
  captured_at timestamptz,
  views bigint, likes bigint, comments bigint, shares bigint,
  watch_time_sec bigint, followers_delta bigint, raw jsonb
)

campaigns ( id uuid pk, workspace_id uuid fk, name text, color text, created_at timestamptz )
tags      ( id uuid pk, workspace_id uuid fk, name text, unique (workspace_id, name) )
```

### Invariants the schema enforces
- `external_url` / `external_post_id` are **only ever written from a confirmed platform response**
  (in `post_platform_targets` and `publish_attempts`). Never set on enqueue. → satisfies "no fake published states."
- `scheduled_jobs.idempotency_key` + the `locked_by`/`locked_at` lease → **no double-publish** on retry/crash.
- `platform_accounts.tokens_enc` is `bytea`, encrypted, RLS-blocked from client → **tokens never leave the server**.
- Every publish writes a `publish_attempts` row → **every attempt is logged**; `failure_reason`/`error_message`
  are human-readable → **every failure shows a reason**.

## 3. How the existing engine fits in
The current research→quality→proof pipeline becomes the **"AI assist"** layer of the Composer
(suggest captions/hashtags, fact-check, generate proof cards) — it is *not* the publishing path.
The new publisher modules replace the stubbed `src/publish/publishers.ts`, but keep its exact contract:
`canPublishLive()`, `publish()`, never-throw, ready-to-post fallback, mock mode.
