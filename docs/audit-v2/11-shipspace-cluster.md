# Audit Dossier 11 — ShipSpace Cluster

**Scope:** `ShipSpace/`, `shipspace-mcp/`, `shipgang-output/`, `ship-it-guidelines/`, `Prompts/` (ShipSpace-relevant), `.shipspace/`
**Method:** Read-only source review. Independent (did not consult `docs/audit/` or `docs/business-protection/`). Heavy/generated dirs excluded.
**Auditor verdict (headline):** ShipSpace is a Tauri desktop "Agent Development Environment." Its central, by-design risk is that **AI agents are given raw, unconfined PTY/shell access with no typed-intent layer** — explicitly acknowledged in a source `TODO(security)`. Secrets are correctly stored in the OS keychain, but `withGlobalTauri: true` plus an unconfined `read_file` command undermine that boundary. An optional "auto-approve all prompts" mode and "auto-merge" toggle convert the human-in-the-loop gate into an opt-out, and any agent/web/terminal content can carry prompt-injection straight to providers with **no secret scrubbing**.

---

## 1. INVENTORY

### 1.1 Application shell (Tauri)
| Item | Detail | Evidence |
|---|---|---|
| Purpose | Multi-agent orchestration / Agent Development Environment desktop app | `ShipSpace/src-tauri/tauri.conf.json:3` (`productName: ShipSpace`) |
| Identifier | `com.shipspace.ade` (+ `.beta`, `.dev` channels) | `tauri.conf.json:5`; `secrets.rs:3-5` |
| Global Tauri | `withGlobalTauri: true` — `window.__TAURI__` exposed to all renderer JS | `tauri.conf.json:13` |
| Window dragDrop | `dragDropEnabled: false` (HTML5 DnD handled in renderer) | `tauri.conf.json:24` |
| CSP | `default-src 'self'`; `connect-src` allows Anthropic/OpenAI(+wss)/Google/DeepSeek/Groq/Supabase + localhost | `tauri.conf.json:28` |
| Capabilities | `process:default`, `updater:default`, `shell:allow-open`, `dialog:default`, `http:default` allowlist (5 provider hosts) | `capabilities/default.json:6-23` |
| Plugins | shell, dialog, http, process, updater | `lib.rs:775-779` |
| Updater | Signed updater from `https://makeshiphappen.tech/api/updates/shipspace/latest`, minisign pubkey embedded | `tauri.conf.json:32-39` |
| Code signing | `Developer ID Application: Jacob Felton (7G7K3X24Q5)` | `tauri.conf.json:53` |
| Auth | Supabase (`@supabase/supabase-js`); `AuthGate.tsx`, `src/lib/supabase.ts`, `auth.ts`, `owner.ts` | dirlisting; `.env` has `VITE_SUPABASE_*` |
| Storage | zustand stores persisted to WebView localStorage (`localstorage.sqlite3`); secrets in OS keychain | `shipspace-mcp/src/index.ts:13-26`; `secrets.rs` |
| OS permissions | Spawns user shell/processes, reads filesystem, lists processes (`ps`), kills PIDs, network egress | `pty.rs`, `lib.rs:99-171` |

