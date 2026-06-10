# Audit v2 — 13. Web / Commerce Cluster

**Scope:** `makeshiphappenAi/` (the public makeshiphappen.tech Next.js site — Stripe payments, Supabase auth, Printful merch) and `ship-aos/` (local Next.js "Ship AOS" app).
**Method:** Independent, read-only, derived from source. Did not consult `docs/audit/` or `docs/business-protection/`.
**Date:** 2026-06-07. **Auditor:** independent risk/compliance review.

All paths below are relative to the cluster root `…/MakeShipHappenCollective/` unless noted.

---

## 1. INVENTORY

### 1a. makeshiphappenAi (public commercial property)

| Dimension | Detail | Evidence |
|---|---|---|
| Purpose | Public marketing + commerce site for the Ship ecosystem (ShipMind/ShipSpace/ShipTalk/ShipCode); membership signup, subscription checkout, merch shop, download/update gating, CLI login | `makeshiphappenAi/app/*` |
| Framework | Next.js App Router (RSC + client components), TypeScript | `app/`, `package.json` |
| Auth | Supabase Auth (email/password). Browser client uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`; server routes use SSR cookie client; webhook + admin scripts use `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `app/api/stripe/webhook/route.ts:12-30` |
| Permissions / tiers | `free` / `pro` / `team`; "ultra" is a marketing alias of `team`; owner-bypass for 2 hardcoded emails | `lib/auth/subscription.ts:19`, `app/api/stripe/checkout/route.ts:11-24`, `lib/auth/owner.ts:3-6` |
| Payments | Stripe (subscription checkout + one-time merch checkout). Built via raw `fetch` to Stripe REST, not the SDK | `app/api/stripe/checkout/route.ts`, `app/api/stripe/merch-checkout/route.ts`, `app/api/stripe/webhook/route.ts` |
| Fulfillment | Printful (print-on-demand merch); order created on `checkout.session.completed` with `order_type=merch` | `lib/printful/order.ts`, `app/api/printful/*`, `webhook/route.ts:85-96,198-260` |
| AI providers (server-paid) | Anthropic, OpenAI, Google, DeepSeek — server-held keys, gated chat API | `lib/api/chat-gate.ts:8-12`, `app/api/chat/*/route.ts` |
| AI providers (named in copy/ToS) | Anthropic, OpenAI, Groq, Google, OpenRouter, Ollama | `app/terms/page.tsx:130-136`, `app/privacy/page.tsx:41,63` |
| External services | Stripe, Supabase, Printful, Sentry, Vercel | `app/privacy/page.tsx:55-65`, `app/terms/page.tsx:130-136` |
| Storage / DB | Supabase Postgres: `profiles`, `subscriptions`, `teams`, `team_members`, `usage_events`, `processed_stripe_events`, `ip_rate_events` | `supabase/migrations/001-012` |
| User data | email, password hash (Supabase), Stripe customer id, subscription status, usage events, support email; product data (prompts/transcripts/code) per product config; merch buyers' name + shipping address + email → Printful | `app/privacy/page.tsx:28-43`, `webhook/route.ts:239-252` |
| Admin tooling | `scripts/comp-access.mjs` — grant/revoke tier by email via service role | `scripts/comp-access.mjs` |

### 1b. ship-aos (local app)

| Dimension | Detail | Evidence |
|---|---|---|
| Purpose | Local "Ship AOS" dashboard — journal/goals/memory/kanban + CLI-agent chat panes (Claude, ChatGPT/Codex, Hermes, OpenClaw) + a Stripe "vitals" view | `ship-aos/src/app/*` |
| Framework | Next.js, `next dev --port 3737` (localhost-bound, no `-H 0.0.0.0`) | `ship-aos/package.json:6` |
| Auth | **None** on any API route | `ship-aos/src/app/api/**` (no `getUser`/session checks) |
| Shell exec | `/api/run` is allowlist-gated (regex per agent); `/api/claude/chat` and `/api/chatgpt/chat` spawn CLI binaries with user prompts | `src/app/api/run/route.ts:7-29`, `src/app/api/claude/chat/route.ts:21`, `src/app/api/chatgpt/chat/route.ts:30` |
| Stripe | Accepts and stores a **live** secret key locally (`sk_live_`/`rk_live_` accepted) at `~/.ship-aos/stripe.json` (chmod 600) | `src/app/api/stripe/key/route.ts:11-23`, `src/lib/stripe/local.ts:16-42,55-75` |

