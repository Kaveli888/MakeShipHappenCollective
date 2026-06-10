# Audit Dossier 10 — ShipMind Cluster

**Scope:** `shipmind/` (Tauri desktop app), `shipmind-mcp/` (MCP server), `shipmind-extension/` (Chrome extension), plus `docs/shipmind-product-copy.md` and `shipmind-product-page-mockup*.html`.
**Method:** Independent, source-derived, READ-ONLY review. Did not consult `docs/audit/` or `docs/business-protection/`.
**App version:** 2.0.3 (`shipmind/src-tauri/tauri.conf.json:4`).

---

## 1. Inventory

### 1.1 ShipMind desktop app (`shipmind/`)
Local-first "second brain" / RAG knowledge app. Tauri v2 (Rust backend) + React/Vite/TS frontend.

| Module | Purpose | User-facing | Internal | Key deps |
|---|---|---|---|---|
| Audio/voice ingestion | Transcribe audio & voice memos | Drop file / hold hotkey to speak | `ingest_audio`, `transcribe_voice`, `save_voice_audio` (`lib.rs:2638,4593,4581`) → ffmpeg→WAV→whisper-rs | bundled `ffmpeg`, `whisper-rs` (compiled-in), `ggml-base.en.bin` model |
| YouTube/media ingestion | Pull audio/video from a URL | "Add source" / media download | `download_youtube_audio`, `download_youtube_media` (`lib.rs:2392,2486`) → bundled `yt-dlp` + `deno` (JS runtime) + `ffmpeg` | `yt-dlp`, `deno`, `ffmpeg` sidecars (`tauri.conf.json:50-54`) |
| Document ingestion | Add PDF/txt/md/csv/json/web | Drag-drop / add-source modal | `add_source_file`, `add_source_website`, `add_source_image`, `extract_text_from_file` (`lib.rs:1557`) | `pdf_extract` crate |
| Embeddings / RAG | Local semantic search | Search & grounded chat | `embed_texts`, `embed_transcript`, `embed_source`, `search_segments`, `search_source_chunks` (`lib.rs:1326,2892,3043,2944,3109`) — calls local Ollama `nomic-embed-text` via curl→`127.0.0.1:11434` | bundled Ollama daemon |
| Chat / LLM | Ask questions over corpus | Chat panel, agent panel | Frontend `providers.ts` + `lib/agents/providers/*` — **direct browser→cloud API calls** | `@anthropic-ai/sdk` (`dangerouslyAllowBrowser`), fetch to OpenAI/Groq/Gemini/etc. |
| Deep Research | Multi-step web research | "Deep Research" | `deepResearch.ts:25` → **Groq API** + `web_search` (`db.ts:459`→`lib.rs:4233` Brave scrape) | Groq, Brave Search HTML scrape |
| Web search | Web grounding | Search | `web_search` (`lib.rs:4233`) scrapes `search.brave.com` HTML via curl | — |
| Browser view / YouTube view | Embedded webview | In-app browser & player | `browser_view.rs`, `youtube_view.rs` (child webviews) | Tauri webview |
| IDE / workspace | Read-only code browse + git | File tree, git status/diff | `list_directory`, `read_file_text`, `read_workspace_file`, `workspace_git_status/diff` (`lib.rs:1693-2007`) | system `git` |
| Tasks / notes / bookmarks / artifacts | Knowledge mgmt | Panels | SQLite-backed commands | `rusqlite` |
| Auth / subscription | Login + paywall | `AuthGate` | Supabase (`supabase.ts`, `auth.ts`) | `@supabase/supabase-js` |
| Updater | Auto-update | Update dialog | `tauri_plugin_updater`, minisign pubkey (`tauri.conf.json:30-37`) | — |
| TTS | Speak responses | Voice loop | `speak_text` (`lib.rs:4713`) → macOS `say -v Samantha` | macOS `say` |
| Prompt library | Reusable prompts | Prompts panel | reads `~/MakeShipHappenCollective/ShipMindPrompts/` (`lib.rs:357-486`) | filesystem |

**AI providers (chat, user-key, cloud):** Anthropic, OpenAI (+ chatgpt/codex/shipcode aliases → `api.openai.com`), DeepSeek, Perplexity, Groq, Google Gemini, OpenRouter, Manus (stored not wired), `nano-banana` (image). Embeddings/transcription/TTS are **local** (Ollama / whisper-rs / `say`). `providers.ts:10-22`, `secrets.rs:6-19`.

**External services:** provider APIs above; Supabase (`gvhbhoicvvoezjjartrt.supabase.co`); `makeshiphappen.tech` (updater endpoint + login + iframe); `huggingface.co` (whisper model download `lib.rs:2119`); `ollama.com` registry (embedding model pull); `search.brave.com` (scrape); YouTube (via yt-dlp).

