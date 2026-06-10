# Phase 3 — Liability Review

**Engagement:** Make Ship Happen Collective — Whole-Ecosystem Legal & Compliance Risk Assessment
**Products in scope:** ShipTalk (macOS voice-dictation desktop app), ShipMind (macOS "second brain" desktop app), ShipSpace (macOS agentic IDE / orchestration desktop app), makeshiphappen.tech (Next.js marketing + commerce + account website)
**Reviewer role:** SaaS / privacy / technology counsel + enterprise compliance officer
**Date:** 2026-06-07
**Nature of review:** READ-ONLY. No source was modified. This document analyzes legal/business exposure only and proposes no code changes.
**Responsible legal party throughout:** the app owner/operator (Jacob Felton / "Make Ship Happen" / zzgemsjewelry@gmail.com), a single-developer commercial venture distributing paid software and selling subscriptions/merchandise.

---

## 1. Executive Summary

Make Ship Happen Collective sells four commercial products that, individually and collectively, place the operator in the legal posture of a **data controller, software distributor, and merchant** — yet the ecosystem currently ships with **no public privacy policy that matches actual data flows, no published sub-processor list, no working data-deletion mechanism, no end-user license agreement (EULA) of record, and no third-party open-source attribution.** These are not cosmetic gaps; each maps to a specific, enforceable legal obligation that is presently unmet.

The single most severe **intellectual-property exposure** is in ShipMind: a **GPLv2-or-later build of ffmpeg** (compiled `--enable-gpl --enable-libx264 --enable-libx265`, verified in the shipped binary banner) is statically bundled and distributed inside a paid, closed-source application with no source offer and no GPL notice. This is a live copyleft conflict that can trigger termination of the GPL grant, takedown demands, and statutory copyright liability.

The most severe **security/misuse exposure** is in ShipSpace, which is by deliberate design an autonomous-agent system that hands an LLM a raw shell on the user's machine (a risk the code itself flags in a `TODO(security)` comment). The product's own allowlist gates only the *name* of an executable, so `node -e`, `python -c`, and `npx <pkg>` constitute unconstrained arbitrary code execution; `read_file` has no path confinement; and untrusted third-party content (GitHub issues, scraped web pages) flows directly into the agent's instruction context. This combination creates real exposure for **user self-harm (data loss, credential theft), third-party harm (the user's machine used to attack others), and "defective/abnormally dangerous product" theories** if a customer suffers loss.

The most severe **privacy/account-takeover exposure** is the website's `/auth/cli-login` flow, which POSTs the signed-in user's **long-lived Supabase refresh token** to `http://localhost:${port}/callback` where `port` is taken unvalidated from the URL query string — a session-exfiltration design defect that converts a crafted link into a full account takeover.

Across all products, **marketing-claim risk** is acute: ShipTalk is positioned as "100% on-device" while raw audio and transcripts are transmitted to Anthropic/Groq/OpenAI (and possibly Apple) once cloud features are enabled — a contradiction the development team itself documented in an in-code AUDIT comment. Misstatements of this kind are classic **FTC Section 5 "unfair or deceptive practices" / false-advertising** exposure and, in the EU/UK, unfair-commercial-practices exposure.

These risks are amplified by the operator's structure: a **hardcoded owner-email backdoor** (`zzgemsjewelry@gmail.com`) grants the operator the top "team" tier across all three desktop apps, and entitlement gating is client-side only. This is acceptable as a UX convenience but undermines any representation that paid features are securely metered, and it concentrates legal accountability on a single named individual.

---

## 2. Severity & Likelihood Methodology

| Rating | Meaning (severity) | Likelihood bands |
|---|---|---|
| **Critical** | Existential / immediate legal action plausible (statutory copyright, regulator, account takeover at scale) | **High** — present in shipped product, exploitable/triggerable with ordinary use |
| **High** | Material lawsuit / regulator / takedown / refund-class exposure | **Medium** — requires specific user action, attacker, or complaint |
| **Medium** | Contractual/compliance breach, reputational, individual claims | **Low** — requires unusual conditions or motivated actor |
| **Low / Info** | Hygiene, latent, or defensible-but-noteworthy | — |

