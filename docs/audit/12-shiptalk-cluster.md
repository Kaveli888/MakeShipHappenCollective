# Audit 12 — ShipTalk / Voice Cluster

**Auditor:** Independent governance / security / privacy auditor (read-only)
**Date:** 2026-06-07
**Scope:** `ShipTalk/`, `shiptalk-mcp/`, `ShipTranscribe/` inside `MakeShipHappenCollective/`
**Method:** Source-only review (src/, src-tauri/src Rust, tauri.conf.json + capabilities, package.json, Cargo.toml, .env, docs). Build artifacts skipped.

> **Headline:** ShipTalk is a microphone-capture dictation app. It does keep a fully-local path (on-device whisper.cpp + paste), but it ALSO ships cloud transcription (OpenAI, Groq) and a cloud "Polish" step (Anthropic) that send raw dictated text/audio off-device, plus optional Supabase cloud sync of full transcripts. The prior `SECURITY_AUDIT_REPORT.md` (Feb 2026) is **stale** — it predates Whisper, Polish, Supabase, keychain, and global typing, and describes an app that no longer exists. The `ACT_MODE` computer-use feature is a **DRAFT spec only — not implemented in code.**

---

## PHASE 1 — INVENTORY

### Cluster A — ShipTalk (primary; Tauri 2 + React 19 + Rust)
- **Purpose:** Hold-to-talk / toggle voice-to-text. Transcribes speech and pastes ("types") the result into whatever app was frontmost. Floating always-on-top overlay that follows the cursor. Optional cloud "Polish" cleanup. Local transcription history + dashboard.
- **User-facing features:**
  - **Hold-to-talk / toggle / global shortcut** — `src/hooks/useGlobalShortcuts.ts`, OS-level hotkeys via `tauri-plugin-global-shortcut`. Press saves the frontmost app as the paste target, records, transcribes, pastes back.
  - **Floating overlay** — `src/components/FloatingOverlay.tsx` + native follow loop in `src-tauri/src/lib.rs` (`run_overlay_follow_loop`). Transparent, always-on-top, visible-on-all-Spaces, cursor-following pill.
  - **History** — `src/views/HistoryView.tsx`. Persisted to localStorage key `shiptalk-history` and (if signed in) Supabase `transcriptions` table (`src/App.tsx`).
  - **Polish** — `src/lib/polish.ts`, `src/views/PolishView.tsx`. Sends raw transcript to Anthropic `claude-haiku-4-5` for cleanup; gated behind cloud flag + Anthropic keychain key + per-overlay toggle.
  - **Transcription engines** (4) — `src/hooks/useVoiceCommands.ts`:
    1. **Browser / Web Speech API** (instant, on-device-ish, WKWebView speech)
    2. **Local Whisper** (whisper.cpp via Rust `transcribe_local_whisper`, fully on-device)
    3. **OpenAI Whisper** (cloud `api.openai.com`)
    4. **Groq Whisper** (cloud `api.groq.com`, chunked near-real-time)
  - **File transcription** — `src/lib/fileTranscribe.ts` (Groq/OpenAI cloud only).
  - **Dictionary** — custom term replacements pulled from Supabase `dictionary_terms` (`polish.ts`).
- **AI providers / models (cited):**
  - Local: **whisper.cpp** `ggml-base.en.bin` / `ggml-small.en.bin` (Cargo `whisper-rs = 0.16` w/ `metal`; models pulled from `huggingface.co/ggerganov/whisper.cpp`, `src-tauri/src/lib.rs:64-83`).
  - Cloud STT: **OpenAI** `whisper-1`, **Groq** `whisper-large-v3-turbo`.
  - Cloud LLM (Polish): **Anthropic** `claude-haiku-4-5` (`polish.ts:178`).
