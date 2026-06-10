# Audit v2 — Phase 6: Privacy Review

**Date:** 2026-06-07
**Method:** READ-ONLY synthesis. Derived solely from the audit-v2 cluster dossiers (10–16); did NOT consult `docs/audit/` or `docs/business-protection/` (independence). No code was modified, created, or deleted other than this review file.
**Disclaimer:** This is **not legal advice.** Privacy/regulatory characterizations and severity ratings are the auditor's judgment based on source-derived evidence. Each finding carries an upstream `file:line` citation preserved from the source dossiers.

---

## 1. Scope of products reviewed

| App | Type | Cluster dossier |
|---|---|---|
| ShipMind (+ shipmind-mcp, shipmind-extension) | Tauri "second brain" / RAG | 10 |
| ShipSpace (+ shipspace-mcp) | Tauri agent dev environment | 11 |
| ShipTalk (+ shiptalk-mcp) | Tauri voice-to-text | 12 |
| ShipTranscribe | Tauri local file transcription | 12 |
| makeshiphappenAi (makeshiphappen.tech) | Next.js web/commerce | 13 |
| ship-aos | Local Next.js dashboard | 13 |
| ShipWatch | Tauri continuous-capture "second memory" | 14 |
| ShipCode | Node coding CLI | 14 |
| ShipClick | Bash computer-use agent | 14 |
| ship-memory | Markdown "second-brain" engine + MCP | 14 |

---

## 2. Data collected

- **Voice / audio:** ShipMind (voice memos, imported audio, YouTube/media audio), ShipTalk (raw mic audio, 4 engines), ShipTranscribe (imported media audio), ShipWatch (mic + system/meeting audio via BlackHole), ShipClick (mic via ffmpeg). ShipWatch and ShipTalk-Browser can capture **bystander/third-party voices** (`12 §5`; `14 P-2`).
- **Screen / visual:** ShipWatch screenshots every 30s + OCR'd on-screen text + per-app/window activity + browser URLs (`14 P-1`); ShipClick reads screenshots of whatever is on screen (`14 S-5`).
- **Clipboard:** ShipWatch polls `pbpaste` every 3s into `clipboard_history` (`14 §2`).
- **Documents / files:** ShipMind ingests PDF/txt/md/csv/json/web pages/images (`10 §1.1`); ShipSpace ingests reference-file contents, terminal scrollback, browser page context, GitHub issue bodies (`11 §2.4`); ShipCode reads project files.
- **Derived text:** transcripts (raw + polished), embeddings, OCR text, RAG excerpts, custom dictionary terms.
- **Account / identity:** email + password hash (Supabase) across ShipMind/ShipSpace/ShipTalk/makeshiphappenAi/ShipCode; Stripe customer id; profile fields incl. `custom_instructions` (`10 P-5`); merch buyer name + full shipping address + email (`13 §2`).
- **Usage / telemetry:** makeshiphappenAi `usage_events`; ShipCode `usage_events` + Sentry; ShipSpace/ShipMind/ShipTalk updater version pings; Sentry stack traces.

## 3. Data stored

- **Local plaintext, unencrypted at rest (the dominant pattern):**
  - ShipMind: SQLite DB + copied source files + audio + YouTube media under Application Support (`10 P-2`, `lib.rs:5253`); config.json chmod 0600 (prefs only); `ingest_debug.log` (`10 P-4`).
  - ShipTalk: `localStorage` `shiptalk-history` (unbounded), settings, polish prompts (`12 P-4`).
  - ShipWatch: SQLite `shipwatch.db` + `screenshots/*.png` + `audio/*.wav` + `system_audio/*.wav`, all unencrypted (`14 §1.1`, `db.ts:9`). API keys + license key in plaintext `localStorage` (`14 S-3`).
  - ShipSpace: zustand stores in WebView `localstorage.sqlite3`, `shipgang-output/`, logs under `~/Library/Logs/ShipSpace/` (`11 §4`).
  - ship-memory: plaintext `.md` files in `.shipmemory/` hub; shared `~/ShipMemory` aggregates across products (`14 P-7`).
  - ShipCode: `~/.shipcode/usage.json`, `keys.json` (chmod 600), session file.
