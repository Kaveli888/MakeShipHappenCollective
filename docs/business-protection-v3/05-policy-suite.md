# Business Protection Blueprint — 05: Policy Protections (Core Policy Suite)

**Document type:** Business / legal / governance protection plan (NOT an engineering plan)
**Author role:** Startup general counsel + compliance officer + operations advisor
**Subject:** Ship Ecosystem — ShipTalk, ShipMind, ShipSpace (Tauri desktop apps) + makeshiphappen.tech (Next.js web subscription)
**Operator / data controller:** MakeShipHappen — single founder (Jake, zzgemsjewelry@gmail.com)
**Posture:** US-based (Nevada/California considerations), solo-founder, pre/early-revenue
**Date:** 2026-06-07
**Grounding:** `docs/audit-v3/02-data-flow-audit.md`, `06-privacy-review.md`, `09-marketing-claims-review.md`, `11-shiptalk-cluster.md`

> **Scope discipline.** This document defines the *policy instruments* — written documents you adopt, publish, or operate as SOPs — that wrap the technical findings in the audit with a legal/governance shell. It does **not** prescribe code, refactors, or architecture. Where a finding has a technical root cause (plaintext storage, no-auth MCP, DeepSeek egress, broken delete UI), the protection here is a *disclosure, consent, retention, substantiation, or SOP* instrument — not a fix. The fixes live in the engineering backlog; the policies here protect the business in the interim and permanently.

---

## 0. How to read this document

Every policy below carries two tags so you can sequence work highest-protection-for-lowest-effort first:

- **EFFORT** — `Low` (you can draft/adopt it in a sitting), `Medium` (a few days, may need a lawyer pass), `Long-term` (ongoing operational program or counsel-led drafting).
- **PROTECTION** — `High` / `Medium` / `Low` — the legal/regulatory/reputational exposure it removes.

The deliverable is **prioritized**: do the High-protection / Low-effort items first (Section 1 quick-win table), then the rest.

A foundational caveat that shapes the entire suite: **the audit found that the products cannot, today, fully delete or export user data, store the most sensitive corpora in plaintext forever, and egress voice/notes/code/documents to up to 11 third-party AI providers including DeepSeek (China) — while the marketing says "private," "on-device," "secure," and "never the underlying documents."** Several of these policies therefore have a single job: **stop the written promises from outrunning the actual behavior**, because a promise you cannot keep is independently actionable (FTC Act §5, state UDAP, GDPR/CCPA) regardless of the underlying engineering gap.

---

## 1. Priority quick-win matrix (do these first)

| # | Policy | Effort | Protection | One-line mitigation |
|---|---|---|---|---|
| P-1 | Marketing-Claims Substantiation Policy | Low | High | Stops "secure/private/100% on-device/built for legal teams/never the documents" from being published unverified (FTC §5 / UDAP) |
| P-2 | Privacy Policy alignment to actual behavior | Medium | High | Fixes on-device-vs-cloud-egress contradiction; discloses DeepSeek/China + IP collection; reconciles phantom Sentry |
| P-3 | Data Deletion & Export request-handling SOP | Low | High | Backs the *already-published* erasure/export promise with a real, audited manual process within statutory windows |
| P-4 | Acceptable Use Policy (AUP) | Medium | High | Allocates liability for shell-agent abuse, anti-exfiltration, anti-tier-spoofing, consent-to-record |
| P-5 | Recording & Consent Policy | Low | High | Shifts two-party-consent liability for voice capture onto the user; documents the duty |
| P-6 | Data Retention & Lifecycle Policy | Medium | Medium | Establishes a *written* retention schedule even before TTL code exists; cures "forever" default vs GDPR Art. 5(1)(e) |
| P-7 | AI-Use & Output Policy | Low | Medium | Disclaims accuracy of LLM output / "security verdicts"; no-warranty on agent decisions |
| P-8 | Sub-processor disclosure register (policy + page) | Low | Medium | Cures undisclosed/over-disclosed processors; international-transfer notice |

