# Per-Product Cluster Audit — ShipSpace

**Document:** 13 — ShipSpace Cluster Audit (single deep reference)
**Audit type:** READ-ONLY risk / inventory / governance analysis
**Date:** 2026-06-07
**Auditor role:** Senior security auditor + SaaS/privacy/technology attorney + compliance officer
**Responsible party (single-developer owner):** Jacob Felton — `zzgemsjewelry@gmail.com`
**Assumption:** The software functions correctly; this document analyzes risk, data governance, licensing, liability, and user-responsibility allocation — not bugs.

---

## 1. Executive Summary

ShipSpace is the **highest-privilege product in the Ship ecosystem** and the one that carries the most material legal, security, and privacy exposure. It is a Tauri 2 (Rust + React 19 / Vite / Zustand) desktop "Agent Development Environment" that, by deliberate design, gives autonomous LLM agents and terminal panes **real shell access on the user's machine**. It spawns real PTYs (`portable-pty`), runs autonomous Claude/Codex/local-CLI agents across isolated git worktrees via an in-process MCP orchestrator, chats with up to nine LLM provider surfaces (BYOK), drives an embedded WKWebView browser, manages GitHub repos/PRs via the `gh` CLI, binds Ship Memory notes to terminals, and captures microphone audio for dictation/voice.

The security baseline is **better than a casual reading of the recon suggests**. Several controls are genuinely well-implemented: API keys live in the macOS keychain (`secrets.rs`) rather than localStorage with a one-time migration that deletes the legacy plaintext copy; `write_file` is confined to `$HOME`+`$TMPDIR` with canonicalization, symlink, `..`, and null-byte guards (`lib.rs:432-481`); the `run_shell_cmd` allowlist blocks path-form commands; the embedded browser fetch path has a real SSRF guard including cloud-metadata blocking; the `shipspace-mcp` server denies credential keys; and Ship Memory scrubs secret patterns before injection. Two specific recon-flagged risks are **already mitigated in shipped code**: the auto-responder never auto-approves "risky" permission prompts (`auto-responder.ts:53`), and `claude_pty_create` defaults to Claude's normal permission prompts, only escalating to `acceptEdits` (never `bypassPermissions`) on explicit opt-in (`orchestrator.rs:442-450`).

The **residual risk is concentrated and real**: (1) the in-process MCP orchestrator HTTP server on `127.0.0.1` has **no authentication** — only an origin check that explicitly accepts no-origin requests (`orchestrator.rs:555-560`); (2) `read_file`/`list_directory` have **zero path confinement** (`lib.rs:371-495`), the primary full-disk exfiltration channel; (3) the allowlist gates only the **binary name, not arguments**, so `node -e`, `npx`, `python -c` are effectively arbitrary code execution; (4) raw-PTY arbitrary shell access for agents is an accepted-by-design risk; (5) full terminal scrollback (which can contain typed secrets) and chat transcripts are **persisted indefinitely in plaintext** localStorage with no retention/deletion path; (6) untrusted GitHub issue bodies, web-page content, and Ship Memory note bodies flow into agent context (prompt-injection); and (7) the hardened runtime is weakened (`disable-library-validation` + `allow-unsigned-executable-memory` + `allow-dyld-environment-variables`).

On governance: there is **no privacy policy / sub-processor disclosure** for a tool that transmits the user's private source code, voice, and personal notes to up to seven third-party AI processors; **no EULA or declared license** for the product itself; and **no third-party attribution/NOTICE file** despite distributing a signed commercial binary that statically links 559 Rust crates plus the JS build. The dependency graph is, however, **clean of strong copyleft** (no GPL/AGPL/LGPL/SSPL/BUSL) — the paid closed-source model is not at license risk; the gap is attribution debt, not copyleft conflict.

---

## 2. Product Inventory

### 2.1 Architecture & Components

ShipSpace is a Tauri 2 desktop app: a Rust backend (`src-tauri/`) exposing ~40 `invoke` handlers to a React 19 + Vite + Zustand frontend (`src/`), plus an auxiliary stdio MCP server (`shipspace-mcp/`).

