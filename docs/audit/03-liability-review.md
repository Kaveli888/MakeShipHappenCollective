# PHASE 3 — Liability Review

Prepared from four professional lenses — **SaaS attorney, privacy attorney, technology attorney, enterprise compliance officer**. For each risk: scenario, severity, likelihood, business impact. **This is a risk inventory, not legal advice.**

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low. Likelihood: High / Medium / Low.

---

## SaaS attorney lens — contracts, billing, service obligations

### LR-1 · Refund-term contradiction — 🟠 / Likelihood High
- **Scenario:** ToS states "all sales are final"; the ShipMind CTA advertises "7-day money-back." A customer relies on the ad, is refused under the ToS, and disputes the charge or files a UDAP/small-claims complaint.
- **Impact:** Chargebacks, Stripe dispute-rate increase (risk of reserve/freeze), unenforceable terms, deceptive-pricing exposure. Cheap to fix, expensive to ignore.

### LR-2 · Unenforceable Terms of Service — 🔴 / Likelihood Medium
- **Scenario:** No verified click-through acceptance at signup/checkout, placeholder governing-law, and "not legal advice" text embedded in the live ToS. In a dispute, the entire ToS — including the limitation of liability and arbitration/venue clauses — is challenged as unformed or illusory.
- **Impact:** Loss of every contractual protection at the moment it's needed (data loss, AI-output harm, agent damage). This is the keystone risk: it makes all other "the ToS protects us" assumptions fragile.

### LR-3 · Auto-renewal / negative-option non-compliance — 🟠 / Likelihood Medium
- **Scenario:** Subscription auto-renews with an intro discount but lacks the clear-and-conspicuous disclosure, affirmative consent, and easy-cancel mechanism required by CA ARL and the FTC Click-to-Cancel/ROSCA regime.
- **Impact:** Statutory penalties, AG enforcement, restitution, full-refund exposure to the renewal cohort, Stripe risk.

### LR-4 · Undisclosed pricing tiers / billing mismatch — 🟡 / Likelihood Medium
- **Scenario:** Backend + comp tooling support a $500 tier not on the pricing page; a customer is charged an amount inconsistent with what was advertised.
- **Impact:** Billing disputes, deceptive-pricing claims, support load.

### LR-5 · SLA/availability implied but undefined — 🟢 / Likelihood Low
- **Scenario:** "Always-on" framing implies uptime guarantees the business never committed to; an outage triggers refund demands.
- **Impact:** Refund pressure, reputational friction.

---

## Privacy attorney lens — data, consent, statutory rights

### LR-6 · Deceptive privacy representation — 🔴 / Likelihood High
- **Scenario:** "100% on-device", "never leaves your machine", "no recordings stored/uploaded/analyzed externally" are published, but cloud STT uploads audio and Polish/chat send text to Anthropic/OpenAI/Groq. A user, regulator, or competitor documents the contradiction.
- **Impact:** FTC Act §5 / state UDAP "unfair or deceptive practice" — the single highest-probability legal exposure. The vendor's *own code comment* acknowledges the contradiction, which is damaging evidence of knowledge.

### LR-7 · Inoperable data-subject rights — 🔴 / Likelihood Medium
- **Scenario:** Privacy Policy promises deletion/export; no code implements them. An EU/CA user requests erasure and it cannot be fulfilled within statutory deadlines.
- **Impact:** GDPR (Art. 17/15/20) / CCPA-CPRA violations; complaints; fines; the promise itself is a deceptive representation.

### LR-8 · Recording-consent (wiretap) exposure — 🟠 / Likelihood Medium
- **Scenario:** A user dictates near, or screen/audio-captures, a third party in a two-party-consent state (CA, FL, IL, PA, etc.) without consent; that audio is also uploaded to cloud STT.
- **Impact:** Criminal and civil wiretap liability, BIPA-style voiceprint claims; the platform enabled it with no consent controls → shared exposure.

### LR-9 · Sensitive-data handling without safeguards — 🟠 / Likelihood Medium
- **Scenario:** Marketing targets lawyers/clinicians/finance/schools; users put privileged/PHI/FERPA data in, which is then sent to cloud LLMs with no BAA/DPA/certification.
- **Impact:** HIPAA (no BAA), FERPA (no school agreement), legal-privilege waiver claims, sector regulator exposure, and breach-of-promise claims.

### LR-10 · Subprocessor non-disclosure — 🟡 / Likelihood Medium
- **Scenario:** Printful (name+address) and others receive PII but aren't disclosed; no DPAs exist.
- **Impact:** GDPR Art. 28 breach; inaccurate Privacy Policy = deceptive practice.

