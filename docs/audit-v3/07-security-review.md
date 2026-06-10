# Phase 7 — Security Review

**Audit version:** v3
**Scope:** ShipTalk, ShipMind, ShipSpace (all Tauri 2 macOS desktop apps + their companion MCP servers and browser extensions) and the makeshiphappen.tech website (`makeshiphappenAi/` — Next.js 16 App Router).
**Method:** Read-only risk inventory and risk-rating. No source code was modified. Severity ratings only; no remediations prescribed. Evidence is cited as `path:line` where available.
**Posture assumption:** the software is assumed to function correctly; this review evaluates security/trust risk, not correctness.

---

## 1. Executive Summary

The four products share a consistent and mostly-sound *secrets-at-rest* design: provider API keys live in the macOS keychain (never in `localStorage` or committed `.env`), the website never exposes keys to the browser, release pipelines are hardened (universal-arch + Developer-ID + `spctl` + minisign-verified updates), and several explicit defense-in-depth controls (cloud-features gate default-OFF, SSRF guards, argv-safe `osascript`, RLS migrations) are real and worth preserving.

The risk concentrates at two surfaces the brief asked us to lead with:

1. **ShipSpace command execution.** ShipSpace is, by design, a high-privilege agent-orchestration IDE that spawns real shells, runs autonomous Claude agents, and shells out to `git`/`gh`. The most material findings are: an unauthenticated localhost MCP control bus (origin check accepts no-origin requests), `read_file`/`list_directory` with **zero** path confinement (full-disk read), a `run_shell_cmd` allowlist that gates only the binary name while permitting `node`/`npm`/`npx`/`python` (effectively arbitrary code execution), and raw-PTY shell access for agents with only advisory prompt-level guardrails.

2. **Website auth & billing.** The website is well-hardened overall, but the CLI login flow (`/auth/cli-login`) relays a live, refreshable Supabase session (access + refresh token) to an **unvalidated localhost port** taken from the URL query string — a session-theft / account-takeover vector. The hardcoded `OWNER_EMAILS` privilege bypass is safe **only** if Supabase email-confirmation is enabled in production (unverifiable from code, and the site deploys from a *separate* nested git repo via `vercel --prod`, so live ≠ audited is a standing governance risk).

Two recon-flagged ShipSpace risks were confirmed **already mitigated** in current code and are recorded as positives so they are not re-opened: the auto-responder never auto-approves "risky" prompts (`auto-responder.ts:53` returns `false` for `risk==='risky'` regardless of mode), and `claude_pty_create` defaults to `--permission-mode default`, escalating only to `acceptEdits` (never `bypassPermissions`) when explicitly opted in.

Across all desktop apps, the dominant structural risk is the **Tauri webview-to-IPC blast radius**: permissive CSP (`unsafe-inline`/`unsafe-eval` in ShipMind; `blob:`/`wasm-unsafe-eval`/localhost in ShipSpace), broad filesystem capabilities, and weakened macOS hardened-runtime entitlements mean a single rendered-markdown/in-app-browser XSS or prompt-injection becomes a broad read/write/execute primitive. All four products also share **client-trusted subscription gating** with hardcoded owner emails — a business/authorization-trust concern whose only real backstop is server-side Supabase RLS.

---

## 2. Severity Distribution

| Severity | Count | Products |
|---|---|---|
| Critical | 0 | — |
| High | 9 | ShipTalk (3), ShipMind (3), ShipSpace (3) |
| Medium | 13 | ShipTalk (5), ShipMind (3), ShipSpace (3), Website (2) |
| Low / Info | 21 | spread across all four |

No issue rises to Critical: the highest-impact desktop primitives require an attacker foothold (local same-user process, a webview-context compromise, or prompt injection into an agent), and the website's worst case (cli-login token theft) requires a victim to open a crafted page while authenticated.

---

## 3. ShipSpace — Command Execution & Agent Privilege (lead surface)

ShipSpace's threat model is deliberately permissive: it is an agent IDE that runs code. The findings below rate *residual* risk given that design intent.

