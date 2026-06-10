# Audit 10 — ShipMind Product Cluster

**Auditor:** Independent governance / security / privacy review (read-only).
**Date:** 2026-06-07
**Scope:** `shipmind/` (Tauri desktop app), `shipmind-mcp/` (MCP server), `shipmind-extension/` (Chrome extension), `ShipMindPrompts/`, `docs/shipmind-product-copy.md`.
**Method:** Source-only static review (Rust backend, React/TS frontend, manifest, MCP server, configs). Build artifacts skipped. No code modified.

> Note: ShipMind ships its own internal `shipmind/SECURITY_AUDIT_REPORT.md` (latest pass 2026-06-06). Where relevant this report cross-references and independently confirms its findings, and flags items that report itself marks as **still open**.

---

## PHASE 1 — INVENTORY

### Cluster overview
ShipMind is a **local-first AI "second brain"** desktop app: ingest audio/video/PDF/web/text sources, transcribe locally with whisper.cpp, embed and search them locally via Ollama, and chat over them ("citation-grounded research"). It bundles `ffmpeg`, `yt-dlp`, `deno`, and an Ollama daemon. Three satellites: an MCP server (read-only DB bridge for other AI clients), a Chrome extension (right-click "send to ShipMind"), and a prompt library folder.

| Module | Type | Purpose |
|---|---|---|
| `shipmind/` | Tauri 2 desktop (React 18 + Rust) | Main app: ingest → transcribe → embed → search → chat |
| `shipmind-mcp/` | Node MCP server (stdio) | Read-only SQLite bridge exposing the second brain to other AI clients |
| `shipmind-extension/` | Chrome MV3 extension | Send link/page/selection to local app via `127.0.0.1:8765` + `shipmind://` fallback |
| `ShipMindPrompts/` | Markdown prompt packs | Research prompt library loaded from `~/MakeShipHappenCollective/ShipMindPrompts/` |

### Notable features / modules (shipmind app)
- **Transcription** — `src-tauri/src/lib.rs` `convert_to_wav` (ffmpeg) → `run_whisper` (in-process whisper-rs, model `ggml-base.en.bin`). Fully local.
- **Source ingestion** — files (PDF via `pdf-extract`, text), websites (`fetch_url`/`add_source_website`), YouTube/media (`download_youtube_audio`, yt-dlp), Google Drive (`gdrive` source_type), web search (Brave scrape, `web_search` @ lib.rs:4233).
- **Embeddings / RAG** — `embed_texts` calls local Ollama `nomic-embed-text` @ `http://localhost:11434`; cosine similarity in Rust; chunks stored as BLOBs in SQLite.
- **Chat / agents** — `src/lib/providers.ts` multi-provider; `src/lib/agents/` defines a tool-calling agent with read-only tools (`src/lib/agents/tools.ts`).
- **IDE panel** — browses the user's filesystem (`list_directory`, `read_file_text`, `read_file_base64`) plus read-only `git status`/`diff`.
- **Embedded browser / YouTube webviews** — `browser_view.rs`, `youtube_view.rs`.
- **Auto-update** — Tauri updater pulling `https://makeshiphappen.tech/api/updates/shipmind/latest` (signed via minisign pubkey).
- **Voice** — `src/lib/voice/` browser SpeechRecognition / live dictation.

### Dependencies (key)
- **Rust** (`src-tauri/Cargo.toml`): `tauri 2`, `rusqlite` (bundled SQLite), `whisper-rs 0.16` (whisper.cpp, vendored `whisper-rs-sys-0.15.0`), `hound`, `pdf-extract 0.7`, `keyring 3` (OS keychain), `tauri-plugin-{fs,dialog,global-shortcut,process,updater}`, `objc2*` (macOS dock). **No `tauri-plugin-shell`** (removed; all shell-out is raw `std::process::Command`).
- **Frontend** (`shipmind/package.json`): `@anthropic-ai/sdk 0.39`, `@supabase/supabase-js 2`, `@tauri-apps/api 2`, `react 18`, `zustand 5`, `zod 3`, `mermaid 11`, `react-markdown`, `framer-motion`, `howler`, `@xyflow/react`.
- **MCP** (`shipmind-mcp/package.json`): `@modelcontextprotocol/sdk 1`, `better-sqlite3 11`, `zod 3`.

