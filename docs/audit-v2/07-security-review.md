# Audit v2 — Phase 7: Security Review

**Date:** 2026-06-07
**Method:** READ-ONLY synthesis of cluster dossiers (10–16). Did NOT consult `docs/audit/` or `docs/business-protection/` (independence). No code modified/created/deleted other than this review file.
**Scope of this phase:** **RISK RATINGS ONLY.** No fixes, no code, no remediation patches. Each finding is rated Critical / High / Medium / Low with a one-line rationale and an upstream `file:line` citation preserved from the source dossiers.
**Disclaimer:** This is **not legal advice.** Severity ratings are the auditor's judgment based on source-derived evidence.

> Severity model: **Critical** = remote/agent-reachable or operator-cost/credential exposure with low precondition; **High** = serious exposure gated by a local-trust or opt-in precondition; **Medium** = meaningful weakness mitigated by context; **Low** = informational / contained.

---

## 1. Secrets handling

| ID | Finding | Affected app / file:line | Severity | Rationale |
|---|---|---|---|---|
| SEC-1 | **API keys + license key stored in plaintext localStorage** (webview-readable, on-disk in WebKit store) | ShipWatch — `ai.ts:16-79` (`14 S-3`) | **High** | Anthropic/OpenAI/Gemini keys recoverable by any webview script or disk reader |
| SEC-2 | **All provider keys decrypted from Keychain into renderer JS memory** on hydrate | ShipSpace — `useApiKeyStore.ts:51-68,85` (`11 S-6`) | **Medium** | Defeats part of the Keychain benefit; reachable via the `withGlobalTauri` injection path |
| SEC-3 | **Cloud LLM keys sent directly from the webview** (`dangerouslyAllowBrowser`, `anthropic-dangerous-direct-browser-access`) | ShipMind — `providers.ts:145`, `agents/providers/anthropic.ts:54` (`10 S-5`) | **Medium** | Renderer XSS can read in-memory key during a request and exfiltrate over broad connect-src |
| SEC-4 | **No secret scrubbing on untrusted-content → provider flows** — `.env`/keys visible in terminal scrollback/files sent verbatim to cloud models | ShipSpace — `11 §2.4`, `11 S-11` (grep negative) | **Medium** | Injection surface leaks secrets to providers with no redaction |
| SEC-5 | **ship-aos stores a live Stripe secret key** (`sk_live_`/`rk_live_`) locally | ship-aos — `stripe/key/route.ts:11-23`, `lib/stripe/local.ts:16-42` (`13 S-1`) | **Medium** | chmod 600 + localhost-contained; would be Critical if the app is network-exposed |
| SEC-6 | **Embedded Supabase anon JWT / Sentry DSN** in client bundles | ShipCode `session.ts:11`, `analytics.ts:12-13`; ShipWatch `analytics.ts:12-13` (`15 B.1`, `14 S-8`) | **Low** | Public-by-design tokens; risk depends on RLS correctness |

## 2. Authentication systems

| ID | Finding | Affected app / file:line | Severity | Rationale |
|---|---|---|---|---|
| SEC-7 | **No authentication gate** — app fully usable as `'local-user'`; `AuthView` is dead code | ShipTalk — `App.tsx:62-66`, `supabase.ts:48-56` (`12 S-3`) | **Medium** | If RLS is misconfigured, the client-bundled anon key is the only barrier |
| SEC-8 | **No auth on any API route** | ship-aos — `src/app/api/**` (`13 S-1`) | **High** | localhost-contained today; Critical if run with `-H 0.0.0.0` / tunneled / deployed |
| SEC-9 | **Supabase RLS is the sole server-side barrier and is unverifiable from source** | makeshiphappenAi, ShipMind, ShipTalk, ShipCode — `13 §8`, `12 S-3`, `15 C` | **Medium** | Anon key is client-distributed by design; entire data-confidentiality model rests on RLS not auditable here |
| SEC-10 | **No ToS/Privacy acceptance gate** at signup/login/pricing/CLI-login | makeshiphappenAi — `signup/page.tsx`, `auth/cli-login/page.tsx` (`13 L-2`) | **Low** (security) | Weakens enforceability; not a direct compromise vector |

## 3. Authorization systems

