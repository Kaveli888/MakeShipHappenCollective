# Cluster 13 — Web & Commerce (makeshiphappen.tech + Ship AOS)

**Auditor role:** Independent governance / security / privacy / SaaS-legal auditor (read-only).
**Date:** 2026-06-07
**Scope:** `makeshiphappenAi/` (production site = makeshiphappen.tech), `ship-aos/` (local Ship AOS dashboard).
**Method:** Read-only source review of `app/`, `lib/`, `components/`, API routes, `supabase/migrations/`, config, `.env.example`, legal pages, plus git-history secret scan. Build artifacts (`node_modules/`, `.next/`, `out/`, `dist/`) excluded.
**Sensitivity:** HIGHEST — real users, real payments (Stripe live), real accounts (Supabase), PII, physical merch fulfillment with shipping addresses.

> **Headline:** This is the most mature project in the ecosystem from a security standpoint. The two prior audits' Critical/High findings (owner bypass C-1, merch non-fulfillment C-2, invite-trigger H-1, Google key in URL H-2, open redirect, security headers, RLS) are now **resolved in source**. The remaining exposure is **legal/privacy/compliance**, not raw security: a **pricing↔ToS contradiction**, a **refund-policy contradiction**, **no implemented account-deletion/export path** despite promising one, and **auto-renewal disclosure (ARL/click-to-cancel) gaps**.

---

## PHASE 1 — INVENTORY

### makeshiphappen.tech (Next.js 15.5, App Router, Vercel)

**Purpose:** Marketing + commerce + account hub for the Ship ecosystem (ShipMind, ShipSpace, ShipTalk, ShipCode, ShipWatch, ShipRelease). Sells a subscription membership and physical merch; gates app downloads/updates; brokers AI chat for signed-in users; issues CLI login tokens to ShipCode.

**Third-party integrations / subprocessors:**
- **Stripe** — subscription billing + one-time merch checkout (`app/api/stripe/*`). Card data never touches the server (Stripe Checkout hosted).
- **Supabase** — auth (email/password + OAuth callback) + Postgres (profiles, subscriptions, teams, team_members, usage_events, subscribers, processed_stripe_events) + private Storage bucket `releases` for app binaries.
- **Printful** — print-on-demand merch fulfillment (`lib/printful/order.ts`, `app/api/printful/*`). Receives customer **name + full shipping address + email**.
- **AI providers** — Anthropic, OpenAI, Google (Gemini), DeepSeek brokered server-side via `app/api/chat/*` (server-held keys, auth-gated, rate-limited).
- **Vercel** — hosting. **Sentry** — referenced in Privacy Policy as error reporting (no Sentry SDK wired in source — see Phase 6 inconsistency).

**Authentication / Authorization:**
- Supabase email/password + OAuth (`app/auth/callback/route.ts`, open-redirect-guarded).
- CLI login (`app/auth/cli-login/page.tsx`) — POSTs full Supabase `access_token`+`refresh_token` to `http://localhost:<port>/callback` for ShipCode.
- Token verification oracle (`app/api/auth/verify/route.ts`) — IP-rate-limited (30/min), body-size capped.
- **Owner bypass** (`lib/auth/owner.ts`) — email allowlist (`zzgemsjewelry@gmail.com`, `aryah.yeasley@icloud.com`) **now gated on `email_confirmed_at`** → grants `team` tier + rate-limit bypass.
- **RLS** — migrations 001–012; billing columns locked to service-role writes (008); effective-tier RPC is `security definer` (007).
- API routes use `authenticateRequest` (cookie or bearer) + `getSubscriptionState`/`gateChatRequest` before service-role use.

**User data processed / storage locations:**
- **Supabase:** email, password hash, `subscription_tier`, `stripe_customer_id`, usage events (commands/providers/errors), team membership, invite emails.
- **Stripe:** name, email, card (PCI-scoped to Stripe), subscription + charge history, **merch shipping address**.
- **Cookies:** Supabase session cookies only (auth). No tracking cookies found.

### Ship AOS (`ship-aos/`, Next.js 16, local dev tool, port 3737)