- **External endpoints (grepped):** `api.anthropic.com/v1/messages`, `api.openai.com/v1/audio/transcriptions`, `api.groq.com/openai/v1/audio/transcriptions`, `*.supabase.co` (`gvhbhoicvvoezjjartrt.supabase.co`), `huggingface.co/ggerganov/whisper.cpp`, updater `makeshiphappen.tech/api/updates/shiptalk/latest`, fonts.googleapis/gstatic, `console.anthropic.com` / `console.groq.com` / `platform.openai.com` (key-help links). A stale `github.com/Kaveli888/ShipTalk/releases` URL appears in source comments (not the live updater path).
- **Auth methods:**
  - **Supabase email/password** (`src/lib/auth.ts`, `src/views/AuthView.tsx`) — real auth now (replaces the Feb "any-password" mock). 5-attempt client lockout.
  - **NO enforced login gate** — `AuthView` is defined but **never imported/rendered**. The app runs as `local-user`; all features (mic, local history, local whisper) work with no sign-in. Sign-in is optional and only enables cloud sync + subscription tier.
  - **Owner bypass** — `src/lib/owner.ts` hardcodes `zzgemsjewelry@gmail.com` → forced `team` tier.
  - **Provider keys** — OpenAI / Groq / Anthropic stored in **macOS Keychain** via Rust `secrets.rs` (service `com.makeshiphappen.shiptalk`), cached in memory (`src/lib/apiKeys.ts`). Not in source/.env.
- **Permissions / entitlements (`entitlements.plist`, `Info.plist`, capabilities):**
  - `device.audio-input` (mic), `speech-recognition`, `automation.apple-events` (AppleScript), **Accessibility** (`AXIsProcessTrusted`, used to synthesize Cmd-V paste into other apps).
  - Tauri capabilities: global-shortcut, http (allow-list: anthropic/groq/openai), custom commands (type_text, save/clear_frontmost_app, secrets, local-whisper, overlay).
  - `macos-private-api` (transparent overlay). CSP now set (was `null`).
- **Storage locations / data:**
  - **Raw audio** — captured via `getUserMedia` → `MediaRecorder` blobs in memory; for local Whisper decoded to 16 kHz mono WAV in Rust. **Not persisted to disk by ShipTalk** (transient in RAM during a session). Cloud engines upload the audio blob.
  - **Transcripts** — localStorage `shiptalk-history` (persisted to WebKit `localstorage.sqlite3`), and Supabase `transcriptions` (text, word_count, duration, user_id) when signed in.
  - **Keychain** — provider API keys.
  - **Prefs** — many localStorage keys (model, polish prompts, follow mode, dictionary).

### Cluster B — shiptalk-mcp (MCP server)
- **Purpose:** Exposes ShipTalk's transcription history + settings to AI agents over stdio MCP (`shiptalk-mcp/src/index.ts`).
- **How:** Opens ShipTalk's WebKit `localstorage.sqlite3` **read-only** (`better-sqlite3`), scans `~/Library/WebKit/com.makeshiphappen.shiptalk/` for the DB, reads `shiptalk-history` and all localStorage keys.
- **Tools:** `stats`, `list_transcripts`, `recent_transcripts`, `get_transcript`, `search_transcripts`, `transcripts_in_range`, `get_settings`, `list_state_keys`, **`get_state_raw` (reads ANY localStorage key)**, `info`.
- **Auth:** None (local stdio; trusts whoever runs it). Read-only DB open.

### Cluster C — ShipTranscribe (separate Tauri app)
- **Purpose:** Audio-file transcription / gallery / viewer app (`ShipTranscribe/src`). Smaller, React + Tauri.
- **Deps:** `@tauri-apps/plugin-shell` (`shell:allow-open` only), `plugin-dialog`, `plugin-updater`. No mic entitlement seen in capabilities; no AI-provider keys in source; CSP set. Rust side (`lib.rs`) is thin. Lower-risk than ShipTalk and largely out of the mic/cloud blast radius, but shares the codex `--full-auto` / `--dangerously-bypass-approvals-and-sandbox` npm scripts (dev-tooling smell, not shipped runtime).

---

## PHASE 2 — DATA FLOW (origin → destination, retention, controls)

### Flow 1 — Local-only dictation (default engine = `local-whisper-base-en`)
`Mic (getUserMedia)` → `MediaRecorder` (webm, RAM) → Rust `transcribe_local_whisper` (whisper.cpp, on-device, Metal) → transcript string → **(optional Polish — see Flow 3)** → `type_text` pastes into frontmost app → saved to localStorage `shiptalk-history`.
- **Leaves device:** Audio: **No.** Transcript: **No** (unless signed in → Supabase, or Polish on → Anthropic).
- **Retention:** Audio discarded after transcription. Transcript persists indefinitely in localStorage (no TTL, no auto-purge). No in-app delete-all / export (GDPR gap carried from prior audit — `onDeleteItem` prop exists but no UI wiring confirmed).
- **Responsible party:** User's machine.

