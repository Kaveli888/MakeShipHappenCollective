# Audit 14 — Utilities & Memory Cluster

**Scope:** ShipWatch, ShipCode, ShipClick, ship-memory (core/mcp/connector-obsidian), shipyard-os, root loose scripts/assets (summarize_readme.sh, flappy-bird game, src/).
**Auditor role:** independent governance/security/privacy. Read-only. Build artifacts (node_modules, target, .next, dist) excluded.
**Date:** 2026-06-07

---

## PHASE 1 — INVENTORY

### ShipWatch (`ShipWatch/`)
- **Purpose:** macOS Tauri 2 desktop "personal memory" / activity-surveillance app. Continuously captures the user's own screen, microphone, system audio (meetings), clipboard, app-switch activity, browser URLs, and document paths; runs OCR + LLM vision over screenshots; summarizes into a searchable timeline and an "Ask Relaa" chat.
- **User-facing:** Home/Activity/Projects/Settings/Agents/AskRelaa/Onboarding/Memories pages; tray menu (Start/Stop Recording, Open, Quit); auto-export to an Obsidian vault.
- **Internal:** Vite+React 19 frontend; Rust backend (`src-tauri/src/lib.rs`) exposing ~28 Tauri commands that shell out to macOS tools (`screencapture`, `ffmpeg`, `whisper-cli`, `osascript`, `pbpaste`, `ioreg`, `python3 Quartz`, `system_profiler`, a bundled/JIT-compiled Swift `ocr-tool`).
- **Storage:** Local SQLite `sqlite:shipwatch.db` (Tauri SQL plugin) — tables `memories`, `chat_messages`, `projects`, `settings`, `activity_log`, `clipboard_history`, `ocr_text`. Screenshots/audio written to the app data dir (`~/Library/Application Support/com.shipwatch.app/{screenshots,audio,system_audio}`). API keys + license + provider + proxy URL kept in browser `localStorage` (`ShipWatch/src/lib/ai.ts`), **not** Keychain.
- **AI providers / endpoints (`src/lib/ai.ts`):** Ollama (`http://localhost:11434`, default), Gemini (`generativelanguage.googleapis.com`), Anthropic (`api.anthropic.com`), OpenAI (`api.openai.com`), and "ShipWatch Cloud" proxy (default `https://api.shipwatch.app`). Vision/summarization default to local Ollama.
- **Auth/permissions:** Requires macOS Screen Recording, Microphone, and Accessibility/Automation (AppleScript) permissions. Autostart-as-login-item plugin. No app-level lock/PIN.

#### ShipWatch Server (`ShipWatch/server/`) — the network surface
- **Purpose:** Hono HTTP proxy ("shipwatch-proxy") so licensed users can use Claude without supplying their own Anthropic key. The server holds the `ANTHROPIC_API_KEY`.
- **Endpoints:** `GET /v1/health`, `POST /v1/chat` (streaming SSE). Model allowlisted to `claude-sonnet-4-6-20250514`.
- **Auth on it:** `Authorization: Bearer <license>`. License validated via `isValidLicense()` — hardcoded `VALID_LICENSES` env list and/or Gumroad license API (`api.gumroad.com/v2/licenses/verify`), 24h cache. In-memory per-key rate limiter (default 100/hr).
- **Bind address:** Exported as `export default { port, fetch }` (Bun/Hono serve convention). Port default `3100` from `PORT`. **No host/bind address is specified, so the default runtime binds all interfaces (0.0.0.0).** CORS origin is restricted to `tauri://localhost` / `https://tauri.localhost`, but CORS is a browser-only control and does **not** prevent non-browser clients from calling the endpoint. This is a server-side product the vendor operates, not shipped to end users, but its exposure matters (see Phase 7).
- **Deps:** `@anthropic-ai/sdk`, `hono`. Secret via `.env` (`.env.example` shows `ANTHROPIC_API_KEY`, `VALID_LICENSES`, `GUMROAD_PRODUCT_ID`, `RATE_LIMIT`).

