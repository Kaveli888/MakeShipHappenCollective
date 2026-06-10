# Phase 4 — User Responsibility Analysis

**Audit scope:** ShipTalk, ShipMind, ShipSpace, makeshiphappen.tech website
**Document type:** Read-only governance / liability allocation analysis
**Date:** 2026-06-07
**Posture:** Single-developer commercial software ecosystem. The "Platform owner / Operator" throughout is **MakeShipHappen / Jacob Felton (zzgemsjewelry@gmail.com)**. Because there is no separate corporate team, the conventional distinction between "Administrator" and "Platform owner" largely collapses — but it is preserved below wherever a self-hosting deployer (e.g. someone who configures their own Supabase project or MCP server) could occupy the Administrator role.

---

## 1. Purpose and Method

For every material feature across the four products, this document answers a single question: **if this feature is misused, abused, or causes harm, who is responsible?** Responsibility is allocated across five archetypes:

| Archetype | Definition in this ecosystem |
|---|---|
| **User** | The end user operating the desktop app or website; supplies their own API keys (BYOK), dictates/uploads content, drives agents. |
| **Administrator** | Anyone who configures backend infrastructure for a deployment — primarily the Supabase project + RLS, MCP server installation, release pipeline credentials. In this single-dev model this is almost always the Platform owner, but it is a distinct *role*. |
| **Third-party provider** | Anthropic, OpenAI, Google, Groq, DeepSeek, Perplexity, xAI, Apple (Web Speech), Supabase, Stripe, Printful, Hugging Face, GitHub, Vercel. Processors of data ShipTalk/ShipMind/ShipSpace/website send to them. |
| **Platform owner** | MakeShipHappen / the developer — designs the software, sets defaults, makes disclosures, ships binaries, controls the data model. |
| **Shared** | Responsibility is genuinely split and cannot be cleanly assigned to one party. |

A critical legal distinction runs through everything below: **BYOK (bring-your-own-key) shifts the cost and the provider-account relationship to the User, but it does NOT shift the data-controller responsibility for *what the software chooses to transmit, store, retain, and disclose*.** The Platform owner designed the data flows; that design responsibility cannot be contracted away by having the user paste in a key.

---

## 2. Cross-Cutting Responsibility Principles

Five structural facts shape nearly every row in the matrices that follow:

1. **The Platform owner is the data controller for design decisions.** Indefinite plaintext retention, missing deletion paths, undisclosed sub-processors, and unencrypted-at-rest storage are *architecture choices*, not user actions. Misuse stemming from these is the Platform owner's responsibility regardless of BYOK.

2. **The User is responsible for content they originate and for enabling cloud egress.** What a user dictates, uploads, pastes, or instructs an agent to do — and the decision to flip "Cloud Features" ON — is the User's responsibility. The provider then governs that data under its own terms.

3. **Authorization is client-side everywhere.** Subscription tier, owner-email bypass, and feature gating are all decided in the client (ShipTalk `owner.ts`, ShipMind `owner.ts`, ShipSpace `owner.ts`, website `lib/auth/owner.ts`). Server-side enforcement exists only on the website (RLS + Stripe). For the desktop apps, the only true backstop is Supabase RLS — making the **Administrator** (whoever configures RLS) the load-bearing party for any data-isolation guarantee.