### Flow 2 — Cloud transcription (OpenAI or Groq engine)
`Mic` → `MediaRecorder` blob → **uploaded to `api.openai.com` / `api.groq.com`** with the user's own API key (Bearer) → transcript returned.
- **Leaves device:** **Raw audio of the speaker (and any background third parties) is uploaded to OpenAI/Groq.** ⚠️
- **Gating:** Requires cloud flag (`isCloudEnabled()`, default OFF) + a provider key. Also used silently as a **backup-recovery re-transcription** of the full session audio in Browser mode when an OpenAI key + cloud flag are present (`transcribeBlobViaWhisper`).
- **Retention/controls:** Subject to OpenAI/Groq retention policies — outside ShipTalk's control. No app-side notice that audio left the device for this engine.
- **Responsible party:** OpenAI / Groq.

### Flow 3 — Polish (Anthropic cloud cleanup)
`Transcript text` (+ Supabase dictionary terms) → **POST `api.anthropic.com/v1/messages`** (`claude-haiku-4-5`, `anthropic-dangerous-direct-browser-access: true`) → polished text → pasted into app + saved to history.
- **Leaves device:** **The full dictated transcript text is sent to Anthropic** whenever Polish is ON. ⚠️ This applies **even when the user picked the on-device Local Whisper engine** — i.e., a user who chose "local" can still have their text shipped to the cloud by the Polish toggle.
- **Gating:** cloud flag + Anthropic keychain key + `polish-enabled` (default ON once cloud+key set). Polish toggle lives on the overlay pill.
- **Retention/controls:** Anthropic API retention; user's own key. On Polish failure the app falls back to typing raw text and surfaces an error (not silent).
- **Responsible party:** Anthropic.

### Flow 4 — Cloud sync (Supabase)
When signed in, each finished transcript is `insert`ed into Supabase `transcriptions` (text + user_id). On load, history is fetched back.
- **Leaves device:** **Full transcript text + user id → Supabase.** ⚠️ Security depends entirely on **RLS being correct** (the `.env` comment acknowledges this: "anon key is public only when RLS is correct"). RLS not verifiable from this repo.

### Flow 5 — MCP read-out
shiptalk-mcp reads the localStorage SQLite and serves transcripts to any connected AI agent. **Full transcript history is exposed to whatever LLM/agent the user wires the MCP into** — another off-device path for highly personal dictated content, depending on the agent's provider.

---

## PHASE 3 — LIABILITY (raw material)
- **Wiretap / recording-consent exposure:** ShipTalk captures live microphone audio. In **two-party-consent jurisdictions** (e.g. CA, FL, PA, IL, WA + others), recording conversations — including incidental third parties near the user — without consent is unlawful. The mic constraints disable echo-cancellation/noise-suppression and prefer raw 16 kHz, so ambient/third-party speech is faithfully captured. With cloud engines (Flow 2), that third-party audio is **transmitted to OpenAI/Groq**, compounding exposure.
- **Sensitive dictation:** Voice dictation routinely contains health, legal, financial, and credential content. Polish (Flow 3) and cloud STT (Flow 2) export it to third-party LLM/STT providers; Supabase (Flow 4) stores it server-side. No HIPAA/PCI controls; no BAA. Marketing "local/private" framing (Phase 9) heightens reliance-based liability.
- **Auto-paste into wrong app:** `type_text` restores focus to a *previously saved* frontmost app and pastes via clipboard — if focus/target detection is wrong, dictated (possibly sensitive) text can be pasted into an unintended app/window/recipient. There is a self-paste guard but no content-aware target confirmation.
- **ACT_MODE (future):** Spec'd computer-use typing/clicking into arbitrary apps — wrong-app / destructive-action liability is explicitly deferred to "owner sign-off." Not yet shipped.

