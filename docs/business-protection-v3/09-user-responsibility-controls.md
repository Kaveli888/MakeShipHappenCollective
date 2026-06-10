# Business Protection Blueprint — 09: User Responsibility Controls

**Document type:** Business / legal / governance protection plan (NOT an engineering plan)
**Author role:** Startup general counsel + compliance officer + operations advisor
**Subject:** Ship Ecosystem — ShipTalk, ShipMind, ShipSpace (Tauri desktop apps) + makeshiphappen.tech (Next.js web subscription)
**Operator / data controller:** MakeShipHappen — single founder (Jake, zzgemsjewelry@gmail.com)
**Posture:** US-based (Nevada/California considerations), solo-founder, pre/early-revenue
**Date:** 2026-06-07
**Grounding:** `docs/audit-v3/04-user-responsibility.md`, `00-EXECUTIVE-REPORT.md`, `13-shipspace-cluster.md`

> **Scope discipline.** This document translates the audit's responsibility matrix into *enforceable user-responsibility instruments* — click-through acceptance, consent gates documented as policy, allocation language, and safe-use guidance. It does **not** prescribe code, refactors, or architecture. Where a finding has a technical root cause (no-confinement file read, raw-PTY shell, indefinite plaintext retention, undisclosed DeepSeek egress), the protection here is a *contractual allocation, a documented consent gate, a disclosure, or user-facing guidance* — not a fix.
>
> **The load-bearing legal truth from Phase 4 you must not over-rely on:** BYOK and the "agent IDE by design" framing create an *impression* that responsibility sits with the user, but the actual architecture (indefinite plaintext retention, missing erasure, undisclosed sub-processors, unencrypted storage, client-side auth, unmet licensing) keeps responsibility firmly with the Platform owner. **You cannot contract away a duty you created by design, and you cannot obtain valid consent for a transfer you never disclosed.** Every instrument below is written to allocate to the user *only what the user actually controls* — content they originate, the decision to enable cloud features, the decision to install an MCP server, and the operation of a high-privilege shell-capable agent — and to honestly retain on the Platform owner everything the user cannot see or change.

---

## 0. How to read this document

Every control carries two tags so you can sequence highest-protection-for-lowest-effort first:

- **EFFORT** — `Low` (draft/adopt in a sitting), `Medium` (a few days, may need a counsel pass), `Long-term` (ongoing program or counsel-led drafting).
- **PROTECTION** — `High` / `Medium` / `Low` — the legal/regulatory/reputational exposure it removes.

The deliverable is **prioritized**: do the High-protection / Low-effort items in Section 1 first, then the rest. This document also depends on, and cross-references, the legal agreements in `02-legal-agreements.md` (EULA, ToS, AUP, privacy policy) and the policy suite in `05-policy-suite.md`. Where a control *establishes the user-facing surface* (the click-through, the consent gate, the warning), it lives here; where it *drafts the underlying contract text*, that is referenced to doc 02.

---

## 1. Priority quick-win matrix (do these first)

