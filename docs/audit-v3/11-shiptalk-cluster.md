# Per-Product Cluster Audit — ShipTalk

**Audit type:** Read-only risk / inventory / governance review
**Product:** ShipTalk (Tauri 2 macOS-first desktop voice dictation & transcription app)
**Owner / operator / data controller:** MakeShipHappen (zzgemsjewelry@gmail.com)
**Date:** 2026-06-07
**Scope:** ShipTalk desktop app (`ShipTalk/`) + companion MCP server (`shiptalk-mcp/`). This is the single deep reference document for this product.

> CRITICAL CONTEXT: This is a READ-ONLY audit. No source was modified. Findings assume the software works as written; the goal is risk, inventory, and governance analysis. Evidence is cited as `file_path:line` where available.

---

## 1. Executive Summary

ShipTalk is a cross-platform (macOS-first) Tauri 2 desktop voice dictation app. It captures microphone audio, transcribes speech to text via one of five engines — browser Web Speech, on-device whisper.cpp, Groq cloud Whisper, OpenAI cloud Whisper — optionally "polishes" the text with Anthropic Claude (`claude-haiku-4-5`), then auto-pastes the result into whatever application the user last had focused. It also transcribes uploaded audio/video files. A companion MCP server (`shiptalk-mcp`) exposes the local transcription history to AI agents.

**Overall posture:** OS-level secrets hygiene is genuinely good (keychain-backed provider keys, strict CSP, scoped HTTP allowlist, argv-safe AppleScript, cloud-features gate defaulting OFF). The risk concentration is at the **data-retention, trust-boundary, and governance layers**, not the keychain.

The four most material risks are:

1. **CRITICAL — MCP unrestricted localStorage read.** `shiptalk-mcp`'s `get_state_raw` / `list_state_keys` expose every WebKit localStorage key over stdio with no allowlist, including the persisted Supabase auth session (`shiptalk-auth`) and the full plaintext transcript corpus (`shiptalk-history`). Any agent that loads this server can read the user's spoken history and impersonate their cloud account.
2. **HIGH — Transcripts persisted in plaintext with no retention, no pruning, and no working deletion path.** The History delete button is rendered without its handler (`App.tsx:264`), and no `transcriptions` row is ever deleted from Supabase — a right-to-erasure and data-minimization gap.
3. **HIGH — Client-side-only authorization with a hardcoded owner-email backdoor.** `src/lib/owner.ts:1` bakes `zzgemsjewelry@gmail.com` into every binary and forces `team` tier client-side; all tier gating is cosmetic unless RLS enforces it server-side.
4. **HIGH — No attribution / NOTICE shipped despite ~250+ Apache-2.0, ~300+ MIT, and 5 MPL-2.0 dependencies in the distributed binary**, plus an empty `license = ""` field — the primary legal exposure for a commercial release.

The codebase contains the team's own standing AUDIT comment (`src-tauri/Cargo.toml:28-30`) acknowledging that cloud transcription engines "contradict the '100% on-device' marketing claim" — a truth-in-labeling concern that remains unresolved.

---

## 2. Full Inventory

### 2.1 Components

