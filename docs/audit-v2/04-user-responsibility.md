# Audit v2 — Phase 4: User-Responsibility Analysis

> **NOT LEGAL ADVICE.** This is a technical auditor's structured allocation of *who would likely bear responsibility* if each feature is misused, intended to surface gaps that an Acceptable-Use Policy (AUP) / ToS must close. It is the auditor's risk-engineering view, not a legal determination of liability. Validate with counsel.
>
> **Method:** Synthesized read-only across dossiers 10–16. Citations preserved (`file:line`). Independent of `docs/audit/` and `docs/business-protection/`.
> **Date:** 2026-06-07.

**Responsibility labels:** **User** (operator of the install / supplies prompts & keys) · **Administrator** (deploys on a shared/managed machine) · **Third-party provider** (Anthropic/OpenAI/Groq/Google/Apple/Stripe/Printful/Supabase/GitHub) · **Platform owner** (MakeShipHappen / the vendor) · **Shared.**
**Clarity:** **CLEAR** = the allocation is unambiguous from product behavior + existing copy/Terms. **UNCLEAR** = behavior, defaults, or marketing muddy who is responsible (and why).
**Cluster code key:** shipmind-10, space-11, voice-12, web-13, util-14, lic-15, mktg-16.

---

## 1. ShipMind Cluster

| Feature | If misused, who is responsible? | Reasoning | CLEAR / UNCLEAR |
|---|---|---|---|
| Cloud LLM chat (ships RAG **document excerpts** to provider) | **Shared** (User picks provider+key; Provider processes; **Platform** for the "never leaves" claim) | User initiates and supplies the key, but the marketing ("not a single byte"/"documents never leave") shifts perceived responsibility for *locality* onto the vendor. | **UNCLEAR** — copy implies vendor guarantees locality it doesn't deliver (shipmind-10 P-1/L-1; mktg-16 Cat 1) |
| YouTube/media download (bundled yt-dlp) | **User** (initiates) — but Platform ships & markets the tool | User triggers each download; vendor bundles yt-dlp and advertises "ingest YouTube URLs." | **UNCLEAR** — no rights/ToS disclaimer at the ingest point (shipmind-10 L-2; mktg-16 Cat 6, `CTA.tsx:25`) |
| Web scraping / Brave search | **Shared** (User initiates; Platform ships the scraper) | `web_search`/`fetch_url` scrape arbitrary sites on user command. | **UNCLEAR** — facilitation not addressed in any AUP (shipmind-10 L-2) |
| Regulated-data use (PHI/PII/privileged) | **User/Administrator** in practice; copy shifts it to **Platform** | In reality the user is the data controller; marketing ("privilege-safe," "suits law firms/healthcare") implies vendor fitness. | **UNCLEAR** — marketing over-promises; no BAA/DPA (shipmind-10 L-1; mktg-16 Cat 2) |
| IDE file read / workspace git (read-only) | **User** (selects workspace) | User chooses what the app reads; deny-list + path-containment present. | **CLEAR** (shipmind-10 §1.1, S positives) |
| Owner-bypass / free use | **Platform** (gate is client-side, unenforced) | Paywall is bypassable by editing local JS; data is local so not a confidentiality issue. | CLEAR internally, **opaque to user** (shipmind-10 S-7) |
| AI answer accuracy ("cited"/"verifiable fact") | **Shared** (User must verify; Platform over-promises citation reliability) | RAG can hallucinate/miscite; copy frames output as fact with no accuracy disclaimer in older surfaces. | **UNCLEAR** — disclaimer only on v3 page, absent elsewhere (shipmind-10 L-3; mktg-16 Cat 8) |

---

## 2. ShipSpace Cluster (autonomous execution — emphasis)

