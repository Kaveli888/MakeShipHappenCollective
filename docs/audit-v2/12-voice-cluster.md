# Audit v2 — Dossier 12: VOICE Cluster

**Auditor:** Independent risk/compliance (read-only)
**Date:** 2026-06-07
**Scope:** `ShipTalk/` (Tauri voice-to-text), `ShipTranscribe/` (file transcription), `shiptalk-mcp/` (transcript MCP server)
**Method:** Derived from source. Did not consult `docs/audit/` or `docs/business-protection/`.

> Headline contradiction: a user can select the **Local Whisper "private, on-device"** engine and still have the **full transcript shipped to Anthropic** by the Polish feature, and (in Browser mode) the **full session audio uploaded to OpenAI** by the silent "backup recorder." The privacy posture is engine-conditional and not clearly disclosed at the moment of choice.

---

## 1. INVENTORY

### 1.1 ShipTalk (`ShipTalk/`)
| Dimension | Detail | Evidence |
|---|---|---|
| Purpose | macOS Tauri 2 app; hold-to-talk / toggle dictation, types result into the frontmost app via clipboard+paste; floating overlay pill; local searchable history; cloud "Polish" rewrite. | `src/components/FloatingOverlay.tsx`, `src-tauri/src/lib.rs` |
| Transcription engines | **4 engines**: (1) Browser/Web Speech (`webkitSpeechRecognition`), (2) Local Whisper (whisper-rs/whisper.cpp via Tauri Rust), (3) OpenAI Whisper API, (4) Groq Whisper API. File-transcribe path uses Groq or OpenAI. | `src/hooks/useVoiceCommands.ts:73-79, 371, 516, 579, 681`; `src/lib/fileTranscribe.ts:29-65` |
| AI providers | **OpenAI** (`api.openai.com` Whisper), **Groq** (`api.groq.com` Whisper), **Anthropic** (`api.anthropic.com`, `claude-haiku-4-5`, Polish), **Apple/WebKit** (Browser engine = macOS Speech, undisclosed cloud STT). | `fileTranscribe.ts:48,57`; `useVoiceCommands.ts:328,697`; `polish.ts:166,177`; `useVoiceCommands.ts:62-66` |
| External services | Supabase (auth + transcript cloud sync + dictionary terms), HuggingFace (whisper model download). | `src/lib/supabase.ts`; `src/lib/polish.ts:104`; `src-tauri/src/lib.rs:72,80` |
| Auth | Supabase email/password (`signInWithPassword`). **No login gate** — app is fully usable as `'local-user'`; `AuthView` component exists but is **never rendered** (dead code). | `src/lib/auth.ts:64-67`; `src/App.tsx:62-66` (no auth wall); `grep AuthView` → only self-import |
| OS permissions | Microphone, Speech Recognition, Accessibility (to paste), Camera (declared "not used"). | `src-tauri/Info.plist:5-12` |
| Storage | `localStorage` (`shiptalk-history`, settings, polish prompts, cloud flag), Supabase `transcriptions`/`dictionary_terms`/`profiles`, system Keychain (API keys), app-data dir (whisper models). | `App.tsx:88,170`; `secrets.rs:3`; `lib.rs:446-449` |
| User data | Full voice transcripts (raw + polished), word/duration stats, custom dictionary, recording audio (transiently → cloud in some paths). | throughout |

### 1.2 ShipTranscribe (`ShipTranscribe/`)
| Dimension | Detail | Evidence |
|---|---|---|
| Purpose | Import a video/audio file, extract audio (ffmpeg), transcribe **fully locally** (whisper.cpp Metal, or Python Whisper fallback). Gallery + viewer UI. | `src-tauri/src/lib.rs:300-360` |
| AI providers / cloud | **None.** No `api.*` egress; CSP has no external `connect-src`. | `src-tauri/tauri.conf.json` CSP (no remote connect-src) |
| Deps (native) | shells out to system `ffmpeg`/`ffprobe`/`whisper-cli` resolved by PATH-like lookup. | `lib.rs:12-24, 136, 305, 340` |
| Storage | local app store (`shiptranscribe-app` zustand persist) + local files. | `src/lib/stores/useAppStore.ts:76` |

