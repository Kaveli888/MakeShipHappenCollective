# Phase 8 — Open Source / License Review

**Audit type:** Read-only license, attribution, and distribution-obligation review
**Date:** 2026-06-07
**Scope:** ShipTalk, ShipMind, ShipSpace (Tauri desktop apps) and the makeshiphappen.tech website (`makeshiphappenAi/`, a Next.js + Electron project)
**Auditor role:** Senior auditor + SaaS/privacy/technology attorney + compliance officer
**Caveat:** All four products are **paid, distributed binaries** (signed macOS apps / DMGs / Electron builds) or a publicly deployed paid web service. Distribution materially changes license obligations versus internal-only use — every "attribution" finding below is grounded in that fact.

---

## 1. Executive Summary

The Ship Ecosystem's dependency graphs are, on the whole, **commercially safe**. Across all four products the JavaScript trees are essentially 100% permissive (MIT / ISC / Apache-2.0 / BSD / 0BSD / Unicode-3.0 / SIL-OFL), and the Rust/Tauri crate trees (ShipTalk 579 crates, ShipMind 570, ShipSpace 559) contain **no strong copyleft** — no GPL, AGPL, LGPL, SSPL, BUSL, OSL, EUPL, or CPAL. The paid, closed-source business model is therefore **not at risk of forced source disclosure from the package managers.**

There are, however, two distinct categories of real exposure:

1. **One genuine GPL copyleft conflict (Critical).** ShipMind bundles and ships a **statically-linked GPLv2-or-later build of `ffmpeg`** (compiled with `--enable-gpl --enable-libx264 --enable-libx265 --enable-libvidstab --enable-libkvazaar`) as a Tauri sidecar inside a paid, closed-source desktop app, with no GPL license text, no source offer, and no attribution. This is the single highest-priority license item in the entire ecosystem. **Verified directly** from the binary's build banner (`shipmind/src-tauri/binaries/ffmpeg-aarch64-apple-darwin -version`) and the embedded string `libavcodec license: GPL version 2 or later`.

2. **Pervasive missing attribution / NOTICE compliance (High).** Every product distributes hundreds of MIT/BSD/Apache-2.0/ISC dependencies (plus, in ShipMind, large native binaries: ffmpeg, deno ~212MB, ollama+ggml, yt-dlp, whisper.cpp). **MIT, BSD, ISC, and Apache-2.0 all legally require the copyright notice and license text to travel with the distributed binary; Apache-2.0 §4(d) additionally requires NOTICE-file propagation.** A repo-wide search found **zero** app-level LICENSE, NOTICE, or THIRD-PARTY-LICENSES files (the only LICENSE on disk is the upstream vendored `whisper.cpp` copy) and **no in-app About/Credits/Licenses screen** anywhere. This means essentially every permissive dependency's redistribution clause is currently unsatisfied across all shipped products.

Lesser items include 5 weak-copyleft **MPL-2.0** crates statically linked into each Tauri binary (per-file source-availability obligation, light to satisfy), the `ring` crate's bundled BoringSSL/OpenSSL NOTICE requirements, non-standard SPDX licenses (Unicode-3.0, CDLA-Permissive-2.0) that naive attribution tooling silently drops, empty/placeholder license metadata in manifests, and a website manifest (`makeshiphappenAi/package.json`) that co-mingles a server-only website with a distributable Electron app, maximizing the obligation surface.

**Bottom line:** The work required is overwhelmingly **attribution and one GPL remediation**, not relicensing. None of the findings — except the GPL ffmpeg — blocks commercial sale, but all are unmet obligations on a product being sold today.

---

## 2. Severity Legend

| Severity | Meaning |
|---|---|
| **Critical** | Active license conflict / breach that could trigger injunctions, source-disclosure demands, or distribution takedown for a paid product. |
| **High** | Broad, currently-unmet redistribution obligation across many dependencies in a shipped binary; low effort to fix but legally required. |
| **Medium** | Specific unmet obligation (weak copyleft, bundled native code, multi-license crate) that must be covered in an attribution bundle. |
| **Low** | Metadata hygiene / narrow obligation / risk only under future conditions. |
| **Info** | Inventory / positive control / no action required. |

---

## 3. Ecosystem-Wide License Inventory

### 3.1 Aggregate license distribution (verified against installed sources)

