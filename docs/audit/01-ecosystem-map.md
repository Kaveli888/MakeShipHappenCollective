# PHASE 1 — Ecosystem Inventory & Map

Consolidated from the per-cluster dossiers (`10`–`16`). Each product entry lists purpose, functionality, dependencies, integrations, AI providers, auth, permissions, storage, and data handled. "UNKNOWN" = not determinable from source.

---

## Ecosystem map (visual hierarchy)

```
MakeShipHappen brand (Jake Felton, solo founder) — makeshiphappen.tech
│
├── WEB / COMMERCE  (live, real users, payments)
│   ├── makeshiphappenAi/      Next.js site · Stripe billing · Supabase auth · Printful merch · AI chat broker · ShipCode cli-login
│   └── ship-aos/              Localhost-only single-user ops dashboard (port 3737, shell exec, live Stripe key)
│
├── DESKTOP APPS  (Tauri 2)
│   ├── ShipMind/              Local-first "second brain": ingest (audio/PDF/web/YouTube) → Whisper → Ollama RAG → cloud/local chat
│   ├── ShipTalk/              Voice-to-text dictation: local Whisper + cloud STT + cloud "Polish"; floating overlay; history
│   ├── ShipTranscribe/        Separate file-transcription app (lower risk)
│   ├── ShipSpace/             Agent IDE / "ShipGang" multi-agent orchestration; terminals; runs shell + edits files
│   └── ShipWatch/             Continuous screen/mic/audio/clipboard/app/URL capture → SQLite + OCR + vision + cloud chat
│
├── DEVELOPER DISTRIBUTION
│   ├── ShipCode/              Published npm CLI (shipcode-cli) · loopback login · Keychain · server-side tier verify · telemetry
│   └── ShipClick/             Voice → Whisper → Claude Code computer-use agent driving the physical Mac (bypassPermissions)
│
├── MEMORY / KNOWLEDGE
│   └── ship-memory/           Markdown-vault engine (core/mcp/connector-obsidian); shared hub ~/ShipMemory
│
├── MCP SERVERS  (expose app data to LLM agents)
│   ├── shipmind-mcp/          Read-only SQLite bridge over ShipMind data
│   ├── shiptalk-mcp/          Transcript/history + get_state_raw
│   ├── shipspace-mcp/         Workspace/chat/state read access
│   └── ship-memory/packages/mcp/   Read/write/delete over memory vault (stdio)
│
├── BROWSER
│   └── shipmind-extension/    Chrome MV3 extension (ingest hook → shipmind:// deep link)
│
└── ASSETS / MISC
    ├── MSH Logo/, Shipmind PP/, Shipmind Photos/   Brand assets
    ├── product-page mockups (*.html), docs/shipmind-product-copy.md   Marketing copy
    ├── flappy-bird.html + obstacles/score/sounds/ui.js   Standalone offline game (benign)
    ├── summarize_readme.sh   README→chatgpt CLI helper
    └── lighthouse-reports/, shipgang-output/, shipyard-os (stale/empty)
```

---

## AI providers used across the ecosystem

| Provider | Used by | Mode |
|---|---|---|
| **Anthropic (Claude)** | ShipTalk (Polish: claude-haiku-4-5), ShipMind (chat), ShipSpace (Claude API + Claude CLI), ShipWatch (cloud chat proxy), ShipClick (Claude Code) | Cloud |
| **OpenAI** | ShipTalk (whisper-1 STT), ShipSpace, makeshiphappenAi (chat broker), root summarize_readme.sh | Cloud |
| **Groq** | ShipTalk (whisper-large-v3-turbo STT), ShipSpace | Cloud |
| **Google (Gemini)** | ShipSpace, makeshiphappenAi (H-2 key now in header) | Cloud |
| **DeepSeek, xAI, Perplexity, Manus, nano-banana** | ShipSpace (provider modules) | Cloud |
| **Ollama (local)** | ShipMind (nomic-embed-text embeddings + chat), ShipWatch (vision) | Local |
| **Whisper (whisper.cpp / whisper-rs, local)** | ShipMind, ShipTalk, ShipTranscribe, ShipClick | Local |
| **CLI agents (Hermes, OpenClaw, codex, claude)** | ShipSpace, ShipClick | Local CLI |

---

## Per-product inventory

### ShipMind (lead GTM product)
- **Purpose:** Local-first private "second brain" / NotebookLM alternative; citation-grounded answers over the user's own sources.
- **User-facing:** Ingest YouTube/PDF/RSS/voice → transcribe → ask questions → grounded chat with citations; many output shapes.
- **Internal:** whisper.cpp transcription → Ollama embeddings/RAG → chat (local or cloud LLM). Bundles ffmpeg, yt-dlp, deno, Ollama. Minisign-signed updater. SSRF guard on egress.
- **Integrations/providers:** Ollama (local), Anthropic/OpenAI/Groq (cloud chat). **Dependencies:** Tauri, whisper-rs, SQLite. **Auth:** Supabase sign-in + paid subscription; AI keys in Keychain. **Permissions:** Tauri fs write `$HOME/**`, network (SSRF-guarded), mic. **Storage:** local SQLite + app data; `.env` (gitignored) anon key. **Data:** documents, audio, transcripts, embeddings — potentially privileged content. MCP bridge is read-only.