### 1.2 Rust backend Tauri commands (the trust boundary)
| Command | Function | Confinement | Evidence |
|---|---|---|---|
| `pty_create` / `spawn_in_pty` | Spawn login shell (`$SHELL -l`) in a PTY | None — full shell | `pty.rs:185-350` |
| `pty_create_claude_role` | Spawn interactive `claude --append-system-prompt` (role + optional memory) | model allowlist; memory-slug validation | `pty.rs:437-500` |
| `pty_input` | Write arbitrary bytes to a PTY's stdin | None | `pty.rs:352-371` |
| `claude_pty_create` | Spawn orchestrated `claude` worker w/ per-terminal MCP config, worktree isolation, `--permission-mode acceptEdits` (or `bypassPermissions`) | model allowlist; worktree | `orchestrator.rs:328-490` |
| `run_shell_cmd` | Run a command from an **allowlist** in a cwd | command-name allowlist (incl. `git/npm/npx/node/python`) | `lib.rs:658-722` |
| `read_file` | Read any file as string | **NONE** — can read `~/.ssh/id_rsa`, `~/.aws/credentials` | `lib.rs:492-495` |
| `list_directory` | List any directory (expands `~`) | none (only hides dotfiles from listing) | `lib.rs:371-429` |
| `write_file` | Write file | Confined to `$HOME` or `$TMPDIR`; rejects `..`, null, symlink escape | `lib.rs:431-481` |
| `save_dropped_file` | Persist HTML5-dropped bytes to `$TMPDIR/shipspace-dropped/` | basename-only, control-char strip | `lib.rs:504-529` |
| `open_path` | `open <path>` (macOS) | **NONE** — opens any path/URL | `lib.rs:483-490` |
| `secret_set/get/delete/has` | OS keychain CRUD per provider | provider allowlist | `secrets.rs:36-68` |
| `gh_*` (status/clone/list/create_pr/pr_review/issue_view…) | Shell out to `gh` CLI w/ the user's OAuth token | per-arg flag-injection guards | `github.rs` |
| `git_ops::*` | git status/diff/stage/commit/worktree | (see git_ops.rs) | `lib.rs:863-871` |
| `worktree_merge` / `orchestrator_set_auto_merge` | Squash-merge agent worktree into workspace branch | refuses if task in-flight | `orchestrator.rs:494-534, 201-208` |
| `shipspace_process_list/kill_process` | Enumerate + SIGTERM ShipSpace-related processes | classify + `killable` gate | `lib.rs:99-171` |
| `browser_*` | Embedded WKWebView browser, asset extraction, DOM controller, inspector | `browser_extract_assets` has SSRF guard; `browser_navigate` does not | `browser_view.rs` |
| `ship_memory::*` | Read Ship Memory hub (markdown vault) | read paths | `ship_memory.rs` |

### 1.3 Agents / features
| Feature | Function | Provider/Exec model | Evidence |
|---|---|---|---|
| **ShipGang** (flagship) — Coordinator/Builder/Scout/Reviewer/Intel six-phase pipeline | Multi-agent code-gen. Two engines: API engine (cloud LLM text → code written to `shipgang-output/`) and PTY engine (real `claude` CLI in terminals, but still streams via API for structured output) | Cloud provider HTTP APIs; PTY variant spawns CLIs | `shipgang/engine.ts:721`, `engine-pty.ts:403`, `prompts.ts` |
| **Orchestrator** | In-process axum MCP server on `127.0.0.1:<rand>`; dispatches typed tasks to `claude` workers via MCP `get_my_next_task`/`report_result`; optional auto-merge | Local HTTP MCP + `claude` CLI | `orchestrator.rs:1-149, 562-877` |
| **Command-center chat** | App chat agent that emits JSON plans dispatched to live terminal panes | Cloud providers | `useAgentChatStore.ts:50-98`, `workspace-dispatch.ts:261` |
| **Auto-responder** | Auto-answers terminal interactive prompts ("1↵") per a 3-level setting | local `pty_input` | `auto-responder.ts` |
| **Terminal drag-drop → chat** | Drag a terminal pane (its scrollback/activity/convo summary) into agent chat as context | feeds cloud providers | `dragdrop/terminalDrag.ts` |
| **Embedded browser + inspector** | WKWebView; page context + selected element captured and usable as agent context | feeds providers | `browser_view.rs:1135-1323` |
| **GitHub integration** | sign-in, repo clone, PR create/review, issue view — via user's `gh` token | `gh` CLI | `github.rs` |
| **Ship Memory bind** | Inject a markdown note as standing system-prompt context into a terminal/agent | read-only MCP subset for workers | `orchestrator.rs:296-315, 433-441` |
| **Voice/Realtime** | OpenAI realtime + voice (TTS/STT) | OpenAI | `voice/openai-realtime.ts`, `openai-voice.ts` |
| **shipspace-mcp** | External MCP server exposing app state (workspaces, chats, settings, prompts, ShipGang runs) read-only to any connected LLM | stdio, read-only SQLite | `shipspace-mcp/src/index.ts` |