| # | Finding | Severity | Evidence |
|---|---|---|---|
| SS-1 | `read_file`/`list_directory` have **no path confinement** — any file on disk is readable | **High** | `lib.rs:492-495` (bare `fs::read_to_string`), `lib.rs:371-429` (dir listing, dotfile-skip only); asymmetric vs sandboxed `write_file` at `lib.rs:448-473` |
| SS-2 | `run_shell_cmd` allowlist gates only the **binary name**, not args — `node`/`npm`/`npx`/`python` = arbitrary code execution | **High** | `ALLOWED_COMMANDS` `lib.rs:660-666` (verified: `node, npm, npx, cargo, python, python3, pip, …`); base-name check `lib.rs:674-685`; LLM-driven args via `cli.ts` (hermes/openclaw) |
| SS-3 | Raw-PTY shell access for agents with no typed-intent layer (accepted design risk) | **High** | `pty.rs:1-10` explicit `TODO(security)`; `spawn_in_pty` `pty.rs:209-350`; `pty_input` writes arbitrary bytes `pty.rs:352-371`; `claude_pty_create` `orchestrator.rs:480-490` |
| SS-4 | Orchestrator MCP HTTP server on `127.0.0.1` has **no auth** — only an origin check that accepts no-origin requests | **Medium** | `orchestrator.rs:120-148` (axum bind); `origin_ok()` `orchestrator.rs:555-560` (`None => true`); reads/claims agent-task bus per `terminal_id` |
| SS-5 | Untrusted GitHub issue bodies + browser page content fed into agent context (prompt injection) | **Medium** | `gh_issue_view` `github.rs:645-653`; browser snapshot up to 20k chars `browser_view.rs:199-200`; Ship Memory body un-validated `orchestrator.rs:296-315` |
| SS-6 | Provider API keys held in plaintext in renderer's in-memory store after hydration | **Medium** | `useApiKeyStore.ts:51-67`, `getApiKey` `:85`; permissive CSP allows `blob:`/`wasm-unsafe-eval`/`http://localhost:*` (`tauri.conf.json:28`) |
| SS-7 | Weakened macOS hardened runtime (disable-library-validation + unsigned-exec-mem + dyld env) on a signed/notarized, entitled app | **Medium** | `Entitlements.plist:5-12`; real Developer ID at `tauri.conf.json:53` |
| SS-8 | `open_path` passes an arbitrary path to macOS `open` with no validation | **Low** | `lib.rs:483-490` (launches `.app`/URL-handlers); current callers trusted |
| SS-9 | `shipspace-mcp get_state_raw` exposes broad persisted state (chats/prompts/workspaces) to any co-resident MCP client | **Low** | `index.ts:444-462`; credential keys correctly denied `index.ts:150-154`, allowlist `:138-148` |
| SS-10 | Subscription/entitlement gating is client-trusted (owner-email bypass + tier-preserved-on-error) | **Low** | `owner.ts` (hardcoded `zzgemsjewelry@gmail.com`); `auth.ts:127-129,147`; `checkSubscription` preserves tier on error `auth.ts:138-144,161-163` |
| SS-11 | Release uploader requires `SUPABASE_SERVICE_ROLE_KEY` in operator env (no leak found; high-privilege flow) | **Low** | `upload-release.mjs:13-18,201-243`; good rails (rejects ad-hoc `:128-132`, lipo/codesign/spctl `:118-134`) |
| SS-12 | **Positive:** recon-flagged auto-approval + bypassPermissions risks are already mitigated | Info | `auto-responder.ts:51-56` (verified `risk==='risky' → false`); `claude_pty_create` `--permission-mode acceptEdits`/`default` `orchestrator.rs:442-450`; `SHIP_MEMORY_READONLY=1` + `--strict-mcp-config` `orchestrator.rs:379` |

**Lead analysis (execution chain).** SS-2 and SS-3 mean the allowlist provides a *false sense of containment*: it blocks `curl`/`bash`/`rm` directly but permits the interpreters, which are strictly more powerful (`node -e`, `python -c`, `npx <pkg>`, `npm run` against an LLM-authored `package.json`). Combined with SS-1 (full-disk read of `~/.ssh/id_rsa`, `~/.aws/credentials`, browser cookie stores) and SS-5 (attacker-controllable issue/page text becoming agent instructions), a single prompt-injection that influences a `path` or command argument escalates to read+exfiltrate+execute with the user's full privileges. Worktree isolation (`claude_pty_create`) limits git-tree blast radius but not network exfiltration, out-of-tree reads, or destructive system commands. SS-4 widens the entry surface: any same-user local process can drive the agent-task bus because no-origin POSTs are explicitly accepted.

