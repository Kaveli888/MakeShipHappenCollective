# PHASE 10 — Executive Report (Independent v2 Pass)

**MakeShipHappen Ecosystem | Independent Risk Audit | 2026-06-07**

This report is the cross-cutting synthesis of a fresh, source-derived audit (the `docs/audit-v2/` set). It was produced **without reading the prior `docs/audit/`**, so it doubles as an independent cross-check of that earlier work. Evidence dossiers: `10`–`16`; phase docs: `01`–`09`.

**Severity key:** 🔴 **Critical** · 🟠 **High** · 🟡 **Medium** · 🟢 **Low**
🔴 = material legal/financial/safety harm or launch-blocking · 🟠 = significant, fix before scaling · 🟡 = should fix, manageable · 🟢 = hygiene/defense-in-depth.

> ⚠️ **Not legal advice.** A structured technical risk inventory by an auditor. Engage licensed counsel before any commercial-launch reliance. **No code was modified, no PRs opened, no commits made, no files deleted** — the only files created are these audit documents.

---

## Executive summary

This is a **~90 GB, 12-app solo-founder ecosystem**: four desktop AI apps (ShipMind, ShipTalk, ShipSpace, ShipWatch), a live commercial web property with payments (makeshiphappen.tech / `makeshiphappenAi`), a published developer CLI (ShipCode), a Mac computer-use agent (ShipClick), a markdown second-brain engine (ship-memory), four MCP servers, a Chrome extension, and a local "AOS" app (ship-aos).

**What is genuinely strong.** Secrets hygiene is good: no live secrets are committed, desktop apps store provider keys in the **macOS Keychain** via the `keyring` crate, and `.env` files are gitignored (only the public Supabase anon JWT appears, which is public-by-design). ShipMind ships a real **SSRF guard with DNS-rebind protection and tests**, a sensitive-path deny-list, hardened git invocation, and **minisign-verified** auto-updates. The web app has **Stripe signature verification + webhook idempotency**, server-authoritative merch pricing (no client price tampering), and a recent owner-bypass fix gated on `email_confirmed_at`. The declared dependency tree (npm + Cargo) is **uniformly permissive** — no copyleft in any *source* dependency.

**Where the risk concentrates (four themes):**

1. **Privacy promise ≠ product reality.** Absolute claims — *"without sending a single byte to the cloud," "Your documents never leave your Mac," "ferpa-safe," "privilege-safe," "all processing stays on your machine"* — are marketed to lawyers, clinicians, schools, and government, while every desktop app has a real cloud-egress path. Worse, several egress paths fire **against the user's stated privacy choice**: ShipTalk's "Polish" ships the full transcript to Anthropic **even when Local Whisper is selected**, and Browser mode silently uploads full session audio to OpenAI and routes raw audio through Apple cloud STT. This is the single most repeated and most legally dangerous pattern (FTC §5 / state UDAP).

2. **Autonomous execution with the human gate made opt-out.** ShipSpace gives AI agents **raw, unconfined PTY shell** (the source itself TODO-flags "agent can execute arbitrary commands (rm -rf, curl exfiltration)"), an **auto-responder that approves *any* terminal permission prompt**, unconfined `read_file` (can read `~/.ssh`), `withGlobalTauri`, and a wired `bypassPermissions` path. ShipClick drives the physical Mac under `claude -p --permission-mode bypassPermissions` with only a prose guardrail. ShipWatch continuously captures screen/mic/clipboard/URLs **on by default** and **auto-arms meeting capture** (Zoom/Teams/FaceTime) recording all participants.