### 1.3 shiptalk-mcp (`shiptalk-mcp/`)
| Dimension | Detail | Evidence |
|---|---|---|
| Purpose | stdio MCP server that reads ShipTalk's WebKit `localstorage.sqlite3` (read-only) and exposes transcripts + all localStorage keys to a connected LLM. | `src/index.ts:14-19, 148-246` |
| Auth | **None.** No token, no allow-list, no redaction. Any client that can spawn the stdio process reads everything. | `src/index.ts` (no auth anywhere) |
| Data exposed | Full transcript text (`recent_transcripts`, `get_transcript`, `search_transcripts`), arbitrary localStorage via `get_state_raw`/`list_state_keys`. | `src/index.ts:172-245, 298-393` |

---

## 2. DATA FLOWS

| # | Data | Origin → Destination | Trigger / Gate | Retention | Responsible |
|---|---|---|---|---|---|
| F1 | Raw mic audio | Mic → **local** whisper-rs (Rust) → text | `selected-model = local-whisper-*` | audio not persisted (in-memory `Blob`) | App (local) |
| F2 | Raw mic audio | Mic → **OpenAI** `api.openai.com/v1/audio/transcriptions` | engine `openai` OR file-transcribe; also **Browser-mode backup recorder** | OpenAI per their policy | User key + OpenAI |
| F3 | Raw mic audio (3s chunks) | Mic → **Groq** `api.groq.com/.../transcriptions` | engine `groq` | Groq per their policy | User key + Groq |
| F4 | Raw mic audio | Mic → **Apple/WebKit speech** (cloud STT on macOS) | engine `browser` (Web Speech) | Apple per their policy; **undisclosed in privacy copy** | Apple |
| F5 | **Full transcript text** | Local text → **Anthropic** `api.anthropic.com` (`claude-haiku-4-5`) | `isPolishEnabled()` (cloud-on + anthropic key + polish-mode) — **fires regardless of STT engine, incl. Local Whisper** | Anthropic per their policy | User key + Anthropic |
| F6 | Custom dictionary terms | Supabase → app (pulled into Polish prompt to Anthropic) | Polish run | Supabase | App + Supabase |
| F7 | Transcript text + stats | App → Supabase `transcriptions` table | authenticated session only | Supabase, **no purge logic** | App + Supabase |
| F8 | Transcript history | App → `localStorage` `shiptalk-history` | always | **unbounded, no purge/encryption** | App (local) |
| F9 | Transcripts | `localstorage.sqlite3` → **any connected LLM** via MCP | MCP server running | n/a | MCP (no auth) |
| F10 | Whisper model | HuggingFace → app-data dir via `curl` | user download | persisted | App (no integrity check) |
| F11 (Transcribe) | Audio | file → ffmpeg → whisper.cpp → text, all **local** | always | local | App (local) |

---

## 3. SECURITY FINDINGS

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| S-1 | **High** | **MCP server exposes all transcripts with zero auth/allow-list/redaction.** Any LLM/agent wired to `shiptalk-mcp` can read every transcript verbatim and any localStorage key (`get_state_raw`). | `shiptalk-mcp/src/index.ts:148-246, 387-393` |
| S-2 | **High** | **Whisper model download has no integrity verification** — `curl --fail --location` from HuggingFace, validated only by `size > 1_000_000` bytes. No checksum/signature. A compromised CDN/MITM (or HF mirror) could serve a malicious `.bin` loaded by `whisper-rs`. | `src-tauri/src/lib.rs:511-541` |
| S-3 | Medium | **No authentication gate.** App runs fully without login; Supabase rows are protected only by RLS (unverified here). `AuthView` is dead code. If RLS is misconfigured, the anon key (client-bundled) is the only barrier. | `App.tsx:62-66`; `supabase.ts:48-56` |
| S-4 | Medium | **Hardcoded owner email grants `team` tier bypass.** `zzgemsjewelry@gmail.com` is force-elevated client-side regardless of Supabase `profiles.subscription_tier`. Client-side entitlement; trivially spoofable in a local build. | `src/lib/owner.ts:1`; `src/lib/auth.ts:78-95` |
| S-5 | Medium | **`type_text` shells out to `osascript`/`pbcopy` and writes transcript to clipboard, then synthesizes Cmd-V.** Transcript transits the system pasteboard (readable by any app); paste target is whatever app was frontmost. Injection is mitigated (argv-passed, not interpolated — `lib.rs:348-364`), but pasteboard exposure remains. | `src-tauri/src/lib.rs:286-444` |
| S-6 | Low | **Debug follow-loop writes overlay state to a world-readable temp file** `/tmp/shiptalk-follow.log` every ~3 frames (no transcript content, but cursor/display geometry; left in production `run()`). | `src-tauri/src/lib.rs:862-871` |
| S-7 | Low | **ShipTranscribe resolves `ffmpeg`/`whisper-cli` via PATH-style candidate list**, falling back to the bare name (PATH lookup). A planted binary earlier in resolution order would execute. | `ShipTranscribe/src-tauri/src/lib.rs:12-24` |
| S-8 | Info | CSP is now set (not `null`) and `connect-src` is allow-listed to supabase/openai/anthropic/groq. The bundled `SECURITY_AUDIT_REPORT.md` (2026-02-23) is **stale** — its H-1 (mock auth) and H-2 (CSP null) no longer match current code. | `tauri.conf.json` CSP; `SECURITY_AUDIT_REPORT.md:H-1,H-2` |

