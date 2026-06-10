# 02 — Legal Protections: Agreements & Disclaimers

**Business Protection Blueprint — Part 2 of N**
**Company:** Make Ship Happen Collective (sole founder: Jacob Felton / "Make Ship Happen" / zzgemsjewelry@gmail.com)
**Products:** ShipTalk, ShipMind, ShipSpace (macOS desktop apps) + makeshiphappen.tech (Next.js commerce/identity website)
**Posture:** Single-founder, US-based (Nevada/California considerations), pre/early-revenue, selling distributed desktop binaries + a web subscription
**Date:** 2026-06-07
**Author role:** Startup general counsel + compliance officer + operations advisor

> **What this document is.** This is the *legal-document suite* layer of the Business Protection Blueprint: the contracts, disclaimers, and policies that must exist before further paid sales. It is the business/governance wrapper around the technical findings catalogued in `docs/audit-v3` — it does **not** prescribe code changes. Every recommendation here is a document to draft, a policy to adopt, or a vendor/counsel process to run. Clause *outlines* only; no final legal text. Engage a licensed attorney in the operating jurisdiction(s) before publishing anything.
>
> **Grounding.** Findings cited from `audit-v3/05-tos-recommendations.md` (Phase 5 ToS), `audit-v3/03-liability-review.md` (Phase 3 Liability), and `audit-v3/00-EXECUTIVE-REPORT.md` (Phase 10 synthesis). The audit's core conclusion: *"The risk in this ecosystem is overwhelmingly concentrated at the governance, legal, and data-lifecycle layers, not at the cryptographic/secrets layer."* This document addresses the first of those layers.

---

## 0. The One-Sentence Problem

Make Ship Happen currently **sells four commercial products and processes voice recordings, full source code, and personal "second brain" corpora under zero contractual terms** — no Terms of Service, no EULA, no warranty disclaimer, no liability cap, no AI-output disclaimer, no Acceptable Use Policy, no DPA — while the products perform *destructive, autonomous, irreversible* operations on the user's machine (raw-shell agents, keystroke injection, home-wide file reads). Without an enforceable contract layer, **every technical risk in the audit flows back to the founder personally with no ceiling on damages** (Liability §3.2; Exec Top Business Risk #1, #2).

The single most urgent legal action is to **adopt and present a binding ToS + first-run EULA + AI/AUP addendum with recorded click-wrap acceptance before the next paid release.**

---

## 1. How to Read This Document

**Effort tiers**
- **Low** — founder + template/counsel boilerplate, days, low cost. Mostly drafting from a known clause outline.
- **Medium** — needs a counsel review pass and some operational wiring (acceptance capture, checkout copy), 1–4 weeks.
- **Long-term** — depends on a precondition (entity formation, deletion pipeline, GPL remediation) or recurring program; weeks to months.

**Protection value** — High / Medium / Low: how much legal exposure the instrument removes for this specific business.

**Prioritization rule:** highest protection for lowest effort first. The "Sequenced Roadmap" (§16) orders everything accordingly.

