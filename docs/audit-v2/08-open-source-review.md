# Phase 8 — Open Source Review

**Date:** 2026-06-07
**Mode:** Read-only synthesis. Not legal advice — flags obligations a licensing review should confirm.
**Independence:** Derived from the audit-v2 source dossiers only (Phase 8/15 license sweep + the five cluster dossiers 10–14). Did **not** read `docs/audit/` or `docs/business-protection/`.
**Repo root:** `/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective`

> Repo layout: the **root** git repo tracks ~7 files; the actual products are **independent nested git repos** — `ShipCode/`, `ShipSpace/`, `ShipTalk/`, `ShipWatch/`, `makeshiphappenAi/`, `shipmind/` — plus `ShipTranscribe/` (working tree, no nested `.git`). Plus utility packages `ship-memory/`, `shipclick`, `*-mcp/`, `shipmind-extension/`. License analysis is per-product.

---

## Executive read

The declared dependency graph (JS + Rust) is **clean and fully permissive** across every product — MIT / Apache-2.0 / ISC / BSD / MPL-2.0, with **no GPL/AGPL/LGPL npm package or crate** anywhere in the declared trees (`15-licenses-and-secrets.md:43`, `:93`).

The single material exposure is **not** in the dependency graph — it is in a **bundled binary**: **shipmind** ships an **ffmpeg 7.0 built `--enable-gpl` with libx264/libx265**, which makes the distributed binary **effectively GPLv3**, bundled inside a closed-source commercial desktop app (`15-licenses-and-secrets.md:55`, `10-shipmind-cluster.md:64`). That is a copyleft-contamination event for a proprietary product — **Critical**.

Everything else is **hygiene**: (1) **zero LICENSE files** across all products despite README/ShipCode declaring "MIT" (`15-licenses-and-secrets.md:74-87`), and (2) **zero NOTICE/THIRD-PARTY attribution bundle** anywhere, leaving the MIT/Apache attribution obligations of bundled binaries (deno, ollama, ggml) and all npm deps unmet in shipped builds (`15-licenses-and-secrets.md:69-70`).

---

## 8.1 Dependency inventory summary (per product)

All entries below are **permissive (MIT / Apache-2.0 / ISC / BSD / MPL-2.0)** with no copyleft in the declared graph (`15-licenses-and-secrets.md:13-37`).