### AI providers (where configured)
- **Ollama** (local, default) — `src/lib/providers.ts` `OLLAMA_BASE = http://localhost:11434`; default chat model `gemma3:4b`; embeddings `nomic-embed-text` (lib.rs `EMBED_MODEL`).
- **Whisper** — local, in-process (whisper-rs / whisper.cpp), model `ggml-base.en.bin` downloaded from HuggingFace (lib.rs:2119).
- **Cloud (BYO key)** — Anthropic, OpenAI/ChatGPT/Codex/ShipCode, DeepSeek, Perplexity, Groq, Google Gemini, OpenRouter, Manus (storage only) — all in `src/lib/providers.ts` `PROVIDER_CONFIGS`.

### External services / network endpoints
- `http://localhost:11434` — local Ollama (chat, embed, pull, create, tags).
- `https://api.anthropic.com`, `https://api.openai.com`, `https://api.groq.com`, `https://generativelanguage.googleapis.com`, `https://openrouter.ai`, `https://api.perplexity.ai`, `https://api.deepseek.com`, `https://api.manus.ai` — cloud LLMs (only when user picks one + supplies key). CSP `connect-src` in `tauri.conf.json:26` allows the first six + `*.supabase.co` (DeepSeek/Manus reachable via Rust curl, not webview).
- `https://*.supabase.co` — auth + `profiles` table (tier/subscription).
- `https://makeshiphappen.tech` — auth web login, updater endpoint, signup.
- `https://huggingface.co/ggerganov/whisper.cpp/...` — whisper model download (lib.rs:2119).
- `https://search.brave.com/search` — scraped for `web_search` (lib.rs:4247).
- YouTube / arbitrary web URLs — via yt-dlp / curl fetch (SSRF-gated).
- `http://127.0.0.1:8765/ingest` + `/health` — **local ingest HTTP server the Chrome extension targets.** NOTE: no listener for port 8765 was found in `src-tauri/src/` — the extension always falls back to the `shipmind://` deep link; the documented `Settings → Browser Extension` token UI / server appears **UNKNOWN / not yet implemented in source**.

### Authentication
- **Account gate (hard):** `src/components/AuthGate.tsx` requires Supabase email/password sign-in AND a `pro`/`team` subscription tier (free tier is blocked from the whole app). Owner emails (`src/lib/owner.ts`: `zzgemsjewelry@gmail.com`, `aryah.yeasley@icloud.com`) bypass the subscription gate → `team`.
- **AI API keys:** stored in **OS keychain** via `keyring` (`src-tauri/src/secrets.rs`), service `com.makeshiphappen.shipmind[.beta/.dev]`. Legacy plaintext keys in `config.json` are migrated to keychain then stripped (lib.rs `migrate_legacy_keys`).
- **Supabase anon key:** in `.env` (gitignored), injected at build via Vite (`src/lib/supabase.ts`).
- **Extension:** bearer token (user-pasted, stored in `chrome.storage.local`).

### Permissions
- **Tauri capabilities** (`capabilities/default.json`): `core:window/webview create`, `dialog open/save`, `global-shortcut register`, and **`fs` write/copy/write-text scoped to `$HOME/**`, `$APPDATA/**`, `$APPLOCALDATA/**`, `$TEMP/**`**. The `fs` *read* permission was deliberately removed (reads go through hardened Rust IPC). No `shell` plugin.
- **macOS entitlements / Info.plist:** referenced (`entitlements.plist`, `Info.plist`) — mic entitlement for voice/recording presumed; file not in audited set (UNKNOWN exact entitlements).
- **Chrome extension** (`manifest.json`): `contextMenus`, `storage`, `notifications`, `tabs`; `host_permissions: http://127.0.0.1:8765/*`. No broad `<all_urls>` — minimal.
- **CSP:** restrictive `connect-src`/`frame-src` allowlist but retains `'unsafe-inline'` + `'unsafe-eval'` in `script-src`.

### Storage locations
- App data dir: `~/Library/Application Support/com.makeshiphappen.shipmind[.beta/.dev]/` (lib.rs `get_app_data_dir`).
  - `shipmind.db` (SQLite WAL) — transcripts, segments, sources, source_chunks (+embeddings BLOB), messages, notes, bookmarks, tasks.
  - `audio/` (downloaded/ingested audio), `models/` (whisper), `backups/` (`VACUUM INTO`), `tmp/`, `config.json` (0600, no longer holds keys), `ingest_debug.log`.