**Auth method:** Supabase email/password + browser-login deep link (`auth.ts:83-96`). Client-side tier gate (`AuthGate.tsx:129`) + hardcoded owner bypass (`owner.ts`).

**OS permissions / entitlements:** mic (`com.apple.security.device.audio-input`), `disable-library-validation`, `allow-jit`, `allow-unsigned-executable-memory`, `allow-dyld-environment-variables` (`entitlements.plist`). Tauri fs write allow-list scoped to `$HOME/**`, `$APPDATA/**`, `$APPLOCALDATA/**`, `$TEMP/**` (`capabilities/default.json:16-42`); global-shortcut, dialog, process, updater.

**Storage:** SQLite at `…/Application Support/com.makeshiphappen.shipmind/shipmind.db` (`lib.rs:773,5253`); audio/voice/youtube/models/backups/tmp/ollama-models subdirs; `config.json` (chmod 0600, `lib.rs:1081-1086`) holds provider/model prefs only; API keys in **macOS Keychain** (`secrets.rs`). Supabase stores auth session + `profiles` row (name/username/avatar/custom_instructions/tier).

### 1.2 MCP server (`shipmind-mcp/`)
Read-only stdio MCP over the ShipMind SQLite DB (`index.ts`). Tools: list_groups/transcripts/sources/notes/bookmarks/tags, get_transcript, read_source, search, stats. DB opened `readonly` (`index.ts:40`). External content wrapped in untrusted-data delimiters (`wrapUntrusted`, `index.ts:59`).

### 1.3 Chrome extension (`shipmind-extension/`)
MV3 context-menu "send link/page/selection to ShipMind". POSTs to `http://127.0.0.1:8765/ingest` with `Authorization: Bearer <token>` from `chrome.storage.local`; fallback `shipmind://add?...` deep link (`background.js:5,91,116`). Permissions: contextMenus, storage, notifications, tabs; host `http://127.0.0.1:8765/*` (`manifest.json:6-7`).

---

## 2. Data Flows

| Data | Origin → Destination | Cloud or local | Retention | Controls |
|---|---|---|---|---|
| Voice memo audio | mic→`getUserMedia`→`save_voice_audio` webm→ffmpeg WAV→whisper | **Local only**; STT in-process | webm/WAV deleted post-transcribe (`lib.rs:4614-4615`); transcript text → SQLite (persistent) | — |
| Imported audio | file→app `audio/` copy→WAV→whisper | **Local** | original copy kept indefinitely; WAV deleted | — |
| YouTube/media | URL→yt-dlp→app `youtube/`/`audio/` | downloads from YouTube (egress) | files kept | `validate_public_http_url` SSRF guard (`lib.rs:2394`) |
| Documents/PDF/web pages | file/URL→text→SQLite `sources` | **Local** ingest | persistent | website fetch via `fetch_url`→`validate_public_http_url` |
| Embeddings | text→curl→local Ollama `127.0.0.1:11434` | **Local** | stored as BLOB in SQLite | — |
| **Chat prompt + RAG excerpts** | frontend→**provider cloud API** | **CLOUD** when non-Ollama provider chosen | provider-controlled | TLS; key from Keychain |
| Web search | query→curl→`search.brave.com` | **CLOUD** (egress) | results→SQLite | — |
| Deep Research | →**Groq API** + Brave scrape | **CLOUD** | — | — |
| Auth/profile | →Supabase | **CLOUD** | Supabase-side | RLS (not verifiable here) |
| Telemetry/version | updater→`makeshiphappen.tech` | **CLOUD** (update check) | — | minisign-signed artifacts |

**Ingestion targets:** YouTube/web (yt-dlp, curl), PDF (`pdf_extract`), voice (whisper). `yt-dlp`, `ffmpeg`, `deno` are **bundled sidecars** (`tauri.conf.json:50-54`), invoked via `std::process::Command` with `--` arg-terminator hardening (`lib.rs:2438,2566`).

---

