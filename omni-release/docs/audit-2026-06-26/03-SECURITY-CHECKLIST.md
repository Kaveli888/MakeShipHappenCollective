# Security Checklist (gate every integration through this)

Legend: ✅ done · ⚠️ partial · ❌ missing · 🔜 required before real users.

## Current posture
- ✅ No hardcoded secrets (all `OMNI_*` env reads; grep-verified).
- ✅ No fake "published" states (adapters return `failed` + reason; all logged posts are `queued`).
- ✅ Minimal Tauri surface (`core:default` capability only).
- ✅ Safe-by-default mode (`queue`/dry-run; live is explicit opt-in).
- ⚠️ Secrets are long-lived plaintext env vars (S3).
- ❌ CSP disabled (S1). ❌ `open_path` unvalidated (S2). ❌ No token encryption / OAuth / vault.

## Before adding ANY platform integration

### Secrets & tokens
- 🔜 OAuth **client secrets live server-side only** — never in the Tauri binary or frontend bundle.
- 🔜 Desktop uses **OAuth 2.0 + PKCE**; the **code→token exchange happens on the backend**.
- 🔜 Tokens **encrypted at rest** (KMS / libsodium); `tokens_enc` not selectable by client (RLS).
- 🔜 **Refresh tokens** handled server-side; track `token_expires_at`; auto-refresh; surface reconnect.
- 🔜 Token **revocation** path (user disconnects → revoke upstream + delete vault row + audit).
- 🔜 Local desktop secrets (if any) in **OS keychain** via Tauri, not `.env` / files.
- 🔜 **Redact** tokens from all logs, `request_summary`/`response_summary`, and error messages.

### App / client hardening
- 🔜 Set a **strict CSP** in `tauri.conf.json` (`security.csp`), no `unsafe-inline`/`unsafe-eval`.
- 🔜 Validate `open_path`: resolve real path, assert it is inside engine-root/ready-to-post, whitelist extensions.
- 🔜 Keep Tauri capabilities **least-privilege**; if adding fs/http plugins, scope allow-lists tightly.
- 🔜 Configure **Tauri updater + code signing** (macOS notarization) before distribution.
- 🔜 Scope `bundle.targets` to desktop (`["dmg","app"]`/per-OS), not `"all"`.

### Backend / API
- 🔜 Every API route **authenticated** (Supabase JWT) and **authorized** (workspace membership/role).
- 🔜 **RLS on every user-owned table**; service-role key never reaches the client.
- 🔜 OAuth callback **validates `state`** (CSRF) and (where supported) **PKCE verifier**.
- 🔜 **Rate-limit** the API; put **Cloudflare WAF** in front of public endpoints.
- 🔜 Validate/limit uploads: **max size, allowed MIME/extension, checksum**; scan filename; no path traversal in `storage_key`.
- 🔜 Webhook/callback endpoints verify signatures where the platform provides them.

### Publishing integrity
- 🔜 **Idempotency key** per scheduled job; worker **lease** (`locked_by`/`locked_at`) prevents double-publish.
- 🔜 Mark `published` **only** on confirmed platform response; store returned `external_url`/id then.
- 🔜 **Retry with backoff**, capped `max_attempts`; **rate-limit aware** (respect 429 / platform quotas).
- 🔜 **Partial success** modeled per `post_platform_target` (one platform can fail without failing the post).
- 🔜 **Every attempt → `publish_attempts`**; **every failure → human-readable `failure_reason`**.
- 🔜 **Mock/test mode** mandatory for every publisher (no network; deterministic result).
- 🔜 **Dry-run** preserved end-to-end.

### Operational
- 🔜 `npm audit` + `cargo audit` in CI; fail on high severity.
- 🔜 Remove/archive the **divergent `~/omni-release` copy** (S6) to avoid editing the wrong tree.
- 🔜 `.env`/secrets in `.gitignore` (verify); never commit example tokens with real values.
- 🔜 Audit-log security-relevant actions (connect/revoke/publish/schedule) with actor + IP.
- 🔜 Backups of Postgres + storage; documented token-rotation runbook.