| Component | Location | Role |
|---|---|---|
| Main dashboard window | `src/App.tsx` (`MainApp`) | History, settings, all views |
| Floating overlay window | `src/components/FloatingOverlay.tsx` | Transparent always-on-top pill; recording/polish/paste at `/#overlay` |
| Voice-commands hook | `src/hooks/useVoiceCommands.ts` | 5 STT engines + backup recorder + Whisper recovery |
| Global shortcuts hook | `src/hooks/useGlobalShortcuts.ts` | OS push-to-talk / toggle hotkeys |
| Polish engine | `src/lib/polish.ts` | Anthropic `claude-haiku-4-5` cleanup + dictionary substitution |
| File transcription | `src/lib/fileTranscribe.ts` | Chunked Groq/OpenAI Whisper for uploaded media |
| Audio processor | `src/lib/audioProcessor.ts` | Decode/chunk/WAV-encode at 16 kHz mono |
| Audio capture | `src/lib/audioCapture.ts` | Device enumeration + virtual/Bluetooth guarding |
| API key store | `src/lib/apiKeys.ts` | In-memory cache fronting OS keychain |
| Cloud features gate | `src/lib/cloudFeatures.ts` | localStorage flag, default OFF |
| Auth store | `src/lib/auth.ts` | Supabase email/password + tier/owner logic |
| Owner gate | `src/lib/owner.ts` | Hardcoded owner-email allowlist |
| Supabase client | `src/lib/supabase.ts` | anon-key client, session persisted to localStorage |
| Updater | `src/lib/updater.ts` | Tauri auto-updater, 6h interval |
| Rust backend | `src-tauri/src/lib.rs` | `type_text` paste, frontmost-app save/restore, AX check, overlay cursor-follow loop, local whisper download + transcription |
| Rust secrets module | `src-tauri/src/secrets.rs` | keychain get/set/delete/has |
| MCP server | `shiptalk-mcp/src/index.ts` | stdio MCP exposing transcript history + settings from localStorage SQLite |
| Release publisher | `scripts/upload-release.mjs` | Supabase service-role release publishing |
| Dev launchers | `scripts/dev-detached.mjs`, `scripts/dev-signed.mjs` | Detached/ad-hoc-signed dev runs |

**Views:** Overview, History, Dictionary, Shortcuts, Subscription, Settings, Permissions, Audio Input, Enhancement, Transcribe, Polish, Auth.

### 2.2 Dependencies (key)

- **JS app:** `@tauri-apps/api`, `@tauri-apps/plugin-{global-shortcut,http,process,updater}`, `@supabase/supabase-js`, `react 19`, `react-dom`, `zustand`, `lucide-react`.
- **Rust:** `tauri 2.10` (macos-private-api), `tauri-plugin-{log,http,global-shortcut,process,updater}`, `keyring 3`, `whisper-rs 0.16` (metal), `hound`, `core-graphics`, `core-foundation`. Full tree = 579 crates (`src-tauri/Cargo.lock`).
- **MCP:** `@modelcontextprotocol/sdk`, `better-sqlite3`.

### 2.3 External services

`api.anthropic.com` · `api.groq.com` · `api.openai.com` · `*.supabase.co` · `huggingface.co` · `makeshiphappen.tech` (updates + help) · `makeshiphappen.com` (billing/signup links) · Apple speech servers (possible, via Web Speech).

### 2.4 macOS permissions / entitlements

| Permission | Entitlement / string | Purpose |
|---|---|---|
| Microphone | `NSMicrophoneUsageDescription`, `audio-input` | Live capture |
| Speech Recognition | `NSSpeechRecognitionUsageDescription`, `speech-recognition` | Dictation |
| Accessibility | `NSAccessibilityUsageDescription` / `AXIsProcessTrusted` | `type_text` paste |
| Apple Events automation | `com.apple.security.automation.apple-events` | osascript app activation / paste |
| Camera | `NSCameraUsageDescription` (**declared but unused**) | AVFoundation side-effect of mic request |
| Stay awake | `NSAppSleepDisabled` | Keep recording during sleep |

---

## 3. Data Flows

### 3.1 Data processed / collected

Live mic audio (16 kHz mono); uploaded audio/video files; raw + Claude-polished transcripts; transcript metadata (uuid, timestamp, wordCount, durationSeconds); custom dictionary terms; polish prompt presets; **frontmost-app identity** of other apps; audio device labels/IDs; user email + Supabase JWT session; subscription tier; provider API keys (Anthropic/Groq/OpenAI).

### 3.2 Storage locations

| Store | Location | Contents | Protection |
|---|---|---|---|
| OS keychain | service `com.makeshiphappen.shiptalk` | Anthropic/Groq/OpenAI keys | Keychain (good) |
| WebKit localStorage SQLite | `~/Library/WebKit/com.makeshiphappen.shiptalk/.../localstorage.sqlite3` | `shiptalk-history` (full plaintext transcripts), all settings, polish prompts, `shiptalk-auth` (Supabase session) | **Plaintext, user-readable** |
| Supabase Postgres (cloud) | `transcriptions`, `dictionary_terms`, `profiles` | Transcripts + metadata, dictionary, tier | RLS-dependent |
| App data dir | `~/Library/Application Support/<bundle>/whisper-models` | ggml model binaries | Filesystem |
| Temp diagnostics | `/tmp/shiptalk-follow.log` | Cursor/display state (no transcript text) | **World-readable** |
| Supabase Storage | private `releases` bucket | Build artifacts | Service-role write |
| `.env` (gitignored) | repo | Supabase URL + public anon key | Acceptable (public anon) |