| Layer | Permissive (MIT/Apache/ISC/BSD/0BSD/Unicode/SIL-OFL/Unlicense) | Weak copyleft (MPL-2.0) | Strong copyleft (GPL/AGPL/LGPL) | Notes |
|---|---|---|---|---|
| **ShipTalk** Rust (579 crates) | 252 `MIT OR Apache-2.0`, 133 MIT, 36 `Apache-2.0 OR MIT`, + Apache-2.0/ISC | 5 (cssparser, cssparser-macros, dtoa-short, selectors, option-ext) | **0** | `r-efi` offers LGPL *as an OR option* → not triggered |
| **ShipTalk** JS (app) | 176 MIT, 15 Apache-2.0, 14 ISC, 6 BSD-2, 2 BSD-3, 1 Python-2.0, 1 CC-BY-4.0 (build-time only), 1 0BSD | 0 | **0** | All permissive |
| **ShipTalk** JS (shiptalk-mcp) | MIT/ISC/BSD/Apache, 1 `MIT OR WTFPL` | 0 | **0** | + 1 no-license placeholder `beep-boop` (see 4.1) |
| **ShipMind** Rust (570 crates) | MIT/Apache-2.0 dominant, Unlicense (whisper-rs), BSD-3/MIT (brotli), ISC/MIT (ring) | (none confirmed in spot-check) | **0** | |
| **ShipMind** JS | MIT dominant, ISC (lucide), Apache-2.0 (cva), SIL-OFL (geist) | 0 in app deps | LGPL-3.0 libvips present but **not distributed** (see 5.4) | |
| **ShipSpace** Rust (559 crates) | ~170 `MIT OR Apache-2.0`, 83 MIT, 32 `Apache-2.0 OR MIT`, BSD/ISC/Zlib, 18 Unicode-3.0, 1 CDLA-Permissive-2.0 | 5 (same Tauri/wry + keyring crates) | **0** | |
| **ShipSpace** JS (app + mcp) | 100% permissive (MIT/ISC/BSD/Apache/0BSD/CC-BY-4.0/Unicode-3.0) | 0 | **0** | |
| **Website** JS (makeshiphappenAi) | MIT dominant, ISC, Apache-2.0 (sharp top-level), BSD-2/3, BlueOak-1.0.0, CC0, 0BSD | 1 (axe-core, dev/test) | LGPL-3.0 libvips (via sharp, server-side) | |

### 3.2 Bundled native binaries (the high-risk surface)

| Binary | Product | License | Distribution trigger | Status |
|---|---|---|---|---|
| `ffmpeg` (`--enable-gpl`, x264/x265/vidstab/kvazaar) | **ShipMind** | **GPL-2.0-or-later** | Shipped as `externalBin` sidecar | **CONFLICT — Critical** |
| `whisper.cpp` / GGML (statically compiled) | ShipTalk, ShipMind | MIT (ggml authors) | Compiled into binary via whisper-rs-sys | Attribution unmet |
| `deno` (embeds V8 + ICU) | ShipMind | MIT (deno) / BSD-3 (V8) / Unicode (ICU) | Sidecar (~212MB universal) | Attribution unmet |
| `ollama` + `libggml-*` | ShipMind | MIT (Ollama, ggml) | Bundled resource | Attribution unmet |
| `yt-dlp` | ShipMind | Unlicense (public domain) | Sidecar | No obligation (clean) |
| Whisper model weights (`ggml-base.en.bin`, etc.) | ShipTalk | MIT (derived from OpenAI Whisper, MIT) | Downloaded at runtime, no checksum | License not bundled; unverified fetch |

---

## 4. ShipTalk — Findings

ShipTalk is a paid, distributed Tauri 2 macOS app. **No strong copyleft; no commercial-use restriction.** The risk is entirely attribution/metadata.

### 4.1 Findings Table

| ID | Title | Severity |
|---|---|---|
| ST-1 | No attribution/NOTICE shipped despite ~250+ Apache-2.0 and ~300+ MIT deps in the distributed binary | **High** |
| ST-2 | Five MPL-2.0 (weak-copyleft) crates statically linked into the shipped macOS binary | **Medium** |
| ST-3 | Bundled whisper.cpp/GGML is MIT (clean) but its copyright notice is not redistributed | **Medium** |
| ST-4 | App ships with empty/blank license declaration — no project license of record | **Low** |
| ST-5 | Whisper model weights downloaded from HuggingFace at runtime — no license bundling, no checksum | **Low** |
| ST-6 | shiptalk-mcp contains a no-license placeholder dependency `beep-boop` | **Low** |
| ST-7 | No GPL/AGPL/LGPL strong-copyleft contamination anywhere — confirmed clean | **Info** |

### 4.2 Detail

