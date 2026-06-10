# R2 — Claims Softening Sheet

> Ready-to-apply mapping of risky marketing claims → accurate, brand-safe rewrites.
> Source of claims: `docs/audit-v2/16-marketing-claims-sweep.md`. Verbatim strings + line numbers re-confirmed against live source on **2026-06-07**.
> **Decision being applied:** Keep all products. Soften the marketing so it (a) stops invoking regulated-compliance statutes (FERPA/HIPAA/"compliance"), (b) stops making absolute "never leaves / not a single byte / sealed" privacy promises the product can't keep, and (c) drops unsubstantiated "100%" / "<500ms" / competitor-× claims — **without gutting the privacy-forward brand.**

## The principle

The product is **local-first** but has **real cloud-egress paths** (cloud AI chat → OpenAI/Anthropic/Groq; ShipTalk Polish → Anthropic; ShipTalk Browser mode audio → OpenAI/Apple; ShipWatch cloud providers/backup). So every privacy claim must be **accurate, not absolute**, and **opt-in/clearly-labeled**, while still sounding confident and privacy-forward. The new default sentence shape is:

> *"Local-first by default. Optional cloud features are clearly labeled and opt-in."*

We are **not** going mealy-mouthed — we are going **true**. Confident + accurate beats absolute + indefensible.

## Legend (priority)

- **MUST-CHANGE** — genuine legal exposure: false-advertising (FTC §5 / state UDAP), named-compliance assertion (FERPA/HIPAA), unsubstantiated quantified/superiority claim, or unverified competitor comparison (Lanham §43(a)). Fix before any further marketing push.
- **SHOULD-CHANGE** — defensiveness; not a clean lie but over-reaches and invites reliance/dispute.
- **OPTIONAL** — polish; tighten when convenient.

---

## Must-change shortlist (the ~8 to fix first)

These are the genuine legal-exposure items. Everything else can follow.