"Business impact" is assessed against a small single-operator commercial venture selling to individual developers and (via "team" tier) small businesses.

---

## 3. Cross-Cutting Liability Themes (All Products)

### 3.1 Privacy program does not exist in enforceable form

| Item | Status in code | Legal consequence |
|---|---|---|
| Right to erasure (GDPR Art. 17 / CCPA-CPRA) | **No working deletion path anywhere.** ShipTalk's delete button is never wired (`App.tsx:264`); no `transcriptions.delete()` exists. ShipMind `delete_transcript`/`delete_source` orphan on-disk audio/images forever (`lib.rs:3294`, `:4049`). Website deletion is a manual email to privacy@; no code route exists. | The published privacy policy *promises* deletion/export the software cannot perform. A single substantiated DSAR or complaint to a DPA/state AG converts a paper promise into a documented, knowing violation. Regulators treat "we promised erasure but built no mechanism" as an aggravating factor. |
| Data minimization / retention | **No retention/TTL/pruning anywhere** (ShipTalk history grows forever in plaintext; ShipMind backups/logs unbounded; website `ip_rate_events` and `usage_events` accumulate indefinitely). | Indefinite retention of voice transcripts, IP addresses (PII), and behavioral logs with no documented schedule is a direct minimization/storage-limitation breach (GDPR Art. 5(1)(c),(e)). |
| Sub-processor disclosure | No published list. Website's privacy page lists **Sentry/Groq/OpenRouter/Ollama that are NOT in the code**, and **omits DeepSeek (China-based)** which *is* live. | Inaccurate sub-processor disclosures (both over- and under-inclusive) are independently deceptive and undermine the lawful-transfer basis for any EU user. |
| International transfer | DeepSeek routes user prompts to a **China-based** provider with no disclosure, no SCCs, no opt-out. | Unlawful cross-border transfer of personal data for any EEA/UK user; high regulatory salience given China adequacy posture. |

**Severity: High. Likelihood: Medium.** Business impact: regulatory inquiry, mandatory remediation, and reputational damage to a privacy-positioned brand. The "second brain"/"on-device" positioning makes a privacy failure especially damaging because it directly contradicts the value proposition users paid for.

### 3.2 No EULA / license-of-record for paid software

ShipTalk's `Cargo.toml:6` declares `license = ""` with `authors = ["you"]`; ShipSpace/ShipMind manifests declare no license. There is no end-user agreement, no limitation-of-liability clause, no disclaimer of warranties, no arbitration/venue clause, and no acceptable-use policy presented to paying customers.

**Severity: High. Likelihood: Medium.** Business impact: **this is the operator's primary loss-shifting instrument and it is absent.** Without an enforceable EULA containing a warranty disclaimer and liability cap, every other technical risk below (data loss, agent destroying files, credential theft) flows back to the operator with **no contractual ceiling on damages.** For a single individual, an uncapped data-loss or breach claim is potentially ruinous. A LIBOR-grade priority for counsel.

### 3.3 Open-source compliance / attribution debt

No product ships a LICENSE, NOTICE, or THIRD-PARTY-LICENSES file or an in-app credits screen, despite distributing hundreds of MIT/BSD/Apache-2.0/ISC dependencies (all of which condition redistribution on reproducing copyright + license text) and MPL-2.0 components (file-level copyleft with source-availability duties). See §7 for the IP analysis.

### 3.4 Single-operator accountability concentration

The hardcoded `OWNER_EMAILS = ['zzgemsjewelry@gmail.com']` (verified across ShipTalk/ShipSpace/ShipMind `owner.ts`) and the personal Stripe account ("ZZ GEMZ") mean liability attaches to a named natural person with, apparently, no corporate liability shield interposed. **Strong recommendation (legal, not code): operate through an LLC/entity** so that the contractual liability caps in a future EULA actually protect personal assets.

