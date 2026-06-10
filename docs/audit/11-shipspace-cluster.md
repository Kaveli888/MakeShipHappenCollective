# Audit 11 — ShipSpace Product Cluster

Scope: `ShipSpace/` (Tauri desktop Agent Development Environment), `shipspace-mcp/`, `packages/account-menu/`, `shipyard-os/`, `shipgang-output/`, `.shipspace/`. Independent governance / security / privacy review. Read-only; no code modified.

Auditor model: Claude Opus 4.8. Date: 2026-06-07.

> **Headline:** ShipSpace is a desktop platform whose core function is to run AI agents that **execute arbitrary shell commands and edit files on the user's machine**. The primary backend channel (`pty_input` → raw PTY) has **no command-validation layer** — a fact the source code itself flags as an unmitigated RISK (`src-tauri/src/pty.rs:1-10`). Multiple "auto" / "danger" / "bypass" modes exist that disable the few guardrails that are present. This is the highest-risk product in the ecosystem from a "harmful command execution / code exfiltration" standpoint.

---

## PHASE 1 — INVENTORY

### 1.0 Cluster overview
| Item | Detail |
|---|---|
| Product | ShipSpace "Agent Development Environment" (Tauri 2, React 19, Rust backend) |
| Identifier | `com.shipspace.ade` (dev `.dev`, beta `.beta`) — `tauri.conf.json` |
| Version | 0.1.3 |
| Signing | `Developer ID Application: Jacob Felton (7G7K3X24Q5)` |
| Updater | Active; endpoint `https://makeshiphappen.tech/api/updates/shipspace/latest`, minisign pubkey embedded |
| Frontend stack | React 19, Zustand, xterm.js, framer-motion, Tailwind |
| Backend stack | Rust: `tauri`, `portable-pty`, `axum` (local MCP server), `keyring`, `reqwest`, `tokio` |

### 1.1 ShipSpace desktop app
**Purpose:** Multi-agent orchestration / IDE. Workspaces contain split panes (terminals, browser, IDE, chat). Agents: Coordinator, Builder, Scout, Reviewer ("ShipGang" flagship). Includes terminals (PTY), an embedded browser tool with agent automation, chat with many AI providers, GitHub PR/issue flow, Ship Memory integration, Mission Control views.

**Tauri commands (full surface — `lib.rs:808-893`):** PTY (`pty_create`, `pty_create_claude_role`, `pty_input`, `pty_resize`, `pty_destroy`); orchestrator (`claude_pty_create`, enqueue/state, worktree merge/remove, set_auto_merge); filesystem (`list_directory`, `write_file`, `read_file`, `save_dropped_file`, `open_path`, `path_exists`); process diagnostics (`shipspace_process_list/kill_process/cleanup_stale`); `run_shell_cmd`; secrets (`secret_set/get/delete/has`); GitHub (13 `gh_*` commands); git (`git_*`); browser_view (~25 commands incl. controller click/type/scroll, eval-based); ship_memory (read-only).

### 1.2 AI providers / integrations (cited)
- **Anthropic / Claude** — `src/lib/agents/providers/anthropic.ts` → `https://api.anthropic.com/v1/messages`; also the **`claude` CLI** spawned in PTYs (`pty_create_claude_role`, `claude_pty_create`, ShipGang `engine-pty.ts`).
- **OpenAI** — `providers/openai.ts`, voice/realtime (`openai-realtime.ts`, WSS), TTS/STT.
- **Google Gemini** — `providers/google.ts` (`generativelanguage.googleapis.com`).
- **Groq** — `providers/groq.ts` (chat + TTS/STT).
- **DeepSeek, xAI/Grok, Perplexity, Manus, nano-banana** — provider modules each.
- **CLI agents Hermes & OpenClaw** — `providers/cli.ts` → `run_shell_cmd` (`hermes -z`, `openclaw agent`). OpenClaw gets `OLLAMA_API_KEY=ollama-local` + node@24 PATH inject (`lib.rs:698-704`).
- **`codex` CLI** — referenced in `package.json` scripts (`codex:auto`, `codex:auto:danger`).
- **shipspace-mcp** — stdio MCP server exposing persisted ShipSpace state read-only to *other* agents.
- **Ship Memory MCP** — read-only subset wired into orchestrated workers (`orchestrator.rs:319-341`).
- **GitHub** via `gh` CLI.
- **Supabase** — auth + subscription gate.