### ShipCode (`ShipCode/`)
- **Purpose:** Published npm CLI (`shipcode-cli`, v0.6.1, MIT) — "plain-language coding from your terminal," model-agnostic AI shell with a provider fallback chain and approval-gated file edits. Forthcoming developer distribution channel for the MakeShipHappen suite.
- **AI providers (`src/ai/providers.ts`):** ollama (local), anthropic, openai/codex (`/v1/responses`), groq, gemini, perplexity, openrouter — all real cloud endpoints.
- **Auth:** Browser-based OAuth-style login (`src/auth/login.ts`) against `https://makeshiphappen.tech/auth/cli-login`; Supabase session (access/refresh tokens) stored in `~/.shipcode/auth.json` (chmod 600). Subscription tier resolved server-side via `/api/auth/verify` (good — see Phase 7). Owner-bypass email `zzgemsjewelry@gmail.com` (`src/auth/owner.ts`).
- **Secrets (`src/config/secrets.ts`):** API keys resolved env var → `~/.shipcode/keys.json` (chmod 600) → macOS Keychain (`security` CLI, service `shipcode-<provider>`). Good layered handling.
- **Free-tier metering (`src/auth/usage.ts`):** monthly message count in `~/.shipcode/usage.json` — **client-side only**.
- **Telemetry:** Supabase `usage_events` table (anon key embedded; only sends when signed in) + Sentry (`@sentry/node`, hardcoded public DSN, `sendDefaultPii:false`, attaches signed-in email only).
- **Command execution:** `src/ai/tools.ts` `runCommand()`/`grepContent()` use `execSync` with string interpolation. **Confirmed NOT wired into the AI chat loop** — only `readFile` is imported by `chat.ts`; file changes go through approval-gated `file-ops.ts` (`shipcode-write`/`shipcode-edit` blocks, diff + y/n). `shell.ts` runs `claude`-style subcommands, not arbitrary AI shell-outs.

### ShipClick (`ShipClick/`)
- **Purpose:** Free, voice-driven macOS computer-use agent. Records mic → local whisper STT → drives Claude Code (`claude -p`) as the "brain" → the agent screenshots (`shot`) and controls mouse/keyboard via `cliclick` → speaks the result via `say`.
- **Files:** `shipclick` (bash launcher), `bin/shot` (screencapture+downscale helper), `agent-prompt.md` (computer-use system prompt).
- **Critical config:** Runs `claude -p "$TASK" --permission-mode bypassPermissions --add-dir "$DIR/bin" --max-turns 60`. **`bypassPermissions`** grants the agent unrestricted tool/file/command access while it physically controls the Mac (clicks, types, opens apps/URLs). The prompt asks it to avoid destructive/irreversible actions, but that is a soft, model-honored guardrail only.

### ship-memory (`ship-memory/` + packages)
- **Purpose:** Standalone, portable markdown-vault memory engine. A "hub" is a `.shipmemory/` directory of `.md` notes with `[[wikilinks]]`. Clean-room reimplementation of bridgememory's 12-tool surface.
- **Packages:** `@ship-memory/core` (headless engine; vault.ts is the only FS-touching module — read/write/delete `.md` files), `@ship-memory/mcp` (stdio MCP server, the 12-tool surface), `@ship-memory/connector-obsidian` (idempotent Obsidian vault import via `readdirSync`/`readFileSync`).
- **Data processed:** **Personal second-brain notes — potentially highly sensitive** (the repo root literally contains `ShipMind_Private_Intelligence.pdf` / `ShipMind_Private_Second_Brain.pdf`). Hub resolved from tool `cwd` arg > `$SHIP_MEMORY_HUB` > `process.cwd()`, walking up for `.shipmemory/`. Shared hub `~/ShipMemory` per project memory.
- **Auth:** None — relies entirely on the MCP transport (stdio) and OS file permissions. `SHIP_MEMORY_READONLY=1` removes write tools at the server (defense-in-depth, correctly noted as not relying on client `--allowedTools`).

### shipyard-os (`shipyard-os/`)
- **Empty except a stale `.next/` build artifact** (dev logs/types only). No source present in scope. No findings.