---

## 4. ShipSpace — Arbitrary Command Execution & Agent Autonomy (Priority Focus)

ShipSpace is the highest-liability product because it intentionally executes code on the user's machine under partial control of a non-deterministic LLM and of untrusted third-party content. The risks below are inherent to the product category, but the absence of a EULA, AUP, and accurate marketing converts ordinary product risk into legal exposure.

### 4.1 Raw shell access to autonomous agents

**Evidence:** `ShipSpace/src-tauri/src/pty.rs:1-3` carries an explicit developer acknowledgment: *"TODO(security): RISK — Mission agents get raw PTY (shell) access via pty_input … An agent can execute arbitrary commands (rm -rf, curl exfiltration, etc.)."* `pty_input` (`pty.rs:352`) writes any bytes to the shell master with no validation.

**Misuse / harm scenarios:**
- **User self-harm:** a prompt-injected or hallucinating agent runs `rm -rf`, deletes the user's repo or home directory, or pushes broken code. The user's expectation (set by an "agentic IDE" pitch) is that the tool helps, not destroys.
- **Third-party harm:** the agent is steered (via injected web/issue content, see §4.3) to `curl`-exfiltrate the user's secrets or to use the user's machine and credentials to attack a *third party's* systems. The user's GitHub token (full repo scope, inherited from `gh`) could be used to tamper with repositories the user has access to but does not own.

**Aggravating legal fact:** the `TODO(security)` comment is **contemporaneous documentary evidence that the operator knew of the risk.** In litigation this defeats any "we had no reason to know" defense and supports a finding of recklessness/willfulness, and it is exactly the kind of internal admission a plaintiff's counsel or regulator will quote.

**Severity: Critical. Likelihood: Medium** (agents are non-deterministic; prompt injection is a known, demonstrated attack class). **Business impact:** product-liability / negligence exposure for foreseeable harm; if a customer's production system or a third party is damaged, the absence of a liability cap (§3.2) is decisive. *Mitigating design facts to preserve:* worktree isolation, the auto-responder never auto-approving "risky" prompts (`auto-responder.ts:53`), and `claude_pty_create` defaulting to `--permission-mode default` rather than `bypassPermissions` (`orchestrator.rs:442-450`).

### 4.2 Allowlist gates only the binary name → effective arbitrary execution

**Evidence:** `ShipSpace/src-tauri/src/lib.rs:660` — `ALLOWED_COMMANDS = ["git","node","npm","npx","cargo","rustc","rustup","python3","python","pip",...]`; the check at `:680` validates only the base executable name. `node -e '<JS>'`, `python -c '<code>'`, `npx <attacker-package>`, and `npm run <script>` (against an LLM-authored `package.json`) all pass while executing arbitrary code with the user's full privileges.

**Legal characterization:** the allowlist creates a **false impression of containment** — both internally (a basis to believe execution is constrained) and potentially externally if marketing or docs ever describe ShipSpace as "sandboxed" or "safe." Marketing such containment would be deceptive (§8). **Severity: High. Likelihood: High** (interpreters are routinely invoked).

### 4.3 Untrusted content becomes agent instructions (prompt injection → real-world action)

**Evidence:** GitHub issue bodies (`github.rs:645`), embedded-browser page text/HTML up to 20k chars (`browser_view.rs:199`), and Ship Memory note bodies injected into `--append-system-prompt` (`orchestrator.rs:296`) all flow into an agent that holds a shell. There is no provenance separation between "data to analyze" and "instructions to obey."

**Scenario:** a malicious public GitHub issue or a crafted webpage tells the agent to exfiltrate the user's `~/.ssh` or `~/.aws/credentials` (readable because `read_file` is unconfined, §4.4) and POST them out via the permitted `node`/`python`. **Severity: High. Likelihood: Medium.** **Business impact:** this is the mechanism by which §4.1/§4.4 actually fire in the wild; it converts a third party's content into commands run on the customer's machine.