| # | Control | Effort | Protection | One-line mitigation |
|---|---|---|---|---|
| URC-1 | Click-through acceptance of EULA/ToS/AUP at signup + first install | Low | High | Makes the entire liability/allocation framework *binding* — without acceptance, every other instrument is unenforceable |
| URC-2 | First-run consent gate for ShipSpace shell/agent capability (documented acceptance of high-privilege operation) | Low | High | Allocates destructive-agent-action risk (the #1 liability hotspot) to the informed, consenting user |
| URC-3 | Cloud Features consent gate + sub-processor disclosure at the toggle | Low | High | Converts "undisclosed transfer = owner's fault" into "disclosed transfer = user's informed choice" — closes ambiguity #2 |
| URC-4 | Voice recording consent + two-party-consent user duty acknowledgment | Low | High | Shifts wiretap/recording-statute liability for who/what the user records onto the user |
| URC-5 | BYO-key spend & provider-account responsibility clause + acknowledgment | Low | High | Puts runaway provider charges and provider-ToS compliance on the key owner |
| URC-6 | User-facing Safe-Use Guidance pages (per product) | Low | Medium | Documented warnings = the duty was discharged; supports comparative-fault if user ignores them |
| URC-7 | Resolution memo for the 8 undefined-responsibility points (governance decision record) | Medium | High | Eliminates "no party is responsible" — the audit's single most dangerous state |
| URC-8 | MCP-install responsibility notice (install-time acknowledgment) | Medium | Medium | Allocates "which agents can read my data" to the user who installs the MCP server |
| URC-9 | Acceptance-evidence retention SOP (capture + store proof of consent) | Low | High | Makes URC-1 through URC-5 *provable* in a dispute; an un-evidenced clickwrap is worth little |

---

## 2. The clickwrap foundation — without this, nothing else binds

### URC-1 — Click-through acceptance of EULA / ToS / AUP
**EFFORT: Low · PROTECTION: High**

**What to implement (policy/operational, not code):** A documented **acceptance-flow specification** that the founder hands to the build backlog, plus the contract text (drafted under `02-legal-agreements.md`). The control here is the *requirement and the record*, expressed as a policy:

- **Website (makeshiphappen.tech):** signup must present a checkbox — unchecked by default — reading "I have read and agree to the [Terms of Service], [Privacy Policy], and [Acceptable Use Policy]" with working links, and account creation must be blocked until checked. This is a **clickwrap** (affirmative action), not a browsewrap (the unenforceable kind). Nevada and California courts both enforce clickwrap and routinely refuse browsewrap.
- **Desktop apps (ShipTalk, ShipMind, ShipSpace):** first-run modal presenting the **EULA + AUP**, with a scrollable pane and an "I Agree" button that gates entry to the app. The desktop apps are where the high-privilege capability lives, so the EULA acceptance here is the most important single instrument.

**Why this is the keystone.** The audit (Exec Report Legal #2; ShipSpace §9 "Critical gap") found there is *no* ToS/EULA/AUP at all — so today there is **no contract** allocating anything to anyone. Every allocation in this entire blueprint is legally inert until the user has affirmatively accepted it. This is the lowest-effort, highest-leverage protection in the document.

**Specific record requirements (the policy):** capture and store, per acceptance, the **document version hash, timestamp, user identifier, and method of acceptance**. See URC-9.

**Audit risk mitigated:** Exec Business #1, Legal #2 (no EULA/loss-shifting); ShipSpace §9 (allocation undocumented because no contract exists). **DependsOn:** `02-legal-agreements.md` (EULA/ToS/AUP text).

---

### URC-9 — Acceptance-evidence retention SOP
**EFFORT: Low · PROTECTION: High**

**Document to adopt:** `Acceptance-Evidence-Retention-SOP.md` — a one-page operational procedure stating that for every clickwrap/consent event the system records: document title + **version + content hash**, UTC timestamp, account/installation ID, and acceptance method; that these records are retained for the **statute-of-limitations window + 1 year** (Nevada breach-of-contract SOL is 6 years written / 4 years oral; California 4 years written — adopt 6 years to be safe); and that superseded document versions are archived so you can prove *which* version a given user accepted.

**Why.** A clickwrap you cannot *prove* the user saw and clicked is nearly worthless in a dispute. Courts enforce clickwrap precisely because the operator can produce the acceptance record. This SOP turns URC-1 through URC-5 from "we have terms" into "we can prove this user agreed to *this version* on *this date*."

**Audit risk mitigated:** Makes enforceable all of URC-1 through URC-5; supports Documentation #1. **DependsOn:** URC-1.

---

## 3. Consent gates for high-risk capabilities (documented as policy)

These are the three capabilities the audit singles out as the ones where consent must be explicit, informed, and recorded. Each is specified as a **consent-gate policy** (what must be disclosed, what the user must affirmatively accept, what record is kept) — not as UI code.

### URC-2 — ShipSpace high-privilege agent / shell consent gate
**EFFORT: Low · PROTECTION: High**

**Control:** A documented **first-run (and first-enable-of-autonomy) consent gate** for ShipSpace, specified in a policy `ShipSpace-High-Privilege-Consent.md`, that requires the user to affirmatively acknowledge — before agents are granted shell/file capability — language substantially as:

> "ShipSpace is a high-privilege agent development environment. By design, AI agents and terminals can run real shell commands, read files on this machine, and modify your projects with your operating-system privileges. Agents act on AI output and on external content (GitHub issues, web pages, notes) that may contain malicious instructions. **You are responsible for supervising agent actions, for backing up your data before agent runs, and for any commands you or your agents execute.** Run high-autonomy modes only on code and data you can afford to lose."

**Why this exact allocation is defensible (and where it stops).** The audit (Phase 4 §3.3; ShipSpace §8 hotspot #1, §9) holds that raw-PTY shell access is an **accepted design choice the user wields** — destructive commands the user or their agent runs are properly the user's responsibility *where the user was meaningfully informed and in control*. This gate is what makes the user "meaningfully informed." It does **not** let you offload: (a) the *no-path-confinement* file-read design (S-2 — owner's design flaw, since the user cannot scope it); (b) *indefinite plaintext scrollback* (D-1 — architecture); or (c) *prompt-injection with no provenance separation* (S-6 — owner provides no intent layer). The gate allocates the operational act; doc 02's EULA limitation-of-liability + warranty disclaimer is what caps exposure for the residual design risk. **Use both together.**

**Audit risk mitigated:** Security S-3/S-4 (arbitrary exec / raw PTY); liability hotspot #1 (agent destructive action — the single largest); Phase 4 ambiguity #4 (prompt-injection-via-agent). **DependsOn:** URC-1, `02-legal-agreements.md` (EULA liability cap + AI-output disclaimer).

---

### URC-3 — Cloud Features consent gate + at-the-toggle sub-processor disclosure
**EFFORT: Low · PROTECTION: High**

**Control:** A documented **consent gate at the "Cloud Features" / cloud-egress toggle** in ShipTalk and ShipMind (and the provider picker in ShipSpace), specified in `Cloud-Egress-Consent.md`, requiring that *before* the first cloud transmission the user is shown — and affirmatively accepts — a notice that:

- names the **specific third-party AI sub-processors** the chosen feature uses (link to the published sub-processor register — see `05-policy-suite.md` P-8),
- states plainly that **audio, transcripts, source code, notes, and/or documents leave the device** for those providers and are governed by each provider's own terms,
- **expressly flags DeepSeek as a China-based processor** where it is selectable (ShipMind, website proxy), since an undisclosed cross-border transfer is the one the user provably could not have consented to,
- and corrects, at the point of decision, any residual "on-device / private" impression.

**Why.** Phase 4 §5 ambiguity #2 and #6, and §6's first recommendation, are explicit: "Consent without disclosure is not valid consent — so the User's 'choice' cannot carry the responsibility the architecture implies." Today the user flips the toggle never having been told audio goes to Groq/OpenAI/Apple or that prompts go to DeepSeek (China). This gate is the instrument that *makes the user's choice carry the responsibility* — it converts "undisclosed transfer = owner's fault" into "disclosed transfer = user's informed choice." This is the precise mechanism Phase 4 §6 recommends.

**Marketing-truth dependency.** This gate only works if the surrounding marketing no longer says "100% on-device." A consent gate that contradicts your homepage is itself evidence of a known deceptive claim. Coordinate with the Marketing-Claims Substantiation Policy (`05-policy-suite.md` P-1) and privacy-policy alignment (P-2).

**Audit risk mitigated:** Phase 4 ambiguities #2, #6, #7; Exec Privacy #5/#8 (cross-border / undisclosed sub-processors), Legal #5/#6 (on-device deception / DeepSeek transfer), Compliance #3. **DependsOn:** `05-policy-suite.md` P-1/P-2/P-8 (sub-processor register + marketing correction).

---

### URC-4 — Voice recording consent + two-party-consent user duty
**EFFORT: Low · PROTECTION: High**

**Control:** A documented **recording-consent acknowledgment** (specified in `Recording-Consent-Control.md`, contract text under `02-legal-agreements.md`/`05` P-5) presented at first microphone use in ShipTalk, ShipMind, and ShipSpace, requiring the user to affirmatively acknowledge:

> "Voice features capture microphone audio. **You are responsible for obtaining the consent of anyone you record** and for complying with recording and wiretapping laws in your jurisdiction, including two-party (all-party) consent states such as California. Audio may be processed on-device and/or sent to a third-party transcription provider depending on your settings (see Cloud Features)."

**Why.** California is a two-party-consent state and the founder operates with California considerations noted. The audit (Legal #22, Compliance #12; Phase 4 §3.1 ShipTalk Web-Speech-to-Apple row) flags voice capture with **no consent-to-record framework** and an undisclosed possible routing of audio to Apple via Web Speech. This control allocates the *who-you-record* liability to the user (which is genuinely theirs) while honestly disclosing the *where-audio-goes* design (which is the owner's to disclose, handled jointly with URC-3).

**Audit risk mitigated:** Legal #22, Compliance #12 (two-party consent); Phase 4 §3.1 (Web Speech → Apple, undisclosed). **DependsOn:** URC-1, URC-3.

---

### URC-5 — BYO-key spend & provider-account responsibility clause
**EFFORT: Low · PROTECTION: High**

**Control:** A specific **BYOK responsibility clause** in the EULA/ToS (drafted under `02-legal-agreements.md`) plus a short acknowledgment shown when the user first enters an API key, establishing:

- the user **owns the provider account, the key, and all charges** incurred through it (including charges driven by the user's own agents, by retries, by rate-limit fail-open windows, or by runaway loops);
- the Platform owner is **not a party to the user's provider contract** and is not liable for provider billing, suspensions, or the providers' data-handling;
- the user must comply with **each enabled provider's own terms of service**;
- and MakeShipHappen makes **no representation** about provider pricing or availability.

**Why.** The audit (Exec Business #15) flags "provider billing charges borne by users' BYO keys with no account-responsibility terms → disputes over runaway provider spend land on the owner." Phase 4 §3.1/§7 assigns BYOK *spend/abuse* to the user — but only a written clause makes that allocation real. Note the audit's nuance you must preserve: BYOK shifts **cost and the provider relationship** to the user, but **does not** shift data-controller responsibility for what the software chooses to transmit/store/retain. Draft the clause to cover spend, not to overclaim a data-liability shift you don't have.

**Audit risk mitigated:** Exec Business #15 (runaway provider spend disputes); Phase 4 §7 (BYOK spend/abuse → user). **DependsOn:** URC-1.

---

### URC-8 — MCP-install responsibility notice
**EFFORT: Medium · PROTECTION: Medium**

**Control:** A documented **install-time acknowledgment** for the companion MCP servers (`shiptalk-mcp`, `shipmind-mcp`, `shipspace-mcp`), specified in `MCP-Install-Responsibility.md` and surfaced in the install/setup docs and (where feasible) at configuration time, stating:

> "Installing this MCP server exposes your [transcripts / second-brain corpus / chats and workspaces] over a local interface to **any AI agent you configure to launch it**. You are responsible for choosing which agents may access it. Do not install it into untrusted agent configurations."

**Honesty boundary the audit demands.** Phase 4 §5 ambiguity #3 splits this responsibility *per product*: the user who installs an MCP inherits "which agents can read it," but the Platform owner is responsible for **what is exposed**. ShipTalk's `get_state_raw` exposes the **Supabase auth token** with no allowlist (Critical) — that exposure is the owner's, and **no install notice can cure handing out a session token**. So this notice allocates the install decision to the user *and must be paired with* the owner-side remediation/disclosure for ShipTalk's token exposure (track in the engineering backlog and disclose in the privacy notice). Do not let this notice masquerade as a fix for the token leak.

**Audit risk mitigated:** Phase 4 ambiguity #3 (MCP installer vs. exposer); Privacy #2/#13/#14 (MCP exposure). **DependsOn:** URC-1; engineering remediation of ShipTalk `get_state_raw` (owner-side, not curable by notice).

---

## 4. User-facing safe-use guidance & warnings (documentation as protection)

### URC-6 — Per-product Safe-Use Guidance pages
**EFFORT: Low · PROTECTION: Medium**

**Documents to draft:** Four short, plain-language guidance pages — `safe-use-shiptalk.md`, `safe-use-shipmind.md`, `safe-use-shipspace.md`, `safe-use-website.md` — published in-app (Help menu) and on the website. These are *documentation*, not contract; their protective value is that **a documented, conspicuous warning discharges the duty to warn and supports a comparative-fault / assumption-of-risk argument** if a user ignores it.

**Minimum contents, mapped to audit findings:**

| Product | Warning the page must carry | Audit finding it discharges |
|---|---|---|
| ShipSpace | Don't run high-autonomy agents on irreplaceable data; back up before agent runs; agents can read any file and run shell commands; **don't type secrets into terminals** (scrollback is stored); untrusted GitHub issues / web pages can hijack an agent | S-2, S-3, S-4, S-6, D-1; Phase 4 §3.3 |
| ShipMind | Deleting a note/source may not remove the underlying audio/image file from disk; the corpus is stored unencrypted; choosing a cloud provider sends note content to that provider; DeepSeek is China-based | Privacy #6, #15; Phase 4 §3.2 |
| ShipTalk | Transcripts are retained; enabling Cloud Features sends audio/transcripts to third parties; custom dictionary terms are sent to Anthropic on each polish | Privacy #4, #17; Phase 4 §3.1 |
| Website | What data is collected, how to request export/deletion, that AI chat content is proxied to providers | Privacy #1; Compliance #1/#2 |

**Critical limit (do not overstate the guidance's reach).** Several of the items above are *owner-design failures the user cannot avoid* — orphaned files on delete (Privacy #6), no working delete UI in ShipTalk (Privacy #7), indefinite plaintext retention (Privacy #4). A warning that "deletion may not fully remove your data" **discloses** the defect; it does **not** discharge the owner's GDPR/CCPA erasure obligation or cure the deceptive "private" claim. Treat these warnings as *honest disclosure that buys you defensibility*, never as a substitute for the deletion-pipeline and retention work in `05-policy-suite.md` (P-3, P-6) and the documentation blueprint.

**Audit risk mitigated:** Documentation #2/#8/#12; Privacy #4/#6/#7/#17; supports duty-to-warn / comparative fault across all products. **DependsOn:** none to start; references P-2/P-3/P-8.

---

## 5. Resolving the responsibility ambiguities (governance decision record)

### URC-7 — Responsibility-Resolution Memo for the 8 undefined points
**EFFORT: Medium · PROTECTION: High**

**Document to draft:** `Responsibility-Resolution-Memo.md` — a dated, signed **governance decision record** that takes each of the eight "UNCLEAR / UNDEFINED" items from Phase 4 §5 and assigns a definitive owner, the instrument that establishes the allocation, and (where the resolution leans owner) the disclosure or remediation that follows. The audit is explicit that **unclear allocation is itself a liability**; the protective act is *deciding*, recording the decision, and dating it.

| # | Phase 4 §5 ambiguity | Resolution this memo records | Establishing instrument |
|---|---|---|---|
| 1 | Admin vs. owner for **Supabase RLS** | Founder, acting as **Administrator**, owns RLS correctness; assign in writing | Administrator-Role Charter (`08-governance-controls.md`) + this memo |
| 2 | Cloud egress enabled but **undisclosed** | **Owner** until disclosed; after URC-3 ships, **user's informed choice** | URC-3 consent gate + sub-processor register |
| 3 | **MCP token/corpus exposure** (installer vs. exposer) | **User** owns install choice; **owner** owns ShipTalk token exposure (remediate + disclose) | URC-8 + privacy notice + backlog ticket |
| 4 | **Prompt-injection via shell-capable agent** | **Shared**: user owns autonomy level (URC-2); owner owns provenance-separation absence (disclose) | URC-2 gate + EULA liability cap + ShipSpace safe-use page |
| 5 | **Deletion/erasure across sub-processors** (Stripe/Printful/usage logs) | **Owner**; assign deletion-execution ownership to founder as data controller | Data Deletion & Export SOP (`05` P-3) |
| 6 | **DeepSeek cross-border transfer** | **Owner** until disclosed + opt-in; then user's informed choice | URC-3 (DeepSeek flag) + sub-processor register + transfer notice |
| 7 | **"On-device"/"private" marketing vs. reality** | **Owner** (representation-maker); correct the claim | Marketing-Claims Substantiation Policy (`05` P-1) + privacy alignment (P-2) |
| 8 | **Owner-bypass safety depends on Supabase "Confirm email" toggle** | Founder, as **Administrator**, owns verifying the toggle is ON in prod | Administrator-Role Charter + verification checklist (`06-operational-protections.md`) |

**Why this is High protection.** Phase 4 calls these "the most important output of this phase, because unclear allocation is itself a liability." An item where *no party is responsible* is the worst posture in a dispute — both sides point away, and the operator (the only deep-pocket-by-default and the representation-maker) absorbs it. This memo is the cheapest way to eliminate that state: you don't have to *fix* the underlying tech to *decide and record* who owns it and what disclosure follows.

**Audit risk mitigated:** Phase 4 §5 (all 8 undefined points); Documentation #5/#12 (undocumented admin role / no shared-responsibility allocation). **DependsOn:** URC-2, URC-3, URC-8, `08-governance-controls.md` (Administrator charter), `05-policy-suite.md` (P-1/P-2/P-3).

---

## 6. Updated Responsibility Matrix — allocation + establishing instrument

This is the audit's responsibility matrix **re-expressed as enforceable allocations**, with the specific instrument that establishes each. Parties: **User / Admin(istrator) / Provider / Platform owner / Shared.** "Admin" = the founder in the infrastructure-configuration role; preserved as a distinct role per Phase 4 §1.

### 6.1 Content, capability, and operational acts

| Responsibility | Allocated to | Establishing instrument | Effort | Protection |
|---|---|---|---|---|
| Content the user dictates / uploads / pastes / prompts | **User** | EULA + AUP (`02`) accepted via URC-1 | Low | High |
| Decision to enable cloud egress (audio/notes/code leaving device) | **User** (post-disclosure) | URC-3 consent gate + sub-processor register | Low | High |
| Operating ShipSpace's high-privilege shell/agent capability | **User** | URC-2 consent gate + EULA limitation-of-liability | Low | High |
| Supervising autonomous agent actions; backing up before agent runs | **User** | URC-2 + ShipSpace safe-use page (URC-6) | Low | High |
| Commands the user/agent executes (incl. destructive) | **User** | URC-2 + EULA warranty disclaimer | Low | High |
| Recording others; two-party-consent compliance | **User** | URC-4 recording-consent acknowledgment | Low | High |
| BYO-key spend, provider billing, provider-ToS compliance | **User** | URC-5 BYOK clause | Low | High |
| Choosing which agents an installed MCP server may serve | **User** | URC-8 install notice | Medium | Medium |
| `gh` token scope / GitHub login custody | **User** | ShipSpace safe-use page (URC-6) + AUP | Low | Low |
| Securing the host machine against co-resident malware | **User** | EULA "user environment" clause + safe-use page | Low | Medium |

### 6.2 Infrastructure-configuration acts (the load-bearing Admin role)

| Responsibility | Allocated to | Establishing instrument | Effort | Protection |
|---|---|---|---|---|
| Supabase RLS correctness (cross-tenant isolation) | **Admin** | Administrator-Role Charter (`08`) + URC-7 #1 | Medium | High |
| Supabase "Confirm email" = ON in production (gates owner-bypass safety) | **Admin** | Administrator-Role Charter + verification checklist (`06`) + URC-7 #8 | Low | High |
| Release service-role + minisign private-key custody | **Admin** | Administrator-Role Charter + key-custody SOP (`06`) | Medium | High |

### 6.3 Platform-owner duties that **cannot** be shifted to the user

| Responsibility | Allocated to | Establishing instrument | Effort | Protection |
|---|---|---|---|---|
| Retention / deletion / export *design* and execution | **Platform owner** | Retention Policy + Deletion/Export SOP (`05` P-3/P-6); URC-7 #5 | Medium | High |
| Encryption-at-rest design choices | **Platform owner** | Disclosed via privacy notice + safe-use warning (URC-6) | Long-term | Medium |
| Sub-processor disclosure (incl. DeepSeek/China) | **Platform owner** | Sub-processor register (`05` P-8) + URC-3 | Low | High |
| What MCP servers *expose* (e.g. ShipTalk auth token) | **Platform owner** | Privacy notice + backlog remediation; URC-7 #3 | Medium | High |
| File/exec capability scoping (no path confinement, allowlist gaps) | **Platform owner** | Disclosed in EULA design-risk acknowledgment; URC-2 covers user's *use*, not owner's *design* | Long-term | Medium |
| Marketing accuracy ("on-device"/"private"/"legal teams") | **Platform owner** | Marketing-Claims Substantiation Policy (`05` P-1); URC-7 #7 | Low | High |
| All OSS attribution / licensing (incl. GPL ffmpeg) | **Platform owner** | IP/OSS compliance (`03-ip-and-oss-compliance.md`) — **zero user responsibility** | — | — |
| Privacy disclosures / data-subject-request fulfillment | **Platform owner** (data controller) | Privacy policy + DSR SOP (`05` P-2/P-3) | Medium | High |

### 6.4 Third-party-provider and shared allocations

| Responsibility | Allocated to | Establishing instrument | Effort | Protection |
|---|---|---|---|---|
| Processing of data once transmitted, per provider terms | **Provider** | Sub-processor register + provider ToS (user accepts via URC-5) | Low | Medium |
| PCI scope for card data | **Provider (Stripe)** | Disclosed in privacy notice; Stripe-hosted checkout (already minimized) | Low | Low |
| Fulfillment PII custody | **Provider (Printful)** + **Shared** for deletion | DPA chain + Deletion SOP (`05` P-3) covers Printful records | Medium | Low |
| OpenAI Realtime raw-key WS pattern | **Shared** (provider pattern, owner's choice to use, user's key) | Disclosed in ShipSpace safe-use page + EULA design-risk note | Low | Low |

> **The matrix's defining caveat, restated for the file:** every row in 6.1 is enforceable **only after URC-1 (clickwrap) is live and URC-9 (evidence) records it.** Every row in 6.3 stays with the owner regardless of any contract — the instruments there *disclose and discharge defensibly*, they do not transfer the duty.

---

## 7. Sequenced rollout (highest protection / lowest effort first)

1. **Same-day, Low effort, High protection:** URC-1 (clickwrap requirement + record spec), URC-9 (evidence SOP), URC-2 (ShipSpace consent gate spec), URC-4 (recording acknowledgment), URC-5 (BYOK clause), URC-6 (safe-use pages). These are drafting/policy tasks the founder can complete without counsel, though URC-1's *contract text* should get a counsel pass via `02`.
2. **Low effort, High protection, but gated on disclosure work:** URC-3 (cloud-egress consent gate) — ship the moment the sub-processor register (`05` P-8) and marketing correction (`05` P-1) exist, because a consent gate that contradicts live marketing is worse than none.
3. **Medium effort, High protection:** URC-7 (resolution memo) — do once URC-2/URC-3/URC-8 and the Administrator charter exist, since it references them.
4. **Medium effort, Medium protection:** URC-8 (MCP install notice) — paired with the owner-side ShipTalk token remediation it cannot replace.

**One-line bottom line:** The cheapest, highest-leverage move in this entire blueprint is to **make the user actually agree to something (URC-1) and prove it (URC-9)** — until then, every careful allocation above is a document no one is bound by.

---

*End of Document 09 — User Responsibility Controls. Read-only with respect to source code; the only artifacts proposed are markdown policies, contract-text briefs (drafted under doc 02), and documented consent gates/warnings. No code, refactor, or architecture change is recommended.*
