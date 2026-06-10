# 15 — Dependency Licenses & Secrets-in-Repo Audit

Auditor: independent license + secrets sweep (read-only).
Date: 2026-06-07
Scope: whole repo `/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/`.
Method: enumerated committed manifests; classified licenses from known facts; ran targeted secret-pattern greps over source (excluded `node_modules/`, `src-tauri/target/`, `.next/`, `dist/`, `build/`, `.claude/worktrees/`, lockfiles, `*.pdf`).

---

# SECTION 1 — LICENSES (Phase 8)

## 1.1 Apps & manifests inventory

| App / package | Manifest | Type | Declared `license` field |
|---|---|---|---|
| root | `package.json` | Expo/RN shell | none |
| ShipCode | `ShipCode/package.json` | Node CLI | **MIT** (only one declared) |
| ShipSpace | `ShipSpace/package.json` + `src-tauri/Cargo.toml` | Tauri desktop | none |
| ShipTalk | `ShipTalk/package.json` + `src-tauri/Cargo.toml` | Tauri desktop (whisper) | none |
| ShipTranscribe | `ShipTranscribe/package.json` + Cargo | Tauri desktop | none |
| ShipWatch | `ShipWatch/package.json` (+ `server/`) + Cargo | Tauri desktop | none |
| shipmind | `shipmind/package.json` + Cargo (whisper) | Tauri desktop | none |
| makeshiphappenAi | `makeshiphappenAi/package.json` | Next.js web + Electron | none |
| ship-aos | `ship-aos/package.json` | Next.js web | none |
| ship-memory (+ core/mcp/connector-obsidian) | several | TS libs/MCP | none |
| shipmind-mcp / shiptalk-mcp / shipspace-mcp | several | MCP servers | none |
| packages/account-menu | `packages/account-menu/package.json` | shared lib | none |

Rust crates (Cargo.toml direct deps): tauri + tauri-plugin-* , serde, serde_json, tokio, uuid, chrono, log, reqwest, axum, tower-http, regex, url, base64, keyring, portable-pty, rusqlite, pdf-extract, hound, **whisper-rs**, **whisper-rs-sys** (vendored at `shipmind/src-tauri/vendor/whisper-rs-sys-0.15.0`), objc2/objc2-app-kit/objc2-foundation, core-graphics/core-foundation, dirs-next, percent-encoding.

## 1.2 Notable third-party dependency license table

