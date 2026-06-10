# PHASE 4 — User Responsibility Analysis

For each feature: **who is responsible if it is misused or causes harm** — User (U), Administrator (A), Third-Party Provider (TP), Platform Owner (PO), or Shared (S) — with reasoning. The final section flags where responsibility is currently **undefined** (the dangerous state).

> Responsibility allocation here is the auditor's *recommended* default plus an assessment of what the product currently implies. Actual allocation must be fixed in the Terms of Service / Acceptable Use Policy (Phase 5). Where no document allocates it, the legal default tends to fall on the **Platform Owner** — which is the core problem.

---

## Responsibility matrix

| Feature | Misuse scenario | Recommended responsible party | Reasoning |
|---|---|---|---|
| **ShipTalk dictation (local)** | User dictates defamatory/illegal content | **User** | User controls input; platform is a neutral transcription tool. |
| **ShipTalk cloud STT / Polish** | Sensitive/third-party audio sent to cloud | **Shared** | User chooses to dictate, but the platform routes to cloud (and Polish fires even on "local") without clear consent → platform shares responsibility for the silent egress. |
| **Recording third parties** | Capturing a non-consenting person in a 2-party state | **User** (with platform duty to warn) | User initiates and controls the recording context; but platform must surface a consent notice or it shares exposure for enabling it blind. |
| **ShipMind ingestion (YouTube/PDF/web)** | Ripping copyrighted content | **User** | User selects sources and is the actor; platform should disclaim and restrict in AUP. Bundling yt-dlp raises platform's facilitation profile → add AUP. |
| **ShipMind cloud chat** | Privileged docs sent to LLM | **Shared** | User chooses cloud chat; platform must disclose the egress clearly or shares responsibility for the privacy-promise gap. |
| **ShipSpace agent shell exec (normal mode)** | Agent runs a harmful command on user's machine | **Shared** | User directs the agent and owns the machine; platform owns the lack of a validation layer. Approvals = the control that shifts this toward User. |
| **ShipSpace `--dangerously-bypass` / auto modes** | Destructive command auto-runs | **Platform Owner (until opt-in is explicit & logged)** | Shipping a default-dangerous mode without a clear, informed, logged opt-in keeps responsibility with the platform. Once a warned, logged opt-in exists, it shifts to **User**. |
| **ShipSpace auto-merge / auto-PR** | Bad agent code merged without review | **User** | The user enabled automation on their own repo; platform must disclose the no-review behavior. |
| **ShipClick computer-use (bypassPermissions)** | Misheard voice triggers destructive Mac action | **Platform Owner / Shared** | Physical-control + bypassed approvals + voice ambiguity is platform-designed risk; needs confirmation gates. Currently undefined → falls on platform. |
| **ShipWatch continuous capture** | Captures bystanders / sensitive screens | **Shared** | User runs it; platform provides indiscriminate capture with no consent/redaction controls. |
| **ShipWatch cloud proxy** | Open 0.0.0.0 bind abused / API spend | **Platform Owner** | Network-exposure default and credit-spending relay are platform design choices. |
| **ship-memory vault** | Plaintext sensitive notes exposed via MCP | **Shared** | User stores the data; platform provides no auth/encryption and read/write/delete over MCP. |
| **MCP servers exposing transcripts/notes** | Personal data flows to a connected LLM | **Shared** | User wires the MCP; platform exposes all data with no allow-list/redaction. |
| **makeshiphappen account/billing** | Account compromise / billing dispute | **Shared** | Platform owns auth/RLS/webhook correctness; user owns credentials. PCI is **TP (Stripe)**. |
| **Comp-access grants** | Comp never revoked → free access | **Administrator (PO)** | No auto-expiry; only the admin can revoke → squarely platform/admin responsibility. |
| **ShipCode CLI metered features** | Client-side free-tier bypass | **Shared** | User bypasses; platform chose a client-side counter for metering. Paid features remain server-gated (TP/PO). |
| **ship-aos localhost dashboard** | Network exposure → shell exec + Stripe key | **Administrator (PO)** | Single-user admin tool; responsibility is the operator's, contingent on not exposing it. |
| **AI output accuracy (all products)** | User relies on a hallucinated/incorrect answer | **User** (with mandatory disclaimer) | LLM output is probabilistic; platform must disclaim "not professional advice, verify outputs." Without the disclaimer, platform shares exposure. |
| **Third-party model behavior** | Provider mishandles or trains on data | **Third-Party Provider** | Governed by provider terms; platform's duty is to pick appropriate terms and disclose the subprocessor. |
| **Payment card data** | Card data breach | **Third-Party Provider (Stripe)** | Stripe holds PAN; keep platform in SAQ-A scope (never touch card data). |

---

## Where responsibility is currently UNCLEAR (must be defined)

These are the gaps where no document or in-product control allocates responsibility — so it defaults to the platform owner by operation of law:

1. **Cloud egress on "local-first" products.** No notice/consent tells the user their data is leaving; the platform implicitly owns the consequence. (ShipTalk Polish, cloud STT; ShipMind chat.) — **Define via consent UX + Privacy Policy + ToS.**
2. **Autonomous-agent actions.** No accepted waiver allocates the risk of destructive/irreversible agent actions to the user. (ShipSpace bypass modes, ShipClick.) — **Define via AUP + explicit, logged opt-in + liability waiver.**
3. **Recording of third parties.** No consent step or warning; the platform enabled blind recording. — **Define via in-product consent notice + AUP duty on the user.**
4. **Copyright/ToS-violating ingestion.** No AUP restricts ripping/scraping; bundling yt-dlp raises platform facilitation. — **Define via AUP prohibited-uses + user warranty of rights.**
5. **AI-output reliance.** No surfaced disclaimer; users in regulated contexts may treat output as advice. — **Define via AI-output disclaimer + acceptable-use limits.**
6. **Surveillance capture of others.** No notice/redaction; platform owns the indiscriminate-capture design. — **Define via consent controls + AUP.**
7. **Data deletion/export obligations.** Promised but not implemented; the platform owns an obligation it cannot perform. — **Define by building the capability + accurate policy.**
8. **Comp/admin actions with no expiry.** Admin (platform) solely responsible for revocation; no process. — **Define via comp-grant policy + expiry.**

**Pattern:** Every "Shared" or "Unclear" row is a place where a *written allocation* (ToS/AUP/consent UX) plus a *minimal in-product control* (a notice, a confirmation, a logged opt-in) would move responsibility from the platform to the user where it belongs — without changing the product's capabilities.
