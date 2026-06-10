# Phase 5 — Terms of Service Review & Recommendations

**Audit:** MakeShipHappen Collective — V3 Whole-Ecosystem Audit
**Phase:** 5 of N — Terms of Service (ToS) / EULA Drafting Recommendations
**Products in scope:** ShipTalk (desktop), ShipMind (desktop), ShipSpace (desktop), makeshiphappen.tech (website + billing + auth)
**Prepared by:** Senior Auditor + SaaS/Privacy/Technology Counsel + Compliance Officer (read-only review)
**Date:** 2026-06-07

> **Scope & disclaimer.** This document delivers *recommendations and drafting guidance* — not final, executable legal text. Every recommendation is tied to a specific platform capability evidenced in the audited code (cited as `file:line` where available). Privacy-policy and data-processing-agreement specifics are covered in their own phases; here we focus on the **Terms of Service / End-User License Agreement** instrument(s). Engage qualified counsel in each operating jurisdiction before publishing. Nothing here is legal advice to the reader.

---

## 1. Executive Summary

MakeShipHappen currently ships **four commercial, paid products with no Terms of Service, no EULA, and no license-of-record** (Cargo.toml `license = ""`, `package.json` private with no license field, no in-app legal screen). This is the central governance gap of this phase: the company is selling software and processing user data — including voice recordings, full source code, and personal "second brain" corpora — under **zero contractual terms**.

The ToS surface is unusually high-risk for three structural reasons that recur across all four products:

1. **The products are deliberately high-privilege.** ShipSpace spawns real shells and runs autonomous agents with arbitrary code execution; ShipMind reads files across `$HOME`; ShipTalk injects keystrokes into other apps. A standard SaaS ToS is insufficient — these need desktop-EULA + agent-autonomy + acceptable-use language.
2. **AI output and third-party processing are core, not incidental.** Every product forwards user content to third-party AI providers (Anthropic, OpenAI, Google, Groq, DeepSeek, Perplexity, xAI) on the user's own keys or the platform's keys. This mandates AI-output disclaimers, no-warranty-on-AI clauses, and sub-processor acknowledgment.
3. **There is a material gap between marketing and reality** ("100% on-device" contradicted by cloud egress — self-flagged in `ShipTalk/src-tauri/Cargo.toml:28`), and **deletion/erasure rights are promised on the website but technically unenforced** (no deletion code path anywhere). A ToS that overstates capabilities or under-delivers on stated rights creates consumer-protection (FTC §5 / UK CMA / EU UCPD) and breach-of-contract exposure.

**Bottom line:** The single most urgent action is to **adopt and present a binding ToS + EULA + AI/AUP addendum at first run and at account creation**, with click-wrap acceptance recorded. The clauses below are prioritized by severity.

### Severity legend

| Severity | Meaning |
|---|---|
| **Critical** | Absence creates immediate, unbounded legal exposure (e.g., uncapped liability for AI-driven file deletion). Must exist before next paid release. |
| **High** | Significant exposure or a direct mismatch between conduct and (absent) promises. |
| **Medium** | Standard protective clause that a reasonable commercial product must carry. |
| **Low** | Hygiene / completeness / forward-looking. |

---

## 2. Cross-Cutting Finding: No Legal Instrument Exists

**Severity: Critical | Category: documentation / legal**

There is no ToS, EULA, or accepted license for any product. Evidence: `ShipTalk/src-tauri/Cargo.toml:6` (`license = ""`, `authors = ["you"]`); ShipMind/ShipSpace `package.json` private with no license; ShipSpace signed and sold as a Developer-ID binary (`tauri.conf.json` `signingIdentity`) with no EULA; website privacy/deletion pages reference rights but no ToS governs the relationship.

**Recommendation — instrument architecture.** Adopt a **layered contract set** rather than one monolithic document:

| Document | Applies to | Acceptance mechanism |
|---|---|---|
| **Master Terms of Service** | All products + website + account | Click-wrap at signup (website) |
| **Desktop EULA** (incorporated into ToS) | ShipTalk, ShipMind, ShipSpace binaries | First-run click-through ("I Agree" gate before app use) |
| **Acceptable Use Policy (AUP)** | All, esp. ShipSpace agents | Incorporated by reference |
| **AI & Third-Party Provider Addendum** | All AI features | Incorporated by reference; surfaced when enabling cloud features |
| **Subscription / Billing Terms** | Pro/Team tiers | Click-wrap at checkout (Stripe-adjacent) |

Record acceptance (timestamp, version hash, user id) so the contract is enforceable. For desktop apps, a first-run "I Agree" gate before any functional use materially strengthens enforceability of the EULA and liability caps.

---

## 3. Required Core ToS Clauses

### 3.1 Acceptance, eligibility, and account formation
**Severity: High | Category: legal**

The website creates accounts via Supabase Auth and a CLI-login token relay (`makeshiphappenAi/app/auth/cli-login/page.tsx`). There is no minimum-age, no capacity, and no acceptance-of-terms language anywhere.

- **Recommend:** binding-acceptance clause; age floor (≥18, or ≥16 + guardian consent for GDPR; ≥13 minimum under COPPA); representation of authority to bind (relevant for **Team tier**, where one purchaser binds others — `team_members`, `teams/invite`); and a clause that continued use after term changes constitutes acceptance, with notice for material changes.

### 3.2 Description of service & "as-is" availability
**Severity: Medium | Category: business**

- **Recommend:** describe each product factually and reserve the right to modify/discontinue features. Critically, **do not promise availability of third-party AI providers** — providers can be deprecated, rate-limited, or geo-blocked (e.g., DeepSeek is China-based; Perplexity/xAI requests are not even in the CSP/HTTP allowlist and may silently fail per the integrations findings). Disclaim any uptime/availability SLA unless one is contractually offered to Team customers.

### 3.3 Beta / experimental / "phantom" features
**Severity: Low | Category: business**

Several features are dead, mock, or unwired: ShipMind Chrome-extension ingest endpoint (`:8765`) has no listener; ShipSpace "Nano Banana" is a hardcoded mock returning canned strings; "Manus" has a key slot but no adapter; tool-calling/source-grounding only works on OpenAI (silent ungrounded answers on default Groq/Claude models). The website's LibraryGate paywall is client-side only.

- **Recommend:** a clause permitting beta/experimental features provided "as-is" with no warranty, and a general statement that not all advertised integrations are active in all builds. This blunts misrepresentation claims while these are stabilized.

### 3.4 Governing law, dispute resolution, severability, entire-agreement, assignment, notices
**Severity: Medium | Category: legal**

Standard but currently absent. **Recommend:** governing law/venue (owner is US-based; pick a US state); a class-action waiver and (optionally) binding arbitration with a small-claims carve-out and a consumer opt-out window; severability; entire-agreement; assignment (you may assign, user may not); electronic-notice mechanism.

---

## 4. Limitation of Liability & Warranty Disclaimers

This is the **highest-stakes clause set** because the products perform destructive, autonomous, irreversible operations on the user's machine and data.

### 4.1 Limitation of liability (LoL) — overall cap and exclusions
**Severity: Critical | Category: legal**

The functionality that creates the need:

- **ShipSpace** spawns raw PTY shells for autonomous agents with **no validation** — the code itself documents `rm -rf`/exfiltration risk (`pty.rs` TODO(security)); `run_shell_cmd` allowlist gates only the binary name so `node -e`, `python -c`, `npx <pkg>` are arbitrary code execution (`lib.rs:660-685`); `read_file`/`list_directory` have **no path confinement** (`lib.rs:492-495, 371-429`) — an agent can read `~/.ssh/id_rsa`. Agents act on the user's real codebase and can delete or corrupt it.
- **ShipMind** deletes DB rows but **orphans on-disk audio/image files forever** (`lib.rs:3294-3299, 4049-4054`) — a user who "deletes" sensitive data may believe it is gone when it is not; and home-wide `read_file_text`/`list_directory` (`lib.rs:1754, 1693`).
- **ShipTalk** injects keystrokes into arbitrary other apps via `type_text` (`lib.rs:286-444`) — wrong-target paste can leak a dictated password into the wrong window.
- **AI output** drives all of the above and can hallucinate, mistranslate dictation, or instruct destructive actions (prompt-injection via untrusted GitHub issues / web pages flowing into agent context).