| Component | File | Role |
|---|---|---|
| Tauri entrypoint | `src-tauri/src/lib.rs` | App menu, ~40 invoke handlers, `run_shell_cmd` allowlist, `read_file`/`write_file`/`list_directory`/`save_dropped_file`/`open_path`, process list/kill diagnostics |
| PTY engine | `src-tauri/src/pty.rs` | `portable-pty` terminal spawning, PID registry, stale-process cleanup |
| Orchestrator | `src-tauri/src/orchestrator.rs` | In-process axum MCP HTTP server on `127.0.0.1:<random>`, per-terminal task queue, `claude_pty_create`, worktree auto-merge foreman |
| GitHub wrapper | `src-tauri/src/github.rs` | `gh` CLI wrapper (status/install/repos/clone/login/PR/diff/review/issues) |
| Source Control | `src-tauri/src/git_ops.rs` | Git status/diff/stage/commit/worktree for the SCM panel |
| Worktrees | `src-tauri/src/worktree.rs` | Per-agent git worktree isolation lifecycle |
| Embedded browser | `src-tauri/src/browser_view.rs` | WKWebView navigate/controller/asset-extraction/inspector, SSRF-guarded fetch |
| Secrets | `src-tauri/src/secrets.rs` | OS keychain (`keyring`) API-key storage |
| Ship Memory reader | `src-tauri/src/ship_memory.rs` | Read-only markdown vault reader + scrubbed session-note writer |
| MCP state server | `shipspace-mcp/src/index.ts` | stdio MCP exposing persisted ShipSpace state from the WebKit localStorage sqlite |
| Chat adapters | `src/lib/agents/providers/*` | Streaming adapters: anthropic, openai, google, groq, deepseek, perplexity, xai, nano-banana (mock), cli (Hermes/OpenClaw) |
| ShipGang engine | `src/lib/shipgang/*` | Autonomous multi-agent build pipeline + code extraction + gated npm install |
| Orchestration glue | `src/lib/orchestration/*` | auto-responder, narrator, terminal-watcher, pane-question-bridge, workspace-dispatch |
| Voice | `src/lib/voice/*` | OpenAI Realtime, OpenAI/Groq TTS/STT, macOS dictation/IME |
| Safety policy | `src/lib/agents/safety-policy.ts` | Regex risk classifier + plan/terminal dispatch gate |
| Auth | `src/lib/auth.ts`, `supabase.ts`, `owner.ts` | Supabase auth, tier gating, owner-email bypass |
| Stores | `src/lib/stores/*` | ~34 Zustand stores |

### 2.2 User-Facing Features

Multi-pane terminal workspace (real shells); agent chat with a 9-provider model picker; ShipGang autonomous multi-agent build runs; orchestrator drop-zone task assignment into isolated worktrees; Source Control panel; GitHub panel (sign-in/clone/PR/review/issues); embedded browser with element inspector that pipes context into terminals; Ship Memory panel + terminal-to-memory binding; Mission Control / Self views; Kanban board; prompt library; voice dictation + TTS/STT; Settings UI for API keys; auto-updater dialog; process diagnostics.

### 2.3 Internal Surfaces

axum MCP orchestrator HTTP server (`127.0.0.1` random port); PTY PID registry (`~/Library/Logs/ShipSpace/pty-pids.tsv`) + stale cleanup; per-terminal MCP config written to `$TMPDIR`; crash/lifecycle logging; `shipspace-mcp` stdio server reading WebKit localStorage sqlite; auto-merge foreman background task; legacy localStorage API-key → keychain migration.

---

## 3. Data Flows & Storage

### 3.1 Data Classes Processed

Arbitrary user source code / project files (read/write/exec); terminal stdin/stdout streams; agent task intents, file scopes, results; GitHub repo metadata, PR diffs, issue bodies, OAuth-backed `gh` state; git status/diffs/commits; LLM chat messages and prompts; voice audio + transcripts; embedded-browser page content/URLs/selections/captured assets; Ship Memory note bodies (injected into agent system prompts); Supabase user/session/profile/subscription tier; provider API keys.

### 3.2 Storage Locations

