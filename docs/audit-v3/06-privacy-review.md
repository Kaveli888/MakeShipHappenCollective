# Phase 6 — Privacy Review

**Audit type:** Read-only privacy & data-protection review
**Scope:** ShipTalk, ShipMind, ShipSpace, makeshiphappen.tech website
**Date:** 2026-06-07
**Reviewer role:** Senior auditor / SaaS-privacy & technology attorney / compliance officer
**Data controller / responsible party (all products):** MakeShipHappen (single operator — Jake / zzgemsjewelry@gmail.com)

> **Method note.** This is an evidence-based, read-only review. Every claim below is grounded either in the recon/data/integration findings supplied to this phase or in code I read directly during the review. Direct code confirmations are flagged **[verified]**. No source code was modified.

---

## 1. Executive Summary

The Ship Ecosystem collects and processes some of the most sensitive categories of personal data a software product can touch: **raw microphone audio, full speech transcripts, personal "second brain" notes, ingested documents/images, source code, and shipping/billing PII.** Three of the four products are local-first desktop apps (ShipTalk, ShipMind, ShipSpace); the website is a server-proxied SaaS hub.

The single most consequential, cross-cutting privacy finding is that **there is no functioning data-deletion or data-export capability anywhere in the codebase.** The website's documented Access/Export/Delete rights resolve to a *manual email* to `privacy@makeshiphappen.tech` with no backing API, script, or RPC **[verified — `app/deletion-export/page.tsx`, `app/privacy/page.tsx`]**. In the desktop apps, deletion is partial-at-best: ShipTalk's transcript-delete UI is wired up in the component but **never rendered** (the `onDeleteItem` prop is omitted at `App.tsx:264`) and **no Supabase transcript row is ever deleted** **[verified]**; ShipMind's `delete_transcript`/`delete_source` delete only the DB row and **orphan the on-disk audio/image files forever** **[verified — `lib.rs:3294`]**.

Compounding this, the most sensitive corpora are stored **unencrypted at rest in plaintext** (ShipTalk's WebKit-localStorage transcript history, ShipMind's `shipmind.db` + backups, ShipSpace's terminal scrollback in localStorage) with **no retention, TTL, or pruning logic** — the practical retention policy is "forever." Each app also ships an unauthenticated companion MCP server that exposes this plaintext corpus (and, in ShipTalk's case, the live Supabase session token) to any local agent.

Finally, there is a material **gap between marketed behavior and actual behavior**: both ShipTalk ("100% on-device") and ShipMind ("stays on your machine… no third-party processor reading your files") make strong privacy/locality claims that are contradicted in code by direct client-to-vendor egress of audio, transcripts, and document content to up to 7–11 third-party AI providers — a contradiction the engineering team has itself flagged in `ShipTalk/src-tauri/Cargo.toml:28-30` **[verified]**.

---

## 2. Data Inventory — What Is Collected, Stored, Transmitted

The table below maps each product's personal-data categories. "Special-category-adjacent" = data that, depending on what a user dictates/ingests, can contain health, biometric (voice), financial, or otherwise sensitive content.

| Data category | ShipTalk | ShipMind | ShipSpace | Website |
|---|---|---|---|---|
| **Voice/microphone audio** | Yes (live + uploaded files) | Yes (voice notes, audio/video) | Yes (dictation/realtime) | — |
| **Speech transcripts** | Yes (raw + Claude-polished) | Yes (time-aligned, speaker-labeled) | Yes (transcripts) | — |
| **Personal notes / "second brain" content** | Dictionary terms, polish presets | Yes (notes, bookmarks, sources, web/file/image content) | Ship Memory note bodies | — |
| **Source code / local files** | App identity of other apps | File/image contents (read) | Yes (read/write/exec) | — |
| **Account credentials** | Email/password (Supabase) | Email/password (Supabase) | Email/password (Supabase) | Email/password (Supabase Auth) |
| **Session tokens (JWT)** | Plaintext localStorage | localStorage | localStorage | Cookie + cli-login relay |
| **Subscription/billing identity** | Tier (client-side) | Tier | Tier | Stripe customer/subscription IDs |
| **Payment / card data** | — | — | — | Stripe-hosted (never on server) |
| **Shipping name + postal address** | — | — | — | Yes → Stripe → Printful |
| **Client IP addresses** | — | — | — | Yes (`ip_rate_events`, no TTL) |
| **AI chat content** | Transcript → Anthropic | Full corpus → chosen provider | Code/prompts → chosen provider | Chat msgs → provider (proxied) |
| **Cross-app/usage metadata** | Frontmost-app identity (logged) | `ingest_debug.log` (file paths) | crash/lifecycle/pty logs | `usage_events` (metadata only) |
| **Special-category-adjacent risk** | **High** (free-form voice) | **High** (free-form voice + docs) | **High** (any file) | Low–Medium |

