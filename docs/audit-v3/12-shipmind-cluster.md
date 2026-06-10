# Per-Product Cluster Audit — ShipMind

> **Audit type:** Read-only risk / inventory / governance analysis.
> **Product:** ShipMind — local-first markdown "second brain" / knowledge & transcript manager.
> **Version audited:** desktop app `com.makeshiphappen.shipmind` v2.0.3; `shipmind-mcp` v0.1.0; `shipmind-extension` v0.1.0.
> **Date:** 2026-06-07
> **Scope note:** This document is the single deep reference for ShipMind only. The broader engagement covers four products (ShipTalk, ShipMind, ShipSpace, makeshiphappen.tech); cross-product themes (shared Supabase project, the makeshiphappen.tech updater/login dependency, repo hygiene) are flagged where they touch ShipMind but the deep treatment of the other three lives in their own cluster docs.

---

## 1. Executive Summary

ShipMind is a Tauri 2 desktop app (React/TypeScript renderer + ~5,700-line Rust backend exposing ~95 IPC command handlers) that ingests voice notes, audio/video, YouTube links, web pages, files and images, transcribes them **on-device** via Whisper, and stores everything in a single local SQLite database. The user can then "chat with" that corpus through a grounded AI agent using their own (bring-your-own) AI provider keys. It ships two satellites: a stdio **MCP server** that exposes the database read-only to external AI agents, and a **Chrome MV3 extension** for right-click ingest.

The product's privacy posture is genuinely strong in several respects: transcription is local, there are **no telemetry/analytics SDKs**, AI provider keys live in the **OS keychain** behind a provider allowlist, and the **release/signing/updater pipeline is well-hardened** (Developer-ID signing checks, `spctl` assessment, build-freshness guard, minisign-verified updates). SSRF-class egress (Brave scrape, yt-dlp) is guarded by a DNS-rebinding-aware URL validator.

The dominant risks are architectural rather than secret-leakage. First, the Tauri **webview-to-IPC blast radius** is large: the CSP keeps both `'unsafe-inline'` and `'unsafe-eval'`, any renderer script can call all ~95 commands, the filesystem write/copy capability spans all of `$HOME/**`, and hardened-runtime entitlements weaken code-signing — so a single rendered-markdown / in-app-browser injection becomes a broad read/write/persistence primitive. Second, the **data-governance model is undocumented**: full corpus content is egressed to whichever of 8 cloud AI providers the user configures with no in-app data map, no sub-processor list, and no per-provider retention disclosure. Third, **deletion is incomplete and there is no retention/TTL anywhere** — deleting a transcript or source leaves the raw audio/image on disk forever, and backups/logs/tmp grow unbounded, all unencrypted at rest. Fourth, the bundled **ffmpeg is a GPL build** redistributed inside a paid proprietary app with none of the GPL source-availability/notice obligations met, and the app ships **no attribution/NOTICES** at all.

**Correction to recon:** The recon notes claim the Supabase anon JWT is *committed* in `shipmind/.env`. Verification shows `.env` is **not git-tracked** (`git ls-files .env` returns nothing; `.gitignore:6-8` ignores it) and absent from history — so the secret-leak framing is downgraded; the residual concern is the dependence on server-side Supabase RLS for the client-side owner bypass, not a committed credential.

---

## 2. Component & Asset Inventory

| Component | Type / Version | Role |
|---|---|---|
| `shipmind` | Tauri desktop app, v2.0.3, `com.makeshiphappen.shipmind` | Main product (React/TS renderer + Rust backend) |
| `src-tauri/src/lib.rs` | Rust (~5,700 LOC, ~95 `#[tauri::command]`) | IPC backend: DB, ingest, transcription, files, web search |
| `secrets.rs` | Rust | OS keychain wrapper + provider allowlist |
| `browser_view.rs` / `youtube_view.rs` | Rust | In-app embedded browser + YouTube player webviews |
| `shipmind-mcp` | Node stdio MCP server, v0.1.0 | Read-only DB access for external AI agents (10 tools + transcript resources) |
| `shipmind-extension` | Chrome MV3 extension, v0.1.0 | Right-click ingest of link/page/selection |
| Whisper subsystem | `whisper-rs` / whisper.cpp (Metal) | On-device transcription |
| Ollama bundle | bundled daemon + embedding model | Semantic search / RAG embeddings (localhost:11434) |
| AI agent layer | `src/lib/agents` (8 provider adapters, tools, system prompt) | Grounded chat over corpus |
| Bundled binaries | ffmpeg, yt-dlp (PyInstaller), deno (~212MB), ollama + libggml dylibs | Media/runtime sidecars |