| Data | Location | At-rest protection |
|---|---|---|
| Provider API keys | macOS keychain, service `com.makeshiphappen.shipspace[.beta/.dev]`, one entry per provider | **Keychain-encrypted (good)** |
| Workspaces, gangs, runs, chats, prompts, settings, scrollback | WebView localStorage sqlite (`~/Library/WebKit/<bundle>/.../LocalStorage/localstorage.sqlite3`) | **Plaintext, unencrypted** |
| Crash/lifecycle logs, PTY PIDs | `~/Library/Logs/ShipSpace/` | Plaintext, no rotation |
| Per-terminal MCP config | `$TMPDIR/shipspace-orchestrator-<id>.json` | Plaintext, never deleted |
| Dropped files | `$TMPDIR/shipspace-dropped/` | Plaintext, never purged |
| Browser captures | `~/Documents/ShipSpace/Captures/<domain>-<ts>` | Plaintext, never purged |
| Per-agent worktrees | `<workspace>/.shipspace/worktrees/<id>/` | Workspace perms |
| Auth + profiles | Supabase (cloud) | Cloud sub-processor / RLS |
| GitHub token | `gh` CLI keyring | Keychain (gh-owned) |
| Build secrets | `ShipSpace/.env` (gitignored) | Local |

### 3.3 Egress / External Transmission

- **9 AI provider surfaces, BYOK, browser-to-provider HTTPS** (no ShipSpace proxy): Anthropic, OpenAI (chat + Realtime WSS + Whisper STT + TTS), Google Gemini, Groq (chat + Whisper + Orpheus TTS), DeepSeek, Perplexity, xAI; plus `claude` CLI in PTYs → Anthropic. "Nano Banana" is a hard-coded **mock** (sends nothing); "Manus" is a **dormant** keychain slot with no adapter.
- **Supabase** — auth + profiles.
- **GitHub** (via `gh`) — repo metadata, PR diffs, issue bodies.
- **makeshiphappen.tech** — auto-updater endpoint + browser login redirect.
- **What is sent:** full chat transcript + system prompt (which can embed Ship Memory note bodies, `custom_instructions`/`ai_tone`, gh issue/PR content, browser page captures), and for voice paths raw microphone audio / transcripts.

### 3.4 Data-Flow Findings

| # | Finding | Severity | Responsible |
|---|---|---|---|
| D-1 | Terminal scrollback (raw stdin/stdout, can contain typed secrets) persisted **indefinitely in plaintext** localStorage; no TTL, no "clear history" path (`useWorkspaceSessionStore.ts:38,54-69,201-202`; bytes from `pty.rs:325-328`) | **High** | Owner |
| D-2 | `read_file`/`list_directory` have **no path confinement** — any file (`~/.ssh/id_rsa`, `~/.aws/credentials`) readable into renderer/agents (`lib.rs:371-429,492-495`), asymmetric vs. confined `write_file` | **High** | Owner |
| D-3 | Agent chat messages (prompts/responses, pasted code, browser-captured HTML) persisted plaintext, no deletion lifecycle (`useAgentChatStore.ts:868-917`); exposed via `shipspace-mcp` `get_chat`/`list_chats` | **Medium** | Owner |
| D-4 | `shipspace-mcp` reads the full localStorage sqlite read-only; credential keys correctly denied (`index.ts:138-154`) but the **sqlite file itself is plaintext on disk** and readable directly by any local process / spawned agent | **Medium** | Owner |
| D-5 | OpenAI Realtime embeds the **raw API key in the WS subprotocol** (`openai-insecure-api-key.*`, `openai-realtime.ts:81-84`); continuous mic audio streamed to OpenAI | **Medium** | Owner |
| D-6 | Perplexity (`api.perplexity.ai`) and xAI (`api.x.ai`) prompt traffic targets hosts **not in the Tauri http allowlist or CSP** — either broken or unscoped egress (`perplexity.ts:49`, `xai.ts:47` vs `capabilities/default.json:14-22`, `tauri.conf.json:28`) | **Medium** | Owner |
| D-7 | Ship Memory note bodies injected verbatim into agent `--append-system-prompt` (slug validated, **body not**: `orchestrator.rs:296-315`); reads return raw unredacted body; notes stored plaintext `.md` in shared hub | **Medium** | Owner |
| D-8 | Embedded browser snapshots up to 20k chars of page text + selection + assets into terminals/agents and into persisted chat (`browser_view.rs:189-210,1134-1149,1322-1340`) — no consent/retention notice | **Medium** | Owner |
| D-9 | Orchestrator MCP HTTP server carries task intents/file-scopes/results; **no auth**, readable by any local process that finds the port (`orchestrator.rs:555-560`); port also written to `$TMPDIR` MCP config | **Medium** | Owner |
| D-10 | Supabase session JWT + profile PII (incl. `custom_instructions`) in plaintext localStorage; tier preserved on lookup failure (`auth.ts:131-163`) | **Low** | Owner + Supabase (processor) |
| D-11 | Per-terminal MCP config, dropped files, browser captures written with **no cleanup/TTL** (`orchestrator.rs:384-390`, `lib.rs:504-529`, `browser_view.rs:1040-1132`) | **Low** | Owner |
| D-12 | Crash/lifecycle/PTY-PID logs accumulate indefinitely; panic hook writes free-form payloads incl. paths (`lib.rs:193-258,746-766`, `pty.rs:42-95,223-228`) | **Low** | Owner |
| D-13 | GitHub identity/PR-diffs/issue-bodies processed via `gh`; token in gh's keyring, outside ShipSpace control/audit (`github.rs:4-13`) | **Info** | Owner + GitHub |
| D-14 | **Positive:** API keys isolated in keychain with legacy-localStorage migration + deletion (`secrets.rs:36-68`, `useApiKeyStore.ts:28-45`); MCP denies credential keys | **Info** | Owner |

