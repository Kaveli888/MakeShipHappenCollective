# 16 — Marketing/Claims Review & Prior-Audit Reconciliation

**Auditor role:** Independent marketing-compliance & governance auditor (FTC advertising-substantiation + prior-audit reconciliation).
**Date:** 2026-06-07
**Scope root:** `/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/`
**Constraint:** Read-only. No code changed. This report is the only file written.

Exposure-type legend used in Task A:
- **(a) Privacy/security** — must be *literally* true; false → FTC Act §5 + state UDAP (deception), breach-of-privacy-promise.
- **(b) Performance/results** — needs substantiation (FTC substantiation doctrine — must hold competent/reliable evidence *before* the claim runs).
- **(c) Pricing/billing** — ROSCA / Restore Online Shoppers' Confidence Act, auto-renewal "negative option" rules, FTC Click-to-Cancel, state auto-renewal laws (CA/NY).
- **(d) Comparative** — Lanham Act §43(a) false-advertising + trademark nominative-fair-use limits when naming competitors.
- **(e) AI-capability/guarantee** — substantiation + FTC "AI claims" guidance + disclaimer adequacy.

---

# TASK A — Marketing / Claims Review

## A.1 Highest-risk claims (verbatim, with file + line)

| # | Claim (verbatim) | File | Type | Exposure |
|---|---|---|---|---|
| A1 | "ShipMind is a private AI workspace that reads, searches, and reasons across your documents **without sending a single byte to the cloud**." | `docs/shipmind-product-copy.md:13` | a | **Absolute** privacy claim. Literally false the moment a user enables cloud chat (the same doc, line 32/62, says prompt text + source chunks DO leave for OpenAI/Anthropic/Groq). "Not a single byte" is unqualified and self-contradicted. FTC §5 deception. **Strike "without sending a single byte" or qualify to "by default / in local mode."** |
| A2 | "**Your documents never leave your Mac.**" / "Drop sensitive files in. **They stay in.**" | `docs/shipmind-product-copy.md:44,52` | a | Unqualified. True only in local-embedding/local-LLM path; cloud chat sends source *chunks*. Needs "by default" + the cloud-opt-in carve-out adjacent to the claim, not paragraphs away. |
| A3 | "Your data never leaves your machine, **period.**" (Fully Offline Capable) | `app/products/shiptalk/v3/page.tsx:1277` | a | ShipTalk also offers a **cloud mode** (line 2991: "Cloud supports 99+ languages"; 2990: "Cloud mode encrypts over HTTPS"). "Never leaves… period" is contradicted on the same page. Classic FTC deception (absolute claim + buried contradiction). |
| A4 | "**No recordings are stored, uploaded, or analyzed externally.**" | `app/products/shiptalk/v3/page.tsx:1291` | a | Verifiable factual claim about data handling — must be provably true for **all** modes incl. cloud transcription. If cloud STT uploads audio, this is false. Highest-liability privacy promise on the site. |
| A5 | "ShipMind is designed so privileged, **FERPA-protected, or regulated data never leaves the device** by default." | `app/v3/shipmind/sections/*` (Hero/Trust FAQ, line 17) | a/e | Invokes **FERPA** (and elsewhere implies HIPAA-grade). Regulatory-grade privacy claim. "by default" qualifier present (good) but pairing a named statute with "regulated data" invites a substantiation demand; the app is **not** certified/audited for FERPA/HIPAA. |
| A6 | "100% — On-device option — **No vendor leaks**" | `app/page.tsx:2956` | a | "No vendor leaks" is an absolute security guarantee. No product can guarantee zero leaks. Reframe as "no vendor sees your sources in local mode." |
| A7 | "**<500ms Latency** … End-to-end transcription in under half a second. **Faster than typing.**" | `app/products/shiptalk/v3/page.tsx:2989` | b | Hard quantified performance claim ("<500ms", "faster than typing"). Needs benchmark substantiation on stated hardware; varies by machine/model. No test conditions disclosed. |
| A8 | "ShipMind pairs **sub-second inference on Groq** with sources that **never leave your disk**." | `app/v3/shipmind/sections/SpeedBand.tsx:52` | a+b | Compound: (b) "sub-second" perf claim + (a) "never leave your disk" — but using Groq sends source *chunks* off-disk (contradicts itself within one sentence per the product-copy doc's own description). |
| A9 | Comparison table marking **NotebookLM** and **ChatGPT / Claude** with "✗ / no" across Local-first storage, Local AI, BYO keys, Cited answers, etc. | `app/v3/shipmind/sections/TrustBand.tsx:31-40`; `shipmind-product-page-mockup.html:437`; `shipmind-product-page-mockup-v2-editorial.html:606` | d | **Comparative advertising naming named competitors + trademarks.** Lanham §43(a): every "✗" must be literally true and current. NotebookLM *does* do cited answers and audio; marking competitor capabilities as absent where they exist = actionable false comparative advertising. The mockup itself carries a self-warning at `shipmind-product-page-mockup.html:456`: *"Verify each '×' before launching live — claims about competitors should be defensible."* — heed it. |
| A10 | "ShipMind … private **NotebookLM alternative**" | `AGENTS.md:34` (internal positioning; surfaces in product copy framing) | d | Positioning as a named-competitor "alternative" is generally permissible nominative use, but anchors the whole comparative table's accuracy burden. |
| A11 | "Membership at **$50/month** … Subscriptions **auto-renew until you cancel** … **Cancel at any time**." | `app/terms/page.tsx:74-78`; `app/pricing/page.tsx:151,216,290`; `app/v3/shipmind/sections/PricingTeaser.tsx:150,160` | c | Auto-renewing subscription → **ROSCA / negative-option** rules require: clear up-front disclosure of recurring charge + amount + cadence, affirmative consent, and a simple cancel mechanism. "Cancel anytime from account settings" is asserted — must actually work (FTC Click-to-Cancel). Otherwise OK if the cancel path exists. |
| A12 | "**All sales are final.** … we generally **do not issue refunds**." | `app/terms/page.tsx:96-98` | c | A strict no-refund policy is lawful **only if conspicuously disclosed pre-purchase**. It is in the Terms but is it shown at checkout? If not, deceptive. Also some state auto-renewal laws require an easy cancel + sometimes a refund/grace mechanism. |
| A13 | "Contributor pricing. **It won't stay here forever.**" / "you're getting in early" | `app/pricing/page.tsx:32` | c/b | Urgency/scarcity claim. Mild risk: if the price never actually rises, "won't stay here forever" can be challenged as a fake-urgency deceptive practice (FTC has acted on perpetual "limited time" pricing). |
| A14 | "Cloud mode **encrypts over HTTPS**." | `app/products/shiptalk/v3/page.tsx:2990` | a | Encryption-in-transit claim — must be true (it is, if HTTPS). Fine, but note it does NOT mean "private" — pairing it with "Privacy-First" header risks implying end-to-end/at-rest privacy it doesn't provide. |
| A15 | "Local mode keeps audio **on-device**." / "powered by **on-device AI**" / "100% on-device" | `app/products/shiptalk/v3/page.tsx:1400,2990`; many | a | Repeated "on-device / 100% on-device" — true for local Whisper path; becomes misleading whenever the surrounding section also sells the cloud path without a clear mode boundary. |
| A16 | "Your material, your keys, your codebase. **Private by default.**" | `app/page.tsx:116,2341` | a | "Private by default" is a defensible *qualified* claim (good model — contrast with the absolutes above). Lower risk. |
| A17 | Pricing mismatch: product-copy doc advertises **Free $0 / Pro $20 / Team $40**; live site sells a **single $50/mo** membership. | `docs/shipmind-product-copy.md:84-110` vs `app/pricing/page.tsx:151` & `app/terms/page.tsx:74` | c | The $20/$40 copy is flagged internally as placeholder ("flag with Jake before launch", doc line 145). **Risk only if the $20/$40 page ships** alongside the $50 reality — two live prices = deceptive pricing. Confirm only the $50 page is public. |
| A18 | "AI-generated output may be inaccurate… You are solely responsible… **Do not use ShipCode-generated code in safety-critical systems**." | `app/terms/page.tsx:162-167` | e | This is a **good** disclaimer that offsets AI-capability over-promises. Keep. Ensure equivalent disclaimer is reachable from ShipMind's "cited answers / grounded" claims (AI citations can hallucinate). |

## A.2 Brand assets
`MSH Logo/` (29 files) and `light copy 2.png`, `ShipMind_Private_Intelligence.pdf`, `ShipMind_Private_Second_Brain.pdf` exist as brand collateral. The PDF filenames themselves assert "Private" — same privacy-claim discipline applies to their contents (not read here; flag for review). No trademark registration evidence found in repo for "MakeShipHappen" / "ShipMind" / "Ship*" family.

## A.3 Systemic pattern (the core marketing-compliance finding)
The recurring failure mode is **absolute privacy language** ("never leaves… period", "not a single byte", "no vendor leaks", "no recordings… uploaded") placed on the **same page/section** that also sells a **cloud/Groq/OpenAI opt-in path** which, by the product's own description, *does* transmit prompt text + source chunks + (for cloud STT) audio. The fix pattern is uniform: scope every absolute to "in local mode / by default," and put the cloud carve-out *adjacent* to the claim, not paragraphs/sections away. The well-formed counter-examples already in the copy ("Private by default", the ShipCode AI disclaimer) show the team knows how to do this — it just isn't applied consistently.

---

# TASK B — Prior Security/Governance Doc Reconciliation

## B.1 Consolidated prior-findings status

| Doc | Date | Risk | Findings | Fixed | Open / Outstanding |
|---|---|---|---|---|---|
| `ShipTalk/SECURITY_AUDIT_REPORT.md` | 2026-02-23 | Medium | 0C / 3H / 5M / 3L | None marked fixed in-doc (recommendations only) | **All open as of doc:** H-1 mock auth (any password works, `AuthView.tsx:21`), H-2 CSP `null` (`tauri.conf.json:38`), H-3 SpeechRecognition re-render stop; M-1..M-5 (non-crypto IDs, timeout leak, no audit logging, no GDPR delete/export, raw error exposure); L-1..L-3. Status not reconciled elsewhere — **needs re-verification against current ShipTalk source.** |
| `makeshiphappenAi/SECURITY_AUDIT_REPORT.md` | 2026-05-08 | Medium→Low | 1C / 4H / 6M / 5L | Per the later deep-dive: security headers, OAuth open-redirect, SITE_PASSWORD removal, RLS migrations 007-009 — **DONE.** | Superseded by the 2026-05-31 deep-dive (below). Original Critical = "no security headers" → now fixed. |
| `makeshiphappenAi/SECURITY_DEEPDIVE_2026-05-31.md` | 2026-05-31 | **Critical (conditional)** | C-1, C-2, H-1, H-2, H-3, M-1..M-5 | Headers, OAuth redirect, RLS 007-009, site-password gate, webhook sig — solid/fixed. | **C-1 owner-bypass:** fix commit `ebe5613` was on `audit/launch-fixes`, NOT main at time of writing. **Per MEMORY.md, C-1 was FIXED+pushed 2026-06-06 (commit `00a4a2d`, adds `email_confirmed_at`).** **STILL OPEN per memory:** C-2 (merch charged-but-not-fulfilled), H-1 (team-invite trigger no email-confirm check), H-2 (Google API key in URL query string), H-3 (rotate live secrets), M-1..M-5. Pre-launch gate: **verify Supabase "Confirm email" = ON.** |
| `makeshiphappenAi/LAUNCH_ROTATION_CHECKLIST.md` | n/d | n/a (runbook) | Credential-rotation runbook; no findings | n/a | **Action items pending:** rotate Stripe `sk_live`, Supabase service-role, Printful keys; apply migration `009`; confirm RLS; set Vercel prod env. No secrets in file (good). |
| `shipmind/SECURITY_AUDIT_REPORT.md` | 2026-06-06 (supersedes 05-31) | Low–Medium | 0C / 2H / ~5M / several L | **Landed 2026-06-06:** H1 file-read allowlist+cap, H1 sensitive-path deny-list, H2 `stream://` allowlist, M1 git-config RCE hardening, M2/M3 SSRF (`validate_public_http_url`), Mermaid `strict`. | **Open:** M4 (agent tool args not zod-validated), M5 (`fs` write scope still `$HOME/**`), L1 (tool-loop unimplemented on 4/7 providers → "grounded in checked sources" guarantee silently false on Anthropic/Groq/Google/DeepSeek — **also a marketing-claim integrity issue, see A18**), L3/L4/L5, npm-audit hygiene. Out-of-band: confirm Supabase RLS ON. |
| `AGENTS.md` | 2026-05-25 | n/a (project context) | No security findings | n/a | Contains positioning ("private NotebookLM alternative", "fully offline-capable") that **seeds the marketing claims** in Task A. Also lists owner/personal emails + betting-collaborator PII — not a public file, keep out of any published bundle. |
| `ship-it-guidelines/README.md` + `CLAUDE.md` | n/d | n/a (coding philosophy) | No findings | n/a | "Ship It / vibe coding" guidelines explicitly **de-prioritize defensive caution** vs Karpathy. Governance note: a "build bold" culture + paying users + privacy claims = elevated need for the compliance controls in Task C. Licensed MIT (in README), but no LICENSE file present. |
| `ShipSpace/VOICE_REVIEW_PROMPT_FOR_CLAUDE.md` | n/d | n/a (debug prompt) | No findings | n/a | Confirms ShipSpace voice path routes audio to **OpenAI** transcription/TTS (`gpt-4o-mini-transcribe`) — relevant to any "on-device/private" claim made about ShipSpace voice. |

## B.2 Governance-doc presence/absence (grep over repo, excl. node_modules/build artifacts)

| Document | Status | Evidence |
|---|---|---|
| Terms of Service | **PRESENT** | `makeshiphappenAi/app/terms/page.tsx` (self-labeled "Not legal advice… consult a lawyer") |
| Privacy Policy | **PRESENT** | `makeshiphappenAi/app/privacy/page.tsx` (+ `app/privacy/shipmind-extension/page.tsx`); self-labeled "Not legal advice" |
| Data-retention policy | **PARTIAL** | Stated inside Privacy Policy ("delete within 90 days; billing kept ~7 yrs") — no standalone policy |
| Refund policy | **PRESENT** | Inside Terms §5 ("All sales are final") |
| LICENSE file(s) | **ABSENT** | No `LICENSE` anywhere outside node_modules/`whisper.cpp` build output. README + ship-it-guidelines *say* "MIT" but ship **no LICENSE file** — license assertion without the text. Per-product licenses absent. |
| `SECURITY.md` (vuln-disclosure policy) | **ABSENT** | No `SECURITY.md`; the `SECURITY_AUDIT_REPORT.md` files are internal audits, not a public disclosure policy |
| Incident-response plan | **ABSENT** (repo) | Only `Prompts/Agents/Incident Management Agent.txt` (a generic agent prompt, not a plan for this business) |
| `CONTRIBUTING.md` | **ABSENT** | Not found |
| Code of Conduct | **ABSENT** | Not found |
| DPA (Data Processing Agreement) | **ABSENT** | None — yet site processes user data via Stripe/Supabase/Sentry/Vercel sub-processors and makes regulated-data (FERPA) claims |
| Sub-processor list | **PARTIAL** | Privacy Policy "Third Parties" lists Stripe/Supabase/Sentry/Vercel/AI providers — informal, not a maintained sub-processor register |
| Cookie policy | **PARTIAL** | One paragraph in Privacy Policy ("session cookies only, no tracking") |
| AUP (Acceptable Use) | **PRESENT** | Terms §6 |
| Accessibility statement | **ABSENT** | Not found (lighthouse-reports exist but no published statement) |
| Children's/COPPA handling | **PARTIAL/INCONSISTENT** | Privacy says "not for children under 13"; Terms §3 says "must be 18+." **Inconsistent minimum-age** (13 vs 18) — fix. |

---

# TASK C — Documentation-Gap Inventory (what a commercial AI SaaS + desktop ecosystem with paying users SHOULD have but appears ABSENT)

Ordered by priority for a paid, privacy-marketed, multi-app ecosystem:

1. **LICENSE files (per product).** README and ship-it-guidelines *claim* MIT but ship no `LICENSE` text. Desktop apps (ShipMind/ShipTalk/ShipSpace/ShipCode) and the public repo each need an explicit license. Highest-confidence gap — a stated license with no license file is legally ambiguous. *(ABSENT)*

2. **`SECURITY.md` / coordinated vulnerability-disclosure policy.** A security contact + safe-harbor for researchers. The repo has internal audits but no public "how to report a vuln" path. *(ABSENT)*

3. **Incident-response & breach-notification plan.** Required in practice once you hold user accounts + payment relationships; many state breach laws (and GDPR Art. 33/34) impose notification timelines. No business-specific plan exists. *(ABSENT)*

4. **DPA + maintained sub-processor register.** You are a data controller using Stripe/Supabase/Sentry/Vercel/AI-provider processors, and you market to "law firms, healthcare teams, finance, government contractors" (`docs/shipmind-product-copy.md:68`). Those buyers will demand a DPA and sub-processor list. *(ABSENT / informal)*

5. **Substantiation / claims-evidence file ("claims register").** For every (b) performance claim (`<500ms`, "faster than typing", "sub-second") and every (a)/(d) claim, hold dated benchmark evidence and a competitor-feature-verification log *before* publishing. The mockup's own note ("verify each '×' before launching") shows this is needed but no register exists. *(ABSENT)*

6. **Standalone Data-Retention & Deletion policy + working export/delete mechanism.** Privacy Policy promises Access/Export/Delete and "respond within 30 days" / "delete within 90 days" — these must be backed by an actual implemented data-subject-request process. ShipTalk audit M-4 explicitly flagged "no GDPR data rights." *(PARTIAL — promised, implementation unverified)*

7. **AI/model-use & acceptable-use disclosure specific to AI output** (hallucination, no-warranty, human-review-required) surfaced *at each AI feature*, not only buried in Terms §10. ShipMind's "cited answers / grounded" claims especially need an inline accuracy disclaimer (the shipmind audit L1 shows the grounding guarantee silently fails on 4/7 providers). *(PARTIAL)*

8. **Consistent age policy** (reconcile 13 vs 18 across Terms/Privacy) + COPPA statement. *(INCONSISTENT)*

9. **`CONTRIBUTING.md` + Code of Conduct.** The product is "built in the open with real contributors" (`pricing/page.tsx:32`) and ship-it-guidelines is a distributed public artifact — contributor governance is missing. *(ABSENT)*

10. **Accessibility statement** (Lighthouse runs exist; no published statement) — relevant for a paid public web product. *(ABSENT)*

11. **Trademark posture** for the "Ship*" family + a clear policy on naming competitors (NotebookLM/ChatGPT/Claude) in comparison tables. *(ABSENT)*

---

## Auditor's bottom line
Security/governance audit *documents* are unusually mature for a solo-builder shop (three deep audits, a rotation runbook), and most prior technical findings are fixed or tracked. The exposure has shifted **from code to copy and to legal-doc gaps**: (1) absolute privacy claims that the product's own cloud features contradict, (2) a named-competitor comparison table flagged for verification but not verified, (3) quantified performance claims with no substantiation file, and (4) missing LICENSE / SECURITY.md / DPA / incident-response — exactly the documents a privacy-marketed, regulated-data-targeting paid SaaS is expected to hold.
