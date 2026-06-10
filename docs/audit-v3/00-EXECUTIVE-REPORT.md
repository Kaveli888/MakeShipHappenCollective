# Ship Ecosystem — Audit v3 Executive Report

**Auditor:** Lead Independent Auditor (Phase 10 synthesis)
**Date:** 2026-06-07
**Scope:** ShipTalk, ShipMind, ShipSpace (macOS Tauri 2 desktop apps) and makeshiphappen.tech (Next.js 16 commerce/identity website), plus three companion stdio MCP servers (shiptalk-mcp, shipmind-mcp, shipspace-mcp) and the shipmind Chrome extension.
**Nature:** Read-only risk/inventory/governance audit. No code was modified. Software is assumed to function correctly; this report assesses risk, not bugs.

---

## 1. Executive Summary (Risk Posture)

The Ship Ecosystem is engineered with a genuinely strong low-level security baseline — provider API keys live in the macOS Keychain (never in localStorage or committed env files), the website's secret hygiene is clean across full git history, RLS migrations revoke billing-column writes, Stripe webhooks verify signatures and dedupe, release pipelines are minisign-verified and reject ad-hoc signing, and there is no telemetry SDK anywhere. These are real strengths and should be preserved. **The risk in this ecosystem is overwhelmingly concentrated at the governance, legal, and data-lifecycle layers, not at the cryptographic/secrets layer.** The products are being sold to paying customers and process highly sensitive data (voice, source code, personal knowledge corpora, shipping PII) with effectively no legal scaffolding: there is no Terms of Service, no EULA, no warranty disclaimer, no liability cap, no AUP, and no enforceable privacy program backing the rights the website already promises.

Three exposures stand out as the most urgent and should be treated as the executive's immediate priorities:

1. **GPLv2+ ffmpeg statically bundled in paid, closed-source ShipMind (Critical / Legal).** The shipped binary's own build banner confirms `--enable-gpl --enable-libx264 --enable-libx265`. Distributing a GPL binary inside a proprietary paid product with no source offer, no GPL text, and no attribution is an active copyleft violation that can trigger license termination and injunction risk. This is the single highest-confidence, highest-severity legal finding and it is non-delegable to the user.

2. **ShipSpace grants autonomous LLM agents raw shell access by design (Critical / Security).** Agents and terminal panes get a real PTY via portable-pty; the command allowlist gates only the binary *name*, so `node -e`, `python -c`, and `npx <pkg>` are effectively arbitrary code execution, and `read_file`/`list_directory` have no path confinement (SSH/AWS creds are readable). Untrusted GitHub issue bodies and web-page content flow into agent instructions (prompt injection into a shell-capable agent). The team's own `pty.rs` carries a `TODO(security)` acknowledging this.

3. **No working data-deletion or export path exists in any product, while the privacy policy promises GDPR/CCPA erasure (Critical / Privacy + Compliance).** The website's "delete your account" right resolves to a manual email with no backing code; ShipTalk's delete button is never rendered and never deletes Supabase rows; ShipMind's delete orphans raw audio/image files on disk forever. Sensitive corpora (transcripts, notes, terminal scrollback incl. typed secrets) are stored unencrypted, never pruned, and exposed via unauthenticated MCP servers.

Two further items demand near-term attention because they are high-likelihood and high-blast-radius: the website **`/auth/cli-login` flow POSTs live Supabase access+refresh tokens to an unvalidated localhost port** (one-click session capture / account takeover), and the **hardcoded `OWNER_EMAILS` privilege bypass** across all four products, which is safe in production only if Supabase email-confirmation is ON — an out-of-band setting that cannot be verified from code and must be confirmed manually.