---

## 2. DATA FLOWS

| Flow | Origin → Destination | PII | Retention | Controls | Responsible party |
|---|---|---|---|---|---|
| Signup/login | Browser → Supabase Auth | email, password | Until deletion | Supabase-managed hash; 8-char min client-side (`app/signup/page.tsx:38`) | Site + Supabase |
| Subscription checkout | Browser → `/api/stripe/checkout` → Stripe → webhook → Supabase `profiles`/`subscriptions` | email, Stripe customer id | While account active | Auth required (`checkout/route.ts:74-78`), IP rate-limit, webhook sig-verify | Site + Stripe |
| Merch checkout | Browser cart (variantId+qty only) → `/api/stripe/merch-checkout` → Stripe Checkout (collects shipping) → webhook → Printful order | buyer name, full shipping address, email | Printful retains per its policy; Stripe retains payment | Server-authoritative pricing (`merch-checkout/route.ts:16-18,119-122`); webhook fulfills (`webhook/route.ts:239-252`) | Site + Stripe + Printful |
| AI chat | Browser → `/api/chat/{provider}` → provider API w/ **server-held** key | prompt content, user id logged | `usage_events` rows | Auth-gated + rate-limited + usage-logged (`lib/api/chat-gate.ts`) | Site (pays for tokens) |
| CLI login | Browser session → `POST http://localhost:{port}/callback` (local ShipCode CLI) | access/refresh token, email, user id | Local CLI store | Tokens sent only to localhost port from query param | Site + local CLI |
| Token verify | CLI → `/api/auth/verify` → Supabase → echoes back caller's own `email`, `user_id`, `tier` | email, user id (caller's own, post-JWT-validation) | none | Rate-limited, body-size capped, JWT validated first | Site |
| Error reports | App → Sentry | stack traces, device/app metadata | Sentry policy | disclosed | Site + Sentry |

---

## 3. SECURITY

| # | Finding | Severity | Evidence |
|---|---|---|---|
| S-1 | **ship-aos: no auth on any API route + stores live Stripe secret key + spawns CLI agents.** On localhost (default bind, port 3737) this is acceptable; it becomes **Critical** if ever run with `-H 0.0.0.0`, behind a tunnel, or deployed — any LAN/remote client could read the live Stripe token surface and drive `/api/*/chat` to spawn local CLI processes with arbitrary prompts. | High (Critical if network-exposed) | `ship-aos/src/app/api/**` (no auth), `src/app/api/stripe/key/route.ts:11`, `src/lib/stripe/local.ts:55-75`, `src/app/api/claude/chat/route.ts:21`, `ship-aos/package.json:6` |
| S-2 | Hardcoded owner-bypass identities grant `team` tier to two email addresses regardless of DB state. Mitigated by `email_confirmed_at` requirement (closes the unconfirmed-signup impersonation hole). | Low (mitigated) | `lib/auth/owner.ts:3-6,15-21`; used in `lib/auth/subscription.ts:32`, `api/auth/verify/route.ts:93` |
| S-3 | Stripe subscription webhook writes `status:'active'` for `checkout.session.completed` **without re-reading the subscription from Stripe**, and there is **no `invoice.payment_failed` / dunning handler**. A failed first/renewal invoice does not downgrade until `customer.subscription.updated/deleted` fires. Partially mitigated by `customer.subscription.updated` syncing `sub.status` and `charge.refunded` revoking access. | Medium | `webhook/route.ts:113-121` (hardcoded active), no `invoice.payment_failed` branch; mitigations at `:135-188` |
| S-4 | Stripe checkout error responses include `code` from Stripe; checkout logs key mode/length. Low info-leak. | Low | `checkout/route.ts:181-218` |
| S-5 | In-memory IP rate limiter is per-serverless-instance; mitigated for money paths by DB-backed `reserve_ip_request` (migration 012) used by checkout. | Low (mitigated) | `lib/api/ip-rate-limit.ts`, `supabase/migrations/012`, `checkout/route.ts:65` |
| S-6 | comp-access admin tool uses service role to set tiers; refuses to touch accounts with a Stripe customer id (good guard). | Low | `scripts/comp-access.mjs:74-81` |
| S-7 | Server-paid AI keys (`ANTHROPIC/OPENAI/GOOGLE/DEEPSEEK_API_KEY`) exposed via authed chat API — token-cost abuse surface, but auth + rate-limit + usage-log gated. | Low (mitigated) | `lib/api/chat-gate.ts:8-12`, `app/api/chat/*/route.ts` |

