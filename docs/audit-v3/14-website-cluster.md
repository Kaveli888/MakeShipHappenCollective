# Per-Product Cluster Audit — makeshiphappen.tech Website

**Product:** makeshiphappen.tech (Next.js 16 App Router web app; source tree `makeshiphappenAi/`)
**Audit type:** READ-ONLY risk / inventory / governance review
**Audit date:** 2026-06-07
**Auditor role:** Senior security auditor + SaaS/privacy/technology attorney + compliance officer
**Scope:** This is the single deep reference document for the makeshiphappen.tech website only. It covers full inventory, data flows, security posture (with severity ratings), privacy & retention posture, integrations & AI providers, licenses, liability hotspots, and user-responsibility assignment.

> **Standing caveat on live state.** Production ships via `vercel --prod` from the local working tree (and a separate nested deploy repo `git@github.com:Kaveli888/makeshiphappentech.git`), **not** `git push`. Auditing the repo therefore does **not** guarantee the deployed artifact matches what was reviewed. Several findings below (owner bypass safety, applied migrations, populated env var names) cannot be fully verified from code and require operator confirmation against the live Vercel + Supabase projects.

---

## 1. Executive Summary

makeshiphappen.tech is the marketing-plus-commerce front door for the Ship Ecosystem. It handles account signup/login, Stripe subscription billing (Pro / Team) and Printful merch sales, gated installer downloads and auto-update feeds for the desktop apps, a server-proxied multi-provider AI chat, team seat management, and a comp-access admin tool.

The **security posture is notably strong and shows evidence of prior hardening**: no secrets are hardcoded or committed (tracked files and full git history contain only placeholders; all `.env*` are gitignored), the Supabase service-role key is gated behind authenticated helpers, RLS migrations revoke billing-column writes and harden the `get_effective_tier` RPC against cross-user probing, the Stripe webhook verifies signatures and is idempotent via a dedupe table, the chat proxies hold provider keys server-side with strict Zod-validated model/token caps, merch pricing is fetched authoritatively server-side, and a strong CSP / security-header set is applied.

The **highest real risks are governance and a single auth-handoff flaw**, not exposure. The CLI login flow (`/auth/cli-login`) POSTs live, long-lived Supabase access **and refresh** tokens to an unvalidated `localhost:<port>` taken from the URL query string — a session-theft / account-takeover path (High). The hardcoded `OWNER_EMAILS` bypass is correctly gated on `email_confirmed_at` but its safety depends entirely on Supabase email-confirmation being ON in production, which is unverifiable from code (High). The privacy/subprocessor disclosures are **both over- and under-inclusive** (list Sentry/Groq/OpenRouter/Ollama that are not in the code; omit DeepSeek, a China-based provider that receives user prompts) — a GDPR transparency and international-transfer gap. There is **no automated data retention or deletion logic anywhere** in the codebase despite a privacy policy promising erasure/export rights. Finally, a co-located ShipMind desktop app statically links and ships a **GPLv2+ ffmpeg** inside a paid closed-source binary — a Critical copyleft conflict tracked here because the same package.json / repo couples the website and desktop products.

---

## 2. Full Inventory

### 2.1 Components