### 1.4 AI providers (keys held by ShipSpace)
`anthropic`, `openai`, `google`, `groq`, `deepseek`, `manus`, `perplexity`, `nano-banana`, `xai` (`secrets.rs:6-16`), plus local CLI agents `hermes`, `openclaw` (`lib.rs:664-666`; `providers/cli.ts`). Worker `claude`/`codex` CLIs run under the host machine's own credentials.

---

## 2. DATA FLOWS

### 2.1 ShipGang pipeline (flagship) data flow
```
USER MISSION + (optional) reference files / operator directives
        │  (renderer: useShipGangRunStore)
        ▼
[Pre-flight] validateProviderKey() ── key+billing probe ──► provider HTTP API
        │
        ▼
PHASE 0 INTEL ─► provider API (research) ─┐
PHASE 1 BRIEFING (Coordinator) ─► provider API ─► ##SECTION## parse
        │  tasks routed to roster
        ▼
PHASE 2/3 EXECUTING (Builders+Scouts, parallel, concurrency-pool) ─► provider API
        │  builder code blocks
        ▼
PHASE 4 REVIEWING (Reviewers) ─► provider API
        │
        ▼
PHASE 5 CLOSING (Coordinator verdict) ─► provider API
        │
        ▼
saveRunOutputs(): code blocks → write_file → ${directory}/shipgang-output/<mission>/<runId>/...
        │  (write_file confined to $HOME/$TMPDIR; filename hint reduced to safe basename)
        ▼
post-assembly sanitizer → project-detector → startPreview() (auto-serves generated app in iframe
        sandbox="allow-scripts allow-same-origin")  + detectFileChanges() via run_shell_cmd git status
```
- **Origin → destination:** user prompt + any uploaded reference-file *contents* (`engine.ts:787-793`) + injected operator directives (`engine.ts:59-80`) are sent to the selected cloud provider with the user's API key. Generated code is written to disk and optionally executed in a preview server.
- **Retention:** outputs persisted to `shipgang-output/` and zustand localStorage; sessions auto-saved as JSON (`engine.ts:298-311`). Provider-side retention governed by each vendor.
- **Controls:** API engine agents have **no shell** (pure text); the only filesystem write is the confined `write_file`. PTY engine spawns real CLIs (`createPtyTerminals` → `pty_create`/`pty_input`, `engine-pty.ts:372-400`) which **do** have shell.
- **Responsible party:** user (supplies prompt, keys, approves run); provider (model output); platform (orchestration, confinement).

### 2.2 Orchestrator task flow
`renderer enqueue → OrchestratorInner.queues → axum 127.0.0.1:<rand>/mcp/<terminal_id> → claude worker pulls get_my_next_task → executes in its worktree → report_result → (if auto_merge) background squash-merge into workspace branch` (`orchestrator.rs:151-166, 667-877, 833-852`). Origin check restricts browser origins to `tauri://`; CLI clients (no Origin header) are accepted (`orchestrator.rs:555-560`).

### 2.3 Secrets flow
`Settings UI → secret_set → OS keychain` (`useApiKeyStore.ts:70-73`). On hydrate, `secret_get` pulls **all** provider keys into renderer JS memory `keys{}` (`useApiKeyStore.ts:51-68`). Keys are attached to provider `fetch` calls (`providers/index.ts`, `anthropic.ts`, etc.). Legacy plaintext `shipspace-api-keys` localStorage is migrated to keychain then deleted (`useApiKeyStore.ts:28-44`).

### 2.4 Untrusted-input → provider flows (injection surface)
- Terminal scrollback/activity/conversation summary dragged into chat → system/user prompt (`terminalDrag.ts`).
- Embedded-browser page context + inspector selection → agent context (`browser_view.rs:1135-1323`).
- GitHub issue body (`gh_issue_view`) → briefs an agent (`github.rs:644-653`).
- Reference file contents and operator directives → ShipGang prompts (`engine.ts:787-793, 59-80`).
- **No secret-scrubbing/redaction exists on any of these paths** before transmission to cloud providers (grep for `scrub|redact|sk-ant|maskSecret` finds nothing in agent/terminal code).

---

## 3. SECURITY FINDINGS

