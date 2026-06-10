# Phase 1 — Ecosystem Inventory & Map

**Audit:** Ship Ecosystem (MakeShipHappenCollective) — Audit v3
**Document:** 01 — Ecosystem Inventory & Map
**Date:** 2026-06-07
**Classification:** READ-ONLY audit. No code was modified, no packages installed, no builds or deploys run.
**Auditor role:** Senior auditor + SaaS / privacy / technology attorney + compliance officer.

---

## 1. Executive Summary

The Ship Ecosystem is a four-product suite owned and operated under the "MakeShipHappen" / "ZZ GEMZ" identity. It comprises three native macOS-first **Tauri 2** desktop applications (ShipTalk, ShipMind, ShipSpace) plus one **Next.js 16** marketing/commerce **website** (makeshiphappen.tech) that serves as the shared identity, billing, entitlement, and software-distribution backplane for all three apps.

The ecosystem follows a consistent "bring-your-own-key, local-first, cloud-optional" architecture pattern: each desktop app stores user-supplied AI provider API keys in the macOS Keychain, persists primary user data locally (SQLite / WebKit localStorage), and uses Supabase only for authentication and a coarse subscription-tier flag. Every desktop app additionally ships a **companion stdio MCP server** that exposes its local data store to external AI agents, and every app shares a near-identical **client-side owner-email bypass** pattern that grants the `team` tier to two hardcoded email addresses.

Risk surface escalates sharply across the three desktop apps: **ShipTalk** (voice → text → paste) is the narrowest; **ShipMind** (a personal "second brain" knowledge base with ~95 Tauri IPC commands and broad `$HOME` filesystem write access) is mid-tier; and **ShipSpace** (an agent-orchestration IDE that grants autonomous agents *raw PTY shell access by design*) is the highest-severity component in the entire ecosystem. The website concentrates all financial and identity risk (Stripe billing, Supabase service-role key, gated downloads, server-proxied AI chat).

Cross-cutting governance themes recurring in every product: (a) hardcoded owner-email tier bypass; (b) companion MCP servers with **no authentication** that expose entire local data stores to any local process; (c) client-side subscription/tier trust requiring server-side RLS as the only real enforcement; (d) AI-provider sprawl with data egress to up to eight cloud providers using client-held keys; and (e) weakened macOS hardened-runtime entitlements on the apps that bundle native sidecars.

---

## 2. Ecosystem Visual Hierarchy

```
MakeShipHappen Ship Ecosystem
│
├── makeshiphappen.tech  ── Next.js 16 website (Vercel)  [IDENTITY + COMMERCE BACKPLANE]
│     ├── Auth (Supabase email/pw + OAuth + CLI/app login token relay)
│     ├── Billing (Stripe: Pro $50 / Team-"Ultra" $500 + Printful merch)
│     ├── Gated downloads + auto-update feeds (private 'releases' bucket, signed URLs)
│     ├── Server-proxied AI chat (Anthropic/OpenAI/Google/DeepSeek, rate-limited)
│     ├── Teams / seat management
│     ├── comp-access admin CLI (service-role, no expiry)
│     ├── Supabase migrations 001–012 (RLS hardening)
│     └── Co-located ShipSpace Electron app root (electron/ + e2b + node-pty)  [BLAST-RADIUS]
│
├── ShipTalk  ── Tauri 2 voice dictation/transcription  v0.1.1  com.makeshiphappen.shiptalk
│     ├── Main dashboard window (12 views)
│     ├── Floating overlay window (#overlay) — record / polish / paste
│     ├── 4 STT engines: WebSpeech | local whisper.cpp | Groq | OpenAI Whisper
│     ├── Polish engine (Anthropic claude-haiku-4-5)
│     ├── File transcription (chunked Groq/OpenAI)
│     ├── Rust: type_text paste, frontmost-app capture, cursor-follow loop
│     └── shiptalk-mcp  ── stdio MCP (reads localStorage SQLite, NO auth)
│
├── ShipMind  ── Tauri 2 local-first "second brain"  v2.0.3  com.makeshiphappen.shipmind
│     ├── ~95 Tauri IPC command handlers (lib.rs ~5700 lines)
│     ├── Local SQLite corpus (groups/transcripts/sources/notes/bookmarks/tags)
│     ├── Local Whisper transcription + bundled Ollama (RAG embeddings)
│     ├── AI agent chat over corpus (8 cloud providers + Ollama)
│     ├── Ingest: voice / audio / video / YouTube (yt-dlp) / web / files / images
│     ├── In-app browser + YouTube webviews; Brave HTML-scrape web search
│     ├── Bundled sidecars: ffmpeg, yt-dlp, deno, ollama
│     ├── shipmind-mcp  ── stdio MCP (reads shipmind.db read-only, NO auth)
│     └── shipmind-extension  ── Chrome MV3 (right-click ingest)
│
└── ShipSpace  ── Tauri 2 agent-orchestration IDE  v0.1.3  com.shipspace.ade   [HIGHEST RISK]
      ├── Multi-pane terminals (xterm + portable-pty REAL shells)
      ├── In-process axum MCP orchestrator (127.0.0.1:<random>, NO auth)
      ├── Autonomous agents in git worktrees (claude/codex/CLI)
      ├── ShipGang multi-agent build pipeline + auto-responder
      ├── 9 chat providers + local CLI agents (Hermes/OpenClaw→Ollama)
      ├── GitHub via gh CLI; Source Control git ops; embedded browser controller
      ├── run_shell_cmd allowlist + Ship Memory note→terminal binding
      └── shipspace-mcp  ── stdio MCP (reads localStorage SQLite, get_state_raw, NO auth)

SHARED INFRASTRUCTURE (cross-cutting)
  • Supabase (auth + profiles/subscription_tier + private 'releases' storage bucket)
  • macOS Keychain (per-app service; provider API keys)
  • Hardcoded owner-email bypass (zzgemsjewelry@gmail.com [+ aryah.yeasley@icloud.com])
  • Tauri/electron auto-updater feeds hosted on makeshiphappen.tech
  • Companion MCP servers (one per desktop app) — unauthenticated local data exposure
```