### 3.3 Outbound data flows

| Data | Destination | Trigger | Evidence |
|---|---|---|---|
| Raw mic audio chunks | Groq (`api.groq.com`) | Cloud STT engine | `useVoiceCommands.ts:697`, `fileTranscribe.ts:48` |
| Raw audio | OpenAI (`api.openai.com`) | Cloud STT fallback/backup | `useVoiceCommands.ts:328,622` |
| Raw transcript + dictionary terms | Anthropic (`api.anthropic.com`) | Polish | `polish.ts:166,174` (`anthropic-dangerous-direct-browser-access: true`) |
| Audio | Apple speech servers (possible) | Web Speech engine | `useVoiceCommands.ts:62-66` |
| Transcripts + metadata | Supabase `transcriptions` | When authenticated | `App.tsx:170-178` |
| Email/password | Supabase auth | Sign-in | `auth.ts:64-67` |
| Model binaries (inbound) | huggingface.co | Local whisper download | `lib.rs:71-80,511-531` |

All cloud AI calls are made **directly from the client using user-supplied keys** (no proxy), gated behind `isCloudEnabled()` (default OFF, `cloudFeatures.ts:10-11`), which is correctly checked on every cloud path.

---

## 4. Security Posture & Risk Ratings

| # | Finding | Severity | Responsible Party |
|---|---|---|---|
| S-1 | MCP exposes Supabase auth token + full transcript history over stdio, no allowlist | **Critical** | App owner / `shiptalk-mcp` maintainer |
| S-2 | Transcripts persisted plaintext in localStorage, never encrypted/pruned | **High** | App owner |
| S-3 | No working transcript deletion path (dead delete UI + no Supabase delete) | **High** | App owner |
| S-4 | Client-side-only authorization + hardcoded owner-email backdoor; tier spoofable | **High** | App owner |
| S-5 | Dictionary terms read from Supabase with no `user_id` filter — relies entirely on RLS | **High** | App owner (Supabase RLS) |
| S-6 | Whisper models downloaded over curl with no checksum/signature verification | **Medium** | App owner |
| S-7 | Provider keys forwarded direct-from-client to third parties; `dangerous-direct-browser-access` | **Medium** | App owner |
| S-8 | `type_text` drives Accessibility + AppleScript to paste into arbitrary apps | **Medium** | App owner |
| S-9 | Release publishing uses Supabase service-role key (bypasses all RLS) | **Medium** | App owner / release infra |
| S-10 | Web Speech engine may transmit audio to Apple despite "instant/local" label | **Medium** | App owner |
| S-11 | Frontmost-app identity read & logged for paste targeting (cross-app surveillance) | **Low** | App owner |
| S-12 | World-readable `/tmp/shiptalk-follow.log` diagnostics shipped in release | **Low** | App owner |
| S-13 | Unused camera usage string broadens TCC prompt surface | **Low** | App owner |
| S-14 | **Positive controls** (keychain, strict CSP, scoped allowlist, argv-safe osascript, cloud gate) | Info | — |

### Detailed findings

**S-1 (Critical) — MCP unrestricted localStorage read.**
`shiptalk-mcp/src/index.ts` opens the localStorage SQLite read-only and exposes `list_state_keys` (line 380) enumerating *every* key plus `get_state_raw` (line 387, self-described "Read any localStorage key directly") with **no allowlist or redaction**. Because the Supabase session persists under `shiptalk-auth` (`supabase.ts:53`, `persistSession:true`) and transcripts under `shiptalk-history`, any AI agent or local process that can spawn this stdio server can (a) read the entire plaintext dictation corpus and (b) exfiltrate the live `access_token`/`refresh_token` and impersonate the user against Supabase (RLS-scoped read/write as that user, token refresh). The server requires no authentication and trusts whatever client launches it. **Recommendation:** restrict `get_state_raw` to a transcript/settings allowlist that excludes `shiptalk-auth` and any `*-auth`/token keys.

