# PHASE 7 — Security Review (Risk Ratings Only)

Consolidated security posture across the ecosystem. **Ratings only — no fixes proposed, no code modified.** Evidence in the per-cluster dossiers (`10`–`15`).

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low.

---

## 1. Secrets handling — overall 🟢 Low (strong)

| Finding | Rating |
|---|---|
| **No real secrets committed to git** (`git ls-files \| grep .env` empty; only `.env.example` placeholders tracked; verified across all apps and history) | 🟢 (positive) |
| API keys stored in **macOS Keychain** (ShipMind, ShipTalk, ShipSpace, ShipCode) | 🟢 (positive) |
| Only embedded credential is the Supabase **anon** JWT (public by design; safe-to-embed) in ShipCode | 🟢 |
| **ShipWatch stores API keys in webview `localStorage`** (not Keychain) — exfiltratable on renderer compromise | 🟡 |
| Provider keys held in **renderer memory with `withGlobalTauri`** (ShipSpace) — theft on XSS | 🟠 |
| Live keys flagged for rotation in launch checklist (H-3); no documented rotation cadence | 🟡 |
| No secret scrubbing in logs (prompts/files/terminal output may contain secrets) | 🟡 |

## 2. Authentication — overall 🟡 Medium

| Finding | Rating |
|---|---|
| Supabase email-confirm + owner gated on `email_confirmed_at` (web; prior C-1 fixed) | 🟢 (positive) |
| ShipCode loopback login with random `state` + Origin/Referer checks + server-side tier verify | 🟢 (positive) |
| **Security rests on Supabase RLS that cannot be verified from source** (ShipMind/ShipTalk/web) | 🟠 |
| ShipTalk login gate **not mounted** → runs as `local-user`; auth optional | 🟡 |
| Residual client-side owner-bypass identity checks across apps (`zzgemsjewelry@gmail.com`) | 🟡 |
| cli-login "state echo" deploy-dependent (else all ShipCode logins 403) | 🟡 |
| Pending Supabase migrations (010–012) must be confirmed applied | 🟠 |

## 3. Authorization — overall 🟡 Medium

| Finding | Rating |
|---|---|
| Web billing RLS lockdown + webhook idempotency in place | 🟢 (positive) |
| `/api/auth/verify` over-discloses email+user_id (M-1) | 🟡 |
| Checkout webhook hardcodes `status:'active'` without re-reading Stripe (M-2) | 🟡 |
| MCP servers expose personal data to any connected agent with no allow-list/redaction | 🟠 |
| ship-memory: no auth; read/write/permanent-delete over MCP stdio | 🟠 |

## 4. Command execution — overall 🔴 Critical (the ecosystem's top security theme)

| Finding | Rating |
|---|---|
| **ShipSpace agents get raw PTY shell access, no validation layer** (source self-documents "rm -rf, curl exfiltration") | 🔴 |
| **Shipped danger modes**: `codex --dangerously-bypass-approvals-and-sandbox`, `agent:auto`, `claude --permission-mode bypassPermissions` | 🔴 |
| **ShipClick**: `claude -p --permission-mode bypassPermissions` while physically controlling the Mac | 🔴 |
| Auto-merge + auto-responder remove human-in-the-loop | 🟠 |
| ship-aos shell exec (safe on localhost; Critical if network-exposed) | 🟡 |
| `summarize_readme.sh` / ShipCode `runCommand`/`grepContent` use `execSync` interpolation (not AI-wired today) | 🟡 |

## 5. Agent permissions & prompt injection — overall 🟠 High

| Finding | Rating |
|---|---|
| Untrusted content (files/web/issues/terminal-drag) reaches agents + providers with **no secret scrubbing** → injection-driven exfiltration | 🟠 |
| Safety controls (`safety-policy.ts` regex, system-prompt strings) are **not enforcement boundaries** | 🟠 |
| Ship-Memory read-only MCP wiring is a genuinely enforced control | 🟢 (positive) |
| ShipMind MCP is read-only and wraps external content in untrusted-data delimiters | 🟢 (positive) |

## 6. File-system access — overall 🟠 High

| Finding | Rating |
|---|---|
| ShipSpace `read_file`/`list_directory`/`open_path` **path-unconfined** (can read `~/.ssh`); writes hardened | 🟠 |
| ShipMind `fs` write scope `$HOME/**`; IDE reads use deny-list (not real containment) | 🟠 |
| ShipWatch `read_file`/`write_file` accept arbitrary absolute paths from webview | 🟡 |
| ShipCode writes auth.json `0o600`; chmod-600 token/key files | 🟢 (positive) |

## 7. Network exposure / external integrations — overall 🟠 High

| Finding | Rating |
|---|---|
| **ShipWatch cloud proxy default-binds 0.0.0.0**, browser-only CORS, Bearer-license sole gate on a credit-spending Anthropic relay | 🟠 |
| ShipMind SSRF guard (`validate_public_http_url`, DNS-rebinding aware) on egress | 🟢 (positive) |
| ShipMind extension targets a `127.0.0.1:8765` server that doesn't exist (only deep-link real) | 🟢 |
| 8+ third-party integrations widen the external attack/data surface | 🟡 |

## 8. Release / deployment / build integrity — overall 🟡 Medium

| Finding | Rating |
|---|---|
| ShipMind updater is **minisign-signed** | 🟢 (positive) |
| Whisper models fetched via `curl` with **size-only check** (no checksum/signature pinning) | 🟡 |
| Self-distributed desktop builds: codesign/xattr/iCloud gotchas; no documented attestation/verification for users | 🟡 |
| Bundled binaries (ffmpeg, yt-dlp, deno, Ollama) — no documented patch/update process | 🟡 |
| CSP: ShipMind retains `'unsafe-eval'`; ShipTalk CSP now set (prior `null` fixed) | 🟡 / 🟢 |

## 9. Web-app specific (makeshiphappen.tech) — overall 🟢/🟡 (most mature)

Prior Critical/High findings remediated in source: owner-bypass (C-1), merch fulfillment (C-2), invite trigger (H-1), Google key→header (H-2), OAuth open-redirect, security headers, site-password gate, webhook idempotency, RLS billing lockdown. Residual: M-1 verify-echo, M-2 hardcoded active, no `invoice.payment_failed` dunning — all 🟡 defense-in-depth.

---

## Security risk ranking (top to bottom)

1. 🔴 **Autonomous command execution without sandboxing** (ShipSpace raw PTY, ShipClick physical control) — §4
2. 🔴 **Shipped danger/bypass modes** that strip approvals + sandbox — §4
3. 🟠 **Prompt-injection → secret/code exfiltration** (no scrubbing, controls non-enforcing) — §5
4. 🟠 **Path-unconfined file reads + provider keys in renderer** — §6, §1
5. 🟠 **RLS-dependent security that's unverifiable from source** — §2/§3
6. 🟠 **ShipWatch proxy 0.0.0.0 bind + keys in localStorage** — §7, §1
7. 🟠 **Unauthenticated MCP exposure of personal data** — §3
8. 🟡 Operational closeouts (migrations, rotation, cli-login deploy, model checksums) — §2, §8

**Theme:** Conventional appsec hygiene (secrets, web auth, supply-chain basics) is good-to-strong. The unconventional, ecosystem-defining risk is **autonomous agents executing with approvals disabled** — a product-design/safety decision more than a code defect. Treating those modes as opt-in, warned, and logged (a configuration/governance choice) is the highest-impact security move and requires no architectural change.