- **Secrets at rest (good pattern):** provider API keys in **OS Keychain** for ShipMind, ShipSpace, ShipTalk, ShipCode (`15 Part C`). Exception: **ShipWatch stores keys in plaintext localStorage** (`14 S-3`).
- **Cloud-side:** Supabase Postgres — `profiles`, `subscriptions`, `transcriptions`, `dictionary_terms`, `usage_events`, etc. ShipTalk `transcriptions` table is **insert-only with no purge logic** (`12 F7`, `12 P-4`). makeshiphappenAi security relies on RLS (not verifiable from source; `13 §8`).

## 4. Data transmitted

| Destination | What is sent | From |
|---|---|---|
| Anthropic | RAG doc excerpts + prompts; **full transcripts via Polish** even when local engine selected; mission prompts, code, terminal scrollback | ShipMind, ShipTalk (`12 P-1`), ShipSpace, ShipWatch, makeshiphappenAi |
| OpenAI | prompts/audio; **full session audio via Browser-mode backup recorder** | ShipMind, ShipTalk (`12 P-2`), ShipSpace, ShipWatch, makeshiphappenAi |
| Groq | mic audio (3s chunks), prompts, Deep Research | ShipMind, ShipTalk (`12 F3`), ShipSpace |
| Google Gemini | prompts/memories | ShipMind, ShipSpace, ShipWatch, makeshiphappenAi |
| DeepSeek / Perplexity / OpenRouter / xAI | prompts | ShipMind, ShipSpace |
| Apple/WebKit cloud STT | **raw mic audio** (Browser engine) | ShipTalk (`12 P-3`) |
| Brave Search | search queries (HTML scrape) | ShipMind (`10 §2`) |
| Supabase | auth + profile + transcripts + usage | most apps |
| Stripe | payment + customer data | makeshiphappenAi, ship-aos |
| Printful | buyer name + full shipping address + email | makeshiphappenAi (`13 §2`) |
| Sentry | stack traces / device metadata | makeshiphappenAi, ShipCode |
| HuggingFace | model download fetch (no PII) | ShipMind, ShipTalk |
| makeshiphappen.tech | updater version pings | desktop apps |
| Any connected LLM (MCP, no auth) | **all transcripts / all notes / all app state** | shiptalk-mcp (`12 S-1`), ship-memory (`14 S-7`), shipspace-mcp, shipmind-mcp |
| ShipWatch Cloud relay | captured screen/audio-derived memories → Anthropic via operator key | ShipWatch (`14 §2`) |

**No secret-scrubbing/redaction exists** on the untrusted-content → cloud-provider paths in ShipSpace (terminal scrollback, browser context, issue bodies, reference files) — a `.env`/key visible in a terminal is sent verbatim (`11 S-11`, `11 §2.4`).

## 5. Data retention needs

| App | Today | Gap |
|---|---|---|
| ShipMind | source files/audio/media kept indefinitely; transient WAV/webm deleted post-transcribe | no retention policy; no at-rest encryption |
| ShipTalk | `shiptalk-history` unbounded; Supabase `transcriptions` insert-only, **no purge** | survives reinstall (`12 P-4`) |
| ShipWatch | PNG/WAV files cleaned at 7d default; **DB rows (clipboard, activity, transcripts, OCR) never age-cleaned** | searchable archive grows forever (`14 P-5`) |
| ShipSpace | outputs/sessions persist until user deletes; no provider-data retention controls | no "delete all" path (`11 §4`) |
| ship-memory | permanent; delete is a hard delete | no versioning/retention |
| makeshiphappenAi | retained while account active; manual deletion "within 30 days" promised | manual-only, unstaffed-risk (`13 P-1`) |

## 6. User deletion requirements

- **Per-item delete exists** in ShipMind (`delete_source`, `delete_transcript`) and ship-memory (hard `delete_memory`).
- **No bulk "delete all my data" / account-wipe path** observed in ShipMind (`10 P-3`), ShipSpace (`11 §4`), ShipTalk (no delete UI; `12 P-4`), or ShipWatch (manual delete only; `14 L-3`).
- **makeshiphappenAi:** Privacy Policy and Terms promise account deletion, but **no implementing API route exists** — fulfillment is manual email only (`13 P-1`).
- **Local files persist after account deletion** by design and this is disclosed (`13 §6`), but there is no in-app tool to wipe the local archive.

## 7. User export requirements

- **ShipSpace:** ShipGang sessions export/import as JSON (`11 §4`, `engine.ts:317-359`) — partial, feature-specific only; no whole-account export.
- **ShipMind:** no export/bulk-extraction command observed (`10 P-3`).
- **ShipTalk / ShipWatch / ship-memory:** no export UI (ship-memory data is already plaintext `.md` the user can copy; not a product feature).
- **makeshiphappenAi:** Privacy Policy promises JSON export, but **no implementing route exists** — manual email only (`13 P-1`).

