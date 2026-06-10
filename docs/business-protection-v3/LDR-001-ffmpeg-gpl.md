# Licensing Decision Record — LDR-001: GPL ffmpeg in ShipMind

_Status: **DECISION PENDING** · Opened: 2026-06-08 · Owner: Jake · Source: Audit v3 Legal #1 (Critical), IMPLEMENTATION-STATUS §5._

## Problem

ShipMind bundles and executes ffmpeg as a Tauri sidecar (`shipmind/src-tauri/tauri.conf.json:50-54`,
binaries in `shipmind/src-tauri/binaries/ffmpeg-*-apple-darwin`). The bundled binary is a **GPLv2+**
build — its own banner confirms `--enable-gpl --enable-libx264 --enable-libx265 --enable-libvidstab
--enable-libkvazaar`. `find_binary()` prefers the bundled sidecar before any PATH fallback
(`lib.rs:788-808`), so a signed paid release both **conveys and runs** the GPL binary, with no GPL
text, no corresponding-source offer, and no attribution. Each distribution is an active copyleft
violation and blocks asserting proprietary ownership over the app.

## Key finding (narrows the fix)

ShipMind uses ffmpeg for exactly one thing: decoding an input media file to 16 kHz mono PCM WAV for
Whisper transcription — `ffmpeg -i <in> -ar 16000 -ac 1 -c:a pcm_s16le -y <out>` (`lib.rs:966-978`).
This requires only demuxing + audio decoding + PCM output. **None of the GPL-only components
(x264, x265, vidstab, kvazaar — all video encoders) are used.** A standard LGPL/non-GPL ffmpeg build
performs this job identically.

## Options

| | Option | Effect | Trade-off |
|---|---|---|---|
| **A (recommended)** | **Swap to a non-GPL (LGPL) ffmpeg build** — drop `--enable-gpl` and the x264/x265/vidstab/kvazaar encoders; keep audio decode + PCM | Removes the copyleft breach; product behavior unchanged; can still assert proprietary ownership; still ships fully offline | Must obtain/build LGPL ffmpeg binaries for the 3 arch variants (aarch64, x86_64, universal) and replace the files in `binaries/`. Still reproduce LGPL + dependency notices in THIRD-PARTY-NOTICES. |
| B | Stop bundling; rely on ffmpeg on the user's PATH | Zero copyleft conveyance | Transcription breaks for users without ffmpeg installed; degrades the out-of-box, offline promise. |
| C | Full GPL compliance — ship the GPL text + a corresponding-source offer | Current binary stays | Cannot cleanly assert proprietary ownership of the app; ongoing source-offer obligation; least aligned with a paid closed product. |

## Recommendation

**Option A.** The GPL components are dead weight for ShipMind's actual use; an LGPL build is a
drop-in that erases the violation with no feature loss. Action required from owner:
1. Obtain non-GPL ffmpeg builds (e.g. an LGPL static build without `--enable-gpl`/x264/x265) for
   `aarch64`, `x86_64`, and `universal` macOS.
2. Replace the files in `shipmind/src-tauri/binaries/`.
3. Confirm the new banner shows no `--enable-gpl` and transcription still works.
4. Add the LGPL ffmpeg notice (and its remaining dependency notices) to `THIRD-PARTY-NOTICES.md`.
5. Do not ship a paid ShipMind release with the current GPL binary until this is done.

## Decision

**Chosen: Option A — swap to a non-GPL (LGPL) ffmpeg build.** Decided 2026-06-08 by Jake.

Rationale: ShipMind only decodes media → 16 kHz mono PCM for Whisper; the GPL-only encoders
(x264/x265/vidstab/kvazaar) are never used, so an LGPL build is a drop-in with zero feature or UX
change while erasing the copyleft conveyance. ffmpeg is invoked as a **separate process**
(`std::process::Command` in `lib.rs:966`), never linked into the app, so this is mere aggregation —
the obligation is to ship ffmpeg's own LGPL notice + a source offer for ffmpeg, not to open ShipMind's
source.

### Status of execution (2026-06-08)
- ✅ Decision recorded (this file).
- ✅ Build-time release gate added: `shipmind/scripts/verify-ffmpeg-license.sh` inspects every
  `src-tauri/binaries/ffmpeg-*` banner and **exits non-zero if any reports `--enable-gpl` or
  `version3`**, so a GPL binary can never silently ship again. _Running it today FAILS — the three
  bundled binaries are still the old GPL builds._
- ✅ `THIRD-PARTY-NOTICES.md` updated to reflect the decision + gate (still honestly marked
  not-yet-cured until the binary is swapped).
- ⬜ **REMAINING — owner action (binary swap, cannot be done in code):** produce LGPL ffmpeg builds
  for `aarch64`, `x86_64`, and `universal` macOS and replace the files in
  `shipmind/src-tauri/binaries/`. A stock ffmpeg build is LGPL by default — just configure **without**
  `--enable-gpl`, `--enable-version3`, `--enable-libx264`, `--enable-libx265`, `--enable-libvidstab`,
  `--enable-libkvazaar`, `--enable-postproc`. Keep the permissive/LGPL libs (opus, mp3lame, vorbis,
  vpx, webp, aom, dav1d, etc.). Then run the gate above; it must pass before the next paid release.