| Feature | If misused, who is responsible? | Reasoning | CLEAR / UNCLEAR |
|---|---|---|---|
| **Raw PTY/shell to mission agents** | **Shared** (User runs; **Platform** provides unconfined shell with no typed-intent layer) | Source `TODO(security)` itself acknowledges agents get raw shell and the only confinement is OS user permissions. A jailbroken/injected agent can `rm -rf`/exfiltrate. | **UNCLEAR** — platform-supplied capability vs user act; no AUP allocates it (space-11 S-1, `pty.rs:1-10`) |
| **Auto-approve-all** (answers any permission prompt "1") | **User** (selects mode) — but design makes the human gate **opt-out** | User must affirmatively choose "all," yet doing so auto-approves shell/overwrite prompts, removing the checkpoint. | **UNCLEAR** — risky default-shift; responsibility for the auto-approved action is muddy (space-11 S-3, `auto-responder.ts:30-38`) |
| **Auto-merge** AI-authored code into the user's branch | **User** (enables toggle) — owns merged code + any copyrighted snippets | User flips the toggle; merge runs in background with no human review; provenance/license unchecked. | **UNCLEAR** — IP provenance of merged code unallocated (space-11 S-8/§5, `orchestrator.rs:796-852`) |
| `bypassPermissions` worker path | **Shared** (User + Provider AUP; Platform wires the capability) | Disables Claude's per-tool gating; off by default but reachable through the command surface; may violate provider "keep a human in the loop" terms. | **UNCLEAR** — provider-AUP compliance unstated (space-11 S-5, `orchestrator.rs:446`) |
| `read_file` (no path confinement) | **Platform** | No allowlist while `write_file` is hardened — inconsistency is the platform's design choice; can read `~/.ssh`/`~/.aws`. | **CLEAR** (platform) but **undisclosed to user** (space-11 S-2, `lib.rs:492-495`) |
| **Agent-opened GitHub PRs** under user's `gh` token | **User** (authored as the user) | PRs/commits/reviews carry the user's OAuth identity; current creation is UI-driven, not worker-autonomous. | **UNCLEAR** — if ever triggered without explicit intent, authorship/authorization attribution is ambiguous (space-11 §5, `github.rs:491-545`) |
| Data sent to cloud models (prompts, ref-file contents, terminal scrollback, browser context, issue bodies) | **Shared** (User choice + Provider processing) | No platform-side secret scrubbing; a key visible in a terminal is transmitted verbatim. | **UNCLEAR** — no redaction; user not warned (space-11 S-11, §2.4) |
| Setting/holding API keys & billing | **User** | App stores in keychain; user owns spend/limits. | **CLEAR** (space-11 §6) |
| MCP exposure of app state (shipspace-mcp) | **User** (chooses to wire MCP) | stdio trusts whoever the user connects; sensitive-key filter present. | **UNCLEAR** — trust model undocumented to user (space-11 S-10) |

---

## 3. Voice Cluster (recording of third parties — emphasis)

| Feature | If misused, who is responsible? | Reasoning | CLEAR / UNCLEAR |
|---|---|---|---|
| Local Whisper engine ("private, on-device") | **User** (local only) | Truly local — **but** undercut when Polish auto-sends the transcript to Anthropic regardless of engine. | **UNCLEAR** — "private" label persists while Polish egresses (voice-12 P-1, `polish.ts:124-198`) |
| Browser ("Instant") engine | **Shared** (User unknowingly; Apple + OpenAI process) | Web Speech routes raw audio to Apple cloud STT; a silent backup recorder uploads full session audio to OpenAI. User picked the "no-key Browser" engine. | **UNCLEAR / NOT surfaced** — backup-upload undocumented at point of choice (voice-12 P-2/P-3, `useVoiceCommands.ts:255-279`) |
| Polish (cloud rewrite) | **Shared** (User supplies Anthropic key; consents implicitly via cloud toggle) | Fires for *every* engine's output; user not re-warned it overrides the local engine. | **UNCLEAR / Partial** — no per-engine consent (voice-12 P-1) |
| Groq / OpenAI transcription engines | **Shared** (User BYO key; Provider processes) | Explicit cloud engines; user keys their own. | **CLEAR** (voice-12 §6) |
| **Recording bystanders / meeting participants** | **User** — app provides **zero** consent tooling | No consent capture, no recording notice, no two-party warning; system-audio auto-arms in meetings. | **UNCLEAR / NOT surfaced** — product auto-arms, no guardrail (voice-12 §5; util-14 L-1) |
| MCP exposure (shiptalk-mcp) | **User** (must understand any wired LLM reads all transcripts) | No auth/allow-list/redaction; `get_state_raw` exposes all localStorage. | **UNCLEAR** — no warning in MCP or app (voice-12 S-1/P-5) |
| Whisper model download | **Shared** (User trusts HF; Platform omits integrity check) | Size-only validation, no checksum/signature. | **UNCLEAR** — integrity unstated (voice-12 S-2) |
| Transcript retention | **Platform** (no purge/export controls) | Unbounded, unencrypted, no delete/export UI. | **UNCLEAR** — survives reinstall; no user control (voice-12 P-4) |
| ShipTranscribe (fully local) | **User** | No cloud egress at all. | **CLEAR** (voice-12 §1.2) |