---

## 4. Website — Auth & Billing Surface (lead surface)

The makeshiphappen.tech security posture is the strongest of the four products and shows evidence of prior hardening. The risk is narrow but sharp.

| # | Finding | Severity | Evidence |
|---|---|---|---|
| WEB-1 | CLI login relays live Supabase **access + refresh tokens** to an **unvalidated localhost port** (session theft / account takeover) | **High** | `app/auth/cli-login/page.tsx:9` (`port` from query, unvalidated), `:35` POST to `http://localhost:${port}/callback` with `access_token` + `refresh_token` (verified). No loopback nonce/PKCE binding, no port allowlist |
| WEB-2 | Owner privilege bypass (`OWNER_EMAILS`) safety depends on out-of-band Supabase email-confirmation setting | **High** | `lib/auth/owner.ts:3-6,17` (requires `email_confirmed_at`); applied at `chat-gate.ts:59,81`, `subscription.ts:32`, `verify/route.ts:93`; deploy from separate repo `git@github.com:Kaveli888/makeshiphappentech.git` via `vercel --prod` (live ≠ audited) |
| WEB-3 | `comp-access` admin grants have **no expiry** and run with full service-role key from local env | **Medium** | `scripts/comp-access.mjs:78-82` (direct `subscription_tier` set, bypasses RLS+Stripe); no auto-expiry `:4-7`; only guard refuses if `stripe_customer_id` exists `:73` |
| WEB-4 | In-memory IP rate limiter is per-instance — largely ineffective on Vercel for verify/team-invite/remove | **Medium** | `lib/api/ip-rate-limit.ts:18` (per-process `Map`), comment `:1-8`; used by `verify/route.ts:17`, `teams/invite/route.ts:18` |
| WEB-5 | Rate limiters and webhook dedupe **fail open** on backend errors | **Medium** | `rate-limit.ts:33-35,76-78` (allow on RPC error); webhook continues on non-23505 dedupe-insert failure `stripe/webhook/route.ts:67-74` (non-idempotent replay window) |
| WEB-6 | Subscription tier driven by Stripe `metadata.plan` (structurally fragile, currently safe) | **Low** | `stripe/webhook/route.ts:102-103,125,179-180`; stamped server-side at `stripe/checkout/route.ts:99-103,193-200`; no webhook-time price_id↔plan re-validation |
| WEB-7 | Shell-spawning Electron app (node-pty/e2b) co-located under the website's `package.json` | **Low** | `electron/main.js:12-67` (node-pty over IPC); excluded via `.vercelignore`; `contextIsolation:true`/`nodeIntegration:false` `:94-95`; deny-all window opener `:111-114` |
| WEB-8 | LibraryGate paywall is purely client-side; gated children ship in the JS bundle | **Low** | `LibraryGate.tsx:163` (renders children only if subscribed but compiles them in), CSS blur `:32`; acceptable only because gated content is marketing copy, real entitlements server-enforced |
| WEB-9 | **Positive:** secrets hygiene, RLS hardening, signed-URL downloads, CSP, input validation | Info | clean `git log --all -p` (only `sk_test_XXXX`/`whsec_XXXX` placeholders); service-role throws if unset `supabase/admin.ts:10-16`; RLS migrations 007/008; webhook sig verify + dedupe `:51`; Zod model enums + 4096-token/40-msg caps `chat-request.ts:13-89`; authoritative Printful pricing `merch-checkout/route.ts:18,119-122`; open-redirect rejection `callback/route.ts:9-16`; CSP/HSTS/X-Frame-Options DENY `next.config.ts:8-65` |

