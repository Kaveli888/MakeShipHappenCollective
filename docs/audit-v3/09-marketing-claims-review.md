# Phase 9 — Marketing Claim Review

**Audit type:** Read-only governance / legal-marketing review
**Scope:** Public-facing copy, product descriptions, branding, and supporting documents for all four products — ShipTalk, ShipMind, ShipSpace, and the makeshiphappen.tech website.
**Reviewer role:** Senior auditor + SaaS/privacy/technology attorney + compliance officer.
**Date:** 2026-06-07
**Method:** Each marketing claim was read directly from the source assets, then cross-checked against actual product behavior described in the Phase recon evidence and the Data & Storage Flow findings. Every claim is rated and grounded in `file:line` evidence.

---

## 1. Executive Summary

The makeshiphappen.tech marketing surface is, on the whole, **noticeably more disciplined than is typical for an indie AI product**. The currently-live website copy (`app/page.tsx`, `app/v3/shipmind/sections/*`) and the drafted product copy (`docs/shipmind-product-copy.md`) have evidently been revised post-security-audit: they consistently hedge cloud egress ("optional and clearly labeled," "the provider then handles your data per their policy," "speed varies by hardware"), and even carry an explicit non-certification disclaimer ("ShipMind makes no compliance certification"). The Privacy Policy is well-drafted and discloses BYO-provider data flows.

However, several claims still create **legal, security, or compliance exposure** because they assert behavior the code does **not** guarantee:

1. **"On-device" / "Private by default" framing for ShipTalk and ShipMind** is contradicted by (a) plaintext, never-pruned local transcript/DB storage readable by any local process, (b) a no-auth MCP server that exfiltrates the entire corpus, and (c) for ShipTalk, a *default* speech engine (Web Speech) that may route audio to Apple servers. The word "private" implies confidentiality the storage architecture does not provide.
2. **ShipSpace "You stay in control / Review the diff, approve"** is contradicted by an auto-responder that auto-approves risky permission prompts and an `acceptEdits` bypass mode — i.e., the product is marketed as human-gated while shipping autonomous auto-approval.
3. **The internal brand `security-plan.md` asserts "ShipSpace never executes raw model output as code... typed intents validated against a schema"** — the exact opposite of the shipped architecture (raw PTY shell, no typed-intent layer, no zod validation). If any of this language migrates to public copy, it is a material misrepresentation.
4. **Audience/customer claims** — "Same engine the fastest law-tech and decision teams ship on," "Built for legal teams," "For professionals who handle confidential work" — are unsubstantiated testimonial-style claims that simultaneously invite the *highest-stakes* (privileged/regulated) users toward a product whose data handling does not meet their obligations.
5. **The Privacy Policy promises Access/Export/Delete rights with no implemented code path**, and omits disclosure of **client-IP retention** — both deliverable-vs-reality gaps.

No live secrets were found in marketing assets. The most acute claim-vs-reality gaps are concentrated in ShipTalk and ShipSpace; ShipMind's *current copy* is largely defensible but its **legacy PDFs and the "secure/confidential professional" positioning** remain risky.

---

## 2. Methodology & Severity Scale

Each claim is rated by the **legal/compliance exposure created if a regulator, plaintiff, or aggrieved user took the claim literally and the contradicting behavior were demonstrated.**

| Severity | Meaning |
|---|---|
| **Critical** | Claim is materially false as written and targets high-stakes users; direct deceptive-advertising / breach-of-warranty exposure. |
| **High** | Claim materially overstates a privacy/security guarantee the code does not provide; plausible FTC §5 "unfair or deceptive" or state UDAP exposure. |
| **Medium** | Claim is ambiguous or partially unsupported; reasonable consumer could be misled; fixable with hedging/disclosure. |
| **Low** | Minor overstatement, missing disclosure, or unsubstantiated puffery with limited exposure. |
| **Info** | Positive finding or documentation note. |

**Asset inventory reviewed:**