| Area | Components |
|---|---|
| Marketing | App Router pages: `app/page.tsx`, `products/*`, `pricing`, `company/*`, `community/*`, `security`, `privacy`, `terms`, legal policy pages via `components/legal/PolicyPage.tsx` |
| Auth | signup/login pages, `/auth/callback` (OAuth code exchange), `/auth/app-login`, `/auth/cli-login` (relays Supabase session to localhost CLI), `/api/auth/verify` (Bearer token → tier) |
| Billing | `/api/stripe/checkout` (subscriptions), `/api/stripe/merch-checkout` (Printful merch), `/api/stripe/status`, `/api/stripe/webhook` (tier sync + Printful fulfillment + refund revoke) |
| Downloads | `/api/install/{shipmind,shipspace,shiptalk}` + `/download` routes; 5-min signed private-bucket DMG URLs |
| Auto-update | `/api/updates/{shipmind,shipspace,shiptalk}/[channel]/latest` (electron-updater feeds) |
| AI chat proxy | `/api/chat/{anthropic,openai,google,deepseek}` gated by `lib/api/chat-gate.ts` + rate limits + usage logging |
| Teams | `/api/teams/{invite,remove,leave,members,me}` — seat-limited, email-confirmation-gated activation |
| Merch | `/api/printful/products`, `/api/printful/order`, `lib/printful/order.ts`, `shop/CartContext` + `CartDrawer` |
| Entitlements | `lib/auth/subscription.ts`, `lib/auth/owner.ts` (hardcoded owner bypass), `get_effective_tier` RPC |
| Rate limiting | `lib/api/rate-limit.ts` (DB-backed atomic RPCs), `lib/api/ip-rate-limit.ts` (in-memory) |
| Admin | `scripts/comp-access.mjs` (grant/revoke tier via service-role; NO auto-expiry) |
| Schema | Supabase migrations 001–012 |
| Paywall UI | `LibraryGate` client-side gate for `/libraries` (agents/prompts/skills) |
| Co-located (not deployed to web) | ShipSpace Electron app (`electron/main.js`, `electron/preload.js`), e2b sandbox, xterm, zustand stores |

### 2.2 Data Categories Processed

Emails · Passwords (held by Supabase Auth only) · JWT session tokens · Stripe customer/subscription IDs + status · Subscription tier · Shipping name + full postal address (merch) · AI chat message content + selected model · Team membership emails/roles/status · Client IP addresses · Usage / rate-limit counters.

### 2.3 Storage Locations

| Store | Holds |
|---|---|
| Supabase Postgres | profiles, subscriptions, subscribers, teams, team_members, usage_events, ip_rate_events, processed_stripe_events, plus dormant curriculum/labs tables |
| Supabase Auth | `auth.users` — credentials, `email_confirmed_at` |
| Supabase Storage (private `releases` bucket) | App DMGs + version manifests, served only via 5-min signed URLs |
| Stripe (account "ZZ GEMZ") | Customers, subscriptions, checkout sessions, payment + shipping data |
| Printful | Merch orders + fulfillment (name + shipping address + email) |
| Vercel env | All secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_*, SUPABASE_SERVICE_ROLE_KEY, provider API keys) |
| Local untracked | `.env.local`, `.env.production.local`, `.vercel/.env.development.local` (present on disk, gitignored) |
| In-memory per-instance | `ip-rate-limit` maps (non-shared across Vercel instances) |

### 2.4 User-Facing vs Internal

- **User-facing:** marketing/product/pricing/company/community/docs/legal pages; signup/login/cli-login/app-login; Pro ($50) / Team-aka-Ultra ($500) checkout; shop/cart/merch checkout; members-only Libraries behind `LibraryGate`; gated app downloads + one-line curl installers; auth-gated AI chat; account page with install token + team management.
- **Internal:** Stripe webhook handler; `comp-access.mjs` grant/revoke CLI (service-role); auto-updater manifest endpoints; `get_effective_tier` / `reserve_chat_request` / `reserve_ip_request` RPCs; usage logging; Supabase migrations; brand strategy docs.

---

## 3. Data Flows

| Data | Origin | Path | Resting store(s) | External transmission | Retention |
|---|---|---|---|---|---|
| Password | User | `signInWithPassword` (client → Supabase Auth) | Supabase Auth only | None to app server | Supabase-managed |
| Session tokens (JWT access/refresh) | Supabase Auth | Browser cookies (`@supabase/ssr`); **also relayed to localhost in cli-login** | Browser | **localhost:`<port>` in cli-login (risk)** | Until expiry / revoke |
| Card / payment data | User | Stripe-hosted checkout (never touches app server) | Stripe | Stripe only | Stripe-managed |
| Stripe customer/subscription IDs | Webhook | `webhook → profiles/subscriptions/subscribers/teams` | Supabase Postgres | None | **No deletion coverage** |
| Shipping name + postal address + email | User | Stripe checkout → webhook re-fetch → Printful | Stripe + Printful | Printful (fulfillment) | **Not stored app-side; no in-app deletion/export** |
| AI chat content | User | `/api/chat/* → provider`; **not persisted** | None (browser memory only) | Anthropic / OpenAI / Google / **DeepSeek** | Not retained by app |
| Chat usage metadata | Server | `usage-log → usage_events` (user_id, provider, model, http_status, ts) | Supabase Postgres | None | **Unbounded, no TTL** |
| Client IP | Request header | `getClientIp → ip_rate_events` (merch checkout) | Supabase Postgres | None | **Unbounded, no TTL** |
| Team membership emails/roles | User | `/api/teams/*` | Supabase Postgres | None | **No deletion coverage** |