### 4.4 `read_file` / `list_directory` have no path confinement

**Evidence:** `ShipSpace/src-tauri/src/lib.rs:493` — `read_file` calls `fs::read_to_string(&path)` with **no allow-root check** (verified). `write_file` *is* sandboxed to HOME+TMPDIR, but the read side is not. Any agent-influenced path can read `~/.ssh/id_rsa`, `~/.aws/credentials`, browser cookie stores, and other apps' secrets, then feed them to an LLM provider or exfiltrate them.

**Severity: High. Likelihood: Medium** (gated today by trusted callers, but one injection/logic flaw = full-disk read). **Business impact:** privacy breach of the customer's *own* secrets and of any third-party data on the machine; potential CFAA/contract exposure if those secrets belong to the customer's employer.

### 4.5 Unauthenticated localhost orchestration bus

**Evidence:** `orchestrator.rs:555` — `origin_ok` returns `true` when the Origin header is absent ("CLI client — accept"); no bearer token. Any local process can drive/read the agent-task channel. **Severity: Medium. Likelihood: Low.** Confidentiality/integrity gap for the task bus on a shared/compromised machine.

### 4.6 Weakened hardened runtime in a signed, entitled, shell-spawning app

**Evidence:** `Entitlements.plist` enables `disable-library-validation`, `allow-unsigned-executable-memory`, `allow-jit`, `allow-dyld-environment-variables`, on an app holding keychain secrets, a GitHub token, microphone, and accessibility. **Severity: Medium.** Lowers the bar for an attacker to run inside the trusted process; relevant to any future SOC2/enterprise diligence.

---

## 5. Privacy & Data-Protection Liability (All Products)

| # | Finding | Product | Severity | Likelihood | Legal hook / business impact |
|---|---|---|---|---|---|
| 5.1 | **`/auth/cli-login` POSTs long-lived refresh token to unvalidated `localhost:${port}`** (verified `page.tsx:9,35`) | Website | **Critical** | Medium | Full account takeover from a crafted link or co-resident process. Token theft = unauthorized access to user account, premium tier, and downloads. This is the highest-value single defect for breach-notification liability. |
| 5.2 | **MCP servers expose Supabase auth token + full transcript/knowledge DB over stdio with no auth** (shiptalk-mcp `get_state_raw` reads `shiptalk-auth`; shipmind-mcp opens the whole DB read-only) | ShipTalk, ShipMind | High | Medium | Any local agent inherits the user's cloud identity and entire personal corpus. Breach-notification trigger; undermines the privacy/"second brain" promise. |
| 5.3 | **Voice transcripts persisted in plaintext forever, no encryption, no deletion** (`shiptalk-history`; ShipMind unencrypted `shipmind.db` + plaintext backups) | ShipTalk, ShipMind | High | High | Indefinite retention of potentially special-category data (health, biometric-adjacent voice, legal, credentials dictated by the user). GDPR Art. 5/9, 32 (security of processing) exposure. |
| 5.4 | **On-device claim contradicted by cloud egress** (raw audio → Groq/OpenAI; transcript + dictionary → Anthropic). Team's own `Cargo.toml:28` AUDIT comment admits the contradiction. | ShipTalk | High | High | See §8 (marketing). Also a transparency/lawful-basis defect: users not told their voice leaves the device or to whom. |
| 5.5 | **Cross-tenant isolation depends entirely on undisclosed Supabase RLS**; `dictionary_terms` read with no `user_id` filter (`polish.ts:104`) | ShipTalk, ShipMind | High | Medium | If RLS is missing/loose, one user's PII-bearing terms/transcripts leak to all users — a reportable breach. Cannot be confirmed from code; **must-verify** item. |
| 5.6 | **DeepSeek (China) receives prompts; absent from disclosures and CSP** | ShipMind, Website | High | Medium | Unlawful international transfer + inaccurate sub-processor list (§3.1). |
| 5.7 | **Client IP addresses persisted to `ip_rate_events` with no TTL; not disclosed in privacy policy** | Website | Medium | Medium | IP is PII under GDPR; undisclosed indefinite retention. |
| 5.8 | **Frontmost-app identity collected & logged** (`lib.rs:151` lsappinfo/osascript) | ShipTalk | Low | Low | Collection of which apps the user runs, into unrotated logs; behavioral data with no retention policy. |
| 5.9 | **World-readable `/tmp/shiptalk-follow.log` (cursor/screen telemetry) shipped in production** | ShipTalk | Low | Medium | Leaks real-time activity to any local user; a "TEMP diagnostic" left in a release is poor data-handling hygiene. |
| 5.10 | **OpenAI Realtime sends raw API key in the WS subprotocol** (`openai-insecure-api-key.*`) + continuous mic audio to OpenAI | ShipSpace | Medium | Medium | Voice (biometric-adjacent) data to a third party; key-in-handshake exposure; no in-app residency/consent surface. |
| 5.11 | **No consent/disclosure when embedded browser captures arbitrary page content into agent context** | ShipSpace | Medium | Medium | Collection of third-party site content + prompt-injection vector; transits into persisted chat. |