**Lead analysis (auth/billing).** WEB-1 is the single most exploitable web finding: the refresh token is long-lived, the "Continue as existing" path sends it on one click (`page.tsx:52`), and there is no origin proof binding the loopback callback to the legitimate CLI. WEB-2 is a *configuration-dependent* High: the code-level guard (`email_confirmed_at`) is correct, but the control lives in Supabase project settings that cannot be audited from the repo, and the separate deploy repo means the live binding is unverifiable. WEB-3/4/5 are governance/availability trade-offs — each is a best-effort control that *silently degrades to no control* on operator forgetfulness (WEB-3) or infra failure (WEB-4/5). Note the asymmetry recorded as a positive in WEB-9: `reserveChatRequest` correctly fails **closed** on DB error, protecting AI-provider spend, while `reserveIpRequest` fails open.

---

## 5. ShipTalk — Secrets, Auth & Execution

ShipTalk's OS-level secrets hygiene is sound; risk concentrates at the data/trust layers (transcripts, session token, client-only authorization).

| # | Finding | Severity | Evidence |
|---|---|---|---|
| ST-1 | `shiptalk-mcp` exposes the Supabase **auth token** and full transcript history with **no key allowlist** | **High** | `get_state_raw`/`list_state_keys` `shiptalk-mcp/src/index.ts:230-240,380-393` read ANY key; `shiptalk-auth` session at `supabase.ts:53`, `shiptalk-history` at `index.ts:117` |
| ST-2 | Transcripts persisted in plaintext `localStorage`, never encrypted or pruned | **High** | `index.ts:117-120`; `~/Library/WebKit/com.makeshiphappen.shiptalk/.../localstorage.sqlite3` readable by any same-user process |
| ST-3 | Client-side-only authorization with hardcoded owner-email backdoor; tier trivially spoofable | **High** | `owner.ts:1` (`OWNER_EMAILS=['zzgemsjewelry@gmail.com']`); forced `tier='team'` `auth.ts:78/95`; `checkSubscription` preserves tier on error `auth.ts:90,99` |
| ST-4 | Local whisper model binaries downloaded via `curl` with **no checksum/signature** verification | **Medium** | `lib.rs:511-530` (HF fetch), only size>1MB check `:536-541`, loaded by whisper-rs `:619` |
| ST-5 | Provider API keys travel client→third-party directly; Anthropic call sets `dangerous-direct-browser-access` | **Medium** | `polish.ts:166-182`; Groq/OpenAI Bearer `useVoiceCommands.ts:330,623,699,722`, `fileTranscribe.ts:88,98`; `.env.example:4` warns against VITE_* keys |
| ST-6 | `type_text` drives Accessibility + AppleScript to paste into arbitrary apps; broad apple-events entitlement | **Medium** | `lib.rs:286-444` (pbcopy + Cmd-V via System Events); `entitlements.plist:9`; mitigated — app id passed as argv `lib.rs:348-364` |
| ST-7 | Release publishing uses Supabase **service-role key** in a CLI script | **Medium** | `upload-release.mjs:26,224`; private `releases` bucket feeds updater `tauri.conf.json:46`; updater still requires minisign sig `:49` (limits to denial/rollback) |
| ST-8 | `dictionary_terms` fetched with **no user scoping** — relies entirely on RLS | **Medium** | `polish.ts:104-108` (`.limit(500)`, no `.eq('user_id', …)`); terms injected into Claude prompt `:142-144` |
| ST-9 | "On-device" marketing contradicted by cloud engines (truth-in-labeling) | **Low** | `Cargo.toml:28-31` standing AUDIT comment; cloud gate correctly enforced `polish.ts:134`, `fileTranscribe.ts:33`, `useVoiceCommands.ts:309/682/735` |
| ST-10 | World-readable cursor diagnostics log left enabled in shipped code | **Low** | `lib.rs:862-871` (`/tmp/shiptalk-follow.log`, ~3×/sec, never cleaned) |
| ST-11 | Camera usage string declared though camera is unused (over-broad TCC prompt surface) | **Low** | `dev-signed.mjs:115-116` + bundled `Info.plist` `NSCameraUsageDescription` |
| ST-12 | **Positive:** keychain storage, strict CSP allowlist, scoped HTTP allowlist, minimal IPC, argv-safe osascript, cloud gate default-OFF | Info | `secrets.rs`; CSP `tauri.conf.json:39`; `capabilities/default.json:16-21,27-41`; `cloudFeatures.ts` |