**Minimization positives:** the app never stores passwords or card data; provider API keys are server-only env vars never returned to clients; chat content is proxied but never persisted server-side and never written to `localStorage` (`useApiKeyStore` explicitly never persists keys); DMGs are private-bucket-only behind 5-minute signed URLs.

---

## 4. Security Posture (with Risk Ratings)

| # | Finding | Severity | Evidence |
|---|---|---|---|
| S-1 | **CLI login relays live Supabase access + refresh tokens to an unvalidated localhost port.** `port` is read straight from the query string with no validation/allowlist, then the full `access_token` + `refresh_token` are POSTed to `http://localhost:${port}/callback`. A victim who opens `/auth/cli-login?port=<evil>` while signed in (or any local process on the chosen port) captures a long-lived, refreshable session = full account takeover including premium tier. No loopback nonce / PKCE binding. | **High** | `app/auth/cli-login/page.tsx:9` (unvalidated `port`); `:35` (POST of both tokens) |
| S-2 | **Owner privilege bypass depends on an out-of-band Supabase setting.** `OWNER_EMAILS` grant unconditional `team` tier and full rate-limit bypass across chat, downloads/updates, and `/api/auth/verify`. The code correctly requires `user.email_confirmed_at`, so it is safe **only if** Supabase "Confirm email" is ON in prod — unverifiable from code. If confirmation were off and signups self-confirm, registering an owner email yields owner privileges. | **High** | `lib/auth/owner.ts:3-6` (hardcoded emails), `:17` (`email_confirmed_at` gate); consumed at `lib/api/chat-gate.ts:59` |
| S-3 | **comp-access grants have no expiry and run with the full service-role key from local env.** `comp-access.mjs` directly sets `profiles.subscription_tier` via the service-role key, bypassing RLS and Stripe. There is NO time-based expiry — a comp persists until a human runs `revoke`. Only guardrail: refuses if a `stripe_customer_id` exists (cannot clobber a paying customer). | **Medium** | `scripts/comp-access.mjs:4-7` (no expiry), `:73` (stripe guard), `:78-82` (tier write) |
| S-4 | **In-memory IP rate limiter is per-instance and largely ineffective on Vercel** for `/api/auth/verify`, team invite/remove. The file's own comment acknowledges multi-instance makes it an N×limit limiter. Money-sensitive checkout correctly uses the DB-backed `reserveIpRequest` instead; verify brute-force and invite-spam are only weakly throttled. | **Medium** | `lib/api/ip-rate-limit.ts:18` (per-process Map); used at `app/api/auth/verify/route.ts:17`, `app/api/teams/invite/route.ts:18` |
| S-5 | **Rate limiters / webhook dedupe fail open on backend errors.** `reserveChatRequest` / `reserveIpRequest` allow on any Supabase RPC error (DB outage disables rate limiting — cost-amplification window). The Stripe webhook logs and **continues** if the `processed_stripe_events` insert fails for a reason other than 23505 (e.g. table missing), making billing mutations non-idempotent under that condition (replayed event could double-process tier/team grants). | **Medium** | `lib/api/rate-limit.ts:33-35`, `:76-78`; `app/api/stripe/webhook/route.ts:67-74` (confirmed: logs + continues) |
| S-6 | **Subscription tier is driven by Stripe `metadata.plan`** written at checkout. Safe today because checkout is server-authenticated and stamps metadata after verifying the Supabase user, but structurally any future path / dashboard edit that lets a user influence `metadata.plan` escalates to `team`. No server-side re-validation that the `price_id` matches the claimed plan when the webhook fires. | **Low** | `app/api/stripe/webhook/route.ts:102-103,125` (tier from `metadata.plan`) |
| S-7 | **Shell-spawning Electron app co-located under the website package.json.** `electron/main.js` spawns an interactive login shell via node-pty; the same tree carries e2b + xterm while doubling as the deployed website root. Mitigated: `electron/` is in `.vercelignore` (excluded from Vercel build), `contextIsolation:true`, `nodeIntegration:false`, deny-all `setWindowOpenHandler`. Net web risk low; flagged for blast-radius/governance. | **Low** | `electron/main.js:12-67`, `:94-95`, `:111-114`; `.vercelignore` |
| S-8 | **LibraryGate paywall is purely client-side cosmetic blur.** Gated `{children}` are static React content compiled into the client bundle and downloadable regardless of subscription (CSS blur only). Acceptable **only** because the gated content is marketing copy and the real entitlements (DMG downloads, updater feeds, AI chat) are enforced server-side. Becomes a real leak if any genuinely premium artifact is ever placed inside `<children>`. | **Low** | `app/libraries/_components/LibraryGate.tsx:32,163`; `app/libraries/agents/page.tsx:13-50,116-121` |
| S-9 | **Positive controls confirmed.** No secrets hardcoded/committed (full `git log -p` returns only `sk_test_XXXX`/`whsec_XXXX`; `.env*` gitignored at root and nested repo); service-role helper throws if unset and is only used post-auth; RLS migration 008 revokes UPDATE on billing columns from anon/authenticated; migration 007 makes `get_effective_tier` SECURITY DEFINER and blocks cross-user probing; webhook verifies signatures + dedupes; chat proxies keep keys server-side and enforce Zod model enums + 4096-token + 40-message caps; merch pricing fetched authoritatively from Printful; OAuth callback rejects open-redirect `next`; strong CSP/HSTS/X-Frame-Options DENY/nosniff. | **Info** | `supabase/migrations/008_*`, `007_*`; `app/api/stripe/webhook/route.ts:51`; `lib/api/chat-request.ts:4-11`; `next.config.ts:8-65` |