| ID | Finding | Affected app / file:line | Severity | Rationale |
|---|---|---|---|---|
| SEC-11 | **Owner-email entitlement bypass is client-side** on desktop apps — hardcoded emails force-elevate tier regardless of DB state | ShipMind `owner.ts:3-6`; ShipTalk `owner.ts:1`; ShipCode `owner.ts:4-10` (`10 S-7`, `12 S-4`, `14 §7`) | **Low** | Trivially spoofable in a local build; data is local so not a confidentiality risk — paywall bypass only |
| SEC-12 | **Owner-bypass on web property** grants `team` tier to two hardcoded emails regardless of DB | makeshiphappenAi — `owner.ts:3-6,15-21` (`13 S-2`) | **Low** | Mitigated by `email_confirmed_at` requirement (closes unconfirmed-signup impersonation) |
| SEC-13 | **Client-side free-tier meter** (`~/.shipcode/usage.json`) trivially editable/deletable | ShipCode — `auth/usage.ts:12-95` (`14 §7`) | **Low** | BYO-key economics → no operator-cost leak; tier itself server-verified |
| SEC-14 | **comp-access admin grants have no auto-expiry** — comped tier persists until a human revokes | makeshiphappenAi — `scripts/comp-access.mjs:5-7` (`13 L-10`) | **Low** | Over-grant/operational risk; service-role tool guarded against Stripe-customer accounts |

## 4. Command-execution capabilities

| ID | Finding | Affected app / file:line | Severity | Rationale |
|---|---|---|---|---|
| SEC-15 | **Agents get raw, unconfined PTY/shell** — no typed-intent layer; agent can `rm -rf`, `curl \| sh`, exfiltrate. Acknowledged in a source `TODO(security)` | ShipSpace — `pty.rs:1-10,352-371`, `engine-pty.ts:382-396` (`11 S-1`) | **Critical** | By-design unconfined shell to AI; confinement is "only OS-level user permissions" |
| SEC-16 | **ShipClick drives the real Mac with `claude -p --permission-mode bypassPermissions --max-turns 60`** while able to move mouse, type, run shell | ShipClick — `shipclick:63-68` (`14 S-5`, `14 L-2`) | **High** | Only brake is a prose instruction; misheard voice or on-screen prompt-injection → irreversible actions, no OS confirmation |
| SEC-17 | **`run_shell_cmd` allowlist includes general-purpose interpreters** (`node`, `python`, `npm`, `npx`, `cargo`, `git`) | ShipSpace — `lib.rs:660-666` (`11 S-7`) | **Medium** | Allowlisting the binary name does not constrain `node -e` / `python -c` / `npm run` |
| SEC-18 | **Command-injection latent in AI tools** — `grepContent`/`runCommand` pass un-sanitized strings to `execSync` (shell=true) | ShipCode — `ai/tools.ts:87-88,188-208` (`14 S-4`) | **High** | AI-chosen `pattern` containing shell metacharacters executes; AI is the injection vector |
| SEC-19 | **`type_text` routes transcript through system pasteboard** then synthesizes Cmd-V into whatever app is frontmost | ShipTalk — `lib.rs:286-444` (`12 S-5`) | **Low** | Pasteboard readable by any app; argv-passed so no direct injection |
| SEC-20 | **CLI-agent chat routes spawn CLI binaries with user prompts** (`/api/claude/chat`, `/api/chatgpt/chat`) with no auth | ship-aos — `claude/chat/route.ts:21`, `chatgpt/chat/route.ts:30` (`13 S-1`) | **High** | localhost-contained; Critical if network-exposed |
| SEC-21 | **Privileged subprocess surface** — osascript/python3/runtime `swiftc`-compile-to-temp | ShipWatch — `lib.rs:460-463,828-853` (`14 S-9`) | **Low** | Runtime-compile-from-temp is a weak link if temp is writable by another user |
| SEC-22 | **ShipTranscribe resolves `ffmpeg`/`whisper-cli` via PATH-style candidate list**, falling back to bare name | ShipTranscribe — `lib.rs:12-24` (`12 S-7`) | **Low** | A binary planted earlier in resolution order would execute (PATH supply-chain) |

## 5. Release workflows