## PHASE 4 — RESPONSIBILITY (raw material)
- **App owner / vendor (MakeShipHappen / J. Felton):** Sets the default engine, ships the Polish toggle (default ON when keyed), controls marketing claims, owns the Supabase project + RLS, owns the signing identity and updater. Bears responsibility for the local-vs-cloud disclosure gap and for RLS correctness.
- **User:** Supplies their own API keys, chooses engine, enables cloud flag, decides whom they record. Bears front-line consent responsibility for recording others.
- **Third parties:** OpenAI, Groq, Anthropic, Supabase, HuggingFace (model download), Apple Developer (signing). Each is a processor for whatever data the corresponding flow sends.

---

## PHASE 7 — SECURITY (risk-rated)

| # | Finding | Rating | Justification |
|---|---------|--------|---------------|
| S-1 | **No enforced auth gate** — `AuthView` orphaned; app runs as `local-user` with full local mic/history access | **Low–Medium** | By design it's a local single-user desktop app, so this is mostly fine; but it means anyone at the unlocked machine can read all dictation history. Becomes Medium given the sensitivity of stored transcripts. |
| S-2 | **Polish / cloud STT exfiltrate sensitive dictation** off-device | **High (privacy)** | Raw transcript → Anthropic; raw audio → OpenAI/Groq. Polish ships text even when the user selected the *local* engine. Contradicts "private/local" framing. |
| S-3 | **Supabase RLS dependency** — anon key public, transcripts stored server-side keyed by user_id | **High if RLS wrong / Medium otherwise** | `.env` itself flags it. Cannot verify RLS from repo. A misconfigured policy = cross-user transcript read. (Consistent with the repo-wide Supabase findings in your memory.) |
| S-4 | **Accessibility + AppleScript auto-paste / input synthesis** | **Medium** | App holds Accessibility + Apple-events entitlements and synthesizes Cmd-V / `keystroke` into *other* apps via `osascript` and CGEvent. Powerful capability; osascript args are passed as argv (not interpolated) — good — but the capability itself is high-trust. No content-aware target confirmation. |
| S-5 | **`osascript` / `Command::new` shell-outs** in Rust (`osascript`, `lsappinfo`, `open`, `pbcopy`, `curl`) | **Low–Medium** | Inputs are fixed scripts or argv-passed identifiers, not user-text interpolated into shell — injection surface is small. `curl` model-download URL is hardcoded (HuggingFace, https). Acceptable but worth pinning checksums. |
| S-6 | **Model download integrity** — whisper models fetched via `curl` over https, size-checked only (`> 1MB`), no checksum/signature | **Medium** | A MITM/compromised mirror could serve a tampered `ggml-*.bin` loaded into the whisper runtime. Add SHA-256 pinning. |
| S-7 | **MCP `get_state_raw` reads ANY localStorage key** and serves to agents | **Medium** | Exposes the *entire* ShipTalk localStorage (all transcripts + every pref) to whatever AI agent is connected. No key allow-list, no redaction. Personal dictation → arbitrary LLM. |
| S-8 | **Secrets handling** — provider keys in macOS Keychain (Rust `keyring`), not in source; `.env` anon key emptied + rotation note | **Low (good)** | No hardcoded `sk-`/`gsk_`/JWT secrets found in src/scripts/.env. Keychain is the right call. CSP now set (prior `null` fixed). |
| S-9 | **`codex:auto:danger` npm script** (`--dangerously-bypass-approvals-and-sandbox`) in all three apps' package.json | **Low (dev-only)** | Not shipped runtime, but a footgun if invoked; an AI agent could run arbitrary actions unsandboxed. Recommend removing from committed scripts. |
| S-10 | **Updater** signed (minisign pubkey present, `dialog:true`); endpoint `makeshiphappen.tech` | **Low** | Signature verification on; reasonable. Stale `Kaveli888/ShipTalk` GitHub URL in comments is cosmetic. |
| S-11 | **Overlay is always-on-top / visible-on-all-Spaces / click-through** | **Low** | UX/info-leak edge (pill may show "Listening" over other apps) but not a security hole. |