## 3. Security Findings

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| S-1 | **CSP allows `unsafe-eval` and `unsafe-inline` for scripts** in the main webview. Combined with rendering untrusted ingested content (web pages, PDFs, LLM output) this widens XSS→RCE-adjacent surface (webview can invoke Tauri commands). | **High** | `tauri.conf.json:26` |
| S-2 | **Broad fs write/copy allow-list `$HOME/**`** via tauri-plugin-fs. Any webview-side compromise can write anywhere under HOME (incl. shell rc, LaunchAgents). | **High** | `capabilities/default.json:16-42` |
| S-3 | **Hardened-runtime entitlements** `disable-library-validation` + `allow-unsigned-executable-memory` + `allow-jit` + `allow-dyld-environment-variables`. Needed for yt-dlp/Ollama but materially weakens the process (lets unsigned dylibs load; DYLD env honored). | **Medium** | `entitlements.plist` |
| S-4 | **No checksum/signature verification on model downloads** — whisper model from HuggingFace (`lib.rs:2119`) and Ollama embedding pull (`lib.rs:1191`) trusted on TLS alone. Updater *does* verify minisign. | **Medium** | `lib.rs:2100-2139`, `1165-1296` vs `tauri.conf.json:36` |
| S-5 | Cloud LLM keys sent **directly from the webview** (`dangerouslyAllowBrowser:true`, `anthropic-dangerous-direct-browser-access:true`). Any XSS in the renderer can read the in-memory key during a request and exfiltrate via the broad `connect-src`. | **Medium** | `providers.ts:145`, `agents/providers/anthropic.ts:54` |
| S-6 | Extension talks to a **local `:8765` ingest server that does not exist** in the app (no HTTP listener / no `shipmind://` scheme registered — only `stream://` is). Bearer token stored in `chrome.storage.local` (not encrypted). Feature appears non-functional; if a `:8765` server is added later, CORS `mode:'cors'` + localhost binding needs auth review. | **Medium** | `background.js:5,116`; `lib.rs:5280` (only `stream://`); no `8765` in app source |
| S-7 | Subscription/owner gate is **client-side only** (Supabase tier check + hardcoded `OWNER_EMAILS`). Trivially bypassable by editing local JS; not a data-confidentiality risk (data is local) but the paywall is not enforced. | **Low** | `AuthGate.tsx:129`, `owner.ts:3-6` |
| S-8 | `stream://` URI protocol can read **any on-disk file**, mitigated by a media-extension allow-list (blocks e.g. `.ssh/id_rsa`). | Low (mitigated) | `lib.rs:5280-5308` |

**Positive controls:** SSRF defense `validate_public_http_url` (scheme + loopback/private/link-local/cloud-metadata + DNS-rebind resolution check) with tests (`lib.rs:1809-1854,5601`); `is_sensitive_path` deny-list for IDE reads (`lib.rs:1863`); workspace path containment `ensure_path_inside` (`lib.rs:1766`); hardened `git -c core.hooksPath=/dev/null GIT_CONFIG_NOSYSTEM` (`lib.rs:1970`); `--` arg-termination on yt-dlp; API keys migrated plaintext→Keychain and config chmod 0600 (`lib.rs:2148,1081`); MCP DB readonly + prompt-injection wrapping.

---

## 4. Privacy Findings

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| P-1 | **Marketing "never leaves your machine" is contradicted by real cloud paths.** Cloud chat ships prompt **plus retrieved RAG excerpts of the user's documents** to OpenAI/Anthropic/Groq/Gemini/etc.; web_search egresses queries to Brave; Deep Research to Groq; Supabase receives auth + profile (incl. `custom_instructions`); updater pings makeshiphappen.tech. (Copy concedes "only the prompt text leaves" — but RAG excerpts *are* document text in the prompt.) | **High** | flows §2; `providers.ts`, `deepResearch.ts:25`, `db.ts:459`, `auth.ts:107` |
| P-2 | **No encryption at rest.** SQLite DB, copied source files, audio, and YouTube media sit unencrypted under Application Support; relies entirely on OS disk/file perms. Copy says "sealed shut"/"stay in." | **Medium** | `lib.rs:5253`; no SQLCipher/crypto in `Cargo.toml` deps |
| P-3 | **No in-app data export or bulk-deletion path observed.** Per-item deletes exist (`delete_source`, `delete_transcript`); no export/wipe-all command. GDPR/CCPA "export & delete" not provided in-app. | **Medium** | invoke handler list `lib.rs:5388-5503` |
| P-4 | Persistent ingest debug log writes file paths/sizes to `ingest_debug.log` (local) — minor metadata retention. | Low | `lib.rs:2740-2755` |
| P-5 | Supabase `profiles.custom_instructions` (user-authored, possibly sensitive) is stored cloud-side, not local — contradicts "private workspace stays local" for that field. | Low | `auth.ts:109,138` |

---

## 5. Liability / Legal