**S-2 / S-3 (High) — Plaintext retention with no erasure.**
Every finished dictation (raw or polished) is written verbatim to `shiptalk-history` as JSON (`App.tsx:88`; `finishSession` builds `{id,text,timestamp,wordCount,durationSeconds}` in `useVoiceCommands.ts`). The store has no size cap, age cap, rotation, or pruning — history grows unbounded in cleartext, surviving reinstall. `HistoryView` supports an `onDeleteItem` button (`HistoryView.tsx:182-190`), but `App.tsx:264` renders `<HistoryView history={history} onAddToDictionary={...} />` **without passing `onDeleteItem`**, so the delete button never appears (verified). There is no `localStorage.removeItem('shiptalk-history')` and **zero `supabase.from('transcriptions').delete()` calls** (verified) — the cloud copy inserted at `App.tsx:170-178` can never be removed in-app. Net: users cannot delete their own transcripts locally or in the cloud (GDPR Art. 17 / CCPA right-to-erasure gap + data-minimization failure).

**S-4 (High) — Client-trust authorization + backdoor.**
`src/lib/owner.ts:1` hardcodes `OWNER_EMAILS = ['zzgemsjewelry@gmail.com']` (verified) and `auth.ts:78/95` forces `tier='team'` for that email client-side. `checkSubscription` (`auth.ts:74-101`) reads `profiles` client-side and on error *preserves* tier rather than denying, so gating is cosmetic. A local user can edit localStorage, patch the bundle, or intercept the `profiles` response to grant themselves `team`/`pro`. Acceptable **only** if every paid capability is independently enforced server-side via RLS. The owner email is a static credential baked into every shipped binary.

**S-5 (High) — Dictionary RLS dependence.**
`polish.ts:104-108` queries `dictionary_terms` with `.select('original, replacement').limit(500)` and **no `.eq('user_id', ...)` filter** (verified); `DictionaryView.tsx` inserts with no `user_id`. With the anon key public (`supabase.ts:48`), cross-tenant isolation for `dictionary_terms`, `transcriptions`, and `profiles` rests entirely on server-side RLS not visible in this repo. If `dictionary_terms` RLS is loose, terms (often proprietary names/jargon/PII) leak across all users. **Must-verify.**

**S-6 (Medium) — Unverified model supply chain.**
`download_local_whisper_model` (`lib.rs:511-531`) shells out to `curl --fail --location` to fetch `ggml-base.en.bin`/`ggml-small.en.bin` from huggingface.co, validating only `size > 1MB` (`lib.rs:536-541`). No SHA-256/minisign verification; a compromised mirror or MITM-on-broken-TLS could deliver a tampered model loaded into the process by whisper-rs.

**S-7 (Medium) — Direct-from-client keys.**
`polish.ts:166-182` sends the Anthropic key in `x-api-key` with `anthropic-dangerous-direct-browser-access: true` (verified); Groq/OpenAI keys travel as Bearer tokens from the webview (`useVoiceCommands.ts`, `fileTranscribe.ts`). `.env.example` itself warns to use a server-side proxy; a `VITE_TRANSCRIPTION_ENDPOINT` path exists but is optional/unused by default (and polish has no proxy path). Any compromised renderer or the in-memory `apiKeys` cache can read live keys.

**S-8 (Medium) — Powerful paste automation.**
`type_text` (`lib.rs:286-444`) copies arbitrary text to the clipboard via `pbcopy`, activates the saved target app, and issues Cmd-V through System Events/CoreGraphics, gated only by `AXIsProcessTrusted` + the `apple-events` entitlement. Mitigation is solid: the app identifier is passed as `argv` (not interpolated), preventing AppleScript injection. Residual: any IPC caller in the webview can invoke `type_text` with arbitrary content.

**S-9 (Medium) — Service-role key in release script.**
`scripts/upload-release.mjs:26,224` reads/uses `SUPABASE_SERVICE_ROLE_KEY` to write the private `releases` bucket feeding the updater. The key fully bypasses RLS; it is env-only (not committed) with good guardrails (rejects ad-hoc-signed/non-universal builds), and the updater still requires a valid minisign signature — limiting compromise to denial/rollback rather than arbitrary-binary delivery. Keep CI-scoped and never logged.