**ST-1 — Missing attribution/NOTICE (High).** The Rust tree (`ShipTalk/src-tauri/Cargo.lock`, 579 crates) resolves to 252 `MIT OR Apache-2.0`, 133 MIT, 36 `Apache-2.0 OR MIT`, plus standalone Apache-2.0 (`ring` = Apache-2.0 AND ISC). The JS app tree is 176 MIT + 15 Apache-2.0 + ISC/BSD. Both MIT (copyright-notice + permission text) and Apache-2.0 (§4(d) NOTICE retention) **require attribution to accompany the binary.** A repo-wide search found **zero** LICENSE/NOTICE/THIRD-PARTY-LICENSES files and no in-app Licenses/About screen; `tauri.conf.json` has no license/copyright field. This is the single largest compliance gap for shipping a commercial DMG.

**ST-2 — MPL-2.0 crates in the binary (Medium).** `cssparser-0.29.6`, `cssparser-macros-0.6.1`, `dtoa-short-0.3.5`, `selectors-0.24.0` (via `kuchikiki → tauri-utils/wry`) and `option-ext-0.2.0` (via `dirs → tauri/wry/updater/tray-icon`). These are **core Tauri deps present on every platform**, so they are in the macOS build. MPL-2.0 is file-level copyleft: it does **not** contaminate proprietary code, but recipients must be told the binary contains MPL code and the corresponding MPL source for those files must be available on request. Low practical risk (ubiquitous in all Tauri apps); must be covered by the attribution bundle.

**ST-3 — Bundled whisper.cpp MIT notice (Medium).** `whisper-rs-0.16.0` / `whisper-rs-sys-0.15.0` are published as `Unlicense` (no obligation), but `whisper-rs-sys` statically **compiles the vendored `whisper.cpp` C/C++ source** into the binary, and that native code is **MIT** (`whisper.cpp/LICENSE` = "MIT License, Copyright (c) 2023-2024 The ggml authors"). The Unlicense wrapper does not erase the embedded code's MIT attribution obligation. Called out separately because statically-linked native code is easy to forget.

**ST-4 — Empty license metadata (Low).** **Verified:** `ShipTalk/src-tauri/Cargo.toml` declares `name = "app"`, `description = "A Tauri App"`, `authors = ["you"]`, `license = ""`, `repository = ""` (lines 2–7) — unfinalized Tauri scaffold defaults. `package.json` is `private: true` with no license field; `shiptalk-mcp/package.json` likewise. For a commercial product this is the EULA/ownership anchor; set an explicit proprietary license string and real copyright holder.

**ST-5 — Runtime model download (Low).** `ShipTalk/src-tauri/src/lib.rs:69-80` downloads `ggml-base.en.bin` / `ggml-small.en.bin` from `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/` into `~/Library/Application Support/<bundle>/whisper-models` (lib.rs:449). The weights are MIT (commercially fine), but their license is never bundled/surfaced and the download has **no checksum/signature verification** — a provenance/supply-chain note as well as a license one.

**ST-6 — `beep-boop` no-license dep (Low).** `shiptalk-mcp/node_modules` surfaced `beep-boop@1.2.3` with `license = NONE`. A dependency with no declared license is "all rights reserved" by default. It appears to be a transitive filler/joke package from the better-sqlite3/node-gyp toolchain; the MCP server is `private: true` and not part of the DMG, so exposure is low. Verify it is not bundled and consider removing/pinning.

**ST-7 — Clean of strong copyleft (Info).** No GPL/AGPL in 579 crates. `r-efi-5.3.0` offers `MIT OR Apache-2.0 OR LGPL-2.1-or-later` — the `OR` means you take MIT/Apache; the LGPL option is **not** triggered. ShipTalk can ship as closed-source with **no source-disclosure obligation.**

---

## 5. ShipMind — Findings

ShipMind is a paid, code-signed Tauri app (`com.makeshiphappen.shipmind` v2.0.3). **The most serious license exposure in the entire ecosystem lives here**, in the bundled native binaries — not the package managers.

### 5.1 Findings Table

| ID | Title | Severity |
|---|---|---|
| SM-1 | **Bundled ffmpeg is a GPL build redistributed inside a paid proprietary app** | **Critical** |
| SM-2 | No attribution/NOTICE/third-party-license disclosure shipped (violates MIT/BSD/Apache/SIL-OFL) | **Medium** |
| SM-3 | Bundled deno (V8/ICU) and ollama/ggml binaries: permissive but undisclosed notices | **Low** |
| SM-4 | Bundled Apache-2.0 / SIL-OFL components need explicit notice files (geist font, cva) | **Low** |
| SM-5 | Rust crate tree permissive but no cargo-deny/cargo-about license enforcement | **Low** |
| SM-6 | LGPL-3.0 libvips (via sharp via Next.js) present in node_modules but NOT distributed | **Info** |
| SM-7 | MCP server and dependency manifests are clean and consistent (permissive) | **Info** |