**Aggregate privacy posture:** the products collect among the most sensitive data classes possible (continuous voice, full personal knowledge base, source code, screen/cursor activity, app usage) while lacking the four pillars of a defensible privacy program (accurate notice, working deletion, retention limits, sub-processor transparency). For privacy-positioned products this is the largest reputational + regulatory risk after the GPL and EULA items.

---

## 6. Security & Misuse Liability (Beyond §4)

| # | Finding | Product | Severity | Likelihood | Impact |
|---|---|---|---|---|---|
| 6.1 | **Client-side-only authorization + hardcoded owner backdoor; tier preserved on error** | All apps | High* | High | Paid-feature gating is cosmetic; safe only if every paid capability is independently enforced server-side via RLS (unverified). *Business/monetization risk, not user-harm; but a hardcoded static owner credential in every shipped binary is poor practice and a single point of compromise. |
| 6.2 | **Owner bypass safety depends on Supabase "Confirm email" being ON in prod** (`owner.ts` + `email_confirmed_at`) | Website | High | Low | If confirmation is off, an attacker registering an owner email inherits owner privileges. **Must-verify operational control.** |
| 6.3 | **Model binaries downloaded over curl/HF with no checksum/signature** | ShipTalk, ShipMind | Medium | Low | Supply-chain: a tampered model runs with app privileges. Undermines "on-device" trust story. |
| 6.4 | **Rate limiters fail OPEN on DB error; in-memory IP limiter ineffective across Vercel instances** | Website | Medium | Medium | Cost-amplification on paid AI providers and on the JWT-verify oracle during outage; abuse/fraud exposure. |
| 6.5 | **Stripe webhook continues non-idempotently if dedupe table is broken** | Website | Medium | Low | Replayed event could double-grant entitlements; billing-integrity defect. |
| 6.6 | **Provider keys held in plaintext renderer memory; permissive CSP (unsafe-inline/eval)** | ShipMind, ShipSpace | Medium | Medium | Any webview-context compromise reads all keys; keychain-at-rest protection bypassed at runtime. |
| 6.7 | **fs write/copy capability scoped to entire `$HOME/**`** (ShipMind) | ShipMind | High | Medium | An IPC-reachable script can write `~/.zshrc`/LaunchAgents → persistence/RCE primitive. |
| 6.8 | **comp-access admin grants never expire; full service-role key from local env** | Website | Medium | Medium | Indefinite free access if forgotten; high-blast-radius CLI over the whole `profiles` table. |