| ID | Finding | Affected app / file:line | Severity | Rationale |
|---|---|---|---|---|
| SEC-23 | **No checksum/signature verification on model downloads** — Whisper from HuggingFace + Ollama embedding pull trusted on TLS alone (size check only) | ShipMind `lib.rs:2100-2139,1165-1296`; ShipTalk `lib.rs:511-541` (`10 S-4`, `12 S-2`) | **Medium** | Compromised CDN/MITM/mirror could serve a malicious `.bin` loaded by whisper-rs |
| SEC-24 | **Hardened-runtime entitlements** disable-library-validation + allow-unsigned-executable-memory + allow-jit + allow-dyld-environment-variables | ShipMind — `entitlements.plist` (`10 S-3`) | **Medium** | Needed for sidecars but lets unsigned dylibs load and honors DYLD env |
| SEC-25 | **Stale bundled security report** ships in-product, contradicting current code (claims null-CSP / mock-auth that are fixed) | ShipTalk — `SECURITY_AUDIT_REPORT.md:H-1,H-2` (`12 S-8`) | **Low** | Misleading artifact; no live vuln |

## 6. Deployment workflows

| ID | Finding | Affected app / file:line | Severity | Rationale |
|---|---|---|---|---|
| SEC-26 | **Cloud relay binds all-interfaces (0.0.0.0) with browser-only CORS as the sole transport gate** before a credit-spending Anthropic call | ShipWatch — `server/src/index.ts:95-98,13`, `auth.ts:13-23,84-102` (`14 S-1`) | **Critical** | CORS is browser-enforced only; any non-browser client (curl/LAN host) bypasses it → operator Anthropic-credit theft if network-reachable + a license key leaks |
| SEC-27 | **Stripe subscription webhook hardcodes `status:'active'`** for `checkout.session.completed` without re-reading the subscription; **no `invoice.payment_failed`/dunning handler** | makeshiphappenAi — `webhook/route.ts:113-121` (`13 S-3`) | **Medium** | Failed first/renewal invoice does not downgrade until a later event; partial mitigation via `customer.subscription.updated` + `charge.refunded` |
| SEC-28 | **ship-aos is deploy-fragile** — no-auth + live Stripe key + CLI-spawn become **Critical the moment it leaves localhost** (tunnel / `-H 0.0.0.0` / deploy) | ship-aos — `package.json:6`, `src/app/api/**` (`13 S-1`) | **High** | Posture entirely depends on never being network-exposed |
| SEC-29 | **In-memory IP rate limiter is per-serverless-instance** | makeshiphappenAi — `lib/api/ip-rate-limit.ts` (`13 S-5`) | **Low** | Money paths mitigated by DB-backed `reserve_ip_request` (migration 012) |
| SEC-30 | **Checkout error responses echo Stripe `code`; logs key mode/length** | makeshiphappenAi — `checkout/route.ts:181-218` (`13 S-4`) | **Low** | Minor info-leak |

## 7. Agent permissions

| ID | Finding | Affected app / file:line | Severity | Rationale |
|---|---|---|---|---|
| SEC-31 | **Auto-approve "all" mode auto-answers ANY terminal permission prompt with "1" (approve)** — incl. run-shell / overwrite-file prompts | ShipSpace — `auto-responder.ts:30-38,51-55,97-100` (`11 S-3`) | **High** | User-selectable; converts the human-in-the-loop gate into opt-out |
| SEC-32 | **`bypassPermissions` path is wired** through the command surface (`claude --permission-mode bypassPermissions`) | ShipSpace — `orchestrator.rs:339-342,446-450` (`11 S-5`) | **High** | Disables all of Claude's per-tool gating; off by default but the capability exists |
| SEC-33 | **Auto-merge squashes AI-authored code into the workspace branch with no human review** when the toggle is on | ShipSpace — `orchestrator.rs:796-852`, toggle `OrchestratorStatusStrip.tsx:295-300` (`11 S-8`) | **Medium** | Background merge on `report_result`; provenance/license/correctness exposure |
| SEC-34 | **ship-memory MCP allows unauthenticated write + permanent (hard) delete** to any connected/prompt-injected LLM; read-only is opt-in not default; `cwd` arg can retarget the hub anywhere | ship-memory — `mcp/src/index.ts:229-276,265,23-27` (`14 S-7`) | **High** | Blast radius = entire personal knowledge base + cross-product `~/ShipMemory` hub |
| SEC-35 | **ShipCode file-edit primitive escapes cwd** — `resolve(process.cwd(), op.path)` with an absolute or `../` path lands outside the project | ShipCode — `file-ops.ts:108,165,179-189` (`14 S-6`) | **Medium** | Mitigated by per-op y/n approval, but displayed path is the model's claim (approval fatigue) |