### 5.2 SM-1 — GPL ffmpeg conflict (CRITICAL)

> **CALLOUT — COPYLEFT CONFLICT.** This is the only active license **conflict** (not merely an unmet attribution duty) in the ecosystem and must be resolved before further paid distribution.

**Verified directly during this audit.** Running `shipmind/src-tauri/binaries/ffmpeg-aarch64-apple-darwin -version` returns:

```
ffmpeg version 7.0 Copyright (c) 2000-2024 the FFmpeg developers
configuration: ... --enable-gpl --enable-libx264 --enable-libx265 --enable-libvpx
  --enable-libvidstab --enable-libsvtav1 --enable-libkvazaar --pkg-config-flags=--static ...
```

and the embedded strings include `libavcodec license: GPL version 2 or later`, `libavformat license: GPL version 2 or later`, etc.

- `--enable-gpl` plus the GPL-only encoders **x264, x265, libvidstab, kvazaar** force the **entire ffmpeg binary to GPL-2.0-or-later**, not LGPL.
- The binary is shipped as a Tauri `externalBin` sidecar: `shipmind/src-tauri/tauri.conf.json:50-53` lists `"binaries/ffmpeg"`, and the platform binaries are committed at `shipmind/src-tauri/binaries/ffmpeg-{aarch64,x86_64,universal}-apple-darwin` (49–128 MB each).
- ShipMind shells out to it at runtime (`shipmind/src-tauri/src/lib.rs:966` via `std::process::Command`).

**Why it is a conflict:** Conveying a GPL binary as part of a paid, closed-source application is permitted under GPL's *mere-aggregation* rules **only if the GPL obligations are met for the GPL component**: (1) include the full GPL license text; (2) provide the complete corresponding source code (the exact ffmpeg + x264 + x265 + build scripts/config used) **or** a valid written offer; (3) clearly disclose the component as GPL. A repo-wide search found **none** of these — no LICENSE/NOTICE/source-offer anywhere in `shipmind/src` or `shipmind/src-tauri` (only the unrelated vendored `whisper.cpp/LICENSE`). Shipping today is therefore a **GPL distribution breach** exposing the distributor to source-disclosure demands and potential takedown.

**Remediation options (not applied — read-only audit):**
1. **Ship an LGPL/non-GPL ffmpeg build** — drop `--enable-gpl` and all GPL-only encoders (x264/x265/vidstab/kvazaar). This removes H.264/H.265 *encoding*; for transcription-only use, decoding via system frameworks or LGPL-compatible decoders may suffice. Then ship the LGPL text and provide relink ability.
2. **Stop bundling — resolve ffmpeg from PATH at runtime.** The code already has a PATH fallback path (`shipmind/src-tauri/src/lib.rs:829-844`), and sibling apps avoid the trigger this way (ShipTranscribe `find_binary` at `ShipTranscribe/src-tauri/src/lib.rs:12-24` PATH-resolves system ffmpeg with no `externalBin`; ShipTalk likewise). Not bundling = no distribution = no GPL trigger.
3. **Fully comply with GPL** — publish the corresponding source + scripts and ship the GPL license text with every release.

> ShipMind is the **only** Ship app that bundles ffmpeg.

### 5.3 SM-2 — Missing attribution (Medium)

A repo-wide search found **no** LICENSE, NOTICE, THIRD-PARTY-LICENSES, attribution, or credits file in `shipmind/` (only the upstream vendored `src-tauri/vendor/whisper-rs-sys-0.15.0/whisper.cpp/LICENSE`), and **no** About/Credits/Licenses screen in the UI. The app distributes dozens of MIT JS deps (react, react-dom, react-markdown, mermaid, framer-motion, zustand, zod, howler, `@anthropic-ai/sdk`, `@supabase/supabase-js`, `@xyflow/react`, `@tanstack/react-table`, clsx, tailwind-merge), ISC (lucide-react), Apache-2.0 (class-variance-authority), SIL-OFL (geist font), and the bundled binaries (deno, yt-dlp, whisper.cpp, ollama+ggml). **MIT/BSD/ISC/Apache-2.0 all require reproducing the copyright notice + license text; SIL-OFL requires shipping the OFL text with the font.** None satisfied. Broad, low-effort-to-fix compliance gap.

### 5.4 Other ShipMind findings