| Product | Version | `license` field | Notable JS deps | Notable Rust deps | Posture |
|---|---|---|---|---|---|
| **shipmind** | 2.0.3 | **(none)** | `@anthropic-ai/sdk` (MIT), `@supabase/supabase-js`, `@tauri-apps/*`, `@xyflow/react`, `framer-motion`, `howler`, `mermaid`, `react-markdown`, `remark-gfm`, `zod`, `zustand`, `lucide-react`, `geist` | `tauri 2`, `keyring 3`, `whisper-rs 0.16` (+`metal`), `hound`, vendored `whisper-rs-sys-0.15.0` → `whisper.cpp` (**MIT**, `vendor/.../whisper.cpp/LICENSE`) | Deps clean; **see bundled-binary §8.2** |
| **ShipSpace** | 0.1.3 | **(none)** | `@supabase/supabase-js`, `@tauri-apps/*`, `@xterm/xterm` (+addon-fit, addon-image), `framer-motion`, `lucide-react`, `react`, `zustand` | `tauri 2`, `keyring 3`, `reqwest 0.12` (rustls-tls) | Clean |
| **ShipTalk** | 0.1.1 | **(none)** | `@supabase/supabase-js`, `@tauri-apps/*` (global-shortcut/http/process/updater), `lucide-react`, `react`, `zustand` | `tauri 2` (macos-private-api), `keyring 3`, `whisper-rs 0.16` (`metal`, **MIT**), `hound`, `tauri-plugin-log` | Clean |
| **ShipWatch** (`ship-watch`) | 0.1.0 | **(none)** | `@tauri-apps/*` (autostart/positioner/sql/http/fs/shell/dialog), `framer-motion`, `lucide-react`, `react`, `zustand` | `tauri 2` (tray-icon), `tauri-plugin-sql` (sqlite) | Clean (deps); shells to **system ffmpeg** for mic capture (`14-utilities-memory-cluster.md:18`) |
| **ShipTranscribe** | 0.1.0 | **(none)** | `@tauri-apps/*` (shell/dialog), `framer-motion`, `lucide-react`, `react`, `zustand` | `tauri 2`, shell/dialog/updater plugins | Clean; shells to **system** `ffmpeg`/`whisper-cli` via PATH — **not bundled**, so avoids GPL-distribution (`12-voice-cluster.md:136`) |
| **makeshiphappenAi** (`shipspace`) | 0.1.0 | **(none)** | `next`, `react`, `@supabase/ssr`+`supabase-js`, `stripe`+`@stripe/stripe-js`, `@google/generative-ai`, `e2b`, `pg`, `electron`+`electron-builder`+`electron-updater`, `node-pty`, `@xterm/xterm`, `zod`, `zustand`, `framer-motion` | — | Clean; electron bundles Chromium (permissive/BSD-ish) — standard |
| **ShipCode** (`shipcode-cli`) | 0.6.1 | **`MIT`** | `@sentry/node`, `chalk`, `commander`, `glob`, `ora` | — | Clean; **declares MIT but ships no LICENSE file** (`14-utilities-memory-cluster.md:29`, `15-...:35`) |
| **ship-memory** / account-menu / MCP packages | — | **(none)** | (utility node packages) | — | No `license` field declared (private/unspecified) (`14-utilities-memory-cluster.md:167`) |
| **Root repo** | — | README says "MIT" | `expo`, `@types/react`, `typescript` | — | Claim unbacked — no LICENSE file (`15-...:37`) |

**Overall posture:** the declared JS + Rust dependency graph across **all** products is permissive — no GPL/AGPL/LGPL in declared deps. Commercial use of every declared dependency is permitted. The only blocker to clean commercial distribution is the bundled GPL ffmpeg (§8.2).

---

## 8.2 Bundled-binary license table (the real exposure)