| # | Severity | Finding | Evidence |
|---|---|---|---|
| S-1 | **CRITICAL** | **Agents get raw, unconfined PTY/shell.** No typed-intent layer between AI and shell — agent can run `rm -rf`, `curl | sh`, exfiltrate. Acknowledged in source. | `pty.rs:1-10` (verbatim `TODO(security): RISK — Mission agents get raw PTY (shell) access via pty_input … An agent can execute arbitrary commands (rm -rf, curl exfiltration, etc.)`); `pty.rs:352-371`; `engine-pty.ts:382-396` |
| S-2 | **HIGH** | **`read_file` has zero path confinement** while `write_file` is hardened — inconsistent. Renderer (or injected script via `withGlobalTauri`) can read `~/.ssh/id_rsa`, `~/.aws/credentials`, `.env`, keychain-adjacent files. | `lib.rs:492-495` vs `lib.rs:431-481` |
| S-3 | **HIGH** | **Auto-approve "all" mode auto-answers ANY terminal permission prompt with "1" (approve)** — including prompts to run shell commands / overwrite files. User-selectable; removes the human gate. | `auto-responder.ts:30-38` (`risk:'risky'`, "may ask to run a shell command or overwrite a file. Only auto-answer under 'all'"), `:51-55, 97-100` |
| S-4 | **HIGH** | **`withGlobalTauri: true`** exposes the full Tauri invoke bridge to all renderer JS. Combined with S-2 and in-memory keys (S-6), any successful script injection (e.g. from rendered agent/browser content) can read files + secrets + spawn shells. | `tauri.conf.json:13` |
| S-5 | **HIGH** | **`bypassPermissions` path exists** (`claude --permission-mode bypassPermissions`) disabling all of Claude's per-tool gating and `--allowedTools`. Off by default and never set `true` from renderer today, but the capability is wired through the command surface. | `orchestrator.rs:339-342, 446-450` |
| S-6 | **MEDIUM** | **All provider API keys decrypted into renderer JS memory** on hydrate (defeats some keychain benefit; reachable via S-4). | `useApiKeyStore.ts:51-68, 85` |
| S-7 | **MEDIUM** | **`run_shell_cmd` allowlist includes general-purpose interpreters** (`node`, `python`, `python3`, `npm`, `npx`, `cargo`, `git`) — allowlisting the binary name does not constrain what code they run (`npm run`, `node -e`, `python -c`). Mitigates only the most naive cases. | `lib.rs:660-666` |
| S-8 | **MEDIUM** | **Auto-merge squashes agent-written, AI-authored code into the workspace branch with no human review** when the toggle is on; merge runs in background on `report_result`. | `orchestrator.rs:796-852`; toggle `OrchestratorStatusStrip.tsx:295-300` |
| S-9 | **MEDIUM** | **Orchestrator MCP server has no auth token** — any local process that can reach `127.0.0.1:<rand>` and send `Origin: tauri://*` (or no Origin) can pull/inject tasks. Port is random but unauthenticated. | `orchestrator.rs:120-148, 555-570` |
| S-10 | **MEDIUM** | **shipspace-mcp exposes app state to any connected LLM with no per-call auth** (stdio = trusts whoever the user wired it to): workspaces, chats, settings, prompts, ShipGang runs. Mitigated by sensitive-key filter + `ALLOWED_KEYS` allowlist that explicitly excludes `shipspace-api-keys`. | `shipspace-mcp/src/index.ts:132-154, 444-462` |
| S-11 | **MEDIUM** | **No secret scrubbing** on untrusted-content → provider flows (terminal scrollback, browser page context, issue bodies, reference files). A `.env`/key visible in a terminal will be sent verbatim to the cloud model. | §2.4; grep negative |
| S-12 | **MEDIUM** | **ShipGang preview iframe uses `sandbox="allow-scripts allow-same-origin"`** for AI-generated HTML — that combination lets the framed (untrusted, model-authored) page remove its own sandbox and script against same-origin context. | `ShipGang/AppPreviewPanel.tsx:301, 367` |
| S-13 | **LOW** | **`open_path` / `open_path`-style `open <path>`** unconfined — could open arbitrary file/URL/app via macOS `open`. | `lib.rs:483-490` |
| S-14 | **LOW** | **`browser_navigate` (the embedded browser) is not SSRF-guarded** (only the `browser_extract_assets` *fetch* path is). The browser can be steered to `127.0.0.1`/metadata-style URLs; its page context can then reach agents. | `browser_view.rs:108-138` (guard) vs `:914-921` (navigate) |

