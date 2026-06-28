# Omni Release — Backend (Phase 2)

The server side of Omni Release: **OAuth + encrypted token vault**, the **publishing
API/worker**, and the **Postgres schema** that the desktop app's local SQLite model
mirrors. Targets **Supabase** (Auth + Postgres + Storage) with **Edge Functions** for
OAuth, plus a worker for scheduled publishing.

> Why a server at all? OAuth **client secrets** and the **code→token exchange** must
> never live in the desktop binary (it's decompilable), and scheduled publishing must
> run when the app is closed. Those live here. The app only ever does PKCE + opens a URL.

## What's in this folder

```
supabase/migrations/   0001 schema · 0002 RLS · 0003 oauth_flows   (apply to Supabase)
supabase/functions/    oauth-start, oauth-callback (Deno edge handlers)
src/core/              security core — token crypto, PKCE, OAuth builders, providers (TESTED)
scripts/sync-shared.mjs  copies src/core → functions/_shared/core for Deno (rewrites .js→.ts)
.env.example           all secrets (server-only)
```

## Status

- ✅ Postgres schema + RLS + token-safe view (`platform_accounts_safe`)
- ✅ Security core: AES-256-GCM token vault, PKCE/S256, CSRF state, OAuth URL/exchange builders
- ✅ **YouTube publisher** (`src/core/youtube.ts`) — resumable upload + thumbnail, injectable fetch
- ✅ **Publishing worker** (`src/worker/`) — claim due jobs → **refresh token if near expiry** → decrypt from vault → publish → confirmed URL / honest failure + retry/backoff; pure runner is store-agnostic with a Supabase impl
- ✅ **Token refresh** (`src/core/refresh.ts`) — just-in-time, re-encrypts + persists
- ✅ **20 unit tests passing** (`npm test`) — token vault, PKCE, OAuth shapes, YouTube resumable flow, worker success/no-account/retry, **token refresh**
- ✅ Provider registry — **YouTube verified**; Meta/TikTok/X/Twitch present but `verified:false` (re-check at their sprint)
- ✅ **Desktop app wired** — Supabase Auth, Connect-YouTube, media→Storage upload, and "Schedule live (cloud)" that creates the cloud rows the worker consumes
- ◻️ Edge Functions + Supabase worker store are reference impls — **deploy + live verify requires a Supabase project** (your step)

## The end-to-end live path (code-complete; runs after your setup)
App "Schedule live (cloud)" → uploads media to Storage + inserts `media_assets`/`posts`/
`post_platform_targets`/`scheduled_jobs` (pending) → **worker** claims the job → refreshes/decrypts
the connected account's token → uploads to YouTube → writes the confirmed `external_url` +
`publish_attempts`. Connect the account first via the Platforms tab (`oauth-start` Edge Function).

## One-time setup (your steps — needs your accounts)

1. **Create a Supabase project** (free tier). Note the project ref, URL, anon key, service-role key.
2. `cp .env.example .env` and fill `SUPABASE_*`.
3. **Generate the token-vault key:** `npm install && npm run keygen` → put the value in `TOKEN_ENC_KEY`.
   Back it up securely; rotating it invalidates all stored tokens.
4. **Apply the schema:** `supabase link --project-ref <ref>` then `npm run db:push`
   (or paste the three files in `supabase/migrations/` into the SQL editor in order).
5. **YouTube (Phase 2):** create a Google Cloud project → enable *YouTube Data API v3* +
   *YouTube Analytics API* → create an **OAuth 2.0 Web** client → set the authorized redirect URI to
   your `OAUTH_REDIRECT_URI` (`https://<ref>.functions.supabase.co/oauth-callback`) → put the
   client id/secret in `.env` (`GOOGLE_CLIENT_ID/SECRET`). Request a quota increase early.
6. **Set function secrets + deploy:**
   `supabase secrets set --env-file .env` then `npm run fn:deploy`.

## Verify locally (no cloud needed)

```
cd server
npm install          # or use the repo's toolchain
npm run typecheck    # production core type-checks
npm test             # 9 security-core tests pass
```

## Security guarantees baked in

- Client secrets only in env on the server; **never** in the app or DB.
- PKCE (S256) on every provider that supports it; CSRF `state` validated and one-time-use.
- Tokens **encrypted at rest** (AES-256-GCM) with a server-only key; ciphertext is authenticated
  (tampering → decryption fails).
- RLS on every user table; clients read `platform_accounts_safe` (no `tokens_enc` column exposed);
  only the **service role** (Edge Functions/worker) reads raw tokens.
- `external_url` is only written from a confirmed provider response (carried over from the app's rules).

## Next (Phase 2 remaining)

1. Publishing worker: claim due `scheduled_jobs`, decrypt tokens, call the real provider (YouTube first),
   write `publish_attempts` + confirmed `external_url`. (Mirror the Rust mock spine in `app/src-tauri`.)
2. REST/CRUD or direct Supabase-client access from the app (RLS-protected) + Storage upload for media.
3. Desktop app: add Supabase Auth + "Connect YouTube" calling `oauth-start`, then sync from `platform_accounts_safe`.
4. Token refresh job using `buildRefresh()` before expiry.
