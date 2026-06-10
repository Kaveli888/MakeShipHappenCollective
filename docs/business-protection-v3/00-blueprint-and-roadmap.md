# Ship Ecosystem — Business Protection Blueprint

## Part 00: Master Roadmap & Executive Action Plan

**Prepared by:** Lead Advisor, Business Protection Blueprint
**Date:** 2026-06-07
**Company:** Make Ship Happen Collective (operating "ZZ GEMZ" Stripe; "Ship Ecosystem" product family)
**Founder/Principal:** Jacob Felton (solo, pre/early-revenue, US-based NV/CA)
**Products in scope:** ShipTalk, ShipMind, ShipSpace (paid macOS Tauri desktop apps) + makeshiphappen.tech (Next.js web subscription) + three stdio MCP servers + Chrome extension + Printful-fulfilled merch
**Companion to:** Audit v3 (`docs/audit-v3/`), Phase 10 synthesis

---

> **What this blueprint is — and is not.** This is the **business, legal, and governance wrapper** around the v3 technical audit. The audit already catalogs the technical issues; this Blueprint does **not** prescribe code changes, refactors, or architecture changes. Where a finding has a technical root cause (GPL ffmpeg, raw-shell agents, keystroke injection, no deletion path), it is addressed here through **corporate, legal, documentation, policy, operational, insurance, governance, and user-responsibility instruments** — entity formation, counsel-reviewed licensing decisions, disclosures, EULAs, runbooks, registers, attestations, and acceptable-use terms. The goal is to **operate a legitimate AI software company with clear user responsibility, strong documentation and compliance, and reduced personal liability — without changing product functionality.**

---

## 1. Executive Summary

### 1.1 The Posture Goal

Make Ship Happen Collective is, per the audit, **technically competent but legally and operationally exposed.** The cryptographic and secrets baseline is genuinely strong; the risk is concentrated almost entirely at the **governance, legal, and data-lifecycle layers.** The company is selling paid software that processes highly sensitive data (voice, source code, personal knowledge corpora, shipping PII) and runs autonomous shell-capable agents, with **no Terms of Service, no EULA, no warranty disclaimer, no liability cap, no AUP, and no enforceable privacy program** — while every dollar of liability attaches to a **single named individual** with no corporate shield, billing through a personal jewelry-named Stripe account.

The target posture is a company that:
- **Exists as an entity** (LLC) that is the contracting party, payee, IP owner, and insured of record — so liability caps protect personal assets and the veil holds;
- **Says only true things** in marketing, privacy, and product copy — closing the FTC/UDAP gap the audit calls "self-admitted in code";
- **Allocates responsibility by contract** — clickwrap ToS/EULA/AUP with a liability cap and AI-output disclaimer, accepted and evidenced before further paid sales;
- **Documents what it does and proves it did so** — registers, runbooks, decision records, and an evidence archive that satisfy GDPR Art. 5(2) accountability and enterprise diligence;
- **Transfers residual risk** — a Tech E&O + Cyber insurance program bound in the entity's name on top of a clean, honestly-disclosed record.

### 1.2 The Single Highest-Leverage Moves

Five root causes generate most audit findings. The corresponding highest-leverage business moves are:

1. **Form the LLC** (Corporate, Low effort, High protection). Nothing else fully works without it — the liability cap, the insurance, and the IP license all need an entity to be the counterparty. This is the keystone.
2. **Stand up the legal-document suite with clickwrap acceptance** (Legal, Medium effort, High protection). Today no instrument allocates anything to anyone; the EULA liability cap + AI-output disclaimer + AUP is the primary loss-shifting layer for raw-shell agents, file deletion, and keystroke injection.
3. **Correct the marketing claims and reconcile the sub-processor list** (Policy/Documentation, Low effort, High protection). The "100% on-device" claim is contradicted by the team's own code; correcting it is the single cheapest way to remove a documented FTC/UDAP exposure and to make Media-liability insurance bindable (the willfulness exclusion otherwise voids it).
4. **Route the GPL ffmpeg question and the DeepSeek/China transfer through counsel as recorded licensing/transfer decisions** (Legal/Governance). These are the two matters insurance will **not** cover if left as known/willful; they must be closed by decision record, not by code prescription here.
5. **Back the already-published erasure/export rights with an audited manual DSAR process** (Operational, Low/Medium effort, High protection). The rights are promised; the process makes the promise true without requiring a code change.

> **Sequencing rule the client asked for:** highest protection for lowest effort, first. Tier 1 below is everything that is High-protection and Low-effort — most of it is founder-draftable and shippable before the next sale. The LLC sits at the head of Tier 1 because, although it gates several downstream items, it is itself a low-effort filing and is the precondition for the whole program.

---

## 2. The Prioritized Roadmap

Three tiers, exactly as requested. Within each tier, rows are ranked by protection value (High → Medium → Low), then by how many other items depend on them.

### Tier 1 — Highest protection for LOWEST effort (do first / quick wins)

These are Low-effort, mostly High-protection. Many are founder-draftable; the counsel-led drafting items move to Tier 2. Do these before the next paid sale.