---

## 8. Master table — per app

| App | Data collected | Stored where | Transmitted to whom | Retention today | Encryption at rest | Deletion supported? | Export supported? |
|---|---|---|---|---|---|---|---|
| **ShipMind** | voice, audio, YouTube/media, docs/PDF/web, embeddings, RAG excerpts; Supabase profile incl. custom_instructions | local SQLite + files (plaintext); keys in Keychain; Supabase profile | Anthropic/OpenAI/Groq/Gemini/DeepSeek/Perplexity/OpenRouter (cloud chat); Brave; Supabase; updater | source/audio/media indefinite; transient WAV deleted | **N** (`10 P-2`); keys **Y** (Keychain) | per-item only; **no bulk/wipe** (`10 P-3`) | **No** (`10 P-3`) |
| **shipmind-mcp** | exposes ShipMind DB | reads ShipMind SQLite (readonly) | any connected LLM | n/a | inherits | n/a | n/a (read API) |
| **ShipSpace** | prompts, reference-file contents, terminal scrollback, browser context, GitHub issue bodies, code | localStorage SQLite + `shipgang-output/` + logs (plaintext); keys in Keychain (transiently in renderer mem) | Anthropic/OpenAI/Google/Groq/DeepSeek/xAI/Perplexity; Supabase; updater | persist until user deletes | **N** for app data; keys **Y** (Keychain) | per-item; **no "delete all"** (`11 §4`) | **Partial** — ShipGang JSON only (`11 §4`) |
| **shipspace-mcp** | app state (workspaces/chats/settings/prompts/runs) | reads localStorage SQLite (readonly) | any connected LLM (no per-call auth) (`11 S-10`) | n/a | inherits | n/a | n/a |
| **ShipTalk** | raw mic audio, transcripts (raw+polished), stats, dictionary | `localStorage` (plaintext, unbounded); Supabase `transcriptions` (insert-only); keys in Keychain | OpenAI, Groq, **Anthropic (Polish)**, **Apple cloud STT**, Supabase | **unbounded, no purge**, survives reinstall (`12 P-4`) | **N** (`12 P-4`); keys **Y** (Keychain) | **No** delete UI found (`12 P-4`) | **No** |
| **shiptalk-mcp** | all transcripts + all localStorage keys | reads ShipTalk `localstorage.sqlite3` | **any connected LLM, no auth** (`12 S-1`) | n/a | inherits | n/a | n/a |
| **ShipTranscribe** | imported media audio, transcripts | local app store + local files | **None** (no cloud egress) (`12 §1.2`) | local | **N** (local files) | local file delete | local files |
| **makeshiphappenAi** | email, pwd hash, Stripe id, usage_events, support email, merch name/address/email | Supabase Postgres; Stripe; Printful | Stripe, Supabase, Printful, Sentry, AI providers (server-paid) | while account active; manual delete "30 days" | **Supabase-managed** (cloud); unverifiable RLS (`13 §8`) | **Promised, no route** — manual email (`13 P-1`) | **Promised, no route** (`13 P-1`) |
| **ship-aos** | journal/goals/memory/kanban; live Stripe key | local; `~/.ship-aos/stripe.json` chmod 600 | localhost CLI agents; provider APIs | local | partial (chmod) | local | none |
| **ShipWatch** | screen, OCR text, clipboard, mic, system/meeting audio, browser URLs, app activity | SQLite + PNG + WAV (all **plaintext**); keys + license in **plaintext localStorage** | Ollama (local) OR Anthropic/OpenAI/Gemini/ShipWatch-Cloud relay | files 7d; **DB rows never cleaned** (`14 P-5`) | **N** (`14 P-5`); keys **N** (`14 S-3`) | manual per-item only (`14 L-3`) | **No** |
| **ShipCode** | project files, prompts, usage | `~/.shipcode/` (keys chmod 600 + Keychain) | provider APIs (BYO); Supabase usage; Sentry | usage indefinite server-side | keys **Y** (chmod/Keychain) | local | none |
| **ShipClick** | mic audio, screenshots | transient (in-loop) | Claude (local subscription) | transient | n/a | n/a | n/a |
| **ship-memory** | personal notes (markdown) | plaintext `.md` in hub; shared `~/ShipMemory` | **any connected LLM, no auth** (read/write/**delete**) (`14 S-7`) | permanent; hard delete | **N** (`14 P-7`) | hard delete via MCP (unauth!) | plaintext files |

---

## Documented-vs-actual inconsistencies

Each item flags where actual code behavior contradicts documented/marketed/promised privacy posture.

| # | Documented / marketed promise | Actual code behavior | Evidence | Severity |
|---|---|---|---|---|
| DI-1 | ShipMind: "without sending a single byte to the cloud" / "Your documents never leave your Mac" / "sealed shut" / "Your data never leaves your machine" | Cloud chat ships **RAG excerpts of the user's documents** + prompts to OpenAI/Anthropic/Groq/Gemini/etc.; web_search egresses to Brave; Deep Research to Groq; Supabase receives profile incl. `custom_instructions`; updater pings makeshiphappen.tech | `docs/shipmind-product-copy.md:13,44,116`; `16` Cat 1; `10 P-1`; `11`/`providers.ts`; `10 P-5` | **High** |
| DI-2 | ShipTalk: "On-device Whisper — free, private" / per-engine "private" label | **Polish ships the full transcript to Anthropic even when the user selected Local Whisper** (gate is cloud-on + key + polish-mode, independent of engine) | `12 P-1` (`FloatingOverlay.tsx:40-59`, `polish.ts:124-198`); `SettingsView.tsx:91` | **Critical** |
| DI-3 | ShipTalk: "All processing stays on your machine. Use Browser or Local Whisper with no API key." | **Browser ("Instant") mode silently uploads FULL session audio to OpenAI** via a backup recorder, and **routes raw audio to Apple's cloud speech servers** | `12 P-2` (`useVoiceCommands.ts:255-279,308-343`), `12 P-3`; `SettingsView.tsx:446` | **Critical** |
| DI-4 | ShipWatch: "all running locally on your Mac" | Selecting Anthropic/OpenAI/Gemini or ShipWatch Cloud sends captured **screen/audio/OCR-derived memories off-device** | `14 §7` (`OnboardingPage.tsx:89`, `ai.ts:626-695,569-611`); `14 P-6` | **High** |
| DI-5 | makeshiphappenAi Privacy Policy: users have Access / Export (JSON) / Delete rights; Terms: "delete your account at any time" | **No implementing API route exists** for export, delete, or account-wipe; fulfillment is manual email only ("within 30 days") | `13 P-1` (`app/privacy/page.tsx:75-88`, `app/terms/page.tsx:154`; grep for delete/export/gdpr returns nothing) | **High** (regulatory) |
| DI-6 | "ferpa-safe" / "privilege-safe" / "compliance story short: data doesn't cross your firewall … suits law firms, healthcare teams, finance, government contractors" | Product egresses content to third-party cloud LLMs and stores data **unencrypted at rest**; no BAA/SOC2/FERPA certification exists | `16` Cat 2 (`BuiltForVisuals.tsx:392`, `BuiltFor.tsx:28`, `docs/shipmind-product-copy.md:68`); `10 L-1` | **Critical** |
| DI-7 | ShipTalk transcripts framed as private/local | **Transcripts persist forever** (unbounded localStorage + insert-only Supabase) with no purge; **re-exposed to any LLM via shiptalk-mcp with no auth** | `12 P-4`, `12 P-5`/`12 S-1` (`shiptalk-mcp/src/index.ts:148-246`) | **High** |
| DI-8 | "Privacy / private second brain" positioning (ShipMind, ShipTalk, ShipWatch, ship-memory) | **Plaintext at rest** everywhere — SQLite/PNG/WAV/`.md` unencrypted; a single device compromise exposes a searchable archive of everything seen/typed/copied/said | `10 P-2`, `12 P-4`, `14 P-5`, `14 P-7`, `14 L-6` | **High** |
| DI-9 | "private second brain" (ship-memory) / MCP trust framing | **Unauthenticated MCP** lets any connected (or prompt-injected) LLM **read, overwrite, and permanently delete** the entire cross-product knowledge base; read-only mode is opt-in, not default | `14 S-7` (`mcp/src/index.ts:229-276`) | **High** |
| DI-10 | "AES-256 encryption at rest" / "Encrypted at rest and in transit" (ShipWatch marketing) | ShipWatch stores all captures **unencrypted** (no SQLCipher/crypto observed); the marketing asserts AES-256 at rest as a concrete warranty | `13 L-7`/`16` Cat 3 (`shipwatch/.../Features.tsx:151`, `Capabilities.tsx:269,305`) vs `14 P-5`/`14 S-3` | **High** |
| DI-11 | "Cloud mode encrypts over HTTPS. You choose." (privacy-first framing) | HTTPS is transport-only; once at the provider, data is handled per the provider's policy — over-implies confidentiality of cloud egress | `16` Cat 3 (`app/page.tsx:2990`) | **Medium** |
| DI-12 | ShipWatch onboarding = permissions checklist only | **No recording-consent / bystander / two-party-consent notice anywhere**; mic/system-audio auto-arm on meeting detection, capturing all participants | `14 P-2`, `14 P-4`, `14 L-1`; `12 §5` (ShipTalk) | **High** (wiretap) |
| DI-13 | ShipMind extension stores a Bearer token (privacy of token) | Token in `chrome.storage.local` **unencrypted**; the `:8765` ingest endpoint it targets **does not exist** in the app (dead/non-functional path) | `10 S-6` (`background.js:5,116`) | **Low** |
| DI-14 | Terms §9 third-party processor list | **Omits Printful** even though merch buyers' name/address/email flow to Printful (disclosed in Privacy but inconsistent with Terms) | `13 P-4` (`app/terms/page.tsx:130-136` vs `app/privacy/page.tsx:60`) | **Low** |
| DI-15 | Minimum-age policy | General site = **18**; ShipMind extension privacy = "not directed at children under 13" (COPPA) — **inconsistent minimum age** across properties; age not enforced at signup | `13 §8` (`app/terms/page.tsx:44`, `app/privacy/shipmind-extension/page.tsx:110`) | **Low** |

---

## Regulatory data-subject-rights gaps (GDPR / CCPA)

**Not legal advice** — operability assessment from source only.

| Right | Statute | Operable in code today? | Notes |
|---|---|---|---|
| **Access** (know what is held) | GDPR Art. 15 / CCPA | **No automated route** for makeshiphappenAi; promised manually only (`13 P-1`). Desktop apps hold data locally (user has filesystem access) but no in-app "show all my data" view. | Manual-email fulfillment is the only mechanism; relies on a human actually staffing `privacy@` |
| **Erasure / Delete** | GDPR Art. 17 / CCPA "Delete" | **No automated route.** makeshiphappenAi promises deletion with **no implementing API** (`13 P-1`). Desktop apps: per-item delete only, **no bulk wipe** (ShipMind `10 P-3`, ShipSpace `11 §4`, ShipTalk `12 P-4`, ShipWatch `14 L-3`). Supabase `transcriptions` is insert-only. | Cloud-side erasure (Supabase rows, Stripe, Printful, Sentry) not wired; provider-side retention (Anthropic/OpenAI/etc.) governed by each vendor, no deletion-propagation |
| **Portability / Export** | GDPR Art. 20 / CCPA | **No automated route.** makeshiphappenAi promises JSON export with **no implementing API** (`13 P-1`). ShipSpace has feature-scoped ShipGang JSON export only; other desktop apps none. | ship-memory data is already portable plaintext `.md` (incidental, not a right-fulfillment feature) |
| **Consent** (esp. recording / biometric) | GDPR Art. 6/9, BIPA, CCPA, state two-party-consent / wiretap | **Not captured.** ShipWatch/ShipTalk capture mic + system audio of bystanders with **no consent UX, no recording notice, no two-party warning** (`14 P-2/P-4/L-1`, `12 §5`). Voice = biometric-adjacent; raw voice egresses to OpenAI/Apple/Groq with no BIPA notice. | Highest data-subject-rights exposure; auto-arm makes the product the trigger |
| **Disclosure of processors** | GDPR Art. 13/14 | Partial. Privacy Policy lists providers; **Terms omits Printful** (`13 P-4`); no subprocessor list / DPA page (`13 P-5`). | Inconsistency between Terms and Privacy |
| **Retention limitation** | GDPR Art. 5(1)(e) | **Not met** for ShipTalk (unbounded), ShipWatch DB rows (never cleaned), ship-memory (permanent). | No retention policy enforced in code |

**Bottom line:** Across the ecosystem, none of the core data-subject rights (access, erasure, portability) are fulfilled by an automated code path. The web property advertises these rights but routes them to an unimplemented manual process; the desktop apps provide only per-item local deletion and partial feature-scoped export. Consent for audio/biometric capture is entirely absent.
