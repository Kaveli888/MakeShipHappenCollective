# Third-Party Notices & Open-Source Attribution

_MakeShipHappen Collective — ShipTalk, ShipMind, ShipSpace · Last updated: 2026-06-08_

The MakeShipHappen desktop applications include open-source software. The components below are
redistributed under their respective licenses, and their copyright and permission notices are
reproduced as required. This file must travel with each distributed binary and be reachable from
an in-app **"Open Source Licenses"** screen.

> **Completeness:** This file lists the bundled native binaries, fonts, and license families that
> carry mandatory attribution duties. The full, per-dependency notice set (hundreds of MIT/Apache/
> BSD/ISC packages from npm and Cargo) is generated reproducibly — see **§ Generating the full
> notice set** at the bottom. Ship the generated `THIRD-PARTY-NOTICES.full.txt` alongside this file.

---

## Bundled native binaries & sidecars

| Component | Role | License | Attribution duty |
|---|---|---|---|
| **whisper.cpp** | Local speech-to-text (ShipTalk, ShipMind) | MIT | Reproduce MIT copyright + permission notice |
| **Ollama / ggml / llama.cpp** | Local embeddings & local model inference | MIT | Reproduce MIT notices |
| **Deno / V8 / ICU** | Embedded JS/TS runtime (ShipSpace) | MIT (Deno), BSD-3-Clause (V8), Unicode-3.0 / ICU license | Reproduce each notice |
| **yt-dlp** | Media download sidecar (ShipMind) | Unlicense (public domain) | No notice required; reproduced for transparency. Operational/ToS use is the user's responsibility (see AUP). |
| **ring → BoringSSL / OpenSSL** | TLS/crypto (all apps) | ISC / MIT / OpenSSL / BoringSSL (multi-license) | Reproduce the bundled `LICENSE`/`NOTICE` from ring, BoringSSL, and OpenSSL |
| **ffmpeg** | Audio/video processing (ShipMind) | Target: **LGPL-2.1+** (non-GPL build) — _GPLv2+ build still in tree, swap pending_ | **Decision recorded (LDR-001, 2026-06-08): ship only a non-GPL LGPL build; do not bundle GPL.** Release is gated by `shipmind/scripts/verify-ffmpeg-license.sh`, which fails the build if a `--enable-gpl`/`version3` binary is present. Once the LGPL binary is dropped in, reproduce ffmpeg's `COPYING.LGPLv2.1` + a written offer for ffmpeg's source. **Do not ship a paid release until the gate passes.** |

> **ffmpeg: decided, not yet cured.** The path is set (LGPL build — `docs/business-protection-v3/LDR-001-ffmpeg-gpl.md`)
> and enforced by a build-time gate, but the binaries currently in `shipmind/src-tauri/binaries/` are still
> the GPL builds. This row will read "compliant" only after the swap + gate pass. See
> `docs/business-protection-v3/IMPLEMENTATION-STATUS.md` §5.

---

## Weak-copyleft (MPL-2.0) components

Several Rust crates are licensed under the **Mozilla Public License 2.0**. MPL-2.0 is file-level
copyleft: the source of the MPL-licensed files must be made available to recipients. For each
MPL-2.0 crate distributed in a binary, provide the MPL-2.0 license text and a pointer to where the
corresponding source can be obtained (the upstream crate repository at the pinned version
satisfies this). The exact crate list is enumerated in the generated full notice set.

---

## Fonts

| Font | License | Duty |
|---|---|---|
| **Geist / Geist Mono** | SIL Open Font License 1.1 (OFL-1.1) | Reproduce the OFL copyright + license text; do not sell the font standalone; reserved font names apply |

---

## Permissive dependency families (npm + Cargo)

The applications depend on hundreds of packages under **MIT, Apache-2.0, BSD-2-Clause,
BSD-3-Clause, and ISC** licenses, including the Tauri framework (MIT / Apache-2.0), the React and
Next.js ecosystems, and the broader Rust crate graph. Each requires its copyright notice and
permission text to be reproduced in distributions. These are emitted, with per-package text, into
the generated full notice set described below.

---

## Generating the full notice set

Run from the repo root before each release to regenerate `THIRD-PARTY-NOTICES.full.txt`, then bundle
it into each app's resources and link it from the in-app Open Source Licenses screen:

```bash
# Node / npm side (website + any JS packages)
npx license-checker-rseidelsohn --production --plainVertical > notices-npm.txt

# Rust side — run inside each Tauri app's src-tauri/ (ShipTalk, ShipMind, ShipSpace)
cargo install cargo-about            # once
cargo about generate about.hbs > notices-rust-<app>.txt

# Concatenate into the shipped bundle
cat THIRD-PARTY-NOTICES.md notices-npm.txt notices-rust-*.txt > THIRD-PARTY-NOTICES.full.txt
```

> **Follow-up (recommended):** add `cargo-deny` / `cargo-about` and an npm license check to CI so a
> future copyleft dependency (the way the GPL ffmpeg entered) is caught at build time rather than
> after release.