---

## 3. Cross-Cutting Inventory (Shared Subsystems)

These elements recur across multiple products and are documented once here to avoid repetition; product sections reference them.

| Shared element | What it is | Where | Risk |
|---|---|---|---|
| **Owner-email bypass** | Hardcoded email allowlist forcing `team` tier client-side | `ShipTalk/src/lib/owner.ts`, `shipmind/src/lib/owner.ts`, `makeshiphappenAi/lib/auth/owner.ts` | High — see §8 |
| **Supabase** | Auth (email/pw + OAuth), `profiles.subscription_tier`, private `releases` bucket | all products | Medium — enforcement depends entirely on RLS |
| **macOS Keychain** | Provider API key storage via `keyring` crate, per-app service id | each desktop app `secrets.rs` | Low–Medium |
| **Companion MCP servers** | stdio MCP exposing each app's local store to external agents, **no auth** | `shiptalk-mcp/`, `shipmind-mcp/`, `shipspace-mcp/` | High — see §9 |
| **Auto-updater** | Tauri/electron-updater pulling signed releases from `makeshiphappen.tech` | each desktop app + website `/api/updates/*` | Medium — supply chain |
| **AI provider egress** | User data sent to cloud LLMs with client-held keys | ShipTalk(3), ShipMind(8), ShipSpace(9), website-proxy(4) | High — privacy/governance |

**Verified discrepancy (evidence vs. code):** The provided evidence states ShipSpace keychain service is `com.makeshiphappen.shipspace[.beta/.dev]`, but the shipped Tauri identifier is **`com.shipspace.ade`** (`ShipSpace/src-tauri/tauri.conf.json`). This naming inconsistency (ShipSpace breaks the `com.makeshiphappen.*` convention used by ShipTalk and ShipMind) is a documentation/governance gap worth reconciling.

---

## 4. Product: ShipTalk

| Attribute | Detail |
|---|---|
| **Type / Stack** | Tauri 2 desktop (React 19 + TS + Zustand / Rust), macOS-first |
| **Version / Identifier** | v0.1.1 / `com.makeshiphappen.shiptalk` |
| **Purpose** | Microphone capture → STT (4 engines) → optional Claude "polish" → auto-paste into the previously focused app; also transcribes uploaded audio/video files |
| **Runs without login?** | Yes — fully usable as `local-user`; auth only enables cloud sync + tier |

### 4.1 Components / Subsystems
- **Main dashboard window** (`src/App.tsx` `MainApp`) — 12 views: Overview, History, Dictionary, Shortcuts, Subscription, Settings, Permissions, AudioInput, Enhancement, Transcribe, Polish, Auth.
- **Floating overlay window** (`src/components/FloatingOverlay.tsx`) — separate transparent always-on-top Tauri webview at `/#overlay`; performs record / polish / paste; cursor-follow.
- **`useVoiceCommands` hook** (`src/hooks/useVoiceCommands.ts`) — 4 STT engines + backup recorder + Whisper recovery.
- **`useGlobalShortcuts` hook** — OS push-to-talk / toggle hotkeys.
- **Polish engine** (`src/lib/polish.ts`) — Anthropic `claude-haiku-4-5` cleanup + dictionary substitution.
- **File transcription** (`src/lib/fileTranscribe.ts`) — chunked Groq/OpenAI Whisper.
- **Audio processor / capture** (`src/lib/audioProcessor.ts`, `audioCapture.ts`) — 16 kHz mono WAV; device enumeration + virtual/Bluetooth guarding.
- **API key store** (`src/lib/apiKeys.ts`) — in-memory cache fronting Keychain.
- **Cloud features gate** (`src/lib/cloudFeatures.ts`) — localStorage flag, **default OFF**.
- **Auth store** (`src/lib/auth.ts`) + owner logic (`src/lib/owner.ts`).
- **Rust backend** (`src-tauri/src/lib.rs`) — `type_text` paste, frontmost-app save/restore, accessibility check, native cursor-follow background thread (CoreGraphics), local whisper model download + transcription. Secrets module (`src-tauri/src/secrets.rs`).
- **shiptalk-mcp** (`shiptalk-mcp/src/index.ts`) — stdio MCP reading WebKit localStorage SQLite.
- **Dev/release scripts** (`scripts/dev-detached.mjs`, `dev-signed.mjs`, `upload-release.mjs`).

### 4.2 User-Facing Functionality
Floating dictation pill (push-to-talk, polish toggle, cursor-follow); dashboard with full transcript History (browse/copy), file Transcribe upload, Dictionary, Shortcuts, Subscription, Settings, Permissions, Audio Input, Enhancement, Polish; onboarding flow; auto-paste into other apps; account sign-in/out; auto-update dialog.

### 4.3 Internal Functionality
Rust IPC commands (`type_text`, `save/clear_frontmost_app`, `check_accessibility`, secrets, local_whisper); native cursor-follow thread; cross-window Tauri event bus (`voice-state`, `transcription-complete`, polish/type/voice-error, `apikeys-changed`, `cloud-features-changed`); API-key in-memory cache + keychain hydration; backup recorder + Whisper recovery; shiptalk-mcp; detached dev launcher with ad-hoc codesigning; `upload-release.mjs` (service-role release publishing).

