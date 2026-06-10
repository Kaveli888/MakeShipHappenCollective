# PHASE 10 — Executive Report

**MakeShipHappen Ecosystem | Independent Risk Audit | 2026-06-07**

Severity key: **🔴 Critical** · **🟠 High** · **🟡 Medium** · **🟢 Low**
"Critical" = could cause material legal/financial/safety harm or is actively launch-blocking. "High" = significant exposure, address before scaling. "Medium" = should fix, manageable. "Low" = hygiene / defense-in-depth.

---

## Executive Summary

This is a 12-app, ~90 GB ecosystem built by a solo founder spanning four desktop AI apps (ShipMind, ShipTalk, ShipSpace, ShipWatch), a live commercial web property with payments (makeshiphappen.tech), a published developer CLI (ShipCode), a surveillance/memory app, a markdown memory engine, three MCP servers, and a Chrome extension.

**What is going well:** No real secrets are committed to git. Keys are in the OS Keychain. The flagship commercial web app has remediated almost all prior Critical/High security findings. Dependency licensing is clean (all permissive; no copyleft). Several apps have genuine local-first paths and the source even self-documents its own risks honestly.

**Where the risk concentrates:**
1. **Privacy-promise vs. reality gap** — absolute "on-device / never leaves your machine / FERPA-protected" claims marketed to lawyers, clinicians, and schools, while cloud AI egress paths demonstrably exist (and in ShipTalk, the cloud "Polish" step fires *even when the user picked the local engine*). This is the single most repeated and most legally dangerous pattern.
2. **Autonomous agents with approvals disabled** — ShipSpace runs agents with raw shell access and ships `--dangerously-bypass-approvals-and-sandbox`; ShipClick drives the physical Mac under `bypassPermissions`. Misheard voice or on-screen prompt injection can take destructive, irreversible action.
3. **Commercial governance is undocumented** — published Privacy Policy promises deletion/export that has no implementing code; ToS says "all sales are final" while the site advertises "7-day money-back"; no DPA/subprocessor register despite marketing to regulated buyers; no LICENSE files despite "MIT" claims; auto-renewal disclosure gaps under CA/FTC click-to-cancel rules.
4. **Server/exposure edges** — ShipWatch's cloud proxy binds all interfaces with browser-only CORS; ship-memory exposes plaintext personal notes over MCP with no auth.

The recommended posture: **freeze the riskiest marketing claims, ship the missing legal/governance documents, and gate the autonomous-execution modes** before adding paying users at scale. None of this requires re-architecting the products.

---

## 1. Top 25 BUSINESS Risks

