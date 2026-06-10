# Phase 9 — Marketing Claim Review

**Date:** 2026-06-07
**Mode:** Read-only synthesis of website copy, product descriptions, documentation, mockups, and branding language. Not legal advice — flags claim-substantiation exposure a legal review should confirm. Copy is **analyzed, not rewritten**.
**Independence:** Derived from the audit-v2 source dossiers only (Phase 9/16 marketing sweep + cluster dossiers 10–14). Did **not** read `docs/audit/` or `docs/business-protection/`.
**Repo root:** `/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective`

---

## Executive read

The dominant exposure pattern is **absolute-privacy advertising layered onto a product that egresses user content to third-party cloud AI providers**, sold to **regulated/privileged audiences (lawyers, clinicians, schools/FERPA, healthcare, government)** with **named-compliance signaling ("ferpa-safe", "privilege-safe", "compliance story short") and zero certification** (`16-marketing-claims-sweep.md:11`). This is the classic **FTC §5 / state-UDAP** false-advertising pattern, amplified by sector liability (legal-malpractice / HIPAA / FERPA reliance) and by **Lanham §43(a)** competitor-comparison tables. Secondary clusters: a prompt-pack library built to scrape YouTube creators' transcripts and dossier competitors (IP/ToS), and an "all sales final / no refunds" stance beside auto-renew subscription copy.

### The actionable nuance — where the danger actually concentrates

This distinction must drive remediation priority:

- **The CURRENT `/v3/shipmind` page is largely defensible.** It carries a **genuine responsibility disclaimer** — *"you are responsible for deciding whether it fits your legal, privacy, workplace, school, or compliance obligations"* (`makeshiphappenAi/app/v3/shipmind/sections/CTA.tsx:17`) — and qualified **"local-first … cloud is opt-in"** language (`CTA.tsx`; mitigant noted `16-...:13`, `:70`).
- **The danger lives in OLDER / SECONDARY in-repo surfaces** that are still shippable and carry **no** disclaimer:
  - `docs/shipmind-product-copy.md` (the absolute-privacy + regulated-sector copy)
  - both `shipmind-product-page-mockup.html` and `shipmind-product-page-mockup-v2-editorial.html`
  - `makeshiphappenAi/app/v3/shipmind-v2/page.tsx`
  - the **ShipTalk band** in `makeshiphappenAi/app/page.tsx`
- **PLUS** the **named-compliance badges the v3 page STILL renders** — `🛡 ferpa-safe` (`app/v3/shipmind/sections/mockups/BuiltForVisuals.tsx:392`) and `Privilege-safe` (`app/v3/shipmind/sections/BuiltFor.tsx:28`). These single tokens are the **highest-liability strings in the repo** and the v3 disclaimer does not cure them (`16-...:13`, `:155`).

**Strongest internal evidence of awareness:** the developer's own note beside the competitor comparison table — *"📝 NOTE: Verify each '×' before launching live — claims about competitors should be defensible"* (`shipmind-product-page-mockup.html:456`). This is a contemporaneous admission that the comparative `×` claims are **not yet substantiated** and remains an unresolved action item (`16-...:105`, `:156`).

---

## 9.1 Verbatim-claims table

Claims quoted verbatim with `file:line`. Category legend: **PA** privacy-absolute · **RD** regulated-data · **SW** security-warranty · **PF** performance · **CT** comparative-trademark · **CF** copyright-facilitation · **RG** refund-guarantee · **AI** AI-output.