| Asset | Path | Notes |
|---|---|---|
| Homepage (live) | `makeshiphappenAi/app/page.tsx` | 3,774 lines; all four products represented |
| ShipMind v3 page (live) | `makeshiphappenAi/app/v3/shipmind/sections/*.tsx` | Hero, TrustBand, LeakVsLocal, SpeedBand, Pillars, KeyAspects, etc. |
| ShipSpace v3 page (live) | `makeshiphappenAi/app/v3/shipspace/page.tsx` + `sections/Platforms.tsx` | |
| Product copy (draft) | `docs/shipmind-product-copy.md` | Funnel copy for `/v3/shipmind` |
| Brand messaging | `makeshiphappenAi/brand/messaging.md`, `doctrine.md`, `security-plan.md` | Internal canonical messaging + claimed security principles |
| Privacy Policy | `makeshiphappenAi/app/privacy/page.tsx` | |
| Security page | `makeshiphappenAi/app/security/page.tsx` | Disclosure policy only — no product claims |
| Product page mockups | repo-root `shipmind-product-page-mockup.html`, `…-v2-editorial.html` | Scanned; no stronger absolute claims found |
| Legacy collateral | repo-root `ShipMind_Private_Intelligence.pdf`, `ShipMind_Private_Second_Brain.pdf` | 14.7 MB / 11.1 MB, dated Apr 2026; tracked in ecosystem repo |
| Product READMEs | `ShipTalk/README.md`, `shipmind/README.md`, `ShipSpace/README.md` | Dev-focused; no marketing claims found |

---

## 3. Cross-Product / Brand-Level Claims

### 3.1 "Private AI-native builder operating system" / "Private by default"
- **Source:** `brand/messaging.md:9-13` (canonical line, *private* declared "load-bearing"); homepage `app/page.tsx:116` ("Private by default. No rented workflow.").
- **Behavior:** "Private" is used as the central brand pillar. In practice, ShipTalk transcripts and the ShipMind DB are stored **unencrypted at rest** and are readable by any local process and by no-auth MCP servers; cloud features egress user content to third parties. "Private by default" is *directionally* true (local-first, cloud opt-in default OFF) but the word "private" connotes confidentiality/protection that the at-rest storage does not deliver.
- **Severity: Medium.** The word "private" is doing heavy lifting at the brand level. Recommend defining it on first prominent use ("private = your data stays on your device and is never sent to our servers; it is not encrypted at rest and is not protected from other software on your machine"). Avoid letting "private" imply confidentiality/security.

### 3.2 Internal `security-plan.md` claims that contradict shipped behavior
- **Source:** `brand/security-plan.md:23-25` — *"Typed intent execution. ShipSpace never executes raw model output as code. All tool calls are typed intents validated against a schema before dispatch."* Also `:73-79` trust table: "ShipTalk — Audio capture + transcription stay on-device / Zero-telemetry promise breaks"; "ShipSpace — Tool calls bounded to mission roster."
- **Behavior:** Per recon, ShipSpace `pty.rs` explicitly documents that mission agents get a **raw PTY with NO typed-intent layer**; agent tool args are **not zod-validated** (`agentChatStore.ts`); `run_shell_cmd` gates the binary name only, not args (`node -e`, `npm` ⇒ effectively arbitrary code execution). The "typed intents validated against a schema" principle is **unimplemented**. The doc itself flags these as a "Hardening backlog" (`:34-67`) and "MUST-FIX before ShipRelease," so internally they are known to be aspirational.
- **Severity: High (if public) / Medium (currently internal).** This file is in the repo, not on the live site, so today it is an internal governance artifact. **The risk is migration:** if any of this language ("typed intents," "never executes raw model output," "zero-telemetry") is lifted into public security/marketing copy, it becomes an affirmative false statement about a security control. Flag the file so future copywriters do not treat it as approved public claims.

### 3.3 Unsubstantiated audience / customer-base claims
- **Source:** ShipMind `SpeedBand.tsx:109` — *"Same engine the fastest law-tech and decision teams ship on."* `SpeedBand.tsx:51` — *"For legal teams, executives, and anyone making fast decisions on sensitive material."* `docs/shipmind-product-copy.md:56,68` — *"For professionals who handle confidential work."*
- **Behavior:** There is no evidence in the codebase or assets of any "law-tech team," paying legal customer, or third-party validation. This reads as a testimonial/establishment claim ("the fastest … teams ship on") with **no substantiation**, and it directs the most regulated, highest-stakes users (lawyers handling privileged material) toward a product that (a) stores their material unencrypted, (b) cannot delete it completely, and (c) has a no-auth MCP read path.
- **Severity: High.** Two compounding problems: (1) "Same engine the fastest law-tech … teams ship on" is an **unsubstantiated comparative/usage claim** (FTC substantiation doctrine; "fastest" is also an unqualified superiority claim — see §6.x). (2) Courting privileged-data professionals amplifies the harm of every privacy gap. Recommend: remove "law-tech/legal teams ship on" framing entirely or replace with explicitly hypothetical use-case language ("designed for workflows where source material shouldn't leave your machine"), and pair any "confidential work" language with the existing non-certification disclaimer.