---

## 2. The policy suite — definitions, scope, binding, priority

Each policy below is specified as a drafting brief: **what document to draft, its scope, who it binds, the specific audit risk it mitigates, and the effort/protection tags.** Concrete language to lift is included where the wording is load-bearing.

---

### P-1 — Marketing-Claims Substantiation Policy
**EFFORT: Low · PROTECTION: High**

**Document to draft:** `Marketing-Claims Substantiation Policy.md` — an *internal* governance policy (one page) plus a **claims register** (a living spreadsheet/table) listing every privacy/security/performance/audience claim, its current substantiation status, and an approver sign-off column.

**Scope.** All public-facing copy across `makeshiphappenAi/app/**`, the v3 product pages, draft funnel copy (`docs/shipmind-product-copy.md`), the two legacy PDFs (`ShipMind_Private_Intelligence.pdf`, `ShipMind_Private_Second_Brain.pdf`), social posts, app-store text, and the recording shot list. Also binds the *internal* `brand/security-plan.md` — it must be stamped **"ASPIRATIONAL — NOT APPROVED FOR PUBLIC USE."**

**Who it binds.** The founder in the copywriter role, and any contractor/agency or AI agent that drafts marketing copy. No claim ships without a register entry.

**Audit risk mitigated.**
- "Same engine the fastest law-tech/legal teams ship on" / "Built for legal teams" — unsubstantiated comparative + audience claim courting regulated users (Phase 9 §3.3, §5.3).
- "Secure Documents" / "private second brain" / "100% on-device" / "Privacy-First" — security/locality guarantees the storage + egress architecture does not provide (Phase 9 §3.1, §4.1, §5.1, §5.3; Phase 6 MC-1, MC-2).
- "Only prompt text leaves… never the underlying documents" — precise, falsifiable, and contradicted (Phase 9 §5.2 — the most legally exposed single claim).
- Migration risk: `security-plan.md` "typed intents / never executes raw model output / zero-telemetry" leaking into public copy (Phase 9 §3.2).

**Core rules to encode in the policy:**
1. **No unqualified absolute privacy/security words.** "Private," "secure," "on-device," "never leaves," "zero-telemetry" may only appear (a) scoped to a specific verified behavior, or (b) with an adjacent disclosure. *Banned as headlines:* "Secure Documents," "100% on-device," "never the underlying documents."
2. **Substantiation-before-publication.** Every comparative ("fastest"), audience ("law-tech teams ship on"), and capability ("returns a verdict on what to fix") claim needs a documented basis on file *before* it ships, per FTC substantiation doctrine.
3. **Mandatory disclaimer reuse.** The existing line *"makes no compliance certification — you decide whether it fits your obligations"* (`product-copy.md:70`) is designated **required** on any page targeting professional/regulated/"confidential work" users.
4. **Preserve the good.** Keep the defensible hedged claims the audit praised (Phase 9 §10): "speed varies by hardware," "keys in the OS keychain, not localStorage," "card details never touch our servers," "real files — not a sandbox."
5. **Legacy-collateral retirement.** The two `ShipMind_Private_*.pdf` files must be retrieved, reviewed against current hedged copy, and **retired or re-issued** before any further distribution (Phase 9 §5.6). Record the disposition in the register.

**Deliverables checklist.**
- [ ] Internal policy doc adopted (banned-words list + substantiation requirement + approver step).
- [ ] Claims register populated from the Phase 9 §8 Consolidated Claims Register (every row → an entry).
- [ ] `brand/security-plan.md` stamped "aspirational / not public."
- [ ] Both legacy PDFs reviewed + dispositioned in the register.
- [ ] Required-disclaimer rule wired into the publish checklist.

---

### P-2 — Privacy Policy aligned to ACTUAL behavior
**EFFORT: Medium · PROTECTION: High**