### 2.1 Storage-at-rest posture

| Product | Primary sensitive store | Encrypted at rest? | Retention/pruning? |
|---|---|---|---|
| ShipTalk | `shiptalk-history` (WebKit localStorage SQLite) — full transcripts plaintext | **No** | **No** (explicitly "survives reinstall") |
| ShipTalk | Provider API keys | **Yes** (macOS keychain) | n/a |
| ShipMind | `shipmind.db` + `backups/*.db` (transcripts, notes, sources, chat) | **No** (plaintext rusqlite, no SQLCipher) | **No** (backups never pruned) |
| ShipMind | Provider API keys | **Yes** (macOS keychain, allowlisted) | n/a |
| ShipSpace | Terminal scrollback + agent chat (localStorage SQLite) | **No** | **No** |
| ShipSpace | Provider API keys | **Yes** (macOS keychain) | n/a |
| Website | Supabase Postgres (profiles, subs, usage_events, ip_rate_events) | Provider-managed (Supabase) | **No automated retention** |
| Website | Card data | n/a (Stripe-hosted) | n/a |

**Positive control (all desktop apps):** Provider API keys are correctly isolated in the macOS keychain rather than in plaintext config/localStorage. The website never persists provider keys client-side and never stores passwords or card data. These are the right designs and stand in contrast to the plaintext content stores.

---

## 3. Data-Retention Analysis

**Severity: High (ecosystem-wide).**

There is **no retention or TTL logic in any product** for the sensitive data classes:

- **ShipTalk** — transcript history grows unbounded in plaintext; the code comment at `App.tsx:85` explicitly notes it "survives app restarts/reinstalls." No age cap, size cap, or rotation. `/tmp/shiptalk-follow.log` accumulates cursor/activity diagnostics with no rotation.
- **ShipMind** — `backup_db` writes full plaintext DB copies to `<appdata>/backups/` and never prunes; `ingest_debug.log` is append-only; archived audio and source images accumulate; deleted transcripts/sources orphan their files. No expiry anywhere.
- **ShipSpace** — terminal scrollback (which routinely captures typed secrets/tokens), agent chat, dropped files, browser captures, and crash/lifecycle logs persist indefinitely with no cleanup.
- **Website** — `usage_events`, `ip_rate_events`, `team_members`, `processed_stripe_events`, and Stripe-derived billing identifiers are append-only with no cron/TTL. The privacy policy promises deletion/anonymization "within a reasonable period" (`app/privacy/page.tsx:70-75`) but **no code enforces it** **[verified]**.

**Legal exposure.** GDPR Art. 5(1)(e) (storage limitation) and Art. 5(1)(c) (data minimisation) require defined retention periods proportionate to purpose. CCPA/CPRA §1798.100(c) similarly bars retention beyond disclosed purpose. A "private second brain" / "on-device" product that in practice keeps voice transcripts and personal notes forever, in cleartext, with no retention schedule, is squarely misaligned with both regimes and with its own marketing posture.

---

## 4. User-Deletion (Right to Erasure) Analysis

**Severity: High (ecosystem-wide).**