> **Dominant governance gap (D-1/D-3/D-11/D-12):** No retention, TTL, pruning, or user-facing delete path for scrollback, chat, captures, or logs. A grep for retention/expire/ttl/prune/rotate across `src-tauri` surfaced only worktree prune and stale-PTY cleanup — nothing for persisted user data.

---

## 4. Security Posture & Risk Ratings

ShipSpace is high-privilege by design. The following are the residual risks after accounting for controls that are actually present in shipped code.

| # | Finding | Severity | Responsible |
|---|---|---|---|
| S-1 | **Orchestrator MCP server has no authentication** — `origin_ok` returns `true` for absent Origin (`None => true`, `orchestrator.rs:555-560`); no bearer token; any same-user local process can POST `initialize`/`tools/call` to read queued task intents or drive the agent-task bus | **Medium** | Backend (`orchestrator.rs`) |
| S-2 | **`read_file`/`list_directory` no path confinement** — full-disk read into renderer/agents; asymmetric vs sandboxed `write_file`; single prompt-injection that influences a `path` arg yields full-disk read (`lib.rs:371-429,492-495`) | **High** | Backend (`lib.rs`) |
| S-3 | **`run_shell_cmd` allowlist gates binary name, not args** — `node -e`, `npx <pkg>`, `python -c`, `npm run <script>` over LLM-authored `package.json` all pass while executing arbitrary code with full user privileges (`lib.rs:660-685`); `cli.ts` already drives this with model-selected args | **High** | Backend (`lib.rs` / `cli.ts`) |
| S-4 | **Raw PTY shell access for agents, no intent layer** (documented `TODO(security)` `pty.rs:1-10`); `pty_input` writes any bytes; `claude_pty_create` spawns interactive claude in worktrees; prompt-level mitigations are advisory, not enforced. Partially mitigated by worktree isolation + Claude's preserved default permission prompts | **High** (accepted design risk) | Backend (`pty.rs`/`orchestrator.rs`) |
| S-5 | **Weakened hardened runtime** — `disable-library-validation`, `allow-unsigned-executable-memory`, `allow-jit`, `allow-dyld-environment-variables` on a signed/notarized app with keychain + GitHub token + mic/accessibility/speech entitlements = dylib-injection / DYLD_* substitution vector (`Entitlements.plist:5-12`) | **Medium** | Packaging (`Entitlements.plist`) |
| S-6 | **Prompt injection** — untrusted gh issue bodies (`github.rs:645-653`), browser page text/outerHTML (`browser_view.rs:199-200`), and Ship Memory note bodies (`orchestrator.rs:296-315`) become agent instructions; no provenance separation between data-to-analyze and instructions-to-follow; elevated by shell-access blast radius | **Medium** (→ High depending on agent autonomy) | (`github.rs`/`browser_view.rs`/`orchestrator.rs`) |
| S-7 | **API keys plaintext in renderer memory** after hydration (`useApiKeyStore.ts:51-67`) — necessary for direct calls, but any webview-context compromise (broad CSP allows `blob:`, `wasm-unsafe-eval`, `localhost:*`/`127.0.0.1:*`) reads all keys at once, bypassing keychain at-rest protection | **Medium** | Frontend + CSP |
| S-8 | **`open_path` passes arbitrary path to macOS `open`** with no scheme/path validation (`lib.rs:483-490`) — can launch `.app`/URL handlers; current callers trusted, no defense-in-depth | **Low** | Backend (`lib.rs`) |
| S-9 | **Client-trusted subscription gating** — owner-email bypass forces `team` tier (`owner.ts`, `auth.ts:127-129,147`); tier preserved on lookup error (`auth.ts:138-144`); no server-side entitlement enforcement (business-logic, not system-security) | **Low** (informational) | Frontend (`auth.ts`/`owner.ts`) |
| S-10 | **`shipspace-mcp get_state_raw`** exposes chats/prompts/workspaces/orchestrations to any MCP client that can launch the (unauthenticated stdio) server; credentials denied (`index.ts:138-154,444-462`) but rich personal/project data is not | **Low** | `shipspace-mcp` |
| S-11 | **Release uploader** requires `SUPABASE_SERVICE_ROLE_KEY` (RLS-bypass) in operator env; no committed secret found; updater integrity rests on the single embedded minisign pubkey (`upload-release.mjs:13-18,201-243`; `tauri.conf.json:38`) — treat service-role + minisign private keys as crown jewels | **Low** (informational) | Release ops |
| S-12 | **Positive:** auto-responder never auto-approves "risky" prompts (`auto-responder.ts:51-56` — `risk==='risky'` ⇒ false regardless of mode); `claude_pty_create` defaults to `default` permission mode, escalates only to `acceptEdits` on opt-in, never `bypassPermissions` (`orchestrator.rs:442-450`); `SHIP_MEMORY_READONLY=1` + `--strict-mcp-config` for workers | **Info** (no action) | (`auto-responder.ts`/`orchestrator.rs`) |