**Note on user-misuse exposure:** ShipMind and ShipSpace bundle `yt-dlp`, which is commonly used to download from sites whose Terms of Service prohibit it (YouTube, etc.). Shipping a tool that facilitates ToS-violating downloads can draw the operator into **contributory/secondary liability** and platform ToS disputes, independent of the software's own license. **Severity: Medium. Likelihood: Low.** An AUP disclaiming such use is the standard mitigation (currently absent).

---

## 7. Intellectual Property, Copyright & Licensing Liability

### 7.1 GPLv2+ ffmpeg statically bundled in a paid, closed-source app — **the top IP risk**

**Evidence (verified in shipped binary):** `shipmind/src-tauri/binaries/ffmpeg-*-apple-darwin` (49–128 MB), declared as a Tauri sidecar in `tauri.conf.json`. The binary's configuration banner reads `--enable-gpl … --enable-libx264 --enable-libx265 --enable-libvidstab --enable-libkvazaar … --pkg-config-flags=--static`. `--enable-gpl` plus GPL-only encoders (x264/x265/vidstab/kvazaar) make the **entire conveyed ffmpeg binary GPLv2-or-later.** No GPL license text, no written offer of corresponding source, and no attribution ship anywhere in ShipMind.

**Legal characterization:** distributing a GPL binary inside a commercial, closed-source product is permitted under GPL's aggregation rules **only if** the GPL component's obligations are met — (a) include the GPL text, (b) provide the complete corresponding source (the exact ffmpeg + x264/x265 sources and build scripts) or a valid written offer, and (c) disclose its GPL status. **None are satisfied.** Under GPLv2 §4, non-compliant distribution **automatically terminates the license**, leaving the operator distributing copyrighted code with no grant at all — i.e., ordinary copyright infringement (statutory damages, injunction, takedown). Copyright holders and enforcement organizations (e.g., the SFC) actively pursue exactly this fact pattern.

**Severity: Critical. Likelihood: Medium** (ffmpeg/x264 enforcement is well-precedented; the violation is plainly visible in the shipped binary). **Business impact:** cease-and-desist, app/distribution takedown, forced source disclosure or removal, and potential statutory copyright damages — against an individual operator. *Counsel's standard remediation paths (do not implement here): ship an LGPL-only dynamically-linked ffmpeg, rely on a user-installed/PATH ffmpeg (the code already falls back to PATH per `lib.rs:829`), or fully comply with GPL source-offer + notices.* Note ShipTranscribe/ShipTalk only PATH-resolve a system ffmpeg and therefore **do not** trigger this distribution obligation — a useful contrast that shows the compliant pattern already exists in-house.

### 7.2 No attribution / NOTICE for ~600+ permissive dependencies distributed in binaries

MIT, BSD-2/3, Apache-2.0, ISC, SIL-OFL, Unicode-3.0, and CDLA-Permissive components are statically linked/bundled across all four products with **zero** attribution file or in-app credits screen. Each of these licenses conditions redistribution on reproducing the copyright + license text (Apache-2.0 additionally requires NOTICE propagation; SIL-OFL requires shipping the OFL text with the Geist font). **Severity: Medium. Likelihood: Low-Medium.** Per-claim damages are small, but the breach spans essentially every dependency simultaneously and is a standard finding in any acquisition/enterprise diligence — a deal-blocker, not just a fine.

### 7.3 MPL-2.0 (weak copyleft) crates and bundled native code

Five MPL-2.0 crates (cssparser, selectors, dtoa-short, cssparser-macros via Tauri/wry; option-ext via keyring) are compiled into every desktop binary; whisper.cpp (MIT) is statically compiled into ShipTalk/ShipMind; deno (MIT, embeds V8/ICU with their own notices) and Ollama/ggml (MIT) are bundled in ShipMind. MPL-2.0 imposes file-level source-availability + notice duties (not contamination of the proprietary code), currently undocumented. **Severity: Low-Medium.** Manageable but unmet.

### 7.4 No GPL/AGPL contamination of first-party code (positive)