**Analysis.** ST-1 and ST-2 are coupled: the plaintext transcript+token store (ST-2) is the underlying exposure that the unauthenticated MCP server (ST-1) amplifies into remote-from-any-local-agent exfiltration of a *refreshable authenticated identity*. ST-3 means feature gating is cosmetic — acceptable only if every paid capability is independently enforced via RLS, which this client cannot guarantee.

---

## 6. ShipMind — Secrets, Auth & Execution

ShipMind's secrets handling is fundamentally sound (keychain + provider allowlist + `chmod 0600` config; `.env` not in git history for this repo). Risk concentrates in webview-to-IPC blast radius and home-wide filesystem reach.

| # | Finding | Severity | Evidence |
|---|---|---|---|
| SM-1 | CSP allows both `unsafe-inline` **and** `unsafe-eval` on the main app webview (root amplifier) | **High** | `tauri.conf.json:26`; app renders scraped pages, YouTube/file content, markdown/mermaid, hosts in-app browser |
| SM-2 | `fs` write/copy capability scoped to entire `$HOME/**` — RCE/persistence write primitive | **High** | `capabilities/default.json:16-42` ($HOME covers `~/.zshrc`, `~/Library/LaunchAgents`, `~/.ssh/authorized_keys`); deny-list does NOT cover plugin `fs:write` |
| SM-3 | Home-wide raw file readers gated by a **fragile deny-list**, not an allowlist | **High** | `read_file_text` `lib.rs:1754`, `list_directory` `lib.rs:1693`, `is_sensitive_path` `lib.rs:1863` (substring deny-list; misses browser login DBs, app token stores, etc.); agent tools correctly workspace-scoped `agentChatStore.ts:159-187` |
| SM-4 | Hardened-runtime entitlements weaken code-signing (disable-library-validation, allow-jit, unsigned-exec-mem, dyld env) | **Medium** | `entitlements.plist` (needed for bundled yt-dlp/Ollama; file flags for re-review) |
| SM-5 | Provider API keys returned in cleartext from keychain to the webview | **Medium** | `get_api_key` `lib.rs:2177`, `get_provider_key` `lib.rs:2219`; partly by-design; no hardcoded keys (keychain-only + `chmod 0600` `lib.rs:1081-1086`) |
| SM-6 | MCP server exposes the entire personal knowledge DB read-only with **zero auth** | **Medium** | `shipmind-mcp/src/index.ts:40` (readonly DB), 10 tools + transcript resources; mitigated — parameterized SQL, `wrapUntrusted()` `:59-75` |
| SM-7 | Data egress to many AI providers; CSP `connect-src` omits DeepSeek and Manus (correctness + governance gap) | **Low** | `secrets.rs:6-19` (8-provider allowlist); CSP `tauri.conf.json:26` lacks `api.deepseek.com`/`api.manus.ai` |
| SM-8 | Chrome extension primary ingest endpoint (`localhost:8765`) is **unimplemented** in app source | **Low** | `shipmind-extension/background.js:5`, `manifest.json:7`; no `:8765` listener / `/ingest` handler / `shipmind://` registration found |
| SM-9 | Stale 1.3 GB `.git.bak` repo copy inside `shipmind/` | **Low** | `shipmind/.git.bak`; gitignored `shipmind/.gitignore:11`; scan found no leaked secrets |
| SM-10 | Agent tool arguments not schema-validated before dispatch (currently safe, latent) | **Low** | `agentChatStore.ts:~120-188` (ad-hoc coercion; zod present but unused); all current tools read-only/workspace-scoped |
| SM-11 | Owner subscription bypass is client-side only (hardcoded emails) | **Low** | `owner.ts:3-6`; `auth.ts:102/119`; `.env` = anon key only, gitignored + absent from history |
| SM-12 | **Positive:** release/deploy + updater pipeline well-hardened | Info | `upload-release.mjs:133-153` (lipo/codesign/spctl, reject ad-hoc), build-vs-source freshness `:192-225`; minisign updater `tauri.conf.json:36` |

**Analysis.** SM-1 is the keystone: with `unsafe-eval` on a webview that ingests untrusted scraped/markdown/mermaid content, any injection runs arbitrary JS that can call every `#[tauri::command]`. That JS then chains into SM-2 (write a `LaunchAgent`/`~/.zshrc` for persistence — the plugin `fs:write` path has *no* deny-list) and SM-3 (read credential files the substring deny-list misses). The agent layer is correctly contained today; the *raw IPC commands* are the wider hole.