**Critical sequencing constraint (from Phase 5 §13 and Exec Legal Risk #4):** three representations **must not be published until the underlying engineering is fixed**, or they create a *worse* position by asserting things that are false:
1. **Proprietary-ownership assertion** — blocked by the GPLv2+ ffmpeg conflict in ShipMind.
2. **Data-erasure / "delete your data" promise** — blocked by the absent deletion pipeline.
3. **"On-device" / "100% local" representations** — must be reconciled with actual cloud egress first.

Everything else (LoL, warranty, AI disclaimer, AUP, account responsibility, license-to-use, billing terms) can and should be drafted and deployed immediately.

---

## 2. Document Architecture — The Layered Contract Set

Per Phase 5 §2, adopt a **layered** instrument set, not one monolith. Each layer has its own acceptance mechanism.

| Layer | Document | Applies to | Acceptance mechanism | Effort | Protection |
|---|---|---|---|---|---|
| A | **Master Terms of Service** | All products + website + account | Click-wrap at website signup | Medium | High |
| B | **Desktop EULA** (incorporated into ToS) | ShipTalk, ShipMind, ShipSpace binaries | First-run "I Agree" gate before any functional use | Medium | High |
| C | **Acceptable Use Policy (AUP)** | All, esp. ShipSpace agents | Incorporated by reference | Low | High |
| D | **AI & Third-Party Provider Addendum** | All AI features | Incorporated by reference; surfaced when enabling cloud features | Low | High |
| E | **Subscription / Billing Terms** | Pro/Team tiers | Click-wrap at Stripe checkout | Medium | High |
| F | **Privacy Policy (alignment, full draft in privacy doc)** | All + website | Linked from ToS, referenced at signup | Medium | High |
| G | **Data Processing Agreement (DPA)** | Business/Team buyers | Counter-signed / click-accepted at Team purchase | Long-term | Medium |

**Acceptance-capture requirement (Operational, Medium effort, High protection):** Record acceptance as `(timestamp, document version hash, user id / device id)` so the contract is *enforceable*. For desktop apps a first-run "I Agree" gate before any functional use materially strengthens enforceability of the EULA and liability caps (Phase 5 §2). This is the operational hinge that turns paper into an enforceable bargain — without it the disclaimers and caps are far weaker.

---

## 3. PRECONDITION — Entity Formation (Read This First)

**Category: Corporate | Effort: Medium | Protection: High | Mitigates: Liability §3.4, Exec Business Risk #2 (single-named-individual liability concentration)**

The audit flags that `OWNER_EMAILS = ['zzgemsjewelry@gmail.com']` and the personal Stripe account ("ZZ GEMZ") mean **liability attaches to a named natural person with no corporate liability shield** (Liability §3.4; Exec Business Risk #2, rated *Critical*). Every liability cap drafted below protects the *contracting entity* — if that entity is a human being, the founder's personal assets (home, savings) are the backstop for any uncapped or cap-piercing claim (GPL statutory copyright damages, gross-negligence carve-outs, consumer-law breaches).

**Recommendation:** Form an LLC (Nevada or California) *before or in parallel with* the ToS rollout, and have the new entity be the named contracting party in every document below. This is a precondition that multiplies the value of the entire contract suite.

- **Nevada vs. California note (from audit jurisdiction flags):** Nevada offers no state income tax and strong charging-order protection; **but if the founder operates from California, California will treat the LLC as "doing business" in-state and require registration + the $800 annual franchise tax regardless of where formed** — a Nevada-only shell does not avoid this. Confirm physical operating location with counsel; for a CA-resident solo founder, a California LLC is usually simpler than a foreign-Nevada-LLC-registered-in-CA.
- Re-paper the Stripe account, Apple Developer ID, domain, and provider accounts into the entity name once formed.
- Maintain corporate formalities (separate bank account, no commingling) so the veil is not pierced — otherwise the shield is illusory.

> This single action is the highest-leverage corporate protection in the blueprint: it is the difference between "the company's max exposure is the liability cap" and "the founder's house is on the line."

---

## 4. Master Terms of Service (Layer A)

**Category: Legal | Effort: Medium | Protection: High | Draft path: Counsel-reviewed (founder drafts outline, attorney finalizes)**

The ToS is the spine that incorporates all other layers. Outline the following clauses.

### 4.1 Acceptance, eligibility, authority to bind
**Mitigates:** Phase 5 §3.1 (accounts created via Supabase Auth + cli-login relay with no acceptance/age/capacity language).
- Binding-acceptance on signup and on first-run.
- Age floor: ≥18 (or ≥16 + guardian consent for GDPR; ≥13 absolute minimum under COPPA).
- Representation of authority to bind — **critical for the Team tier**, where one purchaser binds other members (`team_members`, `teams/invite`).
- Continued-use-after-changes = acceptance, with notice for material changes.

### 4.2 Description of service & "as-available"
**Mitigates:** Phase 5 §3.2; Exec Business Risk #14 (provider sprawl).
- Describe each product factually; reserve right to modify/discontinue features.
- **Do not promise availability of any third-party AI provider** — providers can be deprecated, rate-limited, or geo-blocked (DeepSeek is China-based; Perplexity/xAI may silently fail per integrations findings).
- Disclaim uptime/SLA except where contractually offered to Team customers.

### 4.3 Beta / experimental / "phantom" feature clause
**Category: Legal | Effort: Low | Protection: Medium | Mitigates:** Phase 5 §3.3; Exec Business Risk #19, #20, #21 (mock "Nano Banana", "Manus" key slot with no adapter, dead Chrome-extension ingest endpoint, OpenAI-only tool-calling, client-side LibraryGate).
- Permit beta/experimental features "as-is" with no warranty; state that not all advertised integrations are active in all builds. Blunts misrepresentation claims while features stabilize.

### 4.4 Boilerplate: governing law, dispute resolution, severability, entire-agreement, assignment, notices
**See §13 (dispute resolution) below for the detail.** Currently entirely absent (Phase 5 §3.4).

---

## 5. Desktop EULA (Layer B)

**Category: Legal | Effort: Medium | Protection: High | Draft path: Counsel-reviewed**
**Mitigates:** Liability §3.2 ("license = ''", `authors = ["you"]`); Exec Documentation Gap #1; Exec Legal Risk #2, #13 (no license of record).

The three desktop apps are signed, sold Developer-ID binaries with **no EULA and no license of record** (`Cargo.toml:6` `license = ""`; ShipMind/ShipSpace `package.json` private, no license). The EULA is incorporated into the ToS but surfaced at first run because the desktop binaries are the highest-privilege surface.

**Outline:**
- **License grant:** limited, revocable, non-exclusive, non-transferable license to install and use binaries for the licensed tier. **Licensed, not sold.** Reserve all rights (Phase 5 §7.1).
- **First-run "I Agree" gate** before any functional use (Operational dependency — see §2 acceptance capture).
- Prohibition on copying/distribution/modification beyond what law permits; no reverse engineering, decompilation, or extraction of embedded keys (Phase 5 §6 — Supabase anon key and provider-key handling are client-side).
- License terminates on EULA/IP/AUP breach.

> **Hard constraint (Phase 5 §7.3, §13; Exec Legal Risk #4):** Do **not** publish an EULA asserting full proprietary ownership of the ShipMind binary while the **GPLv2+ statically-linked ffmpeg** is bundled (`shipmind/src-tauri/tauri.conf.json:51`, built `--enable-gpl --enable-libx264 --enable-libx265`). Asserting proprietary ownership over a GPL-conveyed binary *compounds* the violation. The EULA must (a) include an open-source acknowledgment clause pointing to a shipped third-party-licenses file, and (b) not claim ownership of components the company does not own. The ffmpeg licensing decision is a precondition for the ownership assertion (handled as a Documentation/Governance item in this blueprint's licensing doc).

---

## 6. Limitation of Liability + Damages Cap (the highest-stakes clause set)

**Category: Legal | Effort: Medium | Protection: High | Draft path: Counsel-reviewed — DO NOT self-serve | Mitigates:** Liability §4, §9.2; Phase 5 §4.1; Exec Legal Risk #2, Exec Business Risk #1, #15.

This is the **single most important commercial control** and it is absent. Unlike typical SaaS, *a single agent run can irreversibly destroy a user's entire repository or read their SSH keys* (Phase 5 §4.1). Without an enforceable cap that is uncapped tort/contract exposure per incident.

**The functionality that creates the need (preserve this evidence list for counsel — it justifies an aggressive cap):**
- **ShipSpace** raw PTY shells for autonomous agents, no validation (`pty.rs` TODO(security)); allowlist gates binary name only so `node -e`/`python -c`/`npx <pkg>` = arbitrary code execution (`lib.rs:660-685`); `read_file`/`list_directory` unconfined — agent can read `~/.ssh/id_rsa` (`lib.rs:492-495, 371-429`).
- **ShipMind** deletes DB rows but orphans on-disk audio/image files forever (`lib.rs:3294-3299, 4049-4054`); home-wide readers.
- **ShipTalk** injects keystrokes into arbitrary apps via `type_text` (`lib.rs:286-444`) — wrong-target paste can leak a dictated password.
- **AI output** can hallucinate and instruct destructive actions; prompt-injection via untrusted GitHub issues / web pages.

**Cap structure to draft:**
- Aggregate liability capped at the **greater of (a) amounts paid in the trailing 12 months or (b) a small fixed floor (e.g., US$100)**.
- **Exclude all indirect, incidental, consequential, special, exemplary, punitive damages** — expressly including lost data, lost code, corrupted/deleted files, lost profits, business interruption, cost of substitute services.
- **Specifically enumerate** that the cap covers damages from: (i) AI/agent actions incl. code execution, file modification/deletion; (ii) keystroke injection / paste into the wrong app; (iii) incomplete deletion leaving data on disk; (iv) third-party AI provider conduct/outages; (v) loss of API keys or session tokens. (Specific enumeration matters because the `TODO(security)` comment is documentary evidence the founder *knew* of the risk — Liability §4.1 — so the cap must be conspicuous and specific to survive an unconscionability / failure-of-essential-purpose attack.)
- **Failure-of-essential-purpose survival clause.**
- Carve out only what law forbids excluding (death/personal injury from negligence, fraud, gross negligence in some jurisdictions, non-waivable statutory consumer rights), with a "to the maximum extent permitted by law" qualifier.

> **Why counsel, not template:** California courts scrutinize LoL clauses against unconscionability (esp. consumer adhesion contracts) and Civil Code §1668 (cannot exempt fraud/willful injury/gross negligence). The `TODO(security)` admission raises the willfulness question. A boilerplate cap may be struck where a properly drafted, conspicuous, specifically-enumerated one survives. This is the wrong place to economize.

---

## 7. Warranty Disclaimer ("AS IS / AS AVAILABLE")

**Category: Legal | Effort: Low | Protection: High | Draft path: Counsel-reviewed | Mitigates:** Phase 5 §4.2; Liability §9.2; Exec Legal Risk #2.

Paid software + no disclaimer = implied-warranty (merchantability/fitness) exposure under UCC/consumer law; an agent destroying a customer's work is a foreseeable breach (Liability §9.2).

**Outline:**
- Full disclaimer of implied warranties: merchantability, fitness for a particular purpose, title, non-infringement.
- "AS IS / AS AVAILABLE."
- No warranty that output is accurate, complete, lawful, or fit for any decision; no warranty of error-free/uninterrupted operation.
- **Conspicuous formatting** (caps/bold) — UCC §2-316 requires conspicuousness to disclaim merchantability.
- Jurisdictional savings clause: some implied warranties cannot be waived for consumers (EU/UK, some US states) — include "to the maximum extent permitted by law" + consumer-rights savings language.

---

## 8. AI-Output Disclaimer (no-reliance / human-in-the-loop / hallucination + agent-action waiver)

**Category: Legal | Effort: Low | Protection: High | Draft path: Counsel-reviewed | Mitigates:** Phase 5 §5; Exec Legal Risk #3 (rated *Critical*); Liability §4.

Every product produces or *acts on* AI output (ShipTalk Claude "polish" `polish.ts`; ShipMind chat-over-corpus across 8 providers; ShipSpace autonomous agents executing code; website chat proxy). A dedicated AI section is non-optional.

**Outline (six pillars):**
1. **No accuracy/reliability warranty.** Output may be inaccurate, incomplete, biased, offensive, or "hallucinated"; STT may mis-transcribe; "polish" may alter meaning. Not to be relied on for legal, medical, financial, safety-critical decisions without independent human verification.
2. **Human-in-the-loop responsibility.** User must review AI suggestions, agent actions, and generated code *before* executing/relying. Tie to ShipSpace's permission model — **auto-approval / `acceptEdits` modes shift risk to the user who enables them** (Phase 5 §5.2).
3. **No professional advice.** Output is not legal, medical, financial, or professional advice.
4. **Prompt-injection / untrusted-content warning + agent-action waiver.** Agents may ingest untrusted third-party content (GitHub issues, web pages, MCP data) that can influence behavior; user accepts this risk and waives claims arising from agent actions taken on the user's machine when the user grants agents access to such sources.
5. **Output ownership & responsibility.** User owns inputs/outputs to the extent the underlying provider's terms permit, *but* is responsible for ensuring outputs do not infringe third-party rights and for the legality of their use.
6. **No exclusivity.** AI may produce identical/similar output for others; no uniqueness/non-infringement guarantee.

---

## 9. Acceptable Use Policy (Layer C) — referenced + enforced

**Category: Policy | Effort: Low | Protection: High | Draft path: Founder-drafted, counsel quick-review | Mitigates:** Phase 5 §6; Liability §6 (note on yt-dlp contributory liability); Exec Legal Risk #10.

ShipSpace's arbitrary code execution + autonomous agents + cross-app keystroke injection + browser automation make a strong AUP essential — both to permit termination and to disclaim liability for misuse.

**Prohibit the user from using the products to:**
- Run code/agents/automations that violate law, infringe IP, or harm others' systems (anti-malware/anti-exfiltration — products *can* read `~/.ssh`, `~/.aws`, browser cookie stores via unconfined readers).
- Access/modify/delete files, accounts, or systems the user is not authorized to access.
- **Circumvent licensing/tier controls — including tampering with client-side tier gating.** Tier is "trivially spoofable" (`owner.ts:1`); the AUP must make **spoofing a paid tier a contractual breach** even though it is not technically enforced (Phase 5 §6; Exec Business Risk #4). This converts a monetization weakness into an enforceable contract term.
- Record/process content the user is not lawfully permitted to (third-party recording without consent).
- Reverse engineer, decompile, or extract embedded keys.
- Resell, sublicense, or provide the product as a service without authorization.
- Violate any third-party AI provider's terms or generate content prohibited under those policies.
- Abuse rate limits or attempt account-takeover (forbid exploiting the `cli-login` token relay and unauthenticated localhost MCP/orchestrator surfaces).
- **Use bundled tooling (e.g., yt-dlp) to download content in violation of any site's terms** — addresses the contributory/secondary-liability exposure flagged in Liability §6 (yt-dlp bundled in ShipMind/ShipSpace).

**Enforcement hooks:** express right to suspend/terminate for AUP breach; user indemnifies company for AUP violations (see §14).

### 9.1 Consent-to-record / wiretap clause
**Category: Policy | Effort: Low | Protection: Medium | Mitigates:** Phase 5 §6.1; Liability §5.4; Exec Legal Risk #22; Exec Compliance Gap #12 (two-party-consent statute exposure — relevant to **California Penal Code §632**).
- User represents they have all rights/consents to record and process captured audio, including consent of other parties in **two-party-consent jurisdictions (California is one)**, and assumes liability for unlawful recording. Covers ShipTalk mic capture and ShipSpace OpenAI Realtime voice.

---

## 10. AI & Third-Party Provider Addendum + Sub-Processor Acknowledgment (Layer D)

**Category: Legal | Effort: Low | Protection: High | Draft path: Founder-drafted, counsel quick-review | Mitigates:** Phase 5 §10; Liability §3.1, §5.6; Exec Legal Risk #6, #7; Exec Privacy Risk #5, #8, #9.

ToS-side hooks (full privacy policy is a separate doc — see §11):
- **Sub-processor acknowledgment:** user acknowledges enabling cloud/AI features transmits content to third-party processors (Anthropic, OpenAI, Google, Groq, **DeepSeek (China)**, Perplexity, xAI, Supabase, Printful, Hugging Face). The addendum references a maintained sub-processor list. **DeepSeek and Apple speech servers are currently undisclosed and must be named** (Phase 5 §10; Exec Legal Risk #6).
- **BYO-key flow clarity:** for BYO-key flows the company does not store content server-side (true for website chat per `usage-log.ts`), but third-party providers process under their own terms — and the user is bound by each provider's terms.

> **Hard constraint:** the addendum / privacy policy must not omit DeepSeek (China) — undisclosed international transfer is a GDPR Chapter V violation (Exec Compliance Gap #3). This is a disclosure obligation, not a code fix; name the sub-processor.

---

## 11. Privacy Policy Alignment (Layer F)

**Category: Legal | Effort: Medium | Protection: High | Draft path: Counsel-reviewed | Mitigates:** Phase 5 §10; Liability §3.1; Exec Privacy Risk #9, #10, #11; Exec Documentation Gap #2, #10, #11.

> Full privacy-policy drafting belongs to this blueprint's dedicated privacy/data document. Here are the **ToS-alignment hooks** and the three honesty constraints that must hold across both.

- **Truth-in-labeling fix (consumer-protection):** "100% on-device" is contradicted by cloud egress (self-flagged `Cargo.toml:28`). Reconcile — either qualify ("on-device by default; cloud features optional and clearly gated") or stop making the claim. An overbroad on-device claim is FTC §5 / UDAP / UCPD exposure, *aggravated by the in-code admission of knowledge* (Liability §8.1; Exec Legal Risk #5). **Marketing/Documentation action, not code.**
- **Erasure-rights honesty:** the website promises access/export/delete but **no deletion code path exists** and ShipMind/ShipTalk deletion is broken/incomplete. **Do not publish a ToS/privacy policy guaranteeing erasure until the pipeline exists** — either scope the promise to what is delivered, or build the pipeline first (Phase 5 §10; Exec Privacy Risk #1). Until then, the privacy policy must describe the *manual* process honestly.
- **Retention statement:** disclose that local data (transcripts, scrollback, chat, audio) persists indefinitely on the user's device unless manually removed, and the company does not control device-local retention.
- **Correct the inaccurate sub-processor list:** website lists Sentry/Groq/OpenRouter/Ollama that are NOT in code and omits DeepSeek that IS — fix both directions (Exec Privacy Risk #9). Documentation action.

---

## 12. DPA Template for Business Buyers (Layer G)

**Category: Legal | Effort: Long-term | Protection: Medium | Draft path: Counsel-reviewed (use a standard DPA template, e.g., the IAPP/SCC-annexed form) | Mitigates:** Liability §9.1; Exec Business Risk #23; Exec Compliance Gap #9.

Without a DPA the company **cannot lawfully act as a processor for any Team/business customer that itself has GDPR obligations** — this is a hard B2B sales blocker (Liability §9.1).

**Outline:**
- Controller/processor roles, processing scope, data categories, retention/return/deletion on termination.
- Sub-processor list + change-notice (ties to §10) including the EU SCCs / UK IDTA for transfers (DeepSeek China is the salient one).
- Security measures (reference, do not over-promise — the audit notes unencrypted-at-rest storage; describe actual measures).
- Audit/assistance, breach-notification cooperation (ties to the incident-response runbook in this blueprint's operational doc).

**Why Long-term / Medium:** depends on a maintained sub-processor inventory and a real deletion/return capability to be truthful; lower immediate priority than the consumer-facing instruments because there are not yet GDPR-bound B2B customers. Have a *template ready* so a Team deal is not blocked, but it is not the first thing to ship.

---

## 13. Account-Responsibility & BYO-API-Key / Billing-Responsibility Language

**Category: Legal | Effort: Low | Protection: High | Draft path: Founder-drafted, counsel quick-review | Mitigates:** Phase 5 §8; Liability §9.3; Exec Business Risk #15.

Functionality: BYO provider keys travel directly to providers; session tokens relayed to a localhost port (`cli-login`); tier client-trusted; Team tier shares access.

**Outline:**
- User safeguards account credentials, **their own provider API keys**, and tokens; company not liable for unauthorized access from the user's failure to secure these or from the user's local environment (keys/tokens/transcripts sit in plaintext readable by local processes).
- User responsible for all activity under their account and **for all third-party AI provider charges incurred on their keys** — the BYO model means the company does not control or reimburse provider billing. (Directly mitigates "disputes over runaway provider spend land on the owner" — Exec Business Risk #15.)
- **Team tier:** account owner responsible for members' compliance and invite/removal management (`teams/invite`).
- Prompt-reporting-of-compromise duty; company may suspend to protect the service/other users.

---

## 14. Subscription, Billing & Refund Terms (Layer E) — *includes the price-discrepancy fix*

**Category: Legal | Effort: Medium | Protection: High | Draft path: Counsel-reviewed | Mitigates:** Phase 5 §9; Liability §8.6; Exec Business Risk #8, #10; Exec Documentation Gap #15.

Functionality: Stripe-hosted checkout, **live $50/$500 subscription tiers**, comp-access grants with **no auto-expiry** (manual revoke only), tier from Stripe `metadata.plan`.

**Outline:**
- **Auto-renewal disclosure + easy cancellation mechanics** — required by US auto-renewal laws (**California ARL**), FTC "Click-to-Cancel"/ROSCA, and EU consumer law (Liability §8.6).
- **Refund policy** — express no-refund-except-where-required, with the **EU/UK 14-day withdrawal-right** carve-out for consumers.
- Price-change notice terms.
- Comp/complimentary access is **discretionary and revocable at any time** (matches the manual-revoke reality — Exec Business Risk #8; addresses "no auto-expiry" by making it a disclosed term rather than an obligation).
- BYO-key AI usage costs are **not** part of the subscription and are billed by the provider directly.
- Downgrade/termination effect on data access.

### 14.1 PRICE-DISCREPANCY REMEDIATION — consumer-protection exposure
**Category: Documentation/Operational | Effort: Low | Protection: High | Mitigates:** Exec Business Risk #10; Exec Documentation Gap #15 ("Draft ShipMind pricing ($20/$40) diverges from live Stripe ($50/$500)").

There is a **material gap between draft/displayed ShipMind pricing ($20/$40) and the live Stripe charge ($50/$500)**. A displayed price that does not match the charged price is **classic deceptive-pricing / bait-and-switch exposure** (FTC §5, California UCL/CLRA/FAL — California is aggressive on pricing-display claims).

**Actions (non-code, documentation/operations):**
1. **Audit every surface** where a price appears (website, in-app, PDFs, marketing collateral, the legacy "Private" PDFs at repo root flagged in Exec Business Risk #22) and **reconcile them all to the single live Stripe price** before any further sale.
2. Establish a **single source of truth for pricing** and a change-control rule that no price is displayed anywhere unless it equals the live Stripe price.
3. Retire/re-issue the legacy "Private" PDFs that may carry the stale $20/$40 figures.
4. Ensure the price, billing interval, and auto-renewal are **conspicuously disclosed at point of sale** (Stripe checkout) per California ARL "clear and conspicuous" requirements.

> This is *Low effort, High protection*: it is a copy-reconciliation exercise, but it closes a live consumer-protection and chargeback/refund-class exposure.

---

## 15. Dispute Resolution, Arbitration & Governing Law

**Category: Legal | Effort: Low–Medium | Protection: Medium | Draft path: Counsel-reviewed | Mitigates:** Phase 5 §3.4; Liability §3.2; Exec Legal Risk #2 (boilerplate absent).

**Outline:**
- **Governing law / venue:** pick a US state aligned with the entity's formation (see §3 — likely California if the founder operates there; Nevada if genuinely Nevada-based).
- **Binding arbitration** (e.g., AAA consumer rules) with a **small-claims carve-out** and a **consumer opt-out window** (30 days) — improves enforceability under California/9th-Circuit scrutiny of consumer arbitration clauses.
- **Class-action waiver** (paired with arbitration; note California *McGill* rule — public-injunctive-relief claims may not be waivable, so include a savings/severability clause).
- Severability; entire-agreement; assignment (company may assign, user may not); electronic-notice mechanism.

> Counsel must tune the arbitration/class-waiver to the chosen jurisdiction — California has specific limits (McGill, unconscionability doctrine) that a generic clause can trip on. Effort is Low to draft an outline but Medium because jurisdiction-tuning is required.

---

## 16. Indemnification, Termination, Survival

**Category: Legal | Effort: Low | Protection: Medium | Draft path: Counsel-reviewed | Mitigates:** Phase 5 §11; Liability §6 (user-misuse); Exec Legal Risk #10.

- **User indemnity:** user indemnifies company against claims from the user's content, use of agents/automation/code-execution, AUP violations, unlawful recording, IP infringement in user inputs/outputs, and misuse of third-party providers.
- **Termination:** either party may terminate; company may terminate immediately for AUP/IP breach; EULA license terminates; effect on data stated.
- **Survival:** LoL, warranty disclaimer, IP, indemnity, AI disclaimers, and dispute terms survive termination.

---

## 17. IP Hooks in the ToS (license-to-use, user-content, feedback, trademark)

**Category: Legal | Effort: Low–Medium | Protection: Medium–High | Draft path: Counsel-reviewed | Mitigates:** Phase 5 §7; Liability §7; Exec Legal Risk #4, #8.

- **Company IP / license grant** (covered in EULA §5): licensed-not-sold, limited/revocable/non-transferable. **High** protection.
- **User-content license:** user retains ownership; grants company a limited license to process content *solely to provide the service* (transient). **Do not claim training rights you do not exercise** (Phase 5 §7.2). **Medium.**
- **Open-source acknowledgment clause:** point to a shipped third-party-licenses/NOTICE file; do not assert ownership of components the company does not own (Phase 5 §7.3). **High** — but gated by the GPL-ffmpeg licensing decision (precondition, handled in the licensing doc). **Long-term** on the dependency, **Low** on the clause text itself.
- **Feedback license:** perpetual royalty-free license to use feedback/suggestions. **Low** effort, **Low** protection.
- **Trademark:** reserve "Ship*" / "MakeShipHappen" marks; no trademark license to users (Phase 5 §7.4). Pair with a **trademark clearance/registration** action (advisory — Liability §7.5) handled in this blueprint's corporate/IP doc.

---

## 18. Sequenced Roadmap (highest protection / lowest effort first)

### Tier 1 — Do before the next paid sale (immediate)
| Order | Item | Effort | Protection | Why first |
|---|---|---|---|---|
| 1 | **Entity formation (LLC)** + re-paper Stripe/Apple/domain | Medium | High | Makes every cap below protect the *company*, not the founder personally |
| 2 | **Reconcile the $20/$40 vs $50/$500 price discrepancy** across all surfaces | Low | High | Live deceptive-pricing exposure; pure copy/ops fix |
| 3 | **Acceptance-capture mechanism** (timestamp/version/user) + first-run "I Agree" gate | Medium | High | Without it the whole suite is weakly enforceable |
| 4 | **AUP** (incl. anti-tier-spoof, anti-exfiltration, yt-dlp, consent-to-record) | Low | High | Founder-draftable; disclaims the highest-misuse surface |
| 5 | **AI-Output Disclaimer** (6 pillars + agent-action waiver) | Low | High | Critical-rated; covers hallucination/agent-destruction |
| 6 | **AI & Third-Party Provider Addendum** + sub-processor acknowledgment (name DeepSeek/Apple) | Low | High | Cheap disclosure; closes UDAP/GDPR-transfer gap |
| 7 | **Account-responsibility / BYO-key billing-responsibility** language | Low | High | Shifts runaway-provider-spend disputes off the founder |

### Tier 2 — Within weeks (counsel-led drafting pass)
| Order | Item | Effort | Protection |
|---|---|---|---|
| 8 | **Limitation of Liability + damages cap** (counsel-drafted, enumerated) | Medium | High |
| 9 | **Warranty Disclaimer** (AS-IS, conspicuous) | Low | High |
| 10 | **Master ToS** (acceptance/eligibility/authority, as-available, beta-feature, boilerplate) | Medium | High |
| 11 | **Desktop EULA** (license-not-sold; ownership assertion gated on ffmpeg) | Medium | High |
| 12 | **Subscription/Billing/Refund terms** (auto-renewal, ARL, 14-day EU, comp-revocable) | Medium | High |
| 13 | **Privacy Policy alignment** (truth-in-labeling, honest erasure scope, retention, fix sub-processor list) | Medium | High |
| 14 | **Dispute resolution / arbitration / governing law** (CA-tuned) | Low–Medium | Medium |
| 15 | **Indemnification / termination / survival** | Low | Medium |
| 16 | **IP hooks** (user-content license, feedback, trademark reservation, OSS acknowledgment clause) | Low–Medium | Medium–High |

### Tier 3 — Preconditioned / longer-term
| Order | Item | Effort | Protection | Precondition |
|---|---|---|---|---|
| 17 | **DPA template** for business buyers | Long-term | Medium | Sub-processor inventory + truthful deletion/return |
| 18 | **Proprietary-ownership assertion** in EULA | Low (clause) / Long-term (dependency) | High | GPL-ffmpeg licensing decision resolved |
| 19 | **Data-erasure promise** in ToS/privacy | Low (clause) | High | Deletion pipeline built or promise scoped to reality |

---

## 19. Founder Checklist

- [ ] Engage a licensed attorney (CA/NV) for the counsel-reviewed items; do **not** self-serve the LoL cap or arbitration clause.
- [ ] Form the LLC and make it the named party in every document.
- [ ] Reconcile all displayed prices to the single live Stripe price; retire stale $20/$40 collateral and legacy "Private" PDFs.
- [ ] Stand up acceptance capture (timestamp + version hash + user/device id) and a first-run "I Agree" gate before any further paid release.
- [ ] Draft + ship: AUP, AI-Output Disclaimer, Provider Addendum (naming DeepSeek + Apple), Account-Responsibility/BYO-key terms.
- [ ] Counsel-finalize: LoL cap, Warranty Disclaimer, Master ToS, Desktop EULA, Billing terms, Dispute/arbitration, Indemnity/survival, IP hooks.
- [ ] Align the Privacy Policy: qualify/retire "100% on-device," scope or defer the erasure promise, add retention statement, correct the sub-processor list.
- [ ] Hold three preconditioned items (proprietary-ownership assertion, erasure promise, on-device claim) until the underlying engineering/licensing is resolved.
- [ ] Keep a DPA template ready so a Team/B2B deal is not blocked.

---

*This document is internal risk-management guidance and clause-outline scoping for the founder's use. It is not legal advice and must be supplemented by formal advice from licensed counsel in the operating and target jurisdictions before any instrument is published.*