### 4.1 Implemented Controls (baseline)

Keychain at-rest secrets with migration+deletion; `write_file` HOME+TMPDIR confinement with canonicalize/symlink/`..`/null-byte guards; `run_shell_cmd` blocks path-form commands; gh/git wrappers validate args and use `--` separators; `browser_extract_assets` SSRF guard incl. cloud-metadata (`browser_view.rs:80-138`); `shipspace-mcp` credential-key denylist + ALLOWED_KEYS; Ship Memory `scrub_secrets` on outbound note bodies; worktree per-agent isolation; release uploader refuses ad-hoc-signed builds and verifies universal binary + codesign + spctl.

---

## 5. Privacy & Data-Retention Posture

| Dimension | Assessment |
|---|---|
| **Privacy policy** | **Absent.** No in-product disclosure that source code, voice, and Ship Memory notes are transmitted to up to 7 distinct third-party AI sub-processors, each with its own retention/training/data-residency posture (xAI, DeepSeek differ materially from Anthropic/OpenAI). |
| **Sub-processor disclosure** | **Absent.** Required for a tool whose explicit purpose is operating on the user's private codebase. |
| **Consent** | No per-provider consent for voice (mic audio auto-fails-over Groq↔OpenAI based on which keys exist); no consent/notice for browser page capture into agent context. |
| **Retention** | **No retention policy.** Scrollback, chat, captures, dropped files, and logs persist indefinitely with no TTL/pruning. |
| **Deletion** | **No user-facing delete path** for scrollback/chat/captures; Ship Memory panel is read-only and cannot delete notes. |
| **At-rest encryption** | Only API keys (keychain) and the gh token are encrypted. All other personal data (scrollback, chat, profile JWT, captures) is plaintext localStorage/disk. |
| **Data minimization** | Weak — full 20k-char page snapshots, full scrollback incl. typed secrets, full chat transcripts retained. |
| **Telemetry** | **None found** — no analytics SDK (positive). |
| **Owner/PII** | Single-dev product; profile `custom_instructions`/`ai_tone` are free-text PII that becomes LLM system context. |

**Regulatory note (GDPR/CCPA framing):** If sold to EU/CA residents, the absence of a privacy policy, sub-processor list, lawful-basis statement, and data-subject deletion mechanism is a compliance gap. The owner is the data controller; the AI providers, Supabase, and GitHub are processors/sub-processors that should be disclosed in a Data Processing Addendum chain.

---

## 6. Integrations & AI Providers

### 6.1 Active Cloud AI Sub-Processors (BYOK, direct egress)

Anthropic; OpenAI (chat + Realtime WSS transcription + Whisper STT + `gpt-4o-mini-tts`); Google Gemini; Groq (chat + Whisper STT + Orpheus TTS); DeepSeek; Perplexity; xAI/Grok. Each receives the full transcript + system prompt (potentially incl. source code and personal notes). **No ShipSpace-operated proxy** — keys sent directly as `x-api-key`/`Bearer`/`x-goog-api-key`.

