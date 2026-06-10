# Business Protection Blueprint — Part 04: Documentation Protections

**Prepared for:** MakeShipHappen (single operator — Jake / zzgemsjewelry@gmail.com)
**Products covered:** ShipTalk, ShipMind, ShipSpace (macOS Tauri desktop apps) + makeshiphappen.tech (Next.js commerce/identity site) + companion MCP servers and the ShipMind Chrome extension
**Posture:** US-based, single founder, pre/early-revenue, distributed desktop software + web subscription
**Date:** 2026-06-07
**Grounded in:** `docs/audit-v3/00-EXECUTIVE-REPORT.md` (§6 Documentation Gaps, §7 Compliance Gaps), `docs/audit-v3/06-privacy-review.md`, `docs/audit-v3/07-security-review.md`

---

## 0. Scope & What This Document Is (and Is Not)

This is the **documentation wrapper** around the audit. The audit catalogs technical issues; this document does not fix them. It defines the **records, registers, policies, disclosures, and runbooks** a solo founder must create and maintain so that:

1. The business can **prove** it did what its public policies say (evidence-of-compliance), and
2. Decisions (licensing, deployment, deletion) are **recorded** so a single operator does not become a single point of governance failure, and
3. Customers, regulators, and future enterprise buyers have a **canonical, accurate** source of truth that does not contradict the code.

**Out of scope (deliberately):** code fixes, schema changes, encryption rollout, RLS verification, endpoint hardening. Those belong to engineering. Where a finding has a technical root cause (GPL ffmpeg, shell exec, missing deletion code), this document addresses it through a **decision record, disclosure, runbook, or attribution artifact** — never by prescribing code.

The single largest cross-cutting theme from the audit (§6) is brutal: **the documentation that does exist is either absent or actively contradicts the shipped reality** — the privacy policy promises erasure that no code performs (06-privacy §4), the sub-processor list names services not used and omits DeepSeek/China (06-privacy MC-3/MC-4), and the internal `security-plan.md` claims "typed intents validated" which is the opposite of what ships (00-EXEC §6 doc-gap 6). Inaccurate documentation is **worse than none** because it converts a gap into an affirmative misrepresentation. Every recommendation below is written to close the gap *and* prevent the doc-vs-reality drift that created the exposure.

**Reading order for prioritization:** §2 (Quick-Win matrix) lists highest-protection-for-lowest-effort first. §3–§11 give the detailed specs. §12 is the master inventory checklist with owners and effort tiers.

---

## 1. Why Documentation Is a Protection (the legal theory, briefly)

For a single-operator company, documentation is the primary loss-shifting and defensibility instrument that does **not** require headcount:

- **Evidence-of-compliance.** GDPR Art. 5(2) (accountability) and Art. 30 (records of processing) require you to *demonstrate* compliance, not merely achieve it. A diligent operator who deletes data on request but keeps **no log** of having done so cannot prove it to a regulator or in litigation. The deletion happened legally; the absence of a record makes it indefensible.
- **Misrepresentation defense.** FTC Act §5 and state UDAP claims turn on what you **said** vs. what you **did**. A version-controlled, dated, changelogged policy set lets you prove exactly what representation was live on any given date — and that you corrected it promptly when reality changed.
- **Decision provenance.** When (not if) a question arises — "did you know ffmpeg was GPL?", "why is DeepSeek in the pipeline?", "who approved that comp grant?" — a contemporaneous decision record converts "the founder forgot" into "a documented, reasoned business decision," which materially changes liability and good-faith posture.
- **Bus-factor / key-person mitigation.** The audit flags single-developer key-person dependency for release signing and Supabase admin (00-EXEC biz-risk 24). Runbooks and registers are the only mechanism that lets a successor, contractor, or estate execute critical functions if the founder is unavailable.

---

## 2. Quick-Win Prioritization Matrix (highest protection / lowest effort first)