| # | Claim (quoted) | file:line | Source surface | Category | Exposure | Severity |
|---|---|---|---|---|---|---|
| 1 | `🛡 ferpa-safe` (rendered badge, Schools visual) | `makeshiphappenAi/app/v3/shipmind/sections/mockups/BuiltForVisuals.tsx:392` (FERPA shield `:239,381`) | v3 page (live) | RD | compliance/legal | **Critical** |
| 2 | "reads, searches, and reasons across your documents **without sending a single byte to the cloud**" | `docs/shipmind-product-copy.md:13` | product-copy doc (secondary) | PA | legal (FTC §5) | **Critical** |
| 3 | "the **compliance story short**: data doesn't cross your firewall. That posture suits law firms, **healthcare teams**, finance, and **government contractors**" | `docs/shipmind-product-copy.md:68` (with "Audit-friendly by construction" `:66`) | product-copy doc | RD | compliance/legal | **Critical** |
| 4 | "**Your documents never leave your Mac.**" | `docs/shipmind-product-copy.md:44` | product-copy doc | PA | legal | **Critical** |
| 5 | "### Your data never leaves your machine" | `docs/shipmind-product-copy.md:116` | product-copy doc | PA | legal | **Critical** |
| 6 | "Your second brain, **sealed shut**." | `docs/shipmind-product-copy.md:11` | product-copy doc | PA | legal | **High** |
| 7 | "proof: '**Privilege-safe.** Citations on every answer.'" (Legal audience) | `makeshiphappenAi/app/v3/shipmind/sections/BuiltFor.tsx:28` | v3 page (live) | RD | legal/compliance | **High** |
| 8 | "For **attorneys, clinicians**, and anyone handling privileged material." | `docs/shipmind-product-copy.md:56` | product-copy doc | RD | legal | **High** |
| 9 | "**Privileged material cannot touch a cloud AI without breaking confidentiality.**" (Lawyers card) | `makeshiphappenAi/app/v3/shipmind-v2/page.tsx:415` | v2 page (secondary, no disclaimer) | RD/PA | legal | **High** |
| 10 | "Local mode keeps audio on-device. **Cloud mode encrypts over HTTPS.** You choose." | `makeshiphappenAi/app/page.tsx:2990` | home ShipTalk band (secondary) | SW | security | **High** |
| 11 | "**<500ms Latency** … in under half a second. **Faster than typing.**" | `makeshiphappenAi/app/page.tsx:2989` (stat `:2954`; v3 `:2941,2976`) | home / v3 | PF | legal (substantiation) | **High** |
| 12 | ShipMind **vs. NotebookLM / ChatGPT / Claude / Obsidian** table with `yes/no/×` cells | `makeshiphappenAi/app/v3/shipmind/sections/TrustBand.tsx:31-41`; `shipmind-product-page-mockup.html:437-450`; `…-v2-editorial.html:596-619` | v3 + both mockups | CT | legal (Lanham §43(a)) | **High** |
| 13 | **Dev's own note:** "Verify each '×' before launching live — claims about competitors should be defensible." | `shipmind-product-page-mockup.html:456` | mockup (internal note) | CT | legal (evidence) | **High (evidence)** |
| 14 | "Keep every byte local." (hero) | `makeshiphappenAi/app/v3/shipmind/sections/Hero.tsx:303` | v3 hero | PA | legal | **High** |
| 15 | "100% — On-device option — No vendor leaks" | `makeshiphappenAi/app/page.tsx:2956` | home stat | PA | legal | **High** |
| 16 | "Built for people who **can't afford to be wrong**." / "**No more guessing whether the AI is making it up.**" | `makeshiphappenAi/app/v3/shipmind/sections/Pillars.tsx:39, 28` | v3 page | AI | legal | **High** |
| 17 | "Inline citations on **every claim**" / "**100% — cited or flagged**" | `Pillars.tsx:31,34`; `SpeedBand.tsx:12` | v3 page | AI/PF | legal | **High** |
| 18 | "Local-first isn't a marketing claim. **It's a verifiable fact.**" | `makeshiphappenAi/app/v3/shipmind/sections/TrustBand.tsx:466`; `shipmind-product-page-mockup.html:306` | v3 + mockup | AI | legal | **High** |
| 19 | "read the provided **YouTube video transcript** and extract every instance where the speaker is directing an AI … **keep his words**" | `ShipMindPrompts/Research/PROMPT EXTRACTION RESEARCHER.md:3,30,68` | prompt pack | CF | legal (copyright/ToS) | **High** |
| 20 | "comprehensive security audit … **OWASP Top 10** … severity-ranked findings" (ShipGang preset) | `ShipSpace/.../ShipGang/ShipGangModal.tsx:530-531` (`11-shipspace-cluster.md:191`) | in-app preset copy | PF/AI | legal (capability reliance) | **Medium** |
| 21 | "**All sales are final. We do not offer refunds.**" beside "**Cancel anytime**" | `makeshiphappenAi/app/terms/page.tsx:79`; `app/pricing/page.tsx:221` | terms + pricing | RG | compliance | **Medium** |
| 22 | "competitive intelligence researcher … **track this competitor over time** … **where I can win**" | `ShipMindPrompts/Research/COMPETITOR GOAL _ TIMELINE EXTRACTOR _YOUTUBE_.md:2-3`; `…TIMELINE SYNTHESIZER…:2` | prompt packs | CF | legal | **Medium** |
| 23 | "**all running locally on your Mac**" (ShipWatch onboarding) | `ShipWatch/.../OnboardingPage.tsx:89` (`14-utilities-memory-cluster.md:159`) | in-app onboarding | PA | legal | **Medium** |
| 24 | "On-device Whisper — free, **private**" / "**Local-only mode — zero bytes leave your machine**" (ShipTalk) | `ShipTalk/.../SettingsView.tsx:91,462` (`12-voice-cluster.md:85`) | in-app settings | PA | legal | **Medium** |
| 25 | "semantic search returns in **milliseconds**" / "indexing is **real-time**" / "Instant search" | `docs/shipmind-product-copy.md:60-62` | product-copy doc | PF | legal (substantiation) | **Medium** |
| 26 | "Secure checkout via Stripe" | `makeshiphappenAi/app/pricing/page.tsx:221` | pricing | SW | low | Low |
| 27 | "Local SQLite storage… **No cloud sync unless you turn one on.**" (correctly qualified — model claim) | `TrustBand.tsx:12`; mockups `:315/476` | v3 + mockups | PA | (positive) | Low |
| 28 | **Mitigant:** "you are responsible for deciding whether it fits your legal, privacy, workplace, school, or compliance obligations." | `makeshiphappenAi/app/v3/shipmind/sections/CTA.tsx:17` | v3 page (live) | (disclaimer) | reduces exposure | n/a |

