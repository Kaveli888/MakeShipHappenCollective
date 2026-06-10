# Phase 2 — Data Flow Audit

**Ship Ecosystem (ShipTalk · ShipMind · ShipSpace · makeshiphappen.tech)**
**Audit type:** Read-only data-flow / privacy / governance assessment
**Date:** 2026-06-07
**Auditor role:** Senior auditor + SaaS/privacy/technology attorney + compliance officer
**Scope:** Track every flow of user input, files, audio, text, logs, analytics, API requests, agent communication, external providers, databases, local storage, and cloud storage. For each flow: origin → destination → storage duration → security controls → responsible party.

> **CRITICAL NOTE ON THIS AUDIT:** This is a read-only inventory and risk assessment. No code was modified. Every claim below is grounded in the provided recon evidence and direct inspection of the source tree. Where a claim depends on data the codebase cannot reveal (e.g. Supabase Row-Level Security policies in the live database, Vercel environment variables, or the deployed `vercel --prod` working tree), it is explicitly flagged as **MUST-VERIFY**. The deploy path for the website is `vercel --prod` from a local working tree, so the repository does not guarantee production state.

---

## 1. Executive Summary

The Ship Ecosystem comprises three Tauri desktop applications (ShipTalk, ShipMind, ShipSpace) and one Next.js commerce/marketing website (makeshiphappen.tech). The four products share a common architectural pattern: **local-first desktop apps that hold secrets in the OS keychain and call cloud AI providers directly (bring-your-own-key, BYOK), plus a server-side website that proxies AI through platform-held keys and brokers Stripe/Supabase/Printful.**

The single most important finding across the ecosystem is a **systemic absence of data retention, pruning, and deletion logic.** Three of four products store their most sensitive user data — voice transcripts (ShipTalk), the entire personal "second brain" (ShipMind), and full terminal scrollback including typed secrets (ShipSpace) — in **plaintext, unencrypted local stores that grow forever and have no working deletion path.** The website's privacy policy promises GDPR/CCPA erasure and export rights, but there is **no code path that implements them** — deletion is a manual email-driven process. Combined with a strong outbound data surface (up to 11 AI sub-processors across the ecosystem, none disclosed in a sub-processor inventory; voice/code/notes egressed to third parties whose retention and jurisdiction differ materially), the dominant risk class is **governance and privacy, not raw exploitability.**

Positive controls exist and are notable: provider API keys are correctly isolated in the macOS keychain across all three desktop apps; the website never stores passwords or card data (Supabase Auth + Stripe-hosted checkout); the website proxies AI chat without persisting message bodies; ShipMind's MCP server wraps untrusted content for prompt-injection defense; and `.env*` secrets are properly gitignored on the website. The recurring weak points are: (1) the local-MCP servers (`shiptalk-mcp`, `shipmind-mcp`, `shipspace-mcp`) that expose entire local data stores to any local agent; (2) the `/auth/cli-login` token relay to an attacker-influenceable localhost port; (3) marketing/legal disclosures that are both over-inclusive (Sentry/Groq/OpenRouter named but absent in code) and under-inclusive (DeepSeek, a China-based processor, undisclosed); and (4) "on-device" marketing contradicted by cloud egress, flagged by the team's own audit comment.

---

## 2. Severity Legend

| Severity | Meaning |
|----------|---------|
| **Critical** | Direct, low-effort path to mass data exposure, credential theft, or account takeover. |
| **High** | Sensitive data exposed/retained improperly, or a documented legal right that cannot be fulfilled; exploitation requires local access or specific conditions. |
| **Medium** | Material governance/transparency gap, or exposure requiring elevated conditions. |
| **Low** | Limited-sensitivity leak, defense-in-depth gap, or operational hygiene issue. |
| **Info** | Inventory note or positive control documented for completeness. |

---

## 3. Ecosystem-Wide Data Map (ASCII Visual Hierarchy)