4. **MCP servers have no auth boundary.** `shiptalk-mcp`, `shipmind-mcp`, and `shipspace-mcp` expose user data over stdio to any agent that can launch them. The User who *installs* an MCP server into an agent config inherits responsibility for which agents can read it; the Platform owner is responsible for *what is exposed* (e.g. ShipTalk's `get_state_raw` returning the Supabase auth token).

5. **Undisclosed sub-processors are a Platform-owner failing.** None of the products ships a sub-processor list or per-provider data-handling notice. A User cannot be responsible for a transfer they were never told about. This is the single most repeated unclear-responsibility theme below.

---

## 3. Master Responsibility Matrix

Severity reflects the *consequence if the feature is misused AND responsibility is currently misallocated or unclear*.

### 3.1 ShipTalk

| Feature / data flow | Primary responsible party | Secondary | Reasoning | Severity |
|---|---|---|---|---|
| Indefinite plaintext transcript history (`shiptalk-history` localStorage) | **Platform owner** | — | No retention/pruning/cap is an architecture decision; user cannot configure it. (`App.tsx:85,88`) | High |
| Dead transcript delete button (no working erasure path) | **Platform owner** | — | `onDeleteItem` not wired (`App.tsx:264`); no Supabase delete. User *cannot* exercise erasure even if they try. | High |
| `shiptalk-mcp` exposing Supabase auth token + full history via `get_state_raw` | **Shared** (Platform owner designs exposure; User installs MCP) | — | Platform owner exposes the token with no allowlist (`index.ts:387`); User chooses to load the MCP into an agent. Both contribute. | Critical |
| Cloud STT/polish sending audio + transcripts to Groq/OpenAI/Anthropic | **User** (enabling + content) | Third-party provider; Platform owner (disclosure) | User flips Cloud Features ON and supplies key + content; provider processes per its terms; Platform owner failed to disclose the transfer. | High |
| Web Speech possibly routing audio to Apple | **Platform owner** | Apple (Third-party) | Labeled "Browser (Instant)" with no disclosure that audio may leave device (`useVoiceCommands.ts:62`). User cannot know. | Medium |
| Frontmost-app identity capture (paste targeting) | **Platform owner** | — | App design reads + logs which app the user is in (`lib.rs:151`); transient but undisclosed/unscrubbed. | Low |
| Dictionary terms with no `user_id` scoping | **Administrator** (RLS) | Platform owner | Cross-user leakage depends entirely on Supabase RLS config (`polish.ts:104`). | High |
| Provider API keys (keychain at rest, in-memory in renderer) | **Shared** (User owns key; Platform owner owns handling) | — | Keychain storage is correct (Platform owner); but renderer-memory exposure means a key leak from XSS is shared. User owns the spend/abuse of the key itself. | Medium |
| Whisper model download with no checksum | **Platform owner** | Hugging Face (Third-party) | Supply-chain integrity is the distributor's job (`lib.rs:511`). | Medium |
| `/tmp/shiptalk-follow.log` world-readable diagnostics | **Platform owner** | — | Shipped TEMP diagnostic; user has no control (`lib.rs:862`). | Low |
| Client-side tier + owner-email backdoor | **Platform owner** (design) | Administrator (RLS backstop) | Trivially spoofable tier (`owner.ts:1`, `auth.ts:78`). Misuse = entitlement theft, owner's design problem. | High |
| Missing privacy/data-flow disclosure | **Platform owner** | — | Transparency obligation is non-delegable. | Medium |

### 3.2 ShipMind

| Feature / data flow | Primary responsible party | Secondary | Reasoning | Severity |
|---|---|---|---|---|
| Orphaned audio/image files on delete (`delete_transcript`/`delete_source`) | **Platform owner** | — | DB-row-only delete leaves raw voice/files on disk forever (`lib.rs:3294,4049`). User believes data is gone. Right-to-erasure failure by design. | High |
| No retention/TTL/pruning (backups, tmp, logs, audio) | **Platform owner** | — | Unbounded "forever" retention for a privacy-positioned product (`lib.rs:489`). | Medium |
| Unencrypted SQLite DB + backups at rest | **Platform owner** | — | No SQLCipher; full second brain in cleartext, captured by iCloud/Time Machine. | Medium |
| `shipmind-mcp` exposing entire DB with no auth | **Shared** (Platform owner exposes; User installs) | — | No auth on stdio (`index.ts:40`); User decides which agents can spawn it. | Medium |
| Full corpus egress to up to 11 AI providers (incl. DeepSeek/China) | **User** (provider + content choice) | Third-party provider; Platform owner (disclosure + residency) | User chooses provider + key; but no sub-processor list, no residency control, no DeepSeek disclosure = Platform owner failing for the *transfer to a China-based processor*. | High |
| `dangerouslyAllowBrowser` + direct-from-renderer key use | **Platform owner** | User (key owner) | XSS-driven key/corpus exfil is an architecture risk owned by design. | High |
| Home-wide raw file readers (`read_file_text`/`list_directory`) | **Platform owner** | — | Deny-list (not allow-list) lets prompt-injected agents read `~/.ssh` etc. (`lib.rs:1754`). | High |
| `$HOME/**` fs write/copy capability | **Platform owner** | — | Persistence/RCE write primitive scoped far too broadly (`capabilities/default.json:16`). | High |
| Gemini key in URL query string | **Platform owner** | — | Key-in-URL leaks to logs (`providers.ts:331`). | Low |
| Chrome extension dead ingest path (`:8765`) | **Platform owner** | — | User sets an ingest token that does nothing; clarity/governance gap. | Low |
| Client-side owner bypass (2 hardcoded emails) | **Platform owner** (design) | Administrator (RLS) | `owner.ts:3`; entitlement integrity rests on RLS. | Low |
| Tool-calling only works on OpenAI (silent ungrounded answers) | **Platform owner** | — | Core "grounded with citations" promise silently fails on default Groq/Claude (`agents/tools.ts:173`). Truth-in-function. | High |

### 3.3 ShipSpace

ShipSpace is, **by deliberate design, a high-privilege agent IDE**. This materially shifts responsibility toward the **User** for operational outcomes — but only where the user was meaningfully informed and in control. Where the software auto-acts or hides a transfer, responsibility returns to the Platform owner.

| Feature / data flow | Primary responsible party | Secondary | Reasoning | Severity |
|---|---|---|---|---|
| Raw PTY shell access for agents (`rm -rf`, exfil possible) | **User** | Platform owner (design risk acknowledged) | Documented accepted design (`pty.rs:1`); User wields a real shell. User responsible for destructive commands they (or their agent) run. | High |
| Terminal scrollback persisted plaintext indefinitely (secrets typed in) | **Platform owner** | User (what they type) | No retention/clear-history is design (`useWorkspaceSessionStore.ts:38`); but the User typed the secret into the terminal. | High |
| `read_file`/`list_directory` with no path confinement | **Platform owner** | — | Asymmetric vs. confined `write_file`; full-disk read primitive (`lib.rs:492`). | High |
| `run_shell_cmd` allowlist gates only binary name (node/python = arbitrary exec) | **Platform owner** | User | False sense of containment (`lib.rs:660`); but interpreters are user/agent-driven. | High |
| Orchestrator MCP HTTP server with no auth | **Platform owner** | — | localhost task bus drivable by any same-user process (`orchestrator.rs:555`). | Medium |
| OpenAI Realtime raw key in WS subprotocol | **Shared** | OpenAI (Third-party) | OpenAI's documented "insecure" pattern; ShipSpace has no backend to mint ephemeral tokens. User's key, OpenAI's pattern, owner's choice to use it. | Medium |
| Perplexity/xAI egress not in allowlist/CSP | **Platform owner** | — | Config inconsistency: either broken or unscoped egress (`perplexity.ts:49`, `xai.ts:47`). | Medium |
| Untrusted GitHub issues / web pages fed into agent context (prompt injection) | **Shared** | User (acts on output) | Platform owner provides no provenance separation; User decides how autonomously the agent acts on injected instructions. | Medium |
| Browser captures arbitrary page content into agents | **User** (initiates) | Platform owner (no consent/retention notice) | User drives the capture; owner stores it plaintext with no notice. | Medium |
| GitHub via `gh` CLI (ambient full-repo token) | **User** | GitHub (Third-party) | User owns the `gh` login + scopes; ShipSpace inherits, doesn't store. | Info |
| Weakened hardened runtime (disable-library-validation, dyld env) | **Platform owner** | — | Packaging decision lowers code-injection bar (`Entitlements.plist`). | Medium |
| Auto-responder never auto-approves "risky" prompts | **Platform owner** (positive) | — | Correctly returns false for risky (`auto-responder.ts:53`). Responsibility for keystroke-level approval correctly stays with User. | Info |
| Client-side tier + owner bypass | **Platform owner** | — | Local features run locally regardless; monetization-only concern (`owner.ts`). | Low |

### 3.4 makeshiphappen.tech Website

The website is the **most server-enforced** product (RLS hardened, Stripe signature-verified, keys server-side). Responsibility is correspondingly more cleanly held by the Platform owner / web team, with genuine Administrator duties around Supabase config.

| Feature / data flow | Primary responsible party | Secondary | Reasoning | Severity |
|---|---|---|---|---|
| `/auth/cli-login` posting live tokens to unvalidated localhost port | **Platform owner** | User (must open crafted link) | Design flaw: no port allowlist/nonce (`cli-login/page.tsx:35`). Refresh-token theft = account takeover. | High |
| Owner-email bypass dependent on Supabase "Confirm email" = ON | **Administrator** | Platform owner | Code is safe *only if* email confirmation is enabled in the Supabase project — an Administrator setting outside the repo (`owner.ts:17`). | High |
| DeepSeek (China) receives prompts, undisclosed | **Platform owner** | Third-party (DeepSeek) | Platform-keyed proxy = website is the controller/sender (`deepseek/route.ts:15`); not in sub-processor list. | High |
| No automated retention/deletion (manual email only) | **Platform owner** | — | Stated GDPR/CCPA rights have no code path; usage_events/ip_rate_events grow forever. | Medium |
| Client IPs persisted with no expiry (`ip_rate_events`) | **Platform owner** | — | PII accumulation, not disclosed in privacy policy (`migration 012`). | Medium |
| Inaccurate sub-processor disclosures (Sentry/Groq/OpenRouter/Ollama listed but absent; DeepSeek present but unlisted) | **Platform owner** | — | Both over- and under-inclusive; transparency failing (`app/privacy/page.tsx`). | Medium |
| No data-residency / region pinning for any sub-processor | **Platform owner** | — | No EU/UK in-region mechanism. | Medium |
| Stripe-hosted checkout (card data never touches server) | **Stripe (Third-party)** | User | Correct minimization; PCI scope sits with Stripe. | Info |
| Shipping PII → Stripe → Printful, no local record | **Shared** | Printful (Third-party) | Good minimization, but fulfillment PII lives at Printful uncovered by deletion/export. | Low |
| Chat content proxied, never stored (metadata only) | **Platform owner** (positive) | Third-party AI provider | Strong design; content governed only by chosen provider. | Info |
| Rate limiters fail open on DB error; in-memory IP limiter per-instance | **Platform owner** | — | Cost-amplification window on AI spend (`rate-limit.ts:33`). | Medium |
| Subscription tier from Stripe `metadata.plan` | **Platform owner** | — | Safe today (server-stamped); structural risk if any path lets users set metadata. | Low |
| LibraryGate paywall is client-side (content in JS bundle) | **Platform owner** | — | Acceptable only because gated content is marketing copy. | Low |

---

## 4. Licensing & Distribution Responsibility

License compliance is **non-delegable to the User** — it is purely the distributor's (Platform owner's) obligation, since the user merely receives a binary.