### Root loose scripts & assets
- **`summarize_readme.sh`:** zsh script; pipes a README into the `chatgpt` CLI (`cat "$README_FILE" | chatgpt -q ... "$PROMPT"`). Requires `OPENAI_API_KEY` (hard error if unset; suggests Keychain load). `set -euo pipefail`. README path is validated to be an existing file. No secrets embedded.
- **flappy-bird game** (`flappy-bird.html`, `index.html`, `obstacles.js`, `score.js`, `sounds.js`, `ui.js`, `styles.css`): self-contained offline browser game. **No network calls, no secrets, no external endpoints.** Benign.
- **`src/`:** marketing product-page React/TSX (`src/product-page/*`) + agent handoff/protocol markdown docs (`src/agents/*`). No runtime/secret concerns.
- **`tsconfig.json` (root):** 63-byte stub. Benign.

---

## PHASE 2 — DATA FLOW

| Flow | Origin → Destination | Retention | Security controls | Responsible party |
|---|---|---|---|---|
| ShipWatch capture | Screen/mic/clipboard/URLs/app activity → local SQLite + files on disk | `fileRetentionDays` cleanup (screenshots/audio only; **DB rows not pruned by cleanup**) | Local-only by default; idle/lock pause; blocked-apps list; clipboard password-manager heuristic skip; 2000-char clipboard truncation | End user (local) |
| ShipWatch vision/summary | Screenshot base64 + app name → Ollama (localhost) | n/a (local) | Stays on device when using default Ollama | End user |
| ShipWatch chat (cloud providers) | Memory text + question → Anthropic/OpenAI/Gemini **or** ShipWatch Cloud proxy | Per provider policy | TLS; Tauri http allowlist; user-supplied key OR license | User + AI vendor + (for proxy) ShipWatch operator |
| ShipWatch Cloud proxy | License + system+messages → proxy → Anthropic | In-memory rate/cache only | Bearer license, Gumroad verify, model allowlist | ShipWatch operator (holds Anthropic key) |
| ShipWatch auto-export | Memories → user's Obsidian vault path | Persistent files | Local FS | End user |
| ShipCode login | Browser → loopback `127.0.0.1:1928x` POST `/callback` → `~/.shipcode/auth.json` | Until logout/expiry | Loopback bind, per-login random `state`, Origin/Referer check, payload validation, 120s timeout | User + makeshiphappen.tech |
| ShipCode chat | Prompt + project context → selected provider; file ops → local disk (approval-gated) | Provider policy / local | chmod-600 token & key files; Keychain option; tier verified server-side | User + AI vendor |
| ShipCode telemetry | event + user_id/email → Supabase `usage_events`; errors → Sentry | Vendor-side | Anon key + signed Bearer; 5s timeout; no anonymous tracking; PII limited to email | Operator |
| ShipClick | Voice → local whisper → Claude Code (bypassPermissions) drives Mac → `say` | tmp `rec.wav`/screenshots in `$TMPDIR/shipclick` | None beyond Claude subscription; **no sandbox** | User (assumes full risk) |
| ship-memory | `.md` notes ↔ disk via core/vault.ts; exposed over MCP stdio | Persistent files | OS file perms + optional READONLY server mode; no auth/encryption | User + any MCP client wired in |

---

## PHASE 7 — SECURITY (risk ratings)