- **SM-3 (Low):** `src-tauri/binaries/deno-*` (deno 2.7.13, MIT) embeds **V8 (BSD-3, Google)** and **ICU**, each with its own notice requirement; `src-tauri/ollama-bundle/{ollama, libggml-*}` (MIT) likewise. No copyleft, but big separately-redistributed executables (deno universal = 212MB) whose notices are unmet under SM-2.
- **SM-4 (Low):** `geist` font = SIL-OFL (must bundle OFL text, respect Reserved Font Name); `class-variance-authority` = Apache-2.0 (must propagate any upstream NOTICE, state modifications, includes patent grant). Both undisclosed.
- **SM-5 (Low):** 570 Rust crates, all permissive (tauri MIT/Apache, rusqlite+bundled SQLite public-domain, keyring, serde, pdf-extract MIT, hound, objc2, whisper-rs Unlicense, brotli BSD-3/MIT, ring ISC/MIT). Risk is **procedural**: no `cargo-deny.toml` / `deny.toml` / `cargo-about` config to catch a future copyleft crate or auto-generate the attribution bundle SM-2 needs. Recommend cargo-deny (license allowlist) + cargo-about + an npm license-checker in CI.
- **SM-6 (Info):** `@img/sharp-libvips-darwin-arm64` declares **LGPL-3.0-or-later**, pulled transitively by `sharp` ← `next`. **Next.js/sharp are not in `shipmind/package.json` dependencies and `sharp` is not imported in `src/`**; the Tauri/Vite frontend bundle does not include native node modules, so libvips is **never distributed.** Hygiene note only — if a future feature imports sharp, LGPL dynamic-linking/relink obligations would then attach.
- **SM-7 (Info):** `shipmind-mcp` (`@modelcontextprotocol/sdk` MIT, better-sqlite3 MIT, zod MIT, typescript Apache-2.0) is **clean** of GPL/AGPL/LGPL/MPL/SSPL/BUSL/Elastic/Commons-Clause. The browser extension has no package.json / no JS deps. Positive control: package-managed surfaces are commercially safe; the risk is the bundled native binaries.

---

## 6. ShipSpace — Findings

ShipSpace is a signed, commercially-distributed Tauri app (Developer ID: **Jacob Felton (7G7K3X24Q5)**, `tauri.conf.json` macOS.signingIdentity, `targets: all`, `createUpdaterArtifacts: true`). **No GPL/AGPL/LGPL/SSPL/BUSL/OSL/EUPL/CPAL anywhere** in 559 Rust crates or the full JS trees. The risk is governance/attribution.

### 6.1 Findings Table

| ID | Title | Severity |
|---|---|---|
| SS-1 | No third-party attribution/NOTICE shipped despite 600+ permissive deps requiring notice reproduction | **High** |
| SS-2 | 5 MPL-2.0 (weak copyleft) crates compiled into the distributed macOS binary | **Medium** |
| SS-3 | `ring` crate bundles BoringSSL/OpenSSL-derived code with separate NOTICE/license terms | **Medium** |
| SS-4 | No license declared for ShipSpace, shipspace-mcp, or the Rust crate | **Low** |
| SS-5 | Unicode-3.0 (ICU4X) and CDLA-Permissive-2.0 (webpki-roots) carry data-attribution terms naive tooling misses | **Low** |
| SS-6 | Two unusually-named transitive npm deps (`obug`, `iceberg-js`) — clean licenses, supply-chain note | **Info** |
| SS-7 | Clean bill: no strong copyleft — paid closed-source model not at license risk | **Info** |

### 6.2 Detail

**SS-1 — Missing attribution (High).** Signed/distributed app ships no LICENSE/NOTICE/THIRD-PARTY-LICENSES and no attribution-generation tooling (no cargo-about/deny.toml/about.toml; no license step in `scripts/dev-signed.mjs` or `upload-release.mjs`). MIT/BSD-2/3/Apache-2.0/ISC all condition binary redistribution on reproducing the notice + license text; the binary statically links 559 crates plus the Vite JS build. Selling it without these notices breaches essentially every dependency's license at once. Remediation: generate a bundled THIRD-PARTY-LICENSES via cargo-about + a JS aggregator, include it in the app bundle/Help menu.

**SS-2 — MPL-2.0 crates (Medium).** `cssparser 0.29.6`, `cssparser-macros 0.6.1`, `selectors 0.24.0`, `dtoa-short 0.3.5` (via `kuchikiki → tauri-utils/wry → tauri`) and `option-ext 0.2.0` (via `dirs-sys → keyring`). File-level weak copyleft — does not infect the app, but obligates source availability for those specific files + notice preservation. Light to satisfy (point to upstream + include MPL text), currently undocumented.