| Obligation | Responsible party | Severity |
|---|---|---|
| **GPLv2+ ffmpeg statically bundled in ShipMind (paid, closed-source)** — no source offer, no GPL text | **Platform owner / ShipMind release engineering** | Critical |
| No third-party attribution/NOTICE shipped (ShipTalk ~250+ Apache, ShipMind, ShipSpace 600+ deps) | **Platform owner** | High |
| MPL-2.0 weak-copyleft crates undisclosed (all desktop apps) | **Platform owner** | Medium |
| whisper.cpp MIT notice not redistributed (ShipTalk) | **Platform owner** | Medium |
| Empty/placeholder license metadata (ShipTalk `license=""`, `authors=["you"]`) | **Platform owner** | Low |
| LGPL-3.0 libvips if bundled into Electron build (website/ShipSpace) | **Platform owner** | Low |

The User bears **zero** licensing responsibility. Any claim that an EULA shifts attribution duties to the user would be legally ineffective for upstream OSS licenses.

---

## 5. Where Responsibility Is Currently UNCLEAR or UNDEFINED

These are the items where, today, **no party can be cleanly held responsible** — the most important output of this phase, because unclear allocation is itself a liability.

1. **Administrator vs. Platform owner for Supabase RLS.** Every desktop app's data-isolation guarantee (dictionary_terms, transcriptions, profiles) rests entirely on RLS that is *not visible in any repo*. In the single-dev model the owner *is* the administrator, but there is no documented owner of "RLS is correctly scoped per-user." If RLS is loose, cross-user leakage occurs and no role currently owns verifying it. **Undefined.**