No strong copyleft was found in any package-manager dependency tree — the proprietary, closed-source business model is **not** at risk of forced source disclosure for ShipSpace/ShipMind/ShipTalk/website code itself. The IP work is **attribution + the one bundled-GPL-binary conflict**, not relicensing.

### 7.5 Trademark / brand IP (advisory)

The "Ship*" family of marks ("ShipTalk," "ShipMind," "ShipSpace," "ShipCode," etc.) should be cleared and, ideally, registered before further commercial investment; "Nano Banana" and other internal/mock provider names should not be surfaced to users as functioning products (currently a mock, `nano-banana.ts`), to avoid misrepresentation. **Severity: Low (advisory).**

---

## 8. Marketing-Claim & Consumer-Protection Liability

| # | Claim vs. reality | Severity | Likelihood | Legal hook |
|---|---|---|---|---|
| 8.1 | **"100% on-device" / "local" vs. cloud egress of raw audio + transcripts** to Anthropic/Groq/OpenAI (and possibly Apple via Web Speech). The team's own `Cargo.toml:28` comment admits this "contradicts the 100% on-device marketing claim." | **High** | High | FTC Act §5 (deceptive practice) / state UDAP / EU unfair-commercial-practices. The in-code admission is **direct evidence of knowledge**, elevating this from negligent to potentially willful. Privacy-conscious buyers chose the product *because* of this claim → materiality is clear. |
| 8.2 | **"Browser (Instant)" / "local" labeling of Web Speech** that may transmit audio to Apple servers, with no disclosure | Medium | Medium | Same UDAP framework; mislabeled data-transmission. |
| 8.3 | **Any "sandboxed/safe/secure agent" framing of ShipSpace** would conflict with the raw-shell reality (§4) | High (if claimed) | — | Deceptive safety claims about an agent that can `rm -rf` are high-risk; ensure marketing never overstates containment. |
| 8.4 | **"Grounded answers with citations" while tool-calling is implemented only for OpenAI** — on the default Groq/Anthropic models the agent answers ungrounded (`tools.ts:173`, only `openai.ts` implements the tool loop) | Medium | Medium | Feature-efficacy misrepresentation; users on default models do not receive the advertised retrieval behavior. |
| 8.5 | **Privacy policy lists sub-processors not used (Sentry/Groq/OpenRouter/Ollama) and omits one that is (DeepSeek)** | Medium | Medium | A privacy policy is a public representation; material inaccuracies are independently actionable as deceptive. |
| 8.6 | **Subscription/billing claims** — ensure auto-renewal, cancellation, and refund terms are clearly disclosed at point of sale (Stripe) | Medium | Medium | FTC "Click-to-Cancel"/ROSCA, EU consumer-rights/withdrawal, and state auto-renewal laws (e.g., CA ARL) require clear disclosure + easy cancellation. Not assessable from code; flag for the commerce flow. |

**Overarching marketing principle for counsel:** every privacy/security/efficacy claim in copy must be reconciled against the actual data flows documented in §5 and the agent behavior in §4. The "on-device" claim in particular should be corrected or qualified **immediately**, given the self-documented contradiction.

---

## 9. Contractual & Commercial Liability

| # | Issue | Severity | Notes |
|---|---|---|---|
| 9.1 | **No EULA / Terms of Service / AUP / DPA** | High | See §3.2. The single most important commercial control is missing. Without a DPA, the operator cannot lawfully act as processor for any "team"/business customer that itself has GDPR obligations. |
| 9.2 | **No SLA or warranty disclaimer for paid software** | High | Paid + no disclaimer = implied-warranty exposure (merchantability/fitness) under UCC/consumer law; an agent destroying a customer's work is a foreseeable breach. |
| 9.3 | **BYO-key model shifts provider ToS compliance to the user but is undocumented** | Medium | Users send their own keys to Anthropic/OpenAI/etc.; the operator should disclose that the user is bound by each provider's terms and is responsible for their own usage/costs. |
| 9.4 | **Auto-updater trusts a single first-party endpoint (makeshiphappen.tech) for all three apps** | Medium | Single point of supply-chain trust; signature-verified (minisign) which limits to denial/rollback, but the service-role key that publishes releases is a crown-jewel credential. A compromise/outage is a contractual-availability and security event. |
| 9.5 | **Team-invite data-model bug** (`profiles.email` queried but column does not exist) | Low | Latent functional/data-integrity defect that could cause incorrect entitlement state for business customers. |
| 9.6 | **Merch fulfillment PII to Printful with no MakeShipHappen-side record** | Low | Good minimization, but shipping PII lives in Stripe + Printful outside any deletion/export flow; must be covered by the (absent) privacy program and a Printful DPA. |