---

## 4. Web / Commerce Cluster

| Feature | If misused, who is responsible? | Reasoning | CLEAR / UNCLEAR |
|---|---|---|---|
| ShipCode generated code | **User** ("solely responsible for reviewing, testing… not for safety-critical systems") | Terms §explicitly allocates this. | **CLEAR** (web-13 §6, `terms:138-144`) |
| BYO AI provider keys | **User** (governed by provider terms) | Disclosed in Terms/Privacy. | **CLEAR** (web-13 §6) |
| Local device data on account deletion | **User** (deletion does not remove local files) | Stated in Privacy/Terms. | **CLEAR** (web-13 §6, `privacy:42,72`) |
| Data-subject Access/Export/Delete | **Platform** (promised in policy) | Privacy promises the rights but **no implementing route** exists; manual-email-only. | **UNCLEAR** — promise without mechanism (web-13 P-1, `privacy:75-88`) |
| Subscription auto-renewal / cancel | **Shared** (User cancels; Platform must disclose at point of sale) | Terms disclose auto-renew + easy cancel; checkout CTA disclosure is weak vs ARL/click-to-cancel. | **UNCLEAR** at point of sale (web-13 L-3) |
| Age eligibility (18 / under-13 extension) | **User** (must meet age) — but unenforced & inconsistent | Stated at 18 generally, "under 13" on the extension; neither enforced at signup. | **UNCLEAR** — inconsistent + unenforced (web-13 §6/§8) |
| Merch purchase (name/address/email → Printful) | **Shared** (User provides; Platform + Printful process) | Disclosed in Privacy; Terms §9 omits Printful. | **CLEAR-ish**, minor disclosure gap (web-13 P-4/P-5) |
| ToS/Privacy acceptance | **Platform** (must obtain acceptance) | No checkbox/agree-link anywhere; weakens enforceability against the user. | **UNCLEAR** — no acceptance record (web-13 L-2) |
| ship-aos live Stripe key + no-auth API + CLI-spawn | **User/Administrator** (must keep it localhost) | Safe on localhost; becomes Critical if network-exposed. | **UNCLEAR** — no in-app guard against `-H 0.0.0.0`/tunnel (web-13 S-1) |

---

## 5. Utilities & Memory Cluster (surveillance, computer-use, memory-delete — emphasis)

