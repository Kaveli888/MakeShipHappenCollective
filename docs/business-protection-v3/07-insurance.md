# 07 — Insurance Considerations

**Document:** Business Protection Blueprint, Part 7 of N
**Subject:** Insurance program design for Make Ship Happen Collective
**Operator:** Single founder (Jacob Felton / "Make Ship Happen"), US-based, pre/early-revenue
**Products covered:** ShipTalk, ShipMind, ShipSpace (macOS desktop apps) + makeshiphappen.tech (web subscription + merch commerce)
**Date:** 2026-06-07
**Source grounding:** `docs/audit-v3/00-EXECUTIVE-REPORT.md`, `docs/audit-v3/03-liability-review.md`

> **Scope note.** This is a business/legal/risk-transfer document. It recommends *insurance instruments and the documentation that makes the company insurable* — it does **not** prescribe code changes. Technical remediation is tracked separately in the audit; here we treat insurance as the financial backstop for residual risk that survives the EULA, privacy program, and OSS-compliance work.

---

## 1. Why insurance, and why now

The audit's central legal conclusion is that **all customer-facing loss-shifting instruments are currently absent** — no EULA, no warranty disclaimer, no liability cap, no AUP, no DPA — and that **liability is concentrated on a single named natural person** with no corporate shield interposed (Liability Review §3.2, §3.4; Exec Top Business Risks #1–2). Insurance is the **second layer** of a three-layer defense:

1. **Entity + contract** (LLC, EULA liability cap) — caps and redirects liability. *(See Part 2/Corporate and Part 3/Legal documents.)*
2. **Insurance** — pays defense costs and settlements *when the cap is pierced, when a non-contracting third party sues, or when a regulator acts.* This document.
3. **Operational controls** (deletion pipeline, sub-processor list, incident runbook) — reduce the frequency/severity that drives premiums and keeps claims payable.

Insurance is uniquely valuable to a solo founder because **defense costs alone can be ruinous** even for a meritless claim. A single cyber or IP suit can run six figures in legal fees before any judgment. For a pre-revenue individual, the policy is often the only thing standing between a nuisance claim and personal insolvency.

> **Sequencing dependency — do the entity first.** Insurers underwrite and pay claims against a *named insured*. Form the LLC (Part 2) and quote policies in the **entity's** name, not the individual's. Buying personal-name coverage now and re-papering later wastes the application work and can create gaps. If formation is weeks out, you may bind in the individual name and endorse the entity on as named insured at formation — confirm this with the broker before binding.

---

## 2. The risk-to-coverage map (audit findings → insurance line)

This table is the spine of the program. Every line is justified by a specific audit risk.

| Insurance line | Audit risks it transfers | Audit citations |
|---|---|---|
| **Technology E&O / Professional Liability** | Agent destroys customer files/repos (`rm -rf`), pushes broken code, takes harmful action on hallucinated/injected output; "cited answers" feature fails on default models; agent containment failures cause customer financial loss; product-fitness / breach-of-warranty claims | Liability §4.1–4.4, §8.4, §9.2; Exec Legal #3 (no AI-output disclaimer), Security #1–2 |
| **Cyber Liability (1st + 3rd party)** | `cli-login` refresh-token relay → account takeover; MCP servers leak Supabase token + full transcript/knowledge corpus; plaintext-at-rest voice/notes/code; unconfined `read_file` exfiltrating customer SSH/AWS creds; cross-tenant RLS leak; breach-notification costs; regulatory defense | Liability §5.1–5.5, §6.6–6.7; Exec Privacy #1–13, Security #3–9 |
| **Media / Advertising Liability** (often an endorsement on Cyber or CGL) | "100% on-device" claim contradicted by cloud egress (self-admitted in code); "built for legal teams" unsubstantiated; "sandboxed/safe agent" framing risk; inaccurate sub-processor disclosures; phantom-provider feature overstatement | Liability §8.1–8.6; Exec Legal #5, #9, Business #5 |
| **General Liability (CGL)** | Bodily injury / property damage; **merch product liability** (Printful-fulfilled physical goods); premises/operations; advertising-injury baseline | Liability §9.6 (Printful PII + physical merch fulfillment) |
| **Directors & Officers (D&O)** — *deferred until fundraising/board* | Management-liability claims from investors, mismanagement allegations, regulatory actions against officers; required by most term sheets | Liability §3.4 (single-individual accountability); not needed pre-raise |
| **Trademark / IP defense** (limited; via E&O or specialty) | "Ship*" mark disputes; partial offensive/defensive IP-litigation cost | Liability §7.5 (trademark advisory) |
| **Employment Practices Liability (EPLI)** — *deferred until first hire* | Wrongful-termination/discrimination claims once employees/contractors exist | Exec Business #24 (key-person/solo today — not yet needed) |

