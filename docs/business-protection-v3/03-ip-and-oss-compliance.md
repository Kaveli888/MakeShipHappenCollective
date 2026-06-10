# Legal Protections — IP & Open-Source Compliance Program

**Document:** 03 — IP & Open-Source Compliance Program
**Part of:** Ship Ecosystem Business Protection Blueprint (Part 2 of Audit v3)
**Owner:** Founder (Jacob Felton / "Make Ship Happen")
**Prepared by:** Startup general counsel + compliance officer (advisory)
**Date:** 2026-06-07
**Posture:** Single-founder, pre/early-revenue, US-based (Nevada/California considerations noted), selling distributed macOS desktop binaries (ShipTalk, ShipMind, ShipSpace) + a web subscription (makeshiphappen.tech).

---

## 0. How to read this document

This is a **business/legal/governance wrapper** around the technical findings in `docs/audit-v3/08-open-source-review.md`, `12-shipmind-cluster.md`, and `00-EXECUTIVE-REPORT.md`. It deliberately **does not prescribe code changes.** Where a finding has a technical root cause (the GPL ffmpeg build, the bundled native binaries), it is addressed here through **counsel review, decision records, attribution/NOTICE documents, vendor/release process, and license-of-record governance** — the legal instruments that surround the engineering, not the engineering itself.

Every recommendation carries two tags:

- **Effort:** Low (hours–a day) / Medium (days–a couple weeks) / Long-term (ongoing program or multi-month).
- **Protection value:** High / Medium / Low (how much legal/commercial exposure it removes).

The table immediately below is the prioritized action list — **highest protection for lowest effort first.** The sections after it explain each item and name the exact document to draft, policy to adopt, or vendor process to run.

---

## 1. Prioritized program at a glance

| # | Protection | Category | Effort | Protection | Mitigates (audit ID) |
|---|---|---|---|---|---|
| 1 | Engage IP/OSS counsel + impose an interim distribution hold on ShipMind until the GPL ffmpeg question is resolved | Legal | Low | High | SM-1 / WS-1 / L1 (Critical GPL conflict) |
| 2 | Open a formal **Build-Licensing Decision Record (BLDR)** for the ffmpeg copyleft question (options analysis at the business level) | Documentation | Medium | High | SM-1 / WS-1 / Legal-Risk #4 |
| 3 | Draft & ship a **THIRD-PARTY-NOTICES** attribution document with every distributed binary | Documentation | Medium | High | ST-1, SM-2, SS-1, WS-2 (attribution duties) |
| 4 | Adopt an **OSS Intake & License Policy** (the governance that decides what may be bundled) | Policy | Low | High | Cross-cutting; root cause of how GPL ffmpeg entered (WS-8) |
| 5 | Set the **first-party license-of-record** (manifest metadata governance) + ship an EULA reference | Documentation | Low | High | ST-4, SS-4, WS-5, WS-6, Legal-Risk #13 |
| 6 | Stand up a **dependency-license register / SBOM** as a maintained operational artifact | Operational | Medium | Medium | ST-1, SS-1, Compliance #20 (no license scanning) |
| 7 | Add a **release-time license-attestation gate** to the build runbook (governance, not CI code) | Governance | Low | Medium | WS-8 (deploy-from-working-tree drift) |
| 8 | Trademark clearance + USPTO filing program for **Ship\*** / "ShipMind" / "Make Ship Happen" / "makeshiphappen" | Legal | Medium | High | Brand/IP ownership (not in audit risk register; founder asset protection) |
| 9 | Adopt a **model-weights & native-binary provenance practice** (Whisper, deno/V8/ICU, ollama/ggml) | Documentation | Low | Medium | ST-5, SM-3, Security #18, Legal-Risk #23 |
| 10 | Document the **MPL-2.0 weak-copyleft source-availability** obligation as a standing offer | Legal | Low | Medium | ST-2, SS-2, Legal-Risk #14 |
| 11 | IP-assignment / contribution hygiene (IP-CIIAA for any future contributor; founder IP confirmation) | Corporate | Low | Medium | Single-founder IP chain-of-title |
| 12 | Quote **technology E&O / Media liability (IP-infringement) insurance** covering OSS/IP claims | Insurance | Medium | Medium | Backstop for SM-1, ST-1/SS-1, trademark claims |
| 13 | **User-responsibility / acceptable-use** clauses tying yt-dlp & bundled-tool use to the end user | Policy | Low | Medium | WS-4 (yt-dlp ToS/operational risk) |
| 14 | Separate website vs. desktop license-obligation surfaces at the **documentation/manifest** level | Governance | Low | Low | WS-5 (co-mingled manifest expands obligation surface) |