---

## 4. PRIVACY FINDINGS

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| P-1 | **Critical** | **Polish ships the full transcript to Anthropic even when the user selected the "private, on-device" Local Whisper engine.** Polish runs in `handleTranscriptionComplete` for *every* engine's output; the only gate is cloud-on + anthropic-key + polish-mode (`isPolishEnabled`), **independent of `selected-model`**. A user choosing Local Whisper for privacy, with cloud left on for any reason, silently sends text to a third party. | `FloatingOverlay.tsx:40-59`; `polish.ts:124-198`; engine selection in `useVoiceCommands.ts:863-906` does not feed Polish gating |
| P-2 | **High** | **Browser ("Instant") mode silently uploads the FULL session audio to OpenAI.** A parallel "backup recorder" captures the whole session and, if cloud-on + OpenAI key/endpoint, POSTs it to `api.openai.com` and keeps whichever text is longer. The user picked the no-key "Browser" engine; raw audio egress is not surfaced at that choice. | `useVoiceCommands.ts:255-279, 308-343, 458-487` |
| P-3 | **High** | **Browser/Web Speech routes raw audio to Apple's speech servers** (macOS WKWebView `webkitSpeechRecognition` is cloud-backed). Disclosed only obliquely ("uses macOS/WebKit speech services", `SettingsView.tsx:94`), not in privacy framing. `NSSpeechRecognitionUsageDescription` confirms the dependency. | `useVoiceCommands.ts:62-66`; `Info.plist:7-8`; `SettingsView.tsx:94` |
| P-4 | Medium | **Transcripts persist unbounded, unencrypted, with no purge/retention/export.** `localStorage` `shiptalk-history` grows forever; Supabase `transcriptions` insert-only (no delete/export UI found). Survives reinstall (comment at `App.tsx:88`). | `App.tsx:86-90, 170-178` |
| P-5 | Medium | **MCP re-exposes the same transcripts to arbitrary LLMs** (privacy duplicate of S-1) — personal dictation (which can include sensitive/medical/financial speech) leaves the device to whatever model the MCP client uses. | `shiptalk-mcp/src/index.ts` |
| P-6 | Low | **Marketing/UI privacy copy is conditionally true and easy to over-read.** "On-device Whisper — free, **private**" (`SettingsView.tsx:91`) and "**Local-only mode — zero bytes leave your machine**" (`:462`) are accurate only when Cloud Features is OFF; the latter is correctly hidden when cloud is on, but the per-engine "private" label persists regardless of the Polish/backup egress above. | `SettingsView.tsx:91,462,445` |

---

## 5. LIABILITY / LEGAL

| Area | Exposure | Evidence |
|---|---|---|
| **Wiretap / two-party consent (CA, FL, IL, etc.)** | App captures microphone audio that can include bystanders/third parties (Audio Input even handles BlackHole/loopback "system audio" capture, `audioCapture.ts:5-6`). **No consent capture, no recording notice, no two-party warning anywhere.** Raw audio then leaves the device (P-2/P-3) to OpenAI/Apple. Recording + transmitting others' speech without consent in two-party states is a legal risk borne by the user with no in-app guardrail. | `audioCapture.ts`; no `consent`/`wiretap`/`bystander` strings in source |
| **Biometric / voiceprint (BIPA, CCPA, TX CUBI)** | Voice is biometric-adjacent. Audio sent to OpenAI/Apple/Groq could constitute disclosure of biometric identifiers; no BIPA notice/consent. Local Whisper does not extract voiceprints, but cloud paths transmit raw voice. | F2/F3/F4 |
| **Privacy-claim breach / deceptive trade (FTC §5)** | "Private / on-device / local" labeling (P-1, P-6) coexisting with silent Anthropic/OpenAI/Apple egress is a misrepresentation risk if a reasonable user relies on it. The contradiction (P-1) is the sharpest. | `SettingsView.tsx:91`, P-1 chain |
| **Third-party data processing** | Transcripts/audio sent to OpenAI/Groq/Anthropic/Supabase/Apple under each provider's terms; no in-app DPA/ToS/privacy-policy linkage found (Help links to `makeshiphappen.tech`, `Overview.tsx:362,367`). | — |