| Dependency | Ecosystem | License | Ship-to-user implication |
|---|---|---|---|
| react / react-dom | npm | MIT | Notice retention |
| next | npm | MIT | Notice retention |
| @tauri-apps/* (api + cli + plugins) | npm | MIT / Apache-2.0 (dual) | OK; Apache NOTICE if present |
| tauri, tauri-plugin-* (Rust) | crates | MIT / Apache-2.0 | OK |
| zustand, framer-motion, lucide-react, clsx, tailwind-merge, class-variance-authority | npm | MIT | Notice retention |
| @xterm/xterm + addons, xterm | npm | MIT | Notice retention |
| @xyflow/react (react flow) | npm | MIT | Notice retention |
| mermaid | npm | MIT | Notice retention |
| react-markdown, remark-gfm, rehype-highlight, highlight.js, cmdk | npm | MIT | Notice retention |
| howler | npm | MIT | Notice retention |
| geist (font) | npm | OFL-1.1 (font) / MIT pkg | Font under SIL OFL — fine to bundle; **VERIFY** OFL notice retained |
| zod | npm | MIT | Notice retention |
| @supabase/supabase-js, @supabase/ssr | npm | MIT | Notice retention |
| @anthropic-ai/sdk | npm | MIT | Notice retention |
| @google/generative-ai | npm | Apache-2.0 | NOTICE/attribution |
| stripe, @stripe/stripe-js | npm | MIT | Notice retention |
| pg (node-postgres) | npm | MIT | Notice retention |
| e2b | npm | MIT (**VERIFY**) | Notice retention |
| electron | npm | MIT | Notice retention; Chromium/Node sub-components carry BSD/MIT/LGPL — Electron bundles its own license set |
| electron-builder, electron-updater, @electron/rebuild | npm | MIT | dev/runtime, MIT |
| node-pty | npm | MIT | Notice retention |
| @sentry/node | npm | **MIT** (SDK) | OK (server SaaS is separate) |
| chalk, commander, glob, ora, hono | npm | MIT | Notice retention |
| @modelcontextprotocol/sdk | npm | MIT | Notice retention |
| **better-sqlite3** | npm | **MIT** (binding); bundles **SQLite = public domain** | OK |
| @tanstack/react-table | npm | MIT | Notice retention |
| typescript, vite, vitest, eslint, postcss, autoprefixer, tailwindcss | npm | MIT (Apache-2.0 for TS) | dev-only mostly |
| tailwindcss v4 / @tailwindcss/postcss (ship-aos) | npm | MIT | dev |
| **whisper.cpp / ggml** (via whisper-rs) | C/C++ | **MIT** | OK; retain MIT notice in distributed binary |
| **whisper-rs** | crate | **Unlicense / MIT** (dual) | OK (public-domain-equivalent) |
| **whisper-rs-sys (vendored 0.15.0)** | crate | **Unlicense** (confirmed in vendored `Cargo.toml`) | Public domain; no obligation |
| Whisper model weights (ggml-*.bin) | model | **MIT** (OpenAI Whisper) | NOT committed — downloaded at runtime; retain MIT attribution where redistributed |
| rusqlite (bundled SQLite) | crate | MIT (SQLite public domain) | OK |
| keyring | crate | MIT / Apache-2.0 | OK |
| reqwest, axum, tower-http, tokio, hyper-stack | crates | MIT / Apache-2.0 | OK |
| pdf-extract | crate | MIT (**VERIFY** — some PDF crates are MPL) | mostly MIT; verify transitive `lopdf` (MIT) |
| hound (WAV) | crate | Apache-2.0 | NOTICE/attribution |
| serde, serde_json, uuid, chrono, regex, url, base64, log, dirs-next | crates | MIT / Apache-2.0 | OK |
| objc2 / objc2-app-kit / objc2-foundation, core-graphics, core-foundation | crates | MIT / Apache-2.0 / Zlib | OK |
| portable-pty (wezterm) | crate | MIT | OK |

## 1.3 Copyleft / commercially-restrictive scan — RESULT: CLEAN

A repo-wide grep for `GNU General Public`, `AGPL`, `GPLv`, `SSPL`, `Business Source`, `Elastic License`, `non-commercial`, `noncommercial` across non-artifact `*.md/*.toml/*.json` returned **zero** hits.

- No GPL / AGPL / LGPL direct dependency identified.
- No SSPL / BSL / Elastic / CC-NC dependency identified.
- The two binary-heavy native components most likely to carry copyleft — **whisper.cpp/ggml** and **SQLite** — are MIT and public-domain respectively. Clean.
- Electron (makeshiphappenAi) bundles Chromium/Node; those ship under permissive (BSD/MIT) + some LGPL components, but Electron handles its own bundled license set — no project action beyond shipping Electron's `LICENSES.chromium.html` (which electron-builder includes automatically). **VERIFY** for the makeshiphappenAi desktop build.

No copyleft license **conflicts** for a desktop app shipped to users.

## 1.4 Attribution / NOTICE obligations — GAP

The entire permissive stack (MIT/BSD/ISC/Apache-2.0) requires the **copyright notice + license text be retained in distributed binaries**, and Apache-2.0 deps (Google generative-ai SDK, hound, TypeScript, parts of Tauri/Rust crates) additionally require any `NOTICE` file be reproduced.

- `git ls-files` for `NOTICE`, `LICENSE(S)`, `THIRD-PARTY`, `ATTRIBUTION` (excluding node_modules) returned **NOTHING** — there is **no bundled third-party-licenses / NOTICE file** anywhere in the tree, and **no root `LICENSE` file** at all (README just says "MIT" in prose).
- Tauri apps do not auto-generate a third-party attribution bundle. So as currently structured, the shipped `.app` binaries **omit required upstream attribution**. This is a low-severity but real compliance gap. Recommended: generate `cargo about` (Rust) + `license-checker`/`oss-attribution-generator` (npm) output and ship a `licenses.html` in each app bundle (and Electron's auto-included Chromium license for makeshiphappenAi).

## 1.5 Repo's own license vs proprietary products

- Root `README.md` declares the project **MIT** (prose only, no `LICENSE` file present).
- Only `ShipCode/package.json` actually carries `"license": "MIT"`; every other `package.json` has **no license field** (defaults to UNLICENSED/all-rights-reserved per npm semantics).
- This is **inconsistent**: the README claims MIT for the whole collective, yet these are commercial products (Stripe subscriptions, comp-access gating, owner-bypass logic per memory). Shipping closed commercial desktop apps while the umbrella README says "MIT" is a contradiction a user could rely on to fork/redistribute the apps.
- Recommendation (non-blocking, product decision): either (a) add a real root `LICENSE` and per-package `license` fields that match intent (likely "UNLICENSED" / proprietary for the shipped apps, MIT only for genuinely-open pieces like ShipCode), or (b) confirm the whole collective is intentionally MIT. Currently the declared license is **ambiguous**, which is itself a minor legal risk.

---

# SECTION 2 — SECRETS-IN-REPO SWEEP (Phase 7 input)

## 2.1 Tracked .env / credential files — RESULT: NONE COMMITTED (good)

- `git ls-files | grep -iE '\.env'` → **empty**. No `.env`, `.env.local`, `.env.production.local` is git-tracked.
- `git ls-files | grep -iE 'env|secret|credential|keychain|\.pem|\.key|\.p12'` → **empty**. No keychains, PEM/key/p12, or credential files tracked.
- Real env files **do exist on disk** but are all untracked and `git check-ignore`-confirmed IGNORED:
  - `ShipSpace/.env`, `ShipTalk/.env`, `shipmind/.env` → IGNORED
  - `makeshiphappenAi/.env.local`, `makeshiphappenAi/.env.production.local`, `makeshiphappenAi/.vercel/.env.development.local` → IGNORED
  - `shipmind/.claude/worktrees/.../.env` → IGNORED
- Note: even the `.env.example` files seen on disk are **not tracked** in the current index (git ls-files returns none) — so the repo currently commits no env files of any kind.

## 2.2 High-signal secret pattern grep results

| Pattern | Hits | Verdict |
|---|---|---|
| `sk-ant-…` (Anthropic) | 0 real | none |
| `sk_live_…` (Stripe live) | 0 | none |
| `sk_test_…` / `whsec_…` | only `makeshiphappenAi/SECURITY_AUDIT_REPORT.md:92-93` as `sk_test_XXXX…` / `whsec_XXXX…` | **placeholders**, not real |
| `AKIA…` (AWS) | 0 | none |
| `ghp_` / `gho_` (GitHub) | 0 | none |
| `-----BEGIN … PRIVATE KEY-----` | 0 | none |
| `eyJ…` JWT in source | 2 lines | Supabase **anon** key (see below) |
| `SERVICE_ROLE` / `SUPABASE_SERVICE` | several | all `process.env.SUPABASE_SERVICE_ROLE_KEY` **env-var references**, never a literal (`webhook/route.ts`, `lib/supabase/admin.ts`, docs). No service-role key value in repo. |
| hardcoded `password=/api_key='literal'` | 0 | none |
| secrets logged to console/disk (`console.log`/`println!` of key/token) | 0 | none |

## 2.3 Committed JWT detail (the only embedded credential)

Two source lines embed the **same Supabase anon JWT**:
- `ShipCode/src/auth/session.ts:11` — `const SUPABASE_ANON_KEY = 'eyJhbGci…REDACTED…LX_WVY'`
- `ShipCode/src/telemetry/analytics.ts:13` — same token (redacted)

Decoded payload: `"role":"anon"`, `"ref":"gvhbhoicvvoezjjartrt"`. This is the **public anonymous key**, designed to be shipped to clients (the code comment even states *"public anon key, safe to embed (it's exposed to browser clients)"*). It is **NOT** a service-role key. Security of the project depends on Supabase Row-Level Security being enforced for this `gvhbhoicvvoezjjartrt` project — that is an RLS-policy concern (covered elsewhere), not a secrets-leak. **Not a real secret exposure.**

The same anon JWT also appears base64-embedded inside non-secret assets (`logo-data.ts` PNG EXIF blobs) — irrelevant noise, excluded.

## 2.4 .gitignore coverage — adequate

Root `.gitignore` env block:
```
.env
.env.local
.env.*.local
**/.env
**/.env.*
!**/.env.example
```
Covers nested `.env` files across all sub-apps with a correct negation for `.env.example`. There is only one `.gitignore` (root, recursive `**/` patterns) and it is sufficient. No explicit ignore for `*.pem`/`*.key`/keychains, but none of those exist in-tree, so low priority (recommend adding `*.pem *.key *.p12 *.keychain` defensively).

## 2.5 Secrets logged to disk/console — NONE

Grep for `console.log/error/warn` and Rust `println!/eprintln!/log::` emitting `apiKey|api_key|anthropic|secret|token|password|service_role` (excluding "not configured/missing/error" guard messages) returned **0** real leaks. ShipCode writes its OAuth session to `~/.shipcode/auth.json` with `chmodSync(…, 0o600)` — correct restrictive perms.

## 2.6 Secrets exposure rating

| Finding | Severity |
|---|---|
| Real `.env`/service-role/private keys committed | **None found — N/A** |
| Supabase **anon** key embedded in ShipCode source | **Low** (intended-public; relies on RLS) |
| `sk_test_/whsec_` placeholders in audit doc | **Informational** (not real) |
| No `*.pem/*.key` ignore rule (defensive only) | **Low** |

**Overall secrets-exposure rating: LOW.** No real/private secret is committed to the repository.

---

# TL;DR

- **No real secrets committed.** Only a public Supabase **anon** JWT (explicitly safe-to-embed) is in source; all service-role keys are `process.env` references; `.env`/`.env.local`/`.env.production.local` exist on disk but are gitignored and untracked. Secrets exposure: **LOW**.
- **No copyleft/restrictive license conflicts.** Entire stack is MIT/Apache-2.0/BSD/ISC/Unlicense/public-domain. whisper.cpp/ggml = MIT, whisper-rs-sys (vendored) = Unlicense, SQLite = public domain, Whisper weights = MIT (downloaded at runtime, not committed).
- **Two real gaps, both low severity:** (1) **no NOTICE / third-party-licenses file is bundled** with any shipped app despite MIT/Apache attribution requirements — generate and ship a `licenses.html` per app; (2) **declared license is inconsistent** — README says "MIT" for the collective with no root `LICENSE` file, while the shipped apps are commercial and have empty `license` fields; reconcile intent (proprietary for apps, MIT only for ShipCode).