| Rank | Protection | Effort | Protection Value | Mitigates (audit ref) |
|---|---|---|---|---|
| 1 | **Decision & Records Log** (single Markdown ADR-style file) — start it today | Low | High | 00-EXEC doc-gaps 5, 9; biz-risk 24 |
| 2 | **Licensing Decision Record** for GPL ffmpeg + sub-processor selection | Low | High | 00-EXEC legal-risk 1; doc-gap 4 |
| 3 | **Sub-processor Disclosure document** (accurate, incl. DeepSeek/China; remove phantom Sentry/Groq/etc.) | Low | High | 06-privacy MC-3/MC-4; 00-EXEC doc-gaps 3, 11 |
| 4 | **Data-Handling / Data-Flow Map** (what leaves the device, to whom) | Medium | High | 06-privacy §6, §7; doc-gap 2 |
| 5 | **Version-controlled policy set** with effective dates + changelog | Low | High | 00-EXEC doc-gaps 1, 8, 10 |
| 6 | **OSS Attribution / NOTICE document** ("Open Source Licenses" screen content) | Medium | High | 00-EXEC legal-risk 8; doc-gap 4 |
| 7 | **DSAR / Deletion-Export Runbook + evidence log** (operator SOP backing the manual email) | Medium | High | 06-privacy §4, §5; 00-EXEC compliance 1, 2 |
| 8 | **Canonical Document Register** (index of all docs, owners, versions) | Low | Medium | 00-EXEC doc-gaps 22, 25 |
| 9 | **Trust Center / Security Overview page** (public) | Medium | High | 00-EXEC doc-gaps 3, 12; biz-risk 14 |
| 10 | **Deploy/Release SOP** (document the `vercel --prod` from-local-tree model) | Low | Medium | 00-EXEC doc-gap 9; biz-risk 7 |
| 11 | **Retention Schedule document** (states the "forever" reality + target windows) | Low | High | 06-privacy §3; 00-EXEC doc-gap 7 |
| 12 | **Marketing-Claims Substantiation file** (correct "on-device" record) | Low | High | 06-privacy MC-1/MC-2; doc-gap 8 |
| 13 | **Incident-Response & Breach-Notification Runbook** | Medium | High | 00-EXEC doc-gap 23; compliance 21 |
| 14 | **Retire/re-issue legacy "Private" PDFs** (decision + archive record) | Low | Medium | 00-EXEC legal-risk 17; doc-gap 25 |
| 15 | **Customer-facing Changelog + Status communication channel** | Medium | Medium | biz-risk 10; doc-gap 15 |
| 16 | **Internal control-ownership register** (RLS / email-confirm / release keys owner) | Low | High | 00-EXEC doc-gap 5; security §8 |
| 17 | **Evidence-Retention / compliance-proof archive structure** | Medium | High | Art. 5(2) accountability; all DSAR/policy proofs |
| 18 | **Identifier/manifest reconciliation memo** (com.shipspace.ade vs "shipspace") | Low | Low | 00-EXEC doc-gaps 17, 18, 25 |

> **Sequencing note for a solo founder:** Items 1–5 are a single weekend. They are Markdown files committed to the repo. Do them before any further paid sales. Items 6–13 are the "first 30 days." Items 14–18 are housekeeping that prevents recurrence.

---

## 3. Canonical Document Register

**Mitigates:** 00-EXEC doc-gaps 22 (`SECURITY_AUDIT_REPORT.md` gitignored / tracking hidden), 25 (identifier discrepancies), and the general inability to answer "where is the authoritative version of X?"
**Effort: Low · Protection: Medium**

The problem the audit surfaces is not only missing documents but **uncontrolled** documents: legacy "Private" PDFs at the repo root carry outdated guarantees (00-EXEC legal-risk 17), an internal security plan contradicts reality, and audit-tracking is gitignored. Without an index, you cannot know which artifact is canonical or who owns it.

**Adopt: a single `docs/REGISTER.md`** at the top of the documentation tree. One row per controlled document.

| Column | Purpose |
|---|---|
| Doc ID | Stable slug (e.g., `POL-PRIVACY`, `REC-LICENSING`, `RUN-DSAR`) |
| Title | Human name |
| Type | Policy / Record / Runbook / Disclosure / Register / Collateral |
| Owner | Always "Jake" today — but the column exists so it can be delegated/inherited |
| Status | Draft / Effective / Superseded / Retired |
| Effective date | When this version went live (public-facing docs especially) |
| Location | Path or URL (repo, Vercel page, Google Drive) |
| Review cadence | Annual / On-change / Per-release |
| Last reviewed | Date |

