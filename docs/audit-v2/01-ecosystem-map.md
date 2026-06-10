# 01 — Ecosystem Map & Inventory (PHASE 1)

**Date:** 2026-06-07
**Constraint:** READ-ONLY synthesis. Only `docs/audit-v2/01-ecosystem-map.md` and `docs/audit-v2/02-data-flow-audit.md` are written. No code/config changed. Independence: derived solely from dossiers 10–16 (did NOT consult `docs/audit/` or `docs/business-protection/`).
**Method:** Cross-synthesis of evidence dossiers `10-shipmind-cluster.md`, `11-shipspace-cluster.md`, `12-voice-cluster.md`, `13-web-commerce-cluster.md`, `14-utilities-memory-cluster.md`, `15-licenses-and-secrets.md`, `16-marketing-claims-sweep.md`. All `file:line` citations preserved from those dossiers.

> **Repo structure note** (`15:7`): the **root** git repo tracks only 7 files (`.gitignore`, three `*.command` launchers, `README.md`, `package.json`, `summarize_readme.sh`). Each product is an **independent nested git repo** committed separately: `ShipCode/`, `ShipSpace/`, `ShipTalk/`, `makeshiphappenAi/`, `shipmind/`, `ShipWatch/`. `ShipTranscribe/` is an untracked working tree.

---

## Ecosystem map

```
                         MakeShipHappenCollective (umbrella; root repo = 7 files)
                                          │
   ┌──────────────────────────────────────┼──────────────────────────────────────────────────┐
   │                                       │                                                    │
DESKTOP AI APPS (Tauri 2)            WEB / COMMERCE                              CLI / AGENT TOOLS
   │                                       │                                                    │
 ┌─┴───────────────┐          ┌────────────┴───────────┐                       ┌────────────────┴──────────┐
 ShipMind  v2.0.3  │          makeshiphappenAi          │                       ShipCode  (CLI, MIT, v0.6.1)
 ShipSpace v0.1.3  │          (= makeshiphappen.tech,    │                       ShipClick (bash computer-use)
 ShipTalk  v0.1.1  │           Next.js, :3456)           │                       ship-aos  (local Next.js :3737)
 ShipTranscribe    │          ship-aos (local :3737)     │
 ShipWatch v0.1.0  │ ◀── highest-risk surface (surveillance)
 └─┬───────────────┘
   │
MCP SERVERS (stdio, read[/write]-only)         SURVEILLANCE / MEMORY                SUPPORTING ASSETS
   │                                                 │                                     │
 shipmind-mcp   (RO SQLite)                    ShipWatch (screen/mic/audio/        MSH Logo, Shipmind Photos,
 shipspace-mcp  (RO SQLite, key-filtered)       clipboard/URL/OCR capture)          product mockups (*.html),
 shiptalk-mcp   (RO sqlite, NO auth)           ship-memory (markdown vault,         ShipMindPrompts/, Prompts/,
 ship-memory MCP (RW + hard-DELETE, NO auth)    shared ~/ShipMemory hub, RW+del)    docs/, ship-it-guidelines/
                                                                                    packages/account-menu (UI lib)
 BROWSER EXTENSION                                                                  DEPRECATED / OUT OF SCOPE
 shipmind-extension (Chrome MV3 → :8765 ingest, dead path)                          shipyard-os (empty, .next only)
                                                                                    flappy-bird game (obstacles/score/
                                                                                     sounds/ui.js + flappy-bird.html)

──────────────────────────────── SHARED SERVICES (cross-cutting) ────────────────────────────────
  Supabase  (gvhbhoicvvoezjjartrt) — auth + profiles + subscriptions + usage_events + transcripts
            used by: ShipMind, ShipSpace, ShipTalk, ShipCode, ShipWatch(telemetry), makeshiphappenAi
  Stripe    — subscription + merch checkout + webhooks   ......... makeshiphappenAi (+ ship-aos local key)
  Printful  — print-on-demand merch fulfillment   ................ makeshiphappenAi
  Sentry    — error telemetry   .................................. makeshiphappenAi, ShipCode
  Vercel    — web host   ......................................... makeshiphappenAi
  Gumroad   — license validation   .............................. ShipWatch Cloud relay
  makeshiphappen.tech — updater endpoint + login + CLI-login + iframe ... ShipMind, ShipSpace, ShipTalk, ShipCode
  ~/ShipMemory hub — shared markdown second-brain   ............. ship-memory ↔ ShipSpace ↔ Claude clients

  AI PROVIDERS (cloud): Anthropic · OpenAI · Groq · Google(Gemini) · DeepSeek · Perplexity · OpenRouter · xAI
  AI PROVIDERS (local): Ollama (embeddings/vision) · whisper-rs/whisper.cpp (STT) · macOS `say` (TTS) · Apple Speech (cloud STT)
  CONTENT SOURCES: HuggingFace (whisper models) · Brave Search (scrape) · YouTube/yt-dlp · ollama.com registry
```

