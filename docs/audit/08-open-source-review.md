# PHASE 8 — Open Source Review

Full dependency-and-license sweep is in [`15-licenses-and-secrets.md`](15-licenses-and-secrets.md). This is the executive synthesis.

---

## Headline verdict — 🟢 Clean license posture

The entire stack is **permissive: MIT / Apache-2.0 / BSD / ISC / Unlicense / public-domain.** A repo-wide scan found **zero GPL / AGPL / LGPL / SSPL / BSL / Elastic / CC-NC** dependencies. For a desktop app shipped to users, this is the good outcome — no copyleft contamination of the closed commercial code.

| Component | License | Note |
|---|---|---|
| Tauri | MIT / Apache-2.0 | OK |
| Next.js, React | MIT | OK |
| whisper.cpp / ggml | MIT | OK |
| whisper-rs-sys (vendored 0.15.0) | Unlicense | Confirmed in vendored Cargo.toml |
| SQLite (better-sqlite3 / rusqlite) | Public domain | OK |
| OpenAI Whisper model weights | MIT | **Not committed** — downloaded at runtime |
| Stripe / Supabase / Anthropic / OpenAI SDKs | MIT/Apache | OK |

## Commercial-use implications

- All permissive licenses **allow commercial use and redistribution** with attribution. No license blocks shipping these apps for money.

## Attribution / distribution obligations — 🟡 two gaps

1. **No NOTICE / third-party-licenses file is bundled anywhere.** MIT/Apache/BSD all require retaining copyright/permission notices in distributed binaries. There is no root `LICENSE`, no `THIRD-PARTY`/`NOTICE`, and no per-app `licenses.html`. **This is a compliance gap in distribution** (low severity, easy to remedy: generate with `cargo-about` + an npm license-checker per app; an Electron/Chromium component would also need its notices). *Recommendation only — not generated here.*
2. **License declaration is inconsistent.** The root README and ship-it-guidelines claim "MIT," but **no LICENSE text exists** in the repo, and only `ShipCode/package.json` actually sets `license: MIT`. All other apps have an empty `license` field while being commercial (Stripe/comp-access). Intent is ambiguous: are the shipped apps proprietary (recommended) with only ShipCode open? This should be reconciled so commercial code isn't accidentally construed as MIT-licensed and the genuinely-open parts have an enforceable license.

## Potential licensing conflicts to verify (🟡, not confirmed)

- **ffmpeg build flags** (bundled in ShipMind) — if built with `--enable-gpl`/`--enable-nonfree` components, a GPL-contamination argument could be raised against the closed app. Verify the bundled build's configuration and source.
- **Local model weights (Gemma / Llama)** — if any are bundled, they carry **non-OSI acceptable-use terms** (Gemma Terms, Llama Community License) that restrict use/redistribution; confirm compliance or download at runtime under the user's acceptance.

## Distribution obligations summary

| Obligation | Status |
|---|---|
| Retain permissive-license notices in binaries | ❌ No NOTICE bundle |
| Declare own license consistently | ❌ "MIT" claimed, no LICENSE file, mixed package.json fields |
| Verify ffmpeg GPL exposure | ⚠️ Unverified |
| Verify bundled-model acceptable-use terms | ⚠️ Unverified |
| Avoid copyleft in shipped code | ✅ Clean |

**Bottom line:** Licensing is the **least risky** dimension of this audit. Two easy, low-severity hygiene items (bundle a NOTICE file; reconcile the LICENSE story) and two verifications (ffmpeg build, model weights) close it out. No conflicts block commercialization.