**Rules of the register (write them at the top of the file):**
- Every public-facing document (ToS, Privacy, Sub-processor list, Trust Center) MUST appear with an effective date and a changelog link.
- Superseded documents are marked `Superseded`, not deleted — keep them for evidence of "what we said when."
- No document is "canonical" unless it is in the register. The legacy root-level PDFs are either entered as `Retired` or formally re-issued (see §11).
- `SECURITY_AUDIT_REPORT.md` and the audit-v3 tree are entered as `Record` (internal) so governance tracking is no longer invisible (closes doc-gap 22).

---

## 4. Decision & Records Keeping (ADR-style business decision log + licensing decision records)

**Mitigates:** 00-EXEC doc-gaps 5 (load-bearing admin controls undocumented), 9 (deploy model undocumented), legal-risk 1 (GPL ffmpeg), biz-risk 24 (key-person), compliance 20 (no license scanning — "how GPL ffmpeg entered").
**Effort: Low · Protection: High**

A solo founder makes consequential decisions in their head. When a dispute arises, "in my head" is worthless. Adopt a lightweight, append-only **Decision Record** log modeled on Architecture Decision Records (ADRs) but covering **business/legal/operational** decisions.

### 4.1 General Decision Log — `docs/decisions/`

One Markdown file per decision: `NNNN-short-title.md`. Template:

```
# DR-0001: <decision title>
Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by DR-XXXX
Decider: Jake
Context: <what prompted this — link the audit finding if applicable>
Decision: <what we decided>
Rationale: <why; alternatives considered>
Consequences: <what this commits us to; follow-up obligations>
Evidence: <links to quotes, counsel email, vendor terms, screenshots>
```

**Seed it immediately with these decisions (each already implied by the audit):**
- DR: Deploy model — production ships via `vercel --prod` from the local working tree (NOT git push). Records the known divergence risk (biz-risk 7; security §8) and states the compensating control (pre-deploy checklist, §9).
- DR: OWNER_EMAILS bypass — records that it is safe **only if** Supabase "Confirm email" is ON, that this is an out-of-band setting, and who verified it and when (compliance 4; security WEB-2).
- DR: Comp-access grants have no auto-expiry — records that grants must be manually revoked and that the operator maintains a comp-grant ledger (biz-risk 8; security WEB-3).
- DR: Sub-processor selection — records each AI provider added, why, and the data category it receives (feeds §5 and §6).

### 4.2 Licensing Decision Records (LDRs) — `docs/decisions/licensing/`

The GPL ffmpeg finding (00-EXEC legal-risk 1, **Critical**) is the textbook case for a dedicated licensing decision register. **This document does not tell you how to remediate ffmpeg** — that is a legal + engineering decision. It tells you to **record the decision you make**, because the absence of a record is itself part of the exposure.

Open an LDR for each significant licensing question:
- **LDR: ffmpeg in ShipMind.** Capture: the build banner evidence (`--enable-gpl --enable-libx264 --enable-libx265`), the legal options (remove GPL build / relicense / swap to LGPL or non-GPL build / honor GPL with source offer + notice), **the option chosen, the date, and the counsel who blessed it.** Until resolved, status = `Open — counsel review pending`. This converts an "active copyleft violation" into a "known issue under documented counsel-supervised remediation," which is a materially better posture.
- **LDR: MPL-2.0 crates** (00-EXEC legal-risk 14) — per-file source-availability obligations; record how they are met (NOTICE + source offer URL).
- **LDR: first-party license of record** (00-EXEC legal-risk 13 — empty `Cargo.toml license=""`, missing `package.json` license; ShipTalk `authors=['you']`). Record the chosen license string for each first-party artifact and the date it was set. This is a documentation/metadata decision, not a code change in the substantive sense.
- **LDR: license-scanning policy** (compliance 20). Adopt as a *policy* (not code): a rule that no new dependency bundling a binary ships without an entry in the attribution doc and an LDR check. This is the governance control that would have caught ffmpeg.

**Why LDRs over a single log:** licensing decisions get audited in litigation/M&A diligence as a class. Keeping them in one sub-folder makes the "show me your OSS compliance" request a one-folder answer.