---

## 10. Prioritized Liability Register (Top Risks)

| Rank | Risk | Product | Severity | Category | Why it's #-ranked |
|---|---|---|---|---|---|
| 1 | GPLv2+ ffmpeg bundled in paid closed-source app, no source offer | ShipMind | Critical | IP/Copyright | Statutory copyright + license-termination exposure, plainly visible in shipped binary |
| 2 | No EULA / warranty disclaimer / liability cap for paid software | All | High | Contractual | Removes the operator's only loss-shifting instrument; amplifies every other risk |
| 3 | ShipSpace raw-shell agent autonomy + name-only allowlist + unconfined reads + injection | ShipSpace | Critical | Security/Misuse | Foreseeable user/third-party harm; self-documented in `TODO(security)` |
| 4 | `cli-login` refresh-token relay to unvalidated localhost port | Website | Critical | Privacy/Security | One-click full account takeover; breach-notification trigger |
| 5 | "100% on-device" claim contradicted by cloud egress (self-admitted) | ShipTalk | High | Marketing | FTC/UDAP deception with documentary evidence of knowledge |
| 6 | No working deletion + no retention limits + plaintext indefinite voice/knowledge storage | ShipTalk, ShipMind | High | Privacy | Promised erasure the software cannot perform; minimization breach |
| 7 | MCP servers leak auth token + full personal corpus over stdio, no auth | ShipTalk, ShipMind | High | Security/Privacy | Identity + corpus exfiltration to any local agent |
| 8 | Inaccurate sub-processor list + undisclosed China (DeepSeek) transfer | Website, ShipMind | High | Privacy/Compliance | Unlawful transfer + deceptive disclosure |
| 9 | Cross-tenant isolation depends on unverified Supabase RLS | ShipTalk, ShipMind | High | Privacy | Potential multi-user data leak; must-verify |
| 10 | No third-party open-source attribution shipped | All | Medium | IP/Documentation | Breach across every permissive dependency; diligence blocker |

---

## 11. Counsel's Recommended Sequencing (legal, non-code)

1. **Stop the GPL bleed (ffmpeg)** — highest legal urgency; remediate distribution method or comply, before further sales.
2. **Put an enforceable EULA + Privacy Policy + AUP + DPA in place** that *accurately* describe the data flows in §5 and the agent risks in §4, with warranty disclaimer, liability cap, and BYO-key/user-responsibility terms. Consider entity formation first (§3.4).
3. **Correct the "on-device" and sub-processor representations** to eliminate the self-admitted contradiction (§8.1) and the DeepSeek/China gap (§5.6).
4. **Confirm operational controls that the code cannot prove:** Supabase email-confirmation ON in prod (§6.2), RLS scoping per-user on every table (§5.5), and that the service-role/minisign keys are CI-only.
5. **Build (or formally document) a deletion/export pipeline** so the privacy policy's promises are technically backed (§3.1).
6. **Generate and ship third-party attribution** for all distributed binaries (§7.2–7.3).
7. **Treat the `cli-login` token relay (§5.1) and ShipSpace agent containment (§4) as security-remediation priorities** referenced by, but separate from, this legal review.

*This document is a risk assessment for the operator's internal use and does not constitute, and should be supplemented by, formal legal advice from licensed counsel in the operator's jurisdiction and target markets.*