**Storage locations**

| Location | Contents | Encryption |
|---|---|---|
| `~/Library/Application Support/com.makeshiphappen.shipmind/shipmind.db` | Entire corpus: groups, transcripts, segments, sources, notes, bookmarks, tags, sessions, messages, artifacts, embeddings | **Plaintext** |
| `<appdata>/backups/shipmind-<ts>.db` | Full DB copies (`VACUUM INTO`) | **Plaintext, never pruned** |
| `<appdata>/audio/` | Archived original voice/audio | Plaintext, orphaned on delete |
| `<appdata>/source_images/` | Copied source images | Plaintext, orphaned on delete |
| `<appdata>/tmp/`, `ingest_debug.log` | Transient ingest, verbose log | Plaintext, unrotated |
| OS Keychain (`keyring`, service per channel) | AI provider API keys | Keychain-protected |
| `config.json` | App config (chmod 0600) | File perms only |
| Supabase (`gvhbhoicvvoezjjartrt.supabase.co`) | Auth + `profiles.subscription_tier` | Cloud (vendor) |
| Chrome `chrome.storage.local` | Ingest token (likely unused) | Browser store |

---

## 3. Data Flows

1. **Ingest → local DB.** Voice/audio/video/YouTube/files/images/web pages enter via IPC commands, are transcribed locally (Whisper) and written to `shipmind.db`. Original audio archived to `<appdata>/audio/`, images copied to `<appdata>/source_images/`. Ingest events appended to `ingest_debug.log`.
2. **Semantic search / RAG.** Embeddings generated via bundled Ollama (localhost), stored in DB, queried by `search_segments` / `search_source_chunks`.
3. **AI chat egress.** Renderer assembles system prompt + conversation (including verbatim transcript/source/note content via tool results) and sends it **directly from the webview** to the user-chosen cloud provider's API using the keychain-sourced key. Vision sends raw base64 images; Deep Research queries go to Groq.
4. **Web search.** `web_search` shells out to bundled `curl` to scrape Brave HTML (bypasses webview CSP), guarded by `validate_public_http_url`.
5. **Auth.** `signInWithPassword` → Supabase; reads `profiles` for `subscription_tier`; session JWTs persisted in webview `localStorage`.
6. **Update.** Tauri updater polls `https://makeshiphappen.tech/api/updates/shipmind/latest`, minisign-verified.
7. **MCP read-out.** `shipmind-mcp` opens `shipmind.db` read-only and serves the full corpus to any local agent over stdio (no auth).
8. **Extension.** Collects link/page/selection, POSTs to `http://127.0.0.1:8765/ingest` with a Bearer token — **no listener exists in app source**; the `shipmind://` deep-link fallback also has no registered handler. The documented ingest path is effectively dead.

---

## 4. Security Posture & Risk Ratings

### 4.1 Risk register