Bundled into / distributed with the **shipmind** desktop app via Tauri `externalBin` + `resources` (`shipmind/src-tauri/tauri.conf.json:50-56`). The binaries are **gitignored but shipped in the built `.app`/`.dmg`** (`15-licenses-and-secrets.md:51`). Where another product depends on the **system** ffmpeg via PATH (ShipTranscribe, ShipWatch, ShipClick, ship-memory's whisper path), there is **no distribution** of the GPL binary, so the GPL obligation does not attach to those products.

| Binary | Version / build | License | Commercial-use implication | Attribution requirement | Distribution obligation | Conflict? | Severity |
|---|---|---|---|---|---|---|---|
| **ffmpeg** (`shipmind/src-tauri/binaries/ffmpeg-{aarch64,x86_64,universal}-apple-darwin`) | **7.0, `--enable-gpl` + `--enable-libx264` + `--enable-libx265`** | **GPLv2+/GPLv3 — effectively GPLv3 via libx265** | **Prohibited** to ship inside a closed-source app without honoring GPL | Must reproduce GPL license text + copyright | **COPYLEFT: must offer corresponding source / written offer, and the combined distributed work falls under GPL terms** | **YES — copyleft contamination of a proprietary app** | **Critical** (`15-...:55`) |
| **yt-dlp** (`binaries/yt-dlp-*-apple-darwin`) | yt-dlp | **Unlicense (public domain)** | Permitted | None | None | No (license). Usage caveat: facilitates downloads from sites whose ToS may prohibit it — a *usage* risk, not a license risk | Low/hygiene (`15-...:56`) |
| **deno** (`binaries/deno-*-apple-darwin`) | deno | **MIT** | Permitted | **Reproduce MIT copyright + license in distribution** | Attribution only | No | Hygiene (`15-...:57`) |
| **ollama** (`shipmind/src-tauri/ollama-bundle/ollama`, ~77 MB) | **0.30.6** | **MIT** | Permitted | **Reproduce MIT notice** | Attribution only | No | Hygiene (`15-...:58`) |
| **libggml-\*.dylib / .so** (`ollama-bundle/libggml-*`) | ggml (ollama bundle) | **MIT** | Permitted | Attribution | Attribution only | No | Hygiene (`15-...:59`) |
| **whisper.cpp** (vendored `whisper-rs-sys-0.15.0/whisper.cpp`, compiled in) | — | **MIT** (LICENSE present in tree, "Copyright (c) 2023-2024 The ggml authors") | Permitted | Reproduce MIT notice | Attribution only | No | Hygiene (`15-...:17`) |

### Runtime-downloaded model weights (NOT bundled — fetched on first use; no distribution obligation on the app)

| Model | Fetch source | License / terms | Implication |
|---|---|---|---|
| Whisper `ggml-base.en.bin` | `download_model` → `huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin` (`shipmind/src-tauri/src/lib.rs:2119`) | **MIT** (OpenAI Whisper weights) | Permissive; runtime download ⇒ no app-distribution obligation (`15-...:64`) |
| `nomic-embed-text` (embeddings) | pulled via Ollama (`shipmind/src-tauri/src/lib.rs:1092`, `EMBED_MODEL`) | **Apache-2.0** | Permissive; runtime pull (`15-...:65`) |

No Gemma/Llama gguf weights are bundled or pulled (Gemini is API-only via `@google/generative-ai`), so there is **no non-OSI "acceptable-use" / Llama-community-license exposure** currently (`15-...:67`).

### Per-binary license analysis (license type · commercial use · attribution · distribution · conflict)

- **ffmpeg (GPL build) — CRITICAL.**
  - *License type:* GPLv2-or-later, pulled to **GPLv3** by the `--enable-gpl` libx264/libx265 codecs.
  - *Commercial use:* GPL permits commercial use **only** if the entire conveyed work is offered under GPL with corresponding source — not viable for a closed-source commercial app.
  - *Attribution:* must carry GPL license text + copyright notices.
  - *Distribution:* conveying the binary triggers the **source-offer** obligation; the combined work it ships inside is, on a strict reading, subject to GPL.
  - *Conflict:* **Yes — direct conflict** with shipmind's proprietary/all-rights-reserved posture.
  - *Remediation (from `15-...:94`):* swap to an **LGPL / non-GPL ffmpeg build** (drop `--enable-gpl`, x264/x265) and dynamically link, **or** honor GPL (offer source / GPL the combined work — not commercially viable).

- **deno / ollama / ggml / whisper.cpp — Hygiene (MIT).** Commercial use fully permitted; the only obligation is **reproducing the MIT copyright + permission notice** in the distributed binary. Currently **unmet** (no NOTICE file — §8.4).

- **yt-dlp — Hygiene (Unlicense).** No license obligation. The residual concern is *usage/ToS* (downloading third-party content), which is a marketing/conduct matter handled in Phase 9, not a license obligation.

---

## 8.3 LICENSE-file present matrix

Every product (and the root) **lacks a top-level LICENSE file**; the only LICENSE on disk anywhere is the **third-party** vendored `whisper.cpp/LICENSE` (MIT) (`15-licenses-and-secrets.md:74-87`, `10-shipmind-cluster.md:136`).

| Product | Declares a license | LICENSE file present? | Note |
|---|---|---|---|
| Root repo | README says "MIT" | **NO** | Claim unbacked |
| ShipCode | `package.json: "MIT"` | **NO** | Declares MIT in metadata, ships nothing to back/enforce it (`14-...:29`) |
| ShipSpace | none | **NO** | |
| ShipTalk | none | **NO** | |
| ShipWatch | none | **NO** | No `license` field (`14-...:167`) |
| ShipTranscribe | none | **NO** | |
| shipmind | none | **NO** | Only on-disk LICENSE is third-party `whisper.cpp/LICENSE` |
| shipmind-mcp / shipmind-extension | none | **NO** | (`10-shipmind-cluster.md:104`) |
| makeshiphappenAi | none | **NO** | |
| ship-memory / MCP packages | none | **NO** | (`14-...:167`) |

**Consequence:** with no LICENSE file, each codebase defaults to **"all rights reserved."** That is internally consistent with a proprietary commercial intent — but it **contradicts the public "MIT" claims** in the root README and ShipCode `package.json`, which assert an open grant the repo never actually makes. Either ship the LICENSE files to honor the MIT claim, or remove the MIT claims to match the all-rights-reserved reality.

---

## 8.4 Missing NOTICE / attribution bundle

**No `NOTICE` / `THIRD-PARTY` / `LICENSES` / attribution file exists in ANY product** (all six product dirs + ShipTranscribe + utility packages searched — zero results) (`15-licenses-and-secrets.md:69-70`, `10-shipmind-cluster.md:105`).

MIT/Apache/BSD/ISC dependencies and the bundled MIT binaries (**deno, ollama, ggml, whisper.cpp**) each require their copyright + license text be **reproduced in distributed binaries**. That obligation is **currently unmet for every distributed desktop app**. Severity: **hygiene / Medium per-component** — low legal risk individually, but a clean, complete attribution bundle is a prerequisite to lawful redistribution of the permissive components.

---

## 8.5 Per-dimension summary

- **License type:** declared deps — all permissive (MIT/Apache/ISC/BSD/MPL). Bundled binaries — MIT except the **GPL ffmpeg**.
- **Commercial-use implications:** every declared dep and every bundled binary *except* GPL ffmpeg permits commercial use. **GPL ffmpeg is the only commercial-distribution blocker.**
- **Attribution requirements:** MIT/Apache components (deps + bundled deno/ollama/ggml/whisper.cpp) require reproduced notices — **unmet** (no NOTICE bundle, §8.4).
- **Distribution obligations:** GPL ffmpeg ⇒ source-offer + copyleft on the conveyed work (**Critical**, unmet). Permissive components ⇒ notice reproduction only (**hygiene**, unmet).
- **Potential licensing conflicts:** **one** — GPL ffmpeg vs. shipmind's proprietary closed-source distribution. The dependency graph itself is conflict-free.

---

## 8.6 Findings (severity-tagged)

| # | Finding | Product(s) | Severity |
|---|---|---|---|
| OS-1 | **GPL-enabled ffmpeg 7.0 (`--enable-gpl`, libx264/libx265) bundled in a proprietary app** ⇒ effectively GPLv3 copyleft contamination of the conveyed work; source-offer triggered. **Recommend swap to an LGPL/non-GPL ffmpeg build.** | shipmind (referenced via system-PATH only by ShipTranscribe/ShipWatch — no GPL distribution there) | **Critical** |
| OS-2 | **No NOTICE/THIRD-PARTY/attribution bundle** anywhere; MIT/Apache notice-reproduction obligations unmet for bundled deno/ollama/ggml/whisper.cpp and all npm deps in shipped binaries | All distributed apps | Hygiene (Medium) |
| OS-3 | **No LICENSE file in any product**; root README + ShipCode `package.json` **claim "MIT"** without shipping the license — claim unbacked, defaults to all-rights-reserved | All; claim-conflict on Root + ShipCode | Hygiene (Medium) |
| OS-4 | yt-dlp (Unlicense) — no license obligation; usage/ToS risk handled in Phase 9 | shipmind | Hygiene (Low) |

**Headline:** dependency graph is clean and permissive; **one Critical** open-source issue — the GPL-enabled ffmpeg bundled in the proprietary shipmind app — plus systemic hygiene gaps (zero LICENSE files despite "MIT" claims, zero attribution/NOTICE bundle).
