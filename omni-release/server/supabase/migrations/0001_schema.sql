-- Omni Release — Phase 2 backend schema (Postgres / Supabase).
-- Mirrors the local SQLite model (app/src-tauri/src/db.rs) so the desktop app's
-- command shapes map 1:1 onto these tables. Identity comes from Supabase
-- `auth.users`. RLS policies live in 0002_rls.sql.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ── tenancy ────────────────────────────────────────────────────────────────
create table if not exists workspaces (
  id           uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  plan         text not null default 'free',
  created_at   timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'editor'
                 check (role in ('owner','admin','editor','viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ── connected accounts (token vault) ────────────────────────────────────────
-- tokens_enc holds AES-256-GCM ciphertext (see src/core/crypto.ts). The
-- encryption key NEVER lives in the DB — it is a server-only env secret. RLS
-- additionally blocks clients from selecting tokens_enc (0002_rls.sql).
create table if not exists platform_accounts (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  platform            text not null
                        check (platform in ('youtube','tiktok','instagram','facebook','x','twitch')),
  external_account_id text,
  display_name        text,
  avatar_url          text,
  scopes              text[] not null default '{}',
  tokens_enc          text,            -- encrypted; server-only
  token_expires_at    timestamptz,
  status              text not null default 'connected'
                        check (status in ('connected','expired','revoked','error')),
  connected_at        timestamptz not null default now(),
  last_refreshed_at   timestamptz,
  unique (workspace_id, platform, external_account_id)
);

-- ── media library ───────────────────────────────────────────────────────────
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null, color text, created_at timestamptz not null default now()
);

create table if not exists media_assets (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  uploaded_by  uuid references auth.users(id),
  storage_key  text not null,          -- object-storage path (Supabase Storage / R2)
  filename     text not null,
  mime_type    text not null,
  byte_size    bigint not null,
  duration_sec numeric,
  width        int,
  height       int,
  aspect_ratio text,
  thumbnail_key text,
  title        text,
  description  text,
  tags         text[] not null default '{}',
  campaign_id  uuid references campaigns(id) on delete set null,
  notes        text,
  status       text not null default 'ready'
                 check (status in ('draft','ready','archived')),
  checksum     text,
  created_at   timestamptz not null default now()
);

-- ── composer ────────────────────────────────────────────────────────────────
create table if not exists posts (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  created_by     uuid references auth.users(id),
  media_asset_id uuid references media_assets(id) on delete set null,
  master_caption text, link text, cta text,
  campaign_id    uuid references campaigns(id) on delete set null,
  status         text not null default 'draft'
                   check (status in ('draft','scheduled','publishing','published','partial','failed','archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists post_platform_targets (
  id                 uuid primary key default gen_random_uuid(),
  post_id            uuid not null references posts(id) on delete cascade,
  platform_account_id uuid references platform_accounts(id) on delete set null,
  platform           text not null,
  caption_override   text, title_override text,
  hashtags           text[] not null default '{}',
  thumbnail_media_id uuid references media_assets(id) on delete set null,
  privacy            text,
  options            jsonb not null default '{}'::jsonb,
  status             text not null default 'draft'
                       check (status in ('draft','scheduled','queued','publishing','published','failed','skipped')),
  external_post_id   text,
  external_url       text,            -- set ONLY on confirmed platform response
  published_at       timestamptz,
  failure_reason     text,
  unique (post_id, platform)
);

-- ── scheduling / jobs ───────────────────────────────────────────────────────
create table if not exists scheduled_jobs (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references workspaces(id) on delete cascade,
  post_platform_target_id uuid not null references post_platform_targets(id) on delete cascade,
  scheduled_for           timestamptz not null,
  timezone                text not null default 'UTC',
  idempotency_key         text not null unique,   -- prevents double-publish
  status                  text not null default 'pending'
                            check (status in ('pending','claimed','running','done','failed','canceled')),
  run_after               timestamptz not null,
  attempts                int not null default 0,
  max_attempts            int not null default 5,
  locked_by               text,
  locked_at               timestamptz,
  created_at              timestamptz not null default now()
);

create table if not exists publish_attempts (
  id                      uuid primary key default gen_random_uuid(),
  scheduled_job_id        uuid references scheduled_jobs(id) on delete set null,
  post_platform_target_id uuid not null references post_platform_targets(id) on delete cascade,
  attempt_no              int not null,
  mode                    text not null check (mode in ('live','dry_run','mock')),
  started_at              timestamptz not null default now(),
  finished_at             timestamptz,
  outcome                 text check (outcome in ('success','failure','rate_limited','skipped')),
  external_post_id        text,
  external_url            text,
  response_summary        jsonb not null default '{}'::jsonb,  -- redacted; no tokens
  error_code              text,
  error_message           text
);

create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  actor        text not null default 'system',
  action       text not null,
  target_type  text, target_id uuid,
  metadata     jsonb not null default '{}'::jsonb,
  ip           inet,
  created_at   timestamptz not null default now()
);

create table if not exists analytics_snapshots (
  id                      uuid primary key default gen_random_uuid(),
  post_platform_target_id uuid not null references post_platform_targets(id) on delete cascade,
  captured_at             timestamptz not null default now(),
  views bigint, likes bigint, comments bigint, shares bigint,
  watch_time_sec bigint, followers_delta bigint,
  raw jsonb not null default '{}'::jsonb
);

-- ── indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_jobs_due       on scheduled_jobs(status, run_after);
create index if not exists idx_targets_post   on post_platform_targets(post_id);
create index if not exists idx_attempts_target on publish_attempts(post_platform_target_id);
create index if not exists idx_media_ws        on media_assets(workspace_id);
create index if not exists idx_posts_ws        on posts(workspace_id);

-- keep posts.updated_at fresh
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_posts_touch on posts;
create trigger trg_posts_touch before update on posts
  for each row execute function touch_updated_at();