---

## 5. Data-Handling & Sub-Processor Disclosure Document

**Mitigates:** 06-privacy MC-3 (over-inclusive list names Sentry/Groq/OpenRouter/Ollama not in code), MC-4 (omits DeepSeek/China + undisclosed international transfer), §7 (Stripe/Printful shipping PII undocumented); 00-EXEC doc-gaps 3, 11, 13; legal-risk 6, 7, 19; compliance 6, 9.
**Effort: Low (the list) / Medium (the full data-flow map, §6) · Protection: High**

This is two linked artifacts. The **sub-processor list** is the fast, high-value one.

### 5.1 Sub-Processor List — `POL-SUBPROCESSORS` (public + versioned)

The current published list is **inaccurate in both directions**, which is an affirmative misrepresentation, not merely a gap. Draft a corrected, dated list:

| Sub-processor | Purpose | Data categories received | Region / jurisdiction | Disclosure note |
|---|---|---|---|---|
| Anthropic | AI chat / polish | Prompts, transcripts, dictionary terms | US | |
| OpenAI | AI chat / STT | Prompts, audio, transcripts | US | |
| Google (Gemini) | AI chat | Prompts | US | |
| **DeepSeek** | AI chat | Prompts | **China** | **International transfer — must be disclosed with notice + ideally opt-out (legal-risk 6)** |
| Groq | STT / chat | Audio, prompts | US | Include only if actually wired; verify |
| Perplexity / xAI / OpenRouter | AI chat | Prompts | US | Include only per-product where actually wired |
| Supabase | Identity, billing identity, transcripts (ShipTalk), profiles | Account + content PII | US (verify project region) | |
| Stripe | Payments | Billing identity, shipping name/address, email | US | |
| Printful | Merch fulfillment | Shipping name + full postal address + email | US | No MSH-side deletion coverage today — note this honestly |
| Apple (Web Speech) | On-device/cloud STT fallback | Audio (may route to Apple) | US | Note that "on-device" is not guaranteed |
| Hugging Face | Model-binary download | None (no user content) | US | Listed for completeness; not a content processor |

**Hard rules for this document (to prevent the recurrence of MC-3/MC-4):**
- **Accuracy over completeness theater.** Remove any service not actually called by shipped code. Do not list aspirational/phantom providers (Manus slot, nano-banana mock — 00-EXEC biz-risk 19, doc-gap 20). The disclosure must match the code path, per product.
- Every entry states **data category** and **jurisdiction**.
- DeepSeek (China) gets an explicit international-transfer notice (legal-risk 6, compliance 3). If you cannot offer SCCs/opt-out yet, the *honest documented position* is to disclose the transfer and, as a policy decision (DR), restrict EU/UK availability or the DeepSeek provider for those users until controlled.
- Versioned with effective date + changelog; a "subscribe to changes" email is the GDPR-friendly pattern for processor changes (Art. 28(2)).

### 5.2 BYOK clarification (correct a known misstatement)

The website policy frames AI as "BYO… governed by that provider's terms," but on the **website the server holds the keys and forwards user content** — making MakeShipHappen the controller/sender (06-privacy MC-3). Document the **true** split:
- **Desktop apps:** direct client-to-vendor BYOK; the user's own key/account governs the provider relationship. Document this as a **shared-responsibility** allocation (ties to the User-Responsibility doc, 00-EXEC doc-gap 12).
- **Website:** server-proxied; MakeShipHappen is the sender. The sub-processor obligations apply here, not a pure BYOK passthrough.

---

## 6. Data-Flow Map (internal record-of-processing)

**Mitigates:** 06-privacy §2 (data inventory), §6, §7; 00-EXEC doc-gap 2 (no privacy notice / data-flow map), compliance 6 (Art. 30 records).
**Effort: Medium · Protection: High**

This is the internal **Records of Processing Activities (RoPA)** — the master table the privacy notice, sub-processor list, retention schedule, and DSAR runbook all derive from. The privacy review already did 80% of this work in its §2 inventory; this turns it into a maintained governance artifact.

`docs/REC-DATA-FLOW.md` — one row per data flow:

| Data category | Source product | Stored where | Encrypted at rest? | Transmitted to (sub-processor) | Lawful basis | Retention (target) | Deletion path |
|---|---|---|---|---|---|---|---|

Pre-populate from 06-privacy §2/§2.1 (voice audio, transcripts, second-brain notes, source code/files, session JWTs, billing identity, shipping PII, client IPs in `ip_rate_events`, usage_events, frontmost-app identity). For each row, **honestly record current reality** — e.g., "Encrypted at rest? No (plaintext)" for ShipMind `shipmind.db` and ShipTalk localStorage. The map is an internal evidence document; it must reflect the audit, not the marketing.

**This document is the single source of truth** that the public privacy notice and sub-processor list are generated from, eliminating the drift that produced MC-3/MC-4.

---

## 7. Internal Runbooks / SOPs

**Mitigates:** 06-privacy §4/§5 (no reliable deletion/export execution), 00-EXEC doc-gaps 5, 23, 24; biz-risk 24 (key-person); compliance 1, 2, 21.
**Effort: Medium · Protection: High**

Runbooks turn "the founder will probably handle it" into a repeatable, evidenced process. Each runbook lives in `docs/runbooks/` and ends with an **evidence step** (what to log, where).

### 7.1 DSAR Runbook — `RUN-DSAR` (access / deletion / export)
The privacy review is explicit (06-privacy §4): the **only** deletion/export mechanism is a manual email to `privacy@`, it is unaudited, and the desktop apps cannot fully erase what they hold. A manual process is *legally permissible if reliably executed and evidenced*. This runbook is the instrument that makes it reliable and evidenced — **without requiring any code change.**

Contents:
- Intake: how a request arrives, identity-verification steps, statutory clock (GDPR 30 days; CCPA 45 days).
- **Execution checklist by store** (drawn directly from the data-flow map): delete Supabase rows (profiles, subscriptions, usage_events, transcriptions, dictionary_terms), revoke any comp grant, request deletion from Printful for shipping PII, and **honestly instruct the user** on local-file cleanup the apps cannot perform (the website already does this transparently — preserve and formalize it).
- **Evidence step:** append to `docs/evidence/dsar-log.md` — request date, requester (hashed/minimized), type, completion date, stores actioned, operator signature. This is your Art. 5(2) accountability proof.
- Known-limitation disclosure: the runbook states which deletions are incomplete today (ShipMind orphaned audio/images, ShipTalk broken delete UI) so the operator gives the user an accurate response rather than over-promising.

### 7.2 Comp-Access Grant/Revoke SOP — `RUN-COMP`
Records every comp grant in `docs/evidence/comp-ledger.md` (who, when, why, **expiry-review date**) because the tool has no auto-expiry (biz-risk 8; security WEB-3). The ledger is the compensating control: a scheduled review against it catches forgotten grants.

### 7.3 Release / Deploy SOP — `RUN-RELEASE`
See §9. Documents the `vercel --prod`-from-local-tree model and the pre-deploy checklist that mitigates audited≠live (biz-risk 7).

