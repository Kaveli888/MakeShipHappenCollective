# Audit v2 — Phase 3: Liability Review

> **NOT LEGAL ADVICE.** This is a technical risk auditor's structured inventory of *potential* legal exposure derived from source-code findings, written to help the operator prioritize counsel review. It is not a legal opinion, does not establish that any violation has occurred, and should be validated by a licensed attorney before any business decision. All severities/likelihoods are the auditor's risk-engineering estimates, not legal determinations.
>
> **Method:** Synthesized read-only across dossiers 10–16 (`docs/audit-v2/10`–`16`). Citations are preserved from those dossiers (`file:line`). Independent of `docs/audit/` and `docs/business-protection/`.
> **Date:** 2026-06-07.

---

## 0. Four-Lens Framing

This review is read through four professional lenses. Each risk below is tagged with the lens(es) most concerned with it.

| Lens | Primary concern | Sharpest exposures in this repo |
|---|---|---|
| **[SaaS-ATTY]** SaaS / commercial attorney | Enforceability of Terms, warranty disclaimers, liability caps, auto-renewal, refunds | No ToS-acceptance gate (web-13 L-2); placeholder governing law (web-13 L-4); weak auto-renew disclosure (web-13 L-3); express performance/security warranties (web-13 L-6/L-7, mktg-16 Cat 3/4) |
| **[PRIV-ATTY]** Privacy attorney | Privacy-promise accuracy, regulated data, wiretap/biometric, data-subject rights | "Never leaves your machine" vs cloud egress (shipmind-10 P-1/L-1, voice-12 P-1, util-14 P-6); two-party-consent recording (voice-12 §5, util-14 L-1); no export/delete implementation (web-13 P-1, shipmind-10 P-3) |
| **[TECH-ATTY]** Technology / product-liability attorney | AI-output harm, autonomous-agent harm, IP/copyright of generated & ingested content, OSS licensing | Raw-shell agents + auto-merge (space-11 S-1/S-8/L), `bypassPermissions` computer-use (util-14 L-2), GPL-ffmpeg contamination (lic-15 A.3), copyright facilitation (shipmind-10 L-2, mktg-16 Cat 6) |
| **[COMPLY]** Enterprise compliance officer | Regulated-industry fitness claims (HIPAA/FERPA/GLBA), audit/certification posture, deceptive-trade | "ferpa-safe"/"privilege-safe"/"compliance story short" badges with zero certification (mktg-16 Cat 2, web-13 L-5, shipmind-10 L-1) |

**Cluster code key** used in evidence: shipmind-10 = dossier 10; space-11 = 11; voice-12 = 12; web-13 = 13; util-14 = 14; lic-15 = 15; mktg-16 = 16.

---

## 1. Risk Register by Class

Each row: **Risk | Scenario (concrete) | Severity | Likelihood | Business impact | Lens | Evidence.** Severity = Critical/High/Medium/Low. Likelihood = High/Med/Low. (No code changes proposed — see Phase 5 for clause-level allocation.)

### 1.1 Marketing-Claim / False-Advertising Risk (FTC §5 / state UDAP)