| # | Protection | Category | What it mitigates | Source doc |
|---|-----------|----------|-------------------|-----------|
| 1 | **Form a single-member LLC as the contracting party** (keystone; gates many items) | Corporate | Biz #2 / Legal §3.4 — all liability on one named individual; no shield for caps/insurance/IP to protect | 01 |
| 2 | Decide formation state via NV-vs-CA consult (avoid Nevada-while-CA-resident double-fee/veil trap) | Corporate | NV (Clark County) vs CA references — CA resident on NV-only LLC pays both states, veil disregarded | 01 |
| 3 | Obtain federal EIN | Corporate | Prerequisite for entity banking/Stripe/taxes; establishes distinct taxpayer (asset separation) | 01 |
| 4 | Open a business bank account in the entity name; route all revenue/expenses through it | Corporate | Commingling — the #1 veil-piercing factor; cures personal/ZZ GEMZ fund blend | 01 |
| 5 | Re-title or replace the "ZZ GEMZ" Stripe account to the entity with a recognizable statement descriptor | Corporate | Liability §3.4 / Website §2.3 — personal jewelry-named account → commingling + chargeback/UDAP confusion | 01 |
| 6 | Sign all customer/vendor contracts and accounts in the entity name ("LLC, by Jacob Felton, Member") | Legal | Liability §3.2/§3.4 — ensures the entity is the counterparty so caps/disclaimers protect personal assets | 01/02 |
| 7 | Foreign-qualify the entity in every state where the founder lives/works | Corporate | Veil disregard / loss of home-state court access if out-of-state entity operates unregistered | 01 |
| 8 | Adopt a single-member Operating Agreement naming a successor manager | Governance | SMLLC veil-piercing presumption without an OA; entity continuity on incapacity (Biz #24) | 01 |
| 9 | Appoint a registered agent in formation (and foreign-qualified) state | Corporate | Statutory requirement; lapse → administrative dissolution → voids the shield | 01 |
| 10 | **Marketing-Claims Substantiation Policy + living claims register** (ban unqualified "secure/private/100% on-device/never the documents/built for legal teams") | Policy | Legal #5/#9, Compliance #5, MC-1/MC-2 — FTC §5/UDAP deception contradicted by own code | 05/08 |
| 11 | **Marketing-claims substantiation record** (corrected "on-device" representation, dated correction log) | Documentation | Privacy MC-1/MC-2; doc-gap 8; Legal #5 — removes the willfulness trigger that voids Media coverage | 04/07 |
| 12 | **Accurate, versioned Sub-Processor Disclosure** (add DeepSeek/China; remove phantom Sentry/Groq/OpenRouter/Ollama; enumerate Printful) | Documentation | Privacy #9, Legal #6/#7, Compliance #6 — over/under-inclusive list; undisclosed China transfer | 04/05/08 |
| 13 | **Data Subject Request (Deletion & Export) handling SOP + audited request ledger** | Operational | Compliance #1/#2, Privacy §4/§5 — published erasure/export rights with no code path | 05/04 |
| 14 | **Hold the data-erasure guarantee until the deletion pipeline exists, or scope the promise to reality** | Governance | Privacy #1 / Phase 5 §10 — publishing an erasure promise the system can't perform is a knowing violation | 02 |
| 15 | Privacy Policy alignment: reconcile/qualify "100% on-device"; scope the erasure promise; correct the sub-processor list | Documentation | Legal #5, Privacy #1/#9 — FTC §5/UDAP + GDPR transparency, aggravated by in-code admission | 02 |
| 16 | **Warranty Disclaimer (AS IS / AS AVAILABLE)** clause (consumer savings clause) — drop-in for the EULA | Legal | Phase 5 §4.2 / Liability §9.2 — paid software with no disclaimer = implied-warranty exposure | 02 |
| 17 | **AI-Output Disclaimer** (no-reliance, human-in-the-loop, prompt-injection + agent-action waiver, output responsibility) | Legal | Legal #3 (Critical) — all products act on hallucination-prone output incl. autonomous agents executing code | 02 |
| 18 | **Acceptable Use Policy** (anti-exfiltration, anti-tier-spoofing, no-resale, provider-ToS, yt-dlp/site-ToS prohibition, shell-agent user responsibility) | Policy | Legal #10 / Phase 5 §6 — arbitrary code execution, autonomous agents, keystroke injection, spoofable tier | 02/05 |
| 19 | AI & Third-Party Provider Addendum + sub-processor acknowledgment naming DeepSeek (China) and Apple speech | Legal | Legal #6/#7 — undisclosed China transfer (GDPR Ch.V); inaccurate sub-processor disclosure | 02 |
| 20 | Account-responsibility & BYO-API-key billing clause (user bears provider charges; safeguards credentials/tokens; Team-owner liability) | Legal | Biz #15 / Phase 5 §8 — BYO-key model, cli-login token relay, runaway provider-spend disputes | 02 |
| 21 | Consent-to-record / wiretap clause (user warrants all-party consent; CA Penal Code §632) | Policy | Compliance #12 / Phase 5 §6.1 — ShipTalk mic + ShipSpace Realtime voice with no consent framework | 02 |
| 22 | **Recording & Consent Policy** + in-app consent/engine-picker disclosure | Policy | Privacy §2.1/§9, ShipTalk S-10 — two-party-consent + biometric exposure; Web Speech audio to Apple | 05 |
| 23 | **User-responsibility / AUP clauses allocating yt-dlp & bundled-tool conduct risk to the user** | UserResponsibility | WS-4, Legal #20 — yt-dlp/ffmpeg third-party-download ToS + copyright risk | 03 |
| 24 | Price-discrepancy remediation: reconcile $20/$40 vs $50/$500 across all surfaces; single source of truth; retire stale PDFs | Operational | Biz #10 / doc-gap 15 — displayed ≠ charged price = deceptive-pricing (FTC §5, CA UCL/CLRA/FAL) | 02 |
| 25 | **Pricing Record (Stripe Price ID → displayed price → plan → entitlements)** + same-day pricing-change gate | Documentation/Policy | Biz #10, Compliance #25 — price drift; refund/chargeback risk | 08 |
| 26 | **Tier-Definition Decision Record** prohibiting any flow that lets users influence Stripe `metadata.plan` | Governance | Biz #11 — tier-assignment escalation risk | 08 |
| 27 | **Engage IP/OSS counsel + interim distribution hold on ShipMind until the GPL ffmpeg question is resolved** | Legal | Legal #1 (Critical) — active GPLv2+ copyleft conflict; stops accrual of new breaching distributions | 03 |
| 28 | **Hold proprietary-ownership assertion in the EULA until the GPL-ffmpeg licensing decision is resolved** | Governance | Legal #4 — asserting ownership over a GPL-ffmpeg-bundled binary compounds the violation | 02 |
| 29 | **Licensing Decision Records (incl. GPL ffmpeg LDR under counsel-supervised remediation)** | Legal | Legal #1/#13/#14, Compliance #20 — converts the copyleft matter into a recorded, defensible decision | 04 |
| 30 | **OSS Intake & License Policy** (allowlist / review-required / prohibited + decision-record requirement) | Policy | Compliance #20 / WS-8 — root cause that let GPL ffmpeg enter unnoticed | 03 |
| 31 | Set first-party license-of-record metadata governance; correct placeholder author/copyright identity | Documentation | Legal #13 — empty `license=""`, `authors=["you"]` on a paid product | 03 |
| 32 | MPL-2.0 weak-copyleft per-file source-availability standing pointer-to-upstream offer | Legal | Legal #14 — 5 MPL-2.0 crates statically linked with undocumented source-availability duty | 03 |
| 33 | Model-weights & native-binary provenance documentation practice (Whisper, deno/V8/ICU, ollama/ggml) | Documentation | Legal #23, Security #18 — unsurfaced model licenses + supply-chain provenance | 03 |
| 34 | **Enable MFA on all admin/cloud accounts** (Supabase, Stripe, Vercel, GitHub, registrar, email) | Operational | Security #10/#23 — Cyber-policy binding condition; reduces account-compromise blast radius | 07 |
| 35 | **Supabase "Confirm email" ON — dated evidence + per-release + monthly re-check** | Operational | Compliance #4, Security #13 — OWNER_EMAILS bypass safe only if email-confirmation is ON | 06/08/09 |
| 36 | **Written release checklist with prod-matches-repo verification + env-diff gate** | Operational | Biz #7, Compliance #25 — `vercel --prod` local-tree divergence; live ≠ audited | 06/07 |
| 37 | Canonical-deploy-repo decision record + lockstep rule (reconcile the two website repos) | Governance | WEB-2 — deploy from separate repo; audited ≠ live | 06 |
| 38 | **Comp-access grant register (email/tier/date/intended-expiry/reason/granted-by/revoked)** + monthly sweep + no-comp-without-end-date policy | Operational/Policy | Biz #8 — comp grants have no auto-expiry; indefinite free premium / revenue leakage | 06/08/04 |
| 39 | **Vulnerability-disclosure policy (SECURITY.md) with safe-harbor + dedicated security alias** | Policy | doc-gap 23 — no intake channel for the High/Critical agent/RCE/token findings | 06 |
| 40 | `/.well-known/security.txt` (RFC 9116) on makeshiphappen.tech | Operational | Missing machine-readable researcher beacon; supports coordinated disclosure | 06 |
| 41 | **Click-through acceptance of EULA/ToS/AUP at signup and first install** | Legal | Biz #1 / Legal #2 — no loss-shifting instrument; allocation undocumented because no contract exists | 09 |
| 42 | **Acceptance-evidence retention SOP** (document version/hash, timestamp, user ID, method) | Operational | Makes the clickwrap provable; an un-evidenced clickwrap is unenforceable in practice | 09 |
| 43 | **ShipSpace high-privilege agent/shell first-run consent gate** (documented acceptance) | Policy | Security S-3/S-4, liability hotspot #1 — arbitrary exec / raw PTY; agent destructive action | 09 |
| 44 | **Cloud Features consent gate** with at-the-toggle sub-processor disclosure + DeepSeek/China flag | Policy | Privacy #5/#8, Legal #6, Compliance #3 — undisclosed cross-border + sub-processor transfers | 09 |
| 45 | Voice-recording consent + two-party-consent user-duty acknowledgment | Policy | Legal #22, Compliance #12 — all-party-consent statutes; Web Speech audio to Apple undisclosed | 09 |
| 46 | BYO-key spend & provider-account responsibility clause + key-entry acknowledgment | UserResponsibility | Biz #15 — runaway provider-spend disputes land on the owner | 09 |
| 47 | **Access Control Policy** (RLS is authoritative; client tier flags are advisory) | Policy | Security ST-3/WEB-2, Authorization-High — client-side-only authorization | 08 |
| 48 | **Privileged-Access Register** cataloging every standing privileged credential and bypass | Governance | doc-gap 5 — load-bearing admin controls undocumented; service-role/owner/Stripe/comp blast radius | 08 |
| 49 | Owner-bypass Decision Record (record OWNER_EMAILS override) + quarterly attestation it's unchanged | Governance/Operational | Biz #9, Security WEB-2/S-2 — hardcoded owner-email bypass, static credential in every binary | 08 |
| 50 | **Control-ownership / standing-controls register** (RLS, email-confirm, release/minisign + service-role keys; dated last-verified) | Governance/Documentation | doc-gap 5 — load-bearing controls have no owner/last-checked date | 04/06 |
| 51 | **Crown-jewel credential inventory + custody record**; minisign signing-key custody policy (offline + compromise procedure) | Operational/Policy | Biz #24, Liability #4 — leaked update-signing key → malicious update to all users | 01/06 |
| 52 | Marketing-Claims Approval Gate checklist + Claims Substantiation Log; add "no compliance certification" + AI-output disclaimers to product pages | Policy/Legal | Legal #5/#9, Compliance #5/#17 — deceptive-practice; implied certification | 08 |
| 53 | **ADR-style business Decision & Records log** (`docs/decisions/`) + append-only Decision Log | Governance | doc-gaps 5 & 9, Biz #24 — load-bearing controls and deploy model undocumented | 04/08 |
| 54 | **Audit-Finding Status Register** mapping each v3 finding to owner/status/governing doc | Governance | doc-gap 5/22 — proof to regulators/acquirers that the audit was acted on | 08 |
| 55 | Canonical document register (`docs/REGISTER.md`); retire/re-issue legacy "Private" PDFs; flag `security-plan.md` aspirational | Documentation | Legal #17, doc-gaps 6/22/25 — stale unqualified guarantees; identifier/collateral confusion | 04/08 |
| 56 | Deploy/Release SOP + deployment change-log (date, product, version, SHA, who, checklist-passed) | Operational/Documentation | doc-gap 9, Biz #7 — no record of how prod is built; incident timeline reconstruction | 04/06 |
| 57 | Operational cadence calendar + monthly 15-min risk-review (comp sweep, sub-processor drift, decision-log glance) | Governance | governance decay across all findings — controls silently degrade on operator forgetfulness | 06/08 |
| 58 | Honestly disclose known matters (GPL ffmpeg, on-device contradiction) to the broker on every application | Governance | Liability §7.1/§8.1 — non-disclosure of known matters lets the carrier rescind at claim time | 07 |
| 59 | Pin governing law/venue to the entity's state; confirm registered agent | Legal | Exec #1 — dispute-forum posture coordinated with the forthcoming ToS/EULA | 08 |
| 60 | Reconcile naming sprawl (Make Ship Happen / Ship Ecosystem / ZZ GEMZ) and file DBA(s); account-name reconciliation pass | Corporate/Documentation | Liability §7.5 — three commercial identities collecting the same customers' money | 01 |
| 61 | Record capital contribution & membership ledger; keep a minute book with founding resolutions; entity-type decision memo (SMLLC now) | Corporate/Governance/Documentation | Undercapitalization + acts-as-an-entity veil factors; pre-decided financing path | 01 |
| 62 | Administrator-Role / RACI one-pager assigning load-bearing controls | Governance | doc-gap 5 — administrator role (RLS, email-confirm, release keys) load-bearing but unowned | 01/08 |
| 63 | Service-description / as-available + beta/phantom-feature "as-is" clauses (no provider uptime SLA) | Legal | Phase 5 §3.2/§3.3, Biz #19/#20/#21 — provider deprecation; mock/stub/dead features | 02 |
| 64 | Backup / user-responsibility-for-data clause (user backs up before running agents; company is not a backup service) | Legal | Phase 5 §4.3 — incomplete deletion, agent file corruption | 02 |
| 65 | Indemnification (user-side), termination, survival; IP hooks (user-content license, feedback, trademark reservation, OSS acknowledgment) | Legal | Phase 5 §7/§11, Legal #10 — agent/automation misuse; unreserved Ship* marks; attribution duties | 02 |
| 66 | Disclose the GPL ffmpeg encumbrance on the IP-assignment schedule (no over-representation of clean title) | Legal | Liability §7.1 — ensure the LLC is the distributor of record; don't falsely represent clean title | 01 |
| 67 | Defer C-corp/S-corp; record SMLLC-now decision with financing trigger conditions | Governance | Governance hygiene; pre-decides the venture-financing path | 01 |
| 68 | Separate website vs. desktop license-obligation surfaces; resolve conditional sharp/libvips LGPL question; identifier/manifest reconciliation memo | Governance/Documentation | WS-5/WS-3, Compliance #18, doc-gaps 17/18/25 — co-mingled manifest expands obligation surface | 03/04 |

### Tier 2 — Highest protection for MEDIUM effort

Counsel-led drafting, multi-store data mapping, and controls that take real time to build but pay back heavily.

| # | Protection | Category | What it mitigates | Source doc |
|---|-----------|----------|-------------------|-----------|
| 1 | **Engage licensed CA/NV counsel** for the LoL cap, arbitration clause, ToS/EULA, billing terms (don't self-serve high-stakes clauses) | Governance | Liability §11 / Phase 5 §6 — CA §1668 / McGill / unconscionability scrutiny of the LoL and arbitration | 02 |
| 2 | **Limitation of Liability + damages cap** (greater of 12-mo fees or $100 floor; exclude consequential/data-loss; enumerate AI/agent/file-deletion/keystroke/token risks; essential-purpose survival) | Legal | Liability §4/§9.2, Biz #1 — uncapped exposure for raw-shell agents, unconfined read_file, keystroke injection | 02 |
| 3 | **Adopt the layered contract set** (ToS, EULA, AUP, AI Addendum, Billing, Privacy, DPA) instead of one monolith | Legal | doc-gap 1 — no legal instrument of any kind for paid products | 02 |
| 4 | **Master Terms of Service** (acceptance, eligibility, age floor, authority-to-bind for Team tier) | Legal | Phase 5 §3.1 — Supabase/cli-login accounts with no acceptance/age/capacity; Team purchaser binds others | 02 |
| 5 | **Desktop EULA** (limited revocable non-transferable license, "licensed not sold", first-run gate, no reverse-engineering) | Legal | Legal #2/#13 — no license of record; signed paid binaries with no EULA | 02 |
| 6 | **Acceptance-capture mechanism** (timestamp + version hash + user/device id) + first-run "I Agree" gate | Operational | Phase 5 §2 — without recorded clickwrap the EULA and liability caps are weakly enforceable | 02 |
| 7 | **Subscription/Billing/Refund terms** (auto-renewal disclosure + easy cancellation per CA ARL / FTC Click-to-Cancel; EU/UK 14-day withdrawal; comp-access discretionary/revocable) | Legal | Biz #8 / Phase 5 §9 — Stripe tiers, comp grants with no expiry, missing auto-renewal disclosure | 02 |
| 8 | **Execute Founder IP Assignment of code and marks into the entity** | Corporate | Liability §3.2/§7, Website L-5 — entity owns nothing, so a future EULA cannot license the product; veil fails | 01/08 |
| 9 | **IP chain-of-title**: assign all Ship Ecosystem IP to the entity; require CIIAA/CLA from future contributors; record AI-generated-code ownership practice | Corporate | Biz #2 — IP/liability concentrated on one named individual; clean chain of title | 03 |
| 10 | **Trademark clearance + USPTO filing** for Ship* / ShipMind / Make Ship Happen / makeshiphappen, recorded under the entity | Legal | Liability §7.5 — clear/register marks before further commercial investment; supports ownership claim | 03/01 |
| 11 | **Build-Licensing Decision Record (BLDR-001)** for the ffmpeg copyleft question with business-level options analysis | Documentation | Legal #4 — converts the engineering remediation into a defensible, recurrence-preventing licensing decision | 03 |
| 12 | **THIRD-PARTY-NOTICES attribution document** shipped with every binary (permissive, MPL, native-binary, non-standard SPDX) | Documentation/Legal | Legal #8 — unmet MIT/Apache §4(d)/BSD/ISC/MPL/SIL-OFL notice clauses across all three apps | 03/04 |
| 13 | **Dependency-license register / SBOM** as a maintained per-product per-release artifact from the exact lockfile | Operational | Compliance #20 — no license scanning/inventory; feeds NOTICES and the release gate | 03 |
| 14 | **Release-time license-attestation gate** in the build runbook (signed human checklist) | Governance | Compliance #25 / WS-8 — deploy-from-working-tree drift; ensures NOTICES/SBOM/EULA ship each release | 03 |
| 15 | **Internal Data-Flow Map / Records of Processing (RoPA)** as single source of truth | Documentation | doc-gap 2, Compliance #6 — no data-flow map; Art. 30 records (feeds Privacy Policy, DSAR, Retention) | 04 |
| 16 | **Incident-Response & Breach-Notification runbook** (72-hour GDPR clock; named containment playbooks; carrier hotline) + pre-drafted customer notice template | Operational | doc-gap 23, Compliance #21, Liability #4 — no IR path for token theft / signing-key compromise | 04/06/07 |
| 17 | **Standing RLS verification procedure** + two-account spot test, logged; quarterly RLS review (migrations 001-012 applied; `auth.uid()` scoping) | Operational | Biz #6, Compliance #11, Security #25 — cross-tenant isolation + paid gating rest on unverified RLS | 06/08 |
| 18 | **RLS / Entitlement Posture Statement** recording applied migrations and tenant-isolation basis | Documentation | Compliance #11, Security ST-8 — entitlement integrity on unverified RLS | 08 |
| 19 | **DeepSeek / China transfer Decision Record** (keep with disclosure + opt-out + SCC, or drop) | Legal | Legal #6, Compliance #3 — undisclosed international transfer to China-based DeepSeek | 08 |
| 20 | **Sub-processor / vendor register** seeded from the data-flow audit + vendor-onboarding review checklist + change-control gate | Operational/Governance | Biz #14, Compliance #6 — no sub-processor inventory; silent undisclosed transfers (e.g., DeepSeek) | 06/08 |
| 21 | **DPA collection + DPA-status register**; DPA-on-request process with template + SCC addendum | Legal | Biz #23, Compliance #9 — no DPA blocks GDPR-compliant B2B | 06/08 |
| 22 | **Public Trust Center / security overview page** (honest posture, no overclaiming) | Documentation | doc-gap 3/12, Biz #14 — cannot answer enterprise security questionnaires; no-certification | 04 |
| 23 | **Form LLC and quote/bind all policies in the entity's name; engage a specialty early-stage tech broker; run one bundled application** (E&O + Cyber + Media + CGL) | Corporate/Insurance | Liability §3.4, Biz #1/#2 — risk-transfer backstop bound on a clean record, in the entity's name | 07/01 |
| 24 | **Bind Technology E&O / Professional Liability** (bundled with Cyber) | Insurance | Liability §4 — raw-shell agent autonomy destroying files/repos; harmful action on hallucinated/injected output | 07/08 |
| 25 | **Bind Cyber Liability** (1st + 3rd party, with breach-response services) | Insurance | Liability §5 — cli-login token relay; MCP corpus/token leak; plaintext-at-rest; cross-tenant RLS leak | 07/06/08 |
| 26 | Quote business-owner/management-liability insurance written to the entity (tech E&O / cyber / GL) | Insurance | Backstops the veil for uncapped exposures; must name the entity, not the individual | 01 |
| 27 | Secure Media / Advertising Liability (endorsement) **after** correcting marketing copy | Insurance | Liability §8 — "on-device" deception, sub-processor inaccuracies; willfulness exclusion removed by correction | 07 |
| 28 | Bind General Liability (CGL) for Printful-fulfilled physical merch product liability | Insurance | Liability §9.6 — physical-product + advertising-injury exposure not covered by E&O/Cyber | 07 |
| 29 | Review exclusions with counsel before binding (IP-infringement, willful-conduct, prior-acts, failure-to-maintain-security) | Governance | Liability §7.1/§8.1 — coverage gaps for known matters; negotiate retroactive dates/sub-limits | 07 |
| 30 | **Remediate/relicense GPL ffmpeg before relying on any IP coverage** (close the insurance gap via compliance, not insurance) | Legal | Legal #1 — known/willful IP infringement is excluded; must be closed by the BLDR decision | 07 |
| 31 | **DSAR runbook** (access/deletion/export) backing the manual privacy@ email, with evidence log | Operational | Compliance #1/#2 — no reliable deletion/export execution | 04 |
| 32 | **Data Retention & Lifecycle Policy / Retention Schedule** (states "forever" reality + target windows; per-class enforced-vs-policy column; at-rest unencrypted disclosure + user backup-exclusion guidance) | Documentation/Policy | Compliance #10, Privacy §3 — no retention/TTL anywhere; unencrypted-at-rest corpora | 04/05 |
| 33 | **OSS Attribution / NOTICE document** ("Open Source Licenses" screen content) | Legal | Legal #8, doc-gap 4 — no OSS attribution across hundreds of permissive deps | 04 |
| 34 | **Evidence-retention archive** structure (`docs/evidence/`) + append-only retention policy | Documentation | GDPR Art. 5(2) accountability across DSAR/policy/deploy/incident proofs; FTC what-we-said-when defense | 04 |
| 35 | One-time remediation sweep of existing live marketing copy against the claims gate (+ dated correction log) | Legal/Policy | Legal #5/#13, Compliance #5/#16 — "100% on-device" / "built for legal teams" contradicted by reality | 08/07 |
| 36 | AI-Use & Output Policy (no-warranty on output; agent "security verdicts" assistive not authoritative; user-review duty; BYOK provider-terms notice) | Policy | Phase 9 §6 — LLM "verdicts" marketed as authoritative while tool-loop unimplemented on 4/7 providers | 05 |
| 37 | Acceptable Use Policy incorporated into ToS/EULA (shell-agent prohibited uses + user assumes agent-action responsibility; anti-MCP-exfiltration; anti-tier-spoofing; no-scrape of gated Libraries) | Policy | Security SP-1/T-1, S-4, Phase 9 §6/§7.6 — shell-agent abuse, MCP exfiltration, tier-spoofing, LibraryGate | 05 |
| 38 | **Responsibility-Resolution Memo** resolving the 8 undefined-responsibility points (owner + establishing instrument each) | Governance | Phase 4 §5 — all 8 UNDEFINED responsibility points; unclear allocation is the worst dispute posture | 09 |
| 39 | **Updated User/Admin/Provider/Platform/Shared responsibility matrix** with the establishing instrument per row | Documentation | doc-gap 12 — no documented shared-responsibility allocation | 09 |
| 40 | Administrator-role allocation for Supabase RLS correctness and for verifying "Confirm email" = ON in production | Governance | Phase 4 ambiguity #1/#8, Compliance #4/#11 — RLS + email-confirm load-bearing, unverifiable from code | 09 |
| 41 | MCP-install responsibility notice (install-time acknowledgment for shiptalk/shipmind/shipspace MCP) | UserResponsibility | Phase 4 ambiguity #3, Privacy #2/#13/#14 — MCP exposes corpus/token to local agents | 09 |
| 42 | Per-product Safe-Use Guidance pages (ShipTalk/ShipMind/ShipSpace/website) | Documentation | doc-gaps 2/8/12, Privacy #4/#6/#7 — duty-to-warn / comparative-fault defense across all products | 09 |
| 43 | Dispute resolution clause (governing law/venue, arbitration + small-claims carve-out + 30-day opt-out, class-action waiver + CA McGill savings, severability/assignment/notices) | Legal | Phase 5 §3.4 — standard loss-shifting boilerplate entirely absent; CA arbitration limits | 02 |
| 44 | Re-title Printful, Vercel, Supabase, domain registrar, Apple Developer ID to the entity | Corporate | Website §6.3 — chain of title and continuity; entity (not individual) controls distribution + PII processors | 01 |
| 45 | Keep Printful and Stripe vendor agreements + DPAs current | Legal | Liability §9.6 — shipping/billing PII to sub-processors outside any coverage/deletion flow | 07 |
| 46 | Backup & recovery runbook for Supabase/Stripe/keys + annual restore test | Operational | Liability #1, Privacy #15 — backup expectation; unencrypted-at-rest backup posture; continuity | 06 |
| 47 | Key & secret custody register + rotation/recovery schedule | Operational | Security S-11/ST-7/WEB-3 — service-role + Stripe + minisign crown-jewel keys with no custody/rotation | 06 |
| 48 | Customer-facing changelog + status channel + pricing reconciliation | Documentation | Biz #10 — price divergence; supports breach-notification communication | 04 |
| 49 | Seal a business-continuity / bus-factor plan naming a successor; designated emergency/successor contact + emergency-access path; break-glass / key-person continuity document | Governance/Operational | Biz #24 — single-developer key-person risk to releases, billing, incident response | 01/06/08 |
| 50 | Quarterly 60-min core review (email-confirm, migrations, registers, pricing, deploy-divergence); annual half-day review (re-audit, refresh legal docs, insurance limits, RACI) | Governance | Biz #7/#24 — deploy-from-working-tree divergence; program rot / key-person | 08 |
| 51 | RACI matrix for governance duties anticipating first hires; custody note for release-signing + service-role keys | Governance/Operational | Biz #24, Security I-6 — key-person dependency; tribal-knowledge key custody | 08 |
| 52 | Adopt corporate-formalities discipline and execute IP assignment from founder to entity | Corporate | Exec #2 — preserve the shield against piercing; IP must sit with the entity | 08 |
| 53 | Establish a counsel-of-record relationship to route GPL-ffmpeg and DeepSeek-transfer decisions | Legal | Exec #3, Legal #6 — high-stakes decisions made with counsel, not blind | 08 |
| 54 | Document a release / change-management checklist replacing undocumented `vercel --prod`-from-local deploys | Operational | Biz #7, doc-gap 9 — live prod may diverge from audited repo; raised in E&O underwriting | 07 |

### Tier 3 — Long-term enterprise protections

Ongoing discipline and event-triggered coverage that scale the program with the business.

| # | Protection | Category | What it mitigates | Source doc |
|---|-----------|----------|-------------------|-----------|
| 1 | **Maintain no-commingling discipline** (owner draws by explicit transfer only) | Operational | Alter-ego/veil-piercing — paying personal expenses from business funds defeats the shield | 01 |
| 2 | **Maintain annual formalities** (annual report/list, franchise tax/business license, minute-book updates) | Operational | Lapse → administrative dissolution and personal liability for acts during the lapse | 01 |
| 3 | DPA template for business/Team buyers (controller/processor roles; sub-processor + SCC/IDTA transfer annex; deletion-on-termination) | Legal | Biz #23, Compliance #9 — cannot lawfully process for GDPR-bound B2B without a DPA | 02 |
| 4 | Add Directors & Officers (D&O) coverage at first priced round / board formation | Insurance | Liability §3.4 — investor/management-liability once funded | 07 |
| 5 | Add Employment Practices Liability (EPLI) coverage at first hire | Insurance | Biz #24 — wrongful-termination/discrimination/harassment once employees/substantial contractors exist | 07 |
| 6 | De-concentrate single points of failure (signing/billing/DNS) over time | Operational | Biz #24 — key-person concentration across signing, billing, registrar | 06 |
| 7 | Calendar Stage triggers to re-quote and add coverage (limits at B2B scale, D&O at raise, EPLI at hire) | Governance | Ensures coverage scales with revenue/B2B requirements/fundraising/hiring rather than lapsing behind growth | 07 |

---

## 3. Consolidated Cross-Reference of Blueprint Documents

| Doc | Title | Primary protection categories | Anchors to (audit) | Depends on |
|-----|-------|-------------------------------|--------------------|-----------|
| **00** | Master Roadmap & Executive Action Plan (this file) | All — synthesis | Executive Report, all phases | — |
| **01** | Corporate Protections | Corporate, Governance, Operational | Biz #2/#24, Liability §3.4/§7.5 | — (the keystone for 02, 03, 07, 08) |
| **02** | Legal Agreements | Legal, Policy, Operational | Legal #1-#14, Phase 5 (ToS) | LLC (01); GPL/deletion decisions (03/04) |
| **03** | IP & OSS Compliance | Legal, Documentation, Policy, Insurance | Legal #1/#4/#8/#14, Compliance #20 | Entity (01); counsel |
| **04** | Documentation Protections | Documentation, Operational, Governance | doc-gaps 1-25 | RoPA feeds Privacy/DSAR/Retention |
| **05** | Policy Suite | Policy, Legal, Operational, Documentation | Phase 6/9, marketing-claims, ShipTalk | Marketing correction; sub-processor register |
| **06** | Operational Protections | Operational, Governance, Policy, Insurance | Security review, ShipSpace cluster, WEB-2/3 | — |
| **07** | Insurance | Insurance, Corporate, Legal, Operational, Policy | Liability §3-§9, Biz #1/#2 | LLC + EULA + corrected copy + clean record |
| **08** | Governance Controls | Governance, Policy, Documentation, Legal, Operational | Exec #4-#14, Compliance #4/#6/#11 | LLC + IP assignment + insurance backstops |
| **09** | User-Responsibility Controls | UserResponsibility, Policy, Governance, Documentation | Phase 4 responsibility matrix | EULA/AUP text (02); marketing + sub-processor work (05) |

**Dependency spine:** `01 (LLC)` → unlocks the liability caps in `02`, the insured-of-record in `07`, the IP owner in `03`, and the contracting party that makes `09` enforceable. `05`/`04` (marketing correction + sub-processor register + RoPA) gate the `09` cloud-egress consent gate and the `07` Media coverage. `03`/`04` (GPL decision + deletion SOP) gate the `02` ownership and erasure clauses.

---

## 4. 30 / 60 / 90-Day + Beyond Sequencing

> Front-loaded so the company can take its next paid sale on a defensible footing. Tier numbers reference §2.

### Days 0-30 — "Defensible to sell" (almost all Tier 1)

- **Form the LLC**; choose state via NV/CA consult; get the EIN; open the entity bank account; re-title/replace the ZZ GEMZ Stripe account; sign new agreements in the entity name. *(T1 #1-9)*
- **Correct the marketing claims** (ban "100% on-device" et al.; dated correction log) and **reconcile the sub-processor list** (add DeepSeek/China, remove phantom services). *(T1 #10-12, #15)*
- **Stand up the DSAR SOP + request ledger**; **hold/scope the erasure guarantee** to reality. *(T1 #13-14)*
- **Place the interim distribution hold on ShipMind**, engage IP/OSS counsel, open the Licensing Decision Record, hold the proprietary-ownership assertion. *(T1 #27-30)*
- **Enable MFA everywhere; confirm Supabase "Confirm email" = ON (dated evidence); write the release checklist + prod-matches-repo gate; stand up the comp-access register + monthly sweep.** *(T1 #34-38)*
- **Ship the founder-draftable contract clauses behind a clickwrap gate** (Warranty Disclaimer, AI-Output Disclaimer, AUP, AI/Provider Addendum, BYO-key + account-responsibility, consent-to-record) with **acceptance-evidence retention**; add the **ShipSpace shell, Cloud-Features, and voice consent gates**. *(T1 #16-23, #41-46)*
- **Publish SECURITY.md + security.txt; create the Privileged-Access Register, Access Control Policy, owner-bypass Decision Record + quarterly attestation, standing-controls register, crown-jewel credential inventory + minisign custody policy.** *(T1 #39-40, #47-51)*
- **Reconcile pricing** ($20/$40 vs $50/$500) + Pricing Record + change gate + Tier-Definition DR; reconcile naming sprawl/file DBAs. *(T1 #24-26, #60)*
- Stand up the **Decision log, Audit-Finding Status Register, document register**; retire legacy "Private" PDFs; flag `security-plan.md` aspirational; record the operating-agreement, minute book, capital ledger, RACI. *(T1 #53-55, #61-62)*

### Days 31-60 — "Counsel-papered & insurable" (Tier 2 first wave)

- **Engage CA/NV counsel** to finalize the **Limitation of Liability cap, Master ToS, Desktop EULA, Subscription/Billing/Refund terms, dispute-resolution clause**, and the **acceptance-capture mechanism**. *(T2 #1-7, #43)*
- **Execute the Founder IP Assignment + chain-of-title**; begin **trademark clearance/USPTO filing**; re-title remaining vendor/distribution accounts to the entity. *(T2 #8-10, #44)*
- **Build the BLDR-001 ffmpeg options analysis; ship THIRD-PARTY-NOTICES; stand up the SBOM/dependency-license register + release-time attestation gate.** *(T2 #11-14, #30, #33)*
- **Author the RoPA / data-flow map** (single source of truth) and from it the **DSAR runbook, Retention/Lifecycle Policy, and Privacy Policy realignment.** *(T2 #15, #31-32)*
- **Write the Incident-Response & Breach-Notification runbook** (carrier hotline placeholder) and the **DeepSeek/China transfer Decision Record.** *(T2 #16, #19)*
- **Engage the specialty tech broker; run one bundled application (E&O + Cyber + Media + CGL) in the entity's name; disclose known matters honestly.** *(T2 #23, T1 #58)*

### Days 61-90 — "Enterprise-ready & risk-transferred" (Tier 2 second wave)

- **Bind E&O + Cyber; bind Media (after copy correction) + CGL; review exclusions with counsel.** *(T2 #24-29)*
- **Stand up the sub-processor/vendor register + onboarding checklist + change-control gate; DPA collection + DPA-on-request template; publish the Trust Center.** *(T2 #20-22)*
- **Run the standing RLS verification + quarterly RLS review; publish the RLS/Entitlement Posture Statement; key & secret custody register + rotation; backup/recovery runbook.** *(T2 #17-18, #46-47)*
- **Write the Responsibility-Resolution Memo + updated responsibility matrix; administrator-role allocations; MCP-install notice; per-product Safe-Use Guidance pages.** *(T2 #38-42)*
- **One-time marketing-copy remediation sweep; AI-Use & Output Policy; evidence-retention archive; customer changelog/status channel.** *(T2 #34-36, #48)*
- **Seal the business-continuity / break-glass plan + successor contact + emergency-access path; RACI + key-custody notes.** *(T2 #49, #51)*

### Beyond 90 days — Standing program (Tier 3 + recurring Tier 2 cadence)

- **Monthly:** comp-access sweep, sub-processor drift glance, decision-log update, no-commingling discipline. *(T1 #57, T3 #1)*
- **Quarterly:** email-confirm attestation, RLS review, register/pricing/deploy-divergence core review. *(T2 #17, #50)*
- **Annually:** maintain entity formalities (annual report, franchise tax, minute book); re-audit; refresh legal docs; review insurance limits + RACI. *(T2 #50, T3 #2)*
- **Event-triggered:** DPA template for B2B at first enterprise deal; D&O at first priced round/board; EPLI at first hire; re-quote limits at B2B scale; de-concentrate signing/billing/DNS over time. *(T3 #3-7)*

---

## 5. How to Read This Blueprint

- **Operators / founder:** Start at §1.2 (the five moves) and execute §4 Days 0-30 in order. Everything in that window is achievable by you or with a short counsel engagement and is the precondition for the next paid sale.
- **Counsel:** Tier 2 #1-7, #43, and the IP/OSS items (#8-14, #30) are the high-stakes drafting and decision work routed to you; the GPL ffmpeg and DeepSeek/China matters are recorded as **decisions under your supervision**, not code prescriptions.
- **Insurance broker:** §07 plus Tier 2 #23-29 define the program; bind only **after** the LLC, the EULA liability cap, the corrected marketing copy, and the honest known-matter disclosure are in place, or coverage is rescindable.
- **Acquirer / enterprise buyer doing diligence:** The Audit-Finding Status Register (T1 #54), Trust Center (T2 #22), RoPA (T2 #15), sub-processor register (T2 #20), and evidence archive (T2 #34) are the artifacts that demonstrate a functioning governance program.

**Closing principle (repeated from every child document):** no recommendation here changes product functionality. Each technical root cause the audit found is wrapped in a business instrument — an entity, a contract, a disclosure, a decision record, a runbook, a register, an insurance line, or a user-responsibility term — so the company can operate the product exactly as built while standing on a defensible, honestly-documented, lower-liability footing.