> **Migration dependency:** all RLS hardening assumes migrations 001–012 are actually applied in prod. Project memory notes some were pending — operator must confirm against the live Supabase project.

---

## 5. Privacy & Data-Retention Posture

| # | Finding | Severity | Evidence |
|---|---|---|---|
| P-1 | **No automated retention or deletion logic exists anywhere.** Every user-data table is append-only with no TTL/cron/deletion routine. The privacy and deletion-export pages promise Access/Export/Delete rights, but the only mechanism is a manual email to privacy@. There is no `/api` route, script, or RPC that exports or deletes a user's data. `usage_events` and `ip_rate_events` grow unbounded. GDPR/CCPA right-to-erasure & minimization gap: stated policy is not technically enforced. | **Medium** | `supabase/migrations/012_*:8-12`; `lib/api/usage-log.ts:33-42`; `app/privacy/page.tsx:70-93`; `app/deletion-export/page.tsx:18-39` |
| P-2 | **Client IP addresses persisted to `ip_rate_events` with no expiry/pruning** and **not disclosed** in the privacy policy's "What We Collect" list. IPs are PII under GDPR; nothing deletes old rows. Recommend a TTL/cron delete and disclosure. | **Medium** | `lib/api/rate-limit.ts:64-83`; `supabase/migrations/012_*:8-12,57`; `lib/api/ip-rate-limit.ts:62-71`; `app/privacy/page.tsx:28-35` |
| P-3 | **Privacy/subprocessor disclosures are inaccurate (over- and under-inclusive).** Sentry, Groq, OpenRouter, Ollama are disclosed but **absent from the code**; **DeepSeek** (China-based, receives user prompts) is **not disclosed at all**. The "BYO providers / governed by their terms" framing also understates that for `/api/chat/*` the platform holds the keys and is the controller forwarding content. | **Medium** | `app/privacy/page.tsx:34,41,61,63`; `app/subprocessors/page.tsx:14`; vs `app/api/chat/deepseek/route.ts:15` |
| P-4 | **No data-residency / region pinning** for any sub-processor. AI calls hit each provider's default global endpoint; Stripe/Supabase/Printful/Vercel at account defaults. No mechanism to keep EU/UK data in-region or route around China-based processing. | **Medium** | chat routes; no region selection in code/env |
| P-5 | **Shipping PII flows web → Stripe → Printful with no app-side record or deletion coverage.** Good minimization (app stores none of it; only `variantId`+`quantity` trusted from client, prices server-looked-up), but the address+email now live in two external processors outside any in-app deletion/export flow, and Printful subprocessor data categories are not enumerated. | **Low** | `app/api/stripe/webhook/route.ts:221-252`; `lib/printful/order.ts:47-63`; `app/api/stripe/merch-checkout/route.ts:17-22` |
| P-6 | **`usage_events` is identifiable behavioral data with no admin read path and no retention.** RLS allows only self-insert/self-select; writes go via service-role (bypassing RLS). Ever-growing per-user log of which provider/model each user used and when. Must be included in any erasure flow. | **Low** | `supabase/migrations/003_usage_events.sql:1-25`; `lib/api/usage-log.ts:16,33-42` |
| P-7 | **Stripe-derived billing identity persisted with no deletion coverage** (`stripe_customer_id` / `stripe_subscription_id`), same erasure gap as P-1, plus the non-idempotent webhook failure window (S-5). | **Low** | `app/api/stripe/webhook/route.ts:107-131` |
| P-8 | **`profiles.email` data-model mismatch.** `teams/invite` and migration 010 query `profiles.email`, but the `profiles` schema has no `email` column (only username/full_name). So `matchedProfile?.id` is always null and every invite is written `status='pending'`; auto-activation relies solely on the `auth.users` confirm trigger. Latent data-model bug; confirm live DB has no out-of-migration column. | **Low** | `app/api/teams/invite/route.ts:100-106` vs `supabase/migrations/001_initial_schema.sql:9-23` |
| P-9 | **Dormant curriculum/labs/`agent_messages` schema defines an unused transcript flow.** Migration 001 creates `agent_messages` (full role/content transcripts) + usage ledgers with RLS, but the lab API routes exist only under `._build_tmp`, not the live `app/api` tree. If ever activated they would persist user prompt+output transcripts that current disclosures and the (absent) deletion logic do not account for. Document as "defined but inactive." | **Low** | `supabase/migrations/001_initial_schema.sql:90-177`; routes only in `makeshiphappenAi/._build_tmp/api/lab/` |
| P-10 | **Minimization positives (record for the data map):** chat content never stored (only metadata logged), no zustand `persist` on any store, API keys never written to localStorage; passwords/cards never touch the app server; all secrets server-side env only; DMGs behind 5-min signed URLs. | **Info** | `app/api/chat/anthropic/route.ts:15-36`; `lib/stores/useApiKeyStore.ts:4-15`; `app/api/install/shipmind/download/route.ts:22-114` |