### LR-11 · Surveillance product without DPIA/consent — 🟠 / Likelihood Medium
- **Scenario:** ShipWatch performs continuous capture (high-risk processing) with no DPIA, no notice to captured third parties, and keys in localStorage.
- **Impact:** GDPR Art. 35 violation; if breached, catastrophic exposure given data sensitivity.

---

## Technology attorney lens — IP, open source, autonomous systems

### LR-12 · Autonomous agent causes harm — 🔴 / Likelihood Medium
- **Scenario:** ShipSpace (raw shell, bypass modes) or ShipClick (physical Mac control, bypassPermissions) deletes/corrupts user or third-party data, or — via prompt injection from a malicious file/web page — exfiltrates secrets or runs destructive commands.
- **Impact:** Direct damages, negligence/product-liability theories, and "the platform shipped a default-dangerous mode" is a difficult posture without a strong, accepted liability waiver (which LR-2 undermines).

### LR-13 · IP/ToS-violation facilitation (scraping/ripping) — 🟠 / Likelihood Medium
- **Scenario:** Bundled yt-dlp + scraping + "competitor research" prompts let users copy copyrighted YouTube/web/PDF content and violate platform ToS at scale.
- **Impact:** Secondary copyright-liability theories, platform-ToS/CFAA-adjacent exposure, DMCA pressure, takedown demands.

### LR-14 · Open-source license non-compliance — 🟡 / Likelihood Medium
- **Scenario:** MIT/Apache/BSD deps shipped in binaries without the required attribution/NOTICE; ffmpeg possibly built with GPL components; Gemma/Llama weights bundled under non-OSI acceptable-use terms.
- **Impact:** License-compliance claims, forced remediation, potential GPL-contamination argument against closed code.

### LR-15 · Ambiguous IP ownership — 🟡 / Likelihood Low
- **Scenario:** "MIT" claimed with no LICENSE file; commercial code may be construed as unintentionally licensed, or the "open" parts unenforceable. AI-output/UGC ownership undefined in ToS.
- **Impact:** Disputes over ownership of generated artifacts and over reuse of "open" code.

### LR-16 · Comparative-advertising / trademark — 🟠 / Likelihood Medium
- **Scenario:** Competitor names (NotebookLM, ChatGPT, Claude) marked "✗" in a comparison table without substantiation.
- **Impact:** Lanham Act §43(a) false-advertising, trademark-use challenge, cease-and-desist, ad takedown.

### LR-17 · Vendor AUP breach — 🟡 / Likelihood Medium
- **Scenario:** Using Anthropic/OpenAI/Codex CLIs in `--dangerously-bypass`/auto-permission modes may violate those vendors' acceptable-use/automation terms.
- **Impact:** Account termination cutting off core functionality; breach claims.

---

## Enterprise compliance officer lens — readiness for business buyers

### LR-18 · No compliance attestation vs. enterprise promises — 🟡 / Likelihood Medium
- **Scenario:** Marketing implies enterprise/regulated readiness without SOC 2 / ISO 27001 / DPIA / DPA. An enterprise buyer's security review fails the vendor, or relies on the promise and later claims misrepresentation.
- **Impact:** Lost deals, representation/misrepresentation exposure, clawbacks.

### LR-19 · No incident-response / breach-notification capability — 🟠 / Likelihood Medium
- **Scenario:** A breach occurs; statutory notification windows (GDPR 72h, US state laws) are missed because no runbook exists.
- **Impact:** Per-incident fines, increased liability for delayed notice, reputational amplification.

### LR-20 · Single-founder continuity risk — 🟠 / Likelihood Medium
- **Scenario:** The sole person with access to keys/infra/Stripe/Supabase is unavailable; the service degrades and customer data is stranded.
- **Impact:** Service failure, refund/SLA exposure, data-custodianship questions.

---

## Liability heat summary

| Lens | Highest single risk | Severity |
|---|---|---|
| SaaS | Unenforceable ToS (LR-2) undermines all protections | 🔴 |
| Privacy | Deceptive privacy claim (LR-6) | 🔴 |
| Technology | Autonomous-agent harm (LR-12) | 🔴 |
| Enterprise | No incident-response (LR-19) | 🟠 |

The through-line: **the products generate real-world consequences (data egress, autonomous actions, recordings), the marketing over-promises safety, and the contractual/governance layer that should cap exposure is incomplete or unenforceable.** Strengthening the contract/governance layer is the highest-leverage liability reduction available and requires no code changes.