**S-11/S-12/S-13 (Low).** Frontmost-app identity (`lsappinfo`/osascript, `lib.rs:104-179`) is read and logged via `tauri-plugin-log` to choose the paste target — a cross-app visibility surface with no log scrubbing. `/tmp/shiptalk-follow.log` is written ~3×/sec with cursor/display state (`lib.rs:849-871`, marked "TEMP", verified) and leaks cursor activity to any local user with no rotation. The unused `NSCameraUsageDescription` broadens the TCC prompt surface.

**S-14 (Positive controls — preserve).** Keychain secret storage via `keyring` (`secrets.rs`); strict CSP `connect-src` allowlist limited to supabase/openai/anthropic/groq (`tauri.conf.json:39`); Tauri `http:default` scoped to exactly the three vendor hosts (`capabilities/default.json:16-21`); each custom command individually permissioned; argv-safe osascript activation; only committed secret is the public anon key; cloud-features gate default OFF and consistently enforced.

---

## 5. Privacy & Data-Retention Posture

| Dimension | Assessment |
|---|---|
| **Lawful basis / disclosure** | **Gap.** No in-app privacy notice maps each destination (audio → Groq/OpenAI/Apple; transcript → Anthropic + Supabase; app-identity → local log). Users have no informed picture of where voice data goes. |
| **Data minimization** | **Fail.** Full transcripts retained indefinitely in plaintext; dictionary terms (often PII) sent to Anthropic on every polish call (`polish.ts:139-156`). |
| **Retention / pruning** | **Fail.** No retention limit, rotation, or expiry locally (S-2); no deletion path locally or cloud (S-3). |
| **Right to erasure (GDPR Art. 17 / CCPA)** | **Fail.** No working delete for local or cloud transcripts. |
| **Sub-processor disclosure** | **Gap.** Groq, OpenAI, Anthropic, Supabase, Hugging Face (and possibly Apple) are undisclosed sub-processors; no published list, no pinned data-residency regions. |
| **Truth-in-labeling** | **Risk.** "On-device" framing contradicted by cloud engines — flagged in the team's own `Cargo.toml:28-30` AUDIT comment (verified). Web Speech labeled "instant/local" may route to Apple. |
| **Mitigating control** | Cloud features default OFF; nothing leaves the device until the user opts in. |

**Privacy verdict:** Architecturally privacy-capable (local-only is the default), but the *governance* layer — disclosure, retention limits, and erasure — is materially incomplete for a product that processes voice (potentially special-category) data.

---

## 6. Integrations & AI Providers

| Provider | Data received | Auth | Disclosure status |
|---|---|---|---|
| Anthropic Claude (`claude-haiku-4-5`) | Raw transcript + dictionary terms | User key, `x-api-key` | Undisclosed sub-processor |
| Groq Whisper (`whisper-large-v3-turbo`) | Raw audio | User key, Bearer | Undisclosed sub-processor |
| OpenAI Whisper (`whisper-1`) | Raw audio | User key, Bearer | Undisclosed sub-processor |
| Local whisper.cpp (ggml) | Audio (on-device) | n/a | On-device (model fetched from HF unverified) |
| Web Speech API | Audio (possibly → Apple) | n/a | "instant/local" label, undisclosed Apple flow |
| Supabase | Transcripts, email, JWT, releases | Email/password + anon key + service-role (publish) | Undisclosed; RLS-dependent |
| Hugging Face | (inbound) model binaries | n/a | Supply-chain, no checksum |
| makeshiphappen.tech | Update polling | minisign-verified | First-party update trust root |

No local-CLI agents (Hermes/OpenClaw) are wired into ShipTalk — those belong to ShipSpace.

---

## 7. Licenses & Dependencies

| # | Finding | Severity |
|---|---|---|
| L-1 | No attribution/NOTICE shipped despite ~250+ Apache-2.0 + ~300+ MIT deps in the distributed binary | **High** |
| L-2 | Five MPL-2.0 (weak-copyleft) crates statically linked (cssparser, cssparser-macros, dtoa-short, selectors, option-ext) | **Medium** |
| L-3 | Bundled whisper.cpp/GGML is MIT but its copyright notice is not redistributed | **Medium** |
| L-4 | Empty/blank license declaration — `license = ""`, `authors = ["you"]`, `repository = ""` (`Cargo.toml:5-7`, verified) | **Low** |
| L-5 | Whisper model weights fetched at runtime — no license bundling, no checksum | **Low** |
| L-6 | `shiptalk-mcp` contains a no-license placeholder dep `beep-boop@1.2.3` (license NONE) | **Low** |
| L-7 | **No GPL/AGPL/LGPL strong-copyleft contamination — clean for proprietary distribution** | Info |