| Feature | If misused, who is responsible? | Reasoning | CLEAR / UNCLEAR |
|---|---|---|---|
| Granting screen/mic/accessibility perms (ShipWatch) | **User** (macOS prompts) | OS-level consent to the install itself. | **CLEAR** (util-14 §6) |
| **Recording meeting participants lawfully (ShipWatch system-audio)** | **User** — app provides **zero** consent tooling and **auto-arms** | Auto-arm on meeting detection makes the *product* the trigger, not a deliberate user act; captures all participants. | **UNCLEAR / NOT surfaced** (util-14 L-1/P-2, `capture.ts:487-534`) |
| **Continuous screen/clipboard/activity capture** | **Shared** (User installs; defaults ON make Platform complicit) | Screen 30s / clipboard 3s / activity 5s ON by default; sensitive on-screen data captured indiscriminately; `blockedApps` empty by default (opt-out). | **UNCLEAR** — opt-out, not opt-in; no disclosure UX (util-14 P-1/P-3/P-4) |
| **ShipClick destructive actions (`bypassPermissions` computer-use)** | **User** accepts via bypassPermissions — but no per-action gate | Drives the real Mac (mouse/keyboard/shell); only brake is a prose instruction; a misheard task or screen prompt-injection triggers irreversible action. | **UNCLEAR** — only prose guardrail, no OS confirmation (util-14 S-5/L-2, `shipclick:63-68`) |
| **ship-memory write/permanent-delete by an LLM (over MCP)** | **Shared** (User must set `SHIP_MEMORY_READONLY`; **Platform** ships unsafe default) | No auth; hard delete; read-only is opt-in, not default; `cwd` arg can retarget the hub to any directory; blast radius = the cross-product `~/ShipMemory` hub. | **UNCLEAR** — unsafe default; no warning (util-14 S-7, `mcp/src/index.ts:229-276`) |
| Sending captured memories to cloud LLM | **User** (picks provider) | Provider ≠ Ollama sends OCR'd screen text/transcripts/URLs off-device. | **Partially clear** (util-14 P-6) |
| Capturing sensitive on-screen data | **User** (must configure `blockedApps`, empty by default) | Banking/health/credentials on screen are OCR'd into a searchable table. | **UNCLEAR** — opt-out, not opt-in (util-14 P-3) |
| ShipCode `runCommand`/`grepContent` (command-injection latent) | **Shared** (User runs ShipCode; **Platform** passes AI args unsanitized to shell) | The AI chooses the args; an injected pattern executes. | **UNCLEAR** — injection vector is the model, not the user (util-14 S-4) |
| ShipCode file-edit (cwd escape) | **Shared** (User approves per-op; Platform allows absolute/`../` escape) | Approval shown is the model's claimed path; fatigue-prone. | **UNCLEAR** — escape primitive + opaque approval (util-14 S-6) |
| ShipCode BYO-key billing & free-tier meter | **User** (own provider key; client-side meter) | Meter is bypassable but free tier runs on the user's own key → no operator-cost leak. | **CLEAR** (util-14 §7) |
| ShipWatch Cloud relay (operator-paid Anthropic) | **Platform/Operator** (pays Anthropic; weak transport gate) | All-interfaces bind + CORS-only gate; leaked license key spends operator credits. | **UNCLEAR** — gate inadequate (util-14 S-1/L-5) |
| ShipWatch "all running locally" framing | **Platform** (claim) vs **User** (provider choice) | "Local" understates the off-device path when a cloud provider is selected. | **UNCLEAR** — overbroad claim (util-14 §7) |

---

## 6. Licensing / IP Responsibility (cross-cutting)