```
                        ╔══════════════════════════════════════════════════════════╗
                        ║                 SHIP ECOSYSTEM DATA FLOWS                  ║
                        ║          Responsible party: MakeShipHappen / Jake          ║
                        ║              (zzgemsjewelry@gmail.com, owner)              ║
                        ╚══════════════════════════════════════════════════════════╝

  ┌─────────────────────────── USER (single human) ───────────────────────────┐
  │  voice · files · text · code · web pages · email/password · payment · merch │
  └────┬──────────────────┬──────────────────┬───────────────────────┬─────────┘
       │                  │                  │                       │
   ┌───▼────┐        ┌────▼─────┐       ┌────▼──────┐         ┌──────▼──────────┐
   │ShipTalk│        │ ShipMind │       │ ShipSpace │         │ makeshiphappen  │
   │(desktop│        │(desktop  │       │(desktop   │         │ .tech (website) │
   │ Tauri) │        │ Tauri)   │       │ Tauri)    │         │ (Next.js/Vercel)│
   └───┬────┘        └────┬─────┘       └────┬──────┘         └──────┬──────────┘
       │                  │                  │                       │
  ─────┼──────── LOCAL AT-REST STORAGE (per app, UNENCRYPTED) ───────┼──────────
       │                  │                  │                       │
   WebKit localStorage  shipmind.db        WebKit localStorage    (no local store;
   sqlite3:             (SQLite, plaintext)sqlite3:               server-side only)
    • shiptalk-history   • transcripts      • workspace-sessions
      (FULL transcripts) • sources/notes      (FULL scrollback =
    • shiptalk-auth        bookmarks/tags     stdin/stdout incl.
      (Supabase JWT)     • chat sessions      typed secrets)
   OS Keychain:          • artifacts/tasks   • agent-chat (prompts)
    • Anthropic/Groq/   <appdata>/:         OS Keychain:
      OpenAI keys        • audio/ (raw wav)   • 9 provider keys
   /tmp/shiptalk-        • source_images/    ~/Library/Logs/ShipSpace:
     follow.log          • backups/*.db       • crash/lifecycle/
   ~/.../whisper-          (plaintext copy)     pty-pids
     models/             • ingest_debug.log  $TMPDIR/shipspace-*
                         OS Keychain:        <ws>/.shipspace/worktrees/
                          • 8 provider keys  gh CLI keyring (GitHub token)
                                             ~/ShipMemory (shared notes)
       │                  │                  │                       │
  ─────┼──────── LOCAL MCP SERVERS (stdio, NO AUTH) ─────────────────┼──────────
       │                  │                  │                       │
   shiptalk-mcp        shipmind-mcp       shipspace-mcp          (n/a)
   reads ALL keys ✗    reads ENTIRE DB    reads localStorage
   incl. JWT + all     (untrusted-content (allowlist + sensitive-
   transcripts          wrap = +)          key block = +)
       │                  │                  │
       └──────────────────┴──────────────────┴──► ANY local agent / process

  ════════════════ OUTBOUND CLOUD EGRESS (HTTPS / WSS) ════════════════════════

   AI SUB-PROCESSORS (BYOK from desktop clients; platform-keyed on website)
   ┌──────────────────────────────────────────────────────────────────────┐
   │ Anthropic  OpenAI  Google Gemini  Groq  DeepSeek(CN)  Perplexity       │
   │ OpenRouter  Manus(dormant)  xAI/Grok  nano-banana(MOCK)  Ollama(local) │
   │   receives: raw audio · transcripts · code · notes · images · prompts  │
   │   retention/training/residency: governed by EACH provider, NOT MSH     │
   └──────────────────────────────────────────────────────────────────────┘

   PLATFORM / INFRA SUB-PROCESSORS
   ┌──────────────────────────────────────────────────────────────────────┐
   │ Supabase (auth + Postgres PII + private 'releases' Storage)            │
   │ Stripe 'ZZ GEMZ' (billing identity + payment + shipping PII)           │
   │ Printful (merch fulfillment → name + full shipping address + email)    │
   │ Vercel (hosting + ALL website secrets in env)                          │
   │ Hugging Face (whisper model binaries, NO checksum verify)              │
   │ Brave Search (HTML scrape via curl/yt-dlp — bypasses CSP)              │
   │ YouTube / youtube-nocookie (yt-dlp + bundled Deno runtime)             │
   │ GitHub (via gh CLI, ambient repo-write token)                          │
   │ makeshiphappen.tech (updater endpoint + browser-login redirect)        │
   │ Apple speech servers (possible, via Web Speech engine in ShipTalk)     │
   └──────────────────────────────────────────────────────────────────────┘

  Legend:  ✗ = exposure gap    + = positive control present
```

---

## 4. ShipTalk — Data Flow Detail

ShipTalk captures live microphone audio and uploaded media, transcribes it (Web Speech / local whisper.cpp / Groq / OpenAI), optionally polishes with Anthropic, and auto-pastes into the focused app.

### 4.1 Flow Inventory