**SS-3 — `ring` bundled BoringSSL (Medium).** `ring 0.17.14` (`Apache-2.0 AND ISC`) is in the binary via the rustls TLS stack (`Cargo.toml:33` reqwest `default-features=false features=['rustls-tls']`, plus hyper-rustls/rustls 0.23.37). The crate ships `LICENSE`, `LICENSE-BoringSSL`, `LICENSE-other-bits`, and a `third_party/` dir — multiple bundled licenses (BoringSSL BSD-style with OpenSSL/SSLeay attribution clauses) whose notices must travel with the binary. Permissive but more than a single SPDX line; ensure attribution tooling captures all of ring's LICENSE files.

**SS-4 — No license of record (Low).** `ShipSpace/package.json` (no `license` key), `shipspace-mcp/package.json` (no `license`), and `src-tauri/Cargo.toml` (no `license`). For a paid product, "all rights reserved by default" is acceptable, but (a) npm emits "unlicensed" warnings and (b) there is no explicit EULA/proprietary assertion in the distributed artifact. Add `"license": "UNLICENSED"` (or a proprietary SPDX) and ship an EULA.

**SS-5 — Non-standard SPDX data licenses (Low).** 18 ICU4X crates = `Unicode-3.0`; `unicode-ident 1.0.24` = `(MIT OR Apache-2.0) AND Unicode-3.0`; `webpki-roots 1.0.6/1.0.7` = `CDLA-Permissive-2.0` (data license for the embedded root-CA list). All permissive, no commercial restriction, but non-standard identifiers requiring their own notice text — a naive "collect MIT/Apache" pass silently drops them. Include the Unicode-3.0 and CDLA-Permissive-2.0 texts in the attribution bundle.

**SS-6 — Supply-chain note (Info).** `obug 2.1.1` (a fork of `debug`, MIT, pulled by vitest 4.1.4) and `iceberg-js 0.8.1` (Apache Iceberg REST client, MIT, pulled by `@supabase/storage-js`). Both legitimate upstream transitives (confirmed via package-lock edges), not typosquats. Licenses clean; flagged only for inventory completeness — `iceberg-js` is an unexpected dep for a desktop IDE that rides in via Supabase storage-js even if storage is unused.

**SS-7 — Clean bill (Info).** Zero strong/source-available-restrictive licenses across all 559 crates + full JS trees. Rust distribution: ~170 `MIT OR Apache-2.0`, 83 MIT, 32 `Apache-2.0 OR MIT`, + BSD/ISC/Zlib/Unicode-3.0/MPL-2.0(5)/CDLA(1). JS: 100% permissive. **No legal barrier to selling ShipSpace as proprietary; no source-disclosure obligation.** Remaining work is attribution only.

---

## 7. makeshiphappen.tech Website (makeshiphappenAi/) — Findings

`makeshiphappenAi` is a Next.js web app **with no `src-tauri/Cargo.toml` of its own — it is an Electron project, not Tauri.** Its JS tree is overwhelmingly permissive, so the website itself is **LOW license risk.** Findings here also cover the co-distributed desktop apps where the manifest blurs the line.

> **Deployment caveat:** Production ships via `vercel --prod` from the local working tree (not git), and desktop binaries are packaged locally. The license inventory derives from `package-lock.json` + installed `node_modules` and the committed `Cargo.lock` files. Because the deployed artifact is built off uncommitted local state, a dependency (or a differently-built ffmpeg) could be swapped without appearing in the repo. **Treat the lockfile as the only license source of truth and gate releases on a license scan of the exact lockfile used.**

### 7.1 Findings Table

| ID | Title | Severity |
|---|---|---|
| WS-1 | **GPLv2+ ffmpeg statically linked & distributed inside paid closed-source desktop app (ShipMind)** | **Critical** |
| WS-2 | No THIRD-PARTY/NOTICE/attribution file for the hundreds of MIT/BSD/Apache deps distributed | **Low** |
| WS-3 | Website ships LGPL-3.0 libvips (via sharp); risk only if bundled into the Electron desktop build | **Low** |
| WS-4 | Bundled yt-dlp and deno sidecars distributed without attribution/license text | **Low** |
| WS-5 | Project `package.json` has no license field and is not actually the website's manifest | **Low** |
| WS-6 | ShipTalk Cargo.toml declares empty license and `authors = ["you"]` placeholder | **Info** |
| WS-7 | MPL-2.0 axe-core present in website dependency tree | **Info** |
| WS-8 | Deploy-from-working-tree means audited licenses may not match what is live | **Info** |

### 7.2 Detail

