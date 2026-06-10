# 06 — Operational Protections

**Business Protection Blueprint — Part 6 of the Ship Ecosystem governance wrapper**
**Prepared for:** Jacob Felton, sole founder — Ship Ecosystem (ShipTalk, ShipMind, ShipSpace desktop apps + makeshiphappen.tech)
**Scope:** Operational, process, and governance controls only. **No code changes are prescribed here.** Where an audit finding has a technical root cause, this document wraps it in a *process* control (a checklist, a register, a standing verification, a runbook) — it does not tell you what to edit in the codebase.
**Grounding sources:** `docs/audit-v3/00-EXECUTIVE-REPORT.md`, `docs/audit-v3/07-security-review.md`, `docs/audit-v3/13-shipspace-cluster.md`.
**Company posture assumed:** US-based, single-founder, pre/early-revenue, selling distributed macOS desktop software (BYOK AI) plus a Stripe-billed web subscription. Nevada (incorporation candidate) / California (founder nexus) considerations flagged where relevant.

---

## How to read this document

Every protection is tagged:

- **Effort:** `Low` (hours–a day, no specialist) · `Medium` (days, or one counsel/vendor touch) · `Long-term` (recurring program or multi-week build-out).
- **Protection value:** `High` (closes a Critical/High audit exposure or a single-point-of-failure) · `Medium` · `Low`.

The list is ordered **highest-protection-for-lowest-effort first** within each section, and the sections themselves are ordered by urgency. Start at the top of §1 and work down.

> **One-line thesis:** The audit found the *cryptography* is strong and the *governance* is thin. None of the items below require touching source code — they are documents to draft, registers to keep, vendors to onboard, and standing checks to run on a calendar. They are the cheapest risk reduction available to a solo founder.

---

## Quick-reference matrix