| Risk | Scenario | Sev | Likl | Business impact | Lens | Evidence |
|---|---|---|---|---|---|---|
| **Absolute-privacy claim contradicted by cloud egress** | Site/app says ShipMind reads documents "without sending a single byte to the cloud" / "Your documents never leave your Mac," but cloud-chat mode ships RAG excerpts of the user's documents to Anthropic/OpenAI/Groq/Gemini. A regulator or plaintiff treats the absolute claim as deceptive under FTC §5 / state UDAP. | **Critical** | Med | FTC consent order / state AG action; restitution; injunction forcing copy rewrite; reputational hit to the core privacy brand. | PRIV-ATTY, COMPLY | shipmind-10 P-1/L-1, copy `docs/shipmind-product-copy.md:13,44,116`; `app/page.tsx:2956`; mktg-16 Cat 1; flows `providers.ts`, `deepResearch.ts:25` |
| **"Local / private / on-device" voice labels vs silent egress** | User selects ShipTalk's "private, on-device Local Whisper" engine; Polish still ships the full transcript to Anthropic, and Browser mode silently uploads full session audio to OpenAI + audio to Apple. Engine label "private" persists. Deceptive-labeling claim. | **Critical** | Med | Same UDAP exposure; especially acute because the contradiction is *silent* and per-engine. | PRIV-ATTY | voice-12 P-1/P-2/P-3/P-6, `SettingsView.tsx:91,446,462`; `useVoiceCommands.ts:255-279` |
| **ShipWatch "all running locally on your Mac" vs cloud LLM paths** | Continuous-capture surveillance app markets "local," but selecting Anthropic/OpenAI/Gemini or ShipWatch Cloud sends OCR'd screen text, transcripts and URLs off-device. | **High** | Med | UDAP; amplified because the data is uniquely sensitive (everything seen/typed/said). | PRIV-ATTY | util-14 §7, `OnboardingPage.tsx:89`, `ai.ts:626-695` |
| **Express security warranties ("AES-256 at rest," "encrypts over HTTPS," "encrypted at rest and in transit")** | Marketing asserts AES-256 at-rest encryption (ShipWatch) and HTTPS/at-rest encryption broadly; yet ShipWatch stores captures **unencrypted** in SQLite/PNG/WAV, ShipMind has **no encryption at rest**. A breached user sues for breach of express warranty; FTC §5 "reasonable security" theory. | **High** | Med | Breach-of-warranty damages; §5 data-security enforcement; class exposure if many users breached. | SaaS-ATTY, PRIV-ATTY | web-13 L-7, `app/page.tsx:2990`, `shipwatch/.../Features.tsx:151`; contradicted by util-14 P-5 (`db.ts` no encryption), shipmind-10 P-2 |
| **Quantified performance claim "<500ms / faster than typing"** | Absolute latency stat presented as fact with no substantiation register; fails on slower hardware/long input. Competitor or regulator challenges as unsubstantiated. | **Medium** | Med | §5 substantiation demand; forced qualifier; low damages but distracts. | SaaS-ATTY | web-13 L-6, mktg-16 Cat 4, `app/page.tsx:2954,2989` |
| **AI-output accuracy guarantees ("100% cited or flagged," "verifiable fact," "no more guessing whether the AI is making it up")** | Citation/accuracy framed as absolute and sold to "people who can't afford to be wrong"; a hallucinated/miscited answer relied on by a professional → reliance + advertising claim. | **High** | Med | §5 + product-liability/negligent-misrepresentation overlap; reliance by regulated users magnifies. | TECH-ATTY, COMPLY | mktg-16 Cat 8, `Pillars.tsx:28,31,39`, `SpeedBand.tsx:12`, `TrustBand.tsx:466`; shipmind-10 L-3 |

### 1.2 Regulated-Data / Sector-Fitness Risk (HIPAA / FERPA / GLBA / privilege)

| Risk | Scenario | Sev | Likl | Business impact | Lens | Evidence |
|---|---|---|---|---|---|---|
| **"ferpa-safe" badge with no certification** | A school adopts ShipMind on the strength of the rendered "🛡 ferpa-safe" badge, treats it as a vetted FERPA solution, then student PII egresses to a cloud LLM. School + vendor both exposed; the badge is a bare compliance assertion with no documented basis. | **Critical** | Med | UDAP/false-advertising; third-party reliance/indemnity demands from schools; the single highest-liability token in the repo. | COMPLY, PRIV-ATTY | web-13 L-5, mktg-16 Cat 2 #1, `BuiltForVisuals.tsx:392`; `BuiltFor.tsx:33` |
| **"Privilege-safe" / "attorneys, clinicians" / "compliance story short — suits law firms, healthcare teams, finance, government contractors"** | A clinician or attorney relies on the "privilege-safe"/"data doesn't cross your firewall" framing for PHI/privileged files, enables cloud mode (or Polish), and breaks confidentiality/privilege. No BAA, no SOC2, no DPA exists. | **Critical** | Med | Implied HIPAA/GLBA/privilege fitness with zero certification → §5 + sector malpractice/breach-notification exposure flowing back to vendor via reliance/indemnity. | COMPLY, PRIV-ATTY | shipmind-10 L-1 (`shipmind-product-copy.md:22,56,64-70,76`), web-13 L-5, mktg-16 Cat 2 #2/#3/#5 |
| **No BAA / DPA / subprocessor page despite regulated targeting** | An enterprise/regulated buyer requires a BAA or DPA; none exists; Privacy lists subprocessors but Terms omits Printful; no DPA page. Deal-blocking and, if data already flowed, a processing-without-agreement gap. | **High** | High | Lost enterprise deals; if regulated data already processed, a compliance gap with the data controller. | COMPLY | web-13 P-4/P-5, voice-12 §5 ("no in-app DPA/ToS"), `app/terms/page.tsx:130-136` |