**WS-1 — GPL ffmpeg (Critical).** This is the same finding as **SM-1**, restated from the website/release-engineering recon angle. Confirmed: `shipmind/src-tauri/tauri.conf.json:50-53` declares the `binaries/ffmpeg` sidecar; binaries committed at `shipmind/src-tauri/binaries/ffmpeg-{aarch64,x86_64,universal}-apple-darwin`; build banner shows `--enable-gpl ... --enable-libx264 --enable-libx265 --enable-libvidstab --enable-libkvazaar --pkg-config-flags=--static` and `GPL version 2 or later`. Conveying GPL inside a proprietary paid app requires the full corresponding source + GPL text per recipient — none present. **ShipMind is the only Ship app that bundles ffmpeg**; ShipTranscribe and ShipTalk only PATH-resolve system ffmpeg (`ShipTranscribe/src-tauri/src/lib.rs:12-24`, no externalBin), avoiding the trigger.

**WS-2 — Missing attribution across distributed apps (Low).** The JS census is permissive (MIT dominant + ISC/Apache-2.0/BSD-2/3/BlueOak-1.0.0/CC0/0BSD) and the Tauri Rust stacks are MIT/Apache (ring/rustls present; whisper.cpp vendored Unlicense at `shipmind/src-tauri/vendor/whisper-rs-sys-0.15.0/Cargo.toml`). MIT/BSD/Apache-2.0 require notice (+ Apache NOTICE-file) reproduction on **distribution**; the Electron/Tauri apps are distributed binaries with no aggregated THIRD-PARTY-LICENSES/NOTICE and no in-app "open source licenses" screen. The **website-only** Vercel deploy is less exposed (end users receive no bundled copies). Remediation: generate & ship a notices file per desktop release (license-checker for JS, cargo-about for Rust).

**WS-3 — LGPL-3.0 libvips (Low).** `makeshiphappenAi/node_modules` contains `sharp 0.34.5` (Apache-2.0, top-level) bundling `@img/sharp-libvips-darwin-darwin-arm64 1.2.4` = **LGPL-3.0-or-later** (the only LGPL component in the JS tree). `sharp` is not imported in app/lib/components — it is pulled transitively by Next.js image optimization. **For the Vercel-hosted website, server-side use is not "conveying" to end users, so LGPL triggers no relink/source obligation (LOW).** HOWEVER the same `package.json` (name `shipspace`, main `electron/main.js`) doubles as a **distributed Electron desktop app** (electron-build.mjs, electron-builder). If a desktop build bundles sharp's libvips, LGPL-3.0 attaches (ship LGPL text + dynamic linking or relink ability + attribution). **Confirm whether Electron packaging includes sharp; if so, treat as Medium.**

**WS-4 — yt-dlp / deno sidecars (Low).** `binaries/yt-dlp` (Unlicense — no obligation) and `binaries/deno` (MIT — requires notice + permission text reproduction) shipped as sidecars (`shipmind/src-tauri/tauri.conf.json:52-53`). No deno LICENSE/NOTICE shipped. Lower severity than ffmpeg (no copyleft) but an unmet permissive obligation. (yt-dlp also carries operational/ToS risk re: third-party downloads — out of scope for this domain.)

**WS-5 — Mislabeled/no-license manifest (Low).** `makeshiphappenAi/package.json` declares name `shipspace` / productName "ShipSpace — Agentic Environment", `main: electron/main.js`, `private: true`, and **no `license` field** — it describes the ShipSpace Electron desktop app, not the website, while carrying **both** website deps (next, stripe, supabase) **and** desktop deps (electron, node-pty, e2b, xterm). Consequences: (1) no stated license-of-record for first-party code distributed in the Electron build; (2) co-mingling a distributed desktop app with the server-only website in ONE manifest **maximizes the obligation surface** — e2b, node-pty, electron-updater, xterm all become "distributed" the moment a desktop build is cut, even though the website never ships them. Recommend separating website and desktop manifests so obligations track what is conveyed, and set `"license": "UNLICENSED"` / proprietary EULA reference on the desktop product.

**WS-6 — ShipTalk scaffold metadata (Info).** Same as ST-4. **Verified:** `ShipTalk/src-tauri/Cargo.toml` lines 2–6 = `name = "app"`, `description = "A Tauri App"`, `authors = ["you"]`, `license = ""`. Metadata hygiene, not a conflict; finalize for accurate downstream notices.

**WS-7 — MPL-2.0 axe-core (Info).** `axe-core 4.11.1` (MPL-2.0, ships its own LICENSE + LICENSE-3RD-PARTY.txt) is the only MPL component in the website JS tree — almost certainly a transitive dev/test/lint (accessibility) dependency, not shipped to production. MPL-2.0 weak copyleft imposes essentially nothing for unmodified use. Confirm dev-only; no action if so.

**WS-8 — Deploy-from-working-tree (Info).** See deployment caveat above. Gate releases on a license scan of the exact lockfile/Cargo.lock used for each build, and treat any locally-added binary in `src-tauri/binaries/` as a license event requiring review — **this is how the GPL ffmpeg entered.**