### 1.3 Authentication
- **MakeShipHappen account gate (`AuthGate.tsx`):** Supabase email/password sign-in required; then a subscription-tier gate — `tier === 'free'` is blocked with "Subscription Required". Client-side lockout after 5 fails / 5 min.
- **Owner bypass (`owner.ts`):** `zzgemsjewelry@gmail.com` is hard-coded as owner and forced to `team` tier client-side, bypassing the DB lookup — note this is **client-side only** (the desktop renderer trusts itself), so it gates UX, not server data.
- **API keys:** stored in OS keychain via `keyring` (`secrets.rs`), service `com.makeshiphappen.shipspace[.dev/.beta]`, provider-scoped allowlist.
- **GitHub:** `gh` CLI's own OAuth token (its keyring); `gh auth login --web` driven through a PTY (`github.rs:313`).
- **Supabase anon key + URL committed** in `ShipSpace/.env` (anon key — low sensitivity but see Phase 7).

### 1.4 Permissions (Tauri capabilities — `capabilities/default.json`)
`core:default`, `process:default`, `updater:default`, `shell:allow-open`, `dialog:default`, and `http:default` scoped to the 5 AI provider domains. CSP `connect-src` adds Supabase + localhost. Note the **custom Rust commands (PTY spawn, `run_shell_cmd`, filesystem, git) are NOT gated by Tauri's allowlist** — they are first-class `#[tauri::command]`s callable by any renderer code. `withGlobalTauri: true` exposes the IPC bridge on `window`.

### 1.5 Storage locations
- API keys → OS keychain.
- All app state (workspaces, gangs, runs, chats, prompts, **API keys mirrored into a Zustand store in memory**) → WebKit localStorage (`localstorage.sqlite3`), read by shipspace-mcp (`shipspace-mcp/src/index.ts`).
- Logs → `~/Library/Logs/ShipSpace/` (`crash.log`, `lifecycle.log`, `pty-pids.tsv`) — lifecycle log records every PTY command + cwd.
- Orchestrator MCP config (with localhost URL) → `$TMPDIR/shipspace-orchestrator-<terminal_id>.json`.
- Dropped files → `$TMPDIR/shipspace-dropped/`.
- ShipGang outputs → `shipgang-output/sg-run-*/` (agent-generated code).
- Git worktrees → `<workspace>/.shipspace/worktrees/<terminal_id>/`.
- Ship Memory hub → `~/ShipMemory`.

### 1.6 Data processed
User source code, terminal stdin/stdout, chat logs, transcripts, GitHub repo contents, issue/PR text, Ship Memory notes, and API keys. Code and terminal context are sent to third-party AI providers (see Phase 2).

---

## PHASE 2 — DATA FLOW

