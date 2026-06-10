# Business Protection Blueprint — Part 08: Governance Controls

**Company:** Ship Ecosystem (ShipTalk, ShipMind, ShipSpace desktop apps + makeshiphappen.tech)
**Prepared for:** Jake (solo founder / sole operator), US-based (Nevada/California considerations)
**Date:** 2026-06-07
**Document type:** Business / legal / operational governance wrapper around the v3 technical audit
**Scope note:** This document recommends **only** Corporate / Legal / Documentation / Policy / Operational / Insurance / Governance / User-responsibility instruments. It does **not** prescribe code, refactors, or architecture. Where a finding has a technical root cause (client-side authorization, owner-email bypass, `metadata.plan` tier assignment, deploy-from-working-tree), it is governed here through documented policy, decision records, review cadence, and registers — not by changing the code.

---

## 0. Why a solo founder needs governance at all

The audit's single most repeated theme is that **safety-critical controls live outside the codebase and have no owner**: whether Supabase "Confirm email" is ON, whether RLS migrations 001–012 are actually applied in prod, whether the deployed Vercel artifact matches the audited repo, whether a comp grant was ever revoked, and which sub-processors actually receive user content. These are not engineering defects — they are **unassigned governance duties**. For a one-person company they are invisible until they fail; the entire purpose of this document is to convert them into a small set of named, scheduled, written controls that survive busy weeks, future hires, and an enterprise security questionnaire.