**Document to draft:** Revised `app/privacy/page.tsx` Privacy Policy + a separate published **Sub-Processor List** (see P-8). This is a legal document — budget one counsel review pass.

**Scope.** The website Privacy Policy and the in-app data-flow disclosures for all three desktop apps (even a short in-app "Where your data goes" notice). Governs every flow in Phase 2 §3–§7.

**Who it binds.** MakeShipHappen as the published controller commitment to all users and to regulators; it is the written representation a regulator/plaintiff will hold you to.

**Audit risk mitigated.**
- **On-device/private vs cloud-egress contradiction** (Phase 6 MC-1/MC-2; Phase 2 §8.3). The policy must state plainly: local-first by default, but when cloud AI is enabled, the relevant content (audio, transcript, retrieved document passages, code, base64 images) is sent to the chosen provider, which processes it under *its own* terms and retention.
- **Undisclosed sub-processor + international transfer to DeepSeek (China)** (Phase 6 MC-4; Phase 2 W-2). Must be disclosed with an international-transfer notice; flag absence of SCCs/TIA as a counsel follow-up.
- **Phantom Sentry over-disclosure** + named-but-absent Groq/OpenRouter/Ollama (Phase 9 §3.4; Phase 6 MC-3) — remove or reconcile.
- **Omitted client-IP collection** persisted to `ip_rate_events` with no TTL (Phase 9 §7.2; Phase 2 W-5) — add IP + its rate-limiting purpose + retention to "What We Collect."
- **Controller-vs-BYOK framing error** — the *website* holds the keys and forwards content, so it is the sender/controller, not a passive BYOK conduit (Phase 6 MC-3). Correct the framing.
- **Promised rights with no implementation** — see P-3; the policy text must match the SOP that actually backs it.

