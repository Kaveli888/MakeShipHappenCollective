# 02 — Data Flow Audit (PHASE 2)

**Date:** 2026-06-07
**Constraint:** READ-ONLY synthesis. Only this file and `01-ecosystem-map.md` are written; no code/config changed. Independence: derived solely from dossiers 10–16 (did NOT consult `docs/audit/` or `docs/business-protection/`). All `file:line` citations preserved from those dossiers.

> **Master insight:** The repo is positioned as "local / private / sealed," but at least eight distinct data types cross to the cloud, and several do so **silently against the user's privacy choice** — most sharply ShipTalk Polish sending the full transcript to Anthropic *even on the Local Whisper engine*, ShipTalk browser-mode uploading raw session audio to OpenAI + Apple, ShipMind cloud chat shipping RAG document excerpts, and ShipWatch shipping captured screen/audio/clipboard to a chosen cloud provider or operator relay.

---

## Visual hierarchy

### Legend
`▣` local store · `☁` cloud/third-party · `⚠` egress that contradicts "local/private" positioning · `[BYO]` user's key · `[OP]` operator's key

### Flow 1 — User text / prompts
```
User input ─┬─► ShipMind chat ──► RAG retrieve from ▣SQLite ──► prompt+excerpts ──⚠──► ☁ provider [BYO] (10:58)
            ├─► ShipSpace mission/chat ──► +reference-file contents +operator directives ──► ☁ provider [BYO] (11:96)
            ├─► ShipCode CLI ──► tools/edits ──► ☁ provider [BYO] (14:30)
            └─► makeshiphappenAi /api/chat ──► ☁ provider [OP] (authed+rate-limited+usage-logged) (13:49)
```

### Flow 2 — Files / documents / code
```
File ─┬─► ShipMind ingest ──► text ──► ▣SQLite sources  ──(on cloud chat)──⚠──► ☁ RAG excerpts (10:56,58)
      ├─► ShipSpace ShipGang ──► generated code ──► ▣ write_file($HOME/$TMPDIR) shipgang-output/ ──► iframe preview (11:90-94)
      │                       └─ reference-file *contents* ──⚠──► ☁ provider (11:96)
      ├─► ShipCode ──► readFile/edit (cwd, path-escape latent) ──► ▣ disk (14:34, S-6)
      └─► ship-memory MCP ──► ▣ plaintext .md (read/write/HARD-DELETE) ──► any ☁ LLM connected (14:104,76)
```

### Flow 3 — Audio (mic / system)
```
Mic ─┬─ ShipMind voice ──► ffmpeg WAV ──► ▣whisper-rs (in-proc) ──► transcript ▣SQLite; audio deleted (10:53)
     ├─ ShipTalk Local Whisper ──► ▣whisper-rs; audio in-memory only (12:F1)
     ├─ ShipTalk OpenAI/Groq engine ──⚠──► ☁ api.openai/groq transcriptions [BYO] (12:F2,F3)
     ├─ ShipTalk Browser/Instant ──⚠──► ☁ Apple cloud STT  + (silent backup) ☁ OpenAI audio (12:F2,F4 / P2,P3)
     ├─ ShipTranscribe ──► ▣ffmpeg+whisper.cpp (fully local, no egress) (12:F11)
     ├─ ShipWatch mic ──► ffmpeg WAV ──► ▣whisper-cli ──► transcript ▣DB (7d file cleanup, transcript permanent) (14:68)
     ├─ ShipWatch system-audio (BlackHole, meetings) ──► ▣WAV ──► whisper ──► ▣DB  ⚠NO consent, bystanders (14:69)
     └─ ShipClick ──► ▣whisper-cli (voice task) (14:44)
```

### Flow 4 — Text / transcripts (post-STT)
```
Transcript ─┬─ ShipTalk ──► ▣localStorage shiptalk-history (unbounded, unencrypted) (12:F8)
            │            ├─► ☁ Supabase transcriptions (no purge) (12:F7)
            │            └─⚠─► ☁ Anthropic Polish (claude-haiku-4-5) — FIRES ON ALL ENGINES incl. Local Whisper (12:F5 / P1)
            ├─ ShipTalk ──► shiptalk-mcp ──► any ☁ LLM (NO auth) (12:F9 / S1)
            └─ ShipMind ──► ▣SQLite (10:53)
```