The governance model below is deliberately **lightweight**: a register, a handful of one-page policies, a recurring calendar cadence, and a decision log. None of it requires a team. All of it is designed so that the first hire (or an acquirer's diligence team, or a regulator) can read it and trust the system.

> **Reading the tags.** Each control carries an **Effort** tier (Low / Medium / Long-term) and a **Protection value** (High / Medium / Low). The blueprint is prioritized highest-protection-for-lowest-effort first. Start at the top of Section 9 (the prioritized rollout) if you only have one afternoon.

---

## 1. Authorization-Decision Governance Model

**Mitigates:** Exec #4 (client-side-only authorization, owner-email bypass), Exec #6 / #9; Security ST-3, SM-11, SS-10, WEB-2; Website S-2; Compliance #4; cross-cutting "Authorization — High (business-logic)."

The audit is explicit: every product hardcodes `OWNER_EMAILS` (`zzgemsjewelry@gmail.com`) and forces `tier='team'` **client-side**, with the only real backstop being unverified Supabase RLS, and the owner bypass is safe **only if** email-confirmation is ON in production. None of these facts can be confirmed from code. The governance answer is not to rewrite the auth layer; it is to **document the access-control model, name an owner for it, and put its load-bearing settings on a verification cadence.**

### 1.1 Documents to draft

| Document | What it must state | Effort | Protection |
|---|---|---|---|
| **Access Control Policy (ACP)** — one page | The canonical statement that entitlement integrity rests on server-side Supabase RLS; that client-side tier flags are advisory only; that `OWNER_EMAILS` is a known privileged-credential pattern whose safety **depends on** email-confirmation being ON; who may add/remove an owner email and how that change is recorded. | Low | High |
| **Privileged-Access Register** (see 1.3) | Every standing privileged credential and bypass in the ecosystem, its holder, its blast radius, and its review date. | Low | High |
| **RLS / Entitlement Posture Statement** | A plain-language record of which migrations (001–012) are applied in prod, when last verified, and the assertion that cross-tenant isolation depends on `auth.uid()` scoping. Becomes the answer to enterprise questionnaire item "how is tenant isolation enforced?" | Medium | High |

### 1.2 The owner-email bypass — govern, don't recode

Because the audit flags `OWNER_EMAILS` as a **static credential embedded in every distributed binary**, treat it as a privileged credential under formal control rather than a code constant:

- [ ] **Record it in the Privileged-Access Register** as "Owner override — present in ShipTalk, ShipMind, ShipSpace, website; static; cannot be rotated without a release."
- [ ] **Decision record:** write a one-paragraph Decision Record stating the business reason it exists (founder self-comp / support access) and the compensating control (email-confirmation ON). This converts an undocumented backdoor into a deliberate, defensible decision.
- [ ] **Quarterly attestation:** confirm in writing each quarter that no additional owner emails were added and that email-confirmation remains ON. (Calendar item, Section 6.)

### 1.3 Privileged-Access Register (the single most valuable artifact in this document)

A flat table you maintain in the repo (or a private doc). Seed it from the audit's own inventory of high-privilege flows:

| Privileged credential / bypass | Where | Blast radius (per audit) | Holder | Compensating control | Review |
|---|---|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env; release scripts; comp-access | Full read/write to ALL user data, bypasses RLS (I-6, SS-11, ST-7, WEB-3) | Jake | Throws if unset; never in browser | Quarterly |
| `OWNER_EMAILS` static override | All 4 products | Forces `team` tier + rate-limit bypass | Jake | email-confirmation ON (S-2) | Quarterly |
| Stripe secret + webhook secret (ZZ GEMZ) | Vercel env | Billing mutation | Jake | Signature verify + dedupe | Quarterly |
| `comp-access.mjs` grants | Local CLI, service-role | Indefinite free premium, no auto-expiry (S-3) | Jake | Refuses if `stripe_customer_id` exists | **Monthly** (see 5) |
| Release signing (minisign) / releases bucket | Local | Publish to auto-updater feed | Jake | minisign verify; rejects ad-hoc | Quarterly |
| Supabase "Confirm email" toggle | Supabase project settings | Gate that makes owner bypass safe | Jake | n/a — this IS the control | **Quarterly attest** |

**Effort: Low. Protection: High.** This one table answers most of the audit's "load-bearing but undocumented" findings (Documentation #5) and is the first thing any acquirer or enterprise buyer asks for.

### 1.4 Periodic RLS / entitlement review cadence

The audit states RLS is "the load-bearing external control" and "not auditable from these client repos." Governance fix = a **scheduled manual review**, not new code:

- [ ] **Quarterly RLS review:** log into the live Supabase project, confirm migrations 001–012 are applied, spot-check that `usage_events`, `dictionary_terms`, `transcriptions`, billing columns are scoped to `auth.uid()`, and record the result (date, who, findings) in the Posture Statement.
- [ ] **On every new table or migration:** a one-line entry in the Decision Log noting whether it carries RLS and who confirmed it. (This is the governance backstop for ST-8 / SS-10 "tier preserved on error" and P-8/P-9 dormant schema.)

**Effort: Medium. Protection: High.**

---

## 2. Sub-Processor Change-Control Board (a checklist of one)

**Mitigates:** Exec #14 (no sub-processor inventory), #23 (no DPA); Legal #6 (DeepSeek/China), #7 (inaccurate disclosures); Privacy #5, #8, #9; Compliance #3, #6, #9; Website I-1, I-2, P-3; cross-cutting "External integrations — Medium."

The audit found the sub-processor disclosures are **both over- and under-inclusive** (lists Sentry/Groq/OpenRouter/Ollama that aren't in the code; omits DeepSeek, a China-based processor receiving user prompts) and that there is **no inventory** at all. For a solo founder, a "board" is a **one-person change-control gate** — a rule that no AI provider or data sub-processor is added, removed, or re-pointed without a written entry. This is the cheapest possible fix for a High-rated GDPR transparency and international-transfer gap.

### 2.1 The instrument: a Sub-Processor Register + a change gate

| Action | Detail | Effort | Protection |
|---|---|---|---|
| **Draft the Sub-Processor Register** | One table: vendor, what data it receives (code/voice/notes/prompts/PII), jurisdiction, server-keyed vs BYOK, DPA-on-file (Y/N), date added. Seed from the audit's provider maps: Anthropic, OpenAI, Google, **DeepSeek (China)**, Supabase, Stripe (ZZ GEMZ), Printful, Vercel; plus the desktop apps' up-to-11 providers. | Low | High |
| **Reconcile the public sub-processor page** | Add DeepSeek (with a residency note + opt-out statement), remove Sentry/Groq/OpenRouter/Ollama unless actually wired, and stop framing platform-keyed `/api/chat/*` providers as "BYO." This is a Legal/Documentation correction, not code. | Low | High |
| **Adopt the change-control gate** | A written rule: "No sub-processor is added/removed/re-pointed (incl. switching a model's default provider) without (a) a new register row, (b) a public disclosure update, (c) a DPA check, and (d) a residency check." | Low | High |
| **DeepSeek / China decision record** | A standalone Decision Record: either (i) keep DeepSeek with disclosure + SCC/transfer-mechanism review + user opt-out, or (ii) drop it. Documents the deliberate choice for FTC/GDPR defensibility. | Medium | High |
| **Stand up a DPA-on-request process** | A template DPA (and an SCC addendum for non-US transfers) ready to send to B2B buyers, plus the standing instruction to never sign a customer MSA promising sub-processor controls the register can't back. Unblocks Exec #23. | Medium | Medium |

### 2.2 The "board" meeting (5 minutes, quarterly, solo)

- [ ] Re-read the Sub-Processor Register against the live provider list.
- [ ] Confirm the public sub-processor page still matches reality.
- [ ] Confirm any "on-device"/"private" claim is still defensible against the actual egress (links to Section 4).
- [ ] Log the review date.

**Effort: Low. Protection: High.** When you hire, this checklist becomes the agenda for a real change-control board; today it is a recurring solo task.

---

## 3. Pricing & Entitlement Change Governance

**Mitigates:** Exec #10 (draft $20/$40 vs live $50/$500), #11 (`metadata.plan` tier-assignment), #8 (comp no expiry); Website S-6, S-3; Compliance #25; Documentation #15.

The audit flags two distinct pricing/entitlement risks: (a) **drift** — draft ShipMind pricing ($20/$40) diverges from live Stripe ($50/$500), a consumer-protection/refund exposure; and (b) **structural fragility** — subscription tier is driven by Stripe `metadata.plan`, "structurally any future path that lets a user influence metadata escalates to `team`." Neither is fixed by code in a governance document; both are fixed by a **change-control discipline around pricing and tier definitions.**

| Control | What it does | Effort | Protection |
|---|---|---|---|
| **Single source-of-truth Pricing Record** | One canonical document listing every live price (Stripe Price ID ↔ displayed price ↔ plan name ↔ entitlements). Rule: no price is displayed anywhere (marketing page, PDF, draft) that isn't in this record. Kills the $20/$40 vs $50/$500 drift (Exec #10). | Low | High |
| **Pricing-change gate** | Written rule: any price change must update (1) Stripe, (2) the Pricing Record, (3) every public surface, **in that order, same day**, and be logged. Prevents charged-price ≠ displayed-price refund/chargeback exposure. | Low | High |
| **Tier-definition Decision Record** | Documents what each tier (Free / Pro / Team-aka-Ultra) entitles, and the **explicit standing instruction**: never build or enable any flow that lets a user influence Stripe `metadata.plan` (S-6). This converts a latent escalation path into a governed prohibition without touching code. | Low | High |
| **Comp-access governance** (ties to 1.3 and 5) | Treat every comp as a logged, time-boxed grant with a manual expiry review, because the tool has **no auto-expiry**. | Low | High |
| **Retire stale pricing collateral** | Pull/replace the legacy "Private" PDFs at repo root and any draft pages carrying superseded prices/guarantees (Exec #22, Legal #17). Documentation/Legal action. | Medium | Medium |

**Net: Effort Low–Medium, Protection High.** The Pricing Record + change gate is the highest-leverage consumer-protection control in this part.

---

## 4. Marketing-Claims Approval Gate

**Mitigates:** Exec #5 ("100% on-device" contradicted by code), #13 ("built for legal teams"), #19 (phantom providers), #20, #21; Legal #5, #9; Privacy #10, #11; Compliance #5, #16, #17; Documentation #6 (aspirational security-plan.md migrating into public claims).

This is the audit's clearest FTC/UDAP exposure: marketing says "100% on-device / private," the **code's own comments contradict it**, "built for legal teams / fastest law-tech teams" targets regulated buyers the product can't serve, and phantom providers (Manus, nano-banana mock) are presented as real. The governance instrument is a **one-person claims approval gate**: no public claim about privacy, security, on-device processing, compliance fitness, or capability ships without passing a substantiation check.

### 4.1 The gate (a checklist, run before any publish)

Before any marketing copy, product page, README, app-store text, PDF, or social post goes live, confirm:

- [ ] **On-device / private claims:** does the actual egress (Section 2 register) support the words? If content leaves the device to any provider, do not say "100% on-device" or "never leaves your device." (Exec #5, Privacy #10/#11.)
- [ ] **Capability claims:** is the feature actually wired? No claiming Manus / nano-banana / Chrome-extension ingest / broad source-grounding that the audit found mock, dead, or OpenAI-only. (Exec #19/#20/#21.)
- [ ] **Compliance/fitness claims:** no "built for legal teams," "secure documents," HIPAA/attorney-client-grade language while storage is unencrypted and no compliance cert exists. (Exec #13, Compliance #16/#17.) Add a **"no compliance certification"** disclaimer where regulated buyers might infer one.
- [ ] **Aspirational-doc firewall:** never lift language from internal `security-plan.md` (which claims "typed intents validated," the **opposite** of shipped reality) into public copy. (Documentation #6.)
- [ ] **Substantiation file:** for any superlative or factual claim, keep a one-line note of the basis. This is the FTC "competent and reliable evidence" standard in lightweight form.

| Control | Effort | Protection |
|---|---|---|
| Adopt the Marketing-Claims Approval Gate checklist as policy | Low | High |
| Build a **Claims Substantiation Log** (claim → basis → date) | Low | High |
| One-time remediation sweep of existing live copy against the checklist | Medium | High |
| Add standing "no compliance certification" + AI-output disclaimers to product pages | Low | Medium |

**Effort: Low–Medium. Protection: High.** This gate is the difference between a defensible marketing record and a self-incriminating one (the audit notes the deceptive-practice case is unusually strong because the contradiction is in the company's *own code comments*).

---

## 5. Comp-Access & Indefinite-Grant Governance

**Mitigates:** Exec #8; Website S-3; Liability hotspot #5.

`comp-access.mjs` sets `subscription_tier` via the service-role key with **no auto-expiry** — a comp persists until a human runs `revoke`. The audit confirms the app has no automatic expiry; revocation is manual. Governance, not code, closes this.

- [ ] **Comp Grant Log:** every grant records grantee, reason, date granted, **agreed end date**, date revoked. (Low / High.)
- [ ] **Monthly comp sweep:** a recurring calendar task to review the log and revoke anything past its end date. This is the only thing standing between you and indefinite revenue leakage. (Low / High.)
- [ ] **Standing policy:** no comp is granted without an end date in the log. (Low / High.)

**Effort: Low. Protection: High** (directly stops a Medium revenue-leakage finding with one recurring task).

---

## 6. Periodic Risk-Review Cadence (tied to this audit)

**Mitigates:** Exec #24 (key-person / bus-factor), the "items requiring live-environment confirmation" list, and Documentation #23 (no incident-response cadence); ensures the whole blueprint doesn't rot.

A solo founder needs a **calendar, not a committee.** Tie a fixed cadence to the v3 audit so its findings are re-checked rather than forgotten. Put these as recurring events (Google Calendar is fine).

| Cadence | Agenda (sourced from this audit) | Effort | Protection |
|---|---|---|---|
| **Monthly (15 min)** | Comp sweep (Section 5); confirm no new live sub-processor slipped in; glance at the Decision Log. | Low | High |
| **Quarterly (60 min) — the core review** | (1) Verify Supabase "Confirm email" still ON; (2) verify migrations 001–012 still applied; (3) walk the Privileged-Access Register; (4) run the Sub-Processor board (Section 2.2); (5) run the Pricing Record reconciliation; (6) confirm deployed Vercel artifact matches the audited tree (deploy-divergence governance — Exec #7, WEB-2); (7) re-tag any audit finding that changed status. | Medium | High |
| **Annual (half day)** | Re-run or commission a fresh audit; refresh ToS/EULA/privacy/sub-processor docs; review insurance limits (Section 8); review the RACI against actual headcount. | Medium | High |
| **Event-triggered** | New sub-processor, new table/migration, price change, new owner email, security incident → log + run the relevant gate immediately. | Low | High |

### 6.1 Audit-Finding Status Register

Maintain a single tracker mapping each v3 finding to: owner, status (open / mitigated-by-policy / accepted-with-rationale / fixed), and the governing document. This is what proves to a regulator or acquirer that the audit was *acted on*, not shelved. **Effort: Low. Protection: High.**

### 6.2 Decision Log

A running, append-only log of every governance decision (sub-processor added, comp granted, price changed, owner email added, risk accepted). One line each. **Effort: Low. Protection: High.** It is the connective tissue for every other control here and the single best evidence of a functioning governance program for a company of one.

---

## 7. Roles & Responsibilities (RACI) — built for one, ready for the first hires

**Mitigates:** Exec #24 (single-developer key-person dependency for release signing / Supabase admin); Documentation #5 (admin role load-bearing but undocumented), #12 (no shared-responsibility allocation), #24 (retention ownership unassigned).

Today every role is Jake. The value of writing the RACI **now** is twofold: it surfaces the **key-person / bus-factor risk** the audit calls out (one person holds release signing, Supabase admin, billing, and incident response — a genuine continuity risk), and it gives the first hires a ready map. The audit's own per-product "User-Responsibility Assignment" tables (e.g., website Section 9) are the seed.

### 7.1 RACI matrix (R=Responsible, A=Accountable, C=Consulted, I=Informed)

| Governance duty (from the audit) | Founder/Owner | (Future) Eng | (Future) Legal/Compliance | (Future) Ops/Release | Outside counsel |
|---|---|---|---|---|---|
| Verify "Confirm email" ON; RLS migrations applied | A/R | C | I | C | — |
| Maintain Privileged-Access Register | A/R | C | I | C | — |
| Sub-Processor Register + change gate | A/R | C | C | I | C |
| DeepSeek/China transfer decision | A | I | R | I | C |
| Pricing Record + change gate | A/R | I | C | I | — |
| Marketing-claims approval gate | A/R | I | C | I | C |
| Comp grants + monthly sweep | A/R | — | I | C | — |
| Deploy-divergence check (prod = audited) | A | R | I | R | — |
| OSS attribution / NOTICE governance (Legal #8) | A | C | R | R | C |
| GPL-ffmpeg licensing decision (Exec #3, L-1) | A | C | R | C | **R** |
| Data retention / deletion ownership | A | R | C | R | C |
| Incident response / breach notification | A/R | C | C | C | C |
| Release signing custody (key-person) | A/R | — | — | R | — |

### 7.2 Key-person continuity controls (bus-factor)

- [ ] **Break-glass document** (sealed, offline): list of all admin accounts, where service-role/Stripe/Supabase/minisign keys live, and the steps a trusted party (or future hire) would take to keep billing and releases running if the founder is unavailable. Names the single points of failure the audit flags. **(Medium / High.)**
- [ ] **Custody note** for release-signing keys and the Supabase service-role key, so the first ops/eng hire inherits a documented chain, not tribal knowledge. **(Low / Medium.)**

**Effort: Low–Medium. Protection: Medium–High.**

---

## 8. Corporate, Insurance & Governance Backstops

**Mitigates:** Exec #1/#2 (no corporate shield; liability on a single named individual); cross-cutting agent-action / RCE / deletion exposure; supports every policy above with an entity and a financial backstop.

The audit's #2 business risk is that **liability is concentrated on a single named individual with no apparent corporate shield**, while the products grant agents shell access, act on hallucination-prone output, and process voice/code/PII. Governance controls are far more credible — and far more enforceable — behind an entity. These are the structural backstops that make the rest of this document stick.

| Control | Detail (concrete, tailored) | Effort | Protection |
|---|---|---|---|
| **Form/confirm the operating entity** | If not already done, operate the Ship Ecosystem through a US LLC (NV or CA — the audit notes both). Move the Stripe account ("ZZ GEMZ"), Vercel, Supabase, Apple Developer ID, and domain ownership **into the entity's name.** A corporate shield is worthless if contracts and IP sit with the individual. | Medium | High |
| **Corporate-formalities discipline** | Separate bank account, no commingling, signed assignment of all Ship IP from Jake to the entity, minimal annual minutes/consent. Preserves the liability shield against piercing. | Medium | High |
| **Quote Tech E&O + Cyber liability insurance** | Specifically: a combined **Technology Errors & Omissions / Cyber** policy that covers (a) AI/agent-driven harm (deletion, RCE, keystroke injection — the audit's uncapped-exposure scenarios), (b) privacy/breach response and the 72-hour-notification gap, and (c) IP/licensing defense (relevant to the GPL-ffmpeg and attribution findings). Get quotes from a tech-focused broker; this is the financial backstop for the absent liability cap (Exec #1) until the EULA is live. | Medium | High |
| **Confirm a registered agent + governing-law/venue posture** | Pin governing law and venue to the entity's state in the forthcoming ToS/EULA so disputes resolve on home turf. (Coordinates with the Legal part of the blueprint.) | Low | Medium |
| **Counsel-of-record relationship** | Establish a standing relationship with startup/tech counsel (the RACI's "outside counsel" column), so the GPL-ffmpeg decision, the DeepSeek transfer decision, and the ToS/EULA aren't done blind. | Medium | High |

**Effort: Medium. Protection: High.** The entity + insurance pairing is the governance layer's load-bearing wall: it caps personal exposure while the document-level controls reduce the *likelihood* of a claim.

---

## 9. Prioritized Rollout (highest protection, lowest effort first)

### Tier A — Do this week (Low effort, High protection)
1. Create the **Privileged-Access Register** (1.3) — seed from the audit's high-privilege list.
2. Create the **Sub-Processor Register** + reconcile the public sub-processor page to add DeepSeek and remove unused vendors (2.1).
3. Stand up the **Decision Log** and **Audit-Finding Status Register** (6.1/6.2).
4. Create the **Comp Grant Log** + schedule the **monthly comp sweep** (5).
5. Create the **Pricing Record** + adopt the **pricing-change gate** and **tier-definition Decision Record** (no user-influenced `metadata.plan`) (3).
6. Adopt the **Marketing-Claims Approval Gate** checklist and start the **Claims Substantiation Log** (4).
7. Write the **owner-email Decision Record** and the **DeepSeek/China Decision Record** (1.2 / 2.1).

### Tier B — This month (Low–Medium effort, High protection)
8. Set the **monthly + quarterly + annual risk-review calendar** events (6).
9. Draft the **Access Control Policy** and **RLS / Entitlement Posture Statement**; run the first **quarterly RLS + email-confirmation + deploy-divergence verification** (1, 6).
10. One-time **marketing-copy remediation sweep** against the claims gate (4).
11. Draft the **RACI** + **break-glass / key-person continuity** document (7).

### Tier C — Long-term / structural (Medium–Long effort, High protection)
12. **Form/confirm the LLC**, move accounts into it, execute IP assignment, adopt corporate-formalities discipline (8).
13. **Quote and bind Tech E&O + Cyber insurance** (8).
14. Establish **counsel-of-record**; route the **GPL-ffmpeg** and **DeepSeek-transfer** decisions through them (7, 8).
15. Stand up the **DPA-on-request** process and SCC addendum for B2B (2.1).
16. Retire stale "Private" PDFs and superseded pricing collateral (3).

---

## 10. Document Register Produced by This Part

These are the concrete artifacts to create. Keep them in a private `governance/` folder (or the repo, access-controlled). Each maps directly to an audit finding above.

| Artifact | Governs | Effort | Protection |
|---|---|---|---|
| Access Control Policy | Authorization model, owner bypass | Low | High |
| Privileged-Access Register | All standing privileged credentials | Low | High |
| RLS / Entitlement Posture Statement | Tenant isolation, applied migrations | Medium | High |
| Sub-Processor Register + change gate | Data egress, GDPR transparency | Low | High |
| Pricing Record + change gate | Price/tier drift, `metadata.plan` | Low | High |
| Tier-Definition Decision Record | Entitlement escalation prohibition | Low | High |
| Comp Grant Log + monthly sweep | Indefinite comps | Low | High |
| Marketing-Claims Approval Gate + Substantiation Log | FTC/UDAP, on-device/fitness claims | Low | High |
| Decision Log | Connective evidence of governance | Low | High |
| Audit-Finding Status Register | Proof the audit was acted on | Low | High |
| Risk-Review Calendar (monthly/quarterly/annual) | Cadence; key-person; deploy divergence | Low | High |
| RACI + Break-Glass / Continuity doc | Bus-factor, future hires | Low–Medium | Medium–High |
| Entity formation + IP assignment + corp formalities | Liability shield | Medium | High |
| Tech E&O / Cyber insurance binder | Financial backstop | Medium | High |

---

*End of Part 08 — Governance Controls. This part is the operating manual for the protections defined across the rest of the Business Protection Blueprint; the Legal, Privacy, and Documentation parts produce the customer-facing instruments (ToS/EULA, privacy notice, NOTICE/attribution, DPA) that these governance controls keep accurate and enforced over time.*