**Core edits to encode:**
1. Add an **"Where your data goes"** section per product (audio→Groq/OpenAI/Apple; transcript→Anthropic+Supabase; corpus→chosen provider; code/notes→provider) — this is the in-app + policy data map the audit says is missing (Phase 6 §10.5; ShipTalk §5).
2. **Disclose IP addresses** and their retention.
3. **Disclose DeepSeek** and add an Art. 44–49 international-transfer paragraph.
4. **Reconcile the sub-processor list** with reality (remove Sentry/Groq/OpenRouter/Ollama if absent; add DeepSeek; enumerate Printful's shipping-PII categories).
5. **Define "private"** on first prominent use exactly as the audit suggests: *"your data stays on your device and is not sent to our servers; it is not encrypted at rest and is not protected from other software on your machine"* (Phase 9 §3.1).
6. **Reconcile rights language with P-3** — keep Access/Export/Delete only at the level the manual SOP can actually perform within 30 days; do not promise "export in JSON" unless that artifact is real (Phase 9 §7.1).

**Deliverables checklist.**
- [ ] Privacy Policy redraft + one counsel review pass.
- [ ] In-app data-flow notice (text only) added to each desktop app's settings/about copy.
- [ ] DeepSeek + IP disclosures live.
- [ ] Sentry/Groq/OpenRouter/Ollama reconciled.
- [ ] "Private" defined on first use, ecosystem-wide.

---

### P-3 — Data Deletion & Export Request-Handling SOP
**EFFORT: Low · PROTECTION: High**

**Document to draft:** `Data Subject Request (DSR) SOP.md` — an *operational runbook* with a logged request ledger. This is the manual process that *backs the promise the website already makes* (`app/deletion-export/page.tsx`, `app/privacy/page.tsx:78-93`).

**Scope.** Every data-subject Access/Export/Delete/Correct request, across all four products and every store: Supabase (`profiles`, `subscriptions`, `usage_events`, `ip_rate_events`, `team_members`, Stripe IDs), Stripe, Printful (shipping PII), and the desktop local stores the user holds themselves.

**Who it binds.** The founder as the sole DSR handler; it is the audited evidence that the published right is actually fulfillable.

**Audit risk mitigated.**
- Promised GDPR Art. 15/17/20 + CCPA rights with **no code path** — only a manual email, unaudited (Phase 6 §4, §5; Phase 2 W-3; Phase 9 §7.1). A manual process is *legally permissible if reliably executed and logged within statutory windows* — this SOP is what makes that true.
- ShipTalk broken delete UI + zero `transcriptions.delete()` and ShipMind orphan-on-delete (Phase 6 §4 table; ShipTalk S-3) — until fixed, the SOP must include the **operator-side** server delete (Supabase row deletion via service-role) and a written acknowledgment to the user of what cannot yet be self-served and what local cleanup they must perform.
- Printful/Stripe-held PII not covered by any deletion flow (Phase 2 W-8).

**Core SOP contents to encode:**
1. **Intake + identity verification** step (verify the requester owns the account) and a **30-day clock** matching the published commitment.
2. **A deletion checklist per store** — Supabase tables to purge (by `user_id`), Stripe customer handling, a **Printful deletion request** to the fulfillment vendor, and instructions emailed to the user for local desktop cleanup (with the honest caveat already on `deletion-export` that local files aren't auto-removed).
3. **An export assembly checklist** — what to pull from each table into a portable file; only promise the format you can actually produce.
4. **A request ledger** (date received, type, identity-verified, completed date, stores actioned) — the audit trail a regulator expects.
5. **An escalation note**: where the *product* cannot yet delete (ShipTalk cloud rows, ShipMind orphaned audio/images), document the interim operator-side action so the response is complete.

**Deliverables checklist.**
- [ ] DSR SOP written with per-store deletion + export checklists.
- [ ] Request ledger template created.
- [ ] `privacy@makeshiphappen.tech` monitored + 30-day SLA documented.
- [ ] Printful + Stripe vendor-deletion steps confirmed with each vendor's process.

---

### P-4 — Acceptable Use Policy (AUP)
**EFFORT: Medium · PROTECTION: High**

**Document to draft:** `Acceptable Use Policy.md`, published and incorporated by reference into the Terms of Service / EULA, and surfaced at first run for the desktop apps.

**Scope.** All four products, with special-emphasis clauses for **ShipSpace** (shell-capable autonomous agents on real files — Phase 2 §6) and the **companion MCP servers** (Phase 2 §8.2). Binds end users and any team-member sub-users.

**Who it binds.** Every user; the central instrument that **allocates liability from the operator to the user** for misuse of capabilities the audit flags as dangerous-by-design.

**Audit risk mitigated.**
- **Shell-capable agents / "not a sandbox"** — ShipSpace runs raw PTYs, `read_file`/`list_directory` with no path confinement, auto-approval that can `rm -rf`/`curl`-exfil scoped only by OS perms (Phase 2 SP-1, SP-2, SP-7; Phase 9 §6.1–§6.2). The AUP must put the consequences of running autonomous agents on the user.
- **Anti-exfiltration** — the no-auth MCP servers expose the full corpus (and ShipTalk's live Supabase token) to *any local agent* (Phase 2 §8.2, T-1 Critical; Phase 6 MC-5). The AUP prohibits using the products (or third-party agents pointed at the MCP servers) to access data the user is not authorized to access, and prohibits pointing agents at others' machines/data.
- **Anti-tier-spoofing** — client-side-only authorization + hardcoded owner-email backdoor; tier is spoofable by editing localStorage/patching the bundle (Phase 11 S-4; ShipTalk §4). The AUP must **expressly prohibit circumventing subscription tier / entitlement controls**, making spoofing a terms breach (a contractual hook independent of the technical weakness).
- **LibraryGate** members-only content extraction (Phase 9 §7.6) — prohibit scraping/extracting gated content.

**Core prohibited-use clauses to encode:**
1. **Prohibited uses of shell-capable agents:** no use to attack, exfiltrate from, or damage systems/data you don't own or aren't authorized to use; no use to process third-party confidential/regulated data without that party's consent; **user assumes responsibility for all actions taken by autonomous agents they enable** (especially in auto-approve / acceptEdits / bypass modes).
2. **Anti-exfiltration:** no use of the products or the MCP servers to access, copy, or transmit data the user lacks rights to; no pointing untrusted agents at the local MCP endpoints to harvest another person's corpus or session token.
3. **Anti-tier-spoofing / no-circumvention:** no modifying, patching, intercepting, or otherwise circumventing tier, license, or entitlement gating; doing so terminates the license.
4. **Consent-to-record cross-reference** to P-5 (the user must have authority/consent to record any voice they capture).
5. **No high-stakes reliance without independent verification** — cross-reference P-7 (do not rely on agent "security verdicts" or AI output as authoritative).
6. **Lawful-content** clause — no illegal content, no IP infringement, no processing of others' personal data unlawfully.

**Deliverables checklist.**
- [ ] AUP drafted + incorporated into ToS/EULA by reference.
- [ ] First-run/settings surface for desktop apps links to the AUP.
- [ ] Shell-agent + MCP-exfiltration + tier-circumvention clauses present.

---

### P-5 — Recording & Consent Policy
**EFFORT: Low · PROTECTION: High**

**Document to draft:** `Voice Recording & Consent Policy.md` (short, user-facing) + an in-app one-line consent notice near the microphone/recording controls of ShipTalk, ShipMind, and ShipSpace voice features.

**Scope.** Every voice/microphone capture path: ShipTalk live + file transcription, ShipMind voice notes, ShipSpace dictation/realtime (Phase 2 T1–T3, M1, S4; Phase 6 §2).

**Who it binds.** End users — it places the legal duty to obtain consent on the person doing the recording.

**Audit risk mitigated.**
- **Two-party-consent jurisdictions** — California (where the audit flags jurisdictional considerations) is an all-party-consent state under Cal. Penal Code §632; the products capture free-form voice that may include third parties. Voice is also special-category-adjacent (biometric) data (Phase 6 §2.1, §9 Art. 9 risk).
- "Not dictating others' sensitive data without consent" is already named as the user's responsibility (Phase 11 §9) — this policy formalizes it.
- Web Speech may route audio to Apple even in the "local"-labeled engine (Phase 11 S-10) — the consent notice should pair with the engine-level disclosure.

**Core clauses to encode:**
1. **User is responsible** for obtaining all consents required by their jurisdiction before recording any conversation, especially in two-party / all-party-consent states (name California §632 explicitly).
2. **Voice is sensitive data** — users should not capture others' voices or sensitive content without authority.
3. **Engine disclosure** — note that some engines (cloud STT, Web Speech) transmit audio off-device; in-app notice at the engine picker.
4. **No medical/legal/biometric reliance** disclaimer for transcripts.

**Deliverables checklist.**
- [ ] Recording & Consent Policy published.
- [ ] In-app consent line near record controls (all three voice apps).
- [ ] Engine-picker disclosure for cloud/Web-Speech audio egress.

---

### P-6 — Data Retention & Lifecycle Policy
**EFFORT: Medium · PROTECTION: Medium**

**Document to draft:** `Data Retention & Lifecycle Policy.md` — a *written retention schedule* per data class. This is a governance instrument that establishes the policy commitment **even before TTL/pruning code exists**; it converts the audit's "retention = forever" finding into a defined, defensible position and a roadmap obligation.

**Scope.** Every persistent store in Phase 2 §2.1 and §3: ShipTalk `shiptalk-history`, ShipMind `shipmind.db` + `backups/*.db` + archived audio/images + `ingest_debug.log`, ShipSpace scrollback/agent-chat/captures/logs, website `usage_events` / `ip_rate_events` / billing identifiers, and the world-readable `/tmp/shiptalk-follow.log`.

**Who it binds.** MakeShipHappen internally (commitment + roadmap) and externally via the Privacy Policy cross-reference.

**Audit risk mitigated.**
- **No retention/TTL/pruning anywhere** vs GDPR Art. 5(1)(e) storage limitation + 5(1)(c) minimization + CCPA/CPRA §1798.100(c) (Phase 6 §3; Phase 2 §8.1). A "private second brain" that keeps voice/notes forever in cleartext is squarely misaligned — a *written schedule* is the first, lowest-effort corrective even pending code.
- IP retention with no TTL (Phase 2 W-5); backups never pruned (Phase 6 §3); `/tmp` diagnostic accumulation (Phase 11 S-12).

**Core contents to encode:**
1. **A retention table**: data class → store → target retention window → disposal method → status (`enforced` vs `policy-only / roadmap`). Be honest that some are currently `policy-only` pending engineering.
2. **A default finite window** for transcript history, scrollback, backups, logs, and `ip_rate_events`.
3. **A disposal-on-request** cross-reference to the DSR SOP (P-3).
4. **A roadmap commitment** date for converting `policy-only` rows into enforced pruning (this also bounds your regulator-facing exposure: documented intent + timeline).
5. **An at-rest disclosure** acknowledging the local stores are unencrypted and captured by iCloud/Time Machine, with the user-side mitigation guidance (exclude from backup) — a documentation control, not a code change.

**Deliverables checklist.**
- [ ] Retention schedule table written (with enforced vs policy-only column).
- [ ] Default windows chosen per class.
- [ ] Cross-referenced from Privacy Policy + DSR SOP.
- [ ] Roadmap date recorded for enforcement.

---

### P-7 — AI-Use & Output Policy
**EFFORT: Low · PROTECTION: Medium**

**Document to draft:** `AI Use & Output Policy.md`, surfaced in-app and in the ToS — an output-disclaimer + responsible-use instrument.

**Scope.** All AI-generated output across the ecosystem: ShipTalk polish, ShipMind chat/vision/Deep-Research, ShipSpace agents and mission "security verdicts" (Phase 2 §4–§6; Phase 9 §6.3).

**Who it binds.** End users (reliance) and the operator (disclosed limitations).

**Audit risk mitigated.**
- **"Surface secret leaks… returns a verdict"** markets LLM security review as authoritative; non-deterministic, and the tool-calling loop is unimplemented on 4/7 providers while `modelSupportsTools` returns true (Phase 9 §6.3). The policy frames AI output as **assistive, not authoritative**.
- Hallucination / accuracy risk on a product courting legal/decision users (Phase 9 §3.3).
- Auto-approval acting "without you" (Phase 9 §6.1) — the policy states the user remains responsible for reviewing AI/agent actions.

**Core clauses to encode:**
1. **No-warranty on output accuracy** — AI output may be incomplete or incorrect; not professional (legal/medical/financial/security) advice.
2. **"Verdicts" are assistive** — security/audit findings from agents are aids for the user's own review, not a guarantee that issues were found or fixed.
3. **User-review duty** — the user is responsible for reviewing and approving agent actions, especially in autonomous modes.
4. **BYOK content notice** — content sent to AI providers is governed by those providers' terms (cross-ref P-2/P-8).

**Deliverables checklist.**
- [ ] AI Use & Output Policy drafted.
- [ ] In-app surface (settings/about) + ToS incorporation.
- [ ] "Assistive, not authoritative" framing applied to mission-verdict copy (cross-ref P-1).

---

### P-8 — Sub-Processor Disclosure Register (policy + published page)
**EFFORT: Low · PROTECTION: Medium**

**Document to draft:** A maintained **Sub-Processor List** (the `/subprocessors` page) governed by a short internal **Sub-Processor Change Policy** (add/remove a processor → update the page + record the data categories + jurisdiction).

**Scope.** Every processor in Phase 2 §7 / the data map: Anthropic, OpenAI, Google, Groq, **DeepSeek (China)**, Perplexity, OpenRouter, xAI, Manus, Apple (Web Speech), Supabase, Stripe, Printful, Vercel, Hugging Face, Brave, YouTube, GitHub.

**Who it binds.** MakeShipHappen's published transparency commitment (GDPR Art. 28 / Art. 13(1)(e)).

**Audit risk mitigated.**
- **Over-inclusive** list (Sentry/Groq/OpenRouter/Ollama named but absent) + **under-inclusive** (DeepSeek omitted) (Phase 6 MC-3/MC-4; Phase 2 W-4).
- **Printful shipping-PII categories** not enumerated (Phase 2 W-8; Phase 9 §7.4).
- No per-provider data-handling/residency notice anywhere (Phase 2 §8.3).

**Core contents to encode:**
1. **A processor table**: name → purpose → data categories received → jurisdiction → controller/processor role. Mark DeepSeek's China jurisdiction explicitly.
2. **Reconcile** with code reality (remove the absent four; add DeepSeek; enumerate Printful's name+address+email).
3. **A change-control rule** so the page stays accurate as providers are added/removed.

**Deliverables checklist.**
- [ ] `/subprocessors` page reconciled with the data map.
- [ ] Data categories + jurisdiction per processor.
- [ ] Internal change-control rule adopted.

---

## 3. Binding & incorporation map (how the documents connect)

| Instrument | Where it lives | Incorporated into | Binds |
|---|---|---|---|
| Marketing-Claims Substantiation Policy (P-1) | Internal | Publish checklist | Founder / copy authors |
| Privacy Policy (P-2) | Public web + in-app notice | Linked from app + checkout | All users + regulators |
| DSR SOP (P-3) | Internal runbook + ledger | Backs Privacy Policy rights | Founder (handler) |
| Acceptable Use Policy (P-4) | Public | ToS/EULA by reference + first-run | All users |
| Recording & Consent Policy (P-5) | Public + in-app notice | ToS + AUP cross-ref | End users |
| Data Retention & Lifecycle Policy (P-6) | Internal + Privacy Policy cross-ref | Privacy Policy + DSR SOP | Operator + users |
| AI Use & Output Policy (P-7) | Public + in-app | ToS by reference | Users + operator |
| Sub-Processor List + change policy (P-8) | Public page + internal rule | Privacy Policy reference | Operator commitment |

> A **Terms of Service / EULA** is the umbrella that incorporates P-4, P-5, P-7 by reference and carries the warranty disclaimer + limitation-of-liability. It is referenced here as the binding vehicle but is specified as a *Legal* protection in the companion legal-protections document, not duplicated in this policy suite.

---

## 4. Sequencing recommendation

1. **Today (Low-effort, High-protection):** P-1 (claims register + ban list), P-3 (DSR SOP + ledger), P-5 (recording consent). These need no lawyer and no code; they immediately reduce the most acute deceptive-claims and unfulfillable-rights exposure.
2. **This week (Medium-effort, High-protection):** P-2 (Privacy Policy alignment — one counsel pass) and P-4 (AUP into ToS). These close the on-device/DeepSeek/IP gaps and allocate shell-agent + tier-spoofing liability.
3. **Near-term (Medium, Medium):** P-6 retention schedule, P-7 AI output policy, P-8 sub-processor register.
4. **Ongoing (Long-term):** maintain the claims register, the DSR ledger, the sub-processor change-control, and the retention roadmap as living programs — the policies only protect you if they are kept current and actually operated.

---

*End of Business Protection Blueprint 05 — Core Policy Suite. Read-only on source code; this document and the structured digest are the only outputs. No code, refactor, or architecture change is prescribed.*