### CRITICAL
- **None** that ship to end users by default. (The proxy bind issue below is High because it depends on the vendor's deployment, not shipped code.)

### HIGH
1. **ShipWatch Cloud proxy binds all interfaces with browser-only CORS as the sole HTTP gate.** `ShipWatch/server/src/index.ts` does `export default { port, fetch }` with no host argument → default 0.0.0.0 bind. The only request-origin restriction is `cors({origin:[tauri://...]})`, which non-browser clients ignore entirely. Real protection is the Bearer-license check on `/v1/chat`, so an unauthenticated attacker can't burn Anthropic credits — **but** `/v1/health` is open, the service is internet-reachable if deployed without an upstream gateway, and rate-limiting is per-license/in-memory (resets on restart, not shared across instances). *Justification: a misconfigured deploy exposes a credit-spending Anthropic relay; auth is the only thing standing between the internet and the vendor's API bill. Bind to `127.0.0.1` behind a reverse proxy, or make the listen host explicit.*
2. **ShipClick runs Claude Code with `--permission-mode bypassPermissions` while granting physical mouse/keyboard control of the Mac.** `ShipClick/shipclick`. The agent can open any app/URL, type, click, and (with bypassed permissions) run arbitrary tools/commands and read/write files, driven by transcribed voice that may be misheard. The only guardrail is a prose instruction in `agent-prompt.md`. *Justification: full unsandboxed local-control agent; a misrecognized command or prompt-injected on-screen content (the agent reads screenshots) can take irreversible/destructive actions. This is the single highest-impact local risk in the cluster, accepted-by-design but should be documented prominently and ideally gated.*

### MEDIUM
3. **ShipWatch stores API keys + license in browser `localStorage`, not Keychain.** `src/lib/ai.ts`. Any code running in the webview (XSS, malicious dependency, or a future loosened CSP) can exfiltrate the user's Anthropic/OpenAI/Gemini keys. CSP is currently reasonably tight (`script-src 'self'`). *Justification: weaker than ShipCode's chmod-600+Keychain approach; plaintext keys at rest in the webview profile.*
4. **ShipCode free-tier limit is client-side only** (`~/.shipcode/usage.json`). Trivially bypassed by deleting/editing the file; gives unlimited "free" cloud AI to anyone who brings their own key/uses the embedded flow. Tier itself is server-verified, so paid features aren't bypassed — only the free message counter. *Justification: revenue/abuse-control gap, not a data-security one.*
5. **ship-memory exposes full read/write/delete of personal second-brain notes over MCP with no authentication or encryption.** Any MCP client wired into a host (and any orchestrator/agent that host runs) can read or delete sensitive notes; `delete_memory` is permanent. READONLY mode mitigates write/delete but is opt-in. Vault files are plaintext on disk. *Justification: high-sensitivity data (private intelligence/second-brain), no auth layer, destructive tool — combined with autonomous agents this is a meaningful exposure; severity capped at Medium because access still requires being a configured MCP client on the user's own machine.*
6. **ShipWatch shell-command construction with AppleScript/format strings in the Rust backend.** `lib.rs` builds `osascript`/`do shell script` strings; commands use fixed args or app-name-derived scripts (app names come from the OS, low injection surface), and `read_file`/`write_file`/`read_file_base64` Tauri commands accept **arbitrary absolute paths from the frontend** with no path scoping. *Justification: broad local FS reach exposed to the webview; combined with #3 (localStorage) increases blast radius if the renderer is compromised.*

### LOW
7. **ShipWatch clipboard capture stores potentially sensitive content** (tokens, secrets pasted by the user). Mitigated by a password-manager-source heuristic and length checks, but non-password secrets (API keys pasted from a browser, 2FA codes) are still captured to SQLite. *Justification: privacy exposure of the user's own data on their own machine.*
8. **Embedded Supabase anon key + Sentry DSN in ShipCode** — both are public-by-design and correctly commented as such; anon key relies on Supabase RLS for safety. Low/informational.
9. **`summarize_readme.sh` pipes file contents into the `chatgpt` CLI.** No injection (content is stdin, not interpolated into a shell command), hard-fails without `OPENAI_API_KEY`, `set -euo pipefail`. Sends README content to OpenAI — expected. Low.
10. **ShipWatch `transcribe_audio` / OCR JIT-compile a bundled `.swift` file to `$TMPDIR/shipwatch_ocr`** via `swiftc` when the bundled binary is absent. Temp-dir binary planting is a minor TOCTOU/local-tamper surface. Low.

---

## PHASE 8 — OPEN SOURCE / LICENSES

| Package | License | Notable deps | Flags |
|---|---|---|---|
| `shipcode-cli` 0.6.1 | **MIT** (published) | `@sentry/node`, `chalk`, `commander`, `glob`, `ora`; dev `tsup/tsx/typescript/vitest` | All permissive. No copyleft. |
| `ship-watch` (private) | none declared | `@tauri-apps/*` plugins, `react` 19, `framer-motion`, `lucide-react`, `zustand` | Tauri = Apache-2.0/MIT; React MIT. Permissive. |
| `shipwatch-proxy` (private) | none | `@anthropic-ai/sdk`, `hono` (MIT) | Permissive. |
| `ship-memory` + `@ship-memory/{core,mcp,connector-obsidian}` (private) | none declared | core advertises **zero deps**; mcp uses `@modelcontextprotocol/sdk` (MIT) | Permissive. **No LICENSE file** on the private packages — fine while private, but add one before any publish. |

**No GPL/AGPL/LGPL/SSPL copyleft observed** in declared dependencies across this cluster. Action items: (a) ShipCode README/badge claims MIT — ensure a LICENSE file actually ships in the npm tarball; (b) ship-memory packages have no license field/file.

---

## PHASE 9 — MARKETING CLAIMS

- **Root `README.md`: "API key management – secure patterns for storing and loading OpenAI credentials."** *Assessment:* **Defensible.** The repo's actual pattern (README + `summarize_readme.sh`) loads `OPENAI_API_KEY` from the macOS Keychain via `security find-generic-password` rather than hardcoding — a genuinely sound pattern. Caveat: the root README describes a "developer toolkit" with "Git helpers," "Codex integration," and "Shell aliases" / `aliases.zsh` that are **not present in the repo** (`aliases.zsh` does not exist; only `summarize_readme.sh` ships). The "secure patterns" claim is fine; the surrounding feature list overstates what exists.
- **ShipCode README: "Real file editing… shows you a diff, and waits for your approval before touching disk. You stay in control of every keystroke."** *Assessment:* **Accurate** — `file-ops.ts` enforces diff + y/n/all/quit approval before any write/edit. The "all" option does auto-approve the remainder of a batch, which is user-initiated and reasonable.
- **ShipCode: "Limitless… never hits a wall… fallback chain."** Marketing puffery; backed by a real provider-chain fallback. Acceptable.
- **ShipCode: "Privacy-first, offline, unlimited" (Ollama).** Accurate for the local path. Cloud providers obviously send data off-device; README is clear about which is which.
- **ship-memory README: "No database, no lock-in… human-editable… you own the data."** Accurate — plain `.md` files, Obsidian-compatible.
- **ShipWatch** ships **no README** in scope; in-app onboarding not reviewed for claims. The implicit "personal memory" framing of a tool that records screen+mic+clipboard+meetings warrants an explicit, prominent privacy/consent disclosure (esp. **meeting auto-recording** of other participants' audio — a legal/consent exposure in two-party-consent jurisdictions).

---

## LIABILITY / RESPONSIBILITY RAW MATERIAL

- **ship-memory** persists sensitive personal/second-brain content as **plaintext, unencrypted, unauthenticated** files, fully readable/deletable by any wired MCP client and any agent that host runs. Destructive `delete_memory` is permanent. Recommend: encryption-at-rest option, default READONLY for autonomous orchestrators (already the documented intent), and a backup/undo for delete.
- **ShipWatch** is a continuous personal-surveillance recorder. Highest liability vectors: (1) **meeting system-audio capture records third parties** without their consent control; (2) clipboard capture of secrets; (3) all data + provider keys live unencrypted locally (localStorage keys, plaintext SQLite). Recommend consent UX, key migration to Keychain, optional DB encryption, and explicit retention for DB rows (not just media files).
- **ShipWatch Cloud proxy** makes the **vendor** the data controller for any prompt+memory text routed through it and the holder of the shared Anthropic key — deploy behind 127.0.0.1/reverse proxy, enforce durable rate limiting, and log/scope access.
- **ShipCode** as an npm distribution channel: telemetry (Supabase + Sentry) ties events to a signed-in user's email — disclose in a privacy policy; offer opt-out. Free-tier counter is client-side (abuse risk, not user-data risk). Owner-bypass email is hardcoded across apps — fine for the creator, but it's an account that silently skips the subscription gate.
- **ShipClick** is an unsandboxed full-control agent with `bypassPermissions`; the user assumes essentially all risk. Document the danger and consider removing `bypassPermissions` or scoping `--add-dir`/allowed tools.

---

*End of Audit 14.*