---

## 6. Integrations & AI Providers

### 6.1 AI Provider Map (4 live, all platform-keyed — NOT BYO)

| Provider | Endpoint | Key (server-only env) | Source |
|---|---|---|---|
| Anthropic | `api.anthropic.com/v1/messages` | `ANTHROPIC_API_KEY` (x-api-key) | `app/api/chat/anthropic/route.ts:15-23` |
| OpenAI | `api.openai.com/v1/chat/completions` | `OPENAI_API_KEY` (Bearer) | `app/api/chat/openai/route.ts:15-22` |
| Google Gemini | `generativelanguage.googleapis.com` | `GOOGLE_API_KEY` (x-goog-api-key) | `app/api/chat/google/route.ts:17-25` |
| DeepSeek | `api.deepseek.com/chat/completions` | `DEEPSEEK_API_KEY` (Bearer) | `app/api/chat/deepseek/route.ts:15-22` |

Provider keys are **never** read from the request body (`chat-gate.ts:29`). Data sent per request = user-selected model + an array of `{role,content}` messages, Zod-capped to ≤40 msgs, ≤12k chars/msg, ≤4096 output tokens (`lib/api/chat-request.ts:4-11`). User CHAT CONTENT is forwarded verbatim to whichever provider the user picks; `usage_events` stores only provider/model/http_status, not message text.