| Product | Deletion capability in code | Gap |
|---|---|---|
| **ShipTalk** | Delete button exists in `HistoryView` but `onDeleteItem` is **not passed** at `App.tsx:264`, so it never renders. No `localStorage.removeItem('shiptalk-history')`. **Zero** `transcriptions.delete()` calls — cloud rows can never be removed. **[verified]** | No working local OR cloud transcript deletion. |
| **ShipMind** | `delete_transcript` / `delete_source` delete only the DB row; archived audio (`<appdata>/audio/`) and copied images (`<appdata>/source_images/`) are **never removed**. **[verified — `lib.rs:3294-3299`]** | Deletion is incomplete — the most sensitive data (raw voice audio, document/image copies) survives the user's delete action. |
| **ShipSpace** | No "clear history" for scrollback or agent chat; sessions persist until manually overwritten. Ship Memory panel is read-only and cannot delete notes. | No user-facing deletion of conversation/scrollback data. |
| **Website** | No `/api` route, script, or RPC for account/data deletion. `comp-access.mjs` only flips `subscription_tier`. The only path is a manual email to `privacy@` **[verified — `app/deletion-export/page.tsx:9-16`]**. | Documented erasure right has **no technical implementation**; relies on manual operator action with no audit trail. |

**Legal exposure.** GDPR Art. 17 (right to erasure) and CCPA/CPRA §1798.105 (right to delete) require the controller to actually delete on verified request. A manual-email process is *legally permissible* if reliably executed within statutory timelines, but here it is the *only* mechanism, it is unaudited, and the desktop apps cannot themselves erase the data they hold — so even a diligent operator cannot fully honor an erasure request through the products. ShipTalk's broken delete UI and ShipMind's orphan-on-delete are erasure-completeness failures that a regulator or plaintiff could treat as the product representing a deletion capability it does not actually deliver.

**Mitigating credit:** The website's `deletion-export` page is honest that "Account deletion does not automatically remove local files" and suggests manual local cleanup — good transparency, but it does not cure the absence of a programmatic deletion path.

---

## 5. User-Export (Right to Data Portability/Access) Analysis

**Severity: Medium–High (ecosystem-wide).**

- **No export endpoint, command, or function exists in any product.** The website "Export" right (`app/privacy/page.tsx:83`) again resolves only to a manual email request **[verified]**.
- ShipTalk's History view allows per-item copy-to-clipboard, and ShipMind/ShipSpace data physically lives in user-readable SQLite files on the user's own machine — so a technically sophisticated user *could* extract their own local data. That is not, however, a portability mechanism in the GDPR Art. 20 sense (structured, commonly-used, machine-readable export on request).
- The website holds the canonical account record (profiles, subscriptions, usage_events, team membership, Stripe identifiers) and offers **no automated way to assemble and deliver** that to a user.

**Legal exposure.** GDPR Art. 15 (access) and Art. 20 (portability), CCPA/CPRA §1798.110/§1798.130 (right to know/portable disclosure). The obligation is satisfiable manually within statutory windows, but the absence of any tooling makes timely, complete, verifiable responses operationally fragile for a single-operator business.

---

## 6. Marketed-vs-Actual Behavior Inconsistencies

This is the highest-priority *legal* category — misrepresentation of privacy behavior is independently actionable (FTC Act §5 "unfair/deceptive," state UDAP statutes, EU consumer law) separate from GDPR/CCPA.