### 3.4 "Cookies: We do not use tracking cookies or third-party analytics cookies"
- **Source:** `app/privacy/page.tsx:95-99`.
- **Behavior:** Consistent with the website data finding (no PostHog/Sentry/Mixpanel/analytics SDK actually integrated). **However**, the same Privacy Policy *also* says error reports "may" be captured "via Sentry or similar tools" (`:34`) and lists Sentry as a third party (`:61`) — Sentry is **not** present in code. This is *over*-disclosure (claiming a subprocessor you don't use), which is low-risk but inconsistent.
- **Severity: Low.** Reconcile the policy with reality: either integrate Sentry or remove it from "What We Collect" and "Third Parties."

---

## 4. ShipTalk Claims

ShipTalk carries the strongest, least-qualified "on-device" language in the suite, and its storage/egress behavior diverges from that language the most.

### 4.1 "Voice transcribes on-device and injects into any app" (unqualified)
- **Source:** Homepage `app/page.tsx:2799-2801` — *"Voice transcribes on-device and injects into any app… Local or cloud, on your terms."* `app/page.tsx:78` — *"Turn your voice into text on-device."* ShipTalk header pill `app/page.tsx:2764` ("On-device"), waveform mockup `:2834` ("Local · Whisper").
- **Behavior:** ShipTalk ships **four** STT engines, of which **two are cloud** (Groq Whisper, OpenAI Whisper) and one (Web Speech) **may transmit audio to Apple servers**. When cloud STT or Anthropic polish is used, **raw audio and/or transcript leave the device** directly to third parties using the user's keys (recon: `useVoiceCommands.ts:697`, `fileTranscribe.ts:48`, `polish.ts:166`). A developer audit comment in `Cargo.toml:28` explicitly states the HTTP plugin "contradicts the 100% on-device marketing claim."
- **Mitigation present:** Cloud Features default OFF (`cloudFeatures.ts:11`); the trailing "Local or cloud, on your terms" and the stat-card "No cloud when off" (`app/page.tsx:2956`) partially qualify the headline.
- **Severity: High.** The lead clause "Voice transcribes on-device" is stated as an unconditional product behavior, then softened later. The default Web Speech engine being potentially-cloud (to Apple) is the sharpest contradiction because it can leak even when the user believes they're in "local" mode. A reasonable consumer reads "on-device" as "stays on my machine."
- **Recommendation:** Change to "Transcribe on-device with local Whisper — or use cloud engines when you choose." Disclose the Web Speech / Apple-server behavior at the engine picker. Resolve the `Cargo.toml:28` self-flagged contradiction.

### 4.2 "Privacy-First — Local mode keeps audio on your machine"
- **Source:** Homepage feature card `app/page.tsx:2990` — *"Local mode keeps audio on your machine. Cloud features use encrypted (HTTPS) connections; the provider then handles your data per their policy. You choose."*
- **Behavior:** This is a **well-hedged** card and is the model the rest of ShipTalk copy should follow. The one gap: "keeps audio on your machine" is true for audio, but the resulting **transcript** is stored **in plaintext, indefinitely, with no working delete path** (data finding: dead delete UI `App.tsx:264`, no `transcriptions.delete()` anywhere). "Privacy-First" oversells given (a) plaintext at-rest storage, (b) the no-allowlist `shiptalk-mcp` exposing the full history *and the persisted Supabase auth token* to any agent.
- **Severity: Medium.** "Privacy-First" is acceptable puffery only if paired with accurate retention/deletion behavior. Right now retention is "forever with no delete," which undercuts the privacy label.

### 4.3 "Privacy-First" vs. zero-telemetry / cross-app reading
- **Source:** Same "Privacy-First" card; brand trust table `security-plan.md:77` ("Zero-telemetry promise breaks" if audio leaves device).
- **Behavior:** ShipTalk reads the **identity of every other frontmost app** (`lib.rs:151-179`) to pick the paste target and logs it; it writes a world-readable `/tmp/shiptalk-follow.log` with live cursor/usage telemetry. Neither is disclosed. This is not "zero telemetry."
- **Severity: Medium.** If "zero telemetry" or "Privacy-First" is read against the cross-app surveillance surface and local diagnostics, it is overstated. Disclose, or stop calling it zero-telemetry.

### 4.4 "Sub-second latency" / "99+ languages"
- **Source:** `app/page.tsx:2766, 2800, 2954, 2989, 2991`.
- **Behavior:** Performance claims are **appropriately qualified** ("typically sub-second on Apple Silicon — speed varies by hardware and length"; "Local works fully offline in English," cloud handles 99+ languages). This is the correct way to make a performance claim.
- **Severity: Info (positive).** Keep the "varies by hardware" qualifier on every latency claim.

---

## 5. ShipMind Claims

ShipMind's *current live and draft copy* is the most carefully written in the suite — but it is also positioned at the most sensitive users, and its legacy PDFs carry stronger unqualified language.

### 5.1 "Your second brain, local-first" / "private second brain"
- **Source:** `docs/shipmind-product-copy.md:11,13`; homepage `app/page.tsx:52,1909-1910,3610`; v3 `Hero.tsx`, `TrustBand.tsx`.
- **Behavior:** Local-first is accurate (SQLite vault on disk, bundled Ollama embeddings, on-device Whisper). The draft copy is carefully qualified: "cloud AI is optional and clearly labeled" (`:13`), "indexing and search never touch the cloud" (`:32`), "no compliance certification" (`:70`). **Residual gap:** "second brain" + "private" implies durable confidentiality, but the DB and backups are **unencrypted** and **deletion is incomplete** (deleting a transcript/source orphans the on-disk audio/image forever — data finding). A "private second brain" that cannot fully forget is a privacy-promise gap.
- **Severity: Medium.** The word "private" is defensible *only* if the storage/deletion story is disclosed. Recommend a one-line at-rest disclosure ("stored locally, unencrypted, under your control") and fixing or disclosing the orphan-on-delete behavior before leaning on "private."

### 5.2 "Your documents stay on your Mac" / "only the prompt text leaves… never the underlying documents"
- **Source:** `docs/shipmind-product-copy.md:44,52,54` — *"only the prompt text you send to an opted-in cloud model ever leaves… never the underlying documents."* v3 `KeyAspects.tsx` ("Never leave."), `LeakVsLocal.tsx:214` (files "never escape" the shield).
- **Behavior:** This is a **specific, falsifiable claim**. Per data findings, chat/vision/Deep-Research send **transcript/source/note text and base64 images** straight to the configured provider (`providers.ts`, `vision.ts:55-220`, `deepResearch.ts`). "Prompt text" in a RAG/second-brain product **is** the retrieved document content — so "only prompt text leaves, never the underlying documents" is **misleading**: the underlying document passages are exactly what is placed into the prompt and sent. Vision sends the image itself.
- **Severity: High.** This is the most legally exposed ShipMind claim because it is precise and demonstrably contradicted: a user who pastes a contract, asks a grounded question, and uses a cloud model **does** send the contract's content to the provider. "Never the underlying documents" cannot be supported.
- **Recommendation:** Rewrite to: "Your files stay on disk. When you use a cloud model, the relevant passages retrieved to answer your question are sent to that provider as part of the prompt." The "Never leave" / "never escape" visuals should be scoped to *local-only mode*.

### 5.3 "Secure Documents" / "Built for sensitive work" / Legal & Compliance card
- **Source:** `docs/shipmind-product-copy.md:50-71` ("Secure Documents," "Legal & Compliance," "Built for sensitive work," "For professionals who handle confidential work"); v3 `SpeedBand.tsx:51,109`.
- **Behavior:** "Secure" is used as a feature header, but the DB and backups are unencrypted at rest, the MCP server is no-auth, and the webview CSP retains `unsafe-inline`/`unsafe-eval` (recon). The product offers **local-first**, not **secure**. The draft does include the strong mitigating disclaimer "ShipMind makes no compliance certification — you decide whether it fits your obligations" (`:70`) — this is good and should be kept and made prominent.
- **Severity: High.** "Secure Documents" as a headline overstates the security posture (no at-rest encryption, no access control on the local corpus). Combined with the legal/compliance/"confidential work" targeting, this is the classic pattern of marketing a security guarantee to regulated users without the controls. Rename the card "Local Documents" or "Documents stay on your machine"; reserve "secure" for behaviors actually implemented (keychain key storage *is* legitimately a security feature and can be called that).

### 5.4 "Fast AI" / "near-instant" search
- **Source:** `docs/shipmind-product-copy.md:58-62` — *"Fast local search across thousands of sources… search is near-instant — speed depends on corpus size and hardware."*
- **Behavior:** Performance claim is **properly qualified** ("speed depends on corpus size and hardware," "where the provider supports it"). Correct treatment.
- **Severity: Info (positive).**

### 5.5 API-key storage claim
- **Source:** `docs/shipmind-product-copy.md:32,54,117` — *"stored in the OS keychain — not localStorage, not a config file."* v3 `TrustBand.tsx` ("keys, stored in your OS keychain").
- **Behavior:** **Accurate.** Provider keys are in the macOS keychain (`secrets.rs`). This is a true, verifiable security claim. (Caveat: the live Supabase *session* token is in webview localStorage — but the claim is scoped to *provider keys*, which is correct.)
- **Severity: Info (positive).** This is how to make a security claim — narrow, specific, and true.

### 5.6 Legacy collateral: `ShipMind_Private_Intelligence.pdf` / `ShipMind_Private_Second_Brain.pdf`
- **Source:** repo-root, dated 2026-04-29; tracked in the ecosystem repo (untracked per `git status`, but present and named).
- **Behavior:** Filenames brand the product as "Private Intelligence" / "Private Second Brain." The content was not extractable in this read-only pass, but the *titles alone* assert "Private" without the hedging the current site has adopted. If these PDFs are distributed (and a "Private" sales PDF usually is), they likely predate the post-audit copy revisions and may contain the unqualified "100% on-device / never leaves" claims the team has since softened.
- **Severity: Medium.** **Action item:** retrieve and review both PDFs against the current hedged copy; retire or re-issue any version that makes unqualified privacy/security guarantees. A stale "Private" PDF in circulation undercuts the disclaimers added to the live site.

---

## 6. ShipSpace Claims

ShipSpace is the highest-security-surface product (arbitrary shell by design) and its copy makes the **human-control** promise most directly — which is exactly where the autonomous-auto-approval behavior contradicts it.

### 6.1 "You stay in control / Review the diff, approve" vs. auto-approval
- **Source:** Homepage `app/page.tsx:915` (*"Review the diff, approve, deploy. You stay in the loop — the agents do the typing."*), `:985` (*"You stay in control"*); v3 `shipspace/page.tsx:1166` (*"You stay in control — every diff lands under \[review\]"*), `:496` (*"Run every agent. Review every diff."*).
- **Behavior:** Per recon: `auto-responder.ts:30-38` classifies generic permission prompts as "risky" but **still auto-sends '1' (approve)** when mode = 'all'; `claude_pty_create` accepts `bypass_permissions` ⇒ `--permission-mode acceptEdits`, **auto-approving file edits** (`orchestrator.rs:442-450`). Agents run in **raw PTYs** and can `rm -rf`/`curl` exfil scoped only by OS perms. So the product *can* and *does* operate in modes where the human does **not** review each action.
- **Severity: High.** "You stay in control / review every diff" is a safety representation. If a user enables the autonomous mode the product also markets ("Up to 20 role-based agents that coordinate… and ship — *without you*," `app/page.tsx:1445-1448`), the "you review every diff" promise is **internally contradicted within the same page**. A user relying on "you stay in control" who suffers data loss from auto-approved commands has a colorable misrepresentation claim.
- **Recommendation:** Make the control claim conditional and accurate: "Review and approve each change by default — or enable autonomous mode, where agents act without per-step approval." Do not present "you review every diff" and "they ship without you" as both unconditionally true.

### 6.2 "Real files on disk — not a sandbox" / "nothing moves into a sandbox"
- **Source:** v3 `shipspace/page.tsx:1081` (*"Real files on disk — not a sandbox"*), `:1500` (*"nothing moves into a sandbox"*).
- **Behavior:** **Accurate and candid** — ShipSpace does operate on real files via real shells. This is a *truthful* disclosure, but it doubles as an admission that there is **no isolation boundary** around autonomous agents, which heightens the §6.1 control risk.
- **Severity: Low (as a claim) / Info.** The honesty is good. The exposure is that it advertises "not a sandbox" while also marketing autonomous multi-agent runs — i.e., it is truthfully advertising a risky capability. Ensure the safety/control disclosures (§6.1) are equally prominent so the "no sandbox" candor isn't read as reassurance.

### 6.3 "Audit the auth folder for unsafe patterns… surface secret leaks and risky dependencies"
- **Source:** v3 `shipspace/page.tsx:764,1438` — mission examples promising to "surface unsafe patterns, secret leaks, and risky dependencies… Returns a prioritized issue list with… a verdict."
- **Behavior:** This is an **AI-accuracy/efficacy claim** (the agent will find security issues). LLM-driven security review is non-deterministic and will both miss real issues and hallucinate. Recon also notes the **tool-calling loop is unimplemented on 4/7 providers** while `modelSupportsTools` returns true ⇒ the "grounded in checked sources" guarantee can silently fail. Marketing a security-audit "verdict" implies reliability the system cannot warrant.
- **Severity: Medium.** Frame as assistive ("helps you surface… for your review"), not authoritative ("returns a verdict on what to fix"). Avoid implying the agent's security verdicts are dependable.

### 6.4 "Bring your own keys or a local LLM" / "your codebase, your keys"
- **Source:** `app/page.tsx:66,116`.
- **Behavior:** Accurate (keychain key storage, BYO/local CLI providers). Note Perplexity/xAI are marketed-supported but **not in the http allowlist/CSP** (recon) — a functionality gap, not a claim gap.
- **Severity: Info (positive on the key claim).**

---

## 7. makeshiphappen.tech Website Claims (Commerce & Legal Pages)

### 7.1 Privacy Policy "Your Rights" (Access / Export / Delete) — no implementation
- **Source:** `app/privacy/page.tsx:78-93`; `app/deletion-export/page.tsx`.
- **Behavior:** Policy affirmatively grants Access, **Export ("in JSON format")**, Delete, and Correct, with a 30-day response commitment. The website data finding states there is **no `/api` route, script, or RPC that exports or deletes** a user's data — the only mechanism is a manual email, and tables (`usage_events`, `ip_rate_events`, billing IDs) accumulate with no deletion routine. The promised "export in JSON" capability does not exist in code.
- **Severity: High.** A privacy policy that promises GDPR/CCPA data-subject rights it cannot operationally fulfill is itself a compliance exposure (and a written representation a regulator can hold you to). "Export… in JSON format" is the most concrete and most clearly-unbuilt promise. **Action:** either build the export/delete pipeline or downgrade the policy language to what is actually performed manually, and confirm the manual process can meet the 30-day commitment.

### 7.2 Privacy Policy omits client-IP collection
- **Source:** `app/privacy/page.tsx:28-35` ("What We Collect") — lists account, subscription, usage, product data, error reports; **no mention of IP addresses.**
- **Behavior:** Website data finding: client IPs are persisted to `ip_rate_events` with no TTL/pruning (`migration 012`), pulled from `x-forwarded-for`. IP is PII under GDPR. It is collected but undisclosed.
- **Severity: Medium.** Add IP addresses (and their rate-limiting purpose + retention) to "What We Collect."

### 7.3 "Card details never touch our servers"
- **Source:** `app/privacy/page.tsx:31`.
- **Behavior:** **Accurate** — Stripe-hosted checkout; the server only receives IDs and shipping/email (website data finding). Correct, verifiable claim.
- **Severity: Info (positive).**

### 7.4 Subprocessor disclosure completeness
- **Source:** `app/privacy/page.tsx:55-67`, `/subprocessors`.
- **Behavior:** Lists Stripe, Supabase, Printful, Sentry, Vercel, AI providers. **Printful receives real shipping PII (name + postal address + email)** — disclosed as a subprocessor (`:60`) but the **data categories** (shipping PII) are not enumerated, and Printful-held data is not covered by the (non-existent) deletion flow. Sentry is listed but not integrated (§3.4).
- **Severity: Low.** Enumerate the PII categories sent to Printful; reconcile the Sentry listing.

### 7.5 Pricing consistency
- **Source:** `docs/shipmind-product-copy.md:86-110` lists ShipMind at **Free / $20 Pro / $40 Team**, explicitly flagged as "Placeholder prices… flag with Jake before launch" (`:145`). Memory/recon notes the live Stripe product is **$50/$500 (Pro/Team aka "Ultra")**.
- **Behavior:** Draft copy prices do not match the active Stripe configuration. If the draft copy ships unedited, displayed price ≠ charged price.
- **Severity: Medium.** Price misstatements are a direct consumer-protection issue. Reconcile all displayed prices with the live Stripe price IDs before publishing; the draft's own placeholder warning must be honored.

### 7.6 LibraryGate "members-only" paywall
- **Source:** `app/libraries/*`, `LibraryGate.tsx` (client-side blur).
- **Behavior:** The gate is cosmetic client-side blur; real enforcement is server-side on download/chat endpoints (recon). The *marketing claim* "members-only Libraries" is fine **only if** the gated content isn't actually shipped to unsubscribed clients inside the blurred component.
- **Severity: Low (claim) — but verify.** Confirm the libraries pages don't render real gated content (prompts/skills text) to unsubscribed users; if they do, "members-only" is false and the value is freely extractable.

---

## 8. Consolidated Claims Register

| # | Product | Claim (verbatim/paraphrase) | Source | Contradicting behavior | Severity |
|---|---|---|---|---|---|
| 3.1 | Brand | "Private… by default" (brand pillar) | `messaging.md:9-13`; `page.tsx:116` | Unencrypted at-rest storage; no-auth MCP read | Medium |
| 3.2 | Brand | "Never executes raw model output… typed intents validated" | `security-plan.md:23-25` | Raw PTY, no typed-intent layer, no arg validation | High* |
| 3.3 | ShipMind | "Fastest law-tech / legal teams ship on" | `SpeedBand.tsx:51,109` | No substantiation; targets regulated users | High |
| 3.4 | Website | "No third-party analytics" + lists Sentry | `privacy:95-99,34,61` | Sentry not integrated (over-disclosure) | Low |
| 4.1 | ShipTalk | "Voice transcribes on-device" (lead clause) | `page.tsx:78,2799` | 2 cloud engines + Web Speech→Apple; `Cargo.toml:28` self-flag | High |
| 4.2 | ShipTalk | "Privacy-First — local keeps audio on your machine" | `page.tsx:2990` | Transcript stored plaintext forever, no delete | Medium |
| 4.3 | ShipTalk | "Zero-telemetry" (brand trust table) | `security-plan.md:77` | Frontmost-app reads + `/tmp` usage log | Medium |
| 4.4 | ShipTalk | "Sub-second latency" (qualified) | `page.tsx:2989` | Properly hedged | Info+ |
| 5.1 | ShipMind | "private second brain" | `product-copy.md:11`; `page.tsx:1909` | Unencrypted DB/backups; orphan-on-delete | Medium |
| 5.2 | ShipMind | "Only prompt text leaves, never the underlying documents" | `product-copy.md:52,54` | RAG sends document passages + images to provider | High |
| 5.3 | ShipMind | "Secure Documents / Built for sensitive work" | `product-copy.md:50-71` | No at-rest encryption; no-auth MCP; CSP unsafe-* | High |
| 5.5 | ShipMind | "Keys in OS keychain, not localStorage" | `product-copy.md:32,54` | Accurate | Info+ |
| 5.6 | ShipMind | "Private Intelligence / Private Second Brain" (PDF titles) | repo-root PDFs | Likely pre-revision unqualified claims | Medium |
| 6.1 | ShipSpace | "You stay in control / review every diff" | `page.tsx:915,985`; `shipspace:1166` | Auto-responder auto-approves; `acceptEdits` bypass | High |
| 6.2 | ShipSpace | "Real files — not a sandbox" | `shipspace:1081,1500` | Accurate but admits no isolation | Low |
| 6.3 | ShipSpace | "Surface secret leaks… returns a verdict" | `shipspace:764,1438` | LLM efficacy; tool loop unimpl on 4/7 providers | Medium |
| 7.1 | Website | "Export your data in JSON / Delete account" | `privacy:78-93` | No export/delete code path exists | High |
| 7.2 | Website | "What We Collect" omits IP | `privacy:28-35` | IPs persisted to `ip_rate_events`, no TTL | Medium |
| 7.3 | Website | "Card details never touch our servers" | `privacy:31` | Accurate | Info+ |
| 7.5 | Website | ShipMind $20/$40 pricing | `product-copy.md:86-110` | Live Stripe is $50/$500 | Medium |
| 7.6 | Website | "Members-only Libraries" | `app/libraries/*` | Client-side blur only — verify content not shipped | Low |

\* High **if** moved to public copy; currently an internal doc.

---

## 9. Prioritized Recommendations

**Immediate (High severity, public-facing):**
1. **ShipMind §5.2** — Stop saying "never the underlying documents." Document content *is* the prompt in a RAG product. Rewrite to disclose that retrieved passages/images are sent to the cloud provider you choose.
2. **ShipMind §5.3 / §3.3** — Rename "Secure Documents" to "Local Documents"; remove "fastest law-tech/legal teams ship on" (unsubstantiated + targets regulated users); keep and elevate the existing "no compliance certification" disclaimer.
3. **ShipTalk §4.1** — Qualify the lead "on-device" clause everywhere; disclose Web Speech→Apple and cloud-engine egress; resolve the `Cargo.toml:28` self-flagged contradiction.
4. **ShipSpace §6.1** — Make "you stay in control / review every diff" conditional; never present it alongside "agents ship without you" as both unconditionally true.
5. **Website §7.1** — Either build the Access/Export/Delete pipeline or downgrade the Privacy Policy to the manual process actually performed; "export in JSON" must be real or removed.

**Near-term (Medium):**
6. Add IP-address collection + retention to the Privacy Policy (§7.2).
7. Reconcile ShipMind displayed pricing with live Stripe ($50/$500) before publishing draft copy (§7.5).
8. Retrieve, review, and retire/re-issue the two `ShipMind_Private_*.pdf` files against current hedged copy (§5.6).
9. Frame ShipSpace mission "security verdicts" as assistive, not authoritative (§6.3).
10. Define "private" on first prominent brand use; pair with at-rest-storage disclosure (§3.1, §5.1).
11. Reconcile Sentry (listed but not integrated) in the Privacy Policy (§3.4, §7.4).

**Governance:**
12. Flag `brand/security-plan.md` internally as **aspirational, not approved public claims** — its "typed intents / never executes raw model output / zero-telemetry" language is contradicted by shipped code (§3.2).
13. Confirm LibraryGate does not ship real gated content to unsubscribed clients (§7.6).

---

## 10. Positive Findings (Defensible Claims to Preserve)

- **Performance claims are correctly hedged** ("varies by hardware," "speed depends on corpus size") — ShipTalk §4.4, ShipMind §5.4. Keep this discipline on every speed claim.
- **"Keys in the OS keychain, not localStorage"** is true and verifiable (ShipMind §5.5; ShipSpace §6.4) — this is the right way to make a security claim.
- **"Card details never touch our servers"** is accurate (§7.3).
- **The "no compliance certification — you decide whether it fits your obligations" disclaimer** (`product-copy.md:70`) is an excellent liability-limiting line; replicate it on any page targeting professional/regulated users.
- **"Real files on disk — not a sandbox"** (§6.2) is candid risk disclosure rather than overstatement.
- **The Privacy Policy's BYO-provider and "local-first does not always mean local-only" language** (`privacy:38-43`) is honest and well-drafted; it materially mitigates the on-device overstatements elsewhere.
- **No live secrets** were found in any marketing asset; `.env*` files are gitignored.

---

*End of Phase 9 — Marketing Claim Review. All findings are read-only observations; no source was modified.*