### 6.2 Integration Findings

| # | Finding | Severity | Evidence |
|---|---|---|---|
| I-1 | **DeepSeek (China-based) receives user prompts with no residency disclosure or opt-out.** Prompts may contain code, business context, or personal data. DeepSeek is not listed on the privacy or subprocessors pages at all — an incomplete sub-processor disclosure for a jurisdiction with materially different data-protection norms; GDPR international-transfer gap. | **High** | `app/api/chat/deepseek/route.ts:15`; absent from `app/privacy/page.tsx`, `app/subprocessors/page.tsx:14` |
| I-2 | **Disclosures list services not in code (Sentry, Groq, OpenRouter, Ollama) and frame proxied providers as BYO.** No Sentry SDK exists anywhere; Groq/OpenRouter/Ollama are not wired. Inaccurate (both over- and under-inclusive) sub-processor lists are a compliance/transparency risk. (Same root as P-3.) | **Medium** | `app/privacy/page.tsx:34,41,61,63`; `app/subprocessors/page.tsx:14` |
| I-3 | **Google route reads `GOOGLE_API_KEY`, but the repo + `.env.example` use `GEMINI_API_KEY`.** No fallback between names. If prod only sets `GEMINI_API_KEY`, the Google provider hard-500s with "google is not configured." Verify which var is populated in Vercel. | **Low** | `lib/api/chat-gate.ts:11` vs `.env.example:20`, `lib/agents/base-agent.ts:4` |
| I-4 | **"nano-banana" provider is a hardcoded mock**, not a real integration — returns canned strings with simulated streaming, calls no external service, yet registered as a real adapter. No data leaves the app; misleading if surfaced as a working model in UI. (These `lib/agents/*` adapters are co-located ShipSpace Electron code, unused by any `app/` route.) | **Low** | `lib/agents/providers/nano-banana.ts`; `lib/agents/providers/index.ts:18` |
| I-5 | **Printful receives full customer PII (name + shipping address + email) on every merch order.** Disclosed (correct). Pricing/variant looked up server-side (anti-tamper). The direct order endpoint `app/api/printful/order/route.ts` is guarded only by a shared static `x-webhook-secret`, not a per-request signature. | **Info** | `app/api/stripe/webhook/route.ts:239-252`; `lib/printful/order.ts:47-75`; `app/api/printful/order/route.ts:18-21` |
| I-6 | **Supabase is the single identity + PII store; service-role key bypasses RLS** in webhook/admin/teams. Both admin clients hard-throw if the key is unset (no anon fallback). A leak of `SUPABASE_SERVICE_ROLE_KEY` (Vercel env) = full read/write to all user data with no RLS. Auth model correct; flagged for blast radius. | **Info** | `lib/supabase/admin.ts:10-28,44-57`; `app/api/auth/verify/route.ts:63-84` |
| I-7 | **Stripe webhook is the only data-mutating endpoint authenticated by signature**; merch path re-fetches the full Stripe session to recover shipping+email → Printful. Tier derived from server-stamped `metadata.plan`. Stripe ("ZZ GEMZ") receives billing + payment + shipping data; disclosed. Sound. | **Info** | `app/api/stripe/webhook/route.ts:40-55,223-231` |
| I-8 | **`/api/auth/verify` IP limiter is in-memory per instance and fails open** (same as S-4). Note `reserveChatRequest` fails **closed** on DB error (correctly protects AI spend), while `reserveIpRequest` fails **open** on checkout. | **Low** | `app/api/auth/verify/route.ts:17`; `lib/api/rate-limit.ts:33-34` (closed), `:76-78` (open) |

### 6.3 Non-AI Third Parties

Supabase (auth/Postgres/Storage — central PII store) · Stripe (subscriptions + merch) · Printful (merch fulfillment, receives shipping PII) · Vercel (hosting + secret storage) · Netlify (`.netlify/state.json` present — stale/secondary) · e2b (ShipSpace side) · electron-updater · GitHub (referenced in `profiles.github_url`). Authentication to every external service is a server-side bearer/secret key from env; no key is ever exposed to the browser.