**Positives:** webhook signature verification + idempotency via `processed_stripe_events` (`webhook/route.ts:51-74`, migration 011); merch pricing is server-authoritative (no client price tampering); open-redirect guards on `return_to`/`redirectTo` (`checkout/route.ts:97`, `signup/page.tsx:23-28`); RLS-locked admin tables (migrations 008/011/012). No committed secrets — only `.env.example` is git-tracked; real `.env.local`/`.env.production.local` are gitignored.

---

## 4. PRIVACY

| # | Finding | Severity | Evidence |
|---|---|---|---|
| P-1 | **Privacy Policy promises Access / Export (JSON) / Delete rights, but NO implementing API route or code exists.** Fulfillment is manual-email-only (`privacy@…`, "within 30 days"). Terms also says users can "delete your account at any time" — no self-serve mechanism. GDPR Art 15/17 + CCPA exposure if the manual process is not actually staffed. | Medium | Promise: `app/privacy/page.tsx:75-88`; Terms: `app/terms/page.tsx:154`; **no** route in `app/api/**` (grep for delete/export/account/me/gdpr returns nothing) |
| P-2 | No cookie/consent banner; policy claims "no tracking cookies / no third-party analytics" — must hold true in production for the claim to be accurate. | Low | `app/privacy/page.tsx:90-94` |
| P-3 | `/api/auth/verify` returns caller's `email` + `user_id` — but only after validating the caller's own JWT, so it returns the requester's own identity, not a leak. | Low | `api/auth/verify/route.ts:95-100` |
| P-4 | Printful **is** disclosed as a merch-fulfillment subprocessor (good), but Terms §9's third-party list omits Printful (lists Stripe/Supabase/Sentry/AI only). Minor inconsistency. | Low | Disclosed: `app/privacy/page.tsx:60`; omitted in `app/terms/page.tsx:130-136` |
| P-5 | Merch buyers' name + full shipping address + email flow to Printful; disclosed in Privacy but no DPA/subprocessor list page. | Low | `webhook/route.ts:239-252`, `lib/printful/order.ts:47-58` |

---

## 5. LIABILITY / LEGAL