| # | Finding | Severity | Domain | Responsible party |
|---|---|---|---|---|
| S1 | CSP allows both `'unsafe-inline'` and `'unsafe-eval'` on the main webview | **High** | Security | ShipMind desktop |
| S2 | fs write/copy capability scoped to entire `$HOME/**` (no deny-list) → persistence/RCE-write primitive | **High** | Security | ShipMind desktop |
| S3 | Home-wide raw file readers (`read_file_text`/`list_directory`) gated by fragile deny-list, not allowlist | **High** | Security | ShipMind desktop |
| D1 | Deleting a transcript/source orphans on-disk audio/image forever (no file cleanup) | **High** | Privacy | ShipMind desktop |
| I1 | Full corpus egressed to user-chosen cloud AI providers with no data map / sub-processor disclosure | **High** | Integrations/Privacy | Owner + downstream providers |
| I2 | Tool-calling (source grounding) implemented only for OpenAI; 4 providers ignore tools while `modelSupportsTools` returns true → ungrounded answers on default models | **High** | Integrations | ShipMind desktop |
| I3 | Renderer calls vendors directly with `dangerouslyAllowBrowser` / direct-browser-access → XSS = key + corpus exfil to any allowed host | **High** | Security/Integrations | ShipMind desktop |
| L1 | Bundled ffmpeg is a GPL build redistributed in a paid proprietary app; GPL obligations unmet | **High** | Licenses | Distributor |
| S4 | Hardened-runtime entitlements weaken code-signing (`disable-library-validation`, `allow-jit`, etc.) | **Medium** | Security | ShipMind desktop |
| S5 | Provider keys returned in cleartext from keychain to webview | **Medium** | Security | ShipMind desktop |
| M1 | MCP server exposes entire DB read-only with no authentication | **Medium** | Security/Integrations | shipmind-mcp |
| D2 | No retention/TTL/pruning anywhere — unbounded growth of sensitive data | **Medium** | Privacy | ShipMind desktop |
| D3 | Primary DB and backups stored unencrypted at rest | **Medium** | Privacy | ShipMind desktop |
| N1 | Non-AI egress (Brave/YouTube/HuggingFace/Ollama) via bundled curl/yt-dlp bypasses CSP | **Medium** | Integrations | ShipMind desktop |
| A1 | Supabase project ref + anon JWT live in repo working tree (`.env`, **not committed**); entitlement integrity depends on RLS | **Medium** | Integrations/Privacy | Owner/dev |
| L2 | No attribution/NOTICES/Credits shipped — violates MIT/BSD/Apache/SIL-OFL notice clauses | **Medium** | Licenses | Distributor |
| B1 | Client-side-only owner bypass grants `team` tier to 2 hardcoded emails | **Medium** | Business/Auth | ShipMind / Supabase RLS |
| V1 | Tool-call args not schema-validated before dispatch (safe today, latent if write/exec tool added) | **Medium / Low** | Security | ShipMind desktop |
| I4 | CSP `connect-src` omits DeepSeek and Manus though both are first-class providers | **Low** | Integrations | ShipMind desktop |
| I5 | Gemini API key transmitted in URL query string | **Low** | Security/Privacy | ShipMind desktop |
| A2 | Supabase session JWTs persist in webview `localStorage` under permissive CSP | **Low** | Security | ShipMind desktop |
| E1 | Chrome extension ingest path (`localhost:8765`) unimplemented; token unused | **Low** | Governance | extension + desktop |
| D4 | `ingest_debug.log` records file paths/metadata in plaintext, unrotated | **Low** | Privacy | ShipMind desktop |
| H1 | Stale 1.3 GB `.git.bak` inside `shipmind/` (gitignored; no secret leak confirmed) | **Low** | Hygiene | Repo |
| L3 | Bundled deno/ollama/ggml + Apache-2.0/SIL-OFL components need notice files | **Low** | Licenses | Distributor |
| L4 | No `cargo-deny`/`cargo-about`/npm license-checker in CI | **Low** | Licenses | Distributor |
| P1 | No telemetry/analytics SDKs present | **Info (positive)** | Privacy | ShipMind desktop |
| P2 | Release/updater pipeline well-hardened | **Info (positive)** | Security | Release eng |
| P3 | Keys in OS keychain behind provider allowlist; `.env` not in git history | **Info (positive)** | Security | ShipMind desktop |

### 4.2 The core security narrative (S1–S3, I3)

The single root amplifier is the **CSP** (`tauri.conf.json:26`): `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. ShipMind renders abundant untrusted content — scraped web pages, website/file sources, AI markdown via `react-markdown`/`mermaid`, and an in-app browser. Any successful injection in that privileged webview runs arbitrary JS that can:

- Call **every** one of the ~95 `#[tauri::command]` handlers over IPC.
- Write to **all of `$HOME/**`** via the `fs:allow-write*`/`allow-copy-file` capability (`capabilities/default.json:16-42`) — including `~/.zshrc`, `~/Library/LaunchAgents`, `~/.ssh/authorized_keys` → code execution / persistence. The custom `is_sensitive_path` deny-list does **not** apply to these plugin fs:write capabilities.
- Read broad personal data via `read_file_text` (`lib.rs:1754`) and `list_directory` (`lib.rs:1693`), blocked only by a substring/filename deny-list `is_sensitive_path` (`lib.rs:1863`) that misses browser login DBs, other apps' Application Support tokens, `~/.config/<app>` secrets, etc.
- Read provider keys returned in cleartext from `get_api_key`/`get_provider_key` (`lib.rs:2177/2219`) and POST them — plus corpus — to any `connect-src`-allowed host, since adapters use `dangerouslyAllowBrowser:true` (`providers.ts:145`) and `anthropic-dangerous-direct-browser-access` headers.

These entitlements are partly **necessary** (yt-dlp PyInstaller + Ollama require `disable-library-validation`/`allow-jit`/`allow-unsigned-executable-memory`/`allow-dyld-environment-variables`), which is why S4 is Medium rather than High — but they compound any write primitive into code execution.