| # | Data class | Origin | Destination(s) | Storage at-rest / duration | Security controls | Responsible party |
|---|-----------|--------|----------------|----------------------------|-------------------|-------------------|
| T1 | Live mic audio | Microphone | (a) on-device whisper.cpp; (b) Groq `api.groq.com`; (c) OpenAI `api.openai.com`; (d) possibly Apple servers via Web Speech | Transient in-memory blobs; **not** persisted by ShipTalk. Provider retention governed externally. | Cloud Features gate (default OFF); TLS; CSP allowlist (4 hosts) | App owner (controller) + Groq/OpenAI/Apple (processors) |
| T2 | Uploaded audio/video files | User filesystem | Groq / OpenAI Whisper (chunked) | Transient; decoded to 16kHz WAV in memory | Cloud Features gate; TLS | App owner + Groq/OpenAI |
| T3 | **Speech transcripts (raw + polished)** | STT/polish output | (a) **WebKit localStorage `shiptalk-history`** — plaintext, **forever**; (b) Supabase `transcriptions` table (if authed); (c) Anthropic (polish input) | **Indefinite, plaintext, no pruning, no working delete** (App.tsx:264 omits `onDeleteItem`; no `transcriptions.delete()` anywhere) | None at rest (plaintext); RLS for cloud copy (MUST-VERIFY) | App owner |
| T4 | Custom dictionary terms | User input → Supabase | Supabase `dictionary_terms`; inlined into **every Anthropic polish prompt** | Supabase row (RLS-dependent); transient to Anthropic | RLS (read query has **no `user_id` filter** — MUST-VERIFY) | App owner + Anthropic |
| T5 | Supabase auth session (JWT) | Supabase sign-in | **WebKit localStorage `shiptalk-auth`** (plaintext) | Persisted until logout / refresh (`persistSession:true`) | None at rest; readable by any local process incl. `shiptalk-mcp` | App owner |
| T6 | Provider API keys (Anthropic/Groq/OpenAI) | User input | **macOS keychain** `com.makeshiphappen.shiptalk`; in-memory cache; sent in client requests | Keychain (correct); memory for process life | Keychain at-rest (✓); CSP limits exfil hosts | App owner |
| T7 | Frontmost-app identity (bundle id / process) | `lsappinfo` / `osascript` of OTHER apps | In-memory `PREVIOUS_APP`; **tauri-plugin-log** files | Log retention undefined, no scrubbing | None on log scrubbing | App owner |
| T8 | Cursor/display/overlay state | Native follow loop | **`/tmp/shiptalk-follow.log`** (world-readable) ~3×/sec | No rotation, left enabled in shipped code | None | App owner |
| T9 | Whisper model binaries | `huggingface.co` (curl) | `~/Library/Application Support/<bundle>/whisper-models` | Persisted | TLS only; **no SHA256/minisign verify** (size>1MB only) | App owner |
| T10 | Build artifacts | CI / dev | Supabase private `releases` bucket | Persisted | Service-role key (env-only); minisign-signed manifests | App owner / release infra |

### 4.2 ShipTalk Flow Diagram

```
 MIC ──► [audioCapture/audioProcessor 16kHz mono]
   │
   ├─ Engine 1 Web Speech ──────────────► (possibly Apple speech servers)  ⚠ "instant/local" label
   ├─ Engine 2 whisper.cpp (local) ─────► on-device only  ✓
   ├─ Engine 3 Groq Whisper ────────────► api.groq.com         ┐ raw audio leaves device
   └─ Engine 4 OpenAI Whisper ──────────► api.openai.com       ┘ (Cloud Features gate, default OFF)
                  │
            transcript text
                  │
        ┌─────────┼──────────────────────► api.anthropic.com (polish; +dictionary terms)
        │         │                          header: anthropic-dangerous-direct-browser-access:true
        │         ▼
        │   localStorage 'shiptalk-history' (PLAINTEXT, FOREVER, NO DELETE PATH)  ✗ HIGH
        │         │
        │         └──► Supabase 'transcriptions' (if authed; RLS-dependent)
        │
   auto-paste ──► type_text (Accessibility + AppleScript) ──► ANY focused app

  localStorage 'shiptalk-auth' (Supabase JWT, plaintext) ──┐
  localStorage 'shiptalk-history' (all transcripts) ───────┤
                                                            ▼
                              shiptalk-mcp (stdio, get_state_raw, NO allowlist) ──► ANY local agent  ✗ CRITICAL
```