### ShipTalk + ShipTranscribe (voice)
- **Purpose:** Fast voice-to-text dictation with a floating overlay; optional cloud accuracy + "Polish".
- **User-facing:** Hold-to-talk / toggle; transcript pasted into the active app; local searchable history.
- **Internal:** mic → whisper.cpp (local, RAM-only audio) OR cloud STT (OpenAI/Groq, uploads audio) → optional Polish (Anthropic) → auto-paste via accessibility. Optional Supabase transcript sync.
- **Auth:** Supabase (optional; login view currently not mounted → runs as `local-user`); keys in Keychain. **Permissions:** mic capture, accessibility/input (auto-paste), filesystem. **Storage:** transcripts in localStorage + Supabase (forever). **Data:** raw audio, transcripts (highly sensitive). ACT_MODE = draft spec, not implemented.

### ShipSpace + ShipGang (agent IDE)
- **Purpose:** Multi-agent orchestration "Agent Development Environment"; agents Coordinator/Builder/Scout/Reviewer.
- **User-facing:** Chat with agents, run terminals, browse, manage workspaces; agents build/edit code and open PRs.
- **Internal:** Raw PTY shell access for agents (no validation layer); 9 cloud providers + CLI agents; ShipGang state object across 6 phases; auto-merge; auto-responder. `git_ops`, `worktree`, `github` modules.
- **Auth:** Supabase account + subscription gate (+ client-side owner bypass), Keychain keys, `gh` CLI. **Permissions:** shell/process spawn, filesystem (reads path-unconfined, writes hardened), network, pty, `withGlobalTauri`. **Storage:** Keychain, localStorage, logs, worktrees, ShipMemory hub. **Data:** code, chat, terminal output, API keys.

### ShipWatch (surveillance/memory)
- **Purpose:** Continuous capture of everything the user sees/hears for recall + AI chat.
- **Internal:** screen/mic/system-audio/clipboard/app-activity/browser-URL capture → local SQLite + files; OCR + Ollama vision + cloud chat via a Hono Anthropic proxy. **Server:** `/v1/chat`, Bearer-license + Gumroad auth, model allowlist, **exports `{port,fetch}` → default 0.0.0.0 bind**, browser-only CORS. **Storage:** local SQLite/files; keys in `localStorage`. **Data:** the most sensitive aggregate profile in the ecosystem.

### makeshiphappenAi (makeshiphappen.tech)
- **Purpose:** Marketing site + commerce + account system + AI chat broker + ShipCode login.
- **Integrations:** Stripe (billing, $50/mo live; $500 tier unpublished), Supabase (auth/db, RLS), Printful (merch fulfillment), Sentry (claimed), AI chat broker. **Auth:** Supabase email-confirm; owner gated on `email_confirmed_at`; comp-access tool (no auto-expiry). **Data:** email, name, payment (via Stripe), shipping address (Printful), account data, IPs. Prior Critical/High findings largely remediated in source.

### ship-aos
- Localhost-only single-user dashboard (port 3737): CSRF guard, command allowlist, 0600 key file, shell exec, **live Stripe key**. Safe locally; Critical if network-exposed.

### ShipCode (CLI)
- Published `shipcode-cli` v0.6.1 (MIT). Loopback login (random `state` + Origin/Referer checks), chmod-600 token/key + Keychain, **server-side tier verification**, telemetry → Supabase + Sentry (signed-in only). `runCommand`/`grepContent` exist but not AI-wired; edits approval-gated. Free-tier counter client-side.

### ShipClick
- Voice → Whisper → Claude Code computer-use agent running `claude -p --permission-mode bypassPermissions` while physically controlling the Mac. Guardrails are prose-only.

### ship-memory
- Markdown-vault engine (core = zero-dep, mcp, connector-obsidian). Plaintext notes; read/write/permanent-delete over MCP stdio; READONLY opt-in. Shared hub `~/ShipMemory`.

### MCP servers
- `shipmind-mcp` (read-only SQLite), `shiptalk-mcp` (transcripts + `get_state_raw`), `shipspace-mcp` (workspace/state), `ship-memory mcp` (read/write/delete). Common risk: expose personal data to any connected LLM with no allow-list/redaction.

### shipmind-extension
- Chrome MV3 extension; ingest hook. Targets a local `127.0.0.1:8765` server that does **not** exist in the Rust source — only the `shipmind://` deep-link fallback is real.

### Root scripts / assets
- `summarize_readme.sh` (stdin → chatgpt CLI, no injection), flappy-bird game (offline/benign), brand assets, marketing mockups (some with stale $20/$40 pricing), lighthouse reports.

---

See `02-data-flow-audit.md` for how data moves between these components.
