# Audit v2 — Phase 8 (Licenses) + Phase 7 (Committed Secrets)

Independent, read-only sweep. Derived from source only (did NOT read `docs/audit/` or `docs/business-protection/`).
Repo root: `/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective`
Date: 2026-06-07

> Repo layout note: the **root** git repo tracks only 7 files (`.gitignore`, three `*.command` launchers, `README.md`, `package.json`, `summarize_readme.sh`). The actual products are **independent nested git repos** committed separately: `ShipCode/`, `ShipSpace/`, `ShipTalk/`, `makeshiphappenAi/`, `shipmind/`, `ShipWatch/`. `ShipTranscribe/` is a working tree with no nested `.git` (untracked at root). License/secret analysis below is per-product.

---

# PART A — LICENSES

## A.1 Per-product dependency & license inventory

### shipmind (v2.0.3) — Tauri desktop app. `license` field: **(NONE)**
Notable JS deps: `@anthropic-ai/sdk`, `@supabase/supabase-js`, `@tauri-apps/*`, `@xyflow/react`, `framer-motion`, `howler`, `mermaid`, `react-markdown`, `remark-gfm`, `zod`, `zustand`, `lucide-react`, `geist`. Rust: `tauri 2`, `keyring 3`, `whisper-rs 0.16` (+ `metal`), `hound`, vendored `whisper-rs-sys-0.15.0` → `whisper.cpp`.
All JS deps are MIT/ISC/Apache-2.0/BSD permissive. **whisper.cpp = MIT** (confirmed: `shipmind/src-tauri/vendor/whisper-rs-sys-0.15.0/whisper.cpp/LICENSE`, "Copyright (c) 2023-2024 The ggml authors"). `@anthropic-ai/sdk` = MIT.

### ShipSpace (v0.1.3) — Tauri desktop app. `license` field: **(NONE)**
JS: `@supabase/supabase-js`, `@tauri-apps/*` (+ updater/shell/http/process/dialog), `@xterm/xterm` (+ addon-fit, addon-image), `framer-motion`, `lucide-react`, `react`, `zustand`. Rust: `tauri 2`, `keyring 3`, `reqwest 0.12` (rustls-tls). All permissive (MIT/Apache/BSD/MPL-2.0 for xterm addon-image is MIT). **Clean.**

### ShipTalk (v0.1.1) — Tauri desktop app. `license` field: **(NONE)**
JS: `@supabase/supabase-js`, `@tauri-apps/*` (global-shortcut/http/process/updater), `lucide-react`, `react`, `zustand`. Rust: `tauri 2` (`macos-private-api`), `keyring 3`, `whisper-rs 0.16` (`metal`), `hound`, `tauri-plugin-log`. **whisper.cpp = MIT.** Permissive. Clean.

### ShipWatch (ship-watch v0.1.0) — Tauri desktop app. `license` field: **(NONE)**
JS: `@tauri-apps/*` (autostart/positioner/sql/http/fs/shell/dialog), `framer-motion`, `lucide-react`, `react`, `zustand`. Rust: `tauri 2` (tray-icon), `tauri-plugin-sql` (sqlite). All permissive. Clean.

### ShipTranscribe (v0.1.0) — Tauri desktop app. `license` field: **(NONE)**
JS: `@tauri-apps/*` (shell/dialog), `framer-motion`, `lucide-react`, `react`, `zustand`. Rust: `tauri 2`, shell/dialog/updater plugins. References `ffmpeg`/`yt-dlp` in `src-tauri/src/lib.rs` (likely invokes shared sidecars). Permissive deps.

### makeshiphappenAi (shipspace v0.1.0) — Next.js web app + optional Electron. `license` field: **(NONE)**
JS: `next`, `react`, `@supabase/ssr` + `@supabase/supabase-js`, `stripe` + `@stripe/stripe-js`, `@google/generative-ai`, `e2b`, `pg`, `electron` + `electron-builder` + `electron-updater`, `node-pty`, `@xterm/xterm`, `zod`, `zustand`, `framer-motion`. All permissive. `electron` itself bundles Chromium (BSD-ish/permissive) — standard. No copyleft. Server-only secrets handled via `process.env` (not bundled).

### ShipCode (shipcode-cli v0.6.1) — Node CLI. `license` field: **`MIT`** (only product declaring a license in package.json)
JS: `@sentry/node`, `chalk`, `commander`, `glob`, `ora`. All MIT/permissive. **But: no LICENSE file present** (see A.4).

### Root (no name) — `expo`, `@types/react`, `typescript`. README declares "MIT" but no LICENSE file.

---

## A.2 Copyleft contamination assessment

**JS/Rust dependency graph: CLEAN.** No GPL/AGPL/LGPL npm or crate found in declared deps. All MIT/Apache-2.0/ISC/BSD/MPL-2.0.

**The contamination is in a BUNDLED BINARY — see A.3 (ffmpeg, GPL).**

---

## A.3 Bundled / sidecar binaries (the real license exposure)