## 8. File-system access

| ID | Finding | Affected app / file:line | Severity | Rationale |
|---|---|---|---|---|
| SEC-36 | **`read_file` has zero path confinement** while `write_file` is hardened — can read `~/.ssh/id_rsa`, `~/.aws/credentials`, `.env` | ShipSpace — `lib.rs:492-495` vs `431-481` (`11 S-2`) | **High** | Renderer or injected script reads any file the user can |
| SEC-37 | **`withGlobalTauri: true`** exposes the full Tauri invoke bridge to all renderer JS | ShipSpace — `tauri.conf.json:13` (`11 S-4`) | **High** | Combined with SEC-36 + in-memory keys, any script injection reads files + secrets + spawns shells |
| SEC-38 | **Arbitrary-path file read/write/base64 exposed to the webview** — `write_file` even `mkdir -p`s the parent; combined with `withGlobalTauri:true` + broad `fs:default` | ShipWatch — `lib.rs:116-160`, `tauri.conf.json:13`, `capabilities/default.json:6` (`14 S-2`) | **High** | Any webview XSS/compromised-dep reads/writes anywhere the app user can |
| SEC-39 | **CSP allows `unsafe-eval` + `unsafe-inline` for scripts** while rendering untrusted ingested content (web pages, PDFs, LLM output) | ShipMind — `tauri.conf.json:26` (`10 S-1`) | **High** | Widens XSS→RCE-adjacent surface; webview can invoke Tauri commands |
| SEC-40 | **Broad fs write/copy allow-list `$HOME/**`** | ShipMind — `capabilities/default.json:16-42` (`10 S-2`) | **High** | Webview compromise can write shell rc / LaunchAgents anywhere under HOME |
| SEC-41 | **`open_path` ( `open <path>` ) unconfined** — opens any path/URL/app | ShipSpace — `lib.rs:483-490` (`11 S-13`) | **Low** | Could open arbitrary file/URL via macOS `open` |
| SEC-42 | **`stream://` URI can read any on-disk file** (mitigated by media-extension allow-list) | ShipMind — `lib.rs:5280-5308` (`10 S-8`) | **Low** | Allow-list blocks e.g. `.ssh/id_rsa` |
| SEC-43 | **Debug follow-loop writes overlay state to world-readable `/tmp/shiptalk-follow.log`** every ~3 frames in production | ShipTalk — `lib.rs:862-871` (`12 S-6`) | **Low** | No transcript content; geometry metadata only |

## 9. External integrations

| ID | Finding | Affected app / file:line | Severity | Rationale |
|---|---|---|---|---|
| SEC-44 | **MCP server exposes all transcripts + all localStorage keys with zero auth / allow-list / redaction** | shiptalk-mcp — `index.ts:148-246,387-393` (`12 S-1`) | **High** | Any LLM/agent wired to it reads every transcript and `get_state_raw` verbatim |
| SEC-45 | **shipspace-mcp exposes app state to any connected LLM with no per-call auth** | ShipSpace — `shipspace-mcp/src/index.ts:132-154,444-462` (`11 S-10`) | **Medium** | Mitigated by sensitive-key filter + `ALLOWED_KEYS` that excludes `shipspace-api-keys` |
| SEC-46 | **Orchestrator MCP server has no auth token** — any local process reaching `127.0.0.1:<rand>` with `Origin: tauri://*` (or no Origin) can pull/inject tasks | ShipSpace — `orchestrator.rs:120-148,555-570` (`11 S-9`) | **Medium** | Port random but unauthenticated |
| SEC-47 | **ShipGang preview iframe uses `sandbox="allow-scripts allow-same-origin"`** for AI-generated HTML | ShipSpace — `AppPreviewPanel.tsx:301,367` (`11 S-12`) | **Medium** | That combination lets the framed model-authored page remove its own sandbox |
| SEC-48 | **`browser_navigate` (embedded browser) is not SSRF-guarded** (only `browser_extract_assets` fetch is) | ShipSpace — `browser_view.rs:914-921` vs `108-138` (`11 S-14`) | **Low** | Browser can be steered to `127.0.0.1`/metadata URLs; its page context then reaches agents |
| SEC-49 | **Extension talks to a `:8765` ingest server that does not exist** in the app; Bearer token in `chrome.storage.local` (unencrypted) | shipmind-extension — `background.js:5,116`; `lib.rs:5280` (`10 S-6`) | **Low** | Dead/non-functional path; needs auth review if a `:8765` listener is added later |