| # | Risk | Severity |
|---|---|---|
| B1 | Absolute privacy marketing ("100% on-device", "never leaves your machine") is contradictory to shipped cloud features — a single screenshot of the contradiction could destroy trust with the privacy-conscious audience the brand targets. | 🔴 |
| B2 | Refund policy contradiction (ToS "all sales are final" vs. advertised "7-day money-back") guarantees chargebacks, disputes, and Stripe risk-flags at scale. | 🟠 |
| B3 | Single-founder key-person risk: all 12 apps, infra, Stripe, Supabase, domains, and signing keys depend on one person with no documented succession/continuity plan. | 🟠 |
| B4 | Pricing↔ToS↔backend mismatch: site sells one $50/mo tier, backend + comp tooling support an unpublished $500 tier; product-copy doc still shows stale $20/$40 tiers. Billing confusion and disputes. | 🟠 |
| B5 | Reputational/safety blowback if an autonomous agent (ShipSpace/ShipClick) destroys a customer's files or data while "bypass" mode is on. | 🔴 |
| B6 | No Terms of Service acceptance gate verified at signup/checkout → contracts may be unenforceable, undermining every liability limitation. | 🟠 |
| B7 | Comp-access tool grants free access with **no auto-expiry** — must be revoked manually; forgotten comps = silent revenue leakage. | 🟡 |
| B8 | Free-tier limit in ShipCode CLI is client-side (`~/.shipcode/usage.json`), trivially bypassable → revenue leakage on metered features. | 🟡 |
| B9 | Brand depends on competitor-comparison claims ("NotebookLM alternative", competitor "✗" table) that invite trademark/Lanham challenges and takedown demands. | 🟠 |
| B10 | Marketing to regulated verticals (legal/healthcare/education/government) without certifications creates a sales-promise the product cannot legally satisfy → refund/clawback and churn risk. | 🟠 |
| B11 | Stripe account concentration: a dispute spike or ToS contradiction could trigger Stripe reserve/freeze, cutting off all revenue. | 🟠 |
| B12 | Printful merch fulfillment dependency — prior "charged but never shipped" defect (now fixed) shows fulfillment is fragile; failures = chargebacks + FTC mail-order-rule exposure. | 🟡 |
| B13 | No documented data-retention or cost-control on cloud AI spend (ShipWatch proxy, ShipSpace providers) → runaway API bills if abused or looped. | 🟡 |
| B14 | No SLA/uptime commitments defined, yet "always-on" framing in copy can imply them → support burden and refund pressure. | 🟢 |
| B15 | Ecosystem complexity (12 apps, overlapping names) with no central product registry → operational confusion, inconsistent security baselines. | 🟡 |
| B16 | ShipWatch is a continuous screen/mic/clipboard surveillance product — a single mishandling incident is an existential brand event for a "privacy" company. | 🟠 |
| B17 | Reliance on third-party AI providers' availability and pricing (Anthropic/OpenAI/Groq/Ollama) — provider deprecations or price hikes break products and margins. | 🟡 |
| B18 | Deprecated/stale assets shipped in repo (empty `shipyard-os`, stale mockups with $20/$40 pricing, orphaned auth views) risk being published inconsistently. | 🟢 |
| B19 | No claims-substantiation file for quantified performance ("<500ms", "Faster than typing") → cannot defend an advertising challenge; forced retraction damages credibility. | 🟡 |
| B20 | Owner email hardcoded as privileged identity (`zzgemsjewelry@gmail.com`) across apps couples business control to one personal account. | 🟡 |
| B21 | No incident-response/communications plan → a breach or agent-caused harm would be handled ad hoc, amplifying reputational damage. | 🟠 |
| B22 | Customer support / dispute process undefined → inconsistent handling erodes trust and increases chargeback losses. | 🟢 |
| B23 | Heavy dependence on creator-channel (TikTok) distribution; platform policy changes could cut the funnel. | 🟢 |
| B24 | Bundled third-party binaries (ffmpeg, yt-dlp, deno, Ollama) increase update/supply-chain and licensing surface the business must maintain. | 🟡 |
| B25 | No analytics/consent governance → adopting ad pixels or analytics later without consent infra invites regulatory and trust costs. | 🟢 |

---

## 2. Top 25 LEGAL Risks

