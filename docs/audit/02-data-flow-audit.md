# PHASE 2 — Data Flow Audit

Tracks how user input, files, audio, text, logs, analytics, API requests, agent communication, and stored data move through the ecosystem. For each flow: **Origin → Destination · Retention · Security controls · Responsible party.**

> **Responsible-party legend:** PO = Platform Owner (MakeShipHappen) · U = User · TP = Third-Party Provider · S = Shared.

---

## Visual hierarchy — where data crosses the trust boundary

```
                         ┌──────────────────────────── USER'S DEVICE (trust boundary) ────────────────────────────┐
                         │                                                                                          │
  User voice ───────────┼──► mic ──► whisper.cpp (LOCAL) ──► transcript ──► localStorage / SQLite (PERSISTS) ──────┼──┐
  User docs/PDF/YT ──────┼──► ingest ─► whisper/ffmpeg/yt-dlp ─► Ollama embeddings (LOCAL) ─► local vector store ───┼──┤
  User code/files ───────┼──► ShipSpace agents (raw PTY shell, edits files) ─► worktrees / git ────────────────────┼──┤
  Screen/mic/clipboard ──┼──► ShipWatch capture ─► local SQLite + files + OCR + Ollama vision (LOCAL) ──────────────┼──┤
  Keystroke/voice cmd ───┼──► ShipClick ─► Claude Code agent ─► physical Mac control (LOCAL actions) ───────────────┼──┤
                         │                                                                                          │  │
                         │   API keys ──► macOS Keychain (most apps) / localStorage (ShipWatch)                     │  │
                         │                                                                                          │  │
                         └──────────────────────────────────────────────────────────────────────────────────────┘  │
                                                                                                                      │ CROSSES TO CLOUD ▼
  ┌───────────────────────────────────────────── THIRD-PARTY CLOUD ──────────────────────────────────────────────────┘
  │
  ├─► Anthropic   ◄── ShipTalk "Polish" (full transcript, EVEN IF local engine chosen), ShipMind chat (RAG'd doc excerpts),
  │                   ShipSpace (code/prompts), ShipWatch chat proxy, ShipClick
  ├─► OpenAI/Groq ◄── ShipTalk cloud STT (RAW AUDIO incl. bystanders), ShipSpace, makeshiphappenAi chat broker
  ├─► Google/DeepSeek/xAI/Perplexity/Manus ◄── ShipSpace provider modules
  ├─► Supabase   ◄── account email/name, ShipTalk transcripts, ShipCode telemetry, billing state (RLS-gated)
  ├─► Stripe     ◄── payment method, billing, subscription state (PCI handled by Stripe)
  ├─► Printful   ◄── customer NAME + SHIPPING ADDRESS (merch fulfillment)
  └─► Sentry     ◄── error telemetry (claimed)
```

**Key insight:** Every product has a genuine local path, but **six distinct cloud-egress paths exist** that carry potentially sensitive user content off the device. The marketing claims (Phase 9) assert this does not happen.

---

## Flow-by-flow report

### A. Voice / Audio (ShipTalk, ShipTranscribe, ShipMind voice, ShipClick)
| Flow | Origin → Destination | Retention | Controls | Resp. |
|---|---|---|---|---|
| Local transcription | mic → whisper.cpp (device) | Audio = RAM only (transient); transcript persists | On-device, no egress | U/PO |
| Cloud STT | mic → OpenAI/Groq | Audio uploaded; provider retention per their terms | TLS; **no consent capture for bystanders** | S (PO+TP) |
| "Polish" | transcript → Anthropic | Provider-side | TLS; **fires even when local engine selected** | PO |
| Transcript store | transcript → localStorage + Supabase | **Forever (no purge)** | RLS (unverifiable); plaintext at rest | PO |
| Auto-paste | transcript → active app via accessibility | n/a | Accessibility permission; wrong-app paste risk | U |