---

## 9.2 Claims grouped by exposure type (explanations only — no copy rewrites)

### A. LEGAL exposure (false-advertising / trademark / IP / consumer)

- **Absolute-privacy framing (PA) vs. real cloud egress** — claims 2, 4, 5, 6, 14, 15, 18, 23, 24. The privacy policy itself discloses egress to **Anthropic, OpenAI, Groq, Google, OpenRouter** (`makeshiphappenAi/app/privacy/page.tsx:63`) and the v3 FAQ concedes cloud providers receive "the selected prompt/context" (`CTA.tsx`). Absolute "never / not a single byte / 100% / sealed shut / verifiable fact" framings without a co-located qualifier are the **FTC §5 / state-UDAP** risk. The shipmind cluster sharpens this: cloud chat ships the prompt **plus retrieved RAG excerpts of the user's documents** — which *are* document text — directly contradicting "never leaves" (`10-shipmind-cluster.md:89`, `:101`). The ShipTalk voice cluster has the sharpest single contradiction: **Polish ships the full transcript to Anthropic even when the user picked the "private, on-device" Local Whisper engine** (`12-voice-cluster.md:80`), making the persistent per-engine "private" label (claim 24) deceptive at the moment of choice.
- **Comparative-trademark tables (CT)** — claims 12, 13. Named-competitor `yes/no/×` tables (NotebookLM, ChatGPT/Claude, Obsidian) are **Lanham §43(a)** false-comparative-advertising + trademark-use risk: each `no`/`×` is a factual assertion about a competitor that must be **currently true and substantiated** at publish. The dev's own unresolved note (claim 13) is contemporaneous evidence the cells are not yet verified. Plain nominative naming of competitors elsewhere is fine if descriptive and non-confusing (`16-...:108`).
- **AI-output over-promises (AI)** — claims 16, 17, 18, 20. "Can't afford to be wrong," "no more guessing whether the AI is making it up," "every claim cited," "100% cited or flagged," "verifiable fact," and the ShipGang "comprehensive security audit / OWASP Top 10" preset invite **high-stakes reliance** on RAG output that can still hallucinate or miscite, with **no accuracy disclaimer co-located**. Citations reduce but do not eliminate error; "100% / every / verifiable fact" read as coverage/accuracy **guarantees**.
- **Performance claims (PF)** — claims 11, 25. Quantified, comparative speed claims ("<500ms," "faster than typing," "milliseconds," "real-time," "instant") with **no substantiation register or test-condition disclosure** are FTC §5 substantiation risk; several are third-party-dependent (Groq) and hardware-dependent.
- **Copyright-facilitation / scraping (CF)** — claims 19, 22. The `ShipMindPrompts/Research/*` packs are purpose-built to lift another creator's prompts **verbatim** ("keep his words") and build competitor-surveillance dossiers from scraped YouTube transcripts — **YouTube ToS** (prohibits scraping/derivative use), **copyright** of the speaker's expression, and trade-secret/CFAA-adjacent exposure. Notably `Prompts/Agents/Web Scraping Agent.txt:9-20` already models a responsible "respect robots.txt / don't scrape private data" disclaimer the Research packs lack (`16-...:120`).