### Flow 5 — Screen captures / OCR (ShipWatch)
```
Screen (every 30s) ─► screencapture -x ─► ▣ screenshots/*.png (7d cleanup)
        └─► Vision/swiftc OCR ─► ▣ ocr_text table (searchable, PERMANENT — no row TTL) (14:66,P5)
        └─► base64 PNG ─► ▣ Ollama local vision (default)
                         └─(if provider≠Ollama)─⚠─► ☁ Anthropic/OpenAI/Google or ☁ ShipWatch Cloud relay [OP] (14:73,P6)
Clipboard (every 3s) ─► ▣ clipboard_history (PERMANENT) — only pw-manager heuristic skip (14:70,P3)
Browser URLs / app activity ─► ▣ activity_log (PERMANENT, ON by default) (14:71-72)
```

### Flow 6 — Logs / analytics / telemetry
```
ShipCode ──► user_id+event+metadata ──► ☁ Supabase usage_events (indefinite, no surfaced notice) (14:75,P8)
ShipCode / makeshiphappenAi ──► errors/stack ──► ☁ Sentry (13:52, 14:32)
makeshiphappenAi ──► usage_events rows (per chat) ──► ☁ Supabase (13:49)
Desktop apps ──► version check ──► ☁ makeshiphappen.tech updater (minisign-signed) (10:62, 11:21)
ShipTalk debug ──► ▣ /tmp/shiptalk-follow.log (geometry only, prod) (12:S6)
ShipMind debug ──► ▣ ingest_debug.log (paths/sizes) (10:P4)
```

### Flow 7 — Agent-to-agent comms (ShipSpace orchestrator)
```
renderer enqueue ─► ▣ axum MCP 127.0.0.1:<rand>/mcp/<terminal_id> (NO auth token) (11:S9)
   └─► claude worker pulls get_my_next_task ─► executes in worktree ─► report_result
        └─(if auto_merge ON)─► background squash-merge AI code into workspace branch (NO human review) (11:S8)
   workers stream structured output ──► ☁ provider API [BYO] (11:51)
```

### Flow 8 — Payments / PII (makeshiphappenAi)
```
Signup ──► ☁ Supabase Auth (email + pw hash)
Subscription checkout ──► /api/stripe/checkout ──► ☁ Stripe ──► webhook(sig-verified, idempotent) ──► ☁ Supabase profiles/subscriptions (13:47)
Merch checkout ──► cart(variantId+qty) ──► ☁ Stripe Checkout(collects shipping) ──► webhook ──► ☁ Printful order
        └─ buyer name + full shipping address + email ──► ☁ Printful (13:48)
CLI login ──► browser session ──► POST http://localhost:{port}/callback (ShipCode CLI) — tokens via query-param port (13:50)
ship-aos ──► ▣ ~/.ship-aos/stripe.json (LIVE sk_live_/rk_live_, chmod 600), NO auth on API routes (13:38, S1)
```

---

## Master flow table