### B. Documents / Knowledge (ShipMind, ship-memory)
| Flow | Origin → Destination | Retention | Controls | Resp. |
|---|---|---|---|---|
| Ingest | YouTube/PDF/RSS/file → local store | Until user deletes | SSRF guard on egress; yt-dlp copyright concern | S (U+PO) |
| Embeddings/RAG | docs → Ollama (local) | Local vector store | On-device | PO |
| Cloud chat | RAG'd excerpts → Anthropic/OpenAI/Groq | Provider-side | TLS; **excerpts may be privileged** | S |
| Memory vault | notes → `~/ShipMemory` markdown | Permanent until deleted | **Plaintext, unauthenticated**; MCP read/write/delete | U/PO |

### C. Code / Terminal (ShipSpace, ship-aos, ShipCode, ShipClick)
| Flow | Origin → Destination | Retention | Controls | Resp. |
|---|---|---|---|---|
| Agent shell exec | prompt → raw PTY → OS | Command effects permanent | **No validation layer**; danger/bypass modes | S (U+PO) |
| Agent→provider | code/files/prompts → cloud LLM | Provider-side | TLS; **no secret scrubbing** | S |
| Agent→agent | ShipGang state object (in-process) | Session | Tag-delimited; trust within app | PO |
| Auto-merge/PR | agent code → user branch / GitHub | Permanent | **No human review**; `gh` auth | U |
| File read | `read_file`/`list_directory` → renderer | n/a | **Path-unconfined** (can read ~/.ssh) | PO |

### D. Surveillance capture (ShipWatch)
| Flow | Origin → Destination | Retention | Controls | Resp. |
|---|---|---|---|---|
| Capture | screen/mic/audio/clipboard/URL → local SQLite+files | Until user deletes | Local; **no bystander consent** | S |
| Cloud chat | captured context → Anthropic via Hono proxy | Provider-side | **Proxy binds 0.0.0.0**; browser-only CORS; Bearer-license | PO |
| Keys | API keys → webview `localStorage` | Persistent | **Not Keychain** — exfiltratable | PO |

### E. Accounts / Billing / Telemetry (makeshiphappenAi, ShipCode)
| Flow | Origin → Destination | Retention | Controls | Resp. |
|---|---|---|---|---|
| Signup/login | email/name → Supabase | Account lifetime; **no deletion code** | RLS; email-confirm; owner gated on confirm | PO |
| Checkout | payment → Stripe; subscription state → Supabase | Per Stripe/retention | Webhook idempotency; signature verify; **status hardcoded active (M-2)** | S |
| Merch | name + address → Printful | Per Printful | Webhook fulfillment + retry; **not in subprocessor list** | S |
| cli-login | token → ShipCode (loopback) | chmod-600 file + Keychain | random `state` + Origin/Referer; **state-echo deploy-dependent** | PO |
| Telemetry | events → Supabase + Sentry | Per provider | Public keys; signed-in only | PO |
| `/api/auth/verify` | → echoes email + user_id | n/a | **Over-discloses PII (M-1)** | PO |

### F. Logs / Analytics
| Flow | Origin → Destination | Retention | Controls | Resp. |
|---|---|---|---|---|
| App/agent logs | prompts/files/terminal/PII → local logs | **No documented rotation/retention** | **No scrubbing** | PO |
| Lighthouse/audit outputs | build artifacts → repo | In repo | n/a | PO |

---

## Cross-cutting data-flow observations

1. **The trust boundary is crossed silently.** Users on local-first products have no in-product indication of which actions send data to which cloud provider. This is the root of the Phase 9 marketing-claim risk and the Phase 6 privacy-inconsistency risk.
2. **No retention governance.** Transcripts, captures, logs, and memory persist indefinitely with no purge, no documented schedule, and no user-facing deletion path that actually runs.
3. **Subprocessor sprawl.** At least 8 third parties receive user data (Anthropic, OpenAI, Groq, Google, Supabase, Stripe, Printful, Sentry) with no DPA register or user-facing disclosure of all of them.
4. **Responsibility is "Shared" for the highest-risk flows** (cloud STT of bystanders, agent shell exec, surveillance capture) — and "Shared" without a written allocation is where liability disputes start (see Phase 4).