**Recommend (Critical):**
- Cap aggregate liability at the **greater of (a) amounts paid in the trailing 12 months or (b) a small fixed floor (e.g., US$100)**.
- **Exclude all indirect, incidental, consequential, special, exemplary, and punitive damages**, expressly including: lost data, lost code, corrupted/deleted files, lost profits, business interruption, and cost of substitute services.
- **Specifically enumerate** that the cap covers damages arising from (i) AI/agent actions including code execution, file modification or deletion; (ii) keystroke injection / paste into the wrong application; (iii) incomplete deletion that leaves data on disk; (iv) third-party AI provider conduct or outages; (v) loss of API keys or session tokens.
- Carve out only what law forbids excluding (death/personal injury from negligence, fraud, gross negligence in some jurisdictions, statutory consumer rights).
- Include a **failure-of-essential-purpose** survival clause.

> **Why a robust cap is non-optional here:** unlike a typical SaaS, a single agent run can irreversibly destroy a user's entire repository or read their SSH keys. Without an enforceable cap, that is uncapped tort/contract exposure per incident.

### 4.2 Warranty disclaimer (AS-IS / AS-AVAILABLE)
**Severity: High | Category: legal**

- **Recommend:** full disclaimer of implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement; "AS IS / AS AVAILABLE"; no warranty that output is accurate, complete, lawful, or fit for any decision; no warranty of error-free or uninterrupted operation. Note jurisdictional limits (some implied warranties cannot be waived for consumers in the EU/UK/some US states) — include a "to the maximum extent permitted by law" qualifier and a consumer-rights savings clause.

### 4.3 Backup & user-responsibility-for-data clause
**Severity: High | Category: legal / data**

Because deletion is incomplete (ShipMind orphaned files) and unbounded plaintext retention exists (ShipTalk `shiptalk-history` never pruned; ShipSpace terminal scrollback persisted indefinitely), and because agents can corrupt files:

- **Recommend:** user is solely responsible for backing up code and data before running agents/automations; the company is not a backup service; user acknowledges automated operations may modify or delete files and accepts that risk.

---

## 5. AI-Output Disclaimers

**Severity: Critical | Category: legal / business**

Every product produces or acts on AI output. Functionality creating the need: ShipTalk Claude "polish" of transcripts (`polish.ts`); ShipMind chat-over-your-corpus across 8 providers; ShipSpace autonomous agents executing code; website chat proxy to Anthropic/OpenAI/Google/DeepSeek.

**Recommend a dedicated AI section stating:**