| Data type | Origin | Destination(s) | Local / Cloud | Retention | Security controls | Responsible party |
|---|---|---|---|---|---|---|
| Mic audio (local STT) | ShipMind/ShipTalk/ShipWatch/ShipTranscribe/ShipClick | whisper-rs/whisper.cpp/whisper-cli in-proc/local | **Local** | audio file deleted post-transcribe (ShipMind 10:53; ShipTalk in-mem 12:F1); ShipWatch WAV 7d (14:68) | none needed (local) | App / user |
| Mic audio (cloud STT) | ShipTalk OpenAI/Groq, Browser/Instant; ShipWatch | ☁ OpenAI / Groq / Apple Speech | **Cloud ⚠** | provider policy | TLS; **no consent UX** (12:S5, 14:P4) | User + provider |
| Raw session audio (silent backup) | ShipTalk Browser mode | ☁ OpenAI `api.openai.com` | **Cloud ⚠ (undisclosed)** | OpenAI policy | none surfaced at engine choice (12:P2) | OpenAI |
| Transcripts (text) | ShipTalk / ShipMind / ShipWatch | ▣ localStorage / SQLite; ☁ Supabase; ☁ Anthropic Polish; MCP→any LLM | **Both ⚠** | local unbounded/unencrypted; Supabase no purge; transcript rows permanent (12:P4, 14:P5) | none (no redaction/encryption); Polish fires regardless of engine (12:P1) | User + Anthropic + Supabase |
| Documents / RAG excerpts | ShipMind ingest | ▣ SQLite sources; ☁ provider (when cloud chat) | **Both ⚠** | local persistent; provider-controlled | TLS; key from Keychain; no at-rest encryption (10:P2) | User + provider |
| Generated code | ShipSpace ShipGang | ▣ shipgang-output/ ($HOME/$TMPDIR); iframe preview | **Local** | persists until deleted; sessions JSON-exportable (11:97) | write_file confined; iframe `allow-scripts allow-same-origin` (S-12) | User + provider (output) + platform |
| Reference-file contents | ShipSpace mission | ☁ provider | **Cloud ⚠** | provider-controlled | **no secret scrubbing** (11:S11) | User + provider |
| Code / file edits | ShipCode, ship-memory | ▣ disk / `.md` vault; ship-memory→any LLM | **Local (egress via MCP)** | permanent; ship-memory delete is HARD delete (14:76) | ShipCode approval gate (path-escape latent S-6); ship-memory NO auth (S-7) | User + connected LLM |
| Screen captures + OCR | ShipWatch | ▣ PNG (7d) + ocr_text (permanent); ☁ provider/relay if non-Ollama | **Both ⚠** | PNG 7d; OCR rows permanent (14:P5) | idle/lock pause; blockedApps (empty default); **unencrypted** (14:65,P5) | User (+ bystanders, no consent) |
| Clipboard | ShipWatch (3s poll) | ▣ clipboard_history (permanent) | **Local** | permanent, no cleanup (14:70) | pw-manager heuristic skip only | User + clipboard authors |
| Browser URLs / app activity | ShipWatch | ▣ activity_log (permanent, ON by default) | **Local** | permanent | none beyond DB | User |
| Analytics / telemetry | ShipCode, makeshiphappenAi | ☁ Supabase usage_events; ☁ Sentry | **Cloud** | indefinite (14:P8) | only when signed-in; no surfaced notice (ShipCode) | Operator |
| Version / update check | all desktop apps | ☁ makeshiphappen.tech | **Cloud** | n/a | minisign-signed artifacts (10:62) | App |
| Agent-to-agent (orchestrator) | ShipSpace renderer/workers | ▣ 127.0.0.1:<rand> MCP; ☁ provider | **Local (+ provider for model)** | session | **no MCP auth token** (11:S9); auto-merge w/o review (S8) | Platform + provider |
| Auth / profile | all apps w/ Supabase | ☁ Supabase | **Cloud** | until deletion | RLS (unverified); anon key public-by-design (13:133) | Site + Supabase |
| Payments / PII | makeshiphappenAi checkout | ☁ Stripe → ☁ Supabase | **Cloud** | active account / Stripe policy | webhook sig-verify + idempotency; server-authoritative pricing (13:48,68) | Site + Stripe |
| Merch shipping PII | makeshiphappenAi merch | ☁ Stripe → ☁ Printful | **Cloud** | Printful policy | disclosed in privacy; no DPA page (13:P5) | Site + Stripe + Printful |
| Live Stripe secret key | ship-aos | ▣ ~/.ship-aos/stripe.json | **Local** | until deleted | chmod 600; **NO auth on API routes** → Critical if network-exposed (13:S1) | User |
| API / license keys | desktop apps | ▣ OS Keychain (good) / **plaintext localStorage (ShipWatch)** | **Local** | until deleted | Keychain (ShipMind/ShipSpace/ShipTalk/ShipCode); ShipWatch plaintext localStorage (14:S3) | App |

---

## Cloud-egress flows that contradict "local / private" positioning

| # | Flow | What leaks | Where it goes | Why it contradicts the claim | Evidence |
|---|---|---|---|---|---|
| C-1 | **ShipTalk Polish on Local Whisper** | full transcript text | ☁ Anthropic `claude-haiku-4-5` | Gate is cloud-on + anthropic-key + polish-mode, **independent of `selected-model`**; a user who picks "private, on-device" Local Whisper still ships text to Anthropic | `12:F5`, P1 (`FloatingOverlay.tsx:40-59`, `polish.ts:124-198`) |
| C-2 | **ShipTalk Browser-mode raw audio → OpenAI** | full session audio | ☁ `api.openai.com` (silent "backup recorder") | User picked the no-key "Browser" engine; raw-audio egress never surfaced at that choice | `12:P2` (`useVoiceCommands.ts:255-279,458-487`) |
| C-3 | **ShipTalk Browser-mode → Apple cloud STT** | raw audio | ☁ Apple speech servers (WKWebView `webkitSpeechRecognition`) | "Browser (Instant)" engine is cloud-backed; "All processing stays on your machine. Use Browser or Local Whisper" is misleading | `12:P3` (`SettingsView.tsx:446`, `Info.plist:7-8`) |
| C-4 | **ShipMind cloud chat → provider** | prompt + **RAG document excerpts** | ☁ Anthropic/OpenAI/Groq/Gemini/etc. | Copy: "only the prompt text leaves … never the underlying documents" — but RAG injects document passages *into* the prompt; "without sending a single byte to the cloud" | `10:P1`, `16:42-43` (`providers.ts`, `docs/shipmind-product-copy.md:13,54`) |
| C-5 | **ShipWatch captures → cloud provider / relay** | OCR'd screen text, transcripts, browser URLs | ☁ Anthropic/OpenAI/Google or ☁ ShipWatch Cloud relay [OP] | "all running locally on your Mac" is true only with Ollama; selecting any cloud provider sends captured surveillance data off-device | `14:73,P6`, marketing `14:159` (`ai.ts:626-695,569-611`, `OnboardingPage.tsx:89`) |
| C-6 | **ShipWatch Cloud relay raw upload** | chat-with-memories content | ☁ `api.shipwatch.app` → Anthropic [OP] | relay binds 0.0.0.0 with CORS-only gate; operator-billed; off-device | `14:74,S1` (`server/src/index.ts:95-98`) |
| C-7 | **MCP transcript/memory exposure** | all transcripts / entire second-brain | any ☁ LLM the user wires to shiptalk-mcp / ship-memory MCP | "private" dictation + personal notes leave the device to whatever model the MCP client uses; no auth/redaction | `12:P5,S1`, `14:S7` |