### Status of prior `SECURITY_AUDIT_REPORT.md` (Feb 2026)
That report is **stale and architecture-mismatched** (it describes a Web-Speech-only, no-backend, no-cloud app):
- **H-1 mock auth** → **RESOLVED** (real Supabase `signInWithPassword`, 5-attempt lockout) — but superseded by S-1 (gate not actually mounted).
- **H-2 CSP null** → **RESOLVED** (explicit CSP in `tauri.conf.json`, scoped connect-src). Note connect-src now intentionally allows the 4 cloud hosts.
- **H-3 re-render stops recognition** → engine rewritten; likely moot.
- **M-1 `Math.random()` IDs** → **RESOLVED** (`crypto.randomUUID()` in `useVoiceCommands.ts`).
- **M-3 audit logging** → log plugin now always-on at Info (`lib.rs` setup).
- **M-4 GDPR delete/export** → **STILL OPEN** (history persisted to localStorage + Supabase with no export and no confirmed bulk-delete UI).
- The report **predates and therefore never assessed**: Local Whisper, OpenAI/Groq cloud STT, Anthropic Polish, Supabase sync, Keychain secrets, global typing/Accessibility, the MCP server. Its "no AI APIs / no cloud / no HTTP client" passed-checks are now **false**. **Recommend re-running a full audit against the current architecture** (this document supersedes it for the voice cluster).

---

## PHASE 8 — OPEN SOURCE / LICENSING
- **whisper-rs 0.16** (MIT/Apache-2.0) → bundles **whisper.cpp** (Ggerganov, **MIT**). Models `ggml-base.en` / `ggml-small.en` derive from **OpenAI Whisper (MIT)**. No copyleft concern. `metal` feature → Apple Metal (system framework).
- **keyring 3** (MIT/Apache-2.0), **hound 3.5** (Apache-2.0/MIT, WAV), **core-graphics/core-foundation** (MIT/Apache-2.0), **tauri 2 + plugins** (MIT/Apache-2.0), **serde** (MIT/Apache).
- JS: **React 19 / Vite 7 / zustand / lucide-react / @supabase/supabase-js / @tauri-apps/** — all MIT (permissive). `better-sqlite3` (MIT) in the MCP. **framer-motion** (MIT) in ShipTranscribe.
- **No GPL/AGPL/copyleft dependencies observed.** Supply-chain note (carried from prior L-2): no `npm audit`/Dependabot workflow; lockfiles are committed (good).
- **Attribution gap:** whisper.cpp/Whisper and other MIT deps require license/copyright notice in distribution — no NOTICE/THIRD-PARTY-LICENSES file seen.

---

## PHASE 9 — MARKETING CLAIMS vs REALITY
The strongest in-repo evidence is the **developer's own audit comment in `Cargo.toml:28-31`** (verbatim):
> `# AUDIT: enables outbound HTTP to Anthropic/OpenAI/Groq/Supabase APIs.`
> `# This contradicts the "100% on-device" marketing claim.`
> `# If truly on-device-only, remove this plugin and the cloud transcription engines.`

This confirms a **"100% on-device" marketing claim exists** while the shipped app contains four cloud egress paths.

Other in-product framing:
- `cloudFeatures.ts` header (verbatim): *"Single source of truth for whether the app may call external APIs (OpenAI, Groq, Anthropic). Default: OFF (local-only)."* — Accurate as a default, but **Polish defaults ON** once a key + cloud flag are present, and cloud STT engines exist.
- Info.plist mic string (verbatim): *"ShipTalk uses your microphone to transcribe voice commands."* — fine.

**Exposure:** Marketing "100% on-device / private / local" is **materially misleading** for: (a) OpenAI/Groq engines (audio leaves), (b) Polish (text leaves to Anthropic — *even on the local engine*), (c) Supabase sync (text + user_id stored server-side). A user trusting "local/private" can have sensitive dictation shipped to three cloud vendors. Recommend either (i) drop the "100% on-device" claim, or (ii) make cloud paths opt-in with an explicit, per-feature "this sends your audio/text to X" disclosure (the dev comment offers the honest fix).

---

## Cross-references
- Repo-wide Supabase/owner-bypass findings (memory: *makeshiphappen Owner Bypass*, *Security Audit 2026-06-06*) — owner email hardcode (`owner.ts`) and RLS-dependence recur here.
- Same minisign updater pubkey shared by ShipTalk and ShipTranscribe.
