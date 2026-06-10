# 14 — Utilities & Memory Cluster Audit (v2)

**Scope:** ShipWatch, ShipCode, ShipClick, ship-memory, plus shipyard-os, packages/account-menu, root utility scripts.
**Method:** READ-ONLY, source-derived. Did not consult `docs/audit/` or `docs/business-protection/`.
**Auditor stance:** Independent risk/compliance. All findings carry `file:line` evidence.

> **Top line:** This cluster contains the single highest-risk surface in the repo. **ShipWatch** is a continuous, all-modality desktop surveillance product (screen + mic + system audio + clipboard + browser URLs + OCR'd on-screen text + per-app activity), stored **unencrypted** in SQLite/PNG/WAV, with a credit-spending Anthropic relay whose only documented gate is browser-origin CORS. **ShipClick** drives the physical Mac with `claude -p --permission-mode bypassPermissions --max-turns 60`. **ship-memory** exposes read/write/**permanent-delete** of a plaintext "second brain" to any connected LLM over unauthenticated MCP stdio. ShipCode is comparatively benign (BYO-key, client-side meter) but has latent command-injection and a path-escape edit primitive.

---

## 1. INVENTORY

### 1.1 ShipWatch (`ShipWatch/`)
| Dimension | Finding | Evidence |
|---|---|---|
| Purpose | Continuous "second memory for work" — captures screen/mic/audio/activity, OCR + AI summarize, chat-with-memories. | `OnboardingPage.tsx:85-90` ("captures your screen and microphone") |
| Type | Tauri 2 desktop app (React/TS front, Rust back) + optional Node/Hono cloud proxy. | `src-tauri/tauri.conf.json:5` (`com.shipwatch.app`), `server/src/index.ts` |
| OS permissions | **Screen Recording** (`screencapture`), **Microphone** (avfoundation via ffmpeg), **Accessibility/Automation** (osascript System Events, browser AppleScript), system-audio (BlackHole). | `lib.rs:89` screencapture, `lib.rs:190-202` ffmpeg mic, `lib.rs:525-531`/`576-612` osascript, `lib.rs:908-922` BlackHole |
| AI providers | Ollama (local, default), Gemini, Anthropic, OpenAI (all BYO-key, direct from webview), **ShipWatch Cloud** relay (license-gated Anthropic proxy). | `src/lib/ai.ts:7`, `:73-79`, `:569-611` |
| External services | api.anthropic.com, api.openai.com, generativelanguage.googleapis.com, `https://api.shipwatch.app` (default proxy), api.gumroad.com (license). | `ai.ts:74`, `server/auth.ts:33` |
| Storage | SQLite `sqlite:shipwatch.db`; screenshots `app_data_dir/screenshots/*.png`; audio `audio/*.wav` + `system_audio/sys_*.wav`. **No encryption.** | `db.ts:9`, `lib.rs:83-87,182-187,889-895` |
| Local secrets | API keys + license key in **localStorage** (plaintext, webview-accessible). | `ai.ts:16-21,23-79` |
| Autostart / background | LaunchAgent autostart; window hides instead of quitting; tray-resident. | `lib.rs:1033-1036`, `:977-1002`, `:1095-1100` |

### 1.2 ShipCode (`ShipCode/`)
| Dimension | Finding | Evidence |
|---|---|---|
| Purpose | Plain-language coding CLI; model-agnostic; real file edits with diff/approval. | `README.md:1-20` |
| Type | Node CLI (`shipcode-cli`, MIT). | `package.json` license MIT; `README.md:5` |
| AI providers | Ollama, Anthropic, OpenAI/Codex, Groq, Gemini, Perplexity, OpenRouter — **all BYO key**. | `config/secrets.ts:7-16`, `ai/providers.ts:138,289,625-668` |
| Auth | OAuth-style loopback login → makeshiphappen.tech; tokens in `~/.shipcode` session. | `auth/login.ts:48-147` |
| Telemetry | Supabase `usage_events` + Sentry (errors). | `telemetry/analytics.ts:10-42`, `telemetry/sentry.ts:18-19` |
| Storage | `~/.shipcode/usage.json` (free meter), `keys.json` (chmod 600) + macOS Keychain, session file. | `auth/usage.ts:12`, `config/secrets.ts:18-103` |
| Tools given to AI | `readFile`, `searchFiles`, `grepContent`, `runCommand`, `getProjectTree`, file write/edit. | `ai/tools.ts`, `ai/file-ops.ts` |

### 1.3 ShipClick (`ShipClick/`)
| Dimension | Finding | Evidence |
|---|---|---|
| Purpose | Free voice-driven **computer-use** agent — drives the real Mac via screenshot→Read→cliclick loop. | `shipclick:1-2`, `agent-prompt.md:1-3` |
| Type | Bash script wrapping the user's local Claude Code subscription. | `shipclick:62-68` |
| Brain | `claude -p "$TASK" --model sonnet --permission-mode bypassPermissions --add-dir bin --max-turns 60`. | `shipclick:63-68` |
| OS permissions | Mic (ffmpeg), screen recording (`screencapture`), Accessibility (cliclick mouse/keyboard injection), Automation (osascript). | `shipclick:43-47`, `bin/shot`, `agent-prompt.md:15-28` |
| STT/TTS | local whisper-cli; macOS `say`. | `shipclick:26,47` |

### 1.4 ship-memory (`ship-memory/`)
| Dimension | Finding | Evidence |
|---|---|---|
| Purpose | Standalone markdown "second-brain" engine; MCP adapter exposes 12-tool surface to LLMs. | `README.md:1-6`, `packages/mcp/src/index.ts:37-178` |
| Type | TS monorepo: `core` (engine), `mcp` (stdio server), `connector-obsidian`. | `README.md:31-39` |
| Storage | Plaintext `.md` files in a `.shipmemory/` hub; no DB, **no encryption**. | `README.md:43-57`, `core/src/vault.ts:57,89-92` |
| Auth | **None** — stdio MCP; hub from `cwd` arg / `$SHIP_MEMORY_HUB` / `process.cwd`. | `mcp/src/index.ts:23-27` |
| Cross-product | Shared hub `~/ShipMemory`; wired into ShipSpace + Claude clients. | README + project memory |

### 1.5 Others
- **shipyard-os/** — only `.next/` build artifacts present; **no source** → deprecated/empty. `find shipyard-os -type f` → only `.next/dev/*`.
- **packages/account-menu/** — UI component library (AccountMenu.tsx, icons, types); no secrets/network. `packages/account-menu/src/*`.
- **Root game scripts** — `obstacles.js`, `score.js`, `sounds.js`, `ui.js` are a Flappy-Bird-style browser game (paired with `flappy-bird.html`); out of risk scope. `summarize_readme.sh` — local README-summarizer utility.

---

## 2. DATA FLOWS

| Flow | Origin → Destination | Retention | Controls | Responsible |
|---|---|---|---|---|
| Screenshots | `screencapture -x` → `app_data_dir/screenshots/*.png` | `fileRetentionDays` default **7d** cleanup | Idle/lock pause (`capture.ts:194-204`); `blockedApps` (empty default) | User (after install) |
| On-screen text (OCR) | PNG → Vision/swiftc OCR → `ocr_text` table (searchable) | with memory row | none beyond DB | User |
| Screenshot vision desc | base64 PNG → **Ollama local** (`/api/chat`) | DB content field | local-only | User |
| Mic audio | ffmpeg avfoundation → `audio/*.wav` → whisper-cli → transcript in DB | 7d file cleanup; transcript permanent | default mic **OFF** (`useMemoryStore.ts:72`) | User |
| System audio (meetings) | BlackHole → `system_audio/*.wav` → whisper → DB | 7d; transcript permanent | default OFF; auto-armed on meeting detect | User + **all meeting participants (no consent)** |
| Clipboard | `pbpaste` polled every **3s** → `clipboard_history` | permanent (no cleanup of DB rows) | password-manager heuristic skip only (`lib.rs:784-797`) | User + clipboard authors |
| Browser URLs | AppleScript per-browser → `activity_log.url` + memory | permanent | default activity tracking **ON** | User |
| App/window activity | osascript frontmost → `activity_log` | permanent | default ON (`useMemoryStore.ts:81`) | User |
| Chat-with-memories | formatted memories (URLs, transcripts, OCR text) → selected cloud LLM or proxy | provider-side | provider choice | User → Anthropic/OpenAI/Google |
| ShipWatch Cloud relay | webview → `api.shipwatch.app/v1/chat` → Anthropic (operator key) | operator-billed | license + rate-limit + CORS | **Operator (zzgems)** pays Anthropic |
| ShipCode telemetry | signed-in user_id + event + metadata → Supabase `usage_events` | server-side, indefinite | only sent when logged in; no notice surfaced | Operator |
| ship-memory | LLM tool call → plaintext `.md` read/write/delete | permanent (delete is hard delete) | **none** | Whatever LLM is connected |

---

## 3. SECURITY FINDINGS

### S-1 [Critical] ShipWatch Cloud proxy binds all-interfaces with browser-only CORS as the sole transport gate
`server/src/index.ts:95-98` exports `{ port, fetch: app.fetch }` with **no `hostname`**. Under Bun's `Bun.serve`/Hono default this binds **0.0.0.0 (all interfaces)**, not loopback. The only request gate before the credit-spending Anthropic call is:
- CORS origin allowlist `["tauri://localhost","https://tauri.localhost"]` (`index.ts:13`) — **CORS is browser-enforced only**; any non-browser client (curl, script, another host on the LAN) ignores it.
- License check `isValidLicense` (`auth.ts:13-23`) + in-memory rate limit (`auth.ts:84-102`).
Net: if `VALID_LICENSES` is set (or any valid Gumroad key leaks), and the proxy is network-reachable, an attacker spends the operator's Anthropic credits at 100 req/hr/key with no IP binding. **Severity Critical if the proxy is ever deployed on a public/shared interface; High if strictly localhost-fronted.** Recommend explicit `hostname: "127.0.0.1"` and a server-side auth/origin check independent of CORS.

### S-2 [High] Arbitrary-path file read/write exposed to the webview (ShipWatch Rust)
`read_file`/`write_file`/`read_file_base64`/`path_exists` (`lib.rs:116-160`) take an **arbitrary absolute path** from the webview with no allowlist/sandbox; `write_file` even `mkdir -p`s the parent (`lib.rs:118-121`). Combined with `withGlobalTauri: true` (`tauri.conf.json:13`) and broad `fs:default` (`capabilities/default.json:6`), any XSS/compromised-dependency in the webview reads/writes anywhere the app user can. **High.**

### S-3 [High] API keys & license key stored in plaintext localStorage (ShipWatch)
`ai.ts:16-79` persists `shipwatch-api-key`, `shipwatch-license-key`, proxy URL in `localStorage`. Recoverable by any webview script and present on disk in the WebKit store. Anthropic/OpenAI/Gemini keys are higher-value than the local notes. **High.**

### S-4 [High] Command-injection latent in ShipCode AI tools
`grepContent` (`ai/tools.ts:87-88`) and `runCommand` (`ai/tools.ts:188-208`) pass **un-sanitized strings straight to `execSync`** (shell=true). `runCommand` is by design arbitrary, but `grepContent` interpolates `pattern`/`filePattern` into a shell string — an AI- or repo-influenced pattern (e.g. containing `"; rm -rf ~ #`) executes. The AI chooses these args from model output. **High** (latent; AI is the injection vector).

### S-5 [Medium] ShipClick runs the desktop agent with bypassPermissions
`shipclick:63-68` launches `claude -p` with `--permission-mode bypassPermissions` and `--max-turns 60` while it can move the mouse, type, and run shell. The only brake on destructive action is a **prose instruction** in `agent-prompt.md:38-41`. A misheard voice task or on-screen prompt-injection (the agent Reads screenshots of attacker-controlled content) can trigger irreversible actions with no OS-level confirmation. **Medium-High** (sandbox is "the model behaving"). See L-2.

### S-6 [Medium] ShipCode file-edit primitive escapes cwd
`file-ops.ts:108,165,179-189` does `resolve(process.cwd(), op.path)`; if the AI emits an **absolute** path (`/Users/.../.ssh/...`) or `../` traversal, the write lands outside the project. Mitigated by an interactive y/n approval (`file-ops.ts:152-156`), but the displayed path is the model's claim and approval is per-op fatigue-prone. **Medium.**

### S-7 [Medium] ship-memory MCP: unauthenticated write + permanent delete to any client
`mcp/src/index.ts:229-276` — `create/append/update/delete_memory` run with **no auth**; `delete_memory` is a hard `mem.delete` (`:265`). Any LLM the user connects (or a prompt-injected one) can overwrite or permanently erase the second-brain. Read-only mode exists but is **opt-in** via `SHIP_MEMORY_READONLY` (`:186-197`) and not the default. The `cwd` arg also lets a tool call retarget the hub to any directory on disk (`:23-27`). **Medium** (local trust model, but blast radius = entire personal knowledge base + cross-product `~/ShipMemory` hub).

### S-8 [Low] Embedded Supabase anon key + Sentry DSN
`analytics.ts:12-13`, `sentry.ts:18-19` — both are public-by-design tokens, correctly commented. Residual risk = anon key write-scope to `usage_events` depends on RLS (out of scope here). **Low.**

### S-9 [Low] Privileged osascript / python3 / swiftc subprocess surface (ShipWatch)
`lib.rs` shells out heavily (osascript, ioreg, pbpaste, python3 for lock state `:460-463`, runtime `swiftc` compile to temp `:836-844`). Inputs are mostly app names from the OS, but the runtime-compile-from-temp pattern (`:828-853`) is a weak link if temp is writable by another user. **Low.**

---

## 4. PRIVACY FINDINGS

| ID | Issue | Rating | Evidence |
|---|---|---|---|
| P-1 | **Continuous multi-modal surveillance.** Screen every 30s + clipboard every 3s + activity every 5s are **ON by default**; OCR + window-context + URL capture ON. Mic/system-audio off by default but auto-armed in meetings. | **Critical** | `useMemoryStore.ts:68-88`; `capture.ts:84-147`, `:487-534` |
| P-2 | **Bystander / third-party PII with no consent.** System-audio meeting recording captures **all participants' voices** (Zoom/Teams/FaceTime/Slack) with no in-app consent flow; on-screen capture grabs anyone's data visible on screen. | **Critical** (wiretap exposure) | `capture.ts:487-534`, `lib.rs:478-518` |
| P-3 | **Sensitive on-screen data captured indiscriminately** — banking, health, credentials visible on screen are screenshotted + OCR'd into a searchable table. Clipboard capture has only a narrow password-manager heuristic (`lib.rs:784-797`); copies from a browser/notes app are stored verbatim. | **High** | `db.ts:103-114` (ocr_text), `lib.rs:736-814` |
| P-4 | **No consent / disclosure UX.** Onboarding is a permissions checklist only — no recording disclosure, no jurisdiction/consent notice, no bystander warning. | **High** | `OnboardingPage.tsx:74-217` |
| P-5 | **Plaintext at rest, broad retention.** All captures unencrypted; DB rows (clipboard, activity, transcripts, OCR) are **never** age-cleaned (only PNG/WAV files at 7d). | **High** | `db.ts` (no row TTL); `lib.rs:304-339` files only |
| P-6 | **Captured memories shipped to third-party LLMs** when provider ≠ Ollama — URLs, transcripts, OCR'd screen text sent to Anthropic/OpenAI/Google or the operator proxy. | **High** | `ai.ts:768-794`, `:626-695` |
| P-7 | **ship-memory plaintext personal notes**, no encryption, hub-aggregated across products (`~/ShipMemory`). | **Medium** | `README.md:43-57`, project memory |
| P-8 | **ShipCode telemetry without surfaced notice** — user_id+event+metadata to Supabase once signed in; no privacy notice shown at login/in README. | **Medium** | `analytics.ts:20-42` |

---

## 5. LIABILITY / LEGAL

| ID | Exposure | Notes |
|---|---|---|
| L-1 | **Two-party-consent wiretap (mic + system audio).** Recording meeting audio of remote participants in CA/FL/PA/IL/WA etc. without consent is a potential criminal/civil wiretap violation. Auto-arm on meeting detection makes the *product* the trigger, not a deliberate user act. | `capture.ts:509-534` |
| L-2 | **Autonomous-action damage (ShipClick).** `bypassPermissions` computer-use agent acting on misheard voice or prompt-injected screen content → deleted files, sent messages, purchases. No OS confirmation; liability for resulting damage. | `shipclick:63-68`, `agent-prompt.md:38-41` |
| L-3 | **Surveillance of third parties / employees.** If deployed on shared/managed machines, continuous screen+clipboard capture implicates workplace-monitoring and GDPR/CCPA processing of others' PII. No data-subject controls, export, or erasure UX beyond manual delete. | §2, §4 |
| L-4 | **Command-injection & path-escape (ShipCode).** Damage from `runCommand`/`grepContent`/file-write-outside-cwd if exploited. | S-4, S-6 |
| L-5 | **Operator cost / abuse liability (ShipWatch Cloud).** All-interfaces relay spends operator Anthropic credits; weak transport gate. | S-1 |
| L-6 | **Data-breach magnitude.** A single device compromise exposes an unencrypted, searchable archive of everything the user saw/typed/copied/said — outsized breach-notification and reputational exposure. | §3, §4 |

---

## 6. USER-RESPONSIBILITY MATRIX

| Feature | Whose responsibility | Clear? |
|---|---|---|
| Granting screen/mic/accessibility perms | User (macOS prompts) | Clear |
| Recording meeting participants lawfully | **User** (app provides zero consent tooling) | **Unclear / not surfaced** — app auto-arms |
| Capturing sensitive on-screen data | User (must configure `blockedApps`, empty by default) | **Unclear** — opt-out, not opt-in |
| Sending memories to cloud LLM | User (picks provider) | Partially clear |
| ShipClick destructive actions | User accepts via bypassPermissions; no per-action gate | **Unclear** — only prose guardrail |
| ship-memory write/delete by an LLM | User (must set `SHIP_MEMORY_READONLY` for safety) | **Unclear** — unsafe default |
| ShipCode BYO key billing | User (own provider key) | Clear |
| ShipCode free-tier honesty | Self-policed client-side counter | N/A (see §7) |

---

## 7. MARKETING / REVENUE CLAIMS

- ShipWatch: *"all running locally on your Mac"* — `OnboardingPage.tsx:89`. **Partially inaccurate** as a blanket claim: true only with Ollama. Selecting Anthropic/OpenAI/Gemini or ShipWatch Cloud sends captured screen/audio data **off-device** (`ai.ts:626-695,569-611`). The "local" framing understates the off-device path.
- ShipCode: *"Limitless… never hits a wall"*, *"waits for your approval before touching disk"* — `README.md:16-20`. Approval gate is real (`file-ops.ts:152-156`) but note the path-escape caveat (S-6).
- **ShipCode free-tier meter is client-side and trivially bypassable.** The "5 free messages/month" gate reads/writes `~/.shipcode/usage.json` (`auth/usage.ts:12-84`); a user can delete the file (`resetUsage`, `:91-95`) or edit `count`. **However the free tier consumes the user's OWN provider key** (BYO, `secrets.ts`), so there is **no direct operator-cost leak** — the only "leak" is bypassing the **$29/mo Pro upsell**, and even Pro runs on the user's keys. Owner email `zzgemsjewelry@gmail.com` bypasses the gate entirely (`auth/owner.ts:4-10`). Tier itself is server-verified (`/api/auth/verify`, cached 5min, `shell.ts:59-68,652`), but the per-message *count* is not. **Low business risk** given BYO-key economics; flagged for accuracy.

---

## 8. LICENSES / DEPS / SECRETS

- **Licenses:** ShipCode MIT (`package.json`). ShipWatch (`ship-watch`), ship-memory packages, account-menu — **no `license` field** declared (private/unspecified).
- **Notable deps:** ShipWatch Rust uses tauri plugins shell/fs/sql/http/autostart/positioner (`lib.rs:1027-1036`); webview `withGlobalTauri:true` + broad `fs:default`/`sql:*` capabilities (`capabilities/default.json`). ShipCode: `@sentry/node`, `glob`, `chalk`, `ora`, Supabase via fetch.
- **Embedded tokens (intentional, public-by-design):** Supabase anon JWT `analytics.ts:13`; Sentry DSN `sentry.ts:19`. `.env.example` shows placeholder `sk-ant-...` and license format only (`server/.env.example`) — no real secret committed in scope.
- **No hardcoded private API keys found in scope.**

---

## Appendix — shipyard-os
Empty of source (only `shipyard-os/.next/dev/*` build artifacts). Treat as deprecated; recommend deletion or `.gitignore`.