Cross-cutting governance themes recur in every domain: **client-side-only authorization** (entitlement integrity rests entirely on unaudited Supabase RLS), **AI-provider sprawl** (raw user content egresses to up to 7–11 third-party sub-processors, including China-based DeepSeek, with no sub-processor inventory and an "on-device" marketing claim the team's own code comments contradict), **zero open-source attribution** across hundreds of permissive dependencies that legally require notice reproduction, and a **deploy-from-local-working-tree model** (`vercel --prod`) meaning live production may diverge from the audited repo. None of these require code changes to acknowledge; most require legal documents, disclosures, and operational confirmations.

**Bottom line:** The ecosystem is technically competent but legally and operationally exposed. The most urgent actions are (a) remediate or relicense the GPL ffmpeg in ShipMind, (b) publish a ToS/EULA with a liability cap and AI-output disclaimer before further paid sales, (c) build/document a real deletion+export pipeline and a sub-processor list, and (d) confirm the Supabase email-confirmation setting and fix the cli-login token relay.

---

## 2. Top 25 Business Risks

| # | Title | Product(s) | One-line impact | Rating |
|---|-------|-----------|-----------------|--------|
| 1 | No EULA / liability cap / warranty disclaimer for paid software | All | Uncapped exposure for AI/agent-driven deletion, RCE, keystroke injection; no loss-shifting instrument | Critical |
| 2 | Liability concentrated on a single named individual, no apparent corporate shield | All | Personal liability for licensing, privacy, and agent-action claims | Critical |
| 3 | GPL ffmpeg copyleft conflict could force source disclosure or halt ShipMind sales | ShipMind | Product may be unsaleable until remediated; injunction/termination risk | High |
| 4 | Client-side-only authorization with hardcoded owner-email bypass; tier trivially spoofable | All | Paid features bypassable by any local user; revenue leakage unless RLS enforces server-side | High |
| 5 | "100% on-device" marketing contradicted by cloud egress (self-admitted in code) | ShipTalk, ShipMind | FTC/UDAP deceptive-practice exposure; refund/chargeback and reputational risk | High |
| 6 | Entitlement integrity depends entirely on unverified Supabase RLS | All | If RLS is loose, paid gating and cross-tenant isolation both fail | High |
| 7 | Deploy via `vercel --prod` from local tree; live state may diverge from audited repo | Website | Unreviewed/unaudited code can reach production silently | High |
| 8 | comp-access admin grants have no auto-expiry; persist until manual revoke | Website | Indefinite free premium access; forgotten comps erode revenue | Medium |
| 9 | OWNER_EMAILS bypass safe only if Supabase email-confirmation is ON (unverifiable) | Website, all | Attacker registering an owner email could inherit free premium | Medium |
| 10 | Draft ShipMind pricing ($20/$40) diverges from live Stripe ($50/$500) | ShipMind, Website | Displayed price may not match charged price; consumer-protection/refund risk | Medium |
| 11 | Subscription tier driven by Stripe `metadata.plan` written at checkout | Website | Any future path letting users influence metadata escalates to "team" tier | Medium |
| 12 | LibraryGate paywall is purely client-side; gated content ships in JS bundle | Website | Premium artifacts placed behind it would leak free; today only marketing copy | Medium |
| 13 | "Secure Documents / built for legal teams" targets regulated buyers ShipMind cannot serve | ShipMind | Mis-sold to high-compliance customers; breach-of-fitness/churn exposure | Medium |
| 14 | No sub-processor inventory; cannot answer enterprise security questionnaires | All | Blocks B2B/enterprise sales; trust deficit | Medium |
| 15 | Provider billing charges borne by users' BYO keys with no account-responsibility terms | All | Disputes over runaway provider spend land on the owner | Medium |
| 16 | Rate limiters / webhook dedupe fail open on backend errors | Website | Non-idempotent billing replay window and AI-spend amplification on DB outage | Medium |
| 17 | In-memory IP rate limiter ineffective across Vercel instances | Website | Invite-spam and verify brute-force largely unthrottled | Medium |
| 18 | No retention/deletion = unbounded storage growth and operating cost | All | Cost creep and growing breach surface over time | Medium |
| 19 | Phantom/placeholder providers (Manus, nano-banana mock) presented as real | ShipMind, ShipSpace, Website | Feature list overstates capability; misleads buyers | Low |
| 20 | Tool-calling/source-grounding works only on OpenAI; default models answer ungrounded | ShipMind | Core "cited answers" promise silently fails on most providers | Low |
| 21 | Chrome extension ingest endpoint unimplemented; advertised data path is dead | ShipMind | Feature promised but non-functional; user confusion | Low |
| 22 | Legacy "Private" PDFs at repo root likely carry outdated unqualified guarantees | ShipMind | Stale collateral can resurface superseded promises | Low |
| 23 | No DPA available for business customers | All | Cannot close GDPR-bound B2B deals | Medium |
| 24 | Single-developer key-person dependency for release signing / Supabase admin | All | Bus-factor risk to releases, billing, and incident response | Medium |
| 25 | Documentation/identifier discrepancies (com.shipspace.ade vs "shipspace" manifest) | ShipSpace, Website | Governance confusion; co-mingled manifest expands obligation surface | Low |

---

## 3. Top 25 Legal Risks

| # | Title | Product(s) | One-line impact | Rating |
|---|-------|-----------|-----------------|--------|
| 1 | GPLv2+ ffmpeg statically bundled in paid closed-source app, no source offer/notice | ShipMind | Active copyleft violation; license termination & injunction risk | Critical |
| 2 | No EULA, warranty disclaimer, liability cap, AUP, or DPA for paid software | All | No loss-shifting; full uncapped legal exposure | Critical |
| 3 | No AI-output disclaimer despite acting on hallucination-prone third-party output | All | Liability for harmful/inaccurate AI actions; no human-in-the-loop waiver | Critical |
| 4 | ToS cannot assert proprietary ownership while GPL ffmpeg is bundled | ShipMind | Ownership/IP claims undermined until ffmpeg fixed | High |
| 5 | "On-device"/"private" claims contradicted by cloud egress (documentary knowledge) | ShipTalk, ShipMind | FTC/UDAP deceptive-practice with self-admitted code evidence | High |
| 6 | Undisclosed China-based (DeepSeek) data transfers | ShipMind, Website | GDPR international-transfer violation; no SCCs/disclosure | High |
| 7 | Inaccurate sub-processor disclosures (over- and under-inclusive) | Website, all | Misstates where data flows; misrepresentation to data subjects | High |
| 8 | No third-party OSS attribution/NOTICE shipped across hundreds of permissive deps | All | Breach of MIT/Apache/BSD/ISC notice clauses on every distributed binary | High |
| 9 | "Built for legal teams / fastest law-tech teams" unsubstantiated, targets regulated users | ShipMind | False-advertising / fitness exposure given unencrypted storage | High |
| 10 | No acceptable-use policy (no anti-exfiltration, anti-tier-spoof, consent-to-record) | All | Cannot disclaim user misuse of shell exec / recording | High |
| 11 | Cross-tenant isolation depends entirely on unverified Supabase RLS | All | Potential unlawful disclosure of one user's data to another | High |
| 12 | Website promises Access/Export/Delete with no implementing code | Website | Unfulfillable legal representation; per-request liability | High |
| 13 | No license of record (Cargo.toml license="", missing package.json license) | All | Ambiguous terms governing distributed first-party code | Medium |
| 14 | 5 MPL-2.0 crates statically linked with unmet per-file source-availability duties | ShipTalk, ShipMind, ShipSpace | Weak-copyleft obligations undocumented | Medium |
| 15 | ring's bundled BoringSSL/OpenSSL NOTICE not reproduced | ShipSpace, all | Multi-license attribution clause unmet | Medium |
| 16 | Bundled native binaries (whisper.cpp, deno/V8/ICU, ollama/ggml) notices unmet | ShipMind, ShipSpace | Permissive-license attribution duties unmet on big redistributed binaries | Medium |
| 17 | Legacy "Private" PDFs may contain unqualified privacy/security guarantees | ShipMind | Superseded representations create misrepresentation risk | Medium |
| 18 | LGPL-3.0 libvips could trigger relink/source duties if bundled into Electron build | Website | Latent copyleft obligation via co-mingled manifest | Low |
| 19 | Shipping PII to Printful/Stripe with no DPA coverage enumerated | Website | Sub-processor data-category disclosure gap | Low |
| 20 | yt-dlp/deno sidecars distributed without attribution | ShipMind | Permissive attribution duty unmet; yt-dlp ToS/operational risk | Low |
| 21 | Unicode-3.0 / CDLA-Permissive-2.0 data-license notices likely dropped by tooling | ShipSpace, all | Non-standard SPDX notices unmet | Low |
| 22 | No consent-to-record framework for voice capture | ShipTalk, ShipMind | Two-party-consent jurisdiction exposure | Medium |
| 23 | Whisper model weights fetched with no provenance/license bundling | ShipTalk, ShipMind | Model-license obligations unsurfaced to user | Low |
| 24 | Empty/placeholder author/license metadata ("authors=['you']") | ShipTalk | Inaccurate distribution metadata for a paid product | Low |
| 25 | No GPL contamination beyond ffmpeg — proprietary model otherwise safe (positive) | All | Confirms remediation is attribution + one ffmpeg fix, not relicensing | Low |

---

## 4. Top 25 Privacy Risks

| # | Title | Product(s) | One-line impact | Rating |
|---|-------|-----------|-----------------|--------|
| 1 | No functioning data-deletion or export capability in any product | All | Documented erasure/portability rights have no code path | Critical |
| 2 | shiptalk-mcp exposes Supabase auth token + full transcripts via get_state_raw, no auth | ShipTalk | Any local agent captures session token and entire voice history | Critical |
| 3 | cli-login relays live access+refresh tokens to unvalidated localhost port | Website | Full session/account-takeover via captured refresh token | Critical |
| 4 | Indefinite plaintext retention of voice/notes/code corpus, no TTL/pruning/encryption | All | Most sensitive data stored forever, readable by any local process | High |
| 5 | Undisclosed international transfer of prompts to DeepSeek (China) | ShipMind, Website | Cross-border transfer with no disclosure/opt-out/SCCs | High |
| 6 | ShipMind delete orphans raw audio/image files on disk forever | ShipMind | Right-to-erasure failure for the most sensitive data | High |
| 7 | ShipTalk delete UI never renders and never deletes Supabase rows | ShipTalk | Users cannot delete transcripts locally or in cloud | High |
| 8 | Full corpus egressed to 7–11 cloud AI sub-processors with no inventory | All | Voice/code/notes leave device with no data map or consent surface | High |
| 9 | Sub-processor list both over- and under-inclusive (omits DeepSeek, lists unused Sentry) | Website, all | Misstates where user data actually flows | High |
| 10 | "Only prompt text leaves, never documents" false for RAG (passages ARE the prompt) | ShipMind | Misleads users that source content stays local | High |
| 11 | "Voice transcribes on-device" overstated; Web Speech may route audio to Apple | ShipTalk | Audio leaves device contrary to claim | High |
| 12 | Terminal scrollback (incl. typed secrets) persisted plaintext indefinitely | ShipSpace | Secrets and code history captured by backups and MCP, no deletion | High |
| 13 | shipmind-mcp exposes entire second-brain DB read-only with no auth | ShipMind | Full personal corpus disclosure to any local process | High |
| 14 | shipspace-mcp exposes chats/prompts/workspaces/orchestration to local clients | ShipSpace | Rich personal/project context readable (credentials filtered) | Medium |
| 15 | DB + backups unencrypted at rest; captured by iCloud/Time Machine | ShipMind, all | Full corpus in cleartext in backups/sync | Medium |
| 16 | Client IPs persisted to ip_rate_events with no TTL and undisclosed in policy | Website | Identifiable PII accumulates forever, undisclosed | Medium |
| 17 | Custom dictionary terms (proprietary names/PII) sent to Anthropic each polish call | ShipTalk | Non-obvious data flow of sensitive vocabulary | Low |
| 18 | usage_events behavioral log keyed to user_id, no deletion coverage | Website | Per-user provider/model activity retained indefinitely | Low |
| 19 | Ship Memory note bodies returned unredacted into agent context | ShipSpace | Personal notes forwarded to whichever provider the agent calls | Medium |
| 20 | Embedded browser captures page content/HTML into persisted chat | ShipSpace | Visited-site content collected without consent/retention notice | Medium |
| 21 | Gemini API key transmitted in URL query string | ShipMind | Key leaks into logs/history vs header auth | Low |
| 22 | Supabase session JWT stored in localStorage under permissive CSP | ShipMind, ShipSpace | XSS/LLM-rendered script can read live session | Low |
| 23 | Frontmost-app identity logged (which apps user uses) with no scrubbing | ShipTalk | Cross-app activity recorded in unrotated logs | Low |
| 24 | Shipping name+address PII flows to Printful with no MSH-side deletion coverage | Website | Fulfillment PII outside any erasure flow | Low |
| 25 | World-readable /tmp diagnostics leak cursor/screen activity | ShipTalk | Local processes infer user activity in real time | Low |

---

## 5. Top 25 Security Risks

| # | Title | Product(s) | One-line impact | Rating |
|---|-------|-----------|-----------------|--------|
| 1 | Autonomous agents get raw PTY shell access by design, no enforced intent layer | ShipSpace | rm -rf / curl-exfil possible, scoped only by OS user | Critical |
| 2 | run_shell_cmd allowlist gates binary name only, not args | ShipSpace | node/npx/python with LLM args = arbitrary code execution | Critical |
| 3 | shiptalk-mcp exposes Supabase auth token + transcripts via get_state_raw | ShipTalk | Account impersonation + history exfiltration, no auth | Critical |
| 4 | cli-login relays live Supabase tokens to unvalidated localhost port | Website | Session theft / account takeover | High |
| 5 | read_file/list_directory have no path confinement | ShipSpace | Any file on disk (SSH/AWS/cookies) readable into agents/LLMs | High |
| 6 | Prompt injection: untrusted gh issues/web/notes flow into shell-capable agents | ShipSpace | Attacker content becomes instructions to a shell-armed agent | High |
| 7 | ShipMind CSP keeps unsafe-inline + unsafe-eval with ~95 IPC + $HOME write | ShipMind | XSS becomes broad read/write/persistence/RCE primitive | High |
| 8 | fs write/copy scoped to entire $HOME/** with no deny-list | ShipMind | Write ~/.zshrc or LaunchAgents for persistence/RCE | High |
| 9 | Home-wide raw file readers gated by fragile deny-list not allowlist | ShipMind | Bypassable; reads broad credential/token stores | High |
| 10 | Client-side-only authorization with hardcoded owner-email backdoor | All | Tier trivially spoofable; static credential in every binary | High |
| 11 | Transcripts/scrollback persisted plaintext, never encrypted/pruned | ShipTalk, ShipSpace | Readable by any local process or backup | High |
| 12 | Orchestrator MCP HTTP server has no auth; accepts no-origin requests | ShipSpace | Local process can read/drive the agent task bus | Medium |
| 13 | OWNER_EMAILS bypass safety depends on out-of-band email-confirmation setting | Website | Owner-email registration → privilege escalation if off | High |
| 14 | shipmind-mcp exposes entire DB read-only with no authentication | ShipMind | Full personal corpus disclosure to local clients | Medium |
| 15 | Weakened hardened-runtime entitlements (disable-library-validation, dyld env) | ShipMind, ShipSpace | dylib injection into signed, entitled, keychain-holding process | Medium |
| 16 | Provider keys held plaintext in renderer memory after hydration | ShipMind, ShipSpace | Webview compromise reads all decrypted keys at once | Medium |
| 17 | OpenAI Realtime sends raw API key in WebSocket subprotocol header | ShipSpace | Full-scope key exposed to any WS proxy/inspector | Medium |
| 18 | Whisper models downloaded via curl with no checksum/signature | ShipTalk, ShipMind | Tampered model could run with app privileges | Medium |
| 19 | Provider keys sent direct-from-client with dangerous-direct-browser-access | ShipTalk, ShipMind | XSS/dependency compromise can exfiltrate keys | Medium |
| 20 | Perplexity/xAI egress to hosts absent from allowlist/CSP | ShipSpace | Governance-invisible egress or silently broken provider | Medium |
| 21 | Rate limiters / webhook dedupe fail open on backend errors | Website | Non-idempotent billing replay; AI-spend amplification window | Medium |
| 22 | type_text drives Accessibility/AppleScript to inject keystrokes into any app | ShipTalk | Any IPC caller can paste arbitrary content cross-app | Medium |
| 23 | Release uses Supabase service-role key (full RLS bypass) | All | Key leak enables publishing to releases bucket (minisign-limited) | Medium |
| 24 | open_path passes arbitrary path to macOS `open` with no validation | ShipSpace | Sharp edge: influenced arg could launch arbitrary app/handler | Low |
| 25 | dictionary_terms / transcriptions read/written with no user_id scoping | ShipTalk | Cross-tenant leak if RLS is missing/loose | High |

---

## 6. Top 25 Documentation Gaps

| # | Title | Product(s) | One-line impact | Rating |
|---|-------|-----------|-----------------|--------|
| 1 | No Terms of Service / EULA / license of record exists for any paid product | All | Nothing governs the customer relationship | Critical |
| 2 | No privacy notice / data-flow map documenting what leaves the device and to whom | All | Users have no informed picture of voice/code/note destinations | High |
| 3 | No published sub-processor list | All | Cannot answer GDPR/enterprise data-flow questions | High |
| 4 | No third-party OSS attribution/NOTICE/Licenses screen shipped | All | Required notices for distributed deps are absent | High |
| 5 | Administrator role (RLS, email-confirm, release keys) load-bearing but undocumented | All | No owner of the controls that make the system safe | High |
| 6 | Internal security-plan.md claims "typed intents validated" — opposite of shipped reality | ShipSpace | Aspirational doc could migrate into public claims = misrepresentation | High |
| 7 | No retention policy documented for any data store | All | "Forever" retention is undisclosed and unmanaged | High |
| 8 | Marketing "on-device" claim contradicts code; no corrected representation | ShipTalk, ShipMind | Users misallocate their own privacy risk | Medium |
| 9 | Secrets/deploy model undocumented; vercel --prod from local tree | Website | No record of how prod is built or what env diverges | Medium |
| 10 | Privacy policy omits client-IP collection persisted to ip_rate_events | Website | Undisclosed PII collection | Medium |
| 11 | Sub-processor disclosures list services not in code (Sentry/Groq/OpenRouter/Ollama) | Website | Inaccurate, misleading transparency artifact | Medium |
| 12 | No documented user-responsibility / shared-responsibility allocation | All | Unclear who owns misuse, exfiltration, prompt-injection outcomes | Medium |
| 13 | No data-residency story documented for any sub-processor | All | Cannot serve region-bound customers | Medium |
| 14 | Chrome extension ingest path documented but unimplemented (dead :8765/deep-link) | ShipMind | Users configure tokens that do nothing | Low |
| 15 | Draft pricing ($20/$40) not reconciled with live Stripe ($50/$500) | ShipMind, Website | Conflicting price documentation | Medium |
| 16 | Empty/placeholder license + author metadata in manifests | ShipTalk, ShipSpace | Distribution metadata inaccurate | Low |
| 17 | Co-mingled website+Electron package.json (name "shipspace") | Website | Manifest misdescribes the deployed artifact | Low |
| 18 | Identifier discrepancy (com.shipspace.ade vs package "shipspace") unreconciled | ShipSpace, Website | Governance/inventory confusion | Low |
| 19 | Dormant curriculum/labs schema defines unused transcript data flow | Website | Schema broader than collected data; could be silently enabled | Low |
| 20 | Phantom providers (Manus slot, nano-banana mock) not documented as inactive | ShipMind, ShipSpace | Inventory over-counts active data flows | Low |
| 21 | Source-grounding limited to OpenAI not documented (claims citations broadly) | ShipMind | Feature behavior misdocumented | Low |
| 22 | SECURITY_AUDIT_REPORT.md gitignored; remediation tracking hidden from VCS | ShipTalk | Governance gap tracking prior findings | Low |
| 23 | No incident-response / breach-notification runbook | All | No documented path for the deletion/leak scenarios above | Medium |
| 24 | No data-retention ownership assigned (who prunes backups/logs/scrollback) | All | Retention duty unassigned | Medium |
| 25 | Legacy "Private" PDFs not retired/re-issued vs hedged web copy | ShipMind | Conflicting public collateral in circulation | Low |

---

## 7. Top 25 Compliance Gaps

| # | Title | Product(s) | One-line impact | Rating |
|---|-------|-----------|-----------------|--------|
| 1 | No working GDPR/CCPA erasure path despite policy promising it | All | Right-to-erasure unenforceable; regulatory exposure | Critical |
| 2 | No data-portability/export implementation despite promised JSON export | Website, all | Right-to-portability unfulfillable | High |
| 3 | Undisclosed international transfer to DeepSeek (China), no SCCs/opt-out | ShipMind, Website | GDPR Chapter V transfer violation | High |
| 4 | OWNER_EMAILS bypass safe only if email-confirmation ON (unverified in prod) | Website, all | Access-control compliance contingent on unconfirmed setting | High |
| 5 | "On-device"/"private" marketing contradicted by cloud egress | ShipTalk, ShipMind | FTC/UDAP deceptive-practice non-compliance | High |
| 6 | No sub-processor inventory (Art. 28/30 records) | All | Cannot meet processor accountability obligations | High |
| 7 | OSS attribution duties unmet across all distributed binaries | All | License-compliance breach on every release | High |
| 8 | GPL ffmpeg source-availability/notice obligations unmet | ShipMind | Direct GPL non-compliance | High |
| 9 | No DPA for business customers | All | Blocks GDPR-compliant B2B processing | High |
| 10 | No retention limits / data-minimization controls anywhere | All | Storage-limitation principle violated | High |
| 11 | Cross-tenant isolation rests on unverified RLS (security-of-processing) | All | Art. 32 security-of-processing risk | High |
| 12 | No consent-to-record framework for voice capture | ShipTalk, ShipMind | Two-party-consent statute exposure | Medium |
| 13 | Client IP collection undisclosed in privacy policy | Website | Transparency-of-collection non-compliance | Medium |
| 14 | Inaccurate sub-processor disclosures (over/under-inclusive) | Website, all | Misrepresentation of processing to data subjects | Medium |
| 15 | No data-residency / region controls for EU/UK users | All | Cannot guarantee in-region processing | Medium |
| 16 | "Built for legal teams" courts regulated users app cannot serve | ShipMind | Sector-compliance mismatch (HIPAA/attorney-client) | Medium |
| 17 | No "no compliance certification" disclaimer on desktop apps | ShipTalk, ShipMind, ShipSpace | Implied certification users may rely on | Medium |
| 18 | MPL-2.0 per-file source-availability obligations undocumented | All desktop | Weak-copyleft compliance gap | Medium |
| 19 | Bundled-binary notices (V8/ICU/BoringSSL/ggml) unmet | ShipMind, ShipSpace | License-notice compliance gap on big binaries | Medium |
| 20 | No CI license scanning (cargo-deny/cargo-about/license-checker) | All | Future copyleft/binary swap goes uncaught (how GPL ffmpeg entered) | Low |
| 21 | No breach-notification process to meet 72-hour GDPR window | All | Cannot meet notification timelines | Medium |
| 22 | usage_events/IP logs have no admin retention/anonymization path | Website | Behavioral data retained beyond necessity | Low |
| 23 | Whisper model license/provenance not surfaced to user | ShipTalk, ShipMind | Model-license disclosure gap | Low |
| 24 | Source-grounding only on OpenAI while claiming cited answers | ShipMind | Accuracy/feature-claim compliance gap | Low |
| 25 | Deploy-from-working-tree defeats release-time compliance gating | All | Audited/scanned artifact not guaranteed to be shipped artifact | Low |

---

## 8. Cross-Cutting Observations

- **Strengths to preserve (not defects):** Keychain-isolated provider keys, clean git secret history, RLS billing-column revocation, signature-verified Stripe webhooks, minisign-verified updaters that reject ad-hoc signing, server-side AI-key proxy on the website, server-authoritative merch pricing, no telemetry SDKs, and SSRF guards on browser-fetch paths. Two ShipSpace recon risks (auto-approval of risky prompts, bypassPermissions default) were verified already mitigated.
- **The same five root causes generate most findings:** (1) missing legal documents, (2) no data-lifecycle (retention/deletion/export), (3) no disclosure layer (sub-processors, on-device truth, IP collection), (4) client-trusted authorization leaning on unverified RLS, and (5) unmet attribution obligations plus one GPL conflict.
- **Items requiring live-environment confirmation (cannot be settled from the repo):** Supabase RLS policies, whether "Confirm email" is ON in production, applied vs. pending migrations, actual Vercel env vars (GOOGLE_API_KEY vs GEMINI_API_KEY), and whether the deployed prod tree matches the audited repo.

*Note: A Business Protection Blueprint is intentionally excluded from this report and will be delivered as a separate Part 2.*