---

## 8. Cross-Cutting Risk Register (Prioritized)

| Rank | Finding | Product(s) | Severity | Type |
|---|---|---|---|---|
| 1 | GPLv2+ ffmpeg statically linked & shipped in a paid closed-source app | ShipMind | **Critical** | Copyleft **conflict** |
| 2 | No attribution/NOTICE/THIRD-PARTY-LICENSES shipped (MIT/Apache/BSD/ISC duties unmet) | All 3 desktop apps | **High** | Unmet attribution |
| 3 | 5 MPL-2.0 crates statically linked (per-file source availability) | ShipTalk, ShipSpace, (ShipMind) | **Medium** | Weak copyleft |
| 4 | Bundled native code notices unmet (whisper.cpp MIT, deno/V8/ICU, ollama/ggml) | ShipTalk, ShipMind | **Medium** | Unmet attribution |
| 5 | `ring` BoringSSL/OpenSSL multi-license NOTICE | ShipSpace (+ others using rustls) | **Medium** | Unmet attribution |
| 6 | Non-standard SPDX (Unicode-3.0, CDLA-Permissive-2.0) dropped by naive tooling | ShipSpace | **Low** | Unmet attribution |
| 7 | Empty/missing license-of-record metadata | ShipTalk, ShipSpace, website | **Low** | Metadata hygiene |
| 8 | LGPL-3.0 libvips — risk only if Electron desktop bundles sharp | Website/Electron | **Low** | Conditional copyleft |
| 9 | No cargo-deny/cargo-about/license-checker in CI | All | **Low** | Process gap |
| 10 | Co-mingled website+desktop manifest; deploy-from-working-tree drift | Website | **Low/Info** | Governance |

---

## 9. Recommended Remediation Roadmap (advisory — nothing applied)

1. **Resolve the GPL ffmpeg (Critical, do first).** Choose: (a) swap to an LGPL/non-GPL ffmpeg build (drop `--enable-gpl` + x264/x265/vidstab/kvazaar), or (b) stop bundling and resolve ffmpeg from PATH (code already supports this — `lib.rs:829-844`), or (c) fully comply with GPL (publish corresponding source + ship GPL text). Option (b) is the cleanest for a closed-source product.
2. **Generate and ship a THIRD-PARTY-LICENSES bundle per release** (High). Use `cargo-about` (Rust) + an npm license aggregator (e.g. license-checker) to produce one notices file; ship it in each app bundle **and** expose it via an in-app About/Licenses screen. Ensure it captures: all MIT/Apache/BSD/ISC notices, Apache NOTICE files, the **5 MPL-2.0** crates (+ MPL text + source pointer), **whisper.cpp MIT**, **deno/V8/ICU**, **ollama/ggml MIT**, **ring's** multiple LICENSE files, **Unicode-3.0**, **CDLA-Permissive-2.0**, and the **SIL-OFL** font text.
3. **Set explicit license-of-record metadata** (Low) in `ShipTalk/src-tauri/Cargo.toml`, `ShipSpace` + `shipspace-mcp` manifests, and the desktop `package.json` (`"license": "UNLICENSED"` or a proprietary SPDX); fix the `authors = ["you"]` / `"A Tauri App"` placeholders; ship an EULA.
4. **Add license enforcement to CI** (Low): `cargo-deny` with a license allowlist (to catch a future GPL/AGPL crate) + npm license-checker, gated on the **exact lockfile** used for each build.
5. **Separate the website and desktop manifests** (Low) so license obligations track what is actually conveyed; treat any new file in `src-tauri/binaries/` as a reviewable license event.
6. **Confirm conditional items:** whether the ShipSpace Electron build bundles `sharp`/libvips (LGPL); that `axe-core` is dev-only; and remove/verify the `beep-boop` no-license dep in shiptalk-mcp.
7. **Add checksum/signature verification** to the ShipTalk runtime Whisper-model download and surface the model license.

---

## 10. Conclusion

The Ship Ecosystem has **no relicensing problem** — its dependency graphs are clean of strong copyleft and fully compatible with a paid, closed-source business model. The exposure is concentrated in (1) **one Critical GPL conflict** (ShipMind's bundled `--enable-gpl` ffmpeg, verified from the shipping binary) and (2) **systemic missing attribution** across all distributed products. Both are tractable: the GPL item is a build/bundling change, and the attribution gap is a one-time tooling setup plus an in-app Licenses screen. Until the GPL ffmpeg is remediated or properly source-offered, **each paid ShipMind distribution constitutes a GPL breach** and should be treated as the top legal priority.