2. **Whose responsibility is enabling cloud egress when the consequence is undisclosed?** The User flips Cloud Features ON (their act), but the User was never told audio goes to Groq/OpenAI/Apple or transcripts to Anthropic, and that "on-device" marketing contradicts reality (ShipTalk `Cargo.toml:28`). Consent without disclosure is not valid consent — so the User's "choice" cannot carry the responsibility the architecture implies. **Unclear / leans Platform owner.**

3. **MCP token/corpus exposure: installer vs. exposer.** ShipTalk's `get_state_raw` hands out the Supabase auth token; ShipMind/ShipSpace MCP servers expose corpus/chats. The User installs the MCP into an agent; the Platform owner chose to expose sensitive keys with no allowlist (ShipTalk) vs. with an allowlist (ShipSpace correctly blocks `*-auth`). The split of blame for an actual leak is **undefined** and differs per product.

4. **Prompt-injection acting through an agent with shell/file access (ShipSpace).** When a malicious GitHub issue or web page instructs an agent that then runs a destructive or exfiltrating command, is it the User (chose to run the agent autonomously), the Platform owner (no provenance separation, no intent layer), or the third party that authored the malicious content? **Genuinely shared and currently undefined** — no design or disclosure assigns it.

5. **Deletion/erasure across processors.** When a website user requests deletion, no code path covers Stripe billing IDs, Printful shipping PII, or `usage_events`/`ip_rate_events`. The privacy policy promises erasure; no role owns executing it across sub-processors. **Undefined operationally.**