**Mitigating controls already present (do not regress):** the agent's *own* `read_file`/`list_dir` tools route through workspace-scoped `readWorkspaceFile`/`listWorkspaceDir` with `ensure_path_inside` (`agentChatStore.ts:159-187`, `lib.rs:1766`); SSRF egress is guarded by `validate_public_http_url` with `--` arg termination on yt-dlp; the MCP server wraps external content in an `<<UNTRUSTED EXTERNAL CONTENT>>` delimiter (`shipmind-mcp/src/index.ts:59-75`) and uses a readonly, parameterized DB handle.

---

## 5. Privacy & Data-Retention Posture

ShipMind markets itself as a **private second brain**, which raises the bar on retention and deletion completeness.

- **Deletion is incomplete (D1, High).** `delete_transcript` runs only `DELETE FROM transcripts` (`lib.rs:3294-3299`); `delete_source` only `DELETE FROM sources` (`lib.rs:4049-4054`). Neither removes archived audio (`<appdata>/audio/`, written `lib.rs:2706-2729,2816`) nor copied images (`<appdata>/source_images/`, `lib.rs:3960-3971`). The most sensitive data — raw voice recordings and document/image copies — survives the user-facing delete. This is a right-to-erasure / deletion-completeness gap.
- **No retention or TTL anywhere (D2, Medium).** `backup_db` (`lib.rs:489-525`) writes full DB copies and never prunes; `ingest_debug.log` is append-only (`lib.rs:2740-2748`); tmp is opportunistically reused. Effective policy is "retain forever," undisclosed.
- **Unencrypted at rest (D3, Medium).** No SQLCipher / `PRAGMA key`; schema and inserts are plaintext (`lib.rs:18-180`), and `backup_db` uses `VACUUM INTO` to a plaintext `.db`. iCloud/Time Machine/local processes capture the full corpus in the clear — the same file the no-auth MCP server reads.
- **Egress without a data map (I1, High).** Full content flows to whichever of 8 cloud providers the user configures (Anthropic/OpenAI/Gemini/Groq/DeepSeek/Perplexity/OpenRouter/Manus). No privacy policy, no sub-processor inventory, no per-provider retention/training/residency disclosure (note DeepSeek = China residency). Once data leaves the device it is governed by **the provider's** terms, not ShipMind's.
- **Positive (P1).** No PostHog/Sentry/Mixpanel/Amplitude. Non-user-initiated egress is limited to the updater check and Brave scraping. ShipMind does not silently exfiltrate usage analytics.

---

## 6. Integrations & AI Providers

### 6.1 AI providers (BYO key, direct from renderer)

| Provider | Endpoint | In CSP `connect-src`? | Tool-calling (grounding)? |
|---|---|---|---|
| Anthropic | api.anthropic.com | Yes | **No** (adapter ignores tools) |
| OpenAI | api.openai.com | Yes | **Yes** (only implementer) |
| Google Gemini | generativelanguage.googleapis.com | Yes | **No** |
| Groq (chat / Deep Research / vision) | api.groq.com | Yes | **No** |
| DeepSeek | api.deepseek.com | **No — blocked** | **No** |
| Perplexity | api.perplexity.ai | Yes | n/a |
| OpenRouter | openrouter.ai | Yes | n/a |
| Manus | api.manus.ai | **No — blocked** | Not wired (`providers.ts:594`) |
| Ollama (local) | localhost:11434 | Yes (localhost) | — |
| Whisper (local) | on-device | n/a | — |

- **I2 (High) — grounding silently fails on default models.** `modelSupportsTools` (`agents/tools.ts:173-177`) returns true for llama/qwen/gpt/claude, but only `openai.ts` implements `runToolLoop`. Anthropic/Groq/Google/DeepSeek adapters never invoke corpus-search tools. The default Groq llama-3.3-70b and Anthropic Claude therefore answer **ungrounded**, breaking the "grounded answers with citations" promise. (Paradoxically these leak *less* — no tool round-trips — but the feature is broken.)
- **I4 (Low) — provider sprawl vs CSP.** DeepSeek and Manus are first-class in `secrets.rs` ALLOWED_PROVIDERS and `PROVIDER_CONFIGS`, but absent from `connect-src`, so DeepSeek chat is CSP-blocked at runtime. The provider list overstates what works, and the allowlist is the only egress control.
- **I5 (Low) — Gemini key in URL.** `providers.ts:331/398` append `?key=${apiKey}`; keys in URLs leak to history/proxy logs. (`vision.ts:197` correctly uses the `x-goog-api-key` header.)