Location: `shipmind/src-tauri/binaries/` (Tauri `externalBin`) and `shipmind/src-tauri/ollama-bundle/` (Tauri `resources`). Declared in `shipmind/src-tauri/tauri.conf.json` lines 50-56. **These binaries are bundled into and distributed with the shipmind desktop app.** (Note: they are NOT git-tracked — gitignored — but they ARE shipped in the built `.app`/`.dmg`.) `ShipTranscribe` also references ffmpeg/yt-dlp.

| Binary | Path | Version / build | License | Obligation | Severity |
|---|---|---|---|---|---|
| **ffmpeg** | `shipmind/src-tauri/binaries/ffmpeg-{aarch64,x86_64,universal}-apple-darwin` | **7.0, `--enable-gpl` + `--enable-libx264` + `--enable-libx265`** | **GPLv2+/GPLv3 (effectively GPLv3 via x265)** | **COPYLEFT. Distributing a GPL binary inside a proprietary closed-source app triggers GPL obligations: must offer corresponding source / written offer, must license-notice. x264/x265 are GPL; libfdk would be worse but not present.** | **CRITICAL** |
| **yt-dlp** | `shipmind/src-tauri/binaries/yt-dlp-{aarch64,x86_64,universal}-apple-darwin` | yt-dlp | **Unlicense (public domain)** | None (Unlicense). Note: facilitates downloading from sites whose ToS may prohibit it — usage/legal risk, not license risk. | Low (license) |
| **deno** | `shipmind/src-tauri/binaries/deno-{aarch64,x86_64,universal}-apple-darwin` | deno | **MIT** | Attribution/NOTICE in distribution. | Low |
| **ollama** | `shipmind/src-tauri/ollama-bundle/ollama` (77 MB) | **0.30.6** | **MIT** | Attribution/NOTICE. | Low |
| **libggml-\*.dylib / .so** | `shipmind/src-tauri/ollama-bundle/libggml-*` | ggml (part of ollama bundle) | **MIT** | Attribution. | Low |

**Runtime-downloaded model weights (NOT bundled — fetched on first use):**
| Model | Fetch | License / terms | Note |
|---|---|---|---|
| Whisper `ggml-base.en.bin` | `download_model` → `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin` (`shipmind/src-tauri/src/lib.rs:2119`) | OpenAI Whisper weights = **MIT** | Permissive; downloaded at runtime so no distribution obligation on the app itself. |
| `nomic-embed-text` (embedding) | pulled via Ollama (`shipmind/src-tauri/src/lib.rs:1092`, `EMBED_MODEL`) | **Apache-2.0** | Permissive. Runtime pull. |

No Gemma/Llama weights bundled or pulled (Gemini is API-only via `@google/generative-ai`; no Llama gguf found). So no non-OSI "acceptable-use"/Llama-community-license exposure currently.

### Missing attribution bundle
**NO `NOTICE` / `THIRD-PARTY` / `LICENSES` / attribution file exists in ANY product** (searched all six product dirs + ShipTranscribe — zero results). MIT/Apache/BSD/ISC deps and the bundled MIT binaries (deno, ollama, ggml) all require their copyright/license text be reproduced in distributed binaries. **This obligation is currently unmet for every distributed desktop app.** Severity: **Medium** (per-component); the ffmpeg GPL obligation is the **Critical** one.

---

## A.4 LICENSE-file present matrix

| Product | Declares license | LICENSE file present? | Notes |
|---|---|---|---|
| Root repo | README says "MIT" | **NO** | Claim unbacked. |
| ShipCode | `package.json: "MIT"` | **NO** | Declares MIT in metadata but no LICENSE file to back/enforce it. |
| ShipSpace | none | **NO** | |
| ShipTalk | none | **NO** | |
| ShipWatch | none | **NO** | |
| ShipTranscribe | none | **NO** | |
| shipmind | none | **NO** | Only LICENSE on disk is the vendored `whisper.cpp/LICENSE` (third-party, MIT). |
| makeshiphappenAi | none | **NO** | |

**Every product is missing a top-level LICENSE file.** Only third-party `whisper.cpp/LICENSE` exists in the tree.

---

## A.5 License summary

- **JS + Rust deps:** clean, all permissive. No copyleft in the dependency graph.
- **CRITICAL copyleft contamination:** the GPL-enabled **ffmpeg 7.0** (`--enable-gpl`, x264/x265) bundled into the proprietary **shipmind** desktop app (and referenced by ShipTranscribe). Distributing a GPL binary in a closed-source commercial app requires either (a) replacing it with an **LGPL/non-GPL ffmpeg build** (drop `--enable-gpl`, x264/x265) and dynamically linking, or (b) honoring GPL (offer source, GPL the combined work — not viable for a commercial product). **Recommend swapping to an LGPL ffmpeg build.**
- **Attribution debt:** no NOTICE/THIRD-PARTY file anywhere; MIT/Apache obligations for bundled deno/ollama/ggml and all npm deps are unmet in distributed binaries.
- **LICENSE files:** none of the 6 products (or root) ships an enforceable LICENSE file; ShipCode and root *claim* MIT without backing it. Without a LICENSE these are "all rights reserved" by default — fine for proprietary intent, but inconsistent with the public MIT claims.
- **Commercial-use:** all deps permit commercial use. The only blocker to commercial distribution is the GPL ffmpeg.