### Notable mitigations present (credit where due)
- `write_file` path-traversal + symlink-escape confinement (`lib.rs:437-481`).
- ShipGang filename hints reduced to safe basenames; cannot escape output dir (`engine.ts:107-117`).
- Model strings + memory slugs validated against allowlists before being passed to CLI args (`orchestrator.rs:283-326`, `pty.rs:425-431`).
- `gh`/clone/PR args guarded against flag/path injection (`github.rs:255, 284-290, 468`).
- SSRF guard on `browser_extract_assets` covers loopback/RFC1918/link-local incl. `169.254.169.254` and IPv6 ULA/mapped (`browser_view.rs:78-138`).
- Orchestrated workers default to `acceptEdits` (not bypass), `--strict-mcp-config`, read-only Ship Memory subset, worktree isolation, and a strong protective system prompt forbidding destructive ops (`orchestrator.rs:267-278, 426-450`).
- Regex risk-gate blocks `rm -rf`, hard reset, force push, drops, sudo, secret/.env touches on **plan/terminal dispatch** paths (`safety-policy.ts:12-26`, called at `workspace-dispatch.ts:262`, `useAgentChatStore.ts:36`).
- Command-center chat plans are **staged, not auto-run** — require user "run it" (`useAgentChatStore.ts:89`).

---

## 4. PRIVACY

| Aspect | Finding | Rating |
|---|---|---|
| Data to cloud | Mission prompts, reference-file *contents*, code, terminal scrollback (via drag), browser page context, GitHub issue bodies → Anthropic/OpenAI/Google/Groq/DeepSeek/xAI/Perplexity per model choice | HIGH exposure |
| Secret leakage to cloud | No redaction; secrets visible in terminal/files can be transmitted verbatim (S-11) | HIGH |
| Local data at rest | localStorage SQLite (chats, settings, prompts, runs), `shipgang-output/`, lifecycle/crash/`pty-pids.tsv` logs under `~/Library/Logs/ShipSpace/` | MEDIUM |
| Keys at rest | OS keychain (good); transiently in renderer memory (S-6) | MEDIUM |
| Retention/deletion/export | No app-level provider-data retention controls; outputs/sessions persist until user deletes; ShipGang sessions export/import as JSON (`engine.ts:317-359`). No "delete all my data" path observed | MEDIUM |
| Telemetry | Updater pings `makeshiphappen.tech`; Supabase auth. No third-party analytics observed in scope | LOW |

---

## 5. LIABILITY / LEGAL

| Risk | Detail | Evidence |
|---|---|---|
| Autonomous-agent harm | Raw-shell agents (S-1) + auto-approve-all (S-3) + auto-merge (S-8) can delete/modify user data with no human checkpoint. Source itself documents arbitrary-command capability and that confinement is "only … OS-level user permissions." | `pty.rs:1-10` |
| CFAA-adjacent | `read_file` (S-2) + browser navigation (S-14) + unconfined `open_path` could, if pointed at others' systems/data, read or touch unauthorized resources. Owner-of-machine context limits exposure, but the lack of confinement is the platform's responsibility. | `lib.rs:483-495` |
| Vendor AUP | `bypassPermissions` (S-5) and `--dangerously`-style unattended automation can violate provider "no fully-autonomous unsafe use / keep a human in the loop" terms; auto-approve-all compounds this. (Note: literal string `--dangerously-bypass-approvals-and-sandbox` not present; `bypassPermissions` is the live mechanism.) | `orchestrator.rs:446` |
| License contamination | AI-generated code auto-merged into the user's repo (S-8) with no provenance/license review → IP/licensing exposure if model emits copyrighted snippets. | `engine.ts` save path; `orchestrator.rs:833-852` |
| GitHub authorship | PRs/commits/reviews open under the **user's** `gh` OAuth identity. Agent-prepared PR bodies are attributable to the human account; misattribution/authorization risk if triggered without explicit user intent. (Current PR creation is UI-command-driven, not autonomously invoked by workers in scope read.) | `github.rs:491-545` |