| Feature | If misused, who is responsible? | Reasoning | CLEAR / UNCLEAR |
|---|---|---|---|
| Distributing GPL ffmpeg in proprietary apps | **Platform** | The vendor builds & ships the `.app`; GPL obligations attach to the distributor. | **CLEAR** (platform) — but unmet (lic-15 A.3) |
| Missing LICENSE files / "MIT" claims | **Platform** | Vendor owns the IP-terms decision; claims MIT without backing it. | **UNCLEAR** — "all rights reserved" default conflicts with public MIT claims (lic-15 A.4) |
| Missing NOTICE/attribution for bundled MIT/Apache binaries | **Platform** | Attribution obligation runs to the distributor of every binary. | **CLEAR** (platform) — but unmet (lic-15 A.3) |
| AI-generated code IP provenance (ShipGang/ShipCode output) | **Shared** (User ships it; Platform provides the generator; Provider's model produced it) | No provenance/license review on generated code. | **UNCLEAR** — provenance unallocated (space-11 §5; util-14 §7) |

---

## 7. Where responsibility is undefined

These are the gaps an **Acceptable-Use Policy / ToS allocation** must close. Each is currently **UNCLEAR** above and has no enforceable contractual home (compounded by the missing ToS-acceptance gate — web-13 L-2).

1. **Recording third parties / two-party-consent.** No feature surfaces a consent obligation; ShipWatch and ShipTalk *auto-capture/auto-arm*. The AUP must place the lawful-recording duty squarely on the User/Administrator with an explicit jurisdictional-consent warning, and the product narrative ("auto-arm," "no consent UX") must not undercut it. *(voice-12 §5; util-14 L-1/P-2)*
2. **Autonomous-agent actions with the human gate made opt-out.** Raw shell (space-11 S-1), auto-approve-all (S-3), auto-merge (S-8), and bypassPermissions computer-use (util-14 S-5/L-2) all let an agent take irreversible action. Who owns the damage when the platform supplied the unconfined capability and shipped the prose-only guardrail is undefined. *(space-11; util-14)*
3. **Regulated-data fitness.** Marketing invites PHI/privileged/student data ("privilege-safe/ferpa-safe/never leaves") but the User is the actual data controller and there is no BAA/DPA/encryption-at-rest. Responsibility for compliance fitness is *implied to the vendor* and must be explicitly reallocated to the User. *(shipmind-10 L-1; mktg-16 Cat 2)*
4. **Cloud egress under "local/private" branding.** Whether the User accepted that cloud mode / Polish / cloud providers egress their content is undefined because the labels say "private" at the moment of choice. Need an explicit per-mode egress acknowledgement. *(shipmind-10 P-1; voice-12 P-1/P-2/P-3; util-14 P-6)*
5. **ship-memory write/permanent-delete over unauthenticated MCP.** The unsafe default (read-write, not read-only) and `cwd`-retargeting mean an LLM can destroy the cross-product knowledge hub; no document tells the user they must set `SHIP_MEMORY_READONLY`. *(util-14 S-7)*
6. **MCP data exposure trust model.** shiptalk-mcp / shipmind-mcp / shipspace-mcp / ship-memory expose transcripts/state/notes to any wired LLM with no auth; the user is nominally responsible for "wiring it" but is never told what that exposes. *(voice-12 S-1; space-11 S-10; util-14 S-7)*
7. **Copyright/ToS facilitation (yt-dlp ingestion + scraping/extraction prompt packs).** No rights/ToS disclaimer accompanies the YouTube/web ingestion or the creator-prompt-extraction and competitor-dossier packs; the rights-holder responsibility is unallocated. *(shipmind-10 L-2; mktg-16 Cat 6)*
8. **AI-output reliance.** Accuracy/citation guarantees ("100% cited," "verifiable fact") with no consistent disclaimer leave reliance-responsibility undefined for high-stakes (legal/medical) users. *(mktg-16 Cat 8; shipmind-10 L-3)*
9. **Secret leakage to cloud providers.** No scrubbing on terminal/browser/issue/reference-file → provider flows; who owns a leaked key is undefined. *(space-11 S-11)*
10. **AI-generated code IP provenance.** Auto-merged/generated code may carry copyrighted snippets; provenance and indemnity are unallocated. *(space-11 §5; util-14 §7)*
11. **Network-exposure of local-only tools.** ship-aos (live Stripe key, no auth) and the ShipWatch Cloud relay are safe only on localhost; nothing allocates the User/Administrator's duty to keep them off public interfaces. *(web-13 S-1; util-14 S-1)*
12. **Data retention / deletion.** No export/purge across ShipMind, ShipTalk, ShipWatch; the web Privacy Policy *promises* rights with no implementing route — undefined who fulfills and by when. *(web-13 P-1; shipmind-10 P-3; voice-12 P-4; util-14 P-5)*