### B. SECURITY exposure (express-warranty framing)

- **Security-warranty phrasing (SW)** — claim 10 ("Cloud mode **encrypts over HTTPS**. You choose") over-implies security of cloud egress: HTTPS is **transport-only**, not end-to-end or at-rest, and the receiving provider then handles the data under its own policy. A court could read it as an express warranty of security. Related softer cases: "trust boundary … stays private" for the **unshipped** ShipRelease (`makeshiphappenAi/app/products/page.tsx:62`), "planned **secure** … layer" (`shiprelease/page.tsx:77`) — keep "in development" prominent. The "we **never see** [your keys]" BYO claim (`TrustBand.tsx:22`) is verifiable/low-risk **if** keychain-only enforcement actually holds (`16-...:82`).

### C. COMPLIANCE exposure (regulated-data + consumer-protection)

- **Named-compliance / regulated-sector claims (RD)** — claims 1, 3, 7, 8, 9. This is the **highest-liability cluster**. `ferpa-safe` and `Privilege-safe` are **substantive compliance assertions** with **no certification, audit, BAA, or DPA** behind them; schools/clinicians/attorneys who rely on them inherit FERPA/HIPAA/privilege exposure and create vendor misrepresentation risk. FERPA compliance is a contractual "school official" posture, not a product attribute (`13-web-commerce-cluster.md:92`). The "compliance story short … suits healthcare teams … government contractors" + "audit-friendly by construction" copy implies regulatory fitness the product (which egresses RAG excerpts to third-party LLMs and stores data unencrypted at rest) does not have (`10-shipmind-cluster.md:101`). **Critically, the v3 responsibility disclaimer at `CTA.tsx:17` does NOT cure the `ferpa-safe`/`Privilege-safe` badges the same v3 site still renders** — those tokens need removal or reframing independently.
- **Refund / auto-renew (RG)** — claim 21. A blanket "all sales final / no refunds" may be **unenforceable** in jurisdictions with mandatory consumer-withdrawal/refund rights (EU/UK), and sits next to "cancel anytime" auto-renew subscription copy. Terms §5 does hedge "unless required by applicable law" (`app/terms/page.tsx:79-103`; consistency confirmed `13-web-commerce-cluster.md:88`), but that carve-out is **absent from the pricing/download CTAs**, and the auto-renew disclosure is **weak at point of sale** vs. CA ARL / FTC click-to-cancel expectations (`13-web-commerce-cluster.md:90`).

---

## 9.3 Remediation priority (notes only — copy NOT rewritten here)

1. **Remove/reframe the named-compliance badges first** — `ferpa-safe` (`BuiltForVisuals.tsx:392`), `Privilege-safe` (`BuiltFor.tsx:28`), and "compliance story short / audit-friendly by construction" (`docs/shipmind-product-copy.md:66-68`). Highest-liability tokens; **not** cured by the v3 disclaimer.
2. **Replicate the v3 responsibility + cloud-egress disclaimer** (`CTA.tsx:17`) onto every surface that names a regulated audience or makes an absolute-privacy claim — it is **missing** from `docs/shipmind-product-copy.md`, both `.html` mockups, `app/v3/shipmind-v2/page.tsx`, and the `app/page.tsx` ShipTalk band.
3. **Resolve the dev's open competitor-table action** (`shipmind-product-page-mockup.html:456`): date-stamp, cite, and re-verify each `×` cell at publish, or drop blanket `×`.
4. **Stand up a substantiation register** for every quantified claim ("<500ms," "faster than typing," "milliseconds," "real-time," "100% cited") and the ShipGang "OWASP audit" capability claim.
5. **Add a rights/ToS disclaimer to the `ShipMindPrompts/Research/*` packs**, mirroring `Prompts/Agents/Web Scraping Agent.txt`.
6. **Surface the statutory-rights carve-out + conspicuous auto-renew disclosure at point of sale** (pricing/download CTAs), not only in Terms.

**Headline:** the dominant marketing-exposure pattern is **absolute-privacy + named-compliance ("ferpa-safe"/"privilege-safe") advertising to regulated audiences on a product that egresses user content to third-party cloud AI** — and the live `/v3/shipmind` disclaimer mitigates the prose but **does not cure the compliance badges it still renders**, while the worst uncured copy lives in older/secondary in-repo surfaces.