- Prompts: `~/MakeShipHappenCollective/ShipMindPrompts/`.
- Secrets: OS keychain. Supabase session: webview localStorage (`storageKey: shipmind-auth`).
- Cloud: only Supabase `profiles` row (tier, name, custom instructions) + whatever prompt text the user sends to a chosen cloud LLM.

### Data processed / user data
Documents (PDF/text/web), audio/voice recordings + transcripts (potential PII, privileged/medical/legal material per marketing), notes, bookmarks, chat history, embeddings, account email, filesystem contents browsed via IDE panel.

---

## PHASE 2 — DATA FLOW

| Flow | Origin → Destination | Leaves device? | Retention | Controls / responsible party |
|---|---|---|---|---|
| Audio/video ingest | local file/URL → ffmpeg → whisper-rs (in-proc) → SQLite | **No** (local transcription) | Persistent in `shipmind.db` until user deletes | Local-only; user responsible |
| Embeddings | source text → local Ollama `nomic-embed-text` → SQLite BLOB | **No** | Persistent | Local |
| Source content | PDF/web/text → `pdf-extract`/curl/strip_html → SQLite | **No** | Persistent | SSRF-gated for web (`validate_public_http_url`) |
| Web fetch / yt-dlp | user/LLM URL → curl/yt-dlp → device | Outbound fetch to that URL | Transient (file in `audio/`/`tmp/`) | `validate_public_http_url` blocks loopback/private/metadata; `--` arg terminator; `--proto`/`--max-redirs` |
| Web search | query → `search.brave.com` scrape | **Yes** (query → Brave) | None | Brave is 3rd-party; query leaves device |
| Chat (Ollama) | prompt+context → `localhost:11434` | **No** | None | Local |
| Chat (cloud LLM) | system prompt + checked source text + messages → provider API | **YES** (prompt + source excerpts leave device) | Provider-controlled | User chose provider + key; **this contradicts "documents never leave"** if sources are included in prompt |
| Auth / subscription | email/pwd → Supabase; tier read from `profiles` | **Yes** | Supabase | Supabase RLS (must be ON — see Phase 7) |
| Auto-update | updater → `makeshiphappen.tech/api/updates/...` | **Yes** | n/a | minisign signature `pubkey` verifies artifact |
| MCP server | local AI client (stdio) → reads `shipmind.db` **read-only** | **No** (but exposes all brain data to whatever MCP client connects) | n/a | No auth; any local process that can spawn it reads everything |
| Extension | right-click payload → `127.0.0.1:8765` (bearer) or `shipmind://` deep link | Local (loopback) | n/a | Bearer token; server endpoint not found in source |
| IDE panel | user/agent path → Rust reads file/dir | **No** (reads to webview) | n/a | `is_sensitive_path` deny-list only (not full containment) |
| Whisper model | HuggingFace download → `models/` | **Yes** (one-time download) | Persistent | Plain curl `-L` |

**Net: stays local** = transcription, embeddings, source storage, Ollama chat, MCP. **Leaves device** = chosen cloud-LLM prompts (incl. source excerpts), web search queries, Brave/YouTube fetches, Supabase auth, updater, model download.

---

## PHASE 3 — LIABILITY (raw material)

- **IP / copyright (HIGH exposure):** `download_youtube_audio` (yt-dlp) downloads and transcribes YouTube/streaming media; web ingest scrapes arbitrary sites; PDF ingest. App actively facilitates copying copyrighted media/text (YouTube ToS prohibits downloading; DMCA/circumvention risk). The `ShipMindPrompts/Research/` pack ("COMPETITOR GOAL / TIMELINE EXTRACTOR (YOUTUBE)", "COMPETITOR DOSSIER GENERATOR") explicitly steers users toward scraping competitor YouTube/web content. Responsibility falls on the user, but the tool is purpose-built for it.
- **Privacy / PII (HIGH):** Marketing targets lawyers (privileged discovery), clinicians (patient files → HIPAA), finance (term sheets). Voice recordings + transcripts of third parties may be captured without consent (two-party-consent states). If a user routes such content to a **cloud LLM**, the "never leaves" promise breaks and could expose privileged/PHI data.
- **Misuse:** IDE panel + agent `read_file`/`list_dir` can be steered (prompt injection) to read sensitive local files; web/SSRF surface; competitor-intelligence scraping prompts.
- **Reliability:** "citation-grounded / never fabricate" is enforced only by a system prompt (`create_shipmind_model`), not by the architecture — hallucinated citations are possible and could mislead professional users relying on accuracy.

