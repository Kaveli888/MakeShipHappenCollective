# Business Protection Blueprint — MakeShipHappen

**Prepared:** 2026-06-07 · **Companion to:** the Independent Risk Audit in this folder (`00-EXECUTIVE-REPORT.md` and phase docs).
**Scope of this blueprint:** *Non-engineering* protections only — corporate, legal, documentation, policy, operational, insurance, governance, and user-responsibility controls. **No software/product changes are recommended here.** Every item is designed to reduce liability and build a legitimate AI-company posture **while preserving existing product functionality.**

> ⚠️ **Not legal, tax, or insurance advice.** This is a structured action plan by a technical auditor. Engage a licensed business attorney, a SaaS/privacy attorney, a CPA, and a commercial insurance broker to execute the items below. Items are sequenced by leverage, not by legal precedence — your attorney sets the true order.

---

## How to use this blueprint

Each protection is tagged with:
- **Domain:** Corporate / Legal / Documentation / Policy / Operational / Insurance / Governance / User-Responsibility
- **Effort:** Low (hours–days, mostly self-serve or template) · Medium (days–weeks, professional help) · High (weeks–months, ongoing program)
- **Protects against:** the specific audit finding(s) it neutralizes (cross-referenced to the audit's risk IDs, e.g. L1, P5, S2, C1).

The three tiers below are **cumulative** — Tier 1 is the minimum viable legal-and-corporate shell; Tier 2 is "operate as a real company"; Tier 3 is "sell to enterprises and scale."

---

# TIER 1 — Highest Protection for Lowest Effort
### *"Stop the bleeding." Do these first; most are days of work and dramatically shrink the largest exposures.*

### 1.1 Form a liability shield (Corporate · Low) — protects against B3, B5, L11, L12, LR-20
- Form an **LLC** (single-member is fine; founder is in Palm Springs, CA → California LLC, or a Wyoming/Delaware LLC with CA foreign registration — let the attorney/CPA decide based on tax).
- **Operate through the entity:** open a business bank account, move the Stripe account, domains, Supabase, and vendor contracts into the company name. **Never commingle personal and business funds** (commingling is the #1 way founders lose the liability shield).
- Adopt a one-page **operating agreement** and keep minimal records — this is what makes the "corporate veil" real.
- **Why first:** Right now, personal assets back every autonomous-agent action, every deceptive-claim exposure, and every data incident. An entity is the cheapest, highest-leverage protection in the entire blueprint.

### 1.2 Freeze and correct the marketing claims (Legal/Policy · Low) — protects against L1–L3, L6, L16, L23, P-inconsistencies, C9–C11, B1, B9
- This is a **business decision, not a code change**: instruct whoever edits copy to replace every **absolute** privacy/security/regulatory claim with **mode-accurate, qualified** language.
  - Remove: "100% on-device," "never leaves your machine," "not a single byte to the cloud," "no vendor leaks," "no recordings stored/uploaded/analyzed," "FERPA-protected."
  - Replace with: *"Local-first. Processed on your device by default. Optional cloud features (clearly labeled) send data to named providers only when you enable them."*
- Remove competitor "✗" comparison tables (or move them behind a dated substantiation file).
- Remove statutory-protection language (FERPA/HIPAA) until certified.
- **Maintain a "Claims Register"** (a spreadsheet): every public claim → who approved it → evidence backing it. This single document is your defense to an FTC/UDAP/Lanham challenge.
- **Why:** Deceptive-advertising exposure requires no breach — only the contradiction, which already exists and is admitted in your own source comments. Cheapest, highest-likelihood risk to neutralize.

### 1.3 Publish a real, accurate legal pack (Legal/Documentation · Low–Medium) — protects against L2, L4–L7, L10–L13, D2–D5, D11–D15, C1–C8
Have an attorney finalize (templates exist; the work is making them *accurate to your data flows* and *enforceable*):
- **Terms of Service** — remove placeholder governing-law and any "not legal advice" text; add the clauses listed in audit `05-tos-recommendations.md` (limitation of liability + cap, warranty disclaimer, IP, account responsibility, AI-output disclaimer, beta/danger-mode coverage).
- **Acceptable Use Policy (AUP)** — the single most important *missing* document. Prohibit: recording third parties without consent; ingesting content the user lacks rights to; using autonomous/"danger"/bypass modes against unauthorized systems; processing regulated data via cloud features. Put **user warranties** here (user warrants they hold rights/consent).
- **Privacy Policy** — rewrite to match the *actual* six cloud-egress paths and **name every subprocessor** (Anthropic, OpenAI, Groq, Google, Supabase, Stripe, Printful, Sentry).
- **Refund Policy** — reconcile the contradiction (ToS "all sales are final" vs. ad "7-day money-back"). Pick one; state it identically everywhere.
- **Auto-renewal disclosure** — clear-and-conspicuous price + cadence + cancel path at point of sale (CA ARL / FTC Click-to-Cancel).

### 1.4 Add an enforceable acceptance gate (Legal/Policy · Low) — protects against LR-2 (the keystone risk), B6
- Require **click-through acceptance** of ToS + Privacy at **signup and at checkout**, versioned and timestamped. Keep the record.
- **Why:** Without provable acceptance, *every* protection in 1.3 is challengeable. This is the hinge the whole legal pack swings on. (Implementation is a business/process requirement to give your developer — the blueprint doesn't prescribe how to build it.)

### 1.5 Surface a consent + AI-output notice (Policy/User-Responsibility · Low) — protects against P1–P3, P10, L8, L9, L12, LR-8, C12, C20
- As a **policy requirement**, mandate that any cloud-egress or recording feature shows a one-time consent/notice, and that AI output carries a "may be inaccurate; not professional advice; verify before relying" disclaimer.
- Put the matching obligations in the AUP so **the user bears responsibility** for recording consent and for acting on AI output.
- **Why:** Moves the highest "Shared/Unclear" responsibilities from Phase 4 onto the user, contractually, without changing what the product does.

### 1.6 Lock down corporate/account hygiene (Operational · Low) — protects against B3, B20, S1.5, LR-20
- Enable **2FA/MFA** on every founder account (Stripe, Supabase, GitHub, domain registrar, email, Apple Developer, vendor consoles).
- Use a **password manager** and a **dedicated business email**, not a personal account, as the owner identity (decouple from `zzgemsjewelry@gmail.com`).
- Store recovery codes and a **"break-glass" credential list** in a sealed, offline location.

### 1.7 Reconcile the licensing story (Legal/Documentation · Low) — protects against L17, L18, D1, D8, C16
- Add a clear **LICENSE posture**: proprietary "all rights reserved" for the commercial shipped apps; keep MIT only where genuinely intended (e.g., ShipCode). Remove the blanket "MIT" claims that don't match.
- Add a **THIRD-PARTY-NOTICES** attribution bundle (the audit found none) — this is a documentation/distribution-compliance item, generated from your existing dependency manifests.

### 1.8 Designate a security & legal contact (Documentation/Governance · Low) — protects against D6, LR-19
- Publish a `security@` / `legal@` contact and a one-paragraph **vulnerability-disclosure statement** (where to report, that you won't pursue good-faith researchers). Cheap insurance against full-disclosure surprises.

**Tier 1 outcome:** You now operate through a liability-shielded entity, your public claims match reality, you have an *enforceable* contract that allocates responsibility to users and caps liability, and your accounts are hardened. This eliminates or sharply reduces the majority of 🔴 Critical legal/privacy risks in the audit — in days, not months, with no product changes.

---

# TIER 2 — Highest Protection for Medium Effort
### *"Operate like a real company." Weeks of work; needs some professional help and recurring routines.*

### 2.1 Get business insurance (Insurance · Medium) — protects against B5, B16, L11, L12, L19, LR-12, LR-19
Engage a broker experienced with tech/SaaS. Prioritize:
- **Technology E&O / Professional Liability** — covers claims that the software failed or caused financial harm (core for autonomous-agent and AI-output risk).
- **Cyber Liability** — covers breach response, notification costs, regulatory defense, and data-loss claims (essential given surveillance/transcript/PII data).
- **Media/Advertising Liability** (often within Cyber or a Media policy) — covers advertising-injury and IP claims from marketing copy and competitor comparisons.
- **General Liability + a Business Owner's Policy (BOP)** as the base.
- Consider **D&O** later if you take investment or add directors.
- **Note for the broker:** disclose the autonomous-agent and recording/surveillance features honestly — non-disclosure can void coverage. The Tier 1 legal pack + claims register *lowers your premiums and improves insurability.*

### 2.2 Stand up a privacy-rights program (Policy/Operational · Medium) — protects against P5, P6, L7, L15, D5, C1, C6
- Even before deletion/export is built, **publish and operate a manual data-subject-request process**: a request intake (email/form), an identity-verification step, a logged fulfillment SLA (e.g., 30 days), and a record of completion.
- Define and publish a **data-retention schedule** (transcripts, captures, logs, memory, account data) — including "raw audio deleted after transcription."
- **Why:** This closes the "we promised deletion/export with no way to do it" gap (a 🔴) with a *process*, buying time to automate later. The promise becoming operable is what matters legally.

### 2.3 Build the subprocessor & vendor governance layer (Legal/Governance · Medium) — protects against L10, L13, L14, D4, C2, C23
- Maintain a **Subprocessor Register** (vendor, data shared, location, purpose, DPA status) — publish a user-facing version.
- Execute / accept each vendor's **DPA** (Anthropic, OpenAI, Groq, Google, Supabase, Stripe, Printful, Sentry) and **configure providers to not train on your data** where the option exists; document those settings.
- Keep a **vendor inventory** with renewal dates, owners, and the access each holds.

### 2.4 Formalize operational runbooks (Operational/Governance · Medium) — protects against B21, L19, D7, C5
- **Incident-Response & Breach-Notification runbook** — who is notified, decision tree, statutory clocks (GDPR 72h, US state laws), holding-statement templates, and the security contact from 1.8.
- **Business-continuity / key-person plan** — where keys/credentials live, how a trusted person can keep the service alive or wind it down, customer-data custodianship. (Single-founder continuity is a flagged 🟠.)
- **Backup & recovery policy** for Supabase/production data.
- **Change/release log** for the apps (what shipped, when) — supports both security and advertising-substantiation.

### 2.5 Tighten billing & commerce governance (Operational/Policy · Medium) — protects against B2, B4, B7, B11, B12, L1, LR-1, LR-3, LR-4
- Reconcile **pricing across every surface** (site, ToS, product copy, backend tiers) — retire the stale $20/$40 copy; decide publicly whether the $500 tier exists.
- Write a **comp-access policy**: who may grant, default expiry, periodic review (audit flagged no auto-expiry → revenue leakage + access risk). Operate it as a checklist even before any automation.
- Define a **chargeback/dispute-handling SOP** and monitor Stripe dispute rate (protects the revenue lifeline from a freeze).
- Add a **dunning/failed-payment communication policy** (business process, not code).

### 2.6 Establish a claims-substantiation discipline (Documentation/Governance · Medium) — protects against B19, L8, C9, D9
- For every quantified or comparative claim that survives Tier 1's freeze, keep **dated, reproducible evidence** in the Claims Register (e.g., the methodology behind "<500ms," the test behind any competitor "✗").
- Adopt a rule: **no new public claim ships without an evidence row.** This is a governance control, enforced by process.

### 2.7 Recording, surveillance & dual-use use-policies (Policy/User-Responsibility · Medium) — protects against P4, P10, P17, L8, L10, LR-8, LR-11, LR-13, C12, C20
- Publish a **Recording & Consent Policy** and a **Surveillance-Feature Policy** (for ShipWatch) placing the legal duty to obtain consent on the user, and stating prohibited contexts.
- Publish an **Autonomous-Agent Use Policy** for ShipSpace/ShipClick: user is responsible for actions taken on their machine/accounts; "danger"/bypass modes are advanced, at-own-risk features.
- These are **policy documents + AUP clauses**, not product changes — they reallocate the Phase 4 "Unclear" responsibilities to the user.

### 2.8 IP & brand protection (Corporate/Legal · Medium) — protects against B9, L15, L16, L22
- File **trademark applications** for the "Ship" family marks you intend to keep (the brand depends on them; squatters and competitors are a real risk).
- Assign **all IP to the company** (founder→entity IP assignment agreement) so ownership is clean for any future raise/sale.
- Add a **DMCA policy + designated agent** (relevant given ingestion features) and a contractor IP-assignment template for any future help.

**Tier 2 outcome:** You're insured, your vendor/data governance is documented, you can respond to incidents and data-subject requests, your commerce terms are internally consistent, and your brand/IP is protected. This converts the company from "legally exposed solo project" into "a defensible small business."

---

# TIER 3 — Long-Term Enterprise Protections
### *"Sell to enterprises and scale." Months of work; ongoing programs; unlocks larger customers and reduces residual risk.*

### 3.1 Security & compliance attestations (Governance/Compliance · High) — protects against B10, LR-18, C24, and unlocks enterprise sales
- Pursue **SOC 2 Type II** (the de facto B2B trust credential), then **ISO 27001** if selling internationally.
- If you genuinely target healthcare/education, pursue the matching frameworks (**HIPAA program + BAAs**, **FERPA school-as-controller agreements**) — *or* permanently drop those verticals from marketing. Don't claim what you can't attest.
- Maintain a **Trust Center / security page** with your subprocessor list, certifications, and DPA on request.

### 3.2 Formal privacy program (Compliance/Governance · High) — protects against C1–C6, C19–C25, P19
- **Records of Processing (ROPA)**, **DPIAs** for high-risk processing (surveillance/biometrics — legally required under GDPR Art. 35), and **Standard Contractual Clauses** for EU→US transfers.
- Appoint a **privacy lead / DPO function** (can be fractional/outsourced at this stage).
- **EU AI Act** transparency and **BIPA/biometric** consent programs as you scale into those jurisdictions.
- Resolve the **minimum-age policy** consistently and implement age-appropriate handling (COPPA) if education stays in scope.

### 3.3 Mature corporate governance (Corporate/Governance · High) — protects against B3, B15, B18, LR-20
- If raising capital: convert to/structure as a **C-Corp** (Delaware) with a cap table, board, and **D&O insurance**; adopt formal bylaws, an advisory board, and decision-logging.
- Build a **central product/architecture registry** governing all 12 apps to a common security/privacy/marketing baseline (the audit flagged ecosystem sprawl).
- Institute a **quarterly governance review**: re-run a security/privacy/claims audit, reconcile the Claims Register, review comps, rotate secrets, and re-verify subprocessor DPAs.

### 3.4 Enterprise contracting & risk transfer (Legal/Insurance · High) — protects against L11, LR-18, B14
- Develop an **enterprise MSA + order form + DPA + SLA** package (negotiated liability caps, indemnities, security addendum).
- Right-size insurance limits to enterprise deal sizes; add **contingent/representations & warranties** coverage if you ever sell the company.
- Establish a **customer security-questionnaire response kit** (standardized answers + evidence) to shorten enterprise sales cycles.

### 3.5 Vendor & supply-chain assurance program (Operational/Governance · High) — protects against B17, B24, S-supply-chain items, C17
- Formal **third-party risk management**: track each AI provider's terms, pricing, deprecation, and AUP-compliance posture (the "danger mode" vendor-AUP risk).
- Document a **dependency/binary update cadence** policy (ffmpeg/yt-dlp/Ollama/deno) and verify bundled-model and ffmpeg licensing once for the record (governance sign-off, not a code change).

### 3.6 Accessibility & inclusivity compliance (Compliance/Documentation · High) — protects against L25, C14
- Adopt a **WCAG conformance target** and publish an **accessibility statement** for the consumer web property (ADA Title III exposure grows with traffic).

**Tier 3 outcome:** You can pass enterprise security reviews, sell into regulated and international markets honestly, transfer residual risk through contracts and insurance, and govern the ecosystem as a system rather than a pile of apps.

---

## Priority roadmap at a glance

| Tier | Theme | Effort | Eliminates / reduces |
|---|---|---|---|
| **1** | Liability shell + truthful claims + enforceable contract + account hygiene | Days | Most 🔴 Critical legal/privacy/business risks; the keystone "unenforceable ToS" risk |
| **2** | Insurance + privacy-rights process + vendor/data governance + runbooks + commerce/IP | Weeks | Residual 🟠 High risks; insurability; data-subject rights; brand/IP; revenue protection |
| **3** | Attestations + formal privacy program + corporate maturity + enterprise contracting | Months | Enterprise-sales blockers; international/regulated-vertical exposure; long-tail compliance |

---

## Domain coverage checklist (every requested domain is addressed)

| Domain | Where |
|---|---|
| **Corporate protections** | 1.1, 1.6, 2.8, 3.3 |
| **Legal protections** | 1.2, 1.3, 1.4, 1.7, 2.3, 2.8, 3.4 |
| **Documentation protections** | 1.3, 1.7, 1.8, 2.4, 2.6, 3.1, 3.6 |
| **Policy protections** | 1.2, 1.4, 1.5, 2.2, 2.5, 2.7 |
| **Operational protections** | 1.6, 2.2, 2.4, 2.5, 3.5 |
| **Insurance considerations** | 2.1, 3.4 |
| **Governance controls** | 1.8, 2.3, 2.4, 2.6, 3.1, 3.2, 3.3, 3.5 |
| **User-responsibility controls** | 1.5, 2.7 (AUP user-warranties, consent duties, agent/recording at-own-risk) |

---

## The single most important sentence

**Most of your largest exposures are closed not by changing the software, but by (a) putting a company between you and the liability, (b) making the marketing tell the truth, and (c) having an *accepted* contract that hands responsibility to the user and caps your liability.** Tier 1 delivers all three in days. Everything after that is building the durable company around that core.

> Reminder: this blueprint is a prioritized action plan, not legal/insurance/tax advice. Validate entity choice, contract terms, insurance limits, and compliance scope with licensed professionals before relying on them.