### 4.4 AI Providers
| Provider | Model / Endpoint | Use | Locality |
|---|---|---|---|
| Anthropic | `claude-haiku-4-5` / api.anthropic.com | Transcript polish | Cloud (client key) |
| Groq | `whisper-large-v3-turbo` / api.groq.com | Cloud STT (live + file) | Cloud (client key) |
| OpenAI | `whisper-1` / api.openai.com | STT fallback + backup recovery | Cloud (client key) |
| whisper.cpp | `ggml-base.en` / `ggml-small.en` via whisper-rs | On-device STT (Metal) | Local |
| Web Speech | `webkitSpeechRecognition` | STT (labeled "instant") | **May transmit to Apple servers** |

### 4.5 Third-Party / External Services
Supabase (auth, `transcriptions`/`dictionary_terms`/`profiles` tables, `releases` bucket), Anthropic, Groq, OpenAI, Hugging Face (`huggingface.co` — whisper model downloads via curl), makeshiphappen.tech (updates + help/billing links), makeshiphappen.com (billing/signup), Tauri updater (minisign). External hosts: `api.anthropic.com`, `api.groq.com`, `api.openai.com`, `*.supabase.co`, `huggingface.co`, `makeshiphappen.tech`, `makeshiphappen.com`.

### 4.6 Authentication & Permissions
- **Auth:** Supabase email/password (`signInWithPassword`); session in WebKit localStorage (`shiptalk-auth`, autoRefresh). Owner bypass → `team` (`src/lib/owner.ts`, confirmed: `OWNER_EMAILS=['zzgemsjewelry@gmail.com']`). Provider keys in Keychain (service `com.makeshiphappen.shiptalk`), gated behind Cloud Features (default OFF).
- **macOS permissions:** Microphone, Speech Recognition, Accessibility (`AXIsProcessTrusted` for `type_text`), Apple Events automation (osascript), `audio-input` + `speech-recognition` entitlements, Camera usage string declared (**unused**), `NSAppSleepDisabled`.
- **Tauri capabilities:** http scoped to anthropic/groq/openai only; global-shortcut; window drag/ignore-cursor/visible-on-all-workspaces; custom commands (`type_text`, `save_frontmost_app`, secrets, local-whisper).

### 4.7 Storage Locations & Data
| Location | Contents | Sensitivity |
|---|---|---|
| macOS Keychain (`com.makeshiphappen.shiptalk`) | Anthropic/Groq/OpenAI keys | High (secrets) |
| WebKit localStorage SQLite (`shiptalk-history`) | **FULL transcript text in plaintext**, settings, polish prompts, `shiptalk-auth` session | **Critical** — never encrypted, never pruned, survives reinstall |
| App data dir `whisper-models/` | Downloaded ggml model binaries | Medium (supply chain) |
| Supabase Postgres | `transcriptions(id,user_id,text,word_count,duration_seconds,created_at)`, `dictionary_terms`, `profiles` | High (PII, transcripts) |
| `/tmp/shiptalk-follow.log` | Overlay/cursor diagnostics (no transcripts) | Low |
| Supabase `releases` bucket | Build artifacts | Medium |
| `.env` (gitignored) | Supabase URL + anon key | Medium |

**User data processed:** live microphone audio; uploaded audio/video; full transcripts (raw + polished); transcript metadata; custom dictionary terms; polish prompt presets; **frontmost-app identity of every other app** (paste targeting); audio device labels; user email + Supabase JWT; subscription tier; provider API keys.

### 4.8 Key Risks (ShipTalk)
| # | Severity | Finding |
|---|---|---|
| ST-1 | High | Transcripts stored **plaintext, unencrypted, unpruned** in `shiptalk-history`; survives reinstall; any local process/agent reads full dictation history without auth |
| ST-2 | High | shiptalk-mcp `get_state_raw`/`list_state_keys` read **any** localStorage key incl. the Supabase session token (`shiptalk-auth`) and all transcripts — no allowlist (confirmed `shiptalk-mcp/src/index.ts:226,231`) |
| ST-3 | High | Hardcoded owner backdoor grants `team` client-side; tier is set client-side → any user can locally spoof tier (gating is cosmetic) |
| ST-4 | Medium | "On-device" marketing contradicted by cloud STT/polish egress to Anthropic/Groq/OpenAI with client keys + `anthropic-dangerous-direct-browser-access:true` |
| ST-5 | Medium | `type_text` can paste into any app via Accessibility + AppleScript keystroke automation (broad apple-events entitlement); reads frontmost app of all apps (cross-app surveillance surface) |
| ST-6 | Medium | Web Speech engine may transmit audio to Apple servers despite "instant/browser" label |
| ST-7 | Medium | Whisper models downloaded from huggingface.co with **no checksum/signature** verification |
| ST-8 | Low | Unused Camera entitlement (over-broad TCC); world-readable `/tmp/shiptalk-follow.log` (usage/cursor leak, no transcripts) |
| ST-9 | Low | Stale `SECURITY_AUDIT_REPORT.md` (2026-02) gitignored; prior findings (null CSP, mock auth) appear remediated |

---

## 5. Product: ShipMind

| Attribute | Detail |
|---|---|
| **Type / Stack** | Tauri 2 desktop (React/TS + Zustand + Rust ~5700-line `lib.rs`), macOS-first |
| **Version / Identifier** | v2.0.3 / `com.makeshiphappen.shipmind` (per-channel `.beta`/`.dev`) |
| **Purpose** | Local-first markdown "second brain": ingest voice/audio/video/YouTube/web/files/images → transcribe locally → organize in local SQLite → chat with grounded AI agent over the corpus using user's own keys |
| **Companion artifacts** | shipmind-mcp (read-only DB MCP), shipmind-extension (Chrome MV3) |