---

# PART B — COMMITTED SECRETS

Method: `git ls-files` per nested repo + working-tree grep for `sk-`, `sk-ant-`, `sk_live_/sk_test_`, `gsk_`, `AKIA`, `eyJ` JWTs, `ghp_/gho_`, `AIza`, `service_role`, `BEGIN PRIVATE KEY`, and committed `.env`. Excluded node_modules/target/.next/lighthouse. Did not read `docs/audit/`.

## B.1 Findings

| # | File:line | Kind | Real / Placeholder / Public-by-design | Severity |
|---|---|---|---|---|
| 1 | `ShipCode/src/auth/session.ts:11` | Supabase **anon** JWT (hardcoded) | **Public-by-design** — decoded payload `{"role":"anon","ref":"gvhbhoicvvoezjjartrt"}`; code comment "public anon key, safe to embed". Anon key is intended for client distribution; security relies on RLS, not key secrecy. | **Low** (informational) |
| 2 | `ShipCode/src/telemetry/analytics.ts:12-13` | Same Supabase **anon** JWT | Public-by-design (duplicate of #1). | **Low** |
| 3 | `ShipSpace/src-tauri/src/ship_memory.rs:199` | `BEGIN…PRIVATE KEY` literal | **NOT a secret** — it's a **redaction regex** that scrubs private keys from memory text. Defensive code, no key present. | **None** |
| 4 | `*/.env.example`, `makeshiphappenAi/.env 2.example` | Env templates | **Placeholders** (`your-anon-key-here`, `your-public-anon-key`). Tracked intentionally. | **None** |
| 5 | `makeshiphappenAi/supabase/migrations/*.sql` (002, 007, 009, 012) | `service_role` references | **NOT a secret** — these are Postgres **role names** in RLS policies/grants, not key values. | **None** |

**No live secrets found.** No `sk-ant-…`, no `sk_live_/sk_test_`, no `gsk_` Groq, no `AKIA`, no `ghp_/gho_`, no `AIza` Google key, no service_role *key value*, no private-key material committed anywhere in the working tree or any nested repo's tracked files.

## B.2 Local `.env` files (on disk, NOT committed)
`.env` files exist on disk at `ShipSpace/.env`, `ShipTalk/.env`, `shipmind/.env`, `shipmind/.claude/worktrees/chrome-extension-ingest/.env`. **All confirmed gitignored / untracked** (`git check-ignore` matches; `git ls-files` shows none). They may contain real keys locally but are NOT in version control. **Not exposed.**

## B.3 .gitignore coverage
Root `.gitignore` correctly ignores `.env`, `.env.local`, `.env.*.local`, `**/.env`, `**/.env.*` (with `!**/.env.example` allow-list), plus `node_modules/`, `**/target/`, `**/.next/`, `.claude/`, `*.log`, `*.map`. **Coverage is good.** No keychain/credential file patterns needed since secrets live in OS Keychain (see C), not files.

---

# PART C — Secrets-handling pattern observations (repo-level)

- **OS Keychain for desktop apps:** `ShipSpace`, `ShipTalk`, `shipmind` each have `src-tauri/src/secrets.rs` using the Rust **`keyring 3`** crate (`apple-native`/`windows-native`/`secret-service` features). API keys (Anthropic/Groq/OpenAI) are stored in the OS Keychain, **not** in files or localStorage. Strong pattern.
- **No localStorage secret storage:** grep for `localStorage.*(apiKey|token|secret|anthropic|groq|openai)` returned **0 hits** in product source. Good.
- **Server-side secrets via env:** `makeshiphappenAi` reads `STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from `process.env` only (e.g. `app/api/stripe/webhook/route.ts:13,33`, `app/api/stripe/checkout/route.ts:9`), with explicit "not configured" guards — never hardcoded, never shipped to client. Good.
- **Anon key embedded intentionally** in ShipCode CLI (client-distributed) — acceptable for Supabase anon keys provided RLS is enforced server-side (out of scope here; covered by other audit phases).

---

# Headline

- **Secrets posture: CLEAN.** No live/committed secrets. Only public-by-design Supabase anon JWT (intentional) + placeholders + a redaction-regex false positive. `.env` files all gitignored. Keychain-based secret handling.
- **License posture: ONE CRITICAL issue** — GPL ffmpeg bundled in a proprietary desktop app (shipmind/ShipTranscribe). Plus systemic gaps: zero LICENSE files across all 6 products (despite "MIT" claims), and zero NOTICE/attribution bundle for permissively-licensed bundled binaries and npm deps.