---

## 7. Licenses & Dependencies

The website's **JS dependency tree is overwhelmingly permissive** (MIT/ISC/Apache-2.0/BSD), so the website itself is **LOW** license risk. The serious items are in the **co-distributed desktop apps** that share the repo/manifest.

| # | Finding | Severity | Evidence |
|---|---|---|---|
| L-1 | **GPLv2+ ffmpeg statically linked & distributed inside a paid, closed-source desktop app (ShipMind).** Bundled as a Tauri `externalBin` sidecar; the binary's banner shows `--enable-gpl ... --enable-libx264/libx265/libvidstab/libkvazaar --pkg-config-flags=--static` and "libavcodec license: GPL version 2 or later." GPL-only libs force the whole build into GPL (not LGPL). Conveying a GPL binary in a proprietary paid app obligates a complete corresponding-source offer + GPL text to every recipient — **none shipped**. Direct copyleft conflict. Tracked here because the website and ShipMind share the repo/governance; remediation = ship an LGPL-only dynamic build, or rely on the existing PATH fallback, or comply with GPL. | **Critical** | `shipmind/src-tauri/tauri.conf.json:50-53`; `shipmind/src-tauri/binaries/ffmpeg-*-apple-darwin`; PATH fallback at `shipmind/src-tauri/src/lib.rs:829-844` |
| L-2 | **Website ships LGPL-3.0 libvips (via sharp 0.34.5).** Server-side use on Vercel is not "distribution," so LOW for the website. Risk attaches **only if** a desktop build bundles sharp (then LGPL relinking/source/attribution obligations apply). Confirm Electron packaging. | **Low** | `node_modules/@img/sharp-libvips-darwin-darwin-arm64` (LGPL-3.0-or-later) |
| L-3 | **No THIRD-PARTY / NOTICE / attribution file** for the many MIT/BSD/Apache deps that are distributed in the Electron/Tauri binaries. MIT/BSD/Apache-2.0 require notice retention on distribution; no aggregated notices file or in-app "open source licenses" screen exists. Website-only deploy is less exposed (users receive no bundled copies). | **Low** | absence across `makeshiphappenAi` + src-tauri products |
| L-4 | **Bundled `yt-dlp` (Unlicense) and `deno` (MIT) sidecars distributed without license text** in ShipMind. deno's MIT requires reproducing the notice; none shipped. | **Low** | `shipmind/src-tauri/tauri.conf.json:52-53` |
| L-5 | **package.json has no `license` field and is not the website's true manifest** (declares name `shipspace`, `main electron/main.js`) while carrying both website and desktop deps. Co-mingling maximizes the license-obligation surface; recommend splitting manifests and declaring proprietary/`UNLICENSED`. | **Low** | `makeshiphappenAi/package.json` |
| L-6 | **MPL-2.0 axe-core present** (almost certainly dev-only). Weak file-level copyleft; minimal practical risk if not bundled. Confirm dev-only. | **Info** | `node_modules/axe-core` (4.11.1, MPL-2.0) |
| L-7 | **Deploy-from-working-tree means audited licenses may not match live.** A locally-added binary (such as the GPL ffmpeg) can enter without appearing in the repo. Gate releases on a license scan of the exact lockfile/Cargo.lock and treat any binary added to `src-tauri/binaries/` as a license event. | **Info** | governance |

No GPL/AGPL crates were found in any Rust `Cargo.lock` (Tauri stack is MIT/Apache-2.0; whisper.cpp vendored as Unlicense).

---

## 8. Liability Hotspots