### 5.1 Components / Subsystems
shipmind desktop app; **shipmind-mcp** (stdio MCP v0.1.0, 10 tools + transcript resources, read-only DB); **shipmind-extension** (Chrome MV3 v0.1.0, right-click ingest); Rust `lib.rs` (~95 `#[tauri::command]` handlers); `browser_view.rs` (embedded browser); `youtube_view.rs` (YouTube player); `secrets.rs` (keychain + provider allowlist); local Whisper subsystem; **bundled Ollama daemon + embedding model** (RAG); embedding/semantic search; AI agent chat layer (`src/lib/agents`: buildSystemPrompt, tools, 8 provider adapters); Deep Research (`src/lib/deepResearch.ts`, Groq); Vision (`src/lib/vision.ts`); web search (Brave HTML scrape via curl in Rust); source ingestion (text/file/image/website/gdrive/web_search); task manager; artifacts; sessions/messages chat persistence; Mission Control views; read-only IDE/workspace panel (git status/diff, file/dir read); voice loop + global hotkey (Cmd+Shift+Space); Tauri auto-updater; Supabase auth + tier gate.

### 5.2 User-Facing Functionality
AI chat over your second brain (grounded answers with citations); voice notes + push-to-talk hotkey; audio/video/YouTube ingest + local transcription; add sources (text/file/image/website/Google Drive); notes/bookmarks/tags/groups; semantic search; Deep Research mode; in-app browser panel + YouTube player; task manager / Mission Control dashboards; artifacts; settings (bring-your-own keys, model picker); Chrome extension right-click ingest.

### 5.3 AI Providers
Cloud (client key): **Anthropic, OpenAI, Google Gemini, Groq (chat/Deep Research/vision), DeepSeek, Perplexity, OpenRouter, Manus**. Local: **Ollama** (localhost:11434, bundled daemon), **Whisper** (on-device transcription).

> **Governance gap (verified):** ShipMind CSP `connect-src` (`shipmind/src-tauri/tauri.conf.json:26`) allows anthropic/openai/groq/google/openrouter/perplexity/supabase but **omits DeepSeek (`api.deepseek.com`) and Manus (`api.manus.ai`)** — calls to those two providers may be CSP-blocked, yet they are offered in the provider list. Provider sprawl + connectivity mismatch.

### 5.4 Third-Party / External Services
Supabase (auth + profiles); Tauri 2 plugins (dialog/fs/global-shortcut/process/updater; shell removed); `@anthropic-ai/sdk`; `@modelcontextprotocol/sdk`; better-sqlite3 (MCP) / rusqlite bundled (app); Brave Search (HTML scrape, no key); YouTube (yt-dlp + youtube-nocookie embed); **bundled native binaries: ffmpeg, yt-dlp (PyInstaller), deno (JS runtime), Ollama + libggml dylibs**; whisper-rs (vendored sys patch). External: Supabase (`gvhbhoicvvoezjjartrt.supabase.co`), makeshiphappen.tech (updater + embed), Brave, YouTube/youtube-nocookie, all configured AI APIs.

### 5.5 Authentication & Permissions
- **Auth:** Supabase email/password via **committed anon JWT in `shipmind/.env`** (confirmed file present, contains SUPABASE/ANON values — anon role only, but tracked on disk). Owner bypass (`src/lib/owner.ts`) → `team` for `zzgemsjewelry@gmail.com` + `aryah.yeasley@icloud.com` (confirmed). AI keys in Keychain (allowlist in `secrets.rs`). Chrome ext uses Bearer `ingestToken` (user-pasted) to `POST http://127.0.0.1:8765/ingest`. Updater minisign-verified. **shipmind-mcp: no auth** — any local process gets read-only access to the entire `shipmind.db`.
- **macOS permissions:** Microphone (`com.apple.security.device.audio-input`); fs read/write/copy across **`$HOME/**`**, `$APPDATA`, `$APPLOCALDATA`, `$TEMP`; global-shortcut; dialog; window/webview create; process + updater. **Hardened-runtime weakened:** `disable-library-validation`, `allow-jit`, `allow-unsigned-executable-memory`, `allow-dyld-environment-variables` (needed for yt-dlp/ollama).
- **Chrome ext:** contextMenus, storage, notifications, tabs; host `http://127.0.0.1:8765/*`.

### 5.6 Storage & Data
| Location | Contents |
|---|---|
| `~/Library/Application Support/com.makeshiphappen.shipmind/shipmind.db` | Full corpus: groups/transcripts/sources/segments/notes/bookmarks/tags/sessions/messages/artifacts |
| `<bundleId>/config.json` | App config |
| `<appdata>/source_images`, `<appdata>/tmp`, `ingest_debug.log` | Source images, ingest temp/debug |
| macOS Keychain (`com.makeshiphappen.shipmind`) | AI provider keys |
| Supabase (cloud) | Auth + `profiles.subscription_tier` |
| Chrome `chrome.storage.local` | Ingest token |
| App Resources | Bundled ffmpeg, yt-dlp, deno, ollama dylibs |

**User data:** email + password (Supabase); personal voice recordings & transcripts; personal notes/bookmarks/ingested web/files/images; AI provider keys (keychain); subscription tier / owner status; web search queries (sent to Brave); time-aligned transcript segments + speaker labels.