| Flow | Origin → Destination | Sent content | Retention | Controls / Responsible |
|---|---|---|---|---|
| Chat / ShipGang agent calls | Renderer → provider HTTPS (Anthropic/OpenAI/Google/Groq/DeepSeek/xAI/Perplexity) | User message, system prompt, **builder/scout/reviewer outputs that contain generated code**, aggregated (`engine-pty.ts:614-637`). Mission prompts can include code/file context. | Per provider policy | API key from keychain → into renderer memory → `x-api-key` header. **User-supplied keys = user is responsible.** |
| Claude CLI agents (PTY) | `claude` process in workspace cwd | Whatever the agent reads (the user's repo) → Anthropic. The CLI has its own data path. | Anthropic | User's own Claude auth |
| Terminal I/O | xterm ↔ Rust PTY (`pty_input`/`pty-data-*`) base64 over Tauri IPC | Raw shell I/O; logged to `lifecycle.log` (commands + cwd, not full output) | Local log file (unbounded append) | OS user perms only |
| Agent-to-agent (ShipGang) | In-renderer store (`useShipGangRunStore`) | Each agent's full output passed into the next agent's prompt and re-sent to providers | In localStorage | None beyond app |
| Orchestrator task channel | `claude` worker → `127.0.0.1:<rand>/mcp/<tid>` (axum) | Task intent, file scope, result summary | In-memory + localStorage | `origin` check (`tauri://` or no-origin CLI); **no auth token on the loopback MCP endpoint** |
| Voice | Mic → OpenAI/Groq STT, TTS back | Audio of user speech | Provider | User key |
| GitHub | `gh` CLI shell-out | Repo clone, PR create/review, issue read | GitHub | `gh` token |
| Drag-drop terminal → chat | Renderer store → chat context → provider | Terminal label/role/directive/**conversation summary + activity** injected as prompt context (`terminalDrag.ts`) | Provider | None — terminal output can leak into prompts |
| shipspace-mcp | External agent (e.g. Claude Code) → reads localStorage sqlite | All persisted ShipSpace state **including the api-key store if persisted** | Read-only | Local FS perms |

**Leak surfaces:** (a) ShipGang re-sends generated code between agents and to providers; (b) drag-drop injects terminal context (which can contain secrets the user printed) into chat prompts; (c) Claude CLI agents read the whole repo. There is **no scrubbing of secrets from prompt context** anywhere in the pipeline. The safety policy *string* warns models not to touch secrets, but nothing redacts secrets already present in context before it ships to a provider.

---

## PHASE 3 — LIABILITY (raw material)

- **Autonomous destructive commands:** `pty_input` writes arbitrary bytes to a login shell with the user's full OS privileges. An agent (or prompt-injected agent) can run `rm -rf`, `curl | sh`, exfiltrate `~/.ssh`, etc. The only barriers are (i) a **frontend-only regex** (`safety-policy.ts`) that gates *dispatch of orchestrator plans/terminal text*, trivially bypassable because the model emits commands directly into the PTY, not through that gate; and (ii) a **prompt-level policy string**. Neither is an enforcement boundary. `pty.rs:1-10` documents this as a known unmitigated RISK.
- **Agent opening PRs / pushing:** `gh_create_pr` runs `git push -u origin <branch>` then `gh pr create` (`github.rs:489-545`). Combined with autonomous agents this means an agent can push branches and open PRs to the user's GitHub on the user's identity.
- **Auto-merge into the working branch:** `report_result(done)` with auto-merge ON triggers `merge_worktree` → `git merge --squash` + `git commit` into the workspace's **current branch with no human review** (`orchestrator.rs:778-798`, `worktree.rs:256-279`). Agent-written code lands in the user's branch automatically.
- **Auto-responder** can auto-approve Claude CLI permission prompts — including "run this shell command / overwrite this file" — when set to `'all'` (`auto-responder.ts:30-37`). Plan acceptance auto-fires even on `'safe'`.

**Responsibility allocation as built:** the user runs everything under their own machine/account/keys/tokens; the platform provides the autonomy and the convenience modes that remove approvals. Liability for damage (deleted files, leaked secrets, bad pushes, provider charges) falls on the user, but the platform ships the dangerous defaults/opt-ins and lacks an enforcement sandbox.

---

## PHASE 4 — RESPONSIBILITY / PROMPT INJECTION

- **Prompt-injection → command execution:** A poisoned file, web page (browser tool), GitHub issue (`gh_issue_view` feeds issue body to an agent — `IssuesModal.tsx:45`), or terminal output dragged into chat can carry instructions. Because agents have raw shell + file write, a successful injection can run arbitrary commands or exfiltrate code/secrets. There is no second control plane.
- **Browser controller (`browser_view.rs`)** executes `wv.eval(script)` for navigate/click/type/scroll/inspector. Agent-influenced selectors/values are interpolated into JS run in the embedded webview — DOM/script-injection surface within visited pages.
- **Worktree isolation** (per-terminal branch) limits teammate collision and gives a review gate **only if auto-merge is OFF**; it does not sandbox the filesystem (the worktree is inside the user's repo and the shell can `cd` anywhere).
- Responsible parties: user (provides target dirs, keys, tokens, turns on auto modes); platform (designs the autonomy + bypass modes, owns the missing sandbox).

---

## PHASE 7 — SECURITY (risk-rated)

### CRITICAL
1. **Raw, unvalidated shell access for AI agents (`pty_input` / PTY).** No typed-intent layer between agent and shell; agents run with full user privileges. Self-documented RISK in `pty.rs:1-10`. Frontend regex + prompt policy are not enforcement. **Impact: arbitrary command execution, secret exfiltration, data destruction.**
2. **`codex:auto:danger` = `codex --dangerously-bypass-approvals-and-sandbox`** (`package.json:21`). A first-class, shipped npm script that runs an autonomous coding agent with **all approvals AND the sandbox disabled**. Also `agent:auto` = `claude --permission-mode auto` and `codex:auto` = `codex --full-auto`. These are the loudest red flags in the repo: they intentionally remove every guardrail.
3. **`claude_pty_create(bypass_permissions: true)` → `--permission-mode bypassPermissions`** (`orchestrator.rs:401-409`) disables ALL of Claude's per-tool gating (and makes `--allowedTools` moot, as the code notes). Default is `acceptEdits` (auto-approves file edits without prompting). Currently the XTerminal caller doesn't pass `bypass_permissions`, but the path exists and `acceptEdits` already auto-applies edits.

### HIGH
4. **Auto-merge of agent output into the user's branch with no review** (`orchestrator.rs:778`, `worktree.rs`). Squash-merges + commits automatically on task `done`.
5. **Auto-responder `'all'` mode auto-approves risky CLI permission prompts** (shell exec / file overwrite) — `auto-responder.ts`. Removes the human-in-the-loop that Claude CLI provides.
6. **Loopback orchestrator MCP server has no auth token** (`orchestrator.rs`). Bound to `127.0.0.1:<random>`, gated only by an `origin` header check that **explicitly accepts requests with no origin** (`origin_ok` returns true for `None`). Any local process that learns the port can enqueue is N/A (enqueue is a Tauri command, not HTTP) but can call `get_my_next_task`/`report_result` to spoof results / drain tasks. Localhost-only limits blast radius to local malware.
7. **Prompt-injection → exfiltration** (Phase 4). Code/secrets in context reach providers and agents act on untrusted content with shell access. No secret scrubbing.
8. **Agent-driven `git push` + PR creation** on the user's GitHub identity (`gh_create_pr`).

### MEDIUM
9. **API keys mirrored from keychain into renderer JS memory** (`useApiKeyStore`) and passed as plaintext to provider `fetch`. Keychain-at-rest is good; in-memory exposure means any XSS/injected-script in the renderer can read all provider keys. `withGlobalTauri: true` widens the IPC attack surface if renderer is ever compromised.
10. **`run_shell_cmd` allowlist is reasonable but broad** (`lib.rs:660-666`): `node`, `npm`, `npx`, `python`, `cargo`, `find`, etc. — several of these (`node -e`, `npx <anything>`, `python -c`) are arbitrary-code primitives. The allowlist blocks `sh`/`bash` but not interpreter-as-shell.
11. **Browser controller `wv.eval` with interpolated values** (`browser_view.rs:1210-1290`) — script-injection within visited pages if selector/value sanitization is incomplete.
12. **`write_file` / `read_file`:** `write_file` is hardened (rejects `..`, null bytes, confines to HOME/tmp, resolves symlinks — `lib.rs:431-481`). **`read_file` has NO path confinement** (`lib.rs:492-495`) — renderer can read any file the user can (e.g. `~/.ssh/id_rsa`). `list_directory` likewise unconfined (skips dotfiles only).
13. **`open_path` runs `open <path>`** with no validation (`lib.rs:483-490`) — can launch arbitrary files/apps.
14. **Supabase anon key + URL committed to `.env`** (in repo). Anon key is low-sensitivity by design, but pairing it with the client-side-only owner/tier bypass means subscription gating is not a real security boundary (acceptable for a paid desktop app, but don't treat the gate as authz).
15. **Unbounded local logs** (`lifecycle.log`, `pty-pids.tsv`) record every PTY command + cwd in cleartext — minor info-leak / disk-growth.

### LOW
16. Process kill/list via `ps`/`kill` is scoped to ShipSpace-classified PIDs (`lib.rs` classifier) — reasonable.
17. CSP is restrictive and provider-scoped; HTTP capability allowlist matches. Good.
18. Model-alias validation before CLI injection (`validate_claude_model`) prevents arg injection via model strings. Good.
19. `gh_*` and `git` arg-injection guards (reject `-`-prefixed, whitespace, `..`). Good.

---

## PHASE 8 — OPEN SOURCE / LICENSING

**Rust (`Cargo.toml`):** `tauri`/plugins (Apache-2.0/MIT), `portable-pty` (MIT), `axum`/`tower-http`/`tokio` (MIT), `keyring` (MIT/Apache), `reqwest` (MIT/Apache, `rustls-tls` — avoids OpenSSL), `serde`, `uuid`, `regex`, `url`, `base64`, `log`. All permissive; **no copyleft concerns** in the Rust tree.

**JS (`package.json`):** React 19 (MIT), Zustand (MIT), `@xterm/*` (MIT), framer-motion (MIT), lucide-react (ISC), `@supabase/supabase-js` (MIT), Tauri JS plugins (MIT/Apache), Vite/Tailwind/TS (MIT). shipspace-mcp uses `@modelcontextprotocol/sdk` (MIT) + `better-sqlite3` (MIT). **All permissive.**

**Bundled / shelled-out CLIs (NOT bundled — invoked from user's machine):** `claude` (Anthropic, proprietary), `codex` (OpenAI, check license/ToS — `--dangerously-bypass-...` usage may conflict with provider ToS), `gh` (MIT), `hermes` / `openclaw` (third-party CLI agents — licensing unverified; OpenClaw points at local Ollama). Because these are not redistributed, ShipSpace doesn't inherit their licenses, but **agent-autonomy use of `codex --dangerously-bypass` and `claude --permission-mode auto` may violate those vendors' acceptable-use terms** — worth a compliance check.

---

## PHASE 9 — MARKETING / SAFETY CLAIMS

No README/marketing copy ships in the audited tree (only `VOICE_REVIEW_PROMPT_FOR_CLAUDE.md` and `benchmarks/README.md`). In-app/system-prompt language that makes **safety/isolation claims** (verbatim, must be backed by reality):

- Orchestrator system prompt: *"You are running inside a dedicated git worktree on a feature branch — your edits are isolated from your teammates… Protect the user's files, code, credentials, data, terminals, and running services."* (`orchestrator.rs:267-278`). **Exposure:** "isolated" = git-worktree isolation only; it is **not OS/filesystem isolation** — the agent shell can leave the worktree. The protective clauses are model instructions, not enforced controls.
- Master system prompt #14 "SAFE OPERATION" and the `SHIPSPACE_SAFETY_POLICY_PROMPT` (`safety-policy.ts:3-10`) promise the model won't do destructive ops without approval. **Exposure:** these are prompts, not guardrails; `bypassPermissions`/`acceptEdits`/auto-responder/`codex:auto:danger` actively remove the approval step.
- Ship Memory wired as *"READONLY enforced server-side"* (`orchestrator.rs:336-340`) — this claim **is** backed (write tools not advertised + `SHIP_MEMORY_READONLY=1`). Good example of a real control vs. a prompt.

If any external copy claims "your code never leaves your machine," it would be **false** for chat/ShipGang/CLI flows (code is sent to Anthropic/OpenAI/etc.). No such claim found in-repo, but flag for the website team.

---

## TOP 5 RISKS

1. **CRITICAL — Unsandboxed arbitrary command execution by AI agents** (`pty_input` raw PTY, no intent validation; self-flagged in `pty.rs`). User-privilege shell = destruction/exfiltration if the agent misbehaves or is prompt-injected.
2. **CRITICAL — Shipped "danger/auto/bypass" modes** (`codex:auto:danger` = `--dangerously-bypass-approvals-and-sandbox`, `agent:auto`, `codex:auto`, `claude_pty_create bypass_permissions`, default `acceptEdits`) that intentionally remove every approval and the sandbox.
3. **HIGH — Auto-merge + auto-responder remove the human gate** by silently merging agent code into the working branch and auto-approving risky CLI prompts.
4. **HIGH — Prompt-injection → code/secret exfiltration**: untrusted files/web/issues/terminal-drag context reach agents with shell+filewrite and providers, with no secret scrubbing.
5. **MEDIUM/HIGH — Read-side filesystem & key exposure**: `read_file`/`list_directory`/`open_path` are path-unconfined (can read `~/.ssh`), and provider API keys live in renderer memory; combined with `withGlobalTauri`, any renderer compromise is full-machine read + key theft.