---

## 6. USER-RESPONSIBILITY MATRIX

| Feature | Owner | Notes / where unclear |
|---|---|---|
| Setting/holding API keys & billing | **User** | App stores in keychain; user owns spend/limits |
| Approving plans before dispatch | **User** | Gated ("run it"); but **auto-approve-all shifts this to opt-out** (unclear/ risky) |
| Enabling auto-merge | **User** | Toggle; user owns merged AI code |
| Destructive command outcomes | **Shared** (user runs; platform provides unconfined shell) | Platform should add typed-intent gate (S-1) |
| Reading sensitive files via `read_file` | **Platform** | No confinement = platform responsibility |
| Provider AUP compliance in bypass/auto modes | **User + Provider** | App enables the mode; user accepts terms |
| Data sent to cloud models | **User (choice) + Provider (processing)** | No platform-side scrubbing |
| GitHub actions under user token | **User** | Authored as the user |
| MCP exposure of app state | **User** (chooses to wire MCP) | App should document the trust model |

---

## 7. MARKETING / COPY CLAIMS IN SCOPE

- `ship-it-guidelines/README.md` — anti-defensive "vibe coding" ethos: *"replaces the defensive posture with a creative one,"* *"Build Bold, Break Nothing,"* *"take creative swings."* This is the philosophy that ships with the product and is in tension with the safety findings above (encourages reduced caution).
- ShipGang preset copy markets a *"comprehensive security audit … OWASP Top 10 … severity-ranked findings"* mission (`ShipGang/ShipGangModal.tsx:530-531`) — an explicit capability claim users may rely on.
- Orchestrator system prompt asserts strong protections (*"Protect the user's files, code, credentials … Do not run destructive or high-risk commands without explicit user approval"*, `orchestrator.rs:267-278`) — note this is a **prompt-level** assurance, not an enforced control; a jailbroken/injected agent is not bound by it (relevant to S-1/S-11).
- No "fully autonomous / hands-free / sandboxed-safe" headline claims found in scope source beyond the above.

---

## 8. LICENSES / DEPS / SECRETS OBSERVED

- **Frontend deps** (`ShipSpace/package.json`): `@supabase/supabase-js`, `@tauri-apps/api` + plugins (dialog/http/process/shell/updater), `@xterm/*`, `framer-motion`, `lucide-react`, `react@19`, `zustand`. Dev: `vite`, `vitest`, `typescript`, `tailwind`.
- **MCP deps** (`shipspace-mcp/package.json`): `@modelcontextprotocol/sdk`, `better-sqlite3`.
- **Rust crates** (from `lib.rs`/modules): `tauri` + plugins, `portable-pty`, `axum`, `tokio`, `keyring`, `base64`, `uuid`, `serde`, `log`.
- **Secrets:** `ShipSpace/.env` holds `VITE_SUPABASE_URL/ANON_KEY/WEBSITE_URL`. **`.env` is gitignored** (`git check-ignore .env` = ignored; `.gitignore:6`). The Supabase **anon** key is public-by-design (RLS-gated). Provider keys are **not** in `.env` (commented out) and live in the OS keychain — correct. No hardcoded private API keys found in scope source.
- **Updater pubkey** is a public minisign verification key (safe to embed).

---

## Appendix — Highest-severity quick reference
- **S-1 CRITICAL** raw shell to agents — `pty.rs:1-10, 352-371`
- **S-2 HIGH** unconfined `read_file` (can read `~/.ssh`) — `lib.rs:492-495`
- **S-3 HIGH** auto-approve-all answers any permission prompt "1" — `auto-responder.ts:30-38`
- **S-4 HIGH** `withGlobalTauri:true` — `tauri.conf.json:13`
- **S-5 HIGH** `bypassPermissions` path — `orchestrator.rs:446`