3. **A newly-found copyleft contamination.** ShipMind bundles an **ffmpeg 7.0 built `--enable-gpl` with libx264/libx265 → effectively GPLv3**, declared as an `externalBin` inside a proprietary closed app. Distributing a GPL binary in a closed commercial product triggers GPL source-offer obligations. *(This contradicts the v1 audit's "clean, no copyleft" verdict — see Reconciliation.)*

4. **Commercial governance is undocumented.** **No LICENSE file exists in any product** (despite README/ShipCode claiming "MIT"); no NOTICE/attribution bundle for shipped binaries; the published Privacy Policy promises access/export/delete with **no implementing API route**; there is **no ToS-acceptance gate** at signup/checkout; governing law is a **placeholder** ("the state in which MakeShipHappen is registered"); and four MCP servers + ship-memory expose personal transcripts/notes/state to any connected LLM with little or no auth (ship-memory allows **unauthenticated hard-delete over MCP**).

**Recommended posture:** freeze the riskiest absolute/regulated claims, swap the GPL ffmpeg build, ship the missing legal/governance documents and the promised data-rights endpoints, and make autonomous-execution + surveillance modes **explicit, logged, default-off opt-ins** — none of which requires re-architecting the products.

---

## Reconciliation with the prior `docs/audit/` (v1) — independent cross-check

Because this pass was run blind to v1, the agreements validate v1 and the divergences are worth your attention:

| Topic | v1 said | v2 (this pass) found | Net |
|---|---|---|---|
| **ffmpeg / copyleft** | "dependency tree cleanly permissive, no GPL/AGPL contamination" | ShipMind bundles **GPLv3 ffmpeg** (`--enable-gpl` + x264/x265) as an externalBin → real contamination | **v2 adds a 🔴 finding v1 missed.** Verify the build flags before distribution. |
| **Refund contradiction** (v1 B2/L5: "ToS *all sales final* vs advertised *7-day money-back*") | rated 🟠, called a guaranteed chargeback driver | **No "7-day money-back/guarantee" exists anywhere on the live site**; "all sales final/no refunds" is consistent across Terms §5, pricing FAQ, trust strips | **v2 downgrades this.** The real (minor) mismatch is Terms §4 "single $50/mo plan" vs a backend that *supports* team/ultra tiers it doesn't sell (🟢). |
| **ShipSpace `bypassPermissions`** | framed as shipped/default danger | Wired but **not set true from the renderer today**; the *live* risk is the **auto-responder approve-all** + auto-merge, not a default bypass | **v2 sharpens** — same severity, more accurate locus. |
| **Owner-email bypass** | flagged as open privilege coupling | Web path **now mitigated by `email_confirmed_at`**; desktop apps (ShipMind/ShipTalk) **still** force-grant tier client-side off a hardcoded owner email | Partially closed on web; **still open on desktop**. |
| **ShipCode client-side free-tier meter** | revenue-leakage risk | Confirmed bypassable, **but BYO-key**, so bypass only dodges the $29/mo Pro upsell — **no operator-cost leak** | **v2 downgrades** to 🟡/🟢. |
| **ShipTalk login gate** | "account login gate" assumed enforced | `AuthView` is **dead code**; app runs as `local-user` with **no enforced login** | Different framing; affects the "auth" claims. |
| Core themes (privacy-claim gap, Polish leak, autonomous shell, missing LICENSE/DPA/deletion code, ShipWatch relay bind, ship-memory exposure) | identified | **Independently reproduced** | **Strong agreement** — these are real. |

---

## 1. Top 25 BUSINESS Risks

| # | Risk | Severity |
|---|---|---|
| B1 | Absolute privacy advertising ("not a single byte to the cloud," "never leaves your Mac") vs. shipped cloud features — one screenshot of the contradiction destroys trust with the exact privacy-conscious audience the brand targets. | 🔴 |
| B2 | Reputational/safety blowback if an autonomous agent (ShipSpace shell / ShipClick computer-use) destroys a customer's files while bypass/approve-all is active. | 🔴 |
| B3 | GPLv3 ffmpeg bundled in a paid closed app → a single compliance complaint forces a source-offer or a rushed rebuild/re-release of the flagship product. | 🔴 |
| B4 | Single-founder key-person risk: all 12 apps, infra, Stripe, Supabase, domains, and signing keys depend on one person with no documented succession/continuity plan. | 🟠 |
| B5 | Marketing to regulated verticals (legal/health/education/gov) with "ferpa-safe"/"privilege-safe" badges but no certification → sales promises the product cannot legally satisfy; refund/clawback and churn. | 🟠 |
| B6 | No verified ToS-acceptance gate at signup/checkout → contracts may be unenforceable, undermining every liability limitation that protects the business. | 🟠 |
| B7 | ShipWatch is a continuous screen/mic/clipboard surveillance product *on by default* — one mishandling incident is an existential brand event for a company selling "privacy." | 🟠 |
| B8 | Stripe account concentration: a dispute spike or a deceptive-pricing finding could trigger a reserve/freeze, cutting off all revenue. | 🟠 |
| B9 | Brand leans on competitor "✗" comparison tables (NotebookLM/ChatGPT/Claude/Obsidian) the developer's own note flags as "not yet defensible" → trademark/Lanham challenge + forced retraction. | 🟠 |
| B10 | Comp-access tool grants free access with **no auto-expiry** (manual revoke) → forgotten comps = silent revenue leakage. | 🟡 |
| B11 | Reliance on third-party AI providers' pricing/availability (Anthropic/OpenAI/Groq/Google/Ollama) — deprecations or price hikes break products and margins. | 🟡 |
| B12 | ShipWatch cloud relay spends the operator's Anthropic credits behind a browser-only CORS gate → abuse = runaway API bill. | 🟡 |
| B13 | No SLA/uptime commitments defined, yet "always-on"/instant framing implies them → support burden + refund pressure. | 🟢 |
| B14 | Ecosystem sprawl (12 apps, overlapping "Ship" names) with no central product/architecture registry → inconsistent security baselines and operational confusion. | 🟡 |
| B15 | Bundled third-party binaries (ffmpeg, yt-dlp, deno, Ollama) → ongoing update/supply-chain + licensing maintenance burden. | 🟡 |
| B16 | Owner identity hardcoded as a privileged email (`zzgemsjewelry@gmail.com`) across apps → business control coupled to one personal Gmail. | 🟡 |
| B17 | No incident-response/communications plan → a breach or agent-caused harm is handled ad hoc, amplifying damage. | 🟠 |
| B18 | Printful merch fulfillment dependency: a "charged but not shipped" failure = chargebacks + FTC mail-order-rule exposure. | 🟡 |
| B19 | No claims-substantiation file for "<500ms"/"faster than typing"/"100% cited" → cannot defend an advertising challenge; retraction damages credibility. | 🟡 |
| B20 | Heavy dependence on creator-channel (TikTok) distribution → platform policy change can sever the funnel. | 🟢 |
| B21 | No documented cost/usage controls on cloud AI spend (ShipWatch relay, ShipSpace providers) → runaway bills if looped/abused. | 🟡 |
| B22 | Deprecated/stale in-repo assets (empty `shipyard-os`, old `$20/$40` mockups, `shipmind-v2` page, dead `AuthView`) risk being published inconsistently. | 🟢 |
| B23 | Customer-support/dispute process undefined → inconsistent handling erodes trust, raises chargeback losses. | 🟢 |
| B24 | No central record of which app sends which data to which provider (transparency debt) → slows enterprise deals and audits. | 🟡 |
| B25 | No analytics/consent governance → adding pixels/analytics later without consent infra invites regulatory + trust costs. | 🟢 |

---

## 2. Top 25 LEGAL Risks

| # | Risk | Severity |
|---|---|---|
| L1 | False/deceptive advertising (FTC Act §5 / state UDAP): absolute privacy claims contradicted by cloud egress. Top exposure across the ecosystem. | 🔴 |
| L2 | Privacy-promise breach as an unfair practice: ShipTalk "all processing stays on your machine" while Polish/Browser mode upload transcripts + raw audio to Anthropic/OpenAI/Apple. | 🔴 |
| L3 | "ferpa-safe"/"privilege-safe"/regulated-data claims invoke FERPA/HIPAA-adjacent duties the product is not certified for → misrepresentation + sector-specific liability. | 🔴 |
| L4 | No verified Limitation-of-Liability/warranty acceptance → uncapped exposure for AI-output harm, data loss, and agent actions. | 🔴 |
| L5 | Privacy Policy promises access/export/deletion with **no implementing code** → unfulfillable legal promise (GDPR Art. 15/17, CCPA/CPRA). | 🔴 |
| L6 | GPLv3 ffmpeg distributed inside a proprietary app → copyleft source-disclosure obligation / license breach. | 🔴 |
| L7 | Wiretap / two-party-consent law (CA, FL, IL, etc.): ShipTalk + ShipWatch capture third-party audio with **no consent UX**; ShipWatch *auto-arms* meeting capture. | 🟠 |
| L8 | Biometric law (e.g., Illinois BIPA): voiceprint/raw-audio processing once audio leaves the device, without notice/consent. | 🟠 |
| L9 | Autonomous-agent harm + CFAA-adjacent exposure: shell/computer-use agents acting on systems/data; agent-opened GitHub PRs raise authorship + authorization questions. | 🟠 |
| L10 | Auto-renewal disclosure gap (CA ARL / FTC "Click-to-Cancel"/ROSCA): subscription auto-renews with weak point-of-sale disclosure ("Cancel anytime" only). | 🟠 |
| L11 | AI-output disclaimer absent on most surfaces → hallucinated/harmful output in legal/medical/financial contexts attributed to the platform. | 🟠 |
| L12 | No Data Processing Agreement / subprocessor register despite processing PII through Anthropic/OpenAI/Groq/Google/Supabase/Stripe/Printful/Sentry → GDPR Art. 28 gap. | 🟠 |
| L13 | Printful receives customer name + shipping address but is not disclosed as a subprocessor → privacy-policy inaccuracy = deceptive practice. | 🟡 |
| L14 | No LICENSE file in any product despite "MIT" claims → ambiguous IP ownership; risk of unintentional open-sourcing of commercial code, or an unenforceable license for parts meant to be open. | 🟠 |
| L15 | Missing NOTICE/attribution bundle for MIT/Apache/BSD deps shipped in binaries → distribution license-compliance breach. | 🟡 |
| L16 | Comparative-advertising / trademark: naming NotebookLM/ChatGPT/Claude/Obsidian with "✗" cells without substantiation (Lanham §43(a)); dev's own note flags this. | 🟠 |
| L17 | Copyright/ToS-violation facilitation: bundled yt-dlp + web/PDF scraping + "prompt-extraction" packs purpose-built to lift YouTube/creator content → secondary-liability + platform-ToS exposure. | 🟠 |
| L18 | Placeholder governing-law/jurisdiction in ToS ("the state in which MakeShipHappen is registered") → venue/dispute clauses may fail. | 🟠 |
| L19 | Security warranties in copy ("AES-256 at rest," "encrypts over HTTPS") could be construed as warranties → breach-of-warranty exposure on incident. | 🟡 |
| L20 | Using vendor CLIs in `bypassPermissions`/auto-approve modes may violate Anthropic/OpenAI/Codex acceptable-use terms → account termination + breach. | 🟡 |
| L21 | Inconsistent minimum age (18 in main Terms/Privacy vs "under 13" in the extension privacy page) → COPPA/age-gating ambiguity. | 🟡 |
| L22 | No clear IP ownership/assignment for user-generated content and AI outputs in ToS → disputes over who owns generated artifacts. | 🟡 |
| L23 | Local model/whisper download without checksum/signature → if a tampered model causes harm, integrity-of-process questions arise. | 🟡 |
| L24 | No accessibility statement for the consumer web app → ADA Title III / state accessibility litigation exposure. | 🟢 |
| L25 | ship-memory permits unauthenticated hard-delete of personal notes over MCP → data-destruction liability if a connected agent is prompt-injected. | 🟡 |

---

## 3. Top 25 PRIVACY Risks

| # | Risk | Severity |
|---|---|---|
| P1 | Sensitive dictation/documents leave the device via cloud AI despite "private/local" promises (ShipTalk Polish, Browser mode, ShipMind cloud chat, ShipWatch providers). | 🔴 |
| P2 | ShipTalk Polish sends the **full transcript to Anthropic even when Local Whisper is selected** — direct contradiction of the user's privacy choice. | 🔴 |
| P3 | ShipTalk Browser mode silently uploads **full session audio to OpenAI** + routes raw audio through **Apple cloud STT** while labeled on-device. | 🔴 |
| P4 | ShipWatch continuously captures screen, mic, system audio, clipboard, app activity, and browser URLs **on by default** → an extremely sensitive aggregate profile. | 🔴 |
| P5 | No working data-deletion behind the Privacy Policy promise (GDPR Art. 17 / CCPA right to delete). | 🔴 |
| P6 | No working data-export/portability mechanism (GDPR Art. 15/20). | 🟠 |
| P7 | ShipWatch/ShipTalk capture third-party PII (faces, voices, on-screen data, meeting participants) with no consent capture or notice. | 🟠 |
| P8 | Four MCP servers (shiptalk-mcp, shipmind-mcp, shipspace-mcp, ship-memory) expose personal transcripts/notes/state to any connected LLM with no allow-list/redaction. | 🟠 |
| P9 | ship-memory stores second-brain personal notes as **plaintext, unauthenticated**, with read/write/permanent-delete over MCP stdio. | 🟠 |
| P10 | Document RAG excerpts (potentially privileged legal/health/financial content) sent to cloud LLMs in ShipMind chat. | 🟠 |
| P11 | Transcripts persist **indefinitely** in localStorage + Supabase with no retention limit or purge. | 🟠 |
| P12 | Local SQLite/transcript/screenshot/audio stores are **unencrypted at rest** → device theft exposes all captured content. | 🟡 |
| P13 | ShipWatch API/license keys held in plaintext `localStorage` → exfiltratable on any renderer compromise. | 🟡 |
| P14 | Browser-URL + app-activity capture (ShipWatch) can sweep credentials, health portals, and banking sessions visible on screen. | 🟠 |
| P15 | Cloud STT uploads **raw audio** (including bystanders) → biometric/voice processing without consent infrastructure. | 🟠 |
| P16 | Cross-product aggregation via the shared `~/ShipMemory` hub concentrates sensitive data with no unified access-control story. | 🟡 |
| P17 | Supabase stores email/name/account + full transcript text under a public anon key; privacy rests entirely on RLS that cannot be verified from the repo. | 🟠 |
| P18 | No Data Protection Impact Assessment (DPIA) for high-risk processing (surveillance, biometrics, profiling) — GDPR Art. 35. | 🟠 |
| P19 | No cookie/tracking-consent management verified → ePrivacy/CCPA gap if any analytics/pixels are added. | 🟡 |
| P20 | No subprocessor transparency for users → cannot give informed consent over where data goes (Printful, AI providers). | 🟡 |
| P21 | No breach-notification process → statutory deadlines (GDPR 72h, US state laws) would be missed. | 🟠 |
| P22 | Whisper model fetched by `curl` with a size-only check (no checksum/signature) on a component that processes private audio. | 🟡 |
| P23 | ShipCode telemetry (Supabase `usage_events` + Sentry) lacks a documented privacy notice of what events are collected. | 🟢 |
| P24 | Children's-data exposure risk given inconsistent age gating + education-vertical marketing (COPPA). | 🟡 |
| P25 | No documented retention schedule for logs that may contain prompts, file contents, terminal output, and PII. | 🟡 |

---

## 4. Top 25 SECURITY Risks

| # | Risk | Severity |
|---|---|---|
| S1 | ShipSpace agents get raw, unconfined PTY shell — the source TODO-flags "agent can execute arbitrary commands (rm -rf, curl exfiltration)" (`pty.rs:1-10`). | 🔴 |
| S2 | ShipWatch cloud relay binds **all interfaces (0.0.0.0)** with **browser-only CORS** as the sole gate before a credit-spending Anthropic call (`server/src/index.ts:95-98`). | 🔴 |
| S3 | ShipSpace auto-responder auto-approves **any** terminal permission prompt with "1"/approve, including shell-run/file-overwrite (`auto-responder.ts:30-38`). | 🟠 |
| S4 | ShipClick runs `claude -p --permission-mode bypassPermissions --max-turns 60` while physically controlling the Mac → misheard voice / on-screen prompt-injection → irreversible action (`shipclick:63-68`). | 🟠 |
| S5 | ShipSpace `read_file`/`list_directory`/`open_path` are **path-unconfined** (can read `~/.ssh`, `~/.aws`, `.env`) while writes are hardened — inconsistent containment (`lib.rs:492-495`). | 🟠 |
| S6 | ship-aos: **no auth on any API route** + accepts a **live `sk_live_` Stripe key** + spawns CLI agents — localhost-contained today (port 3737), **Critical if ever network-exposed/tunneled** (`ship-aos/src/app/api/**`). | 🟠 |
| S7 | ShipWatch accepts **arbitrary absolute paths** in `read_file`/`write_file` from the webview (write even mkdir-p's parents) (`lib.rs:116-160`). | 🟠 |
| S8 | ShipWatch holds API/license keys in plaintext `localStorage` → key theft on any renderer/XSS compromise (`ai.ts:16-79`). | 🟠 |
| S9 | ShipSpace `withGlobalTauri: true` exposes the full invoke bridge to all renderer JS (`tauri.conf.json:13`); provider keys decrypted into renderer memory on hydrate. | 🟠 |
| S10 | ShipCode `runCommand`/`grepContent` use raw `execSync` string interpolation → latent command-injection if wired to untrusted input (`tools.ts:87-88`). | 🟡 |
| S11 | ship-memory MCP allows **unauthenticated write + permanent hard-delete** of notes to any connected LLM; `cwd` arg can retarget the hub anywhere (`mcp/src/index.ts:229-276`). | 🟠 |
| S12 | ShipMind CSP retains `unsafe-eval`/`unsafe-inline` in a webview that renders untrusted ingested content and can invoke Tauri commands (`tauri.conf.json:26`). | 🟡 |
| S13 | ShipMind `fs` write/copy allow-list is `$HOME/**` → broad blast radius for XSS or a prompt-injected tool call (`capabilities/default.json:16-42`). | 🟠 |
| S14 | ShipMind sends cloud LLM provider keys **directly from the webview** (`dangerouslyAllowBrowser`) (`providers.ts:145`). | 🟡 |
| S15 | Stripe checkout webhook hardcodes `status:'active'` without re-reading Stripe; no `invoice.payment_failed`/dunning handler → state can drift from the processor (`webhook/route.ts:113-121`). | 🟡 |
| S16 | Security across the auth surface rests on **Supabase RLS that cannot be verified from source** (ShipMind/ShipTalk/web) → misconfig = full data exposure. | 🟠 |
| S17 | ShipSpace auto-merge squashes AI-authored code into the user's branch with no human review (`orchestrator.rs:796-852`). | 🟡 |
| S18 | ShipSpace `bypassPermissions` path is wired (off by default, not set from renderer today) — latent footgun if ever enabled (`orchestrator.rs:339-342`). | 🟡 |
| S19 | Owner-email client-side tier bypass persists on **desktop** apps (ShipMind/ShipTalk force-grant tier off `owner.ts`) → privilege coupling; paywall not server-enforced there. | 🟡 |
| S20 | Whisper model fetched without checksum/signature pinning → supply-chain tampering of a privacy-critical component (`lib.rs:511-541`). | 🟡 |
| S21 | Prompt-injection → exfiltration: untrusted files/web/issues/terminal-drag content reaches agents + providers with **no secret scrubbing** (ShipSpace/ShipMind). | 🟠 |
| S22 | No code-signing/attestation **verification** documented for self-distributed builds (codesign/xattr gotchas noted) → tampered-binary risk to end users. | 🟡 |
| S23 | ShipCode file-edit ops resolve absolute/`../` paths and can escape cwd (gated by a y/n prompt) (`file-ops.ts:108`). | 🟡 |
| S24 | Logs may capture prompts/file contents/terminal output/PII with no scrubbing or rotation policy. | 🟡 |
| S25 | Bundled binaries (ffmpeg, yt-dlp, deno, Ollama) have no documented update/patch process → unpatched-CVE drift; no SECURITY.md / disclosure channel. | 🟢 |

*Severity tally (Phase-7 detail, 49 findings): 🔴 2 · 🟠 15 · 🟡 15 · 🟢 17.*

---

## 5. Top 25 DOCUMENTATION Gaps

| # | Gap | Severity |
|---|---|---|
| D1 | No LICENSE file in any product despite "MIT" claims → IP ownership undefined. | 🟠 |
| D2 | No finalized Terms of Service with a verified acceptance gate (placeholder governing law live). | 🟠 |
| D3 | No accurate Privacy Policy matching actual data flows (cloud egress, subprocessors). | 🔴 |
| D4 | No Data Processing Agreement (DPA) + subprocessor register. | 🟠 |
| D5 | No data-retention & deletion policy (and no code behind the promised one). | 🟠 |
| D6 | No SECURITY.md / vulnerability-disclosure policy. | 🟡 |
| D7 | No incident-response / breach-notification runbook. | 🟠 |
| D8 | No third-party NOTICE / open-source-attribution bundle for shipped binaries. | 🟡 |
| D9 | No claims-substantiation register for performance + competitor-comparison claims. | 🟡 |
| D10 | No DPIA for high-risk processing (surveillance/biometrics/profiling). | 🟠 |
| D11 | No Acceptable-Use Policy defining prohibited uses (non-consensual recording, scraping, illegal content). | 🟠 |
| D12 | No AI-output disclaimer / accuracy-limitations notice surfaced on most surfaces. | 🟠 |
| D13 | No consistent minimum-age / COPPA policy (18 vs "under 13" conflict). | 🟡 |
| D14 | No auto-renewal/cancellation disclosure meeting CA ARL/FTC requirements at point of sale. | 🟠 |
| D15 | No per-product README documenting actual data flows / cloud usage for user transparency. | 🟡 |
| D16 | No central product/architecture registry mapping the 12 apps, providers, and data stores. | 🟡 |
| D17 | No business-continuity / key-person succession plan. | 🟡 |
| D18 | No documented secrets-rotation & key-management procedure. | 🟡 |
| D19 | No documented model-provenance/integrity policy for downloaded weights. | 🟢 |
| D20 | No accessibility statement (web). | 🟢 |
| D21 | No CONTRIBUTING / Code of Conduct for any components intended to be open. | 🟢 |
| D22 | No user-facing consent/notice for third-party recording (ShipTalk/ShipWatch). | 🟠 |
| D23 | No documented cost/usage-control policy for cloud AI spend. | 🟢 |
| D24 | Stale/contradictory in-repo artifacts (ShipTalk Feb-2026 `SECURITY_AUDIT_REPORT.md` predates cloud features; `$20/$40` mockups; `shipmind-v2`) not reconciled or retired. | 🟡 |
| D25 | No documented threat model for the autonomous-execution + surveillance features. | 🟡 |

---

## 6. Top 25 COMPLIANCE Gaps

| # | Gap | Severity |
|---|---|---|
| C1 | GDPR data-subject rights (access/erasure/portability) not operable in code → non-compliant for any EU user. | 🔴 |
| C2 | FTC Act §5 advertising substantiation — privacy + performance + comparative claims lack support. | 🔴 |
| C3 | GDPR Art. 28 — no DPA with Anthropic/OpenAI/Groq/Google/Supabase/Stripe/Printful/Sentry. | 🟠 |
| C4 | GDPR Art. 30 — no Records of Processing (ROPA). | 🟡 |
| C5 | GDPR Art. 35 — no DPIA for surveillance/biometric/profiling processing. | 🟠 |
| C6 | GDPR Art. 33/34 — no breach-notification process to meet the 72h deadline. | 🟠 |
| C7 | CCPA/CPRA — no "Do Not Sell/Share," no rights-request workflow, no rights disclosures. | 🟠 |
| C8 | CA Automatic Renewal Law — auto-renew without compliant point-of-sale disclosure/consent/cancel. | 🟠 |
| C9 | FTC "Click-to-Cancel"/ROSCA — cancellation must be as easy as sign-up; not verified. | 🟠 |
| C10 | FERPA — "ferpa-safe" badge rendered without certification or a school-as-controller agreement. | 🟠 |
| C11 | HIPAA — clinician/health targeting implies PHI handling with no BAA and cloud egress → non-compliant if used as marketed. | 🟠 |
| C12 | State two-party wiretap consent (CA/FL/IL) — recording features lack consent controls; ShipWatch auto-arms meeting capture. | 🟠 |
| C13 | Biometric laws (e.g., Illinois BIPA) — voiceprint/raw-audio processing without notice/consent. | 🟠 |
| C14 | GPL license compliance — GPLv3 ffmpeg distributed in a closed app without source offer. | 🔴 |
| C15 | Open-source attribution — missing NOTICE for MIT/Apache/BSD deps in distributed binaries. | 🟡 |
| C16 | COPPA — inconsistent age gating + education marketing risks under-13 data collection. | 🟡 |
| C17 | ADA Title III / WCAG — no accessibility conformance for the consumer web app. | 🟡 |
| C18 | PCI-DSS — relies on Stripe (good); confirm no PAN ever touches own servers/logs (SAQ-A scope). | 🟡 |
| C19 | Vendor AUP compliance — `bypassPermissions`/auto-approve modes may violate Anthropic/OpenAI/Codex terms. | 🟡 |
| C20 | EU AI Act transparency — users must be told they're interacting with AI; high-risk uses need disclosures. | 🟡 |
| C21 | Data-transfer mechanism (SCCs) for EU→US provider transfers undocumented. | 🟡 |
| C22 | Cookie/ePrivacy consent — no consent management for any tracking added. | 🟡 |
| C23 | FTC Mail/Internet Order Rule — fulfillment-timing disclosures for Printful merch. | 🟢 |
| C24 | Records of consent (ToS/Privacy acceptance, recording consent) not captured → cannot demonstrate compliance on audit. | 🟡 |
| C25 | Marketing "regulated data" support without SOC 2 / ISO 27001 attestation creates a representation gap with enterprise buyers. | 🟡 |

---

## Recommended sequencing (governance, not code)

1. **Claim-freeze (today):** Pull or qualify every absolute-privacy and named-compliance claim — "not a single byte to the cloud," "never leaves your Mac," "ferpa-safe," "privilege-safe," "all processing stays on your machine" — and replace with mode-accurate language ("local-first; optional cloud features clearly labeled"). Addresses B1, L1–L3, P1–P3, C2, C10–C11.
2. **Fix the GPL ffmpeg** before any further distribution of ShipMind: confirm the build flags and swap to an LGPL/non-GPL build, or take on the GPL source-offer obligation knowingly. Addresses B3, L6, C14.
3. **Gate autonomous execution + surveillance:** make ShipSpace shell/auto-responder/auto-merge, ShipClick computer-use, and ShipWatch capture **explicit, logged, default-off opt-ins** with warnings; never default-enable for end users. Addresses B2, S1–S9, L7–L9.
4. **Pre-scale legal pack:** finalize ToS (name governing law, add an acceptance gate), add auto-renewal disclosure, AI-output disclaimer, Acceptable-Use Policy, an accurate Privacy Policy + subprocessor list (include Printful), and a DPA template. Addresses D2–D5, D11–D14, L10–L18, C3, C7–C9.
5. **Implement the promised rights:** data export + deletion endpoints behind the Privacy Policy. Addresses D3, L5, P5–P6, C1.
6. **Documentation hygiene:** LICENSE files + NOTICE bundle, SECURITY.md, incident-response runbook, DPIA for surveillance/biometrics, and retire the stale in-repo artifacts. Addresses D1, D6–D8, D10, D24.
7. **Operational closeouts:** confirm Supabase RLS + any pending migrations applied, bind the ShipWatch relay to `127.0.0.1`, rotate any live keys, and decide ship-aos's exposure boundary. Addresses S2, S6, S16.

> Re-emphasis: this report is a risk inventory, not legal advice or an implementation plan. Severity ratings are the auditor's judgment of relative exposure, not legal determinations. No software was modified in producing it.