---

## 7. Cross-Cutting Risk Themes

### 7.1 Secrets handling — overall **Low** (strong)
Keychain-at-rest is universal across desktop apps; the website never exposes keys to the browser; only public anon keys are committed; `.env` files are gitignored and (where verifiable) absent from history. Residual exposure is **in-memory plaintext fan-out** in the renderers (SS-6, SM-5, ST-5) and **service-role keys in operator env** for release/comp flows (SS-11, ST-7, WEB-3) — high-privilege but no leak found.

### 7.2 Authentication — **Medium**
Supabase email/password is the sole IdP for all four products with public anon keys; cross-tenant isolation rests entirely on RLS that is not auditable from these client repos (ST-8, SM-11). The website's CLI-login token relay (WEB-1) is the one authentication *mechanism* flaw.

### 7.3 Authorization — **High (business-logic)**
Every product hardcodes `OWNER_EMAILS` and forces `team` tier **client-side**, with tier preserved-on-error (ST-3, SM-11, SS-10, WEB-2). Server-side enforcement exists only on the website's gated resources; the desktop apps' premium features run locally and cannot be trusted-gated.

### 7.4 Command execution — **High**
ShipSpace (SS-1/2/3) is the apex. ShipMind (SM-2/3) and ShipTalk (`type_text` ST-6, model `curl` ST-4) are lower but non-trivial. The unifying weakness is **deny-lists/allowlists that constrain the wrong dimension** (binary name not args; substring not allowlist).

### 7.5 Release & deployment — **Low (strong)**
Minisign-verified updaters, universal-arch + Developer-ID + `spctl` gates, and build-vs-source freshness checks are present everywhere. The website's separate-deploy-repo + `vercel --prod` (WEB-2) is the one *governance* weakness (audited ≠ live).

### 7.6 Agent permissions — **High (by design, partially mitigated)**
Raw PTY (SS-3), unauthenticated MCP bus (SS-4), and prompt-injection-into-agent (SS-5, ShipMind SM-10) define the surface. Mitigations are real but advisory (system-prompt guardrails) except the verified hard gates (auto-responder, default permission mode, read-only Ship Memory, `--strict-mcp-config`).

### 7.7 Filesystem access — **High**
ShipSpace `read_file`/`list_directory` unconfined (SS-1); ShipMind `$HOME/**` write + deny-list reads (SM-2/3). ShipSpace `write_file` and ShipMind agent tools are correctly sandboxed — the asymmetry is the risk.

### 7.8 External integrations — **Medium**
Up to 7–11 AI sub-processors per product receive raw user content (code, voice, personal notes) BYOK with **no sub-processor disclosure**; DeepSeek (China-jurisdiction) is undisclosed on the website; no data-residency pinning anywhere. MCP servers (all three) and the unimplemented ShipMind extension endpoint expand the trust graph. (Full data-flow inventory in the Integrations domain document.)

### 7.9 Hardened runtime — **Medium**
ShipSpace and ShipMind both ship `disable-library-validation` + `allow-unsigned-executable-memory`/`allow-jit` + `allow-dyld-environment-variables`, lowering the bar for dylib injection into a signed, entitled (microphone/accessibility/keychain) process.

---

## 8. Notes & Caveats

- This is a point-in-time, read-only review of the working tree. The website deploys from a *separate* nested repository (`Kaveli888/makeshiphappentech.git`) via `vercel --prod`, so live production code is **not guaranteed** to match what was audited (directly relevant to WEB-2).
- Several High/Medium ratings are **contingent on Supabase RLS** that is not present in these client repos (ST-3, ST-8, SM-11, SS-10, WEB-2). Verifying RLS scoping per `auth.uid()` is the load-bearing external control.
- The recon's claim that ShipMind's `.env` is committed is **incorrect for this repo** (anon key only, gitignored, absent from history) and is recorded accordingly.
- Two recon-flagged ShipSpace risks (auto-approval of risky prompts, `bypassPermissions`) were verified **already mitigated** and must not be re-reported as open (SS-12).