**Verdict:** No copyleft contamination; ShipTalk can ship as a closed-source paid product with no source-disclosure obligation. The work is **attribution, not relicensing**. Both MIT (copyright-notice redistribution) and Apache-2.0 §4(d) (NOTICE redistribution) legally require attribution to travel with the binary; the repo ships **zero** LICENSE/NOTICE/THIRD-PARTY files and has no in-app About/Licenses screen (verified: `find` for license/notice returned nothing). This is the primary legal exposure for a commercial DMG. The bundled MIT whisper.cpp native code (statically compiled via whisper-rs-sys, wrapped in Unlicense) is an easily-forgotten attribution obligation. Set an explicit proprietary license string + real copyright holder, and ship a generated third-party-licenses bundle.

---

## 8. Liability Hotspots

1. **Right-to-erasure failure (S-3)** — Regulatory exposure (GDPR/CCPA) and breach-of-expectation liability: users literally cannot delete their voice data.
2. **Undisclosed sub-processors + "on-device" marketing (Privacy §5, S-10)** — Misrepresentation / unfair-trade-practice exposure if marketing claims on-device while audio/transcripts leave the device. The team's own code comment is contemporaneous evidence of awareness.
3. **Credential exfiltration via MCP (S-1)** — If an agent reads a user's Supabase session token, the resulting account compromise is plausibly attributable to a known design gap.
4. **Cross-tenant data leakage (S-5)** — If `dictionary_terms`/`transcriptions` RLS is loose, one user's PII reaches others.
5. **Attribution non-compliance (L-1)** — Copyright-license breach for every distributed copy.
6. **Owner backdoor (S-4)** — A hardcoded credential in shipped binaries is a defensibility weakness.

---

## 9. User-Responsibility Assignment

Nearly all findings are assigned to **the app owner/operator (MakeShipHappen / zzgemsjewelry@gmail.com)** because the design choices are baked into shipped code. End-user responsibility is limited to:

| Responsibility | Owner |
|---|---|
| All product design, retention, deletion, disclosure, attribution, RLS configuration, MCP allowlisting, model-integrity verification | **App owner** |
| Supplying valid provider API keys; understanding that enabling Cloud Features ships voice to third parties | End user |
| Granting macOS Microphone / Accessibility / Speech permissions | End user |
| Not dictating others' sensitive data without consent | End user |
| Third-party processing of submitted audio/text per their own policies | Anthropic / Groq / OpenAI / Apple (processors) |

---

## 10. Prioritized Remediation (read-only recommendations)

1. **S-1 (Critical):** Add a key allowlist to `shiptalk-mcp` `get_state_raw`/`list_state_keys`; exclude `shiptalk-auth` and any token keys.
2. **S-3 / S-2 (High):** Wire `onDeleteItem` into `App.tsx:264`; add a Supabase `transcriptions.delete()` path and a "clear all history" action; add retention caps.
3. **S-4 (High):** Move all tier/owner gating to server-side RLS; remove the hardcoded owner email from the client.
4. **S-5 (High):** Verify and tighten RLS on `dictionary_terms`, `transcriptions`, `profiles` (scope SELECT/INSERT to `auth.uid()`).
5. **L-1 (High):** Generate and ship a third-party-licenses bundle + in-app Licenses screen; set a real `license`/`authors`/`repository`.
6. **Privacy (Medium):** Publish a sub-processor list + per-engine data-flow/retention disclosure; reconcile or remove the "on-device" marketing claim.
7. **S-6 (Medium):** Pin and verify SHA-256 of whisper model downloads.
8. **S-12 (Low):** Remove the `/tmp/shiptalk-follow.log` diagnostic from release builds.

---

*End of ShipTalk cluster audit. No source files were modified during this review.*