---

## What is done well

Credit where the source evidence shows genuine, working controls:

- **Keychain-based secrets** for ShipMind, ShipSpace, ShipTalk, ShipCode (Rust `keyring 3`); grep for localStorage secret storage returns 0 hits in those products (`15 Part C`). Legacy plaintext localStorage keys are migrated to Keychain then deleted (ShipSpace `useApiKeyStore.ts:28-44`).
- **SSRF defense with tests** — ShipMind `validate_public_http_url` (scheme + loopback/RFC1918/link-local/cloud-metadata + DNS-rebind resolution) with unit tests (`10 §3`, `lib.rs:1809-1854,5601`); ShipSpace `browser_extract_assets` SSRF guard covers `169.254.169.254` + IPv6 ULA/mapped (`11 §3`).
- **Signed updater / minisign** — ShipMind & ShipSpace verify minisign-signed update artifacts; pubkey embedded (`10 S-4` note, `11 §1.1`). Good supply-chain control for app updates.
- **`.env` gitignored, no live committed secrets** — full sweep found no `sk-ant`/`sk_live_`/`gsk_`/`AKIA`/private-key material; only public-by-design anon JWT + placeholders + a redaction-regex false positive (`15 Part B`). `.gitignore` coverage is good.
- **Server-authoritative merch pricing** — makeshiphappenAi computes merch prices server-side; no client price tampering (`13 §3`, `merch-checkout/route.ts:16-18`).
- **Webhook signature verification + idempotency** — Stripe webhook verifies signature + dedupes via `processed_stripe_events` (`13 §3`, migration 011). Plus open-redirect guards and RLS-locked admin tables.
- **ShipSpace defense-in-depth on the gated paths** — `write_file` path-traversal + symlink-escape confinement; model/slug allowlists; `gh`/clone/PR flag-injection guards; orchestrated workers default to `acceptEdits` (not bypass) with worktree isolation + read-only Ship Memory subset; regex risk-gate blocks `rm -rf`/force-push/secret-touch on plan/terminal dispatch; command-center plans are staged not auto-run (`11 §3` mitigations).
- **ShipMind hardening** — `is_sensitive_path` deny-list for IDE reads; workspace path containment; hardened `git -c core.hooksPath=/dev/null GIT_CONFIG_NOSYSTEM`; `--` arg-termination on yt-dlp; config chmod 0600; MCP DB opened readonly + prompt-injection wrapping of untrusted content (`10 §3`).
- **ShipTranscribe** has no cloud egress at all — genuinely local (`12 §1.2`).

---

## Severity tally

| Severity | Count | Findings |
|---|---|---|
| **Critical** | 2 | SEC-15, SEC-26 |
| **High** | 15 | SEC-1, SEC-8, SEC-16, SEC-18, SEC-20, SEC-28, SEC-31, SEC-32, SEC-34, SEC-36, SEC-37, SEC-38, SEC-39, SEC-40, SEC-44 |
| **Medium** | 15 | SEC-2, SEC-3, SEC-4, SEC-5, SEC-7, SEC-9, SEC-17, SEC-23, SEC-24, SEC-27, SEC-33, SEC-35, SEC-45, SEC-46, SEC-47 |
| **Low** | 17 | SEC-6, SEC-10, SEC-11, SEC-12, SEC-13, SEC-14, SEC-19, SEC-21, SEC-22, SEC-25, SEC-29, SEC-30, SEC-41, SEC-42, SEC-43, SEC-48, SEC-49 |
| **Total** | **49** | |

**The two Critical findings:**
1. **SEC-15 — ShipSpace raw, unconfined PTY/shell to AI agents** (`pty.rs:1-10`) — no typed-intent layer; source `TODO(security)` acknowledges arbitrary-command capability.
2. **SEC-26 — ShipWatch Cloud relay binds 0.0.0.0 with browser-only CORS as the sole gate before a credit-spending Anthropic call** (`server/src/index.ts:95-98`) — non-browser clients bypass CORS; operator-credit theft if network-reachable.

**Critical-adjacent (High today, Critical if precondition removed):** SEC-28 (ship-aos no-auth + live Stripe key + CLI-spawn, Critical if network-exposed), SEC-16 (ShipClick bypassPermissions computer-use), SEC-34 (ship-memory unauthenticated delete-over-MCP).