> **Sequencing note:** #1 → #2 is the only true blocker (an active GPL breach on a paid product). #3 → #5 are one-time, high-value documentation tasks that close the *systemic* attribution gap flagged across all three desktop apps. Everything from #6 down converts these one-time fixes into a durable program so the next bundled binary doesn't reopen the breach.

---

## 2. The GPL ffmpeg question — handle as a licensing **decision**, not a code swap

**Grounding:** SM-1 / WS-1 / L1 (Critical). ShipMind ships a statically-built `--enable-gpl` ffmpeg (with x264/x265/vidstab/kvazaar GPL-only encoders) as a Tauri sidecar inside a paid, closed-source app, with no GPL text, no corresponding-source offer, and no attribution. The executive report calls this "the single highest-confidence, highest-severity legal finding," and the liability review notes a proprietary-ownership claim cannot be cleanly asserted while a GPL binary is bundled (Legal-Risk #4).

This domain does **not** prescribe which technical option to choose. The audit already lists the engineering options (LGPL/non-GPL rebuild, PATH-resolve, or full GPL compliance). The business protection here is to **make that an informed, counsel-reviewed, documented decision** and to stop bleeding liability in the meantime.

### 2.1 Interim distribution hold (do this first)

- **Action:** Pause cutting/promoting new paid ShipMind builds that contain the bundled GPL ffmpeg sidecar until item 2.2 closes. Existing downloads do not need a recall decision yet — counsel advises on that — but **do not increase the number of breaching copies in the field.**
- **Instrument:** A one-paragraph internal **distribution-hold memo** (dated, signed by the founder) recording the decision and the trigger to lift it. This memo is itself protective: it evidences good-faith awareness and prompt action if a compliance inquiry ever arrives.
- **Category:** Legal · **Effort:** Low · **Protection:** High · **Mitigates:** SM-1/WS-1 (stops accrual of new GPL-breaching distributions).

### 2.2 Engage IP/open-source counsel

- **Action:** Retain an attorney with **open-source/copyleft enforcement** experience (a focused 2–4 hour scoped engagement is sufficient to start). Provide them: the ffmpeg build banner from the audit, the sidecar declaration (`tauri.conf.json`), and the three remediation options the audit enumerated.
- **Ask counsel to opine on:** (a) whether mere-aggregation applies and what minimum compliance would look like if the binary stays; (b) exposure from copies already distributed; (c) whether any downstream encoder (x264/x265) carries patent-pool obligations independent of GPL; (d) the proprietary-IP-ownership clean-up needed once resolved.
- **Category:** Legal · **Effort:** Low · **Protection:** High · **Mitigates:** SM-1, Legal-Risk #4.

### 2.3 Build-Licensing Decision Record (BLDR)

- **Document to draft:** `docs/legal/decisions/BLDR-001-ffmpeg-licensing.md`. A short, durable record capturing: the finding, the three options (rebuild without GPL components / stop bundling and resolve from PATH / fully comply with GPL source-offer), the **business** trade-offs of each (feature impact, support burden, ongoing source-publication duty), counsel's input, the option chosen, who approved it, and the date.
- **Why this is the protection (not the code):** A signed decision record is what converts an engineering change into a defensible compliance posture. It is the artifact a future acquirer's diligence, an enforcement letter, or an insurer will ask for. The code change is the engineering team's job; the **record of the licensing decision** is the legal deliverable.
- **Template for the broader program:** Reuse this BLDR format for any future "should we bundle this binary?" question.
- **Category:** Documentation · **Effort:** Medium · **Protection:** High · **Mitigates:** SM-1/WS-1; establishes the decision-record discipline that prevents recurrence.

---

## 3. Third-Party NOTICES / attributions document

**Grounding:** ST-1 (High), SM-2 (Medium), SS-1 (High), WS-2 — a repo-wide search found **zero** app-level LICENSE/NOTICE/THIRD-PARTY-LICENSES files and no in-app credits screen, while MIT/BSD/ISC require the copyright notice + license text to travel with the binary, and Apache-2.0 §4(d) additionally requires NOTICE-file propagation. This is the single largest *systemic* compliance gap and it spans all three desktop apps.

This is a **documentation** deliverable. (Whether it is surfaced in-app via a menu is an engineering choice the audit already raised; the legal obligation is that the text **accompanies the distributed binary** — a `THIRD-PARTY-NOTICES.txt` placed inside the app bundle / DMG satisfies the clause even before any UI exists.)

### 3.1 What to produce

- **Document to draft (per product, per release):** `THIRD-PARTY-NOTICES.txt` — one consolidated attributions file shipped inside each app bundle and offered for download on the website.
- **Coverage checklist (must capture every category the audit flagged):**
  - [ ] All MIT / ISC / BSD-2 / BSD-3 / 0BSD copyright notices + permission text
  - [ ] All Apache-2.0 license text **and** any upstream `NOTICE` file contents (§4(d) propagation)
  - [ ] The **5 MPL-2.0** crates (cssparser, cssparser-macros, dtoa-short, selectors, option-ext) — MPL text + a pointer to corresponding source (see §8)
  - [ ] **whisper.cpp / GGML** MIT notice (statically compiled, easy to forget)
  - [ ] **deno** (MIT) including embedded **V8 (BSD-3)** and **ICU** notices
  - [ ] **ollama + libggml** MIT notices
  - [ ] **ring** crate's multiple LICENSE files (BoringSSL / OpenSSL / SSLeay attribution clauses)
  - [ ] Non-standard SPDX: **Unicode-3.0** (ICU4X) and **CDLA-Permissive-2.0** (webpki-roots) data-license texts
  - [ ] **SIL-OFL** text for the Geist font + Reserved Font Name respect
  - [ ] **yt-dlp** (Unlicense — no obligation, but list it for completeness/transparency)
- **Category:** Documentation · **Effort:** Medium · **Protection:** High · **Mitigates:** ST-1, SM-2, SS-1, WS-2, plus the bundled-binary notices (ST-3, SM-3, SS-3, SS-5, SM-4).

### 3.2 Governance around it

- The NOTICES file is **release-bound**: regenerate it whenever the dependency set changes. Tie its regeneration to the release runbook gate in §7.
- Keep a dated archive of each release's NOTICES file in `docs/legal/notices/` so you can prove what shipped with which version.

---

## 4. OSS Intake & License Policy (the governance that prevents recurrence)

**Grounding:** WS-8 / Compliance #20 — there is no policy gate, which is *how the GPL ffmpeg entered* a paid product unnoticed, and deploy-from-working-tree means new binaries can appear without review.

- **Policy to adopt:** `docs/legal/policies/oss-intake-policy.md`. A one-page founder-adopted policy stating:
  1. **License allowlist** for first-party-distributed dependencies: MIT, Apache-2.0, BSD-2/3, ISC, 0BSD, Unlicense, Unicode-3.0, CDLA-Permissive-2.0, SIL-OFL, MPL-2.0 (with §8 handling).
  2. **Review-required list:** any LGPL, and any **native/precompiled binary** added to `src-tauri/binaries/` or an Electron bundle (this is the exact gap that let GPL ffmpeg in).
  3. **Prohibited without counsel sign-off:** GPL, AGPL, SSPL, BUSL, OSL, EUPL, CPAL, Commons-Clause, Elastic — and any `--enable-gpl` build of an otherwise-permissive tool.
  4. **Decision-record requirement:** any review-required or prohibited item that is nonetheless adopted must have a BLDR (per §2.3).
- **Category:** Policy · **Effort:** Low · **Protection:** High · **Mitigates:** root cause behind SM-1; future copyleft contamination (Compliance #20).

---

## 5. First-party license-of-record (manifest metadata governance)

**Grounding:** ST-4, SS-4, WS-5, WS-6, Legal-Risk #13 — `ShipTalk/src-tauri/Cargo.toml` carries scaffold defaults (`name = "app"`, `authors = ["you"]`, `license = ""`); ShipSpace and the desktop `package.json` declare no license. For a paid product this is the ownership/EULA anchor and it is currently ambiguous.

This is **documentation/metadata governance**, not code logic — it sets the terms that govern your own distributed first-party code.

- **Decision to record:** Choose and document the first-party license-of-record. For a closed-source paid product the standard is **`UNLICENSED`** (npm) / a proprietary SPDX expression (Cargo), pointing to the EULA.
- **Documents to draft / fields to govern:**
  - [ ] A short **License-of-Record memo** (`docs/legal/license-of-record.md`) stating: first-party code is proprietary, "all rights reserved," governed by the EULA; copyright holder = the operating entity (see §11, not the placeholder `"you"`).
  - [ ] Correct the **copyright holder / author** identity to the entity, not a scaffold placeholder, so distribution metadata is accurate for a paid product (WS-6).
  - [ ] An **EULA reference** string/pointer that travels with each build.
- **Note:** *Editing manifest metadata strings is a documentation/governance act here, not an engineering refactor — the protection is the decision and the recorded authority, which the team then reflects in the manifest.*
- **Category:** Documentation · **Effort:** Low · **Protection:** High · **Mitigates:** ST-4, SS-4, WS-5, WS-6, Legal-Risk #13.

---

## 6. Dependency-license register / SBOM as a maintained artifact

**Grounding:** Compliance #20 — no license scanning exists, so a future copyleft crate or swapped binary goes uncaught (the same blind spot that hid GPL ffmpeg). The audit's own bottom line is that the work is "attribution + one ffmpeg fix," which requires a *maintained inventory* to stay true over time.

- **Operational artifact to maintain:** `docs/legal/sbom/` — a per-product, per-release **dependency-license register** (CycloneDX or SPDX SBOM is the recognized format; even a maintained spreadsheet/CSV is acceptable at this stage). It records: component, version, license, distribution status (bundled / dev-only / server-only), and notice-obligation status.
- **Source of truth:** the **lockfiles** (`Cargo.lock`, `package-lock.json`) — the audit explicitly says to "treat the lockfile as the only license source of truth," because production builds off the local working tree (WS-8). The register is generated *from the exact lockfile used for a release.*
- **Why it's an operational, not engineering, protection:** the register is a compliance ledger the founder maintains and can hand to an enterprise buyer's security questionnaire, an insurer, or counsel. Generating it can be tooling-assisted, but owning, dating, and archiving it is the governance act.
- **Category:** Operational · **Effort:** Medium · **Protection:** Medium · **Mitigates:** ST-1, SS-1, Compliance #20; feeds §3 (NOTICES) and §7 (release gate).

---

## 7. Release-time license-attestation gate (runbook governance)

**Grounding:** WS-8 / Compliance #25 — "deploy via `vercel --prod` from local tree; live state may diverge from audited repo," and "any locally-added binary in `src-tauri/binaries/` is a license event — this is how the GPL ffmpeg entered."

- **Process to run (not CI code):** Add a **license-attestation checkpoint** to the existing release runbook. Before signing/publishing any build, the founder completes and dates a short checklist:
  - [ ] SBOM/register regenerated from the exact lockfile used for this build (§6)
  - [ ] No new entry on the review-required/prohibited lists without a BLDR (§4)
  - [ ] No new file in `src-tauri/binaries/` (or Electron bundle) without a recorded license review
  - [ ] `THIRD-PARTY-NOTICES.txt` regenerated and included in the bundle (§3)
  - [ ] License-of-record / EULA reference present (§5)
- **Instrument:** `docs/legal/release-license-attestation-template.md` — one signed attestation per release, archived. This is a **governance control**, deliberately framed as a human runbook step rather than an automated pipeline, consistent with the no-code constraint.
- **Category:** Governance · **Effort:** Low · **Protection:** Medium · **Mitigates:** WS-8, Compliance #25; ensures §§3–6 actually ship with every release.

---

## 8. MPL-2.0 weak-copyleft standing offer

**Grounding:** ST-2, SS-2, Legal-Risk #14 — 5 MPL-2.0 crates are statically linked into every Tauri binary. MPL is *file-level* copyleft: it does **not** contaminate proprietary code, but recipients must be told the binary contains MPL code and the corresponding source for those files must be **available on request.**

- **Document to draft:** an **MPL source-availability statement** included in `THIRD-PARTY-NOTICES.txt`: name the five components, state they are unmodified upstream, and provide the upstream source URLs (a pointer-to-upstream offer satisfies MPL §3.2 for unmodified files).
- **Standing process:** if any of those files are ever modified, the modified source must be made available — record this as a one-line obligation in the OSS intake policy (§4).
- **Category:** Legal · **Effort:** Low · **Protection:** Medium · **Mitigates:** ST-2, SS-2, Legal-Risk #14.

---

## 9. Trademark protection for the Ship\* / "ShipMind" / "makeshiphappen" marks

**Grounding:** Founder brand-asset protection. Not a defect in the audit's risk registers, but a single-founder selling under a family of "Ship\*" marks and the "Make Ship Happen / makeshiphappen.tech" brand has **no recorded trademark protection**, leaving the most valuable IP asset (the brand) unsecured against squatters and confusingly-similar competitors.

- **Actions:**
  - [ ] **Clearance search** before spending on filings: knock-out search on USPTO TESS + common-law/web for "ShipMind," "ShipTalk," "ShipSpace," "ShipCode," "ShipWatch," "Make Ship Happen," "makeshiphappen" in the relevant classes (Class 9 downloadable software; Class 42 SaaS).
  - [ ] **Prioritize filings** by commercial value and distinctiveness: "ShipMind" and "Make Ship Happen" are the strongest, most-used, and most distinctive — file these first. ("Ship\*" generics may be harder to register standalone; counsel can advise on a house-mark + product-mark strategy.)
  - [ ] **File intent-to-use or use-based USPTO applications** for the prioritized marks; secure the **makeshiphappen.tech domain** registration lock and consider defensive domain variants.
  - [ ] Record marks under the **operating entity** (§11), not the personal name, so brand IP and corporate shield align.
- **Insurance link:** trademark/brand claims (both offensive enforcement budget and defensive coverage) connect to the Media/IP insurance line in §12.
- **Category:** Legal · **Effort:** Medium · **Protection:** High · **Mitigates:** brand-IP ownership risk (founder asset; also supports the proprietary-ownership claim weakened by SM-1).

---

## 10. Model-weights & native-binary provenance practice

**Grounding:** ST-5, SM-3, Security #18, Legal-Risk #23 — Whisper weights are fetched at runtime from HuggingFace with **no checksum/signature and no license bundling**; deno embeds V8/ICU; ollama embeds ggml. The audit frames this as both a license-disclosure gap and a supply-chain/provenance note.

The **code** fix (checksum verification) is out of scope here. The **business protection** is a documented provenance practice and license disclosure.

- **Documentation practice to adopt:** a `docs/legal/provenance/` register recording, for each model weight and bundled native binary: source URL, version/hash-of-record, upstream license, and the license-derivation note (e.g., Whisper weights derive from OpenAI Whisper, MIT). This is the artifact that lets you **surface the model license to the user** (Legal-Risk #23) and answer a provenance question without re-deriving it.
- **Disclosure:** include the model/binary licenses and their origin in `THIRD-PARTY-NOTICES.txt` (§3) and reference them in the privacy/sub-processor documentation produced by the data-flow domain.
- **Category:** Documentation · **Effort:** Low · **Protection:** Medium · **Mitigates:** ST-5, SM-3, Legal-Risk #23 (provenance disclosure; supply-chain awareness).

---

## 11. IP chain-of-title & contribution hygiene

**Grounding:** Cross-cutting (Business-Risk #2 — "liability concentrated on a single named individual, no apparent corporate shield"). The proprietary value of the Ship Ecosystem is its first-party code and brand; that IP needs a clean, recorded owner.

- **Actions:**
  - [ ] **Found / confirm the operating entity** and assign all Ship Ecosystem IP (code, marks, domains, copyrights) to it via a short **IP assignment agreement** (founder → entity). *(Entity formation itself is covered in the Corporate domain; here the protection is that IP ownership is recorded and assigned to whoever holds the liability shield.)* For a US single-founder, a Nevada or California formation are the live options the audit context implies — counsel/the corporate domain decides which; this domain only requires that the IP be assigned to *that* entity.
  - [ ] **Contributor IP policy:** before *any* outside contributor (freelancer, agency, future hire) touches the code, require a signed **IP, Confidentiality & Invention-Assignment Agreement (CIIAA)** plus a **Contributor License Agreement (CLA)** or work-for-hire clause, so no ownership ambiguity ever enters the codebase.
  - [ ] **AI-generated-code note:** record (one paragraph in the license-of-record memo) the practice that AI-assisted code is treated as authored/owned by the entity, acknowledging the unsettled copyrightability of purely AI-generated output — a forward-looking protection given the heavily agent-assisted workflow.
- **Category:** Corporate · **Effort:** Low · **Protection:** Medium · **Mitigates:** IP chain-of-title; depends on entity formation (Corporate domain).

---

## 12. Insurance backstop for IP / OSS claims

**Grounding:** Business-Risk #1/#2 — no loss-shifting instrument and personal liability exposure. Even a perfect compliance program benefits from a financial backstop for the residual GPL/attribution/trademark risk.

- **Lines to quote (get quotes; bind once revenue justifies):**
  - [ ] **Technology Errors & Omissions (Tech E&O)** with **IP-infringement / Media liability** coverage — the line that responds to copyright, license-breach (incl. open-source), and trademark-infringement claims. Confirm the policy does **not** exclude open-source/copyleft claims (some do — read the exclusions).
  - [ ] Pair with the general liability / cyber lines that other Blueprint domains specify.
- **Sequencing:** quote now for budgeting; the underwriter will ask whether you have an OSS policy and SBOM (§4, §6) — having them improves terms and may be a condition of binding. This is why the program and the insurance reinforce each other.
- **Category:** Insurance · **Effort:** Medium · **Protection:** Medium · **Mitigates:** financial backstop for SM-1, ST-1/SS-1, and §9 trademark claims.

---

## 13. User-responsibility & acceptable-use clauses for bundled tools

**Grounding:** WS-4 / Legal-Risk #20 — yt-dlp is shipped as a sidecar and "carries operational/ToS risk re: third-party downloads." The license (Unlicense) imposes no copyright duty, but the *use* of the tool to download third-party content is a user-conduct risk that should be contractually allocated to the end user.

- **Clauses to include in the EULA / Acceptable-Use Policy (drafted in the ToS domain, sourced here):**
  - [ ] User is solely responsible for ensuring their use of media-acquisition features (yt-dlp / ffmpeg / URL ingest) complies with the **source platform's Terms of Service and applicable copyright law**; the vendor grants no rights in third-party content.
  - [ ] No warranty that bundled third-party tools are fit for any particular acquisition, and the user indemnifies the vendor for misuse.
- **Category:** Policy · **Effort:** Low · **Protection:** Medium · **Mitigates:** WS-4, Legal-Risk #20 (shifts third-party-download conduct risk to the user).

---

## 14. Separate website vs. desktop obligation surfaces (documentation level)

**Grounding:** WS-5 / Compliance #18 / Business-Risk #25 — `makeshiphappenAi/package.json` co-mingles the server-only website (next, stripe, supabase) with a distributable Electron desktop app (electron, node-pty, e2b, xterm) in one manifest, which "maximizes the obligation surface" because server-only deps become "distributed" the moment a desktop build is cut.

- **Governance action (not the engineering split — the *decision* to track obligations separately):** maintain **two distinct license registers** (§6) — one for the **server-only website** (no end-user binary distribution → attribution duties largely don't attach to recipients) and one for the **distributed desktop/Electron artifact** (where notice duties do attach). Document which manifest deps are conveyed vs. server-only so the NOTICES file (§3) only carries genuinely-distributed components.
- **Conditional item to resolve:** record, in the SBOM/register, whether the Electron build bundles **`sharp`/libvips (LGPL-3.0)** — if it does, LGPL relink/notice duties attach and it escalates to a review-required item (§4). The audit flagged this as "confirm whether Electron packaging includes sharp; if so, treat as Medium."
- **Category:** Governance · **Effort:** Low · **Protection:** Low · **Mitigates:** WS-5, Compliance #18; resolves the conditional LGPL libvips question (WS-3).

---

## 15. Program ownership & cadence

- **Owner:** Founder, until a corporate entity and any compliance delegate exist.
- **Cadence:** the release-attestation gate (§7) runs **every release**; the SBOM/register (§6) regenerates **every release**; the OSS intake policy (§4) and trademark portfolio (§9) reviewed **quarterly**; counsel re-engaged on any prohibited/review-required adoption (§4) or new bundled binary.
- **Single source of truth:** keep all instruments under `docs/legal/` (decisions/, policies/, notices/, sbom/, provenance/) so diligence, insurers, and enterprise buyers find one coherent IP/OSS compliance file.

---

*End of Document 03 — IP & Open-Source Compliance Program. Companion documents in `docs/business-protection-v3/` cover corporate structure, ToS/EULA/AUP drafting, privacy & data-lifecycle, and user-responsibility allocation; this document deliberately references but does not duplicate them.*