| # | Marketed claim | Actual behavior (evidence) | Severity |
|---|---|---|---|
| **MC-1** | **ShipTalk "100% on-device."** | Groq/OpenAI cloud STT send **raw audio** off-device; Anthropic polish sends **raw transcript text** off-device; Web Speech may route audio to Apple. The team's own `Cargo.toml:28-30` comment states the HTTP plugin "contradicts the 100% on-device marketing claim." **[verified]** Cloud is gated behind a default-OFF toggle, but the absolute "100%" framing is false once any cloud engine is enabled. | **High** |
| **MC-2** | **ShipMind "stays on your machine… no upload step, no sync server, no third-party processor reading your files"** (`docs/shipmind-product-copy.md:46,68`). **[verified]** | Full transcript/source/note/image content is egressed directly from the webview to whichever of ~8 cloud AI providers the user configures (Anthropic/OpenAI/Google/Groq/DeepSeek/Perplexity/OpenRouter/Manus), plus Brave web-search queries and Supabase auth. The "local-first by default … cloud is optional and clearly labeled" framing (line 13) is defensible *only if* cloud egress is in fact clearly labeled in-app; the absolute "no third-party processor reading your files" sentence is contradicted whenever a cloud model is used. | **High** |
| **MC-3** | Website privacy policy lists **Sentry, Groq, OpenRouter, Ollama** as sub-processors. | None of these appear in the website's server-side code (no Sentry SDK; only Anthropic/OpenAI/Google/DeepSeek chat routes exist). The sub-processor list is **over-inclusive** (names services not used) and the policy frames AI as "BYO… governed by that provider's terms" when the website actually **holds the keys and forwards user content** — making it the controller/sender. | **Medium** |
| **MC-4** | Website discloses sub-processors but **omits DeepSeek**, a China-based provider that receives user prompt content (`app/api/chat/deepseek/route.ts:15`). | Under-inclusive sub-processor disclosure + undisclosed international transfer to a jurisdiction with materially different data-protection norms. No residency control or opt-out. | **High** |
| **MC-5** | Implicit "your data is private" posture across apps. | Each app ships an **unauthenticated MCP server** exposing the plaintext corpus to any local agent; ShipTalk's additionally exposes the live Supabase session token (`shiptalk-auth`). This is a privacy-expectation gap rarely surfaced to users. | **High** |

---

## 7. Third-Party / Sub-Processor Data Flows (Privacy Lens)

The complete absence of a published, accurate **sub-processor list** is a recurring GDPR Art. 28/Art. 13(1)(e) gap. Personal data leaves the ecosystem to:

- **AI providers (data = audio, transcripts, notes, code, images):** Anthropic, OpenAI, Google Gemini, Groq, DeepSeek, Perplexity, OpenRouter, Manus, xAI, plus Apple (Web Speech). Calls are **direct client-to-vendor (BYOK)** in the desktop apps (no proxy), and **server-proxied** on the website. Each vendor independently retains/processes content per its own terms — outside MakeShipHappen's control and undisclosed in a data map.
- **Supabase** — identity, transcripts (ShipTalk), profiles; the central PII store. Cross-tenant isolation depends **entirely on RLS** (anon key is public); dictionary_terms read with no `user_id` filter is a flagged must-verify.
- **Stripe + Printful** — billing identity and **shipping PII (name + full postal address + email)** flow web → Stripe → Printful with **no MakeShipHappen-side record and no deletion/export coverage** of fulfillment data living at Printful.
- **Hugging Face** — model-binary downloads (no transcript data, but a supply-chain integrity gap: no checksum/signature verification).
- **makeshiphappen.tech** — updater + login redirect (first-party).