**Headline structural insight:** every product is locally-positioned and BYO-key-or-local-first in its marketing, but each desktop app has at least one *cloud-egress* path that ships user content (RAG excerpts, transcripts, captured screen/audio, code) to third-party LLM APIs, and **all four MCP servers** plus **ship-memory** expose user data to any connected LLM with **little to no auth**. The OS-permission footprint escalates sharply from ShipMind (mic) → ShipTalk (mic+accessibility) → ShipWatch/ShipClick (screen-record + mic + accessibility + automation + system-audio).

---

## Inventory

### Cluster A — Desktop AI apps

| Name | Purpose | User-facing | Internal | Dependencies | Third-party integrations | AI providers | External services | Auth | OS permissions | Storage | Data processed | User data |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **ShipMind** (`shipmind/`, v2.0.3) | Local-first RAG "second brain" / knowledge app | Drop files/audio/YouTube; chat over corpus; deep research; IDE browse; TTS | Tauri Rust backend: ffmpeg→whisper STT, Ollama embeddings via `127.0.0.1:11434`, SQLite, yt-dlp/deno sidecars, browser/youtube child webviews (`10:14-29`) | rusqlite, whisper-rs, pdf_extract, keyring, `@anthropic-ai/sdk`, supabase-js, zustand (`10:137`) | Supabase, makeshiphappen.tech (updater+login), HuggingFace, ollama.com, Brave (scrape), YouTube (`10:33`) | **Cloud chat (BYO-key):** Anthropic, OpenAI(+codex/shipcode aliases), DeepSeek, Perplexity, Groq, Gemini, OpenRouter, Manus, nano-banana. **Local:** Ollama embed, whisper-rs, `say` (`10:31`) | Supabase, makeshiphappen.tech, HuggingFace, Brave, YouTube (`10:33`) | Supabase email/pw + browser-login deep link; client-side tier gate + hardcoded owner bypass (`10:35`) | **Mic** (`device.audio-input`); `disable-library-validation`, `allow-jit`, `allow-unsigned-executable-memory`, `allow-dyld-env`; fs write allow-list `$HOME/** $APPDATA/** $TEMP/**` (`10:37`) | SQLite `…/com.makeshiphappen.shipmind/shipmind.db`; audio/voice/youtube/models subdirs; `config.json` chmod 0600; **keys in macOS Keychain** (`10:39`) | Voice/audio, PDFs/docs/web pages, YouTube media, chat prompts+RAG excerpts, embeddings, web-search queries (`10:51-62`) | Documents, voice transcripts, custom_instructions (Supabase profile) (`10:39,93`) |
| **ShipSpace** (`ShipSpace/`, v0.1.3) | Multi-agent "Agent Development Environment" | ShipGang multi-agent code-gen, command-center chat, terminals, embedded browser, GitHub PR/clone, voice | In-process axum MCP orchestrator on `127.0.0.1:<rand>`; PTY shell spawn; Tauri commands incl. unconfined `read_file`; auto-responder; auto-merge worktrees (`11:27-46`) | supabase-js, @tauri-apps/* (shell/http/process/updater/dialog), @xterm/*, portable-pty, axum, tokio, keyring (`11:199-201`) | Supabase, GitHub (`gh` CLI w/ user OAuth), makeshiphappen.tech updater (`11:21,57`) | **BYO-key:** Anthropic, OpenAI, Google, Groq, DeepSeek, Manus, Perplexity, nano-banana, xAI; **local CLI agents** Hermes, OpenClaw; worker `claude`/`codex` CLIs under host creds (`11:62-63`) | Supabase, GitHub, makeshiphappen.tech (`11:21,57`) | Supabase; `AuthGate`, owner bypass (`11:23`) | Spawns user shell/processes; reads filesystem (unconfined `read_file`); lists/kills PIDs; network egress; **`withGlobalTauri:true`** (`11:16,25,36`) | zustand→WebView localStorage (`localstorage.sqlite3`); `shipgang-output/`; logs under `~/Library/Logs/ShipSpace/`; **keys in OS keychain** (`11:24`) | Mission prompts, reference-file contents, generated code, terminal scrollback, browser page context, GitHub issue bodies (`11:151`) | Code, prompts, GitHub identity, API keys (`11:105,151`) |
| **ShipTalk** (`ShipTalk/`, v0.1.1) | Hold-to-talk voice→text; types into frontmost app; local history; cloud Polish | Dictation overlay pill, searchable history, Polish rewrite, 4 engines | Tauri Rust: whisper-rs local STT; `osascript`/`pbcopy`→clipboard→Cmd-V paste; Supabase sync (`12:14-25`) | whisper-rs, hound, keyring, core-graphics, supabase-js (`12:135`) | Supabase (auth+transcript sync+dictionary), HuggingFace (models) (`12:20`) | **STT:** Browser/Web Speech (Apple cloud), Local Whisper, OpenAI Whisper, Groq Whisper. **Polish:** Anthropic `claude-haiku-4-5` (`12:18-19`) | Supabase, HuggingFace, OpenAI, Groq, Anthropic, Apple speech (`12:19-20`) | Supabase email/pw; **NO login gate** (usable as `local-user`); hardcoded owner→team tier (`12:21,68`) | **Mic, Speech Recognition, Accessibility** (paste); Camera declared-not-used (`12:22`) | localStorage (`shiptalk-history`, settings, polish prompts); Supabase `transcriptions`/`dictionary_terms`/`profiles`; Keychain (keys); app-data (models) (`12:23`) | Voice audio (raw, some→cloud), transcripts (raw+polished), dictionary terms, stats (`12:24`) | Full dictation transcripts, voiceprint-adjacent audio (`12:94`) |
| **ShipTranscribe** (`ShipTranscribe/`, v0.1.0) | Import video/audio → fully local transcription | Gallery + viewer; import file → transcript | Tauri Rust shells to system `ffmpeg`/`ffprobe`/`whisper-cli` via PATH lookup (`12:31`) | @tauri-apps/* (shell/dialog), zustand; system ffmpeg/whisper-cli (`15:28`) | **None** — no `api.*` egress; CSP has no remote connect-src (`12:30`) | **Local only** — whisper.cpp Metal / Python Whisper fallback (`12:29`) | None (`12:30`) | None (local app) | None network; system binary exec | local app store (zustand persist) + local files (`12:32`) | Audio/video files → transcripts (all local) (`12:57`) | Imported media, transcripts (local) |
| **ShipWatch** (`ShipWatch/`, v0.1.0) | **Continuous all-modality desktop surveillance** ("second memory") | Screen+mic+system-audio+clipboard+URL+activity capture, OCR, AI summarize, chat-with-memories | Tauri Rust: `screencapture`, ffmpeg avfoundation mic, osascript automation, BlackHole system-audio, Vision/swiftc OCR; optional Node/Hono cloud proxy on **0.0.0.0** (`14:14-23,82-86`) | @tauri-apps/* (autostart/positioner/sql/http/fs/shell), tauri-plugin-sql; **`withGlobalTauri:true`** + broad `fs:default` (`14:89,168`) | Anthropic, OpenAI, Google, ShipWatch Cloud (`api.shipwatch.app`), Gumroad (license) (`14:19-20`) | **BYO-key:** Ollama (local default), Gemini, Anthropic, OpenAI; **operator-paid:** ShipWatch Cloud relay→Anthropic (`14:19`) | api.anthropic/openai/google, api.shipwatch.app, api.gumroad.com (`14:20`) | License-gated cloud relay (Gumroad key + CORS + rate-limit); no in-app login (`14:74,82-86`) | **Screen Recording, Microphone, Accessibility/Automation, system-audio (BlackHole)** (`14:18`) | SQLite `shipwatch.db`; screenshots `*.png`, audio `*.wav`/`sys_*.wav` — **unencrypted**; **API+license keys in plaintext localStorage** (`14:21-22`) | Screen captures, OCR text, mic+system audio, clipboard (3s poll), browser URLs, app/window activity (`14:65-74`) | Everything user sees/types/copies/says + bystanders' audio (`14:119,138`) |

### Cluster B — Web / Commerce

| Name | Purpose | User-facing | Internal | Dependencies | Third-party | AI providers | External services | Auth | Permissions | Storage | Data processed | User data |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **makeshiphappenAi** (= makeshiphappen.tech) | Public marketing + commerce site for whole ecosystem | Membership signup, subscription/merch checkout, download gating, CLI login, AI chat | Next.js App Router; Stripe via raw REST fetch; Supabase SSR; Printful order on webhook; server-paid chat gate (`13:14-28`) | next, react, @supabase/ssr+js, stripe, @google/generative-ai, e2b, pg, node-pty, electron (`15:32`) | **Stripe, Supabase, Printful, Sentry, Vercel** (`13:25`) | **Server-paid:** Anthropic, OpenAI, Google, DeepSeek (gated chat). Named in ToS: +Groq, OpenRouter, Ollama (`13:23-24`) | Stripe, Supabase, Printful, Sentry, Vercel (`13:25`) | Supabase Auth (anon key browser; service-role webhook/admin); tiers free/pro/team; owner bypass 2 emails (`13:19-20`) | Web app (no OS perms) | Supabase Postgres: profiles, subscriptions, teams, usage_events, processed_stripe_events, ip_rate_events (`13:26`) | email, pw hash, Stripe customer id, sub status, usage events, merch buyer PII→Printful (`13:27`) | email, payment PII, name+shipping address, prompt content (`13:27,49`) |
| **ship-aos** (`ship-aos/`, local) | Local "Ship AOS" dashboard — journal/goals/memory/kanban + CLI-agent chat + Stripe vitals | Journal, kanban, agent chat panes (Claude/Codex/Hermes/OpenClaw), Stripe view | Next.js `next dev --port 3737` (localhost); `/api/run` allowlist-gated; chat routes spawn CLI binaries (`13:30-38`) | Next.js, Supabase via fetch | Stripe (local live key), CLI agents | Claude, ChatGPT/Codex, Hermes, OpenClaw (local CLIs) (`13:34`) | Stripe (reads local live key) (`13:38`) | **NONE on any API route** (`13:36`) | Spawns CLI processes; reads local Stripe key file | `~/.ship-aos/stripe.json` (live `sk_live_`/`rk_live_`, chmod 600) (`13:38`) | Journal/goals/memory, prompts, Stripe data | Personal notes, live Stripe secret |

### Cluster C — CLI / Agent tools

| Name | Purpose | User-facing | Internal | Dependencies | Third-party | AI providers | External services | Auth | Permissions | Storage | Data processed | User data |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **ShipCode** (`ShipCode/`, MIT, v0.6.1) | Plain-language coding CLI; model-agnostic; real file edits w/ diff/approval | `shipcode` CLI: chat, edits, runCommand, file ops | Node CLI; AI tools `readFile/searchFiles/grepContent/runCommand/getProjectTree/write` (`14:25-34`) | @sentry/node, glob, chalk, commander, ora (`15:35`) | Supabase (usage_events), Sentry (`14:32`) | **All BYO-key:** Ollama, Anthropic, OpenAI/Codex, Groq, Gemini, Perplexity, OpenRouter (`14:30`) | Supabase, Sentry, makeshiphappen.tech (OAuth login) (`14:31-32`) | OAuth loopback→makeshiphappen.tech; tokens in `~/.shipcode`; owner email bypass (`14:31`) | Reads/writes/edits files; `runCommand` arbitrary shell; client-side free meter (`14:34`) | `~/.shipcode/usage.json`, `keys.json` chmod 600 + Keychain, session (`14:33`) | Code, prompts, telemetry events | user_id+event+metadata→Supabase (`14:75`) |
| **ShipClick** (`ShipClick/`) | Free voice-driven **computer-use** agent — drives real Mac | Speak a task; agent screenshots→reads→clicks/types | Bash wrapping `claude -p --permission-mode bypassPermissions --max-turns 60 --add-dir bin`; whisper-cli STT, `say` TTS, `cliclick` (`14:38-44`) | local Claude Code subscription, whisper-cli, cliclick, ffmpeg (`14:38`) | none (uses user's Claude subscription) | Claude (via local Claude Code) (`14:41`) | none external | uses host Claude Code creds | **Mic, Screen Recording, Accessibility (cliclick injection), Automation (osascript)** (`14:42`) | none persistent of note | Screen contents (read by agent), voice task | Screen captures, voice commands |

### Cluster D — MCP servers

| Name | Purpose | Internal | Auth | Data exposed | Storage | Notes / severity |
|---|---|---|---|---|---|---|
| **shipmind-mcp** (`shipmind-mcp/`) | Read-only stdio MCP over ShipMind SQLite | DB opened `readonly`; untrusted content wrapped in delimiters (`10:42`) | stdio trust model (no token) | list groups/transcripts/sources/notes/bookmarks/tags, get_transcript, read_source, search, stats (`10:42`) | reads shipmind.db | **Best-hardened** MCP: RO + prompt-injection wrapping |
| **shipspace-mcp** (`shipspace-mcp/`) | Read-only MCP exposing app state to any connected LLM | RO SQLite; sensitive-key filter + `ALLOWED_KEYS` excludes `shipspace-api-keys` (`11:60,129`) | no per-call auth (stdio) | workspaces, chats, settings, prompts, ShipGang runs (`11:60`) | reads `localstorage.sqlite3` | Medium — mitigated by key filter (`11-S10`) |
| **shiptalk-mcp** (`shiptalk-mcp/`) | Reads ShipTalk WebKit localStorage; exposes transcripts to LLM | RO sqlite (`12:37`) | **NONE — no token/allowlist/redaction** (`12:38`) | full transcript text, arbitrary localStorage via `get_state_raw`/`list_state_keys` (`12:39`) | reads `localstorage.sqlite3` | **High** — any client reads all transcripts (`12-S1`) |
| **ship-memory MCP** (`ship-memory/packages/mcp`) | 12-tool surface over markdown second-brain vault | hub from `cwd` arg/`$SHIP_MEMORY_HUB`/`process.cwd` (`14:51`) | **NONE** — RO mode opt-in via `SHIP_MEMORY_READONLY` (not default) (`14:104`) | read/append/update/**hard-DELETE** memories; `cwd` can retarget hub anywhere (`14:104`) | plaintext `.md` in `.shipmemory/`; shared `~/ShipMemory` (`14:50`) | **Medium** — unauthenticated write+permanent-delete; blast radius = entire cross-product KB (`14-S7`) |

### Cluster E — Browser extension

| Name | Purpose | Internal | Permissions | Auth | Storage | Notes |
|---|---|---|---|---|---|---|
| **shipmind-extension** (`shipmind-extension/`) | Chrome MV3 context-menu "send link/page/selection to ShipMind" | POSTs to `http://127.0.0.1:8765/ingest` w/ Bearer; fallback `shipmind://add?...` deep link (`10:45`) | contextMenus, storage, notifications, tabs; host `http://127.0.0.1:8765/*` (`10:45`) | Bearer token in `chrome.storage.local` (not encrypted) | chrome.storage.local | **Dead path** — `:8765` server doesn't exist in app; only `stream://` registered (`10:77`) |

### Cluster F — Surveillance / Memory

(ShipWatch listed under Cluster A; here are the memory engines)

| Name | Purpose | Internal | Auth | Storage | Data | Notes / severity |
|---|---|---|---|---|---|---|
| **ship-memory** (`ship-memory/`) | Standalone markdown "second-brain" engine; core/mcp/connector-obsidian | TS monorepo; plaintext `.md`, no DB, **no encryption** (`14:48-50`) | none (MCP — see Cluster D) | `.shipmemory/` hub; shared `~/ShipMemory` (`14:50,52`) | Personal notes (plaintext) (`14:124`) | Cross-product hub wired into ShipSpace + Claude (`14:52`) |

### Cluster G — Supporting assets / out of scope

| Name | Status | Notes |
|---|---|---|
| `packages/account-menu/` | Active UI lib | AccountMenu.tsx + icons + types; no secrets/network (`14:56`) |
| `ShipMindPrompts/`, `Prompts/` | Active prompt packs | Research packs scrape YouTube transcripts to lift creators' prompts + competitor surveillance (`16:116-118`); `Prompts/Agents/Web Scraping Agent.txt` models ethical scraping (`16:120`) |
| `ship-it-guidelines/` | Active | "Build Bold, Break Nothing" vibe-coding ethos in tension w/ ShipSpace safety findings (`11:190`) |
| Product mockups (`shipmind-product-page-mockup*.html`) | Shippable marketing | Carry the highest-liability absolute-privacy + comparison-table claims (`16:104`) |
| MSH Logo, Shipmind Photos, docs/ | Assets | Branding/screenshots |
| **shipyard-os/** | **Deprecated/empty** | Only `.next/dev/*` build artifacts; no source — recommend deletion/gitignore (`14:55,175`) |
| **flappy-bird game** (`obstacles.js`, `score.js`, `sounds.js`, `ui.js`, `flappy-bird.html`) | **Out of scope** | Browser game, no risk surface (`14:57`) |
| `summarize_readme.sh` | Utility | Local README-summarizer (`14:57`) |

---

## AI provider matrix

| App / surface | Anthropic | OpenAI | Groq | Google (Gemini) | DeepSeek | Perplexity | OpenRouter | xAI | Ollama (local) | Apple Speech | Whisper (local) | Key model |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **ShipMind** | ● chat | ● chat | ● chat + DeepResearch | ● chat | ● chat | ● chat | ● chat | — | ● embeddings | — | ● STT (whisper-rs) | **BYO** (Keychain) (`10:31`) |
| **ShipSpace** | ● | ● (+realtime voice) | ● | ● | ● | ● | — | ● | — (CLI Hermes/OpenClaw local) | — | — | **BYO** (Keychain); worker CLIs under host creds (`11:62-63`) |
| **ShipTalk** | ● Polish (`claude-haiku-4-5`) | ● Whisper API + browser-mode audio backup | ● Whisper API | — | — | — | — | — | — | ● Browser/Web Speech STT (cloud) | ● Local Whisper STT | **BYO** (Keychain) (`12:18-19`) |
| **ShipTranscribe** | — | — | — | — | — | — | — | — | — | — | ● whisper.cpp/Python (local) | **Local-only** (`12:29-30`) |
| **ShipWatch** | ● chat + Cloud relay | ● chat | — | ● chat | — | — | — | — | ● vision/chat (default) | — | ● mic STT (whisper-cli) | **BYO** + **operator-paid** Cloud relay (`14:19`) |
| **ShipCode** | ● | ● /Codex | ● | ● | — | ● | ● | — | ● | — | — | **BYO** (`14:30`) |
| **ShipClick** | ● (via local Claude Code) | — | — | — | — | — | — | — | — | — | ● whisper-cli STT | Uses user's **Claude subscription** (`14:41`) |
| **ship-aos** | ● (Claude CLI) | ● (Codex CLI) | — | — | — | — | — | — | — (Hermes/OpenClaw CLIs) | — | — | Local CLI creds (`13:34`) |
| **makeshiphappenAi** | ● | ● | (named in ToS) | ● | ● | — | (named in ToS) | — | (named in ToS) | — | — | **Operator-paid** server keys, authed+rate-limited (`13:23-24`) |

**Matrix takeaways:**
- **Operator pays** for: makeshiphappenAi gated chat (Anthropic/OpenAI/Google/DeepSeek, `13:23`) and the ShipWatch Cloud relay→Anthropic (`14:74`). Everything else is **BYO-key** (user pays).
- **Anthropic is the most pervasive recipient** — reached by ShipMind, ShipSpace, ShipTalk (Polish, even on Local Whisper), ShipWatch (+ relay), ShipCode, ShipClick, ship-aos, makeshiphappenAi.
- **Local-only** in practice: ShipTranscribe (fully) and ShipMind's embeddings/STT/TTS subset (but ShipMind *chat* egresses).
- **Hidden cloud STT:** ShipTalk's "Browser/Instant" engine routes raw audio to **Apple's cloud speech servers** + (if keyed) an **OpenAI audio backup** — neither surfaced at engine selection (`12-P2,P3`).