### 4.3 ShipTalk Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| T-1 | **Critical** | `shiptalk-mcp` exposes `get_state_raw` / `list_state_keys` with **no key allowlist**, letting any local agent read the persisted Supabase JWT (`shiptalk-auth`) → account impersonation, plus all transcripts. | `shiptalk-mcp/src/index.ts:226,231,380,387`; `ShipTalk/src/lib/supabase.ts:53` |
| T-2 | **High** | Full transcript history stored in plaintext with **no retention/pruning/expiry**; explicitly survives reinstall. | `ShipTalk/src/App.tsx:85,88`; `useVoiceCommands.ts:242-253` |
| T-3 | **High** | **No working deletion path** — `HistoryView` delete button is never wired (App.tsx:264 omits `onDeleteItem`); zero `transcriptions.delete()` calls. GDPR/CCPA erasure gap. | `ShipTalk/src/App.tsx:264`; `HistoryView.tsx:182-190` |
| T-4 | **High** | Raw audio/transcripts sent directly to Groq/OpenAI/Anthropic from client using BYOK; no proxy. Contradicts "on-device" marketing (team's own audit comment). | `polish.ts:166-182`; `useVoiceCommands.ts:697`; `fileTranscribe.ts:48`; `Cargo.toml:28` |
| T-5 | **High** | Dictionary read query has no `user_id` filter; cross-tenant isolation depends entirely on RLS (MUST-VERIFY). | `polish.ts:104-108`; `DictionaryView.tsx:49-57` |
| T-6 | **Medium** | Web Speech engine may transmit audio to Apple servers despite "Browser (Instant)" label; no disclosure. | `useVoiceCommands.ts:62-66,75,376` |
| T-7 | **Medium** | No in-app privacy/data-flow disclosure mapping destinations, retention, or third parties. | (transparency gap) |
| T-8 | **Medium** | Whisper models downloaded from Hugging Face with no checksum/signature verification (supply-chain). | `lib.rs:71-80,492-545` |
| T-9 | **Medium** | API keys cached in JS memory and forwarded to provider endpoints; XSS could exfiltrate. | `apiKeys.ts:7`; `polish.ts:135` |
| T-10 | **Medium** | Supabase JWT + transcripts persisted plaintext in localStorage (storage half of T-1). | `supabase.ts:50-54`; `App.tsx:110-118` |
| T-11 | **Low** | Frontmost-app identity of all other apps read and written to logs (cross-app surveillance surface). | `lib.rs:104-179,222,233,311` |
| T-12 | **Low** | World-readable `/tmp/shiptalk-follow.log` leaks cursor/display/activity, no rotation. | `lib.rs:790,862-871` |
| T-13 | **Low** | Custom dictionary terms (often proprietary names/jargon) sent to Anthropic on every polish call. | `polish.ts:100-156` |
| T-14 | **Info** | Provider keys correctly in keychain; cloud gated; CSP allowlists 4 hosts (positive controls). | `secrets.rs:3`; `cloudFeatures.ts:11`; `tauri.conf.json:39` |

---

## 5. ShipMind — Data Flow Detail

ShipMind is a local-first "second brain": it ingests voice/audio/video/YouTube/web/files/images, transcribes locally, stores everything in one SQLite DB, and lets the user chat with the corpus via BYOK AI.

### 5.1 Flow Inventory

| # | Data class | Origin | Destination(s) | Storage / duration | Security controls | Responsible party |
|---|-----------|--------|----------------|--------------------|-------------------|-------------------|
| M1 | Voice/audio recordings | Microphone / files | Local whisper.cpp (on-device); **archived raw to `<appdata>/audio/`** | **Indefinite; orphaned on delete** | None at rest (plaintext) | ShipMind desktop |
| M2 | Transcripts + segments + speaker labels | Whisper output | **`shipmind.db` (plaintext SQLite)**; `<appdata>/backups/*.db` | Indefinite; no pruning | None at rest | ShipMind desktop |
| M3 | Sources/notes/bookmarks/tags/chat/artifacts | User + ingest | `shipmind.db` (plaintext) | Indefinite | None at rest | ShipMind desktop |
| M4 | Copied source images | Ingest | `<appdata>/source_images/` | **Indefinite; orphaned on delete** | None | ShipMind desktop |
| M5 | Ingest metadata (file paths, sizes) | Ingest pipeline | `<appdata>/ingest_debug.log` (plaintext, unrotated) | Indefinite | None | ShipMind desktop |
| M6 | **Full corpus content (chat/vision/research)** | `shipmind.db` | **Anthropic/OpenAI/Gemini/Groq/DeepSeek/Perplexity/OpenRouter** (BYOK) + base64 images | Transient to provider; retention external | TLS; CSP connect-src (**omits DeepSeek + Manus**) | ShipMind desktop + providers |
| M7 | Web-search queries | User | Brave (HTML scrape via curl, **bypasses CSP**) | Transient | `validate_public_http_url` | ShipMind desktop + Brave |
| M8 | YouTube media | User links | YouTube via yt-dlp + bundled Deno | Downloaded then ingested | URL validation; `--` arg term | ShipMind desktop + YouTube |
| M9 | Email/password + tier | User | Supabase (auth + `profiles`) | Session JWT in **webview localStorage** | RLS-dependent; committed anon JWT in `.env` (tracked) | ShipMind desktop + Supabase |
| M10 | Provider API keys | User | **macOS keychain** (allowlisted) | Keychain (correct) | Allowlist + per-channel namespacing (✓) | ShipMind desktop |
| M11 | Whisper/Ollama models | Hugging Face / Ollama registry | `<appdata>` | Persisted | TLS only | ShipMind desktop |

### 5.2 ShipMind Flow Diagram

```
 INGEST: voice · audio · video · YouTube · web · files · images
   │
   ├─ local whisper.cpp ──► transcripts/segments ─┐
   ├─ raw audio archived ──► <appdata>/audio/  ────┤   (orphaned on delete ✗)
   └─ images copied ───────► <appdata>/source_images/ (orphaned on delete ✗)
                                                   │
                                                   ▼
                            shipmind.db  (PLAINTEXT SQLite, NO encryption, NO retention)  ✗
                                │  └──► <appdata>/backups/*.db (plaintext copies, never pruned)
                                │
            ┌───────────────────┼──────────────────────────────────────────┐
            │                   │                                            │
   AI CHAT / VISION / DEEP RESEARCH (BYOK, dangerouslyAllowBrowser)   shipmind-mcp (stdio, NO auth)
            │                   │                                            │  reads ENTIRE DB
            ▼                   ▼                                            │  (+ untrusted-content
   Anthropic OpenAI Gemini    Brave (curl, bypasses CSP)                     │   wrap = good)  +
   Groq DeepSeek* Perplexity  YouTube (yt-dlp + Deno)                        ▼
   OpenRouter   (*DeepSeek/Manus NOT in CSP connect-src ✗)            ANY local agent
            │
   full source/transcript/note/image content leaves device → provider-governed retention
```

### 5.3 ShipMind Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| M-1 | **High** | Full personal corpus egressed in cleartext to user-chosen cloud AI with no redaction and **no per-provider/sub-processor disclosure**; DeepSeek = China residency. | `anthropic.ts:48`; `vision.ts:111`; `deepResearch.ts:25` |
| M-2 | **High** | Deleting a transcript/source runs DB-row delete only → **orphans raw audio + image files forever** (right-to-erasure gap). | `lib.rs:3294-3299` (delete_transcript), `4049-4054` (delete_source) |
| M-3 | **Medium** | **No retention/TTL/pruning** anywhere — backups, ingest log, tmp, audio all grow unbounded. | `lib.rs:489-525,2740-2748,900-920` |
| M-4 | **Medium** | Primary DB + backups stored **unencrypted at rest** (no SQLCipher/PRAGMA key); captured by iCloud/Time Machine. | `lib.rs:18-180,516` |
| M-5 | **Medium** | MCP server exposes entire DB read-only with **no auth** (mitigated by untrusted-content wrapper for prompt injection). | `shipmind-mcp/src/index.ts:40,59-75,93-211` |
| M-6 | **Medium** | Supabase URL + anon JWT **committed and git-tracked** in `shipmind/.env`. | `shipmind/.env:1-2`; `.gitignore:6` |
| M-7 | **Medium** | Renderer calls vendors directly with `dangerouslyAllowBrowser`/`anthropic-dangerous-direct-browser-access` under `unsafe-inline`+`unsafe-eval` CSP → XSS = key+corpus exfil. | `providers.ts:145`; `tauri.conf.json:26` |
| M-8 | **Low** | CSP connect-src omits DeepSeek + Manus (advertised providers silently fail). | `tauri.conf.json:26` vs `providers.ts:474-513` |
| M-9 | **Low** | Gemini API key transmitted in URL query string (chat path) vs header elsewhere. | `providers.ts:331,398` |
| M-10 | **Low** | Supabase session JWT persists in webview localStorage exposed to XSS. | `supabase.ts:8`; `auth.ts:84` |
| M-11 | **Low** | Chrome extension ingest path (`localhost:8765/ingest`) is **dead** — no listener, no deep-link handler; token unused. | `shipmind-extension/background.js:5,91-100` |
| M-12 | **Low** | `ingest_debug.log` records source file paths in plaintext, unrotated. | `lib.rs:2740-2782` |
| M-13 | **Info** | **No telemetry/analytics SDKs** present — egress limited to user-initiated AI/search + updater (positive). | (grep clean for posthog/sentry/mixpanel) |
| M-14 | **Info** | Keys correctly in keychain behind allowlist (positive control). | `secrets.rs:6-19,31-36` |

---

## 6. ShipSpace — Data Flow Detail

ShipSpace is an agent-orchestration IDE: real shells/PTYs, autonomous Claude/Codex agents in git worktrees, an in-process MCP orchestrator, embedded browser, gh integration, and voice. **Highest data surface in the ecosystem** — agents and terminals get real shell access.

### 6.1 Flow Inventory

| # | Data class | Origin | Destination(s) | Storage / duration | Security controls | Responsible party |
|---|-----------|--------|----------------|--------------------|-------------------|-------------------|
| S1 | **Terminal scrollback (raw stdin/stdout)** | PTY/agents | **localStorage `shipspace-workspace-sessions`** (plaintext) | **Indefinite; no TTL; no "clear history"** — includes typed secrets/`export API_KEY=` | None at rest | App owner |
| S2 | Agent chat (LLM prompts/responses) | User + providers | **localStorage `shipspace-agent-chat`** (plaintext) | Indefinite | None at rest | App owner |
| S3 | Arbitrary source/local files | Disk | `read_file`/`list_directory` (**no path confinement**) → renderer/agents → possibly LLM | Read on demand | write confined to HOME+temp; **read unrestricted** ✗ | App owner |
| S4 | Mic audio + transcripts | Microphone | **OpenAI Realtime WSS** (key in subprotocol); Groq→OpenAI Whisper fallback | Transient; provider-governed | TLS; "insecure-api-key" subprotocol pattern | App owner + OpenAI/Groq |
| S5 | LLM chat (code/notes/instructions) | User | 7 providers (Anthropic/OpenAI/Google/Groq/DeepSeek/**Perplexity/xAI**) | Transient | http allowlist + CSP (**omit Perplexity + xAI**) | App owner + providers |
| S6 | Embedded browser page content/captures | Visited sites | In-memory + `~/Documents/ShipSpace/Captures/`; piped into terminals/agents | Captures: indefinite, no purge | SSRF guard on fetch | App owner |
| S7 | Ship Memory note bodies | `~/ShipMemory` vault (plaintext .md) | Agent `--append-system-prompt`; renderer | Persisted plaintext; in-app panel read-only (can't delete) | `scrub_secrets` on write (✓); raw on read | App owner |
| S8 | GitHub identity / diffs / PRs | gh CLI | gh's own keyring token (ambient repo-write scope) | gh-managed | delegated to gh; not rotated by ShipSpace | App owner + GitHub |
| S9 | Supabase auth/profile (incl. `custom_instructions`) | Supabase | localStorage `shipspace-auth` + `profiles` table | Session persisted | RLS-dependent; tier preserved on lookup failure | App owner + Supabase |
| S10 | Provider API keys (9) | User | **macOS keychain** | Keychain (correct) | legacy-localStorage migration + MCP sensitive-key block (✓) | App owner |
| S11 | Orchestration task intents/results | Agents | axum MCP on `127.0.0.1:<random>` (**no token auth**) | In-memory; config in `$TMPDIR` | Origin check only (accepts no-origin) ✗ | App owner |
| S12 | Crash/lifecycle/PID logs | App | `~/Library/Logs/ShipSpace/*` | Indefinite, no rotation | None | App owner |

### 6.2 ShipSpace Flow Diagram

```
 PTY shells / autonomous agents (RAW shell, no typed-intent layer)
   │  stdin+stdout (base64) ──► xterm ──► scrollbackBuffers
   │                                          │
   │                                          ▼
   │             localStorage 'shipspace-workspace-sessions' (PLAINTEXT scrollback, incl.
   │             typed secrets; FOREVER; no clear-history)  ✗ HIGH
   │
 read_file / list_directory (NO path confinement) ──► ~/.ssh, ~/.aws, cookies... ──► agents/LLM  ✗ HIGH
   │
 AI chat (BYOK) ──► Anthropic OpenAI Google Groq DeepSeek  Perplexity*  xAI*
   │                (*not in http allowlist/CSP — broken or unscoped egress ✗)
   │   body = code + Ship Memory notes + custom_instructions + gh/PR + browser captures
   │
 voice ──► OpenAI Realtime WSS (key in 'openai-insecure-api-key.<KEY>' subprotocol) ✗
   │        + Groq→OpenAI Whisper auto-fallback (audio to 2nd provider, no per-provider consent)
   │
 embedded browser ──► page text/HTML/selection/assets ──► terminals/agents (prompt-injection vector)
   │
 gh CLI ──► GitHub (ambient repo-write token in gh keyring)
   │
 orchestrator axum MCP 127.0.0.1:<random> (NO auth, accepts no-origin) ──► any local process ✗
   │
 localStorage sqlite ──► shipspace-mcp (allowlist + sensitive-key block = good +) ──► local agents
   │  BUT the sqlite file itself is plaintext on disk → readable directly by any local process ✗
   │
 OS keychain (9 provider keys, legacy-localStorage migrated) ✓
```

### 6.3 ShipSpace Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| SP-1 | **High** | Terminal scrollback (raw stdin/stdout incl. typed secrets) persisted indefinitely in plaintext localStorage; no TTL, no clear-history. | `useWorkspaceSessionStore.ts:38,54-69,201-202`; `pty.rs:325-328` |
| SP-2 | **High** | `read_file`/`list_directory` have **no path confinement** → any local file (SSH/AWS creds) readable into renderer/agents → LLM exfil channel. | `lib.rs:371-429,492-495` (vs confined `write_file` 431-481) |
| SP-3 | **Medium** | Agent chat messages (prompts/code/browser HTML/responses) persisted plaintext, no deletion lifecycle. | `useAgentChatStore.ts:868-869,897-917` |
| SP-4 | **Medium** | localStorage sqlite is plaintext on disk; MCP allowlist does not protect direct file reads by other agents/processes. | `shipspace-mcp/src/index.ts:90-93,138-154` |
| SP-5 | **Medium** | OpenAI Realtime sends raw API key inside WebSocket subprotocol (`openai-insecure-api-key.*`); continuous mic audio to OpenAI. | `openai-realtime.ts:81-84,326` |
| SP-6 | **Medium** | Perplexity + xAI hosts absent from http allowlist + CSP — config/inventory inconsistency (broken or unscoped egress). | `capabilities/default.json:15-21`; `tauri.conf.json:28` vs `perplexity.ts:49`, `xai.ts:47` |
| SP-7 | **Medium** | Ship Memory note bodies + gh/PR + browser captures injected into agent system prompts and forwarded to providers (prompt-injection + data egress). | `orchestrator.rs:296-315`; `browser_view.rs:544-566` |
| SP-8 | **Medium** | Orchestrator MCP HTTP server has **no auth** — accepts no-origin requests; task intents/results readable by any local process. | `orchestrator.rs:555-560` |
| SP-9 | **Medium** | Full corpus of user code/notes egressed to up to 7 distinct AI sub-processors with no disclosure. | provider adapters `anthropic.ts:45-52` etc. |
| SP-10 | **Low** | Per-terminal MCP config, dropped files, browser captures written to disk with no cleanup. | `orchestrator.rs:384-390`; `lib.rs:504-529`; `browser_view.rs:1040-1132` |
| SP-11 | **Low** | Crash/lifecycle/PID logs accumulate indefinitely; panic payloads can leak paths/data. | `lib.rs:193-258,746-766`; `pty.rs:42-95` |
| SP-12 | **Low** | Supabase JWT + profile (`custom_instructions`/`ai_tone`) in plaintext localStorage; tier preserved on lookup failure. | `auth.ts:131-160`; `owner.ts` |
| SP-13 | **Info** | GitHub token lives in gh's keyring (ambient repo-write scope), outside ShipSpace control/audit. | `github.rs:1-13` |
| SP-14 | **Info** | Provider keys correctly in keychain with legacy-localStorage migration; MCP blocks key/secret/token keys (positive). | `secrets.rs:36-68`; `useApiKeyStore.ts:28-45`; `shipspace-mcp index.ts:138-154` |

---

## 7. makeshiphappen.tech — Data Flow Detail

The website is a **server-side proxy hub**: AI providers and third parties are called from Next.js route handlers using platform-held secret keys (Vercel env), never client-side BYOK. It handles signup/login, Stripe billing + merch, gated installers, and proxied AI chat.

### 7.1 Flow Inventory

| # | Data class | Origin | Destination(s) | Storage / duration | Security controls | Responsible party |
|---|-----------|--------|----------------|--------------------|-------------------|-------------------|
| W1 | Email + password | Signup/login | **Supabase Auth only** (app never stores passwords) | Supabase-managed | signInWithPassword; cookie SSR session | Site owner + Supabase |
| W2 | Session JWT (access + refresh) | Supabase | Browser; **`/auth/cli-login` POSTs both to `localhost:<port>`** | Browser + (risk) local listener | **port unvalidated from query string** ✗ | Site owner |
| W3 | AI chat content | User | Anthropic/OpenAI/Google/DeepSeek (server proxy, platform keys) | **NOT stored server-side**; metadata only in `usage_events` | auth+tier gate; zod caps; rate limits | Site owner + providers |
| W4 | Chat usage metadata | Proxy | Supabase `usage_events` (user_id, provider, model, status, ts) | **Indefinite, no pruning** | RLS self-read only | Site owner |
| W5 | Client IP addresses | Request headers | Supabase `ip_rate_events` | **Indefinite, no TTL/cleanup** | atomic RPC | Site owner |
| W6 | Stripe billing identity | Stripe | `profiles.stripe_customer_id`, `subscriptions/subscribers/teams` | Indefinite; no deletion coverage | webhook signature; idempotency table | Site owner + Stripe |
| W7 | Card/payment data | User | **Stripe-hosted checkout only** (never touches server) | Stripe-managed | PCI handled by Stripe | Stripe |
| W8 | Shipping name + postal address + email | Stripe session | **Printful** (fulfillment) | Lives at Stripe + Printful; **no MSH-side record** | server-side price lookup; Bearer key | Site owner + Stripe + Printful |
| W9 | Team membership emails/roles | User | Supabase `team_members` | Indefinite | RLS; email-confirm-gated activation | Site owner |
| W10 | Provider/platform secrets | Config | **Vercel env vars only** (never to client) | Vercel-managed | env-only; `.env*` gitignored | Site owner + Vercel |
| W11 | App DMGs | Releases | Supabase private `releases` bucket | Persisted | **5-min signed URLs**; sub gate | Site owner |

### 7.2 Website Flow Diagram

```
 BROWSER (user)
   │ email/password ──► Supabase Auth (no password ever stored server-side) ✓
   │ session JWT ─────► /auth/cli-login ──► POST {access+refresh} to localhost:<port>
   │                                         (port unvalidated from URL) ✗ HIGH
   │
   │ AI chat ──► /api/chat/{anthropic,openai,google,deepseek}
   │              gate(auth+tier+rate) ──► provider (PLATFORM key, server-side)
   │              body NOT stored; only usage_events metadata logged ✓
   │              DeepSeek = China-based, UNDISCLOSED ✗
   │
   │ checkout ──► Stripe-hosted (card never hits server) ✓
   │                  │
   │           Stripe webhook (signature-verified, idempotent)
   │                  ├──► Supabase: profiles/subscriptions/teams (tier from metadata.plan)
   │                  └──► Printful: name + full shipping address + email  (PII → 2 processors)
   │
   │ download ──► /api/install/* ──► Supabase private 'releases' (5-min signed URL) ✓
   │
   └─ Persistent stores (Supabase Postgres): profiles · subscriptions · subscribers ·
        teams · team_members · usage_events · ip_rate_events · processed_stripe_events
        ▲ NO automated retention/deletion ANYWHERE — privacy policy promises erasure,
          but only mechanism is a manual email to privacy@  ✗ (governance)

  Secrets: ALL in Vercel env (STRIPE/SUPABASE_SERVICE_ROLE/provider keys); .env* gitignored ✓
```

### 7.3 Website Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| W-1 | **High** | `/auth/cli-login` POSTs live Supabase access **and refresh** tokens to `http://localhost:${port}` where `port` is unvalidated from the query string → session/refresh-token capture (account takeover incl. premium tier). | `app/auth/cli-login/page.tsx:9,35-44` (verified) |
| W-2 | **High** | DeepSeek (China-based) receives user prompts with **no sub-processor disclosure, no residency control, no opt-out**; absent from privacy/subprocessors pages (GDPR international-transfer gap). | `app/api/chat/deepseek/route.ts:15`; `app/privacy/page.tsx:41,63` |
| W-3 | **Medium** | **No automated retention/deletion logic exists** — privacy policy promises Access/Export/Delete but only mechanism is manual email; tables append-only forever. | `app/privacy/page.tsx:70-93`; `usage-log.ts:33-42`; `migration 012` |
| W-4 | **Medium** | Privacy/subprocessor pages list services **not in code** (Sentry, Groq, OpenRouter, Ollama) and frame proxied AI as "BYO/governed by their terms," understating MSH's controller role. | `app/privacy/page.tsx:34,41,61`; `app/subprocessors/page.tsx:14` |
| W-5 | **Medium** | Client IPs persisted to `ip_rate_events` with **no expiry/pruning**; not disclosed in "What We Collect." | `migration 012_atomic_ip_rate_limit.sql:8-12,57`; `ip-rate-limit.ts:62-71` |
| W-6 | **Low** | Google chat route reads `GOOGLE_API_KEY` but repo/.env.example use `GEMINI_API_KEY` — Gemini likely dead/misconfigured in prod. | `chat-gate.ts:11`; `.env.example:20` |
| W-7 | **Low** | `teams/invite` + migration 010 query `profiles.email`, but `profiles` has no `email` column — auto-activation silently broken. | `app/api/teams/invite/route.ts:103` vs `migration 001:9-23` |
| W-8 | **Low** | Shipping PII flows to Stripe + Printful with no MSH-side record or deletion/export coverage; subprocessor PII categories not enumerated. | `webhook/route.ts:239-252`; `lib/printful/order.ts:47-63` |
| W-9 | **Low** | Dormant `agent_messages`/labs schema defines a transcript flow not wired into the live site; if activated would persist transcripts uncovered by retention. | `migration 001:90-177` |
| W-10 | **Low** | `usage_events` is identifiable behavioral data (which provider/model per user, when) with no admin read path and no deletion coverage. | `migration 003:1-25`; `usage-log.ts:33-42` |
| W-11 | **Low** | Stripe webhook dedupe failure (non-23505) logs+continues → replayed event could double-process billing (low likelihood). | `webhook/route.ts:67-74` |
| W-12 | **Info** | AI chat content proxied with strong minimization — content never stored, only metadata; client stores hold no keys (positive). | `chat/anthropic/route.ts:15-36`; `useApiKeyStore.ts:4-15` |
| W-13 | **Info** | Passwords/cards never stored by app server; DMGs via 5-min signed URLs; `.env*` gitignored (positive minimization posture). | `webhook/route.ts`; `install/shipmind/download/route.ts:22-114` |

---

## 8. Cross-Cutting Themes & Responsible-Party Model

1. **Retention & deletion are absent ecosystem-wide.** ShipTalk (no transcript delete), ShipMind (orphan-on-delete + no TTL), ShipSpace (no scrollback/chat clear), website (no erasure/export code path) all fail to give users a working way to remove their data. For a privacy-positioned brand ("Private Second Brain", "on-device"), this is the highest-priority governance remediation.

2. **Local MCP servers are an unauthenticated lateral-data channel.** Each desktop app ships an MCP server that any local agent can launch. `shiptalk-mcp` is worst (exposes the auth JWT, no allowlist — **Critical**); `shipmind-mcp` and `shipspace-mcp` add mitigations (untrusted-content wrap; sensitive-key block) but still expose broad personal data.

3. **BYOK egress lacks a sub-processor inventory.** Up to 11 AI providers can receive raw audio, code, notes, and images. There is no published sub-processor list, no per-provider data-handling/residency notice, and DeepSeek (China) is undisclosed. The "on-device" claim is contradicted by the team's own audit comment (`Cargo.toml:28`).

4. **Plaintext at-rest is the default for local stores.** WebKit localStorage SQLite (ShipTalk/ShipSpace) and `shipmind.db` + backups are unencrypted, captured by iCloud/Time Machine and readable by any local process.

5. **Session-token relay (`/auth/cli-login`) is the highest-value web egress path** — long-lived refresh tokens sent to an attacker-influenceable loopback port with no nonce/PKCE binding.

6. **Positive baseline to build on:** OS keychain for all provider keys (3 desktop apps), website never storing passwords/cards, website not persisting AI chat bodies, signed-URL DMG delivery, no telemetry SDKs, and gitignored secrets. The fix pattern for the plaintext-store findings is to extend the keychain/at-rest discipline already present for keys to transcripts, scrollback, and the second-brain DB.

**Responsible party** for every flow above is the same single operator/data controller: **MakeShipHappen / Jake (zzgemsjewelry@gmail.com)**, with downstream processors as named per flow (Anthropic, OpenAI, Google, Groq, DeepSeek, Perplexity, OpenRouter, xAI, Supabase, Stripe, Printful, Vercel, Hugging Face, Brave, YouTube, GitHub, Apple).

---

## 9. Verification Caveats (MUST-VERIFY in live environment)

- **Supabase RLS** on `transcriptions`, `dictionary_terms`, `profiles`, `team_members`, `usage_events`, `ip_rate_events` — the only enforcement of cross-tenant isolation; not visible in repo.
- **All 12 Supabase migrations applied in prod** (memory notes some were pending).
- **Supabase "Confirm email" = ON** — the owner-bypass and team auto-activation security depend on it.
- **Vercel env**: which Gemini key name is set; that `SUPABASE_SERVICE_ROLE_KEY` is never bundled.
- **`vercel --prod` working tree** may diverge from committed code; repo audit ≠ prod state.