**No telemetry/analytics SDK** (PostHog/Sentry/Mixpanel/etc.) was found in ShipMind or the website code — a genuine positive: there is no silent behavioral-analytics exfiltration. (Note this contradicts the privacy policy's Sentry disclosure — see MC-3.)

---

## 8. Cross-Cutting Confidentiality Exposures (Privacy-Relevant)

| Finding | Product(s) | Severity |
|---|---|---|
| **Plaintext, unencrypted-at-rest sensitive corpus** captured by OS backup/sync (iCloud/Time Machine) automatically | ShipTalk, ShipMind, ShipSpace | High |
| **Unauthenticated MCP server** exposes full corpus to any local agent | All three desktop apps | High |
| **ShipTalk MCP exposes live Supabase session token** (`get_state_raw` → `shiptalk-auth`) enabling account impersonation | ShipTalk | Critical |
| **`/auth/cli-login` relays live access+refresh tokens** to an unvalidated localhost port (session exfiltration) **[verified — `cli-login/page.tsx:9,35-40`]** | Website | High |
| **Frontmost-app identity logged** (which apps the user uses) with no scrubbing | ShipTalk | Low |
| **Client IPs persisted with no TTL** and **not disclosed** in privacy "What We Collect" | Website | Medium |
| **Gemini API key transmitted in URL query string** (leaks to logs/history) | ShipMind | Low |

---

## 9. GDPR / CCPA-CPRA Obligation Matrix

| Obligation | Status | Evidence |
|---|---|---|
| **Lawful basis / transparency** (GDPR Art. 6, 13) | Partial — privacy policy exists but is inaccurate (MC-3/MC-4) and apps lack in-app data-flow disclosures | `app/privacy/page.tsx` |
| **Data minimisation** (Art. 5(1)(c)) | Fail — unbounded plaintext retention of voice/notes; broad app-identity & IP collection | §3 |
| **Storage limitation** (Art. 5(1)(e)) | Fail — no retention schedule anywhere | §3 |
| **Right of access / portability** (Art. 15/20; CCPA right to know) | Fail — no export tooling | §5 |
| **Right to erasure** (Art. 17; CCPA right to delete) | Fail — no/partial deletion paths | §4 |
| **Integrity & confidentiality** (Art. 5(1)(f), Art. 32) | Partial — keys in keychain (good) but corpus plaintext + unauth MCP (bad) | §8 |
| **Sub-processor disclosure** (Art. 28, Art. 13(1)(e)) | Fail — no accurate sub-processor list; DeepSeek undisclosed | §6, §7 |
| **International transfers** (Art. 44–49) | Fail — DeepSeek (China) undisclosed, no SCCs/TIA, no residency control | MC-4 |
| **Special-category data** (Art. 9) | Risk — voice/notes can contain Art. 9 data with no handling provisions | §2 |
| **No-sale/no-share & opt-out** (CCPA/CPRA) | Likely OK on "sale," but BYOK AI sharing should be addressed in policy | §7 |

---

## 10. Prioritized Recommendations (advisory — no code changed)

1. **Implement real deletion & export** (Critical). Add: website account-deletion/export endpoints (or a documented, audited operator runbook with logging); fix ShipTalk's delete UI (`App.tsx:264`) and add Supabase transcript deletion; make ShipMind `delete_transcript`/`delete_source` remove orphaned audio/image files; add "clear history/data" controls to ShipSpace.
2. **Define and enforce retention** (High). Add configurable retention/pruning for transcript history, DB backups, scrollback, logs, and `ip_rate_events`; default to a finite window.
3. **Encrypt the at-rest corpus** (High). Move ShipMind to SQLCipher (or OS-level protection) and apply equivalent protection to ShipTalk/ShipSpace plaintext stores; at minimum exclude these stores from iCloud/Time Machine by default.
4. **Authenticate the MCP servers** and remove ShipTalk's token-readable `get_state_raw` allowlist gap (Critical/High).
5. **Reconcile marketing with reality** (High). Either qualify "100% on-device"/"no third-party processor" claims (e.g., "local-first; cloud features opt-in and clearly labeled") or restrict to truly-local engines. Add an in-app data-flow/sub-processor disclosure.
6. **Fix the sub-processor list** (High). Remove unused processors (Sentry/Groq/OpenRouter/Ollama if truly absent), add DeepSeek with an international-transfer notice and ideally an opt-out/residency control; disclose IP collection.
7. **Harden the cli-login relay** (High). Bind to loopback with a PKCE/nonce and a port allowlist to stop session-token capture.

---

## 11. Top Risks (for executive report)

See `StructuredOutput.topRisks`. The headline privacy risks are: (1) no working deletion/export anywhere (erasure/portability failure); (2) indefinite plaintext retention of voice transcripts and personal notes; (3) ShipTalk MCP leaking the live Supabase session token; (4) marketed "on-device"/"private" behavior contradicted by undisclosed cloud egress; (5) undisclosed international transfer to DeepSeek (China).