> **Coverage you should NOT expect to buy** — see §8. The GPL ffmpeg violation (Liability §7.1) and any other **known/willful IP infringement** is almost universally excluded. Insurance does not launder a known legal violation; it backstops *unexpected* loss.

---

## 3. Line-by-line program (priority order for a pre/early-revenue solo)

Each subsection: what it covers, the audit risks transferred, priority for *this* company, what underwriters will ask, and the documentation that makes you insurable.

### 3.1 Technology E&O / Professional Liability — **PRIORITY 1 (with Cyber, usually bundled)**

**What it covers.** Third-party claims that your software/service caused financial loss through error, omission, negligence, or failure to perform as promised — including an agent that deletes a customer's work, a "feature" that doesn't do what was sold, or an AI action that causes downstream harm.

**Audit risks transferred.** The ShipSpace raw-shell autonomy chain (Liability §4.1–4.4) is the single most E&O-relevant exposure in the ecosystem: a foreseeable, self-documented (`TODO(security)`) path to customer data destruction and credential theft. Also the "cited answers" efficacy gap (§8.4) and breach-of-fitness/warranty (§9.2, Exec Legal #3).

**Priority for this company: CRITICAL.** This is the line most directly matched to the product's #1 design risk.

**What underwriters will ask (and how to be insurable):**

- [ ] Do you have a signed/click-through **EULA with a liability cap, warranty disclaimer, and AI-output/human-in-the-loop disclaimer**? *(Currently absent — Liability §3.2, §9.2, Exec Legal #3. This is the single biggest premium and insurability lever. Underwriters price the absence of a liability cap as effectively uncapped exposure.)*
- [ ] Do you have an **Acceptable Use Policy** disclaiming user misuse of shell execution, recording, and downloading? *(Absent — Exec Legal #10.)*
- [ ] Is there a **human-in-the-loop / "do not rely on AI output for critical decisions" disclaimer**? *(Absent — Exec Legal #3.)*
- [ ] Change-management / release process? *(You ship `vercel --prod` from local tree — Exec Business #7. Expect questions; document a release checklist.)*

> **Insurability action:** The EULA + AUP work in Part 3 is a *precondition* for affordable E&O. Quote E&O **after** the EULA exists, or disclose that it is "in progress with counsel, target date X" — underwriters reward a documented remediation plan.

**Effort: Medium** (application + broker process). **Protection: High.**

---

### 3.2 Cyber Liability — **PRIORITY 1 (bundle with E&O — "Tech E&O + Cyber" is the standard SKU)**

**What it covers.** *First-party*: forensics, breach notification, credit monitoring, business interruption, cyber-extortion. *Third-party*: defense + liability for privacy claims, regulatory fines/defense (where insurable), and PCI. This is the line that pays for the **breach-notification machinery** the audit says you cannot currently execute.

**Audit risks transferred (this is the densest match in the whole program):**

- `cli-login` refresh-token relay → one-click account takeover (Liability §5.1, the "highest-value single defect for breach-notification liability").
- MCP servers exposing Supabase auth token + full transcript/knowledge DB with no auth (§5.2).
- **Indefinite plaintext-at-rest** of voice, notes, source code, terminal scrollback incl. typed secrets (§5.3, Exec Privacy #4, #12) — this *enlarges* both the data corpus exposed and the notification population in any breach.
- Unconfined `read_file` exfiltrating the customer's *own* SSH/AWS creds → potential CFAA/employer-data exposure (§4.4).
- Cross-tenant RLS leak (§5.5) and China/DeepSeek transfer (§5.6).

**Priority for this company: CRITICAL.** The products collect "among the most sensitive data classes possible" (Liability §5 aggregate) and the breach-notification trigger is live (refresh-token relay).

**What underwriters will ask (and how to be insurable):**

- [ ] **Encryption at rest** for sensitive stores? *(Audit: NOT encrypted — §5.3, Exec Privacy #15. This is a hard underwriting question; a "no" raises premium or triggers a sub-limit/coinsurance on the data-corpus risk. Document compensating controls and a remediation timeline.)*
- [ ] **MFA** on admin/cloud (Supabase, Stripe, Vercel, GitHub, domain registrar, email)? *(Operational; cheap to confirm and a near-universal binding condition.)*
- [ ] **Sub-processor inventory / data-flow map**? *(Absent — Exec Privacy #8, Doc #3. Insurers increasingly require an Art. 30-style processing record.)*
- [ ] **Privacy policy that matches actual data flows**? *(Currently inaccurate — lists unused Sentry/Groq/OpenRouter/Ollama, omits DeepSeek — §3.1, §5.6. An inaccurate policy can itself be a Media/Advertising exposure AND a cyber-claim aggravator.)*
- [ ] **Incident-response / breach-notification runbook** and a 72-hour GDPR-window process? *(Absent — Exec Doc #23, Compliance #21. Many cyber policies *require* prompt notice to the carrier; have the runbook name the broker's breach hotline.)*
- [ ] **Backup strategy** and **patch/vuln management**?
- [ ] **Working data-deletion/export**? *(Absent — Exec Privacy #1. A deletion failure during a DSAR is exactly the kind of regulatory exposure the policy's regulatory-defense sub-limit addresses; carriers want to see a path exists.)*

> **Insurability action:** The two cheapest, highest-leverage answers are (a) **turn on MFA everywhere** (Operational, Low effort) and (b) **publish an accurate sub-processor list + corrected privacy policy** (Documentation, Medium effort). Encryption-at-rest is technical (out of scope here) but you should at minimum **document a remediation plan and compensating controls** so the underwriter sees a managed risk, not an open one.

**Effort: Medium.** **Protection: High.**

---

### 3.3 Media / Advertising Liability — **PRIORITY 2 (secure as an endorsement, not a standalone)**

**What it covers.** Claims arising from your *statements*: false advertising, deceptive-practice allegations, disparagement, and (often) IP issues in advertising content. Frequently bundled into Cyber or CGL as "advertising injury / media liability."

**Audit risks transferred.** The marketing-claim exposure is acute and **self-documented**: the "100% on-device" claim is contradicted by cloud egress, with an in-code `Cargo.toml:28` AUDIT comment admitting it (Liability §8.1, Exec Legal #5). Also "built for legal teams" (§8.x, Exec Legal #9), any "sandboxed/safe agent" framing (§8.3), inaccurate sub-processor disclosures (§8.5), and phantom-provider overstatement (Exec Business #19).

**Critical caveat — the knowledge problem.** Because the contradiction is *documented in your own code*, an FTC/UDAP claim could be characterized as **knowing/willful**, which "elevates this from negligent to potentially willful" (Liability §8.1). **Willful/intentional deception is typically excluded** from media coverage (see §8). Insurance here protects you against *good-faith advertising disputes*, not against a claim you knew the copy was false.

> **Insurability action (and self-protection):** **Correct the "on-device" claim and the sub-processor list BEFORE binding** (Liability §11 step 3). This (a) removes the willful-conduct characterization that would void coverage, and (b) is a prior-acts/known-circumstance question on the application — undisclosed known issues can rescind the policy. Document the correction date so coverage attaches to a clean go-forward record.

**Priority for this company: HIGH** — but **remediation of the claims must precede the policy.** The policy is worth little while the deceptive copy is live and self-admitted.

**Effort: Low** (endorsement) **+ Medium** (the prerequisite copy correction, owned by Legal/Policy). **Protection: Medium** (capped by the willfulness exclusion until copy is fixed; High thereafter).

---

### 3.4 General Liability (CGL) — **PRIORITY 3 (cheap; buy with the bundle)**

**What it covers.** Bodily injury, property damage, premises/operations, and a baseline of advertising injury. For a software company the surprising relevant trigger is **physical merchandise**.

**Audit risks transferred.** The **Printful-fulfilled merch line** ships physical goods to customers (Liability §9.6, Exec Privacy #24). Physical product = **product-liability** exposure (a defective/harmful item) that E&O/Cyber do **not** cover. CGL also provides the baseline advertising-injury coverage that complements §3.3.

**Priority for this company: MEDIUM.** Low cost, and the merch line creates a genuine (if small) product-liability tail. Confirm whether Printful's own terms provide any manufacturer indemnity (a vendor-contract question for Part 3/Legal) — but do not rely on it as your only backstop.

**What underwriters will ask:** revenue, product categories sold, whether you manufacture vs. dropship (you dropship via Printful — favorable), and any prior claims.

> **Documentation action:** Keep the **Printful relationship papered** (vendor agreement + DPA per §9.6) so the print-on-demand vendor, not you, owns manufacturing defects to the extent contractually possible. The insurer will look favorably on a dropship-with-vendor-indemnity posture.

**Effort: Low.** **Protection: Medium.**

---

### 3.5 Directors & Officers (D&O) — **DEFERRED until you raise / form a board**

**What it covers.** Personal liability of directors/officers for management decisions; demanded by virtually every institutional term sheet.

**Audit risks transferred.** Indirectly addresses the single-individual accountability concentration (Liability §3.4) once that individual is an *officer* of a funded entity facing investor/management-liability claims.

**Priority for this company: LOW / NOT YET.** Pre-revenue, no outside investors, no board — there is no D&O exposure to insure. **Trigger to revisit:** first priced equity round, first outside board member, or first institutional/SAFE investor that requires it.

> **Sequencing note:** Add to the renewal/raise checklist. When raising, the term sheet will likely *mandate* D&O with a minimum limit; budget it into the financing.

**Effort: Long-term** (deferred). **Protection: High** *when applicable* (but currently Low priority because not yet triggered).

---

### 3.6 Employment Practices Liability (EPLI) — **DEFERRED until first hire/contractor**

**What it covers.** Wrongful termination, discrimination, harassment claims from workers.

**Priority for this company: NOT YET** — solo founder, no employees (Exec Business #24 notes the key-person/solo posture). **Trigger to revisit:** first W-2 employee or substantial 1099 contractor relationship.

**Effort: Long-term** (deferred). **Protection: Medium** *when applicable.*

---

## 4. Recommended program by stage (sequencing)

| Stage | Bind now | Documentation prerequisite | Defer |
|---|---|---|---|
| **Stage 0 — Today (pre/early revenue, solo)** | Tech E&O + Cyber **bundle** (§3.1–3.2); Media/Advertising as endorsement (§3.3) *after* copy fix; CGL (§3.4) | LLC formed; EULA+AUP drafted/in-progress; MFA on; accurate privacy policy + sub-processor list; "on-device" copy corrected | D&O, EPLI |
| **Stage 1 — Paid sales scaling / first B2B "team" customer** | Increase Cyber/E&O limits; add DPA (contract, not insurance) to enable B2B; confirm Media covers expanded claims | Incident-response runbook; deletion/export pipeline documented; SOC2-readiness questionnaire answers | D&O, EPLI |
| **Stage 2 — Fundraising / board** | **Add D&O** (§3.5) | Cap table, board governance docs | EPLI until hire |
| **Stage 3 — First hire** | **Add EPLI** (§3.6) | Employee handbook, offer letters, IP-assignment agreements | — |

---

## 5. The "make us insurable" documentation checklist

These are the artifacts an underwriter (and a future enterprise buyer's security questionnaire — Exec Business #14) will request. Most already appear elsewhere in this Blueprint; insurance is a *consumer* of them. Producing them lowers premiums and prevents application-misrepresentation that voids coverage.

- [ ] **LLC formation documents** (named insured). *Corporate — Part 2.* — **enables every policy**
- [ ] **EULA with liability cap + warranty disclaimer + AI-output disclaimer.** *Legal — Part 3.* — **biggest E&O lever**
- [ ] **Acceptable Use Policy** (shell-exec, recording, downloading misuse disclaimers). *Policy.* — E&O/Media
- [ ] **Accurate privacy policy** reconciled to real data flows (fix Sentry/Groq/OpenRouter/Ollama/DeepSeek discrepancies). *Documentation.* — Cyber/Media
- [ ] **Sub-processor inventory / data-flow map** (Art. 30-style record). *Documentation.* — Cyber underwriting
- [ ] **MFA enabled** on Supabase, Stripe, Vercel, GitHub, domain registrar, email. *Operational.* — Cyber binding condition
- [ ] **Incident-response + breach-notification runbook** naming the carrier's breach hotline. *Operational/Policy.* — Cyber requirement
- [ ] **Corrected "on-device" / efficacy marketing claims**, with correction dates logged. *Policy/Documentation.* — Media insurability + voids willfulness
- [ ] **Vendor agreements + DPAs** (Printful, Stripe, AI sub-processors). *Legal.* — CGL/Cyber
- [ ] **Release/change-management checklist** (replaces undocumented `vercel --prod`-from-local). *Operational.* — E&O underwriting
- [ ] **Claims/circumstances history** — honest disclosure of *any* known potential claim (the GPL ffmpeg matter, the on-device contradiction) on every application. *Governance.* — **prevents rescission**

> **Critical underwriting-integrity point.** Insurance applications ask whether you are aware of any **facts or circumstances** that could give rise to a claim. The audit *is* such a record. **You must disclose known matters** (e.g., the GPL ffmpeg conflict, the self-admitted on-device contradiction) to the broker — failing to do so gives the carrier grounds to **rescind the entire policy** when you most need it. The correct play is: **remediate first, disclose honestly, then bind** with a clean go-forward record. Have counsel (Part 3) advise on what is a reportable "circumstance" vs. a remediated issue.

---

## 6. How to procure (vendor process)

1. **Engage a specialty broker** who places **tech E&O + cyber** for early-stage software companies (e.g., Vouch, Embroker, Founder Shield, or a regional broker with a tech practice). A broker, not a direct carrier, because they (a) run multiple carriers against one application and (b) advocate at claim time.
2. **Run one application package** covering E&O + Cyber + Media + CGL — bundled programs are cheaper and avoid coverage gaps between policies.
3. **Prepare the §5 documentation first.** Hand the broker the LLC docs, the EULA (or its target date), the privacy policy, the sub-processor list, and an honest circumstances disclosure.
4. **Quote in the entity name.** Confirm the named insured is the LLC; add the founder as an insured person where the policy allows.
5. **Review the exclusions with counsel before binding** — specifically the IP-infringement, willful-conduct, prior-acts, and "failure to maintain security" exclusions (§8). Negotiate retroactive/prior-acts dates and any sub-limits on the unencrypted-data-corpus risk.
6. **Re-quote at each Stage trigger** (§4). Set a calendar reminder for renewal and for the D&O/EPLI triggers.

**Effort: Medium.** **Protection: High** (this process *is* the program).

---

## 7. Indicative cost/limit posture (planning only — not a quote)

For a pre/early-revenue solo software company, a bundled **Tech E&O + Cyber** program at modest limits (commonly **$1M/$1M** to start, with a small retention) is typically a **low-four-figure annual** spend; CGL is usually a few hundred dollars; Media is often included or a small endorsement. Limits should scale with revenue and with the first B2B "team" contract (those customers will often *require* minimum limits — coordinate limits with the EULA cap and any contractual insurance requirements). Treat all figures as directional; the broker's quote governs.

---

## 8. What insurance will NOT cover (the gaps you must close another way)

Insurance is not a substitute for remediation. The following are commonly excluded and must be handled by **compliance, not coverage**:

| Excluded / uninsurable | Why excluded | The real fix (non-insurance) |
|---|---|---|
| **GPL ffmpeg copyleft violation** (Liability §7.1) | **Known/willful IP infringement** is a near-universal IP-coverage exclusion; this is a *known, visible-in-the-binary* violation, not a fortuitous loss | Remediate/relicense the distribution method per counsel (Legal/Operational — see Liability §11 step 1). **Do this before relying on any IP coverage.** |
| **Self-admitted "on-device" deception** if uncorrected | **Willful/intentional deception** exclusion in Media policies; the `Cargo.toml:28` comment is documentary knowledge | Correct the copy first (Policy/Documentation); only then is good-faith Media coverage meaningful |
| **Other known/intentional acts** | Fortuity doctrine — insurance covers *unexpected* loss | Disclose + remediate; do not expect the policy to absorb a known violation |
| **Regulatory fines where uninsurable by law** | Many GDPR/UDAP fines are uninsurable as a matter of public policy in some jurisdictions | Compliance program (privacy, deletion, sub-processor disclosure) — Parts on Policy/Compliance |
| **Failure-to-maintain-security exclusion firing** | Cyber policies can deny if you misrepresented controls (e.g., claimed encryption-at-rest you don't have) | Answer applications **accurately**; document compensating controls; remediate encryption-at-rest |
| **Contractual liability you assumed beyond your control** | "Assumed liability" exclusions | Keep the EULA's customer-facing obligations modest; don't over-warrant |
| **Patent infringement** (often) | Frequently excluded or sub-limited in standard tech E&O | Clear/register the "Ship*" marks (Liability §7.5); separate IP strategy |

> **The throughline:** insurance backstops *fortuitous, unexpected, good-faith* loss. Every audit item that is **known and uncorrected** (GPL ffmpeg, the on-device contradiction) is *outside* the policy until it is remediated — and worse, an undisclosed known matter can **void the policy entirely**. Remediation is therefore a *precondition* of effective coverage, not an alternative to it.

---

## 9. Action summary (highest protection / lowest effort first)

1. **Enable MFA everywhere** — Operational, Low effort, High protection (cyber binding condition + cheap risk reduction).
2. **Form the LLC and name it as insured** — Corporate, Medium effort, High protection (precondition for all coverage).
3. **Correct "on-device" copy + publish accurate sub-processor list/privacy policy** — Policy/Documentation, Medium effort, High protection (removes willfulness, enables Media/Cyber).
4. **Draft EULA + AUP with liability cap, warranty + AI-output disclaimers** — Legal, Medium effort, High protection (biggest E&O lever).
5. **Bind Tech E&O + Cyber bundle (+ Media endorsement + CGL)** — Insurance, Medium effort, High protection.
6. **Write the incident-response/breach-notification runbook naming the carrier hotline** — Operational, Low effort, High protection.
7. **Honestly disclose known circumstances (GPL, on-device) to the broker; remediate before binding** — Governance, Low effort, High protection (prevents rescission).
8. **Keep Printful/Stripe vendor agreements + DPAs current** — Legal, Low effort, Medium protection (supports CGL/Cyber).
9. **Document a release/change-management checklist** — Operational, Low effort, Medium protection (E&O underwriting).
10. **Defer D&O to fundraising and EPLI to first hire; calendar the triggers** — Governance, Long-term, High protection when triggered.

*This document is risk-management guidance, not legal or insurance advice. Final coverage decisions should be made with a licensed broker and counsel in the operator's jurisdiction.*