| # | Protection | Category | Effort | Value | Primary risk mitigated |
|---|-----------|----------|--------|-------|------------------------|
| 1 | Supabase email-confirmation standing check | Operational | Low | High | WEB-2 / OWNER_EMAILS bypass (Exec #9, Sec #13) |
| 2 | Release & deployment checklist (prod-matches-repo) | Operational | Low | High | WEB-2 / `vercel --prod` divergence (Exec Biz #7) |
| 3 | Comp-access grant register + periodic review | Operational | Low | High | WEB-3 / no auto-expiry (Exec Biz #8) |
| 4 | security.txt + vulnerability-disclosure (VDP) policy | Policy/Operational | Low | High | No intake for the agent/RCE findings |
| 5 | Incident-response & breach-notification runbook | Operational | Medium | High | Doc Gap #23; 72h GDPR clock |
| 6 | Sub-processor / vendor onboarding & DPA register | Operational/Governance | Medium | High | Exec Biz #14/#23, Sec 7.8 |
| 7 | Key & secrets custody / rotation register | Operational | Medium | High | S-11/ST-7/WEB-3 crown-jewel keys |
| 8 | Backup & data-store recovery practice | Operational | Medium | Medium | Liability #1 backups; continuity |
| 9 | Release change-log / deployment record | Documentation | Low | Medium | Audited ≠ shipped (Doc Gap #9) |
| 10 | Single-founder business-continuity / bus-factor plan | Governance/Operational | Long-term | High | Exec Biz #24 key-person risk |
| 11 | Standing RLS verification procedure | Operational | Medium | High | Sec 7.2/§8 RLS load-bearing |
| 12 | Operational cadence calendar (ties it together) | Governance | Low | Medium | Drift / "silently degrades to no control" |

---

## 1. Release & Deployment Governance

**The problem (from the audit).** Both the website and the desktop apps ship from the *operator's local working tree*, not from a reviewed, tagged, CI-gated artifact:

- The website "deploys from a **separate** nested git repo (`Kaveli888/makeshiphappentech.git`) via `vercel --prod`, so live ≠ audited is a standing governance risk" (07 §1; Exec Biz #7, Doc Gap #9, Compliance #25). The auditors explicitly say "live production code is **not guaranteed** to match what was audited" (07 §8).
- Desktop releases run `upload-release.mjs` with a Supabase **service-role key in operator env** (SS-11, ST-7) — high-privilege, no second pair of eyes.

These are *process* gaps, not code gaps. You cannot audit your way out of "the thing I shipped isn't the thing that was reviewed" — you need a release ritual.

### 1.1 Adopt a written Release Checklist (the "prod-matches-repo" gate)

Draft a one-page **`RELEASE-CHECKLIST.md`** (keep it in the repo, run it every deploy). Minimum gates:

1. **Tag the exact commit** being deployed (`git tag release/<product>-<version>`), and confirm the working tree is clean (`git status` shows nothing uncommitted) *before* `vercel --prod` or `upload-release.mjs`.
2. **Prod-matches-repo verification:** record the deployed commit SHA and, post-deploy, confirm the live `/` (or app `version`) reports that SHA/version. For the website, because deploy is from the *separate* `makeshiphappentech.git`, the checklist must state which repo and which branch/commit is canonical, and confirm the audited tree and the deploy tree are reconciled for this release.
3. **Pre-flight env diff:** confirm the live Vercel env vars match the intended set (the audit flags `GOOGLE_API_KEY` vs `GEMINI_API_KEY` and `STRIPE_PRICE_ID_PRO` naming as live-only unknowns). Keep an expected-env manifest and diff against it.
4. **Standing-setting confirmations** (see §2 and §11): Supabase "Confirm email" ON, pending migrations applied.
5. **Sign-off line:** date, version, who ran it, what changed. This *is* your change log (§1.3).

| Item | Category | Effort | Value |
|---|---|---|---|
| Written release checklist with prod-matches-repo + env-diff gate | Operational | **Low** | **High** |

*Mitigates:* WEB-2 / `vercel --prod` local-tree divergence (Exec Biz #7, Doc Gap #9, Compliance #25).

### 1.2 Reconcile the two website repos (canonical-source decision record)

Write a short **decision record** naming which repo is authoritative for makeshiphappen.tech and committing to deploy only from it (or to keep the audited repo and the deploy repo in lockstep with a documented sync step). The audit's central website governance complaint is that the deploy repo is *different from* the one that was reviewed. This is a one-time governance memo, not code.

| Item | Category | Effort | Value |
|---|---|---|---|
| Canonical-deploy-repo decision record + lockstep rule | Governance | **Low** | **High** |

*Mitigates:* WEB-2 "live ≠ audited" (07 §8).

### 1.3 Maintain a deployment change log / release record

Keep a running **`CHANGELOG.md` / release log** (one row per deploy: date, product, version, commit SHA, summary, who, checklist-passed Y/N). This converts every deploy into an auditable record and is the artifact you produce if a customer, insurer, or regulator asks "what was running on date X." It also satisfies Doc Gap #9 ("no record of how prod is built").

| Item | Category | Effort | Value |
|---|---|---|---|
| Deployment change-log / release record | Documentation | **Low** | **Medium** |

*Mitigates:* Doc Gap #9; supports incident timeline reconstruction (§5).

---

## 2. Supabase Email-Confirmation — Standing Operational Check

**The problem.** The hardcoded `OWNER_EMAILS` privilege bypass (`zzgemsjewelry@gmail.com`) is present in **all four products** and is **safe only if Supabase "Confirm email" is ON in production**. The audit states this repeatedly and emphasizes it "cannot be verified from code … and must be confirmed manually" (Exec #9, 07 WEB-2, Sec #13, Compliance #4). If the setting is OFF, *anyone who registers an owner email inherits free `team`/premium access* — an authorization-escalation that bypasses all client gating.

The C-1 owner-bypass code fix already landed (per your memory: `00a4a2d`, `email_confirmed_at`), but the **code guard is only as good as the project setting it depends on**. That setting is an operational control, not a code control.

### 2.1 Make "Confirm email = ON" a standing, dated, evidenced check

- Verify *today* in the Supabase dashboard (Auth → Providers/Email → "Confirm email" enabled) and **screenshot it with a date** into the release record.
- Add it as a **mandatory line in the Release Checklist (§1.1)** — re-confirm every deploy.
- Add it as a **recurring calendar item** (monthly) on the operational cadence (§12), because Supabase settings can be changed out-of-band and silently.
- Record the confirmation in a one-line **standing-controls register** alongside RLS status (§11).

| Item | Category | Effort | Value |
|---|---|---|---|
| Supabase "Confirm email" ON — dated evidence + per-release + monthly re-check | Operational | **Low** | **High** |

*Mitigates:* WEB-2 / OWNER_EMAILS bypass (Exec #9, Sec #13, Compliance #4). This is the single highest-value, lowest-effort operational item in this document.

---

## 3. Comp-Access Grant Management (the "no auto-expiry" control)

**The problem.** `scripts/comp-access.mjs` grants free premium by directly setting `subscription_tier` with the **full service-role key**, bypassing RLS *and* Stripe, and has **no auto-expiry** — grants "persist until manual revoke" (WEB-3, Exec Biz #8). Your own memory confirms: *"app has NO auto-expiry, must revoke manually."* The only guard is a refusal when a `stripe_customer_id` already exists. Forgotten comps = indefinite revenue leakage and an ungoverned set of privileged accounts.

This is squarely an operational control: a register + a review cadence. (Do **not** treat this as a code task — the protection is the discipline, not an expiry feature.)

### 3.1 Stand up a Comp-Access Grant Register

Create a tracked **`comp-grants.md` / sheet** with one row per grant: email, tier granted, date granted, reason/sponsor, **intended expiry date**, granted-by, revoked? (date). Every time you run `comp-access.mjs grant`, you add a row *in the same session*. Every `revoke`, you close the row.

### 3.2 Adopt a periodic comp-access reconciliation

On a recurring cadence (monthly — see §12), reconcile the register against actual `subscription_tier` rows in Supabase: revoke any grant past its intended expiry, and flag any privileged row that has no register entry (drift detection). Document the reconciliation date each time.

| Item | Category | Effort | Value |
|---|---|---|---|
| Comp-access grant register (email/tier/date/expiry/reason/revoked) | Operational | **Low** | **High** |
| Monthly comp-access reconciliation against live tiers | Operational | **Low** | **Medium** |

*Mitigates:* WEB-3 (Exec Biz #8) — converts a control that "silently degrades to no control on operator forgetfulness" (07 §4) into a tracked, expiring grant.

---

## 4. Vulnerability Disclosure & security.txt Policy

**The problem.** The audit catalogs serious, externally-relevant security findings (ShipSpace raw-PTY agent shell, full-disk read, MCP token exposure, cli-login token relay). There is **no documented intake** for a researcher or customer who finds one of these — no `security.txt`, no disclosure policy, no triage runbook (Doc Gap #23 notes the absence of an incident/response path generally). Without a stated channel, a finder either drops it publicly (0-day exposure) or you miss it entirely.

### 4.1 Publish a Vulnerability Disclosure Policy (VDP) + `security.txt`

- Draft a short **`SECURITY.md`** / VDP page: scope (the four products + website), a single security contact (a dedicated alias such as `security@makeshiphappen.tech`, not your personal Gmail), what you commit to (acknowledge within N business days), safe-harbor language for good-faith researchers, and what's out of scope.
- Publish **`/.well-known/security.txt`** on makeshiphappen.tech (RFC 9116: `Contact:`, `Expires:`, `Policy:` URL). This is the standard machine-readable beacon researchers look for; it is a few lines of static content (a documentation/policy artifact, not a code change).
- Add a `SECURITY.md` to the public repos / app Help menu.

| Item | Category | Effort | Value |
|---|---|---|---|
| Vulnerability-disclosure policy (SECURITY.md) with safe-harbor + dedicated alias | Policy | **Low** | **High** |
| `/.well-known/security.txt` (RFC 9116) on the website | Operational | **Low** | **Medium** |

*Mitigates:* lack of intake for the High/Critical security findings; supports coordinated rather than public disclosure; feeds the incident runbook (§5).

---

## 5. Incident-Response & Breach-Notification Plan

**The problem.** Doc Gap #23: "No incident-response / breach-notification runbook." The audit's worst-case scenarios are concrete and *plausible*: a leaked minisign private key pushing a malicious update to all users (Liability #4), the cli-login token-theft / account-takeover vector (WEB-1, Critical privacy #3), MCP token exfiltration (ST-1), or a prompt-injected agent exfiltrating `~/.ssh`/`~/.aws` (Sec #1–6). With paying customers and PII flowing to Supabase/Stripe/Printful, you may carry **statutory breach-notification duties** (California `Cal. Civ. Code §1798.82`; GDPR's 72-hour Art. 33 clock for EU users — Compliance #21). You cannot improvise this under pressure.

### 5.1 Draft an Incident-Response Runbook (IRP)

A single **`INCIDENT-RESPONSE.md`** covering, at minimum:

1. **Severity triage** — define SEV levels and what qualifies (e.g., signing-key compromise = SEV-1; single-user data exposure = SEV-2).
2. **Roles** — as a solo founder, name yourself as Incident Commander and pre-identify the *external* numbers you'll call (counsel, Supabase/Stripe support, cyber-insurer hotline — see §6/insurance).
3. **Containment playbooks** for the audit's named scenarios: revoke/rotate the minisign + Supabase service-role + Stripe keys (Liability #4, S-11); invalidate Supabase sessions (WEB-1); pull a bad release from the `releases` bucket; revoke a comp grant.
4. **Forensics & timeline** — pull the deployment change-log (§1.3) and logs to reconstruct what was live and when.
5. **Decision tree for notification** (§5.2).

### 5.2 Adopt a Breach-Notification Procedure

A decision aid mapping *what was exposed* → *who must be told and by when*: affected users, California AG (if >500 CA residents), GDPR supervisory authority within 72 hours for EU data subjects, Stripe (for cardholder-adjacent events), and a pre-drafted **customer notification template** so you're not writing legalese during a crisis. Have counsel review the template once (§6 / Legal blueprint cross-ref).

| Item | Category | Effort | Value |
|---|---|---|---|
| Incident-response runbook with named containment playbooks | Operational | **Medium** | **High** |
| Breach-notification decision tree + pre-drafted customer template | Operational | **Medium** | **High** |

*Mitigates:* Doc Gap #23; Compliance #21 (72h GDPR); Liability #4 (signing-key compromise); WEB-1/ST-1 exposure response.

---

## 6. Vendor & Sub-Processor Management

**The problem.** Raw user content (source code, voice, personal notes, shipping PII) egresses to **7–11 AI sub-processors per product** plus Supabase, Stripe, GitHub, Printful, and Vercel — with **no sub-processor inventory, no DPAs collected, no onboarding review** (Sec 7.8, Exec Biz #14/#23, Compliance #6/#9). DeepSeek (China jurisdiction) is undisclosed (Legal #6). You "cannot answer enterprise security questionnaires" (Exec Biz #14) and "cannot close GDPR-bound B2B deals" (Exec Biz #23). This is the operational backbone behind the privacy/legal documents covered elsewhere in the blueprint — here we own the *process* of running it.

### 6.1 Build and maintain a Sub-Processor / Vendor Register

A single **`sub-processors.md`** (also the source of truth for the public sub-processor page the Privacy blueprint will require): vendor name, purpose, data categories sent, jurisdiction/region, DPA status (link), and active/dormant flag. Seed it from the audit's data-flow inventory (13 §6, 02-data-flow-audit). Mark the audit's phantom/dormant flows (Nano Banana mock, Manus dormant) as **inactive** so the register doesn't over-count (I-9).

### 6.2 Adopt a vendor-onboarding review gate

A short **intake checklist** to run *before* enabling any new sub-processor: data categories it will receive, jurisdiction, retention/training stance (does it train on customer data?), DPA available?, security posture. Documenting the review is the control — it's how the *next* DeepSeek-style undisclosed-transfer gap is caught before it ships.

### 6.3 Collect DPAs and maintain the DPA register

Most providers (Anthropic, OpenAI, Google, Supabase, Stripe, Vercel, GitHub, Printful) publish standard DPAs you can accept/sign. Collect them, store them, and log status in the register. This is the artifact that unlocks B2B sales and answers Art. 28/30 processor-accountability obligations (Compliance #6/#9, Exec Biz #23).

| Item | Category | Effort | Value |
|---|---|---|---|
| Sub-processor / vendor register (seeded from data-flow audit) | Operational | **Medium** | **High** |
| Vendor-onboarding review checklist (run before enabling any new processor) | Governance | **Low** | **Medium** |
| DPA collection + DPA-status register | Operational/Legal | **Medium** | **High** |

*Mitigates:* Exec Biz #14/#23, Compliance #6/#9, Legal #6/#19, Sec 7.8.

---

## 7. Backup & Key-Management Operational Practices

**The problem (keys).** The audit names several **crown-jewel secrets held in operator env / local CLI**: the **minisign private update-signing key** (a leak = malicious-update push to all users, "catastrophic" — Liability #4, S-11, I-8), the **Supabase service-role key** (full RLS bypass, used by release + comp scripts — SS-11, ST-7, WEB-3), and the **Stripe secret/webhook keys**. There is no documented custody, rotation, or recovery practice for any of them. The audit calls these "crown jewels" explicitly (13 S-11).

**The problem (backups).** Liability hotspot #1 explicitly assigns "back up project data before agent runs" as a shared responsibility, and the privacy review notes data stores are unencrypted at rest and captured by iCloud/Time Machine (Privacy #15). You need a deliberate backup posture — both for *your* business records (Supabase data, Stripe records, signing keys) and as a documented expectation for users.

### 7.1 Create a Key & Secret Custody Register + rotation schedule

A **`key-custody.md`** (kept *out* of any repo; store in a password manager / encrypted note): each crown-jewel key — minisign private key, Supabase service-role, Stripe secret + webhook signing secret, Apple Developer ID signing identity, Vercel tokens — with: where it lives, who can access it, last-rotated date, rotation trigger, and *recovery procedure if lost*. Pair it with a written rotation cadence (and an immediate-rotation trigger that the incident runbook §5 invokes).

### 7.2 Secure the minisign signing key specifically

Because a leaked update-signing key is the single most catastrophic operational event in the audit (Liability #4), document its custody as a named control: offline/hardware-backed storage, no copies in repos or operator shell history, a written "if compromised" procedure (cut a new keypair, ship a forced update, notify users). This is a custody *policy*, not a code change.

### 7.3 Adopt a backup & recovery practice for business-critical stores

A short **backup runbook**: periodic export/snapshot of the Supabase database (auth + profiles + subscriptions), retention of Stripe records, and a copy of the signing keys in a separate secured location. State the recovery test cadence (restore a snapshot to a scratch project at least annually). Pre-revenue this can be lightweight, but write it down so continuity (§10) is real.

| Item | Category | Effort | Value |
|---|---|---|---|
| Key & secret custody register + rotation/recovery schedule | Operational | **Medium** | **High** |
| Minisign signing-key custody policy (offline + compromise procedure) | Operational/Policy | **Low** | **High** |
| Backup & recovery runbook for Supabase/Stripe/keys + annual restore test | Operational | **Medium** | **Medium** |

*Mitigates:* Liability #4 (signing-key compromise), S-11/ST-7/WEB-3 (service-role custody), Privacy #15 (backup posture), continuity (§10).

---

## 8. Standing RLS Verification Procedure

**The problem.** The audit repeatedly states that **cross-tenant isolation and paid-feature gating both rest entirely on Supabase RLS that cannot be audited from the client repos** (07 §7.2, Exec #6/#11, Compliance #11, Sec #25). "Verifying RLS scoping per `auth.uid()` is the load-bearing external control" (07 §8). Like the email-confirm setting, RLS lives in the database, not the code you ship — so it needs an *operational* verification, not a code review.

### 8.1 Adopt a periodic RLS verification check

A short **`rls-verification.md` procedure**: for each user-data table (transcriptions, dictionary_terms, profiles, subscriptions, usage_events, ip_rate_events, chat/memory tables), confirm an RLS policy exists and is scoped to `auth.uid()`, and run a two-account spot test (account A cannot read account B's rows). Record the date and result in the standing-controls register (§11). Run it on each schema-affecting deploy and on the monthly cadence (§12). This is the backstop the audit names for the entire client-trusted-authorization theme.

| Item | Category | Effort | Value |
|---|---|---|---|
| Standing RLS verification procedure + two-account spot test, logged | Operational | **Medium** | **High** |

*Mitigates:* Exec #6/#11, Compliance #11, Sec #25, 07 §7.2/§8 — the load-bearing external control behind every client-side authorization finding.

---

## 9. Single-Founder Business Continuity (Bus-Factor)

**The problem.** Exec Biz #24: "Single-developer key-person dependency for release signing / Supabase admin … Bus-factor risk to releases, billing, and incident response." Today, if you are unavailable, *no one* can sign a release, rotate a leaked key, respond to a breach, revoke a comp, answer a data-subject request, or pay the Vercel/Supabase/Stripe bills — and customers are left with a paid product going dark. This is the structural operational risk that sits under everything else.

### 9.1 Write a Business-Continuity / Key-Person plan

A **`CONTINUITY.md`** (sealed/shared with a trusted person and/or counsel): an inventory of every account, service, and key required to keep the business running (registrar, Vercel, Supabase, Stripe, Apple Developer, GitHub, signing keys, sub-processor accounts), where credentials are recoverable (master password-manager + recovery contacts), and the minimum runbook a successor would need to (a) keep the lights on, (b) respond to a breach, (c) wind down gracefully if needed.

### 9.2 Designate an emergency/successor contact and access path

Identify at least one trusted person (and/or counsel/registered agent) who can access the continuity plan and the credential vault under a defined trigger (incapacity, extended unavailability). Use your password manager's emergency-access feature and document the legal authority (this dovetails with the Corporate blueprint's formation work — an LLC gives a cleaner vehicle for succession than a sole proprietorship).

### 9.3 Reduce key-person concentration over time

Longer-term: separate the most dangerous single points (e.g., move release signing behind a documented, transferable process; keep billing-payer details recoverable; ensure DNS/registrar isn't tied to one personal account). Pre-revenue this is a plan, not a hire — but the *plan* is the protection.

| Item | Category | Effort | Value |
|---|---|---|---|
| Business-continuity / key-person plan (account + key inventory + successor runbook) | Operational/Governance | **Long-term** | **High** |
| Designated emergency/successor contact + credential emergency-access path | Governance | **Medium** | **Medium** |
| De-concentrate single points of failure (signing/billing/DNS) over time | Operational | **Long-term** | **Medium** |

*Mitigates:* Exec Biz #24 key-person / bus-factor risk; underpins incident response (§5) and key custody (§7).

---

## 10. Operational Cadence Calendar (the glue)

**The problem.** The audit's recurring phrase for WEB-3/WEB-4/WEB-5 and the email-confirm/RLS settings is that each "silently degrades to no control on operator forgetfulness" (07 §4). A solo founder's enemy is drift. The single cheapest way to keep every standing check alive is to put them on a calendar.

### 10.1 Stand up a recurring operational cadence

Create recurring reminders (calendar / cron / task list) that bundle the standing checks into a rhythm:

| Cadence | Checks |
|---|---|
| **Every release** | Release checklist (§1.1), Supabase confirm-email (§2), pending migrations applied, env diff, change-log entry (§1.3) |
| **Monthly** | Comp-access reconciliation (§3.2), RLS spot test (§8), confirm-email re-check (§2), review open security reports (§4) |
| **Quarterly** | Key custody review + rotation check (§7.1), sub-processor register review (§6.1), VDP `security.txt` `Expires:` refresh (§4) |
| **Annually** | Backup restore test (§7.3), continuity-plan refresh (§9), DPA register review, insurance renewal review |

| Item | Category | Effort | Value |
|---|---|---|---|
| Operational cadence calendar binding all standing checks to a rhythm | Governance | **Low** | **Medium** |

*Mitigates:* the "control silently degrades to no control" drift theme across WEB-2/3, RLS, and email-confirm.

---

## 11. Standing-Controls Register

**The problem.** The audit identifies a set of controls that are "load-bearing but undocumented … no owner of the controls that make the system safe" (Doc Gap #5). These are the off-code settings the whole security posture depends on.

### 11.1 Maintain a one-page Standing-Controls Register

A single living table that records, with a date and a verified-by, the status of every off-code control the audit flagged as load-bearing: Supabase "Confirm email" ON, RLS policies present per table, pending migrations applied, minisign key custody confirmed, service-role/Stripe keys rotation status, sub-processor register current, comp grants reconciled. This is the artifact that proves these controls have an owner (you) and a last-checked date — exactly what Doc Gap #5 says is missing.

| Item | Category | Effort | Value |
|---|---|---|---|
| Standing-controls register (one owner, dated last-verified per control) | Documentation/Governance | **Low** | **Medium** |

*Mitigates:* Doc Gap #5 (load-bearing controls have no owner); consolidates §2/§3/§7/§8 evidence.

---

## 12. Insurance Posture (operational risk-transfer)

**The problem.** The blueprint's Insurance treatment lives in its own document, but two operational realities make a single insurance note belong here: (a) the IRP/breach plan (§5) should name the **cyber-insurer's incident hotline** as a containment contact, and (b) the largest liability hotspots (autonomous-agent destructive action — Liability #1; malicious-update push — Liability #4) are exactly the kind of first/third-party loss that risk-transfer is for, since there is *currently no EULA liability cap* (Exec #1).

### 12.1 Obtain quotes for a Tech-E&O + Cyber-liability line

Get quotes for a combined **Technology Errors & Omissions + Cyber-liability** policy sized for a pre-revenue solo software vendor (these are available at startup tiers). Ensure the cyber portion includes **breach-response/incident services** (the hotline you'll name in §5) and the E&O portion contemplates **AI/software product liability**. Then wire the insurer's incident contact into the IRP.

| Item | Category | Effort | Value |
|---|---|---|---|
| Quote + bind Tech-E&O + Cyber-liability (with breach-response services) | Insurance | **Medium** | **Medium** |

*Mitigates:* Liability #1 (agent action) and #4 (update push) as risk-transfer backstop while/until the EULA liability cap (Exec #1, Legal blueprint) is in force; supplies the §5 incident hotline.

---

## 13. Sequenced Action Plan (do this in order)

**Week 1 — Low-effort, High-value (do first):**
1. Confirm Supabase "Confirm email" ON, screenshot + date it (§2).
2. Draft the Release Checklist with prod-matches-repo + env-diff gate (§1.1) and the canonical-deploy-repo decision record (§1.2).
3. Stand up the Comp-Access Grant Register and reconcile current grants once (§3).
4. Publish SECURITY.md + `security.txt` with a dedicated security alias (§4).
5. Start the deployment change-log and the Standing-Controls Register (§1.3, §11).

**Weeks 2–4 — Medium-effort, High-value:**
6. Draft the Incident-Response runbook + breach-notification decision tree/template (§5).
7. Build the Sub-Processor/Vendor register, onboarding checklist, and begin DPA collection (§6).
8. Create the Key & Secret custody register + minisign custody policy (§7).
9. Adopt the RLS verification procedure and run the first two-account spot test (§8).
10. Stand up the operational cadence calendar (§10).

**Ongoing / Long-term:**
11. Backup runbook + first restore test (§7.3).
12. Business-continuity / key-person plan + emergency-access path (§9).
13. Quote and bind Tech-E&O + Cyber-liability (§12).

---

## 14. Cross-references

- **Legal / Corporate / Insurance blueprints:** the EULA liability cap (Exec #1), entity formation / personal-liability shield (Exec #2), and the privacy policy + public sub-processor page these operational registers *feed* are owned in those documents. This document supplies the *processes* that keep them true.
- **Audit grounding:** every item above cites `00-EXECUTIVE-REPORT.md`, `07-security-review.md`, or `13-shipspace-cluster.md`. The data-flow detail behind the sub-processor register (§6) is in `02-data-flow-audit.md`.

---

*End of 06 — Operational Protections. This document recommends only operational, process, governance, policy, documentation, insurance, and user-responsibility controls. No source code, dependency, build, or configuration change is prescribed; technical findings are addressed here exclusively through process instruments.*