### 6.2 Non-AI third parties

- **Supabase** (auth + `profiles`). Project ref + anon JWT live in `shipmind/.env` (working tree, **not committed** — verified). Anon role only; entitlement integrity rests on RLS (see §7). **A1, Medium.**
- **makeshiphappen.tech** — updater endpoint, embedded `frame-src`, and the browser-login origin (`auth.ts:94`). High-value single point of trust; updates are minisign-verified so endpoint compromise alone cannot push unsigned code. **(Low.)**
- **Brave / YouTube / HuggingFace / Ollama registry** reached via bundled curl/yt-dlp/deno — **outside CSP** (`lib.rs` comment at 1806 acknowledges this). **N1, Medium.** Belongs in the sub-processor inventory.
- **MCP server (M1, Medium)** — no auth; any local process gets the full corpus read-only. Inherent to stdio MCP but must be threat-modeled and documented as a trust boundary.
- **Chrome extension (E1, Low)** — `127.0.0.1:8765/ingest` has no listener in app source; the documented ingest path is dead and the user-pasted token is unused. Recommend removing the dead `host_permission` to shrink attack surface.

---

## 7. Authorization & Owner Bypass (B1, Medium)

`src/lib/owner.ts:3-6` hardcodes two `OWNER_EMAILS` (`zzgemsjewelry@gmail.com`, `aryah.yeasley@icloud.com`); `auth.ts:102/119` forces `tier='team'` for them regardless of `profiles.subscription_tier`. This is a **client-side** gate — a user could locally patch tier to `team` anyway — so the only real defense for premium features/data is **server-side Supabase RLS**. As built it merely flips a local flag (impact limited), but entitlement integrity is tightly coupled to correct RLS configuration. No credentials are hardcoded; these are email identifiers only.

---

## 8. Licenses & Dependencies

The npm and Cargo trees (Cargo.lock: 570 crates) are almost entirely permissive (MIT/ISC/Apache-2.0/BSD/Unlicense/SIL-OFL); no copyleft risk in the package managers. The exposure is concentrated in **bundled native binaries**.

- **L1 (High) — GPL ffmpeg in a paid proprietary product.** Bundled `binaries/ffmpeg-*` is built `--enable-gpl --enable-libx264 --enable-libx265` (per `ffmpeg -version`), making the redistributed binary GPL-2.0-or-later. The app shells out to it (`lib.rs:966`). Distribution requires: (1) GPL license text, (2) corresponding source / written offer for the exact ffmpeg+x264+x265 build, (3) GPL disclosure. **None are present** in repo or bundle. Remediation: ship a non-GPL/LGPL ffmpeg build (drop `--enable-gpl` and x264/x265 encoders) **or** fully comply with GPL source-offer + notices.
- **L2 (Medium) — no attribution at all.** No LICENSE/NOTICE/THIRD-PARTY-LICENSES/Credits file or About-Licenses screen anywhere (only the upstream vendored `whisper.cpp/LICENSE`). The app distributes dozens of MIT/BSD/ISC deps, Apache-2.0 (`class-variance-authority`), SIL-OFL (Geist font), and bundled binaries (deno/V8, yt-dlp, whisper.cpp, ollama/ggml) — **all** of whose notice clauses are unmet. Low effort to fix; broad for a paid product.
- **L3 (Low)** — Apache-2.0 NOTICE propagation (cva), SIL-OFL font text (Geist), and V8/ICU notices embedded in deno specifically need enumeration.
- **L4 (Low)** — no `cargo-deny`/`cargo-about`/npm license-checker to catch a future copyleft crate or auto-generate the attribution bundle.
- **Info** — `libvips` (LGPL-3.0 via sharp via Next.js) sits in `node_modules` but is **not** imported or distributed by the Tauri app; hygiene note only. MCP server and extension dependency surfaces are clean (permissive).

---

## 9. Liability Hotspots