1. **No accuracy/reliability warranty.** AI output may be inaccurate, incomplete, biased, offensive, or fabricated ("hallucinated"); STT transcription may mis-transcribe; "polish" may alter meaning. Output must not be relied upon for legal, medical, financial, safety-critical, or other consequential decisions without independent human verification.
2. **Human-in-the-loop responsibility.** The user is responsible for reviewing AI suggestions, agent actions, and generated code *before* executing/relying on them. (Tie to ShipSpace's permission-prompt model — the ToS should reinforce that auto-approval and `acceptEdits` modes shift risk to the user who enables them.)
3. **No professional advice.** Output is not legal, medical, financial, or professional advice.
4. **Prompt-injection / untrusted-content warning.** Agents may ingest untrusted third-party content (GitHub issues, web pages, MCP data) that can influence behavior; user accepts this risk when granting agents access to such sources.
5. **Output ownership & responsibility.** As between the parties, user owns their inputs and the resulting outputs to the extent permitted by the underlying AI provider's terms, **but** is responsible for ensuring outputs do not infringe third-party rights and for the legality of how outputs are used.
6. **No exclusivity of generated content.** AI may produce identical/similar output for other users; no uniqueness or non-infringement guarantee.

---

## 6. Acceptable Use Policy (AUP) / Use Restrictions

**Severity: High | Category: legal / security**

ShipSpace's arbitrary-code-execution + autonomous agents + cross-app keystroke injection + browser automation make a strong AUP essential — both to permit enforcement/termination and to disclaim liability for misuse.

**Recommend prohibiting the user from using the products to:**

- Run code, agents, or automations that violate law, infringe IP, or harm others' systems (anti-malware/anti-exfiltration clause — the products *can* read `~/.ssh`, `~/.aws`, browser cookie stores via unconfined readers).
- Access, read, modify, or delete files, accounts, or systems the user is not authorized to access.
- Circumvent technical or licensing controls, **including tampering with client-side subscription/tier gating** (owner-email bypass + client-trusted tier exist in ShipTalk `owner.ts:1`, ShipMind, ShipSpace — the audit notes tier is "trivially spoofable"; the AUP must make spoofing a paid tier a **contractual breach** even though it is not technically enforced).
- Use the products to dictate/process content the user is not lawfully permitted to (e.g., recording third parties without consent — relevant to ShipTalk microphone capture and ShipSpace voice).
- Reverse engineer, decompile, or extract embedded keys (the Supabase anon key and provider-key handling are client-side).
- Resell, sublicense, or provide the product as a service to third parties without authorization.
- Use the products to violate any third-party AI provider's terms or to generate prohibited content under those providers' policies.
- Abuse rate limits or attempt account-takeover (note the `cli-login` token-relay and unauthenticated localhost MCP/orchestrator surfaces — the AUP should forbid exploiting these).

**Recommend** an express **right to suspend or terminate** for AUP breach, and a statement that the user indemnifies the company for AUP violations (see §8).

### 6.1 Consent-for-recording / wiretap clause (ShipTalk, ShipSpace voice)
**Severity: Medium | Category: legal / privacy**

ShipTalk captures live microphone audio and can route it to Apple/Groq/OpenAI; it also reads the identity of the frontmost app. ShipSpace streams mic audio to OpenAI Realtime.

- **Recommend:** user represents they have all necessary rights/consents to record and process any audio they capture, including consent of other parties in two-party-consent jurisdictions, and assumes liability for unlawful recording.

---

## 7. Intellectual Property Protections

### 7.1 Company IP / license grant to the user
**Severity: High | Category: legal / business**

No license is granted today. **Recommend** a limited, revocable, non-exclusive, non-transferable license to install and use the binaries for the licensed tier; reservation of all rights; prohibition on copying/distribution/modification beyond what law permits; and clear statement that the product is **licensed, not sold**.

### 7.2 User content & input license
**Severity: Medium | Category: legal**

The platform processes user code, voice, notes, and files, and (on the website) proxies chat content. **Recommend** the user retains ownership of their content; user grants the company a limited license to process content **solely to provide the service** (transient, no training-use claim unless intended — and *do not* claim training rights you don't exercise). Clarify that for BYO-key flows the company does not store content server-side (true for website chat: metadata-only per `usage-log.ts`), but third-party providers process it under their own terms.

### 7.3 Open-source attribution obligation (THIS IS A LIVE COMPLIANCE GAP)
**Severity: High | Category: compliance / legal**

The licenses findings are unambiguous: all products ship **hundreds of MIT/BSD/Apache/ISC dependencies that legally require copyright-notice + license-text redistribution**, plus MPL-2.0 weak-copyleft crates, yet **no LICENSE/NOTICE/THIRD-PARTY-LICENSES file or in-app credits screen exists** anywhere. **ShipMind additionally bundles a GPLv2+ statically-linked ffmpeg** (`shipmind/src-tauri/tauri.conf.json:51` + `--enable-gpl --enable-libx264/x265` build) inside a paid closed-source app **with no source offer** — a genuine copyleft conflict (rated Critical in the licenses phase).

- **Recommend (ToS angle):** while the *fix* is engineering (ship a NOTICE bundle + an LGPL/non-GPL ffmpeg or comply with GPL), the ToS should (a) include an **open-source acknowledgment clause** pointing to a shipped third-party-licenses file, and (b) **not** assert the company owns components it does not. Do **not** publish a ToS claiming full proprietary ownership of the binary until the GPL-ffmpeg conflict is resolved, as that would compound the violation. Flag this for the licenses-remediation phase as a precondition to a clean ToS.

### 7.4 Feedback license & trademark
**Severity: Low | Category: legal**

- **Recommend:** perpetual royalty-free license to use feedback/suggestions; reservation of "Ship*" / "MakeShipHappen" marks; no trademark license to users.

---

## 8. Account Responsibility & Security

**Severity: High | Category: security / legal**

Functionality creating the need: credentials in Supabase Auth; **provider API keys are the user's own** (BYO) and travel directly to providers; **session tokens are relayed to a localhost port** in `cli-login` (a real account-takeover vector); tier gating is client-trusted; Team tier shares access across members.

**Recommend:**
- User is responsible for safeguarding account credentials, **their own provider API keys**, and any tokens; the company is not liable for unauthorized access resulting from the user's failure to secure these or from the user's local environment (relevant given keys/tokens/transcripts sit in plaintext localStorage readable by local processes).
- User is responsible for all activity under their account and for **all third-party AI provider charges incurred on their keys** (BYO model — the company does not control or reimburse provider billing).
- For **Team tier**, the account owner is responsible for their members' compliance and for managing invites/removals (`teams/invite`).
- User must promptly report suspected compromise.
- The company may suspend access to protect the service or other users.

---

## 9. Subscription, Billing & Refunds

**Severity: Medium | Category: business / legal**

Functionality: Stripe-hosted checkout, $50/$500 subscription tiers, comp-access grants with **no auto-expiry** (manual revoke only), tier derived from Stripe `metadata.plan`.

**Recommend:**
- Auto-renewal disclosure and cancellation mechanics (required by US auto-renewal laws — e.g., California ARL — and EU consumer law).
- Refund policy (or express no-refund-except-where-required, with EU/UK 14-day withdrawal-right carve-out for consumers).
- Price-change notice terms.
- Statement that comp/complimentary access is discretionary and revocable at any time (matches the manual-revoke reality).
- Disclaimer that BYO-key AI usage costs are **not** part of the subscription and are billed by the provider directly.
- Downgrade/termination effect on data access.

---

## 10. Data, Privacy & Third-Party Processing (ToS hooks)

**Severity: High | Category: privacy / legal**

> Full privacy-policy drafting is a separate phase; here are the ToS-side hooks that must exist and must be consistent with reality.

- **Sub-processor acknowledgment:** ToS must reference a privacy policy / sub-processor list and have the user acknowledge that enabling cloud/AI features transmits their content to third-party processors (Anthropic, OpenAI, Google, Groq, DeepSeek, Perplexity, xAI, Supabase, Printful, Hugging Face). **DeepSeek (China) and Apple speech servers are currently undisclosed** — the ToS/privacy must not omit them.
- **Truth-in-labeling fix (consumer-protection risk):** the "100% on-device" marketing is contradicted by cloud egress (self-flagged `Cargo.toml:28`). The ToS/marketing must be reconciled — either qualify the claim ("on-device by default; cloud features optional and clearly gated") or stop making it. An overbroad on-device claim is an unfair/deceptive-practice exposure (FTC §5 / UCPD).
- **Erasure-rights honesty:** the website privacy/deletion pages promise access/export/delete, but **no deletion code path exists** and ShipMind/ShipTalk deletion is broken/incomplete. The ToS must not promise erasure the system cannot perform. Either build the deletion pipeline (recommended; required for GDPR/CCPA) before the ToS makes the promise, or scope the promise to what is actually delivered. **Do not publish a ToS guaranteeing erasure until the pipeline exists.**
- **Retention statement:** disclose that local data (transcripts, scrollback, chat, audio) persists indefinitely on the user's device unless the user manually removes it, and that the company does not control device-local retention.

---

## 11. Indemnification, Termination, Survival

**Severity: Medium | Category: legal**

- **User indemnity (Recommend):** user indemnifies the company against claims arising from the user's content, the user's use of agents/automation/code-execution, AUP violations, unlawful recording, IP infringement in user inputs/outputs, and misuse of third-party providers.
- **Termination:** either party may terminate; company may terminate immediately for AUP/IP breach; effect on license (cease use, the EULA license terminates) and on data.
- **Survival:** LoL, warranty disclaimer, IP, indemnity, AI disclaimers, and dispute terms survive termination.

---

## 12. Prioritized Recommendation Table

| # | Clause / Action | Severity | Category | Driving functionality (evidence) |
|---|---|---|---|---|
| 1 | Adopt & present a binding ToS + first-run EULA (no instrument exists) | Critical | documentation | All products paid, no license (`Cargo.toml:6`) |
| 2 | Limitation of liability — cap + exclude consequential/data-loss, enumerate AI/agent/file-deletion/keystroke risks | Critical | legal | Raw PTY exec (`pty.rs`), unconfined `read_file` (`lib.rs:492`), `type_text` (`lib.rs:286`) |
| 3 | AI-output disclaimer (no accuracy, human-in-loop, no professional advice, prompt-injection) | Critical | legal | All AI/agent features; `polish.ts`, ShipSpace agents |
| 4 | Resolve GPL-ffmpeg before claiming proprietary ownership; add OSS attribution clause | High | compliance | Bundled GPLv2+ ffmpeg (`shipmind tauri.conf.json:51`) |
| 5 | Warranty disclaimer (AS-IS/AS-AVAILABLE, implied-warranty waiver) | High | legal | Output unreliability; incomplete deletion |
| 6 | Acceptable Use Policy incl. anti-tier-spoofing, anti-exfiltration, consent-to-record | High | legal/security | Client-trusted tier (`owner.ts:1`), unconfined readers, mic capture |
| 7 | Account responsibility — BYO keys, provider charges, token security, Team-owner liability | High | security | BYO-key model, `cli-login` token relay, Team tier |
| 8 | IP — license-not-sold grant, user-content license, reserve rights | High | legal | Signed paid binaries, content processing |
| 9 | Sub-processor acknowledgment + reconcile "on-device" claim + honest erasure scope | High | privacy | DeepSeek/Apple undisclosed; no deletion path; `Cargo.toml:28` |
| 10 | Backup / user-responsibility-for-data clause | High | legal/data | Orphaned-file deletion, agent file corruption |
| 11 | Acceptance/eligibility/age + authority-to-bind (Team) | High | legal | Account creation, `teams/invite` |
| 12 | Subscription/billing/refunds/auto-renewal + comp-revocability | Medium | business | Stripe tiers, manual comp revoke |
| 13 | Indemnification (user-side) | Medium | legal | Agent misuse, user content/outputs |
| 14 | Beta/experimental/phantom-feature "as-is" clause | Low | business | Mock providers, dead ingest endpoint, partial tool-calling |
| 15 | Governing law, arbitration/class-waiver, severability, entire-agreement, survival, feedback, trademark | Medium/Low | legal | Standard, currently absent |

---

## 13. Sequencing Note for Counsel

Three ToS clauses **must not be published until the underlying engineering is fixed**, or they create a *worse* position by promising/asserting things that are false:

1. **Proprietary-ownership assertion** — blocked by the GPLv2+ ffmpeg conflict (resolve licensing first).
2. **Data-erasure / "delete your data" promise** — blocked by the absent deletion pipeline (build it first, or scope the promise to reality).
3. **"On-device" representations** — must be reconciled with actual cloud egress before any marketing/ToS repeats the claim.

All other clauses (LoL, warranty, AI disclaimer, AUP, account responsibility, IP license-to-use, billing) can and should be drafted and deployed immediately, as they protect the company against the existing high-privilege functionality without depending on remediation.