| ID | Finding | Severity |
|---|---|---|
| L-1 | **Regulated-data marketing.** Copy explicitly pitches "law firms, healthcare teams, finance, and government contractors," "attorneys, clinicians," FERPA-style education use, and claims "data doesn't cross your firewall" / "the answer to 'where does the data go?' has to be 'nowhere.'" The app ships RAG document excerpts to third-party LLM APIs when a cloud provider is selected, and stores data unencrypted at rest — creating HIPAA/attorney-client-privilege/FERPA/GLBA exposure if a regulated user relies on these claims. **Highest legal risk in the cluster.** | **High** — `docs/shipmind-product-copy.md:22,56,64-70,76` |
| L-2 | **Copyright — YouTube/web ingestion + scraping.** Bundled `yt-dlp` downloads YouTube audio/video (likely against YouTube ToS); `web_search` scrapes Brave Search HTML; `fetch_url` scrapes arbitrary sites. User-initiated, but the product bundles and markets the capability. | **Medium** — `lib.rs:2392,2486,4233,1588` |
| L-3 | **AI-output harm / no disclaimer in copy.** "Grounds every answer," "cited," "verifiable fact" framing for a RAG app that can hallucinate citations; no accuracy disclaimer in the marketing copy reviewed. | **Medium** — mockup `shipmind-product-page-mockup.html:306,73` |
| L-4 | **No LICENSE file** in `shipmind/`, `shipmind-mcp/`, or `shipmind-extension/` — IP/usage terms undefined for any distributed code. | Medium |
| L-5 | Bundled third-party binaries (ffmpeg, yt-dlp, deno, Ollama, whisper.cpp model) carry their own licenses (LGPL/GPL/Unlicense/MIT/Apache); no attribution/notice file observed in scope. | Low |

---

## 6. User-Responsibility Mapping

| Feature | If misused, responsible party | Clarity |
|---|---|---|
| Cloud LLM chat (sends doc excerpts) | **User** chooses provider & supplies key; **vendor** for misleading "never leaves" claim | Unclear — copy implies vendor guarantees locality |
| YouTube/web download | **User** (initiates) | Clear, but product bundles the tool |
| Web scraping / search | **User** initiates; product ships the scraper | Shared |
| Regulated-data use (PHI/PII/privileged) | **User/admin** in practice; copy shifts perceived responsibility to **vendor** | Unclear — marketing over-promises |
| IDE file read / workspace git | **User** (selects workspace) | Clear |
| Owner-bypass / free use | **Platform** (gate is client-side, unenforced) | Clear internally, opaque to user |

---

## 7. Marketing Claims (exposure)

Quoted with file:line:
- "without sending a single byte to the cloud" — `docs/shipmind-product-copy.md:13`. **Contradicted** by cloud chat/search/auth/updater.
- "nothing leaves the device to become searchable … no third-party processor reading your files" — `:32,46`. True for *embeddings/index*; misleading if read as covering chat.
- "only the prompt text leaves the machine, never the underlying documents" — `:54`. **Misleading** — RAG retrieval injects document passages into the prompt.
- "data doesn't cross your firewall … suits law firms, healthcare teams, finance, and government contractors" / "where does the data go? … 'nowhere'" — `:64-70`. **Highest exposure** (regulated industries).
- "Everything stays on your laptop" (education/unpublished research) — `:76`.
- "Local-first isn't a marketing claim. It's a verifiable fact." — `shipmind-product-page-mockup.html:306`; "No cloud sync unless you turn one on" `:315`; "Your private second brain … keeps it on your machine" `:106`. Also v2 editorial mockup `:466,476,258`.

---

## 8. Licenses / Deps / Secrets

- **LICENSE:** none present in any of the three packages (L-4).
- **Notable deps:** Rust — `rusqlite`, `whisper-rs`, `pdf_extract`, `keyring`, `hound`, `dirs_next`, tauri plugins (updater/process/dialog/fs/global-shortcut). Frontend — `@anthropic-ai/sdk`, `@supabase/supabase-js`, `zustand`, React/Vite. MCP — `@modelcontextprotocol/sdk`, `better-sqlite3`.
- **Bundled binaries:** `ffmpeg`, `yt-dlp`, `deno`, Ollama + `libggml-*` dylibs, whisper `ggml-base.en.bin` (downloaded).
- **Secrets observed:** `shipmind/.env` commits `VITE_SUPABASE_ANON_KEY` (anon JWT — public-by-design but committed) and Supabase URL (`.env:1-2`). **No private/service-role keys, no provider API keys committed** (grep clean). Provider keys live in Keychain at runtime. Hardcoded **owner emails** `zzgemsjewelry@gmail.com`, `aryah.yeasley@icloud.com` (`owner.ts:3-6`).
- Updater **minisign pubkey** embedded (`tauri.conf.json:36`) — good supply-chain control for app updates.

---

### Top remediations (priority)
1. Reconcile marketing vs. reality (L-1, P-1, S-? ) — qualify "never leaves your machine" to local-only mode; remove/soften regulated-industry & "firewall/nowhere" claims.
2. Tighten CSP (drop `unsafe-eval`; ideally `unsafe-inline`) (S-1) and narrow fs write allow-list below `$HOME/**` (S-2).
3. Add at-rest encryption option + in-app export/delete-all for the privacy positioning (P-2, P-3).
4. Add checksum/signature pinning for model downloads (S-4).
5. Add LICENSE + third-party NOTICE (L-4, L-5); remove or implement the dead `:8765`/`shipmind://` extension path (S-6).