### 6.2 Phantom / Local Integrations

- **Nano Banana** — hard-coded mock, no network (`nano-banana.ts:3-9`).
- **Manus** — keychain slot + ProviderId + sign-up URL but **no adapter**; transmits nothing.
- **Hermes / OpenClaw** — local CLI agents via `run_shell_cmd`; OpenClaw uses local Ollama with a sentinel key; no network from ShipSpace itself.
- **Codex CLI** — via PTY/scripts.

### 6.3 Non-AI Third Parties

Supabase (auth + profiles, anon key bundled into client — RLS is the load-bearing control); GitHub via `gh` (delegated OAuth token, machine's full repo scope, no ShipSpace OAuth app or scope narrowing); makeshiphappen.tech (updater + login redirect, update integrity rests on one embedded minisign pubkey); Homebrew (gh install).

### 6.4 Integration Findings

| # | Finding | Severity |
|---|---|---|
| I-1 | Perplexity + xAI hosts omitted from http allowlist and CSP — provider inventory inconsistent across `secrets.rs`/`types.ts`/`capabilities`/`CSP`; egress governance-invisible | **Medium** |
| I-2 | Up to 7 AI sub-processors receive code/prompts/notes with **no sub-processor disclosure** | **Medium** |
| I-3 | OpenAI Realtime sends raw key in WS subprotocol (no backend to mint ephemeral tokens) | **Medium** |
| I-4 | Mic audio + transcripts auto-fail-over Groq↔OpenAI with no per-provider consent | **Low** |
| I-5 | Untrusted content (notes/issues/web) → agent system prompt → forwarded to providers | **Low** |
| I-6 | GitHub auth delegated to gh's full-scope token; outside ShipSpace audit | **Low** |
| I-7 | Supabase sole cloud store; anon key bundled; owner-email bypass client-side | **Low** |
| I-8 | Updater + login on makeshiphappen.tech; integrity = single embedded minisign pubkey | **Low** |
| I-9 | Inventory: nano-banana mock + manus dormant — do not over-count active flows | **Info** |

---

## 7. Licenses & Dependencies

**Bottom line: no strong copyleft anywhere** (no GPL/AGPL/LGPL/SSPL/BUSL/OSL/EUPL/CPAL across 559 Cargo.lock crates + both JS trees). The paid closed-source model is **not at license risk**. The actionable risk is **attribution/notice debt** on a signed, commercially distributed binary.

| # | Finding | Severity | Responsible |
|---|---|---|---|
| L-1 | **No THIRD-PARTY-LICENSES / NOTICE file** shipped despite distributing a signed binary statically linking 559 Rust crates + the JS build, the vast majority MIT/Apache-2.0/ISC/BSD that **require notice reproduction in binary distribution**. No attribution tooling (no cargo-about/deny.toml/about.toml). | **High** | Owner |
| L-2 | **5 MPL-2.0 (weak copyleft) crates** compiled into the binary: `cssparser`, `cssparser-macros`, `selectors`, `dtoa-short` (via kuchikiki←wry←tauri), `option-ext` (via dirs-sys←keyring). Does not infect the app, but requires source-availability + notice for those files — currently unmet. | **Medium** | Owner |
| L-3 | **`ring 0.17.14`** (Apache-2.0 AND ISC, via rustls TLS) bundles BoringSSL/OpenSSL-derived code with separate `LICENSE-BoringSSL`/`LICENSE-other-bits` notices that must travel with the binary; a naive SPDX-only attribution pass misses them. | **Medium** | Owner |
| L-4 | **No license declared** for ShipSpace (`package.json`), shipspace-mcp, or the Rust crate (`Cargo.toml`) — all-rights-reserved by default is fine, but no EULA/proprietary-license assertion leaves customer use terms undefined; npm "unlicensed" ambiguity. | **Low** | Owner |
| L-5 | **Unicode-3.0 (18 ICU4X crates) + CDLA-Permissive-2.0 (webpki-roots)** carry non-standard data-attribution terms a naive MIT/Apache collector silently drops. | **Low** | Owner |
| L-6 | Supply-chain note: `obug` (debug fork) and `iceberg-js` (via supabase storage-js) are legitimate transitive deps, licenses clean (MIT); flagged for inventory completeness. | **Info** | Owner |
| L-7 | **Clean bill:** no copyleft anywhere — no legal barrier to selling ShipSpace proprietary; remaining obligations are attribution-only. | **Info** | Owner |

---

## 8. Liability Hotspots

Ranked by likely legal/financial exposure for the single-developer owner.

1. **Agent destructive action / data loss (S-3, S-4, S-2).** A prompt-injected or jailbroken agent with raw shell + interpreter execution + full-disk read can delete user data, exfiltrate secrets (`~/.ssh`, `~/.aws`), or push malicious commits. Without an EULA limitation-of-liability + warranty disclaimer (L-4), the owner bears the default liability for damages caused by autonomously-executed actions. **This is the single largest liability hotspot.**
2. **Secret/code exfiltration to AI providers without disclosure (I-2, D-1, D-7).** Source code, typed secrets in scrollback, and personal notes transmitted to 7 third parties with no privacy policy or sub-processor disclosure → privacy-law and misrepresentation exposure if a leak or training-on-customer-data event occurs.
3. **License attribution breach (L-1/L-2/L-3).** Selling a binary that omits required notices for hundreds of permissive deps + MPL source-availability is a redistribution-license breach for essentially every dependency at once.
4. **Supply-chain / update integrity (S-11, I-8).** A leaked minisign private key or compromised makeshiphappen.tech enables a malicious update push to all users — catastrophic, with owner liability for distributed malware.
5. **Unauthenticated local control bus (S-1, D-9).** Co-resident malware can read/drive the agent task channel; limited to single-user machines but a confidentiality/integrity gap.
6. **Indefinite plaintext retention (D-1/D-3) + no deletion path.** Conflicts with data-subject rights and increases breach blast radius.

---

## 9. User-Responsibility Assignment

Because ShipSpace runs locally with the user's OS privileges and BYOK keys, a significant share of operational risk is, in practice, borne by the user — but **this allocation is currently undocumented** (no EULA/ToS). Recommended explicit assignments:

| Responsibility | Owner (developer) | User |
|---|---|---|
| Securing the host machine against co-resident malware (mitigates S-1, S-7, D-4) | — | **User** |
| Choosing which AI providers to enable and accepting their data terms (I-2, I-4) | Disclose sub-processors | **User accepts provider terms** |
| Reviewing autonomous agent actions before allowing high-autonomy modes (S-4, S-6) | Ship safe defaults (done: S-12) | **User supervises** |
| Not typing secrets into terminals that get persisted to scrollback (D-1) | Add scrollback redaction/TTL + warning | **User awareness** |
| Keeping the gh token scope minimal (I-6) | Document | **User manages gh** |
| Backing up project data before agent runs (liability #1) | Recommend in EULA | **User backs up** |
| API-key custody / billing (BYOK) | Keychain storage (done) | **User owns keys + spend** |
| Update integrity / signing-key custody (S-11) | **Owner** (crown-jewel custody) | — |
| License attribution compliance (L-1) | **Owner** | — |
| Privacy disclosures / data-subject requests (§5) | **Owner (data controller)** | — |

**Critical gap:** None of the above is contractually allocated today because there is **no EULA/ToS and no privacy policy**. Drafting these is the highest-leverage non-code remediation: it both discloses the data flows (closing the privacy gap) and limits owner liability for user-directed autonomous agent actions (closing liability hotspot #1).

---

## 10. Prioritized Remediation Themes (non-binding; no code changed in this audit)

1. **Legal docs (highest leverage, zero code):** EULA with warranty disclaimer + liability cap + autonomous-agent-action allocation; privacy policy + sub-processor list; declared license (`UNLICENSED`/proprietary SPDX).
2. **Attribution bundle:** cargo-about + JS aggregator → THIRD-PARTY-LICENSES in app bundle/Help menu (captures MPL-2.0, ring multi-license, Unicode-3.0, CDLA).
3. **Confine `read_file`/`list_directory`** to a workspace/HOME root (S-2) — mirrors the existing `write_file` guard.
4. **Authenticate the orchestrator MCP server** with a per-launch bearer token instead of accepting no-origin (S-1).
5. **Scrollback/chat retention + redaction + user delete path** (D-1, D-3); log rotation (D-12).
6. **Reconcile provider inventory** — add or remove Perplexity/xAI consistently across allowlist, CSP, and adapters (I-1).
7. **Re-confirm necessity of `disable-library-validation` + `allow-dyld-environment-variables`** (S-5).

---

*End of ShipSpace cluster audit. This is a read-only assessment; no source code, dependencies, builds, or configuration were modified.*