| # | Finding | Severity | Evidence |
|---|---|---|---|
| L-1 | **Refund policy is internally CONSISTENT — no contradiction.** Terms §5 "All sales are final. We do not offer refunds" matches pricing copy "No refunds" and FAQ. **No** "7-day money-back"/"guarantee" exists anywhere in the site. (Prior memory of a refund contradiction does not hold against current source.) NOTE: a flat "no refunds, all sales final" stance is itself partially unenforceable in jurisdictions with mandatory consumer-withdrawal/chargeback rights; Terms §5 hedges with "unless required by applicable law." | Low | `app/terms/page.tsx:79-103`; `app/pricing/page.tsx:19,37,221,296`; refund grep finds no guarantee |
| L-2 | **No ToS/Privacy acceptance gate (no checkbox, no "by signing up you agree" link) at signup, login, pricing, or CLI login.** Weakens enforceability of the Terms (incl. the liability cap and arbitration-style governing-law clause). | Medium | `app/signup/page.tsx` (no agree text), `app/auth/cli-login/page.tsx`, `app/pricing/page.tsx` — grep for "agree to/accept terms/i agree" returns nothing |
| L-3 | **Auto-renewal disclosure is weak at point of sale.** Terms §4 discloses auto-renew + easy cancel (good for the ToS), but the checkout/pricing CTA ("Join the Workshop") shows only "Cancel anytime · No refunds · Secure checkout"; it does not present a clear, conspicuous auto-renewal disclosure adjacent to the purchase button as CA ARL / FTC click-to-cancel expects. No intro-discount auto-renew present. | Medium | Terms: `app/terms/page.tsx:53-63`; checkout CTA: `app/pricing/page.tsx:198-222` |
| L-4 | **Placeholder governing law / jurisdiction.** "the state in which MakeShipHappen is registered" — no state is actually named, so the venue clause is indeterminate/unenforceable as written. | Medium | `app/terms/page.tsx:167-171` |
| L-5 | **Regulated-data marketing claim: "ferpa-safe" / FERPA shield** on the ShipMind "schools" mockup. FERPA compliance is a substantive legal posture (school-as-data-controller, contractual "school official" status). Asserting "FERPA-safe" without a documented basis is a UDAP/§5 false-advertising risk. | High | `app/v3/shipmind/sections/mockups/BuiltForVisuals.tsx:239,381,392` |
| L-6 | **Performance warranty: "<500ms Latency … Faster than typing."** Absolute performance claim presented as a stat; substantiation risk under FTC §5 if not consistently met across hardware. | Medium | `app/page.tsx:2954,2989`; `app/v3/page.tsx:2941,2976` |
| L-7 | **Security warranties:** "Cloud mode encrypts over HTTPS," "AES-256 encryption at rest," "Encrypted at rest." Concrete security representations that create breach-of-warranty / §5 exposure if not literally true for every path. | Medium | `app/page.tsx:2990`; `app/v3/shipwatch/sections/Features.tsx:149-151`, `Capabilities.tsx:269,305`, `Stack.tsx:33`, `Hero.tsx:117` |
| L-8 | **Comparative ad naming competitor trademarks** (NotebookLM, ChatGPT/Claude, Obsidian) with ✓/✗ capability table marking competitors "no" on local-first/BYO-keys/etc. Comparative advertising naming trademarks is permissible if claims are truthful and substantiated; several "no" cells are factual posture claims that should be defensible, but the table invites trademark/false-comparison challenge if any cell is inaccurate. | Medium | `app/v3/shipmind/sections/TrustBand.tsx:31-41` |
| L-9 | Pricing/Terms advertise a **single $50/month plan**, but the checkout backend supports `pro` + `team`/`ultra` and monthly + annual. Not a consumer-facing contradiction (site only sells `pro monthly`), but Terms §4 "single membership plan at $50/month" understates backend capability and would be inaccurate the moment Team/annual is sold. | Low | Advertised: `app/terms/page.tsx:54`, `app/pricing/page.tsx:24-29,156`; backend tiers: `app/api/stripe/checkout/route.ts:11-61` |
| L-10 | comp-access grants have **no auto-expiry** — a comped tier persists until a human runs `revoke`. Operational/over-grant risk, not a legal claim per se. | Low | `scripts/comp-access.mjs:5-7` |

---

## 6. USER RESPONSIBILITY (per feature)

| Feature | User responsibility | Clear? | Evidence |
|---|---|---|---|
| ShipCode generated code | "solely responsible for reviewing, testing… do not use in safety-critical systems" | Clear | `app/terms/page.tsx:138-144` |
| BYO AI provider keys | Use governed by that provider's terms | Clear | `app/privacy/page.tsx:41`, `app/terms/page.tsx:130-136` |
| Local device data | Account deletion does NOT delete local files | Clear | `app/privacy/page.tsx:42,72` |
| Age eligibility | Must be 18 (general Terms/Privacy) | Stated but **not enforced** at signup; inconsistent with extension policy "under 13" → see §8 | `app/terms/page.tsx:44`, `app/privacy/page.tsx:96-99` |
| Subscription cancellation | Self-serve "from your account settings" | Asserted in copy; self-serve cancel UI not verified in scope | `app/terms/page.tsx:58-60`, `app/pricing/page.tsx:29` |

---

## 7. MARKETING CLAIMS (quoted, file:line)

