# PHASE 6 — Privacy Review

What data is collected, stored, and transmitted; retention and rights needs; and **inconsistencies between actual behavior and documented/marketed behavior**. Detail evidence in the per-cluster dossiers and `02-data-flow-audit.md`.

---

## A. Data collected

| Category | Source product(s) | Sensitivity |
|---|---|---|
| Voice/audio recordings | ShipTalk, ShipTranscribe, ShipMind, ShipClick | High (biometric voiceprint; may include third parties) |
| Transcripts | ShipTalk, ShipMind | High (dictated personal/work content) |
| Documents, PDFs, web/YouTube content | ShipMind | High (may be privileged/confidential) |
| Screen captures, OCR, app activity, browser URLs, clipboard | ShipWatch | **Very High** (aggregate behavioral profile + third-party data on screen) |
| Source code, terminal output, file contents | ShipSpace, ShipCode | High (may contain secrets) |
| Personal notes / second-brain | ship-memory, ShipMind | High |
| Account data (email, name) | makeshiphappenAi, Supabase | Moderate (PII) |
| Payment data (card via Stripe) | makeshiphappenAi | High (held by Stripe, not platform) |
| Shipping name + address | Printful (merch) | Moderate (PII) |
| Telemetry / error events | ShipCode → Supabase + Sentry | Low–Moderate |
| API keys | All apps (Keychain; ShipWatch in localStorage) | High |

## B. Data stored

- **Local:** SQLite DBs, transcript files, vector stores, captured media, logs, worktrees — generally **unencrypted at rest**; persists indefinitely.
- **Keychain:** API keys (good practice — most apps).
- **localStorage:** transcripts (ShipTalk), API keys (ShipWatch — weaker).
- **Cloud (Supabase):** account data, ShipTalk transcripts, billing state, telemetry — RLS-gated (unverifiable from repo).
- **Cloud (Stripe / Printful / Sentry):** payment, fulfillment, error data.

## C. Data transmitted (crosses the trust boundary)

Six cloud-egress paths carry user content off-device (see `02-data-flow-audit.md`): cloud STT (raw audio → OpenAI/Groq), Polish (transcript → Anthropic), ShipMind chat (doc excerpts → cloud LLM), ShipSpace (code/prompts → 9 providers), ShipWatch chat (context → Anthropic), web chat broker (→ OpenAI). Plus account/billing/telemetry to Supabase/Stripe/Printful/Sentry.

## D. Retention needs (currently undefined)

- **No retention schedule exists** for transcripts, captures, logs, or memory. Recommended: define max-retention + user-configurable purge; default-delete raw audio immediately after transcription (local path already does); time-box logs and scrub secrets/PII.
- **Cloud provider retention** depends on each provider's terms — must be disclosed; prefer providers/settings that disable training on user data.

## E. User deletion requirements (GAP)

- **Promised in the Privacy Policy, not implemented in code** (verified in web cluster). This is the single largest privacy compliance gap.
- Need: account deletion that purges Supabase rows + cancels Stripe + removes Printful PII where possible; and **local data deletion** controls in each desktop app.

## F. User export / portability requirements (GAP)

- No export endpoint/UI found. Need a machine-readable export of account data and (for desktop apps) the user's local transcripts/notes/captures.

## G. Inconsistencies — documented/marketed vs. actual behavior

| Marketed/Documented | Actual behavior | Inconsistency |
|---|---|---|
| "100% on-device" / "never leaves your machine" / "not a single byte to the cloud" | Cloud STT, Polish, cloud chat all transmit user content | **Direct contradiction** (🔴) |
| ShipTalk: "No recordings stored, uploaded, or analyzed externally" | Cloud STT uploads audio; transcripts stored forever | **Direct contradiction** (🔴) |
| ShipTalk local-engine selection implies no cloud | Polish sends transcript to Anthropic even on local | **Contradiction** (🔴) |
| "FERPA-protected" / regulated-data-safe | No certification; cloud egress; no school agreement | **Overclaim** (🔴) |
| Privacy Policy promises deletion/export | No implementing code | **Unfulfillable promise** (🔴) |
| Privacy Policy subprocessor list | Printful (and possibly others) omitted; Sentry claimed but unwired | **Inaccurate disclosure** (🟡) |
| ShipMind "grounded in your sources" | Tool-loop grounding unimplemented on 4/7 providers | **Silent guarantee failure** (🟡) |
| Age policy | 13 in one doc, 18 in another | **Internal inconsistency** (🟡) |

## H. Regulatory applicability

- **GDPR/UK GDPR** — applies to any EU/UK user; rights (access/erasure/portability) currently inoperable; no DPA/ROPA/DPIA. High-risk processing (surveillance/biometrics) triggers DPIA.
- **CCPA/CPRA** — applies once CA thresholds met or to any CA consumer for rights handling; no rights workflow, no "Do Not Sell/Share."
- **BIPA (Illinois)** and similar — voiceprint/audio processing implicates biometric-consent law.
- **COPPA** — age inconsistency + education marketing risks under-13 collection.
- **HIPAA / FERPA** — invoked by marketing; not satisfiable as built (no BAA, cloud egress).
- **EU AI Act** — AI-interaction transparency obligations.

---

## Privacy posture summary

The **engineering** privacy controls (Keychain, local-first paths, SSRF guard, RLS, no committed secrets) are reasonable. The **privacy-program** controls — accurate notice, consent for egress and recording, retention limits, and operable data-subject rights — are largely **absent or contradicted by marketing**. The fastest, code-free wins: (1) correct the marketing to match reality, (2) disclose all subprocessors accurately, (3) add a consent/notice step before any cloud egress or recording. The one item that does require building: **operable deletion/export** behind the existing Privacy Policy promise.