### 5.7 Key Risks (ShipMind)
| # | Severity | Finding |
|---|---|---|
| SM-1 | High | **Webview-XSS-to-IPC blast radius**: any injected/LLM-driven script can call all ~95 IPC handlers; CSP retains `'unsafe-inline'` AND `'unsafe-eval'` (confirmed `tauri.conf.json:26`) |
| SM-2 | High | fs write/copy scoped to `$HOME/**` → covers `~/.ssh`, `~/.aws/credentials`, `~/.zshrc`, `~/Library/LaunchAgents` (persistence/RCE-write primitive), amplified by hardened-runtime entitlements |
| SM-3 | High | shipmind-mcp exposes the **entire** second-brain DB read-only with **no auth** to any local process (includes a good untrusted-content wrapper for prompt-injection defense) |
| SM-4 | High | Data egress to up to 8 cloud providers with client keys; DeepSeek + Manus offered but absent from CSP connect-src (sprawl + governance gap) |
| SM-5 | Medium | Hardened-runtime: disable-library-validation + allow-jit + allow-unsigned-executable-memory + allow-dyld-environment-variables weaken code-signing guarantees |
| SM-6 | Medium | Client-side owner bypass (2 emails); Supabase **anon JWT committed** in `shipmind/.env`; gating relies on server RLS |
| SM-7 | Medium | `read_file_text`/`list_directory`/`read_file_base64` read arbitrary paths (mitigated by `is_sensitive_path` deny-list — deny-list is fragile vs. allowlist) |
| SM-8 | Medium | Bundled **deno (~212 MB universal)** full JS runtime sidecar — large supply-chain/attack surface; also ffmpeg/yt-dlp/ollama |
| SM-9 | Medium | `web_search` scrapes Brave HTML via curl (SSRF-adjacent egress; mitigated by `validate_public_http_url`) |
| SM-10 | Medium | Tool-calling loop unimplemented on 4/7 providers while `modelSupportsTools` returns true → "grounded in checked sources" silently fails on default models (trust/correctness) |
| SM-11 | Low | Chrome ext posts to `:8765/ingest` but no `:8765` listener found in source (real path = `shipmind://` deep-link) — endpoint may be dead/unimplemented (clarity gap) |
| SM-12 | Low | Agent tool args not zod-validated before dispatch (safe today: read-only tools; a write/exec tool would make this RCE) |
| SM-13 | Low | Two large marketing PDFs at repo root; `.git.bak` stale repo copy may retain history/secrets |

---

## 6. Product: ShipSpace  — HIGHEST RISK

| Attribute | Detail |
|---|---|
| **Type / Stack** | Tauri 2 desktop "Agent Development Environment" (Rust + React 19/Vite/Zustand) |
| **Version / Identifier** | v0.1.3 / **`com.shipspace.ade`** (breaks `com.makeshiphappen.*` convention; keychain service per evidence `com.makeshiphappen.shipspace*` — reconcile) |
| **Purpose** | Run multiple terminal panes, spawn/coordinate autonomous Claude/Codex/local-CLI agents across git worktrees via in-process MCP orchestrator, multi-provider chat, embedded browser, GitHub via gh CLI, Ship Memory→terminal binding, macOS dictation |
| **Defining property** | Agents and terminals get **real shell access on the user's machine** |

### 6.1 Components / Subsystems
- `src-tauri/src/lib.rs` — entrypoint, app menu, ~40 invoke handlers, **`run_shell_cmd` allowlist** (confirmed: `git node npm npx cargo rustc rustup python3 python pip pip3 ls cat mkdir cp mv find grep wc which env echo test basename dirname head tail vite tsc eslint prettier hermes openclaw` — `lib.rs:660`), `write_file`/`read_file`/`list_directory`/`save_dropped_file`/`open_path`, process list/kill.
- `pty.rs` — portable-pty terminals (`pty_create`, `pty_create_claude_role`, `pty_input`, `pty_resize`, `pty_destroy`), PID registry, stale cleanup.
- `orchestrator.rs` — **in-process axum MCP HTTP server on 127.0.0.1:<random>**, per-terminal task queue, `claude_pty_create` (spawns claude with `--mcp-config`/`--strict-mcp-config`/`--append-system-prompt`), worktree auto-merge foreman.
- `github.rs` — gh CLI wrapper; `git_ops.rs` — Source Control git wrapper; `worktree.rs` — per-agent worktree lifecycle.
- `browser_view.rs` — embedded WKWebView: navigate, controller click/type/scroll, asset extraction, page-context capture, inspector element-select → terminals, SSRF-guarded fetch.
- `secrets.rs` — keychain provider keys; `ship_memory.rs` — read-only markdown vault reader.
- **shipspace-mcp** — stdio MCP exposing persisted state (workspaces/gangs/runs/chats/prompts/settings/raw state) from WebKit localStorage SQLite.
- `src/lib/agents/providers/*` — streaming adapters: anthropic, openai, google, groq, deepseek, perplexity, xai, nano-banana, cli (Hermes/OpenClaw).
- `src/lib/shipgang/engine.ts` + `engine-pty.ts` + `sanitizer.ts` — autonomous multi-agent build pipeline (Coordinator/Builder/Scout/Reviewer), code extraction, gated npm install.
- `src/lib/orchestration/auto-responder.ts` — auto-answers terminal prompts (incl. risky permission prompts under 'all' mode); plus narrator, terminal-watcher, pane-question-bridge, workspace-dispatch.
- `src/lib/voice/*` (openai-realtime, openai-voice, useLiveDictation); `src/lib/agents/safety-policy.ts` (regex risk classifier + dispatch gate); ~34 Zustand stores; `auth.ts` + `supabase.ts` + `owner.ts`; dev/release scripts.

### 6.2 User-Facing Functionality
Multi-pane terminal workspace (real shells); agent chat across 9 providers; ShipGang autonomous build runs; orchestrator drop-zone (assign tasks to agent terminals in isolated worktrees); Source Control panel; GitHub panel (sign-in, repo list/clone, PR create/review, issues); embedded browser with element inspector → terminals; Ship Memory panel + terminal binding; Mission Control / Self views; Kanban; prompt library; voice dictation + TTS/STT; settings UI; auto-updater; process diagnostics.