- `app/page.tsx:2989` — "**<500ms Latency** … End-to-end transcription in under half a second. **Faster than typing.**"
- `app/page.tsx:2990` — "Privacy-First … Local mode keeps audio on-device. **Cloud mode encrypts over HTTPS.** You choose."
- `app/page.tsx:2954` — stat `<500ms` "End-to-end latency".
- `app/v3/page.tsx:2976-2977` — duplicate of the above (<500ms / faster than typing / encrypts over HTTPS).
- `app/v3/shipmind/sections/mockups/BuiltForVisuals.tsx:392` — "**ferpa-safe**" badge (schools use case); `:239,381` FERPA shield.
- `app/v3/shipwatch/sections/Features.tsx:151` — "**Local SQLite vault with AES-256 encryption at rest**".
- `app/v3/shipwatch/sections/Capabilities.tsx:269` — "**AES-256 ENCRYPTED**"; `:305` "Encrypted at rest **and in transit**".
- `app/v3/shipwatch/sections/Stack.tsx:33` / `Hero.tsx:117` — "Encrypted at rest".
- `app/v3/shipmind/sections/TrustBand.tsx:31` — comparison columns `['ShipMind','NotebookLM','ChatGPT / Claude','Obsidian']`; rows mark competitors ✗ on local-first/local-AI/BYO-keys (`:34-41`).
- `app/pricing/page.tsx:33` — "**It won't stay here forever**" (contributor/founding-price urgency — fine, but a price-increase representation; Terms commits to 14-day notice `terms:61-62`).

---

## 8. LICENSES / DEPS / SECRETS / MISC

| Item | Finding | Evidence |
|---|---|---|
| Committed secrets | **None.** `makeshiphappenAi` is its own git repo; `git ls-files` shows only `.env.example` (all placeholders). Real `.env.local`, `.env.production.local` present on disk but gitignored (`.env.*` + `!.env.example`). ship-aos tracks only `.env.local.example`. | `makeshiphappenAi/.env.example`, `makeshiphappenAi/.gitignore` |
| Supabase anon key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` exposed to browser **by design**; security relies on RLS. RLS locked on billing/profile/admin tables. | `lib/supabase/client.ts:4-6`, migrations 008/011/012 |
| Pending migrations 010-012 | **010** fixes invite-activation-before-email-confirmation privilege escalation (team-tier theft); **011** adds Stripe webhook idempotency table; **012** adds atomic cross-instance IP rate limiter for checkout. All present in repo (appear applied). | `supabase/migrations/010,011,012` |
| cli-login "state echo" | The `cli-login` page POSTs Supabase tokens to `http://localhost:{port}/callback` from the `port` query param. No state-echo/CSRF-state mechanism visible here; flow trusts the localhost port. (Prior memory referenced a "state echo" route — not present/needed in this client-side flow.) | `app/auth/cli-login/page.tsx:28-50` |
| Age inconsistency | General site = **18** (`terms:44`, `privacy:97`); ShipMind browser-extension privacy = "**not directed at children under 13**" (COPPA framing). Inconsistent minimum age across properties. | `app/terms/page.tsx:44`, `app/privacy/page.tsx:96`, `app/privacy/shipmind-extension/page.tsx:110` |
| Accessibility statement | **None.** No WCAG/ADA accessibility statement page (grep "accessibility/wcag/ada" yields only attribute/aria false matches). | — |
| Fulfillment defect history | Not derivable from source; merch fulfillment path retries via Stripe re-delivery on Printful failure (`webhook/route.ts:86-94`). | `webhook/route.ts:198-260` |

---

## Highest-severity summary

- **High** — ship-aos no-auth + live Stripe key + CLI-spawn (Critical if network-exposed) — `ship-aos/src/app/api/**`, `stripe/key/route.ts:11`, `claude/chat/route.ts:21`.
- **High** — "FERPA-safe" regulated-data marketing claim w/o basis — `BuiltForVisuals.tsx:392`.
- **Medium** — Privacy promises export/delete; no implementing route (manual-only) — `privacy/page.tsx:75-88`.
- **Medium** — No ToS-acceptance gate at signup/checkout — `signup/page.tsx`.
- **Medium** — Placeholder governing-law/venue (no state named) — `terms/page.tsx:167-171`.
- **Medium** — Weak point-of-sale auto-renew disclosure (ARL/click-to-cancel) — `pricing/page.tsx:198-222`.
- **Medium** — Webhook hardcodes `status:'active'`, no `invoice.payment_failed`/dunning — `webhook/route.ts:113-121`.
- **Medium** — Security warranties (AES-256 / encrypts-over-HTTPS) — `page.tsx:2990`, `shipwatch/.../Features.tsx:151`.
- **Medium** — Performance warranty "<500ms / faster than typing" — `page.tsx:2989`.
- **Low** — comp-access no auto-expiry — `scripts/comp-access.mjs:5-7`.