---

## Subprocessor / data-recipient list

| Recipient | Category | Data received | Reached by | Operator- or BYO-paid |
|---|---|---|---|---|
| **Anthropic** | AI provider | prompts, RAG excerpts, transcripts (Polish), code, captured-memory text, computer-use context | ShipMind, ShipSpace, ShipTalk(Polish), ShipWatch(+relay), ShipCode, ShipClick, ship-aos, makeshiphappenAi | BYO (apps) + Operator (makeshiphappenAi, ShipWatch relay) |
| **OpenAI** | AI provider | prompts, **raw session audio (ShipTalk backup)**, Whisper audio, code, captured text | ShipMind, ShipSpace, ShipTalk, ShipWatch, ShipCode, ship-aos, makeshiphappenAi | BYO + Operator |
| **Groq** | AI provider | prompts, Whisper audio, Deep Research queries | ShipMind, ShipSpace, ShipTalk, ShipCode (named in makeshiphappenAi ToS) | BYO |
| **Google (Gemini)** | AI provider | prompts, captured-memory text | ShipMind, ShipSpace, ShipWatch, ShipCode, makeshiphappenAi | BYO + Operator |
| **DeepSeek** | AI provider | prompts | ShipMind, ShipSpace, makeshiphappenAi | BYO + Operator |
| **Perplexity** | AI provider | prompts | ShipMind, ShipSpace, ShipCode | BYO |
| **OpenRouter** | AI provider (router) | prompts | ShipMind, ShipSpace, ShipCode (named in ToS) | BYO |
| **xAI** | AI provider | prompts | ShipSpace | BYO |
| **Apple Speech** | Cloud STT | raw mic audio | ShipTalk Browser engine | n/a (OS) |
| **Supabase** | Auth / DB | email, pw hash, profiles, custom_instructions, subscriptions, usage_events, transcripts, Stripe customer id | all apps w/ accounts | Operator |
| **Stripe** | Payments | email, payment method, Stripe customer id, (merch) name+address | makeshiphappenAi (+ ship-aos local key) | Operator |
| **Printful** | Fulfillment | buyer name, full shipping address, email | makeshiphappenAi merch | Operator |
| **Sentry** | Error telemetry | stack traces, device/app metadata | makeshiphappenAi, ShipCode | Operator |
| **Vercel** | Web host | request data | makeshiphappenAi | Operator |
| **Gumroad** | Licensing | license key validation | ShipWatch Cloud relay | Operator |
| **HuggingFace** | Model CDN | model download requests (no integrity check) | ShipMind, ShipTalk whisper models | n/a |
| **Brave Search** | Search (scrape) | search queries (HTML scrape) | ShipMind web_search + Deep Research | n/a |
| **YouTube / yt-dlp** | Media source | URL fetches (ToS-sensitive) | ShipMind ingestion | n/a |
| **ollama.com** | Model registry | embedding-model pull | ShipMind | n/a |
| **makeshiphappen.tech** | Updater / login | version checks, OAuth/CLI login | all desktop apps + ShipCode | Operator |
| **~/ShipMemory hub** | Shared local store | aggregated personal notes (cross-product) | ship-memory ↔ ShipSpace ↔ Claude clients | n/a (local) |