1. **Session-token exfiltration via cli-login (S-1).** The single highest-value egress path. A crafted link plus a local listener captures a refreshable session = account takeover including paid tier. Direct fraud/abuse and breach-notification exposure.
2. **Owner bypass safety hinges on an unverifiable Supabase setting (S-2).** If "Confirm email" is off, an attacker registering an owner email inherits free premium / elevated access. Operator must verify the live toggle.
3. **DeepSeek undisclosed China-transfer (I-1) + inaccurate subprocessor lists (P-3/I-2).** GDPR Art. 13/14 transparency, Art. 28 sub-processor, and international-transfer (Chapter V) exposure; also a consumer-protection / misrepresentation risk (disclosing a vendor — Sentry — that isn't actually used, and omitting one that is).
4. **Stated erasure/export rights without a code path (P-1).** The privacy and deletion-export pages create a binding promise the system cannot technically fulfill, an enforceable GDPR/CCPA gap and a misrepresentation risk.
5. **Indefinite comp access (S-3).** Forgotten comps = indefinite free premium; operational/revenue leakage, no auto-expiry.
6. **GPL ffmpeg in a paid closed-source app (L-1).** Copyleft non-compliance carries injunction and termination-of-license risk for the ffmpeg components; tracked at the cluster level due to shared governance.
7. **Deploy divergence (standing caveat).** Auditing the repo does not prove the live artifact; any of the above could be better or worse in production.

---

## 9. User-Responsibility Assignment

| Responsible party | Obligations |
|---|---|
| **Site owner / operator (Jake)** | Verify Supabase "Confirm email" is ON (S-2); confirm migrations 001–012 are applied in prod; build a real export/delete pipeline and a TTL/pruning job for `usage_events` + `ip_rate_events` (P-1/P-2/P-6/P-7); revoke comps manually (no auto-expiry, S-3); confirm the populated Google key var (I-3); verify deployed artifact matches the audited repo. |
| **Web/eng team** | Fix cli-login: validate/allowlist the port, bind a loopback nonce/PKCE, or restrict to loopback (S-1); add server-side `price_id`↔plan re-validation in the webhook (S-6); move verify/team-invite limits to the DB-backed limiter (S-4); decide fail-open vs fail-closed per endpoint and make webhook dedupe hard-fail when the table is missing (S-5); never place real premium artifacts inside `LibraryGate` children (S-8). |
| **Legal / compliance** | Correct the subprocessor list (add DeepSeek + the real AI providers; remove Sentry/Groq/OpenRouter/Ollama if unused); disclose IP collection and shipping-PII categories; document data-residency/transfer story and a DeepSeek opt-out (P-3/P-4/I-1/I-2); align stated erasure/export rights with the actual mechanism (P-1). |
| **Release engineering (desktop, shared governance)** | Resolve GPL ffmpeg (L-1); ship third-party notices for distributed binaries (L-3/L-4); gate releases on a license scan and treat new `src-tauri/binaries/` as license events (L-7); split website vs desktop manifests and declare a license of record (L-5). |
| **Supabase project admin** | Enforce email-confirmation; protect `SUPABASE_SERVICE_ROLE_KEY` (full-data blast radius, I-6); ensure RLS migrations are applied. |
| **End user** | Use only the official cli-login flow (do not open cli-login links from untrusted sources); understand that chat content is sent to third-party AI providers (including, currently, DeepSeek) governed by those providers' terms. |

---

## 10. Severity Tally

| Severity | Count | Items |
|---|---|---|
| Critical | 1 | L-1 (GPL ffmpeg, co-distributed desktop) |
| High | 3 | S-1, S-2, I-1 |
| Medium | 7 | S-3, S-4, S-5, P-1, P-2, P-3/I-2, P-4 |
| Low | 12 | S-6, S-7, S-8, P-5, P-6, P-7, P-8, P-9, I-3, I-4, I-8, L-2/L-3/L-4/L-5 |
| Info | 8 | S-9, P-10, I-5, I-6, I-7, L-6, L-7 |

**Bottom line:** the website's core engineering is well-hardened and shows real prior security investment. The material exposure is concentrated in one auth-handoff flaw (cli-login), one configuration-dependent privilege bypass (owner emails), and a cluster of **governance gaps** — inaccurate privacy disclosures (notably the undisclosed China-based DeepSeek transfer), the complete absence of retention/deletion automation behind a policy that promises it, and the co-distributed GPL ffmpeg. None of these are code-quality defects in the deployed web app; they are policy-vs-implementation and supply-chain governance issues that an attorney/compliance owner must close.