## PHASE 4 — RESPONSIBILITY (raw material)

- **User:** supplies/owns ingested content, chooses cloud provider (and accepts that data leaves), supplies API keys, accepts copyright/consent risk of YouTube/web/voice capture.
- **Vendor (MakeShipHappen / Jacob Felton):** controls auto-updater (code-push channel), Supabase auth/tier, owner-bypass list, the bundled yt-dlp/ffmpeg/deno binaries (licensing + update hygiene), marketing claims, and Supabase RLS posture.
- **Third parties:** chosen LLM providers, Brave, YouTube, HuggingFace, Supabase.

---

## PHASE 7 — SECURITY (risk ratings, no fixes)

| Area | Finding | Rating | Justification |
|---|---|---|---|
| Secrets handling | No hardcoded LLM/service secrets in source; user keys in OS keychain; `config.json` 0600; `.env` (Supabase **anon** key only) gitignored & untracked | **Low** | Only publishable anon JWT ships; confirmed via grep + `git check-ignore` |
| Supabase RLS dependency | Client uses anon key + `profiles.update().eq('id', user.id)`; security depends entirely on RLS being ON server-side | **High (conditional)** | If RLS off/misconfigured, any user can read/modify others' profile/tier. Cannot verify server-side from repo |
| Owner subscription bypass | Hardcoded `OWNER_EMAILS` grant `team` (`src/lib/owner.ts`) | **Low** | Only specific creator emails; matches by confirmed Supabase email |
| Auth gate | Whole app gated behind sign-in + paid tier; client-side lockout (5 attempts/60s) | **Low** | Gate is client-side UX; real enforcement must be server-side (tier from Supabase) |
| Command execution | Many `std::process::Command` (ffmpeg, yt-dlp, deno, curl, git, open) — but **no `shell` plugin**, args passed as arrays (no shell string interpolation), URLs validated | **Medium** | No injectable shell string found; `open_url` scheme-restricted; git hardened (`GIT_CONFIG_NOSYSTEM` per internal report). Residual risk: bundled yt-dlp/deno run untrusted remote JS extractors |
| `codex:auto:danger` script | `package.json` `"codex:auto:danger": "codex --dangerously-bypass-approvals-and-sandbox"` + `agent:auto`/`codex:auto` | **Medium** | Dev-only npm scripts (not shipped in app), but encode a no-sandbox auto-approve coding agent; risk if run in repo with untrusted content |
| SSRF | `validate_public_http_url` blocks loopback/private/link-local/metadata incl. DNS-resolved IPs; applied to fetch + yt-dlp | **Low** | Strong, with IPv4-mapped/ULA handling and DNS-rebinding defense (lib.rs:1779-1854) |
| Tauri `fs` capability | Write/copy scope still `$HOME/**` (`capabilities/default.json`) | **Medium** | Per internal report M5 (still open): XSS/LLM-driven write can clobber `~/.ssh`, LaunchAgents, shell rc. Read removed (good) |
| IDE file read | `read_file_text`/`list_directory`/`read_file_base64` browse home dir; only an `is_sensitive_path` deny-list (ssh/aws/gpg/keychain/.env/pem) — "NOT a complete containment boundary" (its own comment) | **Medium** | Deny-list bypassable (e.g. non-listed secret files, browser profile DBs); reachable via prompt-injected agent tool call |
| Agent tool args | Not zod-validated before dispatch (internal report M4, open) | **Low** | All current tools read-only/path-contained; becomes High if a write/exec tool is added |
| CSP | Retains `'unsafe-inline'` + `'unsafe-eval'` in `script-src` (`tauri.conf.json:26`) | **Medium** | Enlarges XSS→IPC blast radius given every command is webview-callable |
| Mermaid render | `securityLevel:"strict"` (per internal report L2 fixed) | **Low** | LLM-authored diagrams sandboxed |
| Auto-updater | Signed (minisign pubkey in `tauri.conf.json`), HTTPS endpoint vendor-controlled | **Medium** | Code-push channel = vendor can ship any code to all users; signature mitigates MITM, not vendor compromise |
| MCP server | Read-only SQLite, **no authentication**; any local process can launch it and read the entire second brain; wraps external content in untrusted-data delimiters (good prompt-injection hygiene) | **Medium** | Local-only and read-only, but zero access control over highly sensitive corpus |
| Extension | Minimal perms, loopback host only, bearer token; but target server (`:8765`) not found in source | **Low** | If/when the local HTTP server is implemented, re-audit its auth/CORS |
| Embedded browser webview | `browser_view.rs`/`youtube_view.rs` scheme/host gated; `youtube_view` interpolates allowlisted `command` into eval'd JS (internal L4, latent) | **Low–Medium** | Host allowlist limits; JS interpolation latent not currently exploitable |
| Voice / mic | Audio captured, transcribed locally; recording of third parties possible | **Medium (privacy)** | Consent/PII exposure rather than code vuln |