| # | Claim | Surface (file:line) |
|---|---|---|
| MC-1 | `🛡 ferpa-safe` badge (named-statute assertion, no certification) | `makeshiphappenAi/app/v3/shipmind/sections/mockups/BuiltForVisuals.tsx:392` |
| MC-2 | "without sending a single byte to the cloud" (absolute, contradicted by cloud chat) | `docs/shipmind-product-copy.md:13` |
| MC-3 | "Your documents never leave your Mac." | `docs/shipmind-product-copy.md:44` |
| MC-4 | "the compliance story short… law firms, healthcare teams, finance, and government contractors" + "Audit-friendly by construction" | `docs/shipmind-product-copy.md:66, 68, 70` |
| MC-5 | "Your second brain, sealed shut." / "Your data never leaves your machine" | `docs/shipmind-product-copy.md:11, 116` |
| MC-6 | "Privilege-safe. Citations on every answer." | `makeshiphappenAi/app/v3/shipmind/sections/BuiltFor.tsx:28` |
| MC-7 | "100% — cited or flagged" / "100% — On-device option — No vendor leaks" (coverage/accuracy guarantee) | `makeshiphappenAi/app/v3/shipmind/sections/SpeedBand.tsx:12`; `makeshiphappenAi/app/page.tsx:2956` |
| MC-8 | Competitor `×`/`—` comparison tables (Lanham; dev's own "verify each × before launch" note is unresolved) | `makeshiphappenAi/app/v3/shipmind/sections/TrustBand.tsx:34-40`; `shipmind-product-page-mockup.html:443-452,456`; `shipmind-product-page-mockup-v2-editorial.html:612-621` |

Bonus MUST (perf): "<500ms Latency … Faster than typing." `makeshiphappenAi/app/page.tsx:2989`.

---

## Main table — claim → drop-in rewrite

> "CURRENT" is verbatim from source. "PROPOSED REWRITE" is a drop-in string in the brand's voice — punchy, privacy-forward, **and true**. For badge/table items the rewrite is an instruction (remove / reframe).

| # | Surface (file:line) | CURRENT (verbatim) | PROPOSED REWRITE | Why / category | Priority |
|---|---|---|---|---|---|
| 1 | `BuiltForVisuals.tsx:392` | `<span>🛡</span> ferpa-safe` | `<span>🛡</span> privacy-first` — drop the statute. (Or remove the badge entirely.) | Named-compliance assertion, no certification; schools rely on it → FERPA misrepresentation | **MUST** |
| 2 | `docs/shipmind-product-copy.md:13` | "ShipMind is a private AI workspace that reads, searches, and reasons across your documents without sending a single byte to the cloud." | "ShipMind is a private AI workspace that reads, searches, and reasons across your documents locally by default — cloud AI is optional and clearly labeled." | Absolute no-egress; contradicted by cloud chat mode | **MUST** |
| 3 | `docs/shipmind-product-copy.md:44` | "**Your documents never leave your Mac.**" | "**Your documents stay on your Mac** unless you turn on an optional cloud feature." | Absolute "never" vs cloud chat sending prompt text | **MUST** |
| 4 | `docs/shipmind-product-copy.md:11` | "Your second brain, **sealed shut**." | "Your second brain, **local-first**." | "sealed shut" = absolute impenetrability/no-egress | **MUST** |
| 5 | `docs/shipmind-product-copy.md:116` | "### Your data never leaves your machine" | "### Local-first by default" (body: "Your sources live on your disk. API keys live in your OS keychain. Cloud providers are opt-in and clearly labeled.") | Absolute, contradicted by cloud modes | **MUST** |
| 6 | `docs/shipmind-product-copy.md:64-70` (Legal & Compliance card) | "**Audit-friendly by construction.** … which makes the **compliance story short**: data doesn't cross your firewall. That posture suits **law firms, healthcare teams, finance, and government contractors** who can't rely on 'we promise we won't train on it.' … *For regulated industries where the answer to 'where does the data go?' has to be 'nowhere.'*" | "**Built for sensitive work.** ShipMind's local-first design means your source documents stay on your machine by default — no third-party processor touches them unless you opt into a cloud model. *For people who handle confidential material and want to keep it that way. ShipMind makes no compliance certification — you decide whether it fits your obligations.*" | Implied HIPAA/regulatory fitness; named verticals; no BAA/SOC2/cert | **MUST** |
| 7 | `docs/shipmind-product-copy.md:56` | "*For **attorneys, clinicians**, and anyone handling privileged material.*" | "*For **professionals who handle confidential work**.*" | Named privileged/PHI handlers implies HIPAA/legal-confidentiality fitness | **MUST** |
| 8 | `docs/shipmind-product-copy.md:22` | "Lawyers can't paste privileged discovery into ChatGPT. **Clinicians can't drop patient files into Claude.** Analysts can't share term sheets…" | "Lawyers can't paste privileged work into a public chatbot. **People who handle confidential records can't drop them into Claude.** Analysts can't share term sheets…" | Sets up implied PHI-suitable solution | SHOULD |
| 9 | `docs/shipmind-product-copy.md:52` | "Drop sensitive files in. **They stay in.**" | "Drop sensitive files in. **Your source files stay local** — only prompt text you send to an opted-in cloud model ever leaves." | Absolute retention claim vs cloud chat (body already qualifies — make headline match) | SHOULD |
| 10 | `docs/shipmind-product-copy.md:32` | "Indexing and semantic search use a bundled local model, so **nothing leaves the device to become searchable**." | "Indexing and semantic search use a bundled local model, so **your indexing and search never touch the cloud**." | Narrowly true for indexing but reads as blanket privacy — scope it | SHOULD |
| 11 | `docs/shipmind-product-copy.md:60-62` | "**Instant** search across thousands of sources." / "indexing is **real-time** and semantic search returns in **milliseconds**" | "**Fast local** search across thousands of sources." / "indexing runs locally and search is near-instant — speed depends on corpus size and hardware." | Unqualified absolute speed | OPTIONAL |
| 12 | `BuiltFor.tsx:28` (Legal card proof) | "**Privilege-safe.** Citations on every answer." | "**Built for sensitive work.** Citations on every answer." | "Privilege-safe" = legal-confidentiality assertion; contradicted if user enables cloud mode | **MUST** |
| 13 | `BuiltFor.tsx:33` (Schools card title — keep) | "A learning assistant that respects student data" | Keep as-is (no statute named) — just ensure the paired `ferpa-safe` badge (#1) is removed. | "respects student data" is fine; the badge is the exposure | n/a |
| 14 | `BuiltFor.tsx:41` (Researcher card body) | "Generate comparison tables, **fact-check claims**, draft sections. All local." | "Generate comparison tables, **fact-check against your sources**, draft sections. All local." | Implies AI reliably fact-checks | SHOULD |
| 15 | `SpeedBand.tsx:12` | `{ value: '100%', label: 'cited or flagged' }` | `{ value: 'Every answer', label: 'cited or flagged' }` (drop the "100%" number) | Absolute coverage/accuracy guarantee | **MUST** |
| 16 | `SpeedBand.tsx:10` | `{ value: '<300ms', label: 'first token, on Groq' }` | `{ value: 'Sub-second', label: 'typical on Groq' }` (or keep number + add "typical, varies by provider") | Quantified, third-party-dependent latency claim | SHOULD |
| 17 | `Pillars.tsx:28` (lede) | "...citation chips you can click… **No more guessing whether the AI is making it up.**" | "...citation chips you can click to jump to the exact paragraph, page, or audio timestamp — **so you can check the source instead of trusting the AI blindly.**" | Implies hallucination eliminated; citations reduce not eliminate error | **MUST** (Cat 8) |
| 18 | `Pillars.tsx:31, 34` | "Every answer cited back to the exact source." / "Inline citations on **every claim** — click to verify" | "Answers grounded in your sources, with inline citations — click to verify" (drop "every answer/every claim" as coverage guarantee) | "every" = coverage guarantee | SHOULD |
| 19 | `Pillars.tsx:39` (benefit) | "Trust that takes one click to verify. **Built for people who can't afford to be wrong.**" | "Trust that takes one click to verify. **Built for people who need to check their sources.** AI output can be wrong — always verify against the citation." | Invites high-stakes reliance with no accuracy disclaimer nearby | SHOULD |
| 20 | `TrustBand.tsx:466` (if present) | "**It's a verifiable fact.**" | "**It's a claim you can verify against the source.**" | Asserts AI output = fact | SHOULD |
| 21 | `page.tsx:2989` (ShipTalk band) | `{ title: '<500ms Latency', body: 'End-to-end transcription in under half a second. Faster than typing.' }` | `{ title: 'Sub-second latency', body: 'End-to-end transcription is typically sub-second on Apple Silicon — speed varies by hardware and length.' }` (or remove the number) | Quantified perf + "faster than typing" superiority, no substantiation | **MUST** |
| 22 | `page.tsx:2990` | `{ title: 'Privacy-First', body: 'Local mode keeps audio on-device. **Cloud mode encrypts over HTTPS.** You choose.' }` | `{ title: 'Privacy-First', body: 'Local mode keeps audio on your machine. Cloud features use encrypted (HTTPS) connections; the provider then handles your data per their policy. You choose.' }` | HTTPS is transport-only — reads as a security guarantee | SHOULD |
| 23 | `page.tsx:2956` (ShipTalk stat) | `{ value: '100%', label: 'On-device option', sub: 'No vendor leaks' }` | `{ value: 'On-device', label: 'optional local mode', sub: 'No cloud when off' }` (drop "100%" and "No vendor leaks") | "100%" + "No vendor leaks" reads as a guarantee | **MUST** |
| 24 | `page.tsx:2954` (ShipTalk stat) | `{ value: '<500ms', label: 'End-to-end latency', sub: 'Whisper · Local' }` | `{ value: 'Sub-second', label: 'typical latency', sub: 'Whisper · Local' }` | Repeated unsubstantiated quantified claim | SHOULD |
| 25 | `TrustBand.tsx:34-40` (v3 compare rows) | `COMPARE_ROWS` with `{ kind: 'no' }` cells marking NotebookLM/ChatGPT/Obsidian × on "Local-first storage", "Local AI option", "Bring your own keys", "Cited answers", etc. | Two options: (a) **preferred** — convert each row to a neutral factual feature statement about ShipMind only (drop the competitor columns); or (b) keep the table but replace blanket `× / no` with dated, sourced cells and re-verify every cell at publish. Until verified, remove the `no` cells. | Lanham §43(a): each `no` is a factual claim about a named competitor that must be currently true + substantiated | **MUST** |
| 26 | `shipmind-product-page-mockup.html:443-452` + `:456` | `×` comparison cells; dev note: "📝 NOTE: **Verify each '×' before launching live — claims about competitors should be defensible.**" | Same as #25. **This dev note is an unresolved open action item** — treat the `×` table as not-shippable until each cell is verified or the competitor columns are removed. | Lanham; dev's own acknowledgement it's unsubstantiated | **MUST** |
| 27 | `shipmind-product-page-mockup-v2-editorial.html:612-621` | `—` (cross) comparison cells, same competitors | Same as #25. | Lanham | **MUST** |
| 28 | `shipmind-v2/page.tsx:415` (Lawyers card) | "**Privileged material cannot touch a cloud AI without breaking confidentiality.**" | "Privileged material shouldn't go into a public chatbot — keep it in local mode; cloud is opt-in and clearly labeled." | Self-contradicting once user enables cloud mode | SHOULD |
| 29 | `shipmind-v2/page.tsx:408` | `AUDIENCE_CHIPS = [ … 'Lawyers' ]` | Keep the audience chips, but this page (v2, secondary) lacks the v3 CTA disclaimer — either add the `CTA.tsx:17` disclaimer to this page or de-prioritize/retire the v2 surface. | Sector targeting with no adjacent disclaimer | SHOULD |
| 30 | `app/terms/page.tsx:79` | "**All sales are final. We do not offer refunds.**" | "All sales are final and we do not offer refunds, **except where required by applicable law.**" (the carve-out already exists at lines 91-92 for renewals — surface it here too) | Blanket no-refund may be unenforceable in EU/UK/CA; UDAP if it overrides statutory rights | SHOULD |
| 31 | `app/pricing/page.tsx:220` | "Cancel anytime · No refunds · Secure checkout via Stripe" | "Cancel anytime · No refunds (except where required by law) · Secure checkout via Stripe" | Auto-renew + "cancel anytime" → ARL/click-to-cancel disclosure; align refund carve-out with terms | OPTIONAL |
| 32 | `ShipWatch/src/pages/OnboardingPage.tsx:89` | "...lets you chat with your memories using AI — **all running locally on your Mac.**" | "...lets you chat with your memories using AI — **local-first on your Mac, with cloud providers available as an opt-in.**" | "all running locally" is false once a cloud provider/backup is enabled | SHOULD |
| 33 | `ShipTalk/src/views/SettingsView.tsx:446` | (cloud OFF branch) "**All processing stays on your machine.** Use Browser or Local Whisper with no API key." | "**Local Whisper keeps audio on your machine.** Browser mode uses your browser's built-in transcription, which may send audio to its provider (e.g. Apple/Google)." | Browser mode egresses audio to OS/browser provider — so "all processing stays on your machine" is inaccurate in this branch | **MUST** (accuracy) |
| 34 | `app/v3/shipwatch/sections/Features.tsx:151` | "Local SQLite vault with **AES-256 encryption at rest**" | Keep **only if literally true and enforced**. If the vault is actually AES-256-encrypted at rest, this is fine (factual, verifiable). If not, change to "Local SQLite vault on your machine." Verify before shipping. | Express security warranty — fine if substantiated, exposure if not | SHOULD (verify) |
| 35 | `Hero.tsx:303` (cited in sweep) | "Keep **every byte** local." | "Keep your **sources** local — cloud is opt-in." | Absolute "every byte" on hero vs cloud egress | SHOULD |

> Note on already-good copy (leave as-is, use as the model): `TrustBand.tsx:12` "No cloud sync unless you turn one on" and `TrustBand.tsx:22` "Cloud providers are opt-in… we never see them" are correctly qualified. `CTA.tsx:17` is the gold-standard disclaimer — replicate it on every surface that names a regulated audience.

---

## Which surfaces are LIVE vs OLDER — what to edit first

**LIVE / current (the real `/v3/shipmind` page + main site):**
- `makeshiphappenAi/app/v3/shipmind/sections/*` — current product page. **Already carries a real disclaimer at `CTA.tsx:17`**, but **still renders the `ferpa-safe` badge (`BuiltForVisuals.tsx:392`) and `Privilege-safe` proof (`BuiltFor.tsx:28`)**, plus the `100%` SpeedBand stat and the competitor `×` table in `TrustBand.tsx`. These are live exposures.
- `makeshiphappenAi/app/page.tsx` — main landing page; ShipTalk band (`:2954, 2956, 2989, 2990`) has the `<500ms` / `100% / No vendor leaks` / `encrypts over HTTPS` claims.
- `ShipWatch/.../OnboardingPage.tsx:89` and `ShipTalk/.../SettingsView.tsx:446` — in-product strings users see; the ShipTalk one is an accuracy bug (Browser mode egresses).

**OLDER / secondary (still in repo, shippable, worst absolute claims):**
- `docs/shipmind-product-copy.md` — **worst offender.** Holds "single byte", "never leave", "sealed shut", "compliance story short / healthcare / government", "attorneys, clinicians". It's a copy doc feeding the page, so fixing it stops the bad language from propagating.
- `shipmind-product-page-mockup.html` + `shipmind-product-page-mockup-v2-editorial.html` — older mockups with the competitor `×`/`—` tables and the dev's own unresolved "verify each ×" note.
- `makeshiphappenAi/app/v3/shipmind-v2/page.tsx` — older surface; "Privileged material cannot touch a cloud AI…", "Lawyers" chip, no adjacent disclaimer.

### Edit these 3 files first
1. **`docs/shipmind-product-copy.md`** — kill the absolute/compliance language at its source (rows 2-11 above). Highest concentration of MUST-CHANGE items.
2. **`makeshiphappenAi/app/v3/shipmind/sections/mockups/BuiltForVisuals.tsx`** (+ `BuiltFor.tsx`) — remove/replace the `ferpa-safe` badge and `Privilege-safe` proof. These named-statute tokens are the single highest-liability strings on the LIVE page.
3. **`makeshiphappenAi/app/v3/shipmind/sections/TrustBand.tsx`** (+ the two mockup HTMLs) — neutralize the competitor `×` comparison table (drop competitor columns or verify+date every cell). This resolves the dev's own unaddressed launch-blocker note and the Lanham exposure.

Then sweep `SpeedBand.tsx:12`, `app/page.tsx:2954/2956/2989/2990`, `ShipTalk SettingsView.tsx:446`, and `ShipWatch OnboardingPage.tsx:89`.

---

## Audience repositioning (whole-brand line)

**Before:** "The private NotebookLM alternative for **lawyers, clinicians, schools, and government contractors** — your documents *never* leave your Mac, *FERPA-safe*, *privilege-safe*."

**After:** "**The private, local-first second brain for anyone who handles sensitive work.** Local-first by default — optional cloud features are clearly labeled and opt-in."

Reposition from **regulated verticals (lawyers / clinicians / schools-FERPA / government)** to **"professionals and privacy-conscious people who handle sensitive material."** Keep the confident, privacy-forward voice — just stop *naming statutes you can't certify against* and stop promising *absolutes the product doesn't deliver*. Privacy stays the headline; it just becomes a true one: **local-first, opt-in cloud, you stay in control.**