### 1.3 Privacy-Promise-Breach Risk

| Risk | Scenario | Sev | Likl | Business impact | Lens | Evidence |
|---|---|---|---|---|---|---|
| **Privacy Policy promises Access/Export/Delete with no implementing route** | A user submits a GDPR Art.15/17 or CCPA delete/export request relying on the policy's stated rights; fulfillment is manual-email-only ("within 30 days") with no code path. If the manual process isn't staffed, a statutory-deadline miss. | **High** | Med | GDPR/CCPA enforcement + the *policy itself* becomes the deceptive statement (promising self-serve rights that don't exist). | PRIV-ATTY | web-13 P-1, `app/privacy/page.tsx:75-88`, `app/terms/page.tsx:154` (no route in `app/api/**`); shipmind-10 P-3; voice-12 P-4; util-14 P-5 |
| **No encryption at rest under a privacy-first brand** | A lost/stolen laptop or malware exfiltrates the unencrypted ShipMind DB / ShipWatch capture archive / ShipTalk transcript store. Breach magnitude is "everything the user saw/typed/copied/said." | **High** | Med | Breach-notification duty; contradicts marketed "sealed"/"AES-256" posture; outsized reputational damage. | PRIV-ATTY | shipmind-10 P-2, voice-12 P-4, util-14 P-5/L-6 |
| **Supabase-side storage of "private" fields** | `profiles.custom_instructions` and synced transcripts sit cloud-side under a "stays local" brand; a Supabase RLS misconfiguration exposes them. | **Medium** | Low | Privacy-promise inconsistency; RLS is the only barrier (unverified). | PRIV-ATTY | shipmind-10 P-5, voice-12 F7, web-13 P-1 |

### 1.4 Wiretap / Two-Party Consent / Biometric (BIPA) Risk

| Risk | Scenario | Sev | Likl | Business impact | Lens | Evidence |
|---|---|---|---|---|---|---|
| **Recording third parties without consent (mic + system audio)** | ShipWatch auto-arms system-audio recording on meeting detection, capturing every participant's voice (Zoom/Teams/FaceTime) with **no consent UX**; ShipTalk captures mic audio incl. bystanders. In CA/FL/IL/PA/WA two-party states, recording + transmitting others' speech without consent is a wiretap violation. Because ShipWatch *auto-arms*, the product is the trigger. | **Critical** | Med | Criminal + civil wiretap exposure (statutory damages per call/recording, e.g. CA Penal §632); plaintiff-friendly statutes; product-as-trigger weakens the "user did it" defense. | PRIV-ATTY, TECH-ATTY | util-14 L-1/P-2 (`capture.ts:487-534,509-534`), voice-12 §5 (`audioCapture.ts`, no consent strings) |
| **Biometric voiceprint / BIPA, CCPA, TX CUBI** | Raw voice audio is transmitted to OpenAI/Apple/Groq; voice is a biometric identifier; no BIPA notice/consent/retention-policy. An Illinois user/bystander brings a BIPA claim (private right of action, statutory damages). | **High** | Med | BIPA per-violation statutory damages are severe and class-attractive; no notice/consent flow exists. | PRIV-ATTY | voice-12 §5 (F2/F3/F4) |
| **Surveillance of employees / shared machines** | ShipWatch is deployed on a managed/shared Mac; continuous screen+clipboard capture sweeps in coworkers' PII visible on screen, implicating workplace-monitoring law + GDPR/CCPA processing of others' data with no data-subject controls. | **High** | Low | Employment-law + GDPR controller obligations land on the deployer, but vendor exposure via "designed for surveillance" framing + no guardrails. | PRIV-ATTY, COMPLY | util-14 L-3/P-1/P-3 |

### 1.5 Autonomous-Agent Harm / CFAA-Adjacent Risk

| Risk | Scenario | Sev | Likl | Business impact | Lens | Evidence |
|---|---|---|---|---|---|---|
| **Raw, unconfined shell to AI agents + auto-approve-all + auto-merge** | A ShipSpace mission agent (or a prompt-injected one) runs `rm -rf`, `curl | sh`, or exfiltration via raw PTY; "auto-approve all" answers permission prompts "1," and auto-merge squashes AI-authored code into the user's branch with no human review. Source itself documents the arbitrary-command capability. | **Critical** | Med | Data loss / system compromise / exfiltration with no human checkpoint; the platform supplied the unconfined capability → shared-to-platform liability; the safety "guardrail" is a *prompt*, not an enforced control. | TECH-ATTY | space-11 S-1 (`pty.rs:1-10,352-371`), S-3 (`auto-responder.ts:30-38`), S-8 (`orchestrator.rs:796-852`), §5 liability |
| **`bypassPermissions` computer-use driving the physical Mac (ShipClick)** | A misheard voice task or prompt-injection embedded in a screenshot the agent reads triggers `claude -p --permission-mode bypassPermissions --max-turns 60` to move the mouse, type, run shell, send messages, make purchases — no OS confirmation; only a prose guardrail. | **Critical** | Med | Irreversible real-world actions (deleted files, sent comms, purchases) attributable to the user but enabled by a product shipping bypassPermissions by design. | TECH-ATTY | util-14 S-5/L-2 (`shipclick:63-68`, `agent-prompt.md:38-41`) |
| **CFAA-adjacent unconfined file/host access** | `read_file` (no path confinement) reads `~/.ssh/id_rsa`/`~/.aws/credentials`; `browser_navigate` is not SSRF-guarded; if an agent is pointed at others' systems/data, it could access unauthorized resources. Owner-of-machine context limits exposure, but the lack of confinement is the platform's. | **High** | Low | CFAA/unauthorized-access theory if turned outward; secret exfiltration to cloud models. | TECH-ATTY | space-11 S-2 (`lib.rs:492-495`), S-14 (`browser_view.rs:914-921`), §5 |
| **Agent-opened GitHub PRs under the user's identity** | A PR/commit/review is created under the **user's** `gh` OAuth identity by an agent; if triggered without explicit user intent, misattribution/authorization questions for actions taken on third-party repos. | **Medium** | Low | Authorship-attribution + repo-authorization disputes; provenance of AI-authored commits. | TECH-ATTY | space-11 §5 (`github.rs:491-545`) |
| **ship-memory permanent delete over unauthenticated MCP** | Any LLM the user wires (or a prompt-injected one) calls `delete_memory` (hard delete) on the plaintext second-brain; read-only mode is opt-in and not default; the `cwd` arg can retarget the hub to any directory. Blast radius = entire personal knowledge base + cross-product `~/ShipMemory` hub. | **High** | Med | Irreversible personal-data destruction with no auth gate; data-integrity/loss exposure. | TECH-ATTY, PRIV-ATTY | util-14 S-7 (`mcp/src/index.ts:229-276,265,186-197,23-27`) |
| **Command-injection via AI-chosen args (ShipCode)** | The model emits a `grepContent` pattern/`runCommand` string containing `"; rm -rf ~ #`; it is passed unsanitized to `execSync` (shell=true). The AI is the injection vector; repo content can influence it. File-edit primitive also escapes cwd on absolute/`../` paths. | **High** | Med | Arbitrary command execution / writes outside project; data loss; the model is an attacker-controllable input. | TECH-ATTY | util-14 S-4 (`ai/tools.ts:87-88,188-208`), S-6 (`file-ops.ts:108,165,179-189`) |

### 1.6 IP / Copyright Risk

| Risk | Scenario | Sev | Likl | Business impact | Lens | Evidence |
|---|---|---|---|---|---|---|
| **GPL ffmpeg bundled in a proprietary app (copyleft contamination)** | shipmind (and ShipTranscribe) ship a GPL-enabled ffmpeg 7.0 (`--enable-gpl`, x264/x265) inside a closed-source commercial `.app`. Distributing a GPL binary in a proprietary product triggers GPL obligations (offer corresponding source / license-notice) on the combined distribution. | **Critical** | Med | A GPL author or the SFC could demand source disclosure or distribution halt; remediation = swap to LGPL ffmpeg build. Distribution-blocking for the flagship desktop app. | TECH-ATTY | lic-15 A.3 (ffmpeg row), A.5 |
| **Missing LICENSE files + unmet attribution (NOTICE) for bundled MIT/Apache binaries** | None of the 6 products ships a LICENSE file; ShipCode/root *claim* MIT without backing it; no NOTICE/THIRD-PARTY file reproduces required MIT/Apache/BSD notices for bundled deno/ollama/ggml and npm deps. IP ownership/usage terms of the distributed code are undefined. | **High** | High | Unenforceable/ambiguous IP terms; attribution-obligation breaches on every distributed binary; "all rights reserved" default conflicts with public MIT claims. | TECH-ATTY, SaaS-ATTY | lic-15 A.3 (missing-attribution), A.4 (LICENSE matrix), shipmind-10 L-4/L-5 |
| **AI-generated code auto-merged with no provenance/license review** | ShipGang/orchestrator writes model-authored code into the user's repo (auto-merge on) that may reproduce copyrighted snippets; no provenance or license check. | **Medium** | Med | Downstream copyright/licensing contamination of the user's product; provenance disputes. | TECH-ATTY | space-11 §5 (license contamination, `orchestrator.rs:833-852`) |

### 1.7 Copyright-Facilitation / Platform-ToS Risk

| Risk | Scenario | Sev | Likl | Business impact | Lens | Evidence |
|---|---|---|---|---|---|---|
| **yt-dlp YouTube ingestion + arbitrary web scraping bundled & marketed** | The product bundles yt-dlp and markets "ingest YouTube URLs"; downloading YouTube content generally violates YouTube ToS, and `web_search`/`fetch_url` scrape arbitrary sites. User-initiated, but the vendor ships and advertises the capability for potentially non-owned content. | **Medium** | Med | Secondary-liability / platform-ToS exposure; YouTube/site operator complaints; copyright of transcribed expression. | TECH-ATTY | shipmind-10 L-2 (`lib.rs:2392,2486,4233,1588`), mktg-16 Cat 6, `CTA.tsx:25` |
| **Prompt packs purpose-built to lift creators' prompts & build competitor dossiers** | Shipped `ShipMindPrompts/Research/*` packs instruct extraction of "every instance where the speaker is directing an AI… keep his words" from YouTube transcripts, and competitor-surveillance dossiers ("what they're hiding, where I can win"). Facilitates copying others' IP/expression and ToS-violating scraping. | **High** | Med | Trade-secret-adjacent / copyright-of-expression + CFAA-adjacent ToS-breach facilitation; reputational if surfaced. | TECH-ATTY | mktg-16 Cat 6 (`PROMPT EXTRACTION RESEARCHER.md:3,30,68`, `COMPETITOR GOAL…:2-3`, `TIMELINE SYNTHESIZER:2`) |

### 1.8 Comparative-Advertising / Lanham Act Risk

| Risk | Scenario | Sev | Likl | Business impact | Lens | Evidence |
|---|---|---|---|---|---|---|
| **Competitor comparison tables (NotebookLM/ChatGPT/Claude/Obsidian) with ✗ cells** | The site renders ✓/✗ capability tables naming competitor trademarks, marking them "no" on local-first/cited-answers/BYO-keys. If any cell is inaccurate, it is false comparative advertising; **the dev's own note flags the cells as not-yet-verified.** | **High** | Med | Lanham §43(a) false-comparative-advertising + trademark-use challenge from a named competitor; the unverified-cell note is adverse evidence. | SaaS-ATTY, TECH-ATTY | web-13 L-8, mktg-16 Cat 5 (`TrustBand.tsx:31-41`, `shipmind-product-page-mockup.html:427-456`) |

### 1.9 Contractual / SaaS-Enforceability Risk

| Risk | Scenario | Sev | Likl | Business impact | Lens | Evidence |
|---|---|---|---|---|---|---|
| **No ToS/Privacy acceptance gate (no checkbox / "by signing up you agree")** | A user disputes a charge or sues; there is no acceptance record at signup/login/pricing/CLI-login, so the liability cap, warranty disclaimer, and governing-law clause are weakly enforceable (browsewrap, not clickwrap). | **High** | Med | The entire Terms (incl. liability cap and AI/output disclaimers) may be unenforceable against users → every other clause's protection is undermined. | SaaS-ATTY | web-13 L-2 (`signup/page.tsx`, no "agree" text) |
| **Placeholder governing law / venue** | Terms say venue is "the state in which MakeShipHappen is registered" — no state named. The forum-selection/governing-law clause is indeterminate and likely unenforceable as written. | **Medium** | High | Litigation in an unfavorable/unintended forum; uncertainty in any dispute. | SaaS-ATTY | web-13 L-4 (`app/terms/page.tsx:167-171`) |
| **Weak point-of-sale auto-renewal disclosure (CA ARL / FTC click-to-cancel)** | Checkout CTA shows only "Cancel anytime · No refunds · Secure checkout"; no clear, conspicuous auto-renew disclosure adjacent to the purchase button as ARL/click-to-cancel requires. | **Medium** | Med | ARL statutory penalties / FTC click-to-cancel exposure; chargebacks; some charges voidable. | SaaS-ATTY | web-13 L-3 (`pricing/page.tsx:198-222`), mktg-16 Cat 7 |
| **Blanket "all sales final / no refunds" vs mandatory consumer rights** | An EU/UK or other mandatory-cooling-off consumer is told "all sales final"; the blanket stance is partly unenforceable where statutory withdrawal/refund rights apply (a "unless required by applicable law" hedge exists in Terms but not on the pricing/download CTAs). | **Medium** | Med | UDAP/consumer-protection challenge for overriding statutory rights; chargebacks. | SaaS-ATTY | web-13 L-1, mktg-16 Cat 7 (`terms/page.tsx:79-103`, `pricing/page.tsx:221`) |
| **Stripe webhook hardcodes `status:'active'`; no `invoice.payment_failed`/dunning** | A first/renewal invoice fails but the user retains paid access until a later `subscription.updated/deleted` fires. Revenue-leak / entitlement-mismatch; not a legal claim per se but a contract-fulfillment gap. | **Medium** | Med | Revenue leakage; entitlement disputes. | SaaS-ATTY | web-13 S-3 (`webhook/route.ts:113-121`) |
| **Age-eligibility inconsistency + unenforced at signup** | General site requires 18; the ShipMind extension policy uses "under 13" (COPPA) framing; neither is enforced at signup. Inconsistent minimum age across properties; a minor signs up. | **Low** | Med | COPPA/age-verification gap; inconsistent contractual capacity terms. | SaaS-ATTY, PRIV-ATTY | web-13 §6/§8 (`terms:44`, `privacy:96`, `privacy/shipmind-extension/page.tsx:110`) |

### 1.10 Security-as-Liability Risk (operator cost & breach)

| Risk | Scenario | Sev | Likl | Business impact | Lens | Evidence |
|---|---|---|---|---|---|---|
| **ship-aos no-auth + live Stripe secret key + CLI-spawn** | If ship-aos (no auth on any route, stores a live `sk_live_` key, spawns CLI agents) is ever run with `-H 0.0.0.0` / behind a tunnel, any LAN/remote client reads the live Stripe token surface and drives `/api/*/chat` to spawn local processes. | **High** (Critical if network-exposed) | Low | Live-payment-credential compromise; remote code-exec surface; operator financial + breach liability. | TECH-ATTY, PRIV-ATTY | web-13 S-1 (`ship-aos/src/app/api/**`, `stripe/key/route.ts:11`, `claude/chat/route.ts:21`) |
| **ShipWatch Cloud relay binds all-interfaces, CORS-only gate** | The credit-spending Anthropic relay binds 0.0.0.0 with browser-only CORS as its sole transport gate; any non-browser client with a leaked Gumroad license key spends the operator's Anthropic credits. | **High** (Critical if deployed public) | Low | Operator cost abuse; uncapped third-party API spend; availability. | TECH-ATTY | util-14 S-1/L-5 (`server/src/index.ts:95-98`) |
| **MCP servers expose transcripts/app-state/second-brain with no auth** | shiptalk-mcp / shipmind-mcp / shipspace-mcp / ship-memory MCP expose transcripts, app state, and read/write/delete of notes to any wired LLM with no token/allow-list/redaction. Personal/medical/financial dictation leaves the device to whatever model the MCP client uses. | **High** | Med | Confidentiality breach + (ship-memory) data-destruction; the user "wired it" but no warning/trust-model is documented. | PRIV-ATTY, TECH-ATTY | voice-12 S-1/P-5, util-14 S-7, space-11 S-10 |
| **No secret scrubbing on untrusted→cloud flows** | A `.env`/API key visible in a ShipSpace terminal scrollback (or browser page, GitHub issue body, reference file) is dragged into chat and transmitted verbatim to a cloud model. | **Medium** | Med | Secret leakage to third-party providers; downstream account compromise. | PRIV-ATTY, TECH-ATTY | space-11 S-11 (§2.4, grep-negative) |

### 1.11 Potential-User-Misuse Risk (cross-cutting)

| Risk | Scenario | Sev | Likl | Business impact | Lens | Evidence |
|---|---|---|---|---|---|---|
| **Regulated user relies on over-promised privacy/compliance** | A clinician/attorney/school drops PHI/privileged/student data in, trusting "privilege-safe/ferpa-safe/never leaves," then enables a cloud path → breach. Misuse is *invited* by the marketing. | **Critical** | Med | The clearest path from a marketing token to a real-world regulated breach with vendor reliance exposure. | COMPLY, PRIV-ATTY | shipmind-10 L-1, mktg-16 Cat 2, voice-12 §5 |
| **User records bystanders/meetings unlawfully** | App provides zero consent tooling and auto-arms; user violates two-party-consent law without any in-app warning. | **High** | Med | Liability borne by user but no guardrail = product-as-facilitator narrative. | PRIV-ATTY | util-14 L-1, voice-12 §5 |
| **User runs autonomous agent that destroys data / acts in the world** | User enables auto-approve-all / bypassPermissions / auto-merge and an agent takes irreversible action. | **High** | Med | Damage attributed to user, but the opt-out design + prose-only guardrail shifts perceived responsibility to platform. | TECH-ATTY | space-11 S-1/S-3/S-8, util-14 S-5 |
| **User uses scraping/extraction packs against others' content** | User runs the YouTube prompt-extraction/competitor-dossier packs on content they don't own. | **Medium** | Med | ToS/IP exposure facilitated by shipped assets. | TECH-ATTY | mktg-16 Cat 6 |

---

## 2. Highest-Severity Legal Exposures (auditor ranking)

1. **Regulated-data marketing without certification** — "ferpa-safe"/"privilege-safe"/"compliance story short" badges + "never leaves your machine" sold to schools/clinicians/attorneys while cloud paths egress their data and there is no encryption-at-rest, BAA, DPA, or SOC2. *(Critical; COMPLY+PRIV)* — shipmind-10 L-1, mktg-16 Cat 2, `BuiltForVisuals.tsx:392`.
2. **Wiretap / two-party-consent recording with no consent UX, product auto-arms** — ShipWatch auto-records meeting participants; ShipTalk captures bystanders; raw audio leaves device. *(Critical; PRIV+TECH)* — util-14 L-1, voice-12 §5.
3. **Autonomous-agent harm with the human gate made opt-out** — raw shell + auto-approve-all + auto-merge (ShipSpace) and bypassPermissions computer-use (ShipClick); platform supplied the unconfined capability. *(Critical; TECH)* — space-11 S-1/S-3/S-8, util-14 L-2.
4. *(also Critical)* **GPL-ffmpeg contamination** of the proprietary flagship app — distribution-blocking IP risk. *(lic-15 A.3.)*
5. *(also Critical)* **Absolute-privacy false-advertising** ("not a single byte to the cloud") contradicted by the product's own cloud-egress paths and privacy policy. *(shipmind-10 P-1/L-1, mktg-16 Cat 1.)*

## 3. Enforceability multiplier (read every clause through this)

Because there is **no ToS-acceptance gate** (web-13 L-2) and the **governing-law clause is a placeholder** (web-13 L-4), the liability cap, warranty disclaimers, and AI-output disclaimers that *would* mitigate Sections 1.1–1.11 are themselves at risk of being unenforceable. Fixing the acceptance gate and governing law is therefore a force-multiplier on every other legal protection — addressed in Phase 5.