| # | Risk | Severity |
|---|---|---|
| L1 | False/deceptive advertising (FTC Act §5 / state UDAP): absolute privacy claims contradicted by cloud egress. Top legal exposure across the ecosystem. | 🔴 |
| L2 | Privacy-promise breach as an unfair practice: "No recordings are stored, uploaded, or analyzed externally" while cloud STT uploads raw audio. | 🔴 |
| L3 | "FERPA-protected" / regulated-data claims invoke statutes the product is not certified under → misrepresentation + sector-specific liability. | 🔴 |
| L4 | Auto-renewal disclosure gap (CA Automatic Renewal Law, FTC "Click-to-Cancel"/ROSCA): intro discount + auto-renew without clear point-of-sale disclosure and verified easy cancel. | 🟠 |
| L5 | Refund-term contradiction (ToS vs. ad copy) → unenforceable terms + deceptive-pricing exposure. | 🟠 |
| L6 | "Not legal advice — consult a lawyer" disclaimer text sitting inside the *live commercial* Terms/Privacy pages signals the legal docs are unfinished/templated → weak enforceability. | 🟠 |
| L7 | Placeholder governing-law/jurisdiction in ToS → dispute-resolution and venue clauses may fail. | 🟠 |
| L8 | Comparative-advertising / trademark risk: naming NotebookLM, ChatGPT, Claude and marking them "✗" without substantiation (Lanham Act §43(a)). | 🟠 |
| L9 | Copyright/ToS-violation facilitation: bundled yt-dlp + scraping + "competitor research" prompt packs purpose-built to copy YouTube/web/PDF content → secondary-liability and platform-ToS exposure. | 🟠 |
| L10 | Wiretap/recording-consent law: ShipTalk/ShipWatch capture audio of third parties; two-party-consent states (CA, FL, etc.) create criminal/civil exposure with no consent controls. | 🟠 |
| L11 | No enforceable Limitation of Liability / warranty disclaimer verified as accepted → uncapped exposure for AI-output harm, data loss, agent actions. | 🔴 |
| L12 | AI-output disclaimer absent/unverified: hallucinated or harmful AI output (legal/medical/financial context) attributed to the platform. | 🟠 |
| L13 | No Data Processing Agreement or subprocessor register despite processing user PII through Anthropic/OpenAI/Groq/Supabase/Stripe/Printful/Sentry → GDPR Art. 28 violation for any EU user. | 🟠 |
| L14 | Printful receives customer name + shipping address but is omitted from the subprocessor disclosure → privacy-policy inaccuracy = deceptive practice. | 🟡 |
| L15 | Privacy Policy promises data deletion/export with **no implementing code** → unfulfillable legal promise (GDPR Art. 15/17, CCPA/CPRA). | 🔴 |
| L16 | Inconsistent minimum-age policy (13 vs. 18 across docs) → COPPA / age-gating ambiguity and contract-capacity issues. | 🟡 |
| L17 | No LICENSE files despite README/guidelines claiming "MIT" → ambiguous IP ownership; unintentional open-sourcing risk for commercial code, or unenforceable license for the parts meant to be open. | 🟠 |
| L18 | Missing third-party NOTICE/attribution bundle for MIT/Apache/BSD deps shipped in binaries → license-compliance breach in distribution. | 🟡 |
| L19 | Agent autonomously opening GitHub PRs / committing code on the user's behalf → authorship, license-contamination, and CFAA-adjacent exposure if it touches systems without authorization. | 🟠 |
| L20 | ffmpeg build flags unverified (possible GPL-enabled build) bundled in a closed commercial app → potential GPL contamination claim. | 🟡 |
| L21 | Bundled local model weights (Gemma/Llama) carry non-OSI acceptable-use terms → distribution/commercial-use restrictions may be violated. | 🟡 |
| L22 | No clear IP ownership/assignment for user-generated content and AI outputs in ToS → disputes over who owns generated artifacts. | 🟡 |
| L23 | Marketing "encrypts over HTTPS" / security assurances could be construed as a security warranty → breach-of-warranty exposure on incident. | 🟡 |
| L24 | Using vendor CLIs in `--dangerously-bypass`/auto-permission modes may violate Anthropic/OpenAI/Codex acceptable-use terms → account termination + breach. | 🟡 |
| L25 | Accessibility statement absent for consumer web product → ADA Title III / state accessibility litigation exposure. | 🟢 |

---

## 3. Top 25 PRIVACY Risks