---

## PHASE 8 — OPEN SOURCE / LICENSING

| Component | License | Concern |
|---|---|---|
| **whisper-rs 0.16 / whisper.cpp** (vendored `whisper-rs-sys-0.15.0`) | MIT (whisper.cpp + bindings) | Permissive — OK for commercial. Compiled statically into binary; MIT attribution required in distribution |
| **Whisper `ggml-base.en.bin` model** | MIT (OpenAI Whisper weights) | Permissive; downloaded from HuggingFace at runtime, not bundled |
| **ffmpeg** (bundled `externalBin`) | **LGPL or GPL depending on build** | **Distribution concern**: if the bundled ffmpeg was compiled with GPL components (e.g. `--enable-gpl`, x264/x265), the whole app distribution may inherit GPL obligations. Build flags UNKNOWN — must verify. LGPL build requires dynamic-link/relink offer + attribution |
| **yt-dlp** (bundled) | Unlicense (public domain) | Permissive. **Functional/ToS risk** (YouTube downloading), not license |
| **deno** (bundled) | MIT | Permissive |
| **Ollama** (bundled `ollama-bundle`) | MIT | Permissive; but bundled **models** pulled at runtime carry their own licenses (`nomic-embed-text` Apache-2.0; `gemma3` **Gemma license** — use restrictions; Llama models **Meta Llama Community License** — not OSI, has acceptable-use + >700M MAU clause) |
| `@anthropic-ai/sdk`, supabase-js, react, zustand, zod, framer-motion, howler, @xyflow/react, lucide-react | MIT / Apache-2.0 | Permissive |
| **mermaid 11** | MIT | Permissive; internal report notes a reachable advisory — `npm audit fix` recommended |
| `better-sqlite3`, `@modelcontextprotocol/sdk` (MCP) | MIT | Permissive |
| `pdf-extract`, `rusqlite` (bundled SQLite), `keyring`, `hound`, `objc2*` | MIT/Apache-2.0 / SQLite public domain | Permissive |

**Top OSS flags:**
1. **ffmpeg GPL/LGPL** — biggest copyleft exposure; verify the bundled binary's build config before commercial distribution.
2. **Bundled Gemma/Llama model licenses** — not OSI; carry acceptable-use + redistribution terms that a commercial product must honor.
3. **No `node_modules`/`Cargo` license aggregation / NOTICE file** observed in scope — attribution obligations (MIT/Apache notices, whisper.cpp) should be compiled for distribution.

---

## PHASE 9 — MARKETING CLAIMS (verbatim) vs reality

Source: `docs/shipmind-product-copy.md` + `src/components/AuthGate.tsx` ("Subscription Required").