1. **GPL ffmpeg redistribution (L1).** Highest commercial-legal exposure: shipping a GPL binary in a paid closed-source product without meeting source-availability/notice obligations is an enforceable license violation.
2. **No privacy policy / data map for multi-provider egress (I1).** A "private second brain" that silently sends the full corpus to 8 third parties with no disclosure invites consumer-protection and misrepresentation claims, and complicates any GDPR/CCPA data-subject request.
3. **Incomplete deletion (D1).** Voice recordings and document copies surviving a user-initiated delete undermines any "you control your data" claim and a right-to-erasure response.
4. **Webview→IPC blast radius (S1–S3, I3).** A single XSS becomes broad data exfiltration + machine compromise; material product-liability/security-incident exposure given the breadth of `$HOME` access.
5. **Owner bypass + client-side entitlement (B1).** Revenue/authorization integrity depends entirely on RLS being correctly configured server-side.
6. **Missing attribution bundle (L2).** Many small, individually-low but collectively-broad notice obligations unmet.

---

## 10. User-Responsibility Assignment

| Concern | ShipMind / Make Ship Happen (vendor) | End user | Downstream provider |
|---|---|---|---|
| On-device storage encryption | Owns (no encryption today) | Disk-level FileVault | — |
| Deletion completeness | **Owns** (fix orphan-on-delete) | — | — |
| Corpus egress to AI APIs | Owns disclosure + data map | Chooses provider + key | Owns retention/training of received data |
| Provider API key custody | Keychain storage (good) | Supplies/rotates key | Validates key |
| Premium entitlement enforcement | **Owns** (must be server-side RLS) | — | Supabase |
| MCP read-out exposure | Owns documentation/threat model | Controls which agents may spawn it | — |
| GPL/attribution compliance | **Owns** (distributor) | — | — |
| Webview injection blast radius | **Owns** (CSP, capabilities, entitlements) | — | — |
| Update integrity | Owns (minisign — good) | Accepts update | makeshiphappen.tech endpoint |

---

## 11. Prioritized Recommendations

1. **Fix deletion (D1):** delete archived audio/images alongside DB rows; add a one-time orphan sweep.
2. **Remediate GPL ffmpeg (L1):** switch to a non-GPL build or meet GPL source-offer + notices.
3. **Tighten the webview blast radius (S1–S3):** remove `'unsafe-eval'` and inline scripts; scope `fs:write/copy` to `$APPDATA`/`$APPLOCALDATA` + a chosen workspace; convert raw file readers to an **allowlist**.
4. **Publish a privacy policy + in-app data map / sub-processor list (I1)**; surface per-provider data-handling before first egress.
5. **Ship an attribution/NOTICES bundle + About-Licenses screen (L2/L3)**; add `cargo-deny` + `cargo-about` + npm license-checker to CI (L4).
6. **Fix or honestly degrade tool-calling (I2):** implement `runToolLoop` for Anthropic/Groq/Google/DeepSeek or have `modelSupportsTools` return false for unsupported adapters so the grounding promise is accurate.
7. **Add encryption at rest + a retention/pruning policy (D2/D3):** SQLCipher or app-layer encryption; prune backups/logs/tmp; document retention.
8. **Confirm Supabase RLS (B1/A1)** is enforced for all premium gates; move Gemini key to header auth (I5); remove the dead extension ingest endpoint + token (E1); delete stale `.git.bak` (H1).

---

## 12. Evidence Index (key citations)

- CSP / updater / signing — `shipmind/src-tauri/tauri.conf.json:26,30-37,50-63`
- fs capability — `shipmind/src-tauri/capabilities/default.json:16-42`
- Owner bypass — `shipmind/src/lib/owner.ts:3-6`; `shipmind/src/lib/auth.ts:102,119`
- Raw file readers / deny-list — `lib.rs:1693,1754,1863`; SSRF guard `lib.rs:1806-1809,2394,2438`
- Delete handlers — `lib.rs:3294-3299` (transcript), `4049-4054` (source); audio/image writes `lib.rs:2706-2729,2816,3960-3971`
- Backups / logs — `lib.rs:489-525,516,2740-2782`
- Keychain / allowlist — `secrets.rs:6-19,31-36`; key read `lib.rs:2177,2219`; migration `lib.rs:2144-2155`
- Provider adapters — `src/lib/providers.ts:145,331,398,474-513,594`; `src/lib/agents/providers/openai.ts:152-161`; `vision.ts:197`; `agents/tools.ts:173-177`
- MCP server — `shipmind-mcp/src/index.ts:40,59-75`
- Extension — `shipmind-extension/background.js:5,57,91-123`; `manifest.json:7`
- `.env` **not** tracked — verified `git ls-files .env` returns empty; `.gitignore:6-8`
- ffmpeg GPL build — `ffmpeg -version` (`--enable-gpl --enable-libx264 --enable-libx265`); bundle `tauri.conf.json:50-53`

*End of ShipMind cluster audit.*