### 7.4 Incident-Response & Breach-Notification Runbook — `RUN-IR`
**Mitigates 00-EXEC doc-gap 23, compliance 21 (72-hour GDPR window).** Even for a solo founder, a written IR runbook is a strong defensibility artifact. Contents: detection sources (MCP exposure, token-relay abuse, RLS failure — the audit's own scenarios), severity triage, containment steps per product, the **72-hour GDPR notification clock** and CCPA/state breach-notice triggers, a holding-statement template, regulator/affected-user contact procedure, and an incident-log location (`docs/evidence/incidents/`). Pre-name the foreseeable incident types from the audit (session-token leak via ShipTalk MCP, cli-login relay capture, cross-tenant RLS failure) so triage is fast.

### 7.5 Control-Ownership Register — `REC-CONTROLS`
**Mitigates doc-gap 5** (load-bearing admin controls undocumented). One table naming the human owner and the verification cadence for each safety-critical control that lives **outside the code**: Supabase RLS policies, the "Confirm email" setting, release/minisign keys, the Supabase service-role key custody, the DeepSeek/EU policy decision. Today the owner is always Jake — but the register makes the controls *visible and inheritable* (key-person mitigation, biz-risk 24).

---

## 8. Version-Controlled Policy Set (effective dates + changelogs)

**Mitigates:** 00-EXEC doc-gaps 1 (no ToS/EULA), 8 (uncorrected on-device claim), 10 (IP collection undisclosed); compliance 5, 17.
**Effort: Low (the versioning discipline) · Protection: High**

> The *content* of the ToS, EULA, AUP, privacy notice, and disclaimers is specified in the Legal/ToS protection documents of this blueprint (see audit-v3 03-liability-review and 05-tos-recommendations). **This document owns the documentation discipline around them**, not their substantive drafting.

Adopt these rules for every public policy (Privacy, ToS, EULA, AUP, Sub-processor list, Refund/Billing, Cookie/IP-collection notice):

- **Effective date** displayed at the top of every published policy.
- **Changelog** at the bottom (or a linked `CHANGELOG`) recording each material change and its date — this is your proof of "what we represented on date X" for FTC/UDAP defense.
- **Source-of-truth in version control.** The published Markdown/MDX lives in the repo (or a tracked Drive doc) so diffs are auditable; the rendered page must match the tracked source. Add this to the deploy checklist (§9) so a policy change cannot silently diverge.
- **Supersession, not deletion.** Old versions are archived (register status `Superseded`) so you can produce the exact text a customer agreed to.
- **Acceptance evidence.** When the EULA/ToS is presented at install/checkout, log the version accepted + timestamp (operationally, even a "version X effective from date Y, presented at checkout" record suffices for a solo shop). This is the evidence that the liability cap / AI-disclaimer was actually agreed to.
- **Correct the on-device claim in writing** (doc-gap 8; 06-privacy MC-1/MC-2): the corrected representation ("local-first; cloud features opt-in and clearly labeled") must be the dated, version-controlled text, and the superseded "100% on-device" wording archived as evidence that it was corrected and when.
- **Disclose IP collection** (doc-gap 10): the privacy notice's "What We Collect" must list `ip_rate_events` client IPs.

---

## 9. Deploy / Release Documentation (audited ≠ live)

**Mitigates:** 00-EXEC doc-gap 9, biz-risk 7, security §8 / WEB-2 (deploy from a separate nested repo via `vercel --prod`; live production not guaranteed to match audited repo); compliance 25.
**Effort: Low · Protection: Medium**

The deploy model is itself an audit risk because it defeats release-time gating. You cannot easily change the model right now, but you **can document and discipline it**, which is the governance fix.

`RUN-RELEASE` contents:
- A written statement of the actual model (website: `vercel --prod` from local working tree / a separate nested repo; desktop: minisign-verified updater pipeline — the latter is a documented **strength** worth recording as a positive).
- **Pre-deploy checklist** (the compensating control for audited≠live): confirm the local tree matches the intended branch/commit; confirm published policy pages match the tracked source (§8); confirm no debug/owner-bypass left enabled; confirm the Supabase "Confirm email" setting is still ON (security WEB-2); record the deployed commit SHA in `docs/evidence/deploy-log.md`.
- **Deploy log as evidence:** date, commit SHA, what changed, who deployed. This is the record that lets you answer "what was live on date X" — directly addressing the audited≠live governance gap.
- Reconcile the env-var naming ambiguity (GOOGLE_API_KEY vs GEMINI_API_KEY) as a documented config note (00-EXEC §8 live-confirmation item).

---

## 10. Public Trust Center / Security Overview + Customer-Facing Changelog & Status

**Mitigates:** 00-EXEC doc-gaps 3, 12 (no shared-responsibility / no published security overview), biz-risk 14 (cannot answer enterprise security questionnaires), biz-risk 10 (price/changelog confusion).
**Effort: Medium · Protection: High (for B2B/enterprise sales)**

### 10.1 Trust Center — public page on makeshiphappen.tech (`COL-TRUST`)
A single page (or section) that aggregates the public-facing protections and lets a buyer self-serve the questions that otherwise block B2B deals. Contents:
- Link to ToS / EULA / Privacy / AUP / DPA-on-request (with effective dates).
- The **accurate** sub-processor list (§5) with a "subscribe to changes" link.
- A plain-language **security overview**: keychain-isolated keys, signed/notarized + minisign-verified releases, no telemetry SDK, server-side key proxy on the website, RLS-backed isolation — these are *real, audit-confirmed strengths* (00-EXEC §8) and are legitimate to publish.
- **Shared-responsibility / honest-posture statement.** Critically, the Trust Center must **not** overclaim. Do not republish "100% on-device" or "built for legal teams" (00-EXEC legal-risk 9; biz-risk 13). State the corrected local-first posture and the user-responsibility allocation (shell-exec, recording-consent, BYOK spend — ties to the User-Responsibility doc). An honest Trust Center is a defense; an aspirational one (cf. the `security-plan.md` "typed intents validated" trap, doc-gap 6) is a liability.
- **No-certification disclaimer** (compliance 17): explicitly state the products are not HIPAA/SOC2/etc.-certified, to defuse implied-certification reliance and the "built for legal teams" mismatch (00-EXEC biz-risk 13, legal-risk 9).
- A security-contact / vulnerability-disclosure email and basic intake (turns ad-hoc reports into a logged, evidenced process feeding §7.4).

### 10.2 Customer-Facing Changelog + Status (`COL-CHANGELOG`)
- A public **changelog** for product releases — and crucially, a place to **reconcile pricing** (00-EXEC biz-risk 10, doc-gap 15: draft $20/$40 vs live Stripe $50/$500). Pricing shown anywhere must match what Stripe charges; the changelog/Trust Center is where the canonical price is stated and any change is dated (consumer-protection/refund defense).
- A lightweight **status/incident-communication** channel (even a status page section or a mailing list) so that, paired with the IR runbook (§7.4), you have a pre-built path to notify users — required for credible breach-notification.

---

## 11. Evidence-Retention & Compliance-Proof Archive + Legacy-Collateral Retirement

**Mitigates:** GDPR Art. 5(2) accountability across all DSAR/policy/deploy actions; 00-EXEC legal-risk 17 + doc-gap 25 (legacy "Private" PDFs); doc-gap 22 (gitignored audit tracking).
**Effort: Medium · Protection: High**

### 11.1 Evidence-Retention structure — `docs/evidence/`
The recurring failure mode for a solo founder is **doing the right thing with no proof**. Standardize an evidence tree so proof accumulates automatically as a byproduct of the runbooks:
- `docs/evidence/dsar-log.md` — every access/deletion/export request and its completion (§7.1).
- `docs/evidence/comp-ledger.md` — comp grants + revocations (§7.2).
- `docs/evidence/deploy-log.md` — deploys with commit SHA + checklist sign-off (§9).
- `docs/evidence/incidents/` — incident records (§7.4).
- `docs/evidence/policy-acceptance.md` — policy versions presented at checkout/install + dates (§8).
- `docs/evidence/control-verifications.md` — dated confirmations of out-of-band controls (e.g., "Confirm email = ON verified on date X"), the load-bearing settings the audit cannot see from code.

Adopt a one-line **evidence-retention policy** (in the register): evidence logs are append-only, retained for the longer of statutory limitation periods or 6 years, and excluded from any data-deletion that targets *operational* PII (you minimize requester PII in the log itself).

### 11.2 Legacy collateral retirement
The legacy "Private" PDFs at the repo root (00-EXEC legal-risk 17, biz-risk 22) likely carry **unqualified, now-superseded guarantees** that contradict the hedged web copy — a live misrepresentation risk. Action (documentation, not code):
- Inventory them in the register.
- For each: either **retire** (mark `Retired`, move out of any distributed/public path, record a DR explaining supersession) or **re-issue** a corrected, dated version consistent with current policy.
- Same treatment for the internal `security-plan.md` "typed intents validated" claim (doc-gap 6): mark it clearly as **aspirational/internal-draft, NOT a representation of shipped behavior**, so it cannot migrate into public claims.

### 11.3 Identifier / manifest reconciliation memo
A short `REC-IDENTIFIERS.md` noting the `com.shipspace.ade` vs `"shipspace"` manifest discrepancy and the co-mingled website+Electron `package.json` (00-EXEC doc-gaps 17, 18, 25). Documentation-only: state the intended identity for each artifact so inventory/governance is unambiguous and the co-mingled manifest does not silently expand the obligation surface (e.g., LGPL libvips, legal-risk 18).

---

## 12. Master Documentation Inventory Checklist (owners + effort)

> Owner is "Jake" for every row today (single operator). The Owner column exists for delegation/inheritance and for the control-ownership discipline the audit demands (doc-gap 5).

| # | Document / artifact | Type | Doc ID | Owner | Effort | Protection | Done? |
|---|---|---|---|---|---|---|---|
| 1 | Decision & Records log (ADR-style) | Record | REC-DECISIONS | Jake | Low | High | ☐ |
| 2 | Licensing Decision Records (ffmpeg, MPL, license-of-record, scan policy) | Record | REC-LICENSING | Jake | Low | High | ☐ |
| 3 | Sub-processor list (accurate, incl. DeepSeek; remove phantoms) | Disclosure | POL-SUBPROCESSORS | Jake | Low | High | ☐ |
| 4 | Data-flow map / RoPA | Record | REC-DATA-FLOW | Jake | Medium | High | ☐ |
| 5 | Version-controlled policy discipline (dates + changelogs) | Policy | POL-VERSIONING | Jake | Low | High | ☐ |
| 6 | OSS Attribution / NOTICE ("Open Source Licenses" content) | Disclosure | DISC-OSS-NOTICE | Jake | Medium | High | ☐ |
| 7 | DSAR runbook (access/delete/export) + evidence log | Runbook | RUN-DSAR | Jake | Medium | High | ☐ |
| 8 | Canonical document register | Register | REG-DOCS | Jake | Low | Medium | ☐ |
| 9 | Trust Center / security overview page | Collateral | COL-TRUST | Jake | Medium | High | ☐ |
| 10 | Deploy/Release SOP + deploy-log | Runbook | RUN-RELEASE | Jake | Low | Medium | ☐ |
| 11 | Retention schedule (states reality + target windows) | Policy | POL-RETENTION | Jake | Low | High | ☐ |
| 12 | Marketing-claims substantiation file (correct "on-device") | Record | REC-CLAIMS | Jake | Low | High | ☐ |
| 13 | Incident-response & breach-notification runbook | Runbook | RUN-IR | Jake | Medium | High | ☐ |
| 14 | Retire/re-issue legacy "Private" PDFs (+ flag security-plan.md) | Record | REC-COLLATERAL | Jake | Low | Medium | ☐ |
| 15 | Customer-facing changelog + status + price reconciliation | Collateral | COL-CHANGELOG | Jake | Medium | Medium | ☐ |
| 16 | Control-ownership register (RLS/email-confirm/release keys) | Register | REC-CONTROLS | Jake | Low | High | ☐ |
| 17 | Evidence-retention archive structure + policy | Record | REC-EVIDENCE | Jake | Medium | High | ☐ |
| 18 | Comp-access grant/revoke SOP + ledger | Runbook | RUN-COMP | Jake | Low | Medium | ☐ |
| 19 | Identifier/manifest reconciliation memo | Record | REC-IDENTIFIERS | Jake | Low | Low | ☐ |

---

## 13. 30-Day Documentation Rollout (suggested order)

1. **Day 1 (a single sitting):** Create `docs/REGISTER.md`, the `docs/decisions/` log, and the `docs/evidence/` skeleton. Open the ffmpeg LDR (status: counsel review pending). Seed the four foundational decision records (§4.1).
2. **Days 2–5:** Draft the accurate sub-processor list (§5) and the data-flow map (§6) from 06-privacy §2. Apply the version/effective-date/changelog discipline to existing policy pages and correct the on-device wording (§8).
3. **Days 6–14:** Write RUN-DSAR, RUN-IR, RUN-RELEASE, RUN-COMP, and the control-ownership register. Stand up the evidence logs they write into.
4. **Days 15–30:** Build the public Trust Center + changelog (§10), reconcile pricing, retire/re-issue legacy PDFs (§11), and produce the OSS attribution document (coordinated with the open-source protection workstream).

> **One discipline to internalize:** the data-flow map (§6) is the parent of the privacy notice, sub-processor list, retention schedule, and DSAR runbook. Update it first when anything changes; regenerate the children from it. That single habit prevents the doc-vs-reality drift that turned this codebase's documentation from a protection into a liability.
