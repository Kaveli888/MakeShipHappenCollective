# HANDOFF — Omni Release (publishing platform)

> Updated 2026-06-27. This supersedes the old t1 "content-generator foundation"
> handoff. Omni Release is now a cross-platform video publishing/scheduling app
> (Metricool-style), not just an AI-news caption generator.

## What it is

- **Desktop app** (`app/`): Tauri v2 + React 18/Vite. Local-first SQLite spine
  with Library / Composer / Calendar / Platforms / Activity views. Optional
  Supabase cloud wiring (auth + connected accounts + scheduled live publishing).
  Dev: `cd app && npm run app` (Vite on **1430**).
- **Backend** (`server/`): Supabase target. OAuth token vault (AES-256-GCM),
  PKCE OAuth, platform publishers, and a background **worker** that claims due
  jobs → decrypts the vault token → publishes → records a confirmed URL or an
  honest failure with retry/backoff. Run: `cd server && npm run worker`.
- **Safe by default:** never fakes "published"; no secrets in source (all env).

## Infra (provisioned 2026-06-26)

- Supabase project **"Omni Release"** `jnrzudhwllozhemucfxr` — all 4 migrations
  pushed, Edge Functions `oauth-start`/`oauth-callback` deployed + verified live.
- Google Cloud project — YouTube Data API enabled, OAuth client + redirect
  configured, test user added. `server/.env` + `app/.env` present (gitignored).
- DB password stored in `~/Private_Secure_Codes/omni-release-supabase-db-password.txt`.

## Publisher status (server/src/core/)

| Platform  | Module        | State |
| --------- | ------------- | ----- |
| YouTube   | `youtube.ts`  | ✅ Live + verified. Resumable upload + thumbnail. |
| X/Twitter | `x.ts`        | 🟡 Code-complete + unit-tested. Chunked INIT/APPEND/FINALIZE + create post. **Needs an X dev app** (`X_CLIENT_ID/SECRET`). |
| TikTok    | `tiktok.ts`   | 🟡 Code-complete + unit-tested. Content Posting API (init→upload→poll). **Needs a TikTok app** (`TIKTOK_CLIENT_KEY/SECRET`); unaudited apps are SELF_ONLY. |
| Facebook  | `meta.ts`     | 🟡 Code-complete + unit-tested. Resumable Page video upload. **Needs a Meta app** (`META_APP_ID/SECRET`) + Page token + `pageId`. |
| Instagram | `meta.ts`     | 🟡 Code-complete + unit-tested. Reels via **public media URL** (Graph pulls it) → needs `igUserId` + a public/signed Storage URL. |
| Twitch    | (router)      | ⛔ No video-upload API exists; router fails honestly with `unsupported_platform`. |

Providers in `providers.ts` carry `verified: false` for everything except
YouTube — flip to `true` only after testing each against its real app.

Verify the backend offline: `cd server && npm run typecheck && npm test`
(31 tests pass as of this handoff).

## What's left

1. **Go-live smoke test (needs a human):** worker is running; app has **no**
   Supabase user/workspace yet and **no** connected YouTube account (all backend
   tables are empty). Sign in to the app → **Connect YouTube** (OAuth Allow) →
   schedule a (private) post → confirm the worker uploads and returns a URL.
   This is the one untested end-to-end seam.
2. **Activate the other platforms:** register a developer app per platform,
   drop its client id/secret into `server/.env` + the Edge Function secrets,
   set the provider `verified: true`, and run a private test publish.
   For Facebook/Instagram the account must also store `pageId`/`igUserId`, and
   IG needs the media reachable at a public URL.