| Claim (verbatim) | Risk |
|---|---|
| "ShipMind is a private AI workspace that reads, searches, and reasons across your documents **without sending a single byte to the cloud**." | **HIGH.** Absolute. False whenever the user selects a cloud LLM (Anthropic/OpenAI/Groq/etc.) — prompt + source excerpts are sent to that provider. Also Supabase auth, updater, Brave search, HuggingFace model download, yt-dlp all send bytes. Overstatement could be deemed deceptive (FTC) and is dangerous for the regulated audiences targeted. |
| "**Your documents never leave your Mac.**" / "only the prompt text leaves the machine, **never the underlying documents**." | **HIGH.** RAG injects retrieved source chunks into the prompt; with a cloud model, document content (verbatim excerpts) leaves the machine. The "prompt text not documents" distinction is misleading because the prompt *contains* document content. |
| "There is **no third-party data processor touching your document content** ... data doesn't cross your firewall." / "the answer to 'where does the data go?' has to be '**nowhere**.'" | **HIGH.** Directly aimed at "law firms, healthcare teams, finance, government contractors." Cloud-LLM mode introduces a third-party processor; Supabase is a third-party processor for account data. Marketing HIPAA/privilege-adjacent compliance ("audit-friendly by construction") without a BAA or local-only enforcement is significant legal exposure. |
| "**Audit-friendly by construction**" / "Legal & Compliance" | **MEDIUM–HIGH.** Implies compliance posture not substantiated by controls; no DPA/BAA mentioned; cloud path undercuts it. |
| "**Bundled Ollama embeddings, fully offline**" (Free tier) | **MEDIUM.** Embeddings yes; but app requires **online Supabase sign-in + paid subscription** to even open (AuthGate blocks free tier entirely) and downloads models on first run — "fully offline" is not true end-to-end, and contradicts the "Free / $0 / fully offline" pricing card vs the hard subscription gate. |
| "API keys live in the macOS keychain — **not localStorage, not a config file**" | **LOW (accurate).** Confirmed: keychain via `keyring`; legacy config keys migrated out. Supabase *session* token is in localStorage, but that's not an AI API key. |
| "citation-grounded ... **never fabricate information**" / "cites them back to the source" | **MEDIUM.** Enforced only by system prompt, not architecture; tool-calling silently no-ops on some providers (internal report L1) so the grounding guarantee can fail. Professional reliance on possibly-hallucinated citations is a liability. |

**Headline risk:** The entire value proposition ("sealed shut", "without sending a single byte to the cloud", "documents never leave", "nowhere") is marketed as **absolute privacy to regulated professionals**, while the product ships first-class cloud-LLM chat that transmits document content. This is the cluster's single largest legal/privacy exposure.

---

## TOP 5 RISKS

1. **Marketing overclaim vs cloud-LLM reality (Privacy/Legal — Critical).** "Without sending a single byte to the cloud" / "documents never leave your Mac" / "nowhere," sold to lawyers/clinicians/finance, is false in cloud-chat mode (RAG sends source excerpts to Anthropic/OpenAI/Groq). Deceptive-practice + privilege/HIPAA exposure. Needs prominent qualification or a true local-only mode.
2. **Supabase RLS dependency (Auth — High, unverifiable from repo).** Anon-key client performs `profiles` reads/updates keyed on `user.id`; if Row-Level Security isn't enforced server-side, tier/subscription and profile data are tamperable across users. Must confirm RLS ON for all tables.
3. **Copyright/ToS-facilitating ingestion (Liability — High).** Bundled yt-dlp + web scraping + competitor-research prompt packs purpose-build YouTube/web content copying; DMCA/ToS/IP exposure shifted to users but tool-enabled by design.
4. **ffmpeg GPL/LGPL distribution risk + non-OSI bundled model licenses (OSS — High).** Bundled ffmpeg build flags unverified (possible GPL contamination of a commercial product); Gemma/Llama model licenses carry acceptable-use/redistribution terms. Verify build config and ship a NOTICE/attribution bundle.
5. **Webview→IPC blast radius (Security — Medium-High).** Every Rust command is callable from the webview; `'unsafe-inline'`/`'unsafe-eval'` CSP + `$HOME/**` fs-write scope + deny-list-only IDE file reads mean an XSS or prompt-injected agent tool call can write to sensitive home paths or read non-deny-listed secrets. (Internal report M4/M5/L5 still open.)

---

## Positive findings (credit where due)
- No leaked service/LLM secrets; keys in OS keychain; `.env` gitignored.
- Strong, well-reasoned SSRF defense (DNS-rebinding-aware) on all backend egress.
- `shell` plugin removed; all process spawns use arg-array form (no shell injection).
- MCP server is read-only and wraps external content in explicit untrusted-data delimiters (good indirect-prompt-injection hygiene).
- Signed auto-updater (minisign).
- Active internal security program (`shipmind/SECURITY_AUDIT_REPORT.md`, 2026-06-06) with most High/Medium issues already fixed.
</content>
</invoke>