### 6.3 AI Providers
Anthropic (api.anthropic.com + claude CLI in PTY), OpenAI (api.openai.com + wss realtime voice), Google Gemini, Groq, DeepSeek, Perplexity, xAI, nano-banana; local CLI agents Hermes + OpenClaw (OpenClaw → local Ollama with sentinel `OLLAMA_API_KEY=ollama-local`, confirmed `lib.rs`); Codex CLI via PTY.

### 6.4 Third-Party / External Services
Tauri 2 + plugins (shell/dialog/http/process/updater); Supabase; **GitHub CLI (gh) shelled out**; Homebrew (`gh_install`); portable-pty/axum/tokio/reqwest(rustls)/keyring/regex/uuid; xterm.js; `@modelcontextprotocol/sdk` + better-sqlite3 (shipspace-mcp); Ship Memory MCP server (node, mounted read-only into orchestrated agents). External: Supabase (auth + profiles), makeshiphappen.tech (`/api/updates/shipspace/latest`, `/auth/app-login`), GitHub (via gh), all AI HTTPS/WSS endpoints.

### 6.5 Authentication & Permissions
- **Auth:** Supabase email/password + session; browser-based app-login redirect to makeshiphappen.tech; owner-email bypass → `team` (`owner.ts`/`auth.ts`); GitHub OAuth delegated to gh CLI (`gh auth login --web` in PTY); provider keys in Keychain. **Orchestrator MCP HTTP: no token auth — only an Origin check that explicitly accepts requests with NO origin** (confirmed `orchestrator.rs:555` `origin_ok`: `None => true // CLI client — accept`).
- **macOS entitlements:** disable-library-validation, allow-jit, allow-unsigned-executable-memory, allow-dyld-environment-variables, audio-input, speech-recognition, accessibility.
- **Tauri capabilities:** core/process/updater default, shell:allow-open, dialog:default, http scoped to 5 AI hosts. **Filesystem: read anywhere (`read_file`/`list_directory` unrestricted); write confined to `$HOME` + tempdir.** Full shell/process execution via PTY + `run_shell_cmd`. Microphone + speech + keychain.

### 6.6 Storage & Data
| Location | Contents |
|---|---|
| Keychain (`com.makeshiphappen.shipspace[.beta/.dev]`) | One entry per provider (API keys) |
| WebView localStorage SQLite (zustand persist) | workspaces, gangs, runs, chats, prompts, settings, non-secret state |
| `~/Library/Logs/ShipSpace/` | crash.log, lifecycle.log, pty-pids.tsv |
| `$TMPDIR/shipspace-orchestrator-<terminal_id>.json` | Per-terminal MCP config |
| `$TMPDIR/shipspace-dropped/` | Dropped files |
| `<workspace>/.shipspace/worktrees/<terminal_id>/` | Per-agent git worktrees |
| Supabase (cloud) | Auth + profiles |
| gh CLI keyring | GitHub OAuth token (repo write scope) |
| `ShipSpace/.env` (gitignored) | VITE_SUPABASE_URL/ANON_KEY/WEBSITE_URL |

**User data:** provider keys (9 providers); Supabase email/pw session + profile (name, username, avatar, custom_instructions, ai_tone) + subscription_tier; microphone audio + transcripts; **arbitrary source code/local files in any workspace** (read/write/exec); GitHub identity/token; Ship Memory personal notes; embedded browser history/captures.

### 6.7 Key Risks (ShipSpace)
| # | Severity | Finding |
|---|---|---|
| SS-1 | **Critical** | **Arbitrary shell access by design** (`pty.rs`): mission agents get a raw PTY with no typed-intent layer; `pty_input` writes any bytes to any pane; orchestrated claude is spawned interactively in worktrees → agent can `rm -rf`, curl-exfil, etc., scoped only by OS user perms |
| SS-2 | **Critical** | `run_shell_cmd` allowlist gates **binary name only, not args** (`lib.rs:660`): `npm`/`npx`/`node`/`python` with LLM-influenced args (`node -e`, generated `package.json`) = effectively arbitrary code execution |
| SS-3 | High | Orchestrator MCP HTTP server has **no authentication** — Origin check accepts no-origin requests (`orchestrator.rs:555`); any local process can POST to `127.0.0.1:<port>/mcp/<terminal_id>` once the port is known |
| SS-4 | High | `claude_pty_create` accepts `bypass_permissions` → `--permission-mode acceptEdits`, auto-approving file edits for autonomous agents |
| SS-5 | High | `auto-responder.ts` classifies permission prompts as 'risky' but still auto-sends `1` (approve) when mode='all' — automatic approval of arbitrary tool/command permission prompts |
| SS-6 | High | `read_file`/`list_directory` have **no path confinement** — renderer/agent can read any file (SSH keys, ~/.aws); only `write_file` is sandboxed to HOME+temp |
| SS-7 | High | Ship Memory note bodies + gh issue bodies concatenated into agent `--append-system-prompt` (`orchestrator.rs`) — untrusted content becomes agent instructions (prompt injection); slug validated, body not |
| SS-8 | Medium | Embedded browser controller can click/type/scroll + extract assets; inspector pipes selected page content into terminals — web-page → agent prompt-injection vector |
| SS-9 | Medium | Hardened-runtime weakened (disable-library-validation, allow-unsigned-executable-memory, allow-dyld-environment-variables) on a signed app |
| SS-10 | Medium | Owner-email bypass forces `team` client-side; `auth.ts` preserves tier on lookup failure → client-trust gating |
| SS-11 | Medium | shipspace-mcp exposes full localStorage SQLite (chats/prompts/raw state) via `get_state_raw` to any MCP client that can launch it |
| SS-12 | Medium | `gh_create_pr` force-pushes via gh; PR body/title caller-supplied; inherits machine GitHub token with repo write scope |
| SS-13 | Low | CSP allows connect-src to localhost:*/127.0.0.1:* + blob/wasm-unsafe-eval script-src (broad local connectivity from webview) |