| # | Risk | Severity |
|---|---|---|
| P1 | Sensitive dictation/documents leave the device via cloud AI despite "private/local" promises (ShipTalk Polish, cloud STT, ShipMind cloud chat, ShipSpace providers). | 🔴 |
| P2 | ShipTalk "Polish" sends the **full transcript to Anthropic even when the local engine is selected** — direct contradiction of user's privacy choice. | 🔴 |
| P3 | Cloud STT uploads **raw audio** (including bystanders' voices) to OpenAI/Groq → biometric/voice-data processing without consent infrastructure. | 🟠 |
| P4 | ShipWatch continuously captures screen, mic, system audio, clipboard, app activity, and browser URLs → extremely sensitive aggregate profile of the user (and anyone on their screen). | 🔴 |
| P5 | No working data-deletion mechanism behind the Privacy Policy promise (GDPR Art. 17 / CCPA right to delete). | 🔴 |
| P6 | No working data-export/portability mechanism (GDPR Art. 15/20). | 🟠 |
| P7 | Transcripts persist **forever** in localStorage and Supabase with no retention limit or purge. | 🟠 |
| P8 | MCP servers (shiptalk-mcp, shipmind-mcp, ship-memory, shipspace-mcp) expose personal transcripts/notes/state to any connected LLM agent with no allow-list or redaction. | 🟠 |
| P9 | ship-memory stores second-brain personal notes as **plaintext, unauthenticated**, with read/write/permanent-delete over MCP stdio. | 🟠 |
| P10 | ShipWatch/ShipTalk capture third-party PII (faces, voices, on-screen data of others) with no consent capture or notice → bystander privacy violation. | 🟠 |
| P11 | Document RAG excerpts (potentially privileged legal/health/financial content) are sent to cloud LLMs in ShipMind chat. | 🟠 |
| P12 | Supabase stores user email, name, account data, and full transcript text under a public anon key — privacy rests entirely on RLS that cannot be verified from the repo. | 🟠 |
| P13 | `/api/auth/verify` echoes email + user_id in its response (M-1) → more PII surface than necessary. | 🟡 |
| P14 | No cookie-consent / tracking-consent banner verified → ePrivacy/CCPA non-compliance if any analytics/pixels are added. | 🟡 |
| P15 | API keys stored in webview `localStorage` (ShipWatch) rather than Keychain → exfiltratable on any renderer compromise. | 🟡 |
| P16 | No documented retention schedule for logs that may contain prompts, file contents, terminal output, and PII. | 🟡 |
| P17 | Browser-URL and app-activity capture (ShipWatch) can sweep up credentials, health portals, banking sessions visible on screen. | 🟠 |
| P18 | Cross-product data aggregation (ShipMemory hub shared across apps) concentrates sensitive data with no unified access-control story. | 🟡 |
| P19 | No Data Protection Impact Assessment (DPIA) for high-risk processing (surveillance, biometrics, large-scale profiling) — required under GDPR Art. 35. | 🟠 |
| P20 | No subprocessor transparency for users → cannot exercise informed consent over where their data goes. | 🟡 |
| P21 | Whisper model downloaded via `curl` with size-only check (no checksum/signature) → integrity/tampering risk on a component that processes private audio. | 🟡 |
| P22 | Children's-data exposure risk given inconsistent age gating and education-vertical marketing. | 🟡 |
| P23 | No breach-notification process → statutory notification deadlines (GDPR 72h, US state laws) would be missed. | 🟠 |
| P24 | Telemetry (ShipCode → Supabase + Sentry) lacks a documented privacy notice of what events are collected. | 🟢 |
| P25 | Local SQLite/transcript stores are unencrypted at rest → device theft exposes all captured content. | 🟡 |

---

## 4. Top 25 SECURITY Risks

| # | Risk | Severity |
|---|---|---|
| S1 | ShipSpace agents get raw PTY shell access with **no intent-validation layer** — source itself documents "agent can execute arbitrary commands (rm -rf, curl exfiltration)". | 🔴 |
| S2 | Shipped danger modes: `codex --dangerously-bypass-approvals-and-sandbox`, `agent:auto`, `claude --permission-mode bypassPermissions` strip every approval + sandbox. | 🔴 |
| S3 | ShipClick runs `claude -p --permission-mode bypassPermissions` while physically controlling the Mac → misheard voice / screen prompt-injection → irreversible destructive action. | 🔴 |
| S4 | Prompt-injection → code/secret exfiltration: untrusted files/web/issues/terminal-drag content reaches agents and providers with no secret scrubbing. | 🟠 |
| S5 | Auto-merge squash-merges agent-written code into the user's branch with no review; auto-responder can auto-approve risky CLI permission prompts → removes human-in-the-loop. | 🟠 |
| S6 | ShipWatch cloud proxy exports `{port,fetch}` with no host → **default 0.0.0.0 bind**, browser-only CORS the sole gate on a credit-spending Anthropic relay. | 🟠 |
| S7 | Path-unconfined `read_file`/`list_directory`/`open_path` in ShipSpace (can read `~/.ssh`) while writes are hardened → inconsistent containment. | 🟠 |
| S8 | Provider API keys held in renderer memory with `withGlobalTauri` enabled → key theft on any renderer/XSS compromise. | 🟠 |
| S9 | ShipMind `fs` write scope is `$HOME/**` and IDE reads use a deny-list (not real containment) → broad blast radius for XSS or a prompt-injected tool call. | 🟠 |
| S10 | `'unsafe-eval'` retained in ShipMind CSP → enables injected-code execution paths. | 🟡 |
| S11 | ship-aos has shell exec + a live Stripe key + no auth — fine on localhost, **Critical if ever network-exposed**. | 🟡 |
| S12 | Security across the auth surface rests on Supabase RLS that cannot be verified from source (ShipMind/ShipTalk/web) → misconfiguration = full data exposure. | 🟠 |
| S13 | Whisper model fetched without checksum/signature pinning → supply-chain tampering of a privacy-critical component. | 🟡 |
| S14 | ShipWatch stores API keys in `localStorage` + accepts arbitrary absolute paths in `read_file`/`write_file` from the webview → broad blast radius. | 🟡 |
| S15 | Residual owner-bypass identity checks (client-side `zzgemsjewelry@gmail.com`) across apps → privilege coupling; verify all paths are server-enforced. | 🟡 |
| S16 | Checkout webhook hardcodes `status:'active'` without re-reading Stripe (M-2) → state can drift from the truth at the payment processor. | 🟡 |
| S17 | No `invoice.payment_failed` / dunning handling → failed renewals silently retain access (auth-state correctness gap). | 🟡 |
| S18 | cli-login "state echo" must be deployed or **all ShipCode logins 403** (operational); the loopback flow's `state` + Origin/Referer checks are good but deployment-dependent. | 🟡 |
| S19 | Pending Supabase migrations (010–012) must be confirmed applied or RLS/fulfillment fixes are not actually live. | 🟠 |
| S20 | `summarize_readme.sh` and ShipCode `runCommand`/`grepContent` use `execSync` interpolation — currently not agent-wired, but latent command-injection if connected. | 🟡 |
| S21 | No code-signing/attestation verification documented for self-distributed desktop builds (codesign/xattr gotchas noted) → tampered-binary risk to end users. | 🟡 |
| S22 | Logs may capture prompts/file contents/secrets with no scrubbing or rotation policy. | 🟡 |
| S23 | No documented secrets-rotation cadence; live keys flagged for rotation in launch checklist (H-3) → stale-credential risk. | 🟡 |
| S24 | Bundled binaries (ffmpeg, yt-dlp, deno, Ollama) have no documented update/patch process → unpatched-CVE exposure over time. | 🟡 |
| S25 | No SECURITY.md / vulnerability-disclosure channel → researchers have no safe path to report, raising full-disclosure risk. | 🟢 |

---

## 5. Top 25 DOCUMENTATION Gaps

| # | Gap | Severity |
|---|---|---|
| D1 | No LICENSE file in any app despite "MIT" claims → IP ownership undefined. | 🟠 |
| D2 | No Terms of Service that is finalized (placeholder/"not legal advice" text live), nor a verified acceptance gate. | 🟠 |
| D3 | No accurate, enforceable Privacy Policy matching actual data flows (cloud egress, subprocessors). | 🔴 |
| D4 | No Data Processing Agreement (DPA) + subprocessor register. | 🟠 |
| D5 | No data-retention & deletion policy (and no code behind the promised one). | 🟠 |
| D6 | No SECURITY.md / vulnerability-disclosure policy. | 🟡 |
| D7 | No incident-response / breach-notification runbook. | 🟠 |
| D8 | No third-party NOTICE / open-source-attribution bundle. | 🟡 |
| D9 | No claims-substantiation register for performance + competitor-comparison claims. | 🟡 |
| D10 | No DPIA for high-risk processing (surveillance/biometrics). | 🟠 |
| D11 | No acceptable-use policy defining prohibited uses (scraping, recording without consent, illegal content). | 🟠 |
| D12 | No AI-output disclaimer / accuracy-limitations notice surfaced to users. | 🟠 |
| D13 | No consistent minimum-age / COPPA policy (13 vs 18 conflict). | 🟡 |
| D14 | No refund policy reconciled across ToS and marketing. | 🟠 |
| D15 | No auto-renewal/cancellation disclosure document meeting CA ARL/FTC requirements. | 🟠 |
| D16 | No per-product README documenting actual data flows / cloud usage for user transparency. | 🟡 |
| D17 | No central product/architecture registry mapping the 12 apps, their providers, and data stores. | 🟡 |
| D18 | No business-continuity / key-person succession plan. | 🟡 |
| D19 | No accessibility statement (web). | 🟢 |
| D20 | No CONTRIBUTING / Code of Conduct (for any open components). | 🟢 |
| D21 | No documented secrets-rotation & key-management procedure. | 🟡 |
| D22 | No documented model-provenance/integrity policy for downloaded weights. | 🟢 |
| D23 | Prior security audit reports are stale/unreconciled (ShipTalk Feb 2026 predates cloud features and falsely states "no AI APIs"). | 🟡 |
| D24 | No user-facing consent/notice for third-party recording (ShipTalk/ShipWatch). | 🟠 |
| D25 | No documented cost/usage-control policy for cloud AI spend. | 🟢 |

---

## 6. Top 25 COMPLIANCE Gaps

| # | Gap | Severity |
|---|---|---|
| C1 | GDPR data-subject rights (access/erasure/portability) not operable in code → non-compliant for any EU user. | 🔴 |
| C2 | GDPR Art. 28 (processor agreements) — no DPA with Anthropic/OpenAI/Groq/Supabase/Stripe/Printful/Sentry. | 🟠 |
| C3 | GDPR Art. 30 (records of processing) — no ROPA. | 🟡 |
| C4 | GDPR Art. 35 DPIA absent for surveillance/biometric/profiling processing. | 🟠 |
| C5 | GDPR Art. 33/34 breach notification — no process to meet 72h deadline. | 🟠 |
| C6 | CCPA/CPRA — no "Do Not Sell/Share", no rights-request workflow, no privacy-rights disclosures. | 🟠 |
| C7 | CA Automatic Renewal Law — auto-renew + intro discount without compliant disclosure/consent/cancel. | 🟠 |
| C8 | FTC "Click-to-Cancel"/ROSCA — cancellation must be as easy as sign-up; not verified. | 🟠 |
| C9 | FTC Act §5 advertising substantiation — privacy + performance + comparative claims lack support. | 🔴 |
| C10 | FERPA — explicitly invoked in marketing without certification or a school-as-controller agreement. | 🟠 |
| C11 | HIPAA — clinician/health targeting implies PHI handling with no BAA and cloud egress → non-compliant if used as marketed. | 🟠 |
| C12 | State two-party wiretap consent (CA/FL/etc.) — recording features lack consent controls. | 🟠 |
| C13 | COPPA — inconsistent age gating + education marketing risks under-13 data collection. | 🟡 |
| C14 | ADA Title III / WCAG — no accessibility conformance for the consumer web app. | 🟡 |
| C15 | PCI-DSS — relies on Stripe (good); confirm no PAN ever touches own servers/logs (SAQ-A scope). | 🟡 |
| C16 | Open-source license compliance — missing attribution/NOTICE in distributed binaries (MIT/Apache/BSD). | 🟡 |
| C17 | ffmpeg GPL-build / Gemma-Llama acceptable-use compliance unverified for redistribution. | 🟡 |
| C18 | Vendor AUP compliance — `--dangerously-bypass`/auto-permission modes may violate Anthropic/OpenAI/Codex terms. | 🟡 |
| C19 | EU AI Act transparency — users must be told they're interacting with AI and (for high-risk uses) given disclosures; not documented. | 🟡 |
| C20 | Biometric-data laws (e.g., Illinois BIPA) — voiceprint/audio processing without notice/consent. | 🟠 |
| C21 | Mail/merch order rule (FTC) — fulfillment timing disclosures for Printful merch. | 🟢 |
| C22 | Cookie/ePrivacy consent — no consent management for any tracking added. | 🟡 |
| C23 | Data-transfer mechanism (SCCs) for EU→US provider transfers undocumented. | 🟡 |
| C24 | Marketing of "regulated data" support without SOC 2 / ISO 27001 / compliance attestation creates a representation gap with enterprise buyers. | 🟡 |
| C25 | Records of consent (ToS/Privacy acceptance, recording consent) not captured → cannot demonstrate compliance on audit. | 🟡 |

---

## Recommended sequencing (governance, not code)

1. **Immediately (claim-freeze):** Pull or qualify every absolute privacy/regulatory claim (B1, L1–L3, P1–P2, C9–C11). Replace "never leaves your machine / 100% on-device / FERPA-protected" with mode-accurate language ("local-first; optional cloud features clearly labeled").
2. **Pre-scale legal pack:** Finalize ToS (remove placeholder/"not legal advice" text, fix governing law), reconcile refund + pricing, add auto-renewal disclosure, AI-output disclaimer, acceptable-use policy, accurate Privacy Policy + subprocessor list, DPA template (D2–D5, D11–D15, L4–L7, C1–C8).
3. **Gate autonomous execution:** Treat S1–S3 as product-safety, not convenience — default approvals on, ship "danger" modes behind explicit, logged opt-in with warnings; never default-enable for end users.
4. **Operational closeouts** (already tracked in `LAUNCH_ROTATION_CHECKLIST`): confirm migrations 010–012, rotate live keys, confirm Supabase "Confirm email" ON, deploy cli-login state echo, bind ShipWatch proxy to 127.0.0.1.
5. **Implement the promised rights:** data export + deletion behind the Privacy Policy (D3, L15, P5–P6, C1).
6. **Documentation hygiene:** LICENSE files + NOTICE bundle, SECURITY.md, incident-response runbook, reconcile/retire stale audits (D1, D6–D8, D23).

> Re-emphasis: this report is a risk inventory, not legal advice or an implementation plan. Severity ratings are the auditor's judgment of relative exposure, not a legal determination.