**Purpose:** Local single-user "Self/Mission-Control" dashboard. **Not internet-deployed** — localhost only. Reads a local markdown memory vault (`src/lib/vault.ts`), runs local CLI agents (`/api/run`), proxies AI chat, and integrates a **personal** Stripe dashboard (the operator's own Stripe account, via Connect OAuth or a pasted secret key).
**Auth model:** None (local trust). CSRF/cross-site guard on `/api/*` (`src/middleware.ts`) pinned to `http://localhost:3737`. Command execution allowlisted by regex (`/api/run`). Stripe secret stored at `~/.ship-aos/stripe.json` with `chmod 0600`.
**Risk posture:** Low *as a localhost tool*; would be HIGH if ever exposed to a network (it has no authentication and runs shell commands + holds a live Stripe key). It is the **operator's** Stripe data, not customers' — minimal third-party-PII / legal exposure.

---

## PHASE 2 — DATA FLOW

| Flow | Origin → Destination | PII | Retention | Controls | Responsible |
|---|---|---|---|---|---|
| Signup/login | Browser → Supabase Auth | email, pw hash | while active; "90 days" post-deletion (policy, not enforced in code) | Supabase RLS, email confirm (manual dashboard setting) | Operator + Supabase |
| OAuth callback | Provider → `/auth/callback` → cookie session | email | session TTL | same-origin `next` validation | Operator |
| Subscription checkout | Browser → `/api/stripe/checkout` → Stripe Checkout → `/api/stripe/webhook` → Supabase | email, card (Stripe-only), customer id | Stripe retains; tax records "~7yr" (policy) | webhook sig verify, idempotency (`processed_stripe_events`), IP rate limit | Operator + Stripe |
| Merch checkout | Browser → `/api/stripe/merch-checkout` → Stripe → webhook → **Printful** | email, **name + shipping address** | Stripe + Printful retain | server-side price re-fetch (no client tampering), country allowlist, idempotency, retry-on-fail | Operator + Stripe + Printful |
| comp-access grant/revoke | (tooling `comp-access.mjs`, per memory) → Supabase | email/tier | manual; **no auto-expiry** | service-role script | Operator |
| CLI token issuance | Browser session → `http://localhost:<port>/callback` | access+refresh token, email, user id | JWT/refresh lifetime | localhost only, HTTPS-page-to-HTTP-localhost | Operator |
| AI chat | Browser → `/api/chat/*` → provider | prompt content (transient) | not stored (per policy) | auth gate, per-tier rate limit, `max_tokens` cap | Operator + provider |

**PII categories & location:** Email/account → Supabase. Card → Stripe (never server). **Shipping address + name → Stripe + Printful** (the most sensitive customer-PII flow, a new subprocessor each).

---

## PHASE 3 — LIABILITY

| # | Risk | Scenario | Severity | Likelihood | Business impact |
|---|---|---|---|---|---|
| L1 | **Auto-renewal disclosure (CA ARL / FTC click-to-cancel / EU)** | Subscription auto-renews; ToS discloses it but the **pricing/CTA pages do not** show clear-and-conspicuous auto-renewal terms adjacent to the price, and there's a "15% off first month" intro offer (heightened ARL trigger). Cancel is "from account settings" — verify a self-serve cancel UI actually exists. | High | Medium | CA ARL statutory penalties, FTC action, chargebacks, refund obligations |
| L2 | **Refund-policy contradiction** | ToS §5 = "All sales are final … 72-hour case-by-case"; ShipMind CTA badge publicly promises **"7-day money-back."** Conflicting public promises are deceptive-practice / breach exposure; customer can enforce the more generous one. | High | High | Chargebacks, FTC/UDAP, reputational |
| L3 | **Pricing ↔ ToS mismatch** | Public site sells **only "$50/month, one membership"** (pricing, teaser, CTA). ToS §4 says "single membership plan at $50/month" — but checkout backend + DB + memory support a **$500 Team/Ultra** tier. If Team is sold anywhere (or comped), the published terms don't describe it (seats, per-seat price, team-admin obligations). | High | Medium | Contract ambiguity, billing disputes, ARL non-disclosure for the team SKU |
| L4 | **No DPA / subprocessor list incomplete** | Privacy lists Stripe/Supabase/Sentry/Vercel/AI providers but **not Printful**, which receives name+shipping address. No signed DPA referenced for any subprocessor. Under GDPR/CCPA the controller must have DPAs + disclose all subprocessors. | High | Medium | GDPR Art.28 / CCPA service-provider exposure, fines |
| L5 | **Account-deletion / data-access promised but not implemented** | Privacy promises Access/Export/Delete via email within 30 days; **no code path** exists (`/api/account`, `deleteUser`, export endpoint all absent). Relies entirely on manual operator action → SLA-miss risk under GDPR Art.15/17 & CCPA. | High | High | Regulatory complaint, statutory damages |
| L6 | **Chargeback / merch fulfillment dispute** | Merch fulfillment now wired, but if Printful billing isn't funded the webhook returns 502 and **Stripe retries then gives up** → customer charged, never shipped, no `merch_orders` audit table to reconcile. | Medium | Medium | Chargebacks, support load |
| L7 | **Data-breach exposure** | Supabase holds emails + tiers; Stripe/Printful hold names+addresses. No breach-notification clause in ToS/Privacy; no documented incident process. | Medium | Low | Breach-notification statutes (all US states, GDPR 72h) |
| L8 | **Marketing claims ("Private by default", "Secure")** | Repeated "Private by default", "Secure checkout", ShipTalk "structural guarantee … not a single byte leaves your hardware." Strong absolute claims invite FTC/UDAP scrutiny if any telemetry/usage-event contradicts them. | Medium | Low–Med | UDAP exposure |

---

## PHASE 5 — TERMS OF SERVICE (present, but gaps)

**Status: ToS EXISTS** (`app/terms/page.tsx`, "Last updated May 2026") and **Privacy EXISTS** (`app/privacy/page.tsx`, "April 2026"). Both carry a self-undermining banner: *"Not legal advice … Consult a lawyer before relying on it for a real business."* — **remove this disclaimer from a live commercial ToS/Privacy** (it signals the operator does not stand behind its own terms).

Clauses present: acceptance, service description, account registration (18+), subscriptions/auto-renew, refund policy, acceptable use, IP, user-content/data, third-party services, **AI-output disclaimer** (§10, good — "AS IS", "not for safety-critical"), **limitation of liability** (§11, capped to 12-mo fees, good), termination, changes, governing law (unspecified state — `"the state in which MakeShipHappen is registered"` is a placeholder — **fill in**).

**Required fixes / additions:**
1. **Reconcile §4 with actual SKUs** — describe Team/$500 tier (seats, per-seat, admin duties) or remove it from backend.
2. **Reconcile §5 refund vs. the "7-day money-back" public badge.**
3. **Add conspicuous auto-renewal disclosure** at point of sale, not only buried in ToS (ARL/click-to-cancel).
4. **Add arbitration / dispute-resolution & class-action waiver** (currently only "courts of that jurisdiction").
5. **Add breach-notification & data-processing clauses**; reference a DPA + full subprocessor list (incl. **Printful**).
6. Fill in **governing-law state** and legal entity name.
7. Acceptable-use already covers rate-limit abuse / reverse-engineering — adequate.

---

## PHASE 6 — PRIVACY

**Privacy Policy EXISTS** and is reasonably scoped. **Cookie posture is clean:** no Google Analytics / GTM / Posthog / Mixpanel / Segment / Meta pixel found in `app/layout.tsx` or anywhere in source — only Supabase session cookies. The "no third-party analytics cookies" claim **holds in code**.

**Inconsistencies between policy and code:**
- **Sentry claimed, not wired.** Privacy + ToS name Sentry as the error-reporting subprocessor; no `@sentry/*` SDK exists in source. Either remove the claim or wire it (and if wired, it becomes a real subprocessor needing a DPA).
- **Account deletion / export promised, not implemented.** Privacy "Your Rights" (Access/Export/Delete, JSON export, 30-day response) has **zero supporting code**. This is the single biggest privacy-compliance gap. (P6/L5)
- **Printful omitted** from the third-party list despite receiving name+shipping address. (L4)
- **Retention "90 days"** is a policy statement with no enforcing job/cron in source — purely manual.

**GDPR/CCPA/CPRA applicability:** The site is worldwide and sells to consumers, so **GDPR (EU), UK-GDPR, CCPA/CPRA (CA)** all plausibly apply. Triggers present: PII processing, profiling-lite (usage events), payment data, international subprocessors. **Missing:** functional DSAR (access/delete/export) path, cookie-consent banner (low urgency given session-only cookies, but a "we use only essential cookies" notice is advisable), DPA references, and a "Do Not Sell/Share" link (CPRA — likely N/A since no sale of data, but should be stated).

---

## PHASE 7 — SECURITY (risk ratings)

**Secrets handling — GOOD.** `.env.local` / `.env.production.local` exist on disk but are **gitignored and never committed** (verified `git ls-files` shows only `.env.example`; `git log -S sk_live/sk_test/service_role` shows only doc/code references, no real key strings in tracked files). `.env.example` is placeholder-only. Live secrets live on disk in plaintext (filesystem-exposure risk, **Low–Medium**, prior H-3 — rotate per `LAUNCH_ROTATION_CHECKLIST.md`).

**Prior-audit findings — verification against current source:**

| Prior ID | Issue | Status in source |
|---|---|---|
| C-1 | Owner bypass (no email_confirmed_at) | **RESOLVED** — `lib/auth/owner.ts` now rejects `!user.email_confirmed_at`. (Still depends on Supabase "Confirm email" = ON, and is email- not UUID-based — residual **Low**.) |
| C-2 | Merch charged, never fulfilled | **RESOLVED** — webhook `order_type==='merch'` branch + `fulfillMerchOrder` → Printful, with retry-on-fail. |
| H-1 | Invite trigger ignores email confirm | **RESOLVED** — migration `010_invite_requires_email_confirmation.sql` (confirm-transition trigger). |
| H-2 | Google API key in URL query | **RESOLVED** — now `x-goog-api-key` header in `app/api/chat/google/route.ts`. |
| H-3 | Live secrets in plaintext on disk | **OPEN (Low–Med)** — files gitignored; rotation is operational. |
| Open redirect (OAuth) | `next` unvalidated | **RESOLVED** — same-origin guard in `auth/callback/route.ts`. |
| Security headers | none | **RESOLVED** (per deep-dive: CSP/HSTS/X-Frame DENY present in `next.config.ts`; minor: CSP may still allow `unsafe-eval`). |
| Site-password gate | live | **RESOLVED** — removed from middleware. |
| M-1 | `/api/auth/verify` returns email/user_id (oracle) | **PARTIAL** — now IP-rate-limited (30/min) + body cap, but **still returns `email` + `user_id`** to any caller with a valid token. **Low.** |
| M-2 | Webhook hardcodes `status:'active'` on checkout | **PARTIAL/OPEN** — `checkout.session.completed` still writes `status:'active'` + tier without re-reading live Stripe status (later `subscription.updated`/`deleted` events correct it). Idempotency now present. **Low–Med.** |
| Stripe webhook event coverage | missing `invoice.payment_failed` | **OPEN (Low)** — no `invoice.payment_failed` / dunning / `past_due` handling → silent revenue leakage on failed renewals. |
| Webhook signature verify | — | **GOOD** — `constructEvent` verified. |
| RLS billing lockdown | — | **GOOD** — migration 008 revokes client writes to billing columns. |
| Service-role blast radius | wide | **Low** — each route authenticates first; no missed gate found. |
| CLI token transport | full session token over localhost | **Low** — localhost-only; long-lived token (prior L14 still applies). |

**Ship AOS:** localhost-only, CSRF guard, command allowlist, Stripe key `chmod 0600`. **Low** as deployed. Would be **Critical** if bound to `0.0.0.0`/exposed (no auth + shell exec + live Stripe key) — recommend documenting "never expose this port."

**Net security posture:** **LOW–MEDIUM.** No Critical/High open security findings in source. Residual items are defense-in-depth (M-1 oracle, M-2 status echo, missing dunning) + operational (secret rotation, confirm Supabase "Confirm email" ON, confirm pending migrations 010/011/012 applied).

---

## PHASE 9 — MARKETING CLAIMS (verbatim)

- Pricing: **"$50 /month … Full access to the entire ecosystem — one membership."** / badge **"Founding member access"** / FAQ **"$50/month gives you access to everything. Cancel anytime from your account settings."** / **"This is contributor pricing. It won't stay here forever."**
- Pricing trust row: **"Secure checkout via Stripe", "Cancel anytime"**, **"Private by default. Runs on your machine."**
- ShipMind CTA badge: **"Free → Pro $50/mo · 15% off first month · 7-day money-back"** ← contradicts ToS "all sales are final."
- ShipMind teaser CTA: **"Join the Workshop — $50/mo."**
- ShipTalk v3: **"Privacy isn't a feature toggle in ShipTalk — it's a structural guarantee. … without a single byte leaving your local hardware. No subscriptions. No accounts. No analytics."** ← absolute guarantee language.
- Products: **"Secure Build Signing & Release Workflows."**

**Exposure:** (1) **"7-day money-back" vs "all sales are final"** is a direct contradiction → fix one. (2) **"Cancel anytime from your account settings"** asserts a self-serve cancel UI **must verify it exists** (ARL requires the advertised cancel mechanism to actually work). (3) Absolute **"structural guarantee / not a single byte leaves"** and **"Secure"** claims should be backed by the privacy posture (they largely are for the local apps) but invite UDAP scrutiny if any telemetry contradicts. (4) **Intro "15% off first month"** is an ARL "automatic-renewal w/ promotional pricing" trigger — disclosure obligations are heightened.

---

## TOP 7 RISKS (prioritized)

1. **Account-deletion / data-access promised but NOT implemented** (L5/P6) — Privacy guarantees GDPR/CCPA Access/Export/Delete; **no code path exists**. Highest compliance liability. → Build a DSAR/delete endpoint or formal manual SLA.
2. **Refund contradiction** — ToS "all sales are final" vs public **"7-day money-back"** badge (L2). → Pick one; align ToS, pricing, and CTA.
3. **Pricing ↔ ToS ↔ backend SKU mismatch** — site sells only "$50/mo one membership"; ToS says the same; but backend + comp tooling support a **$500 Team/Ultra** tier with no published terms (L3). → Either publish Team terms (seats/price/admin) or remove from backend.
4. **Auto-renewal / click-to-cancel disclosure gap (CA ARL + FTC)** — auto-renew + 15%-first-month intro offer without clear-and-conspicuous point-of-sale disclosure; verify the advertised self-serve cancel UI actually exists (L1).
5. **Subprocessor/DPA gap — Printful omitted** from privacy disclosure though it receives **name + shipping address**; no DPA references for any subprocessor (L4).
6. **"Not legal advice — consult a lawyer" disclaimer on a live commercial ToS/Privacy** + placeholder governing-law state + Sentry claimed-but-not-wired. → Finalize and stand behind the documents; remove the disclaimer; fix the Sentry/jurisdiction inconsistencies.
7. **Operational must-confirm security items (carryover, not in-source):** Supabase **"Confirm email" = ON** (the toggle that keeps C-1/H-1 fixes effective), **rotate live Stripe/Supabase-service-role/Printful keys** (H-3), confirm **migrations 010/011/012 applied**, deploy **cli-login state echo** (memory: else ShipCode logins 403), add **`invoice.payment_failed` dunning** handling, and trim `/api/auth/verify` to `{valid,tier}` (M-1).

---

## What's solid (verified in source)
Webhook signature verification + idempotency (`processed_stripe_events`); RLS billing lockdown (008); owner check now requires `email_confirmed_at`; merch price re-fetched server-side (no client tampering) + fulfillment wired; OAuth open-redirect fixed; security headers present; no tracking cookies / analytics; AI keys server-only + per-tier rate limits + `max_tokens` caps; no secrets committed to git; ship-aos localhost-guarded with command allowlist + 0600 key file; legal pages exist with AI-output disclaimer + liability cap. The security work from the two prior audits has largely landed — the remaining work is **legal/privacy documentation and one missing DSAR/deletion feature**, not code hardening.