---

## 7. Product: makeshiphappen.tech (Website)

| Attribute | Detail |
|---|---|
| **Type / Stack** | Next.js 16 App Router (React 19), deployed to Vercel via `vercel --prod` from local working tree |
| **Package note** | `makeshiphappenAi/package.json` is named **`shipspace`** v0.1.0 and describes the co-located ShipSpace Electron app, **not** the website (confirmed) — packaging/governance mismatch |
| **Purpose** | Marketing + commerce + identity/entitlement backplane: signup/login, Stripe billing (Pro/Team) + Printful merch, gated downloads + auto-update feeds, server-proxied multi-provider AI chat, team seat management, comp-access admin |

### 7.1 Components / Subsystems
Marketing pages (page.tsx, products/*, pricing, company/*, community/*, security, privacy, terms, legal via `components/legal/PolicyPage.tsx`); **Auth** (signup/login, `/auth/callback` OAuth exchange, `/auth/app-login`, `/auth/cli-login`, `/api/auth/verify`); **Stripe billing** (`/api/stripe/checkout`, `/merch-checkout` Printful, `/status`, `/webhook`); **Gated installers** (`/api/install/{shipmind,shipspace,shiptalk}` + `/download`, signed private-bucket DMG URLs); **Auto-updater feeds** (`/api/updates/{app}/[channel]/latest`); **AI chat proxy** (`/api/chat/{anthropic,openai,google,deepseek}` gated by `lib/api/chat-gate.ts`); **Teams** (`/api/teams/{invite,remove,leave,members,me}`); **Printful merch**; subscription/entitlement logic (`lib/auth/subscription.ts`, `lib/auth/owner.ts`, `get_effective_tier` RPC); rate limiting (`lib/api/rate-limit.ts` DB-backed, `lib/api/ip-rate-limit.ts` in-memory); **comp-access CLI** (`scripts/comp-access.mjs`, service-role, no expiry); Supabase migrations 001–012; LibraryGate paywall UI; **co-located ShipSpace Electron app** (`electron/main.js`, e2b, node-pty, xterm); brand docs.

### 7.2 User-Facing / Internal Functionality
**User-facing:** marketing/product/pricing/company/community/docs/security/privacy/terms/legal; signup/login/CLI-login/app-login; pricing checkout (Pro $50 / Team-"Ultra" $500); shop/cart/merch checkout; members-only Libraries (agents/prompts/skills) behind LibraryGate; gated downloads + one-line curl installers; auth-gated AI chat; account page with install token + team management.
**Internal:** Stripe webhook handler; comp-access grant/revoke CLI (service-role); auto-updater manifest endpoints; `get_effective_tier`/`reserve_chat_request`/`reserve_ip_request` RPCs; usage logging; Supabase migrations; brand strategy docs.

### 7.3 AI Providers / Third-Party
**AI (server-proxied):** Anthropic, OpenAI, Google Gemini, DeepSeek, nano-banana (image). **Third-party:** Supabase (auth/Postgres/storage via `@supabase/ssr`+`supabase-js`), Stripe (account "ZZ GEMZ"), Printful (POD merch), Vercel (hosting/env/deploy), Netlify (`.netlify/state.json` present — stale/secondary), e2b (sandbox, ShipSpace side), electron-updater, Printful image CDN.

### 7.4 Authentication & Permissions
Supabase email/password (`signInWithPassword`); OAuth code exchange (`/auth/callback` `exchangeCodeForSession`); cookie-based SSR session (`lib/supabase/server.ts` + middleware `updateSession`); **Bearer access-token auth** for CLI/installers (`lib/supabase/admin.ts` `authenticateRequest`, `/api/auth/verify`); CLI login token relay to `localhost:<port>/callback` (confirmed `app/auth/cli-login/page.tsx:9,35` — port taken unvalidated from query string); **service-role key** for backend writes (webhook/teams/comp-access, bypasses RLS); hardcoded `OWNER_EMAILS` bypass **requiring `email_confirmed_at`** (confirmed `lib/auth/owner.ts` — stronger than the desktop apps); Postgres RLS (`auth.uid()=owner`) with billing columns write-revoked from anon/authenticated; same-origin check on checkout; per-IP + per-user rate limits.

### 7.5 Storage & Data
| Location | Contents |
|---|---|
| Supabase Postgres | profiles, subscriptions, subscribers, teams, team_members, usage_events, processed_stripe_events, curriculum/labs |
| Supabase Storage private `releases` bucket | App DMGs + manifests (5-min signed URLs only) |
| Supabase Auth (`auth.users`) | Credentials, email_confirmed_at |
| Stripe | Customers, subscriptions, checkout sessions, payment + shipping data |
| Printful | Merch orders + fulfillment |
| Vercel env vars | **All secrets** (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_*, SUPABASE_SERVICE_ROLE_KEY, provider keys) |
| Local untracked `.env.local`/`.env.production.local`/`.vercel/.env.development.local` | Secrets (gitignored) |
| In-memory per-instance maps | ip-rate-limit (non-shared across serverless instances) |

**User data:** emails; account credentials (Supabase); JWT session tokens; Stripe billing identity + payment metadata; shipping name + postal address (merch); AI chat content; IP addresses; team membership/invite emails; subscription tier; usage/rate-limit counters.

### 7.6 Key Risks (Website)
| # | Severity | Finding |
|---|---|---|
| WB-1 | High | `/auth/cli-login` POSTs **live Supabase access+refresh tokens to `http://localhost:<port>`** where port is unvalidated from query string (`page.tsx:35`); any local process on an attacker-chosen port (or malicious link) could capture a logged-in user's full session — no loopback-only nonce binding visible |
| WB-2 | High | Hardcoded `OWNER_EMAILS` grant unconditional `team` tier + total rate-limit bypass across chat/download/verify; correctly gated on `email_confirmed_at` (`owner.ts`) — **security depends on Supabase "Confirm email" being ON** (per memory, still needs manual verification); if off, account-takeover → free premium |
| WB-3 | Medium | `comp-access.mjs` has **no time-based expiry** — comps persist until a human runs revoke (only refuses if a `stripe_customer_id` exists); indefinite-free-access operational risk |
| WB-4 | Medium | Co-located ShipSpace Electron app (electron/, e2b, node-pty, xterm) under the **same package.json** as the billing site increases blast radius + dependency surface for the deployed web target |
| WB-5 | Medium | `ip-rate-limit.ts` is in-memory per serverless instance (non-shared) → largely ineffective as a global limiter on Vercel multi-instance (money-sensitive checkout correctly uses DB-backed `reserveIpRequest`) |
| WB-6 | Medium | `reserveIpRequest`/`reserveChatRequest` **fail OPEN** on DB error — outage disables rate limiting (intentional for checkout, but abuse limiting is best-effort) |
| WB-7 | Medium | Stripe webhook trusts tier from `metadata.plan` (safe today since checkout is server-authenticated; any future user-influenced metadata path could escalate to `team`) |
| WB-8 | Low | Stripe webhook dedupe insert failure for non-23505 reasons logs and continues → billing not idempotent if `processed_stripe_events` table broken (low likelihood) |
| WB-9 | Low | LibraryGate paywall is **client-side cosmetic blur** — acceptable only because real enforcement is server-side on download/install/chat; confirm libraries pages don't render real gated content to unsubscribed users |
| WB-10 | Info | Deploy path is `vercel --prod` from local working tree (not git push) → committed code may diverge from live; repo audit ≠ prod state. Migrations 001–012 must all be applied in prod (some noted pending). Secrets scan clean (`.env*` gitignored; only placeholder `sk_test_XXXX` in tracked files) |

---

## 8. Cross-Cutting Theme: Client-Side Trust & Owner Bypass

All three desktop apps set subscription tier client-side and ship a hardcoded owner-email allowlist. The desktop variants (`ShipTalk/src/lib/owner.ts`, `shipmind/src/lib/owner.ts`) check email only; the website (`makeshiphappenAi/lib/auth/owner.ts`) additionally requires `email_confirmed_at` (stronger). The consistent conclusion: **subscription/entitlement enforcement is only real where it is server-side (Supabase RLS + the website's server-side gates on download/install/chat).** Any premium logic enforced purely in the desktop clients is bypassable by a local user. Owner emails: `zzgemsjewelry@gmail.com` (all three) and `aryah.yeasley@icloud.com` (ShipMind + website).

## 9. Cross-Cutting Theme: Unauthenticated Companion MCP Servers

Each desktop app ships a stdio MCP server (`shiptalk-mcp`, `shipmind-mcp`, `shipspace-mcp`) that exposes its local data store to **any local process/agent that can spawn it, with no authentication**. ShipTalk's and ShipSpace's MCP servers include a `get_state_raw` tool that reads arbitrary localStorage keys — including persisted Supabase **session tokens** and full transcript/chat history (confirmed `shiptalk-mcp/src/index.ts:226,231`). ShipMind's MCP exposes the entire personal-knowledge DB (with an untrusted-content wrapper as a partial mitigation). This is a deliberate "expose local data to your agents" design pattern, but it means the security boundary is the OS user account, not the app — anything running as the user reads everything.

## 10. Compliance & Privacy Observations (for later phases)

- **Marketing vs. reality ("on-device"):** ShipTalk and ShipMind market local/on-device processing, but cloud STT/polish/chat paths egress raw audio, transcripts, notes, and source content to up to 3 (ShipTalk) / 8 (ShipMind) third-party AI providers using client-held keys. This gap warrants disclosure review (FTC §5 / consumer-protection exposure) and a clear data-processing notice.
- **PII inventory:** emails, passwords, session JWTs, voice recordings, full transcripts, personal notes/knowledge, IP addresses, and shipping addresses are processed across the ecosystem — implicating GDPR/CCPA data-subject and processor-disclosure obligations. No DPA / sub-processor list was located in this phase.
- **Data retention:** ShipTalk transcripts are never pruned and survive reinstall; comp-access grants never expire. Retention/deletion policy is undefined.
- **Supply chain:** unverified Hugging Face model downloads (ShipTalk) and large bundled sidecars (deno/ffmpeg/yt-dlp/ollama in ShipMind) lack documented integrity verification.

---

## 11. Coverage Confirmation

All four products are inventoried: **ShipTalk** (§4), **ShipMind** (§5), **ShipSpace** (§6), **makeshiphappen.tech** (§7), plus shared subsystems (§3) and the three companion MCP servers + Chrome extension. Every claim is grounded in the supplied evidence and spot-verified against the actual code where load-bearing (owner files, CSP, `run_shell_cmd` allowlist, orchestrator origin check, MCP state tools, cli-login port handling, app identifiers/versions). One evidence-vs-code discrepancy (ShipSpace identifier `com.shipspace.ade`) and two packaging mismatches (website `package.json` named `shipspace`; ShipSpace keychain service naming) are flagged for reconciliation.