6. **DeepSeek / cross-border transfer.** Website and ShipMind both route prompts to a China-based processor with no disclosure, no opt-out, no residency control. For an EU/UK user this is an undisclosed international transfer. The User cannot be responsible for a transfer they couldn't see; the Platform owner hasn't claimed it either. **Unclear, leans Platform owner.**

7. **"On-device" / "private second brain" marketing vs. reality.** The truth-in-labeling gap (audio/transcripts/corpus leaving the device) means a User relying on the marketing claim to dictate sensitive content has misallocated their *own* risk based on the Platform owner's representation. Liability for resulting harm is **unclear** and would likely fall on the Platform owner as the representation-maker.

8. **Subscription/owner-bypass safety on the website depends on an out-of-band Supabase toggle.** If "Confirm email" is OFF in production, the owner-email bypass becomes an account-takeover path. No code can enforce this; it is an Administrator setting with no documented owner of verification. **Undefined until verified.**

---

## 6. Recommended Responsibility Clarifications (Non-Code, Governance)

To make allocation defensible (none require code changes to assert):

- **Publish a sub-processor list** per product (Anthropic, OpenAI, Google, Groq, DeepSeek, Perplexity, xAI, Apple, Supabase, Stripe, Printful, Hugging Face, GitHub). This converts "undisclosed transfer = owner's fault" into "disclosed transfer = user's informed choice."
- **Publish a data-flow / privacy notice** mapping each destination, retention, and third party — closing items #2, #6, #7 above.
- **Document an EULA + explicit proprietary license** to anchor user-side responsibility for content and for operating the high-privilege agent IDE.
- **Document the Administrator role** (RLS scoping, email-confirmation toggle, MCP installation, release-key custody) and who owns verifying each — closing #1 and #8.
- **State retention/erasure ownership** and build (or document) the actual deletion path — closing #5.
- **Correct the on-device/private-brain marketing** to match the cloud reality — closing #7.

---

## 7. Summary of Responsibility Distribution

| Party | Dominant responsibility areas |
|---|---|
| **Platform owner (MakeShipHappen / Jacob Felton)** | Retention/deletion design, encryption-at-rest, sub-processor disclosure, MCP exposure design, file/exec capability scoping, client-side auth design, **all** licensing/attribution, marketing accuracy, residency. *The overwhelmingly dominant responsible party.* |
| **User** | Content originated (dictation/uploads/prompts), decision to enable cloud features, decision to install MCP servers, operating the high-privilege ShipSpace agent IDE, BYOK key spend/abuse, `gh` token scopes. |
| **Administrator** (= owner in practice) | Supabase RLS correctness, Supabase "Confirm email" setting, release service-role key custody. *Load-bearing but undocumented.* |
| **Third-party providers** | Processing of data once transmitted to them per their own terms; PCI scope (Stripe); fulfillment PII (Printful). |
| **Shared / Undefined** | MCP token exposure, prompt-injection-via-agent, cloud-egress-without-disclosure, cross-border DeepSeek transfer. *These are the priority items to define.* |

The defining conclusion of Phase 4: **BYOK and "local-first / agent IDE by design" framing create an impression that responsibility sits with the User, but the actual architecture — indefinite plaintext retention, missing erasure, undisclosed sub-processors, unencrypted storage, client-side auth, and unmet license obligations — keeps responsibility firmly with the Platform owner.** The gap between the implied allocation and the real allocation is itself the core governance risk.