---

## 6. USER-RESPONSIBILITY (per feature)

| Feature | Who bears responsibility | Clear to user? |
|---|---|---|
| Local Whisper | User (local only) | Yes — but undercut by Polish (P-1) |
| Browser engine | User unknowingly shares audio w/ Apple + (if keyed) OpenAI | **No** — backup-upload (P-2) is undocumented |
| Polish | User supplies Anthropic key; consents implicitly via cloud toggle | **Partial** — not re-warned that it overrides local engine |
| Groq / OpenAI engines | User (BYO key) | Yes |
| Recording bystanders | **User** — no consent UX provided | **No** — zero notice (Section 5) |
| MCP exposure | User must understand any wired LLM reads all transcripts | **No** — no warning in MCP or app |
| Whisper model download | User trusts HF + app (no checksum) | **No** — integrity unstated |

---

## 7. MARKETING / IN-SCOPE CLAIMS (quoted)

| Claim | File:line | Verdict |
|---|---|---|
| "On-device Whisper — free, **private**, stable mic capture" | `SettingsView.tsx:91` | Misleading w/ Polish/backup on (P-1/P-2) |
| "On-device Whisper — better accuracy…" | `SettingsView.tsx:92` | OK (local) |
| "**Local-only mode — zero bytes leave your machine**" | `SettingsView.tsx:462` | Accurate (only shown when cloud OFF) |
| "All processing stays on your machine. Use Browser or Local Whisper with no API key." | `SettingsView.tsx:446` | **Misleading**: Browser engine is NOT local (Apple cloud STT, P-3) |
| "Cloud AI services may be used… **Audio is sent to external servers.**" | `SettingsView.tsx:445` | Accurate disclosure (cloud-on state) |
| "Stored in your system keychain — never sent anywhere but the provider you choose." | `SettingsView.tsx:476` | Accurate (keys; `secrets.rs`) |
| "Browser (Instant) — Fast, but uses macOS/WebKit speech services…" | `SettingsView.tsx:94` | Partial disclosure of P-3; no mention of OpenAI backup (P-2) |
| "On-device voice transcription" (subscription perk) | `SubscriptionView.tsx:196` | Conditionally true |
| "Local intelligence powered by MakeShipHappen." | `AuthView.tsx:59` | Dead view; "local" overbroad |

---

## 8. LICENSES / DEPS / SECRETS

| Item | Detail | Evidence |
|---|---|---|
| whisper-rs / whisper.cpp | MIT — OK. Models from HuggingFace `ggerganov/whisper.cpp` (MIT). No integrity check on download (S-2). | `Cargo.toml`; `lib.rs:64-83` |
| hound, keyring, core-graphics | MIT/Apache — OK. Keychain used for keys (good). | `Cargo.toml` |
| ffmpeg (ShipTranscribe) | **Not bundled** — shells to a system binary via PATH lookup. Avoids GPL-linking distribution issue, but introduces PATH supply-chain risk (S-7) and a runtime dependency the user must have installed. | `ShipTranscribe/src-tauri/src/lib.rs:12-24, 136, 305` |
| Committed secrets | **None live.** `ShipTalk/.env` is **gitignored** (not tracked), anon key empty, with an explicit comment that provider keys must not be `VITE_*`. No `sk-`/`gsk_`/JWT literals in scope. | `git check-ignore` → ignored; `.env` contents |
| Supabase anon key | Client-bundled by design (`VITE_SUPABASE_ANON_KEY`); safe only if RLS correct (unverified, S-3). | `supabase.ts:3-4` |

---

### Top remediations (advisory, not applied)
1. **Gate Polish on engine choice** (or warn): if `selected-model` is `local-whisper-*`, do not auto-send to Anthropic without an explicit per-engine consent. (P-1)
2. **Disclose/disable the Browser-mode OpenAI backup-upload** and the Apple cloud STT path at the point of engine selection. (P-2, P-3)
3. **Add auth/allow-list/redaction to `shiptalk-mcp`** or ship it opt-in with a loud warning. (S-1, P-5)
4. **Verify the Whisper model checksum** (HF publishes them) instead of a size check. (S-2)
5. Add recording-consent notice + retention/purge/export controls; move owner entitlement server-side. (Sec 5, S-4, P-4)
6. Remove the `/tmp/shiptalk-follow.log` debug writer from production. (S-6)
