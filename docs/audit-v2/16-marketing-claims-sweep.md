# 16 — Marketing-Claims Compliance Sweep

**Scope:** Read-only advertising/branding/product-claim audit across website (`makeshiphappenAi/`), product mockups, product copy docs, READMEs, and prompt packs. Independence: derived from source only (did NOT read `docs/audit/` or `docs/business-protection/`).
**Date:** 2026-06-07
**Method:** keyword sweeps + direct reads of the marketing surfaces. Quotes are verbatim with `file:line`.

---

## Executive read

The dominant exposure pattern is **absolute-privacy advertising layered onto a product that egresses user content to third-party cloud AI providers** — sold to **regulated/privileged audiences (lawyers, clinicians, schools/FERPA, healthcare, government)** with **named-compliance signaling ("ferpa-safe", "privilege-safe", "compliance story short") and zero certification.** This combination is the classic FTC §5 / state-UDAP false-advertising pattern, amplified by sector-specific liability (legal malpractice / HIPAA / FERPA reliance) and by Lanham Act §43(a) comparative tables. Secondary cluster: a prompt-pack library purpose-built to scrape YouTube creators' transcripts to extract competitors' goals and *their* AI prompts (IP/ToS exposure), and an "all sales final / no refunds" policy sitting next to "cancel anytime" subscription auto-renew copy.

Mitigating note: the **current** `/v3/shipmind` page (`sections/CTA.tsx`) carries a genuine responsibility disclaimer (line 17) and qualified "local-first… cloud is opt-in" language. The danger lives mostly in (a) the **older/secondary surfaces** that are still in the repo and shippable — `docs/shipmind-product-copy.md`, the two `shipmind-product-page-mockup*.html`, `app/v3/shipmind-v2/page.tsx`, `app/page.tsx`'s ShipTalk band — and (b) the **named-compliance badges/claims** that even the v3 page still renders (`ferpa-safe`, `privilege-safe`).

---

## Most Dangerous Claims (top list)

| # | Verbatim snippet | file:line | Severity |
|---|---|---|---|
| 1 | `🛡 ferpa-safe` (badge rendered on Schools audience visual) | `makeshiphappenAi/app/v3/shipmind/sections/mockups/BuiltForVisuals.tsx:392` | **Critical** |
| 2 | "reads, searches, and reasons across your documents **without sending a single byte to the cloud**" | `docs/shipmind-product-copy.md:13` | **Critical** |
| 3 | "the **compliance story short**: data doesn't cross your firewall. That posture suits law firms, **healthcare teams**, finance, and **government contractors**" | `docs/shipmind-product-copy.md:68` | **Critical** |
| 4 | "**Your documents never leave your Mac.**" (Local Privacy feature) | `docs/shipmind-product-copy.md:44` | **Critical** |
| 5 | "proof: '**Privilege-safe.** Citations on every answer.'" (Legal audience) | `makeshiphappenAi/app/v3/shipmind/sections/BuiltFor.tsx:28` | **High** |
| 6 | "For **attorneys, clinicians**, and anyone handling privileged material." | `docs/shipmind-product-copy.md:56` | **High** |
| 7 | "Local mode keeps audio on-device. **Cloud mode encrypts over HTTPS.** You choose." | `makeshiphappenAi/app/page.tsx:2990` | **High** |
| 8 | "**<500ms Latency** … in under half a second. **Faster than typing.**" | `makeshiphappenAi/app/page.tsx:2989` | **High** |
| 9 | ShipMind **vs. NotebookLM / ChatGPT / Claude / Obsidian** comparison table with `×` cells | `makeshiphappenAi/app/v3/shipmind/sections/TrustBand.tsx:31-41`; `shipmind-product-page-mockup.html:437-450` | **High** |
| 10 | "read the provided **YouTube video transcript** and extract every instance where the speaker is directing an AI… keep his words" (prompt-pack to lift creators' prompts) | `ShipMindPrompts/Research/PROMPT EXTRACTION RESEARCHER.md:3,30` | **High** |
| 11 | "**All sales are final. We do not offer refunds.**" beside "**Cancel anytime**" subscription copy | `makeshiphappenAi/app/terms/page.tsx:79`; `makeshiphappenAi/app/pricing/page.tsx:221` | **Medium** |
| 12 | "competitive intelligence researcher… **track this competitor over time**… where I can win" (YouTube competitor dossier packs) | `ShipMindPrompts/Research/COMPETITOR GOAL _ TIMELINE EXTRACTOR _YOUTUBE_.md:2`; `…/TIMELINE SYNTHESIZER…:2` | **Medium** |

---

## Category 1 — Absolute Privacy Claims

Contradicted by the product's own privacy policy, which discloses egress to **Anthropic, OpenAI, Groq, Google, OpenRouter** (`makeshiphappenAi/app/privacy/page.tsx:63`) and by `CTA.tsx` FAQ admitting cloud providers send "the selected prompt/context to that provider." Absolute "never/not a single byte/100%" framings without a co-located qualifier are the §5 / UDAP risk.

| Claim (verbatim) | file:line | Exposure | Severity | Truthful/qualified form |
|---|---|---|---|---|
| "ShipMind is a private AI workspace that reads, searches, and reasons across your documents **without sending a single byte to the cloud**." | `docs/shipmind-product-copy.md:13` | FTC §5 false-advertising; contradicted by cloud-LLM chat mode | Critical | Qualify: "in local mode; cloud chat is opt-in and sends your prompt to the provider you choose." |
| "**Your documents never leave your Mac.**" | `docs/shipmind-product-copy.md:44` | Same; absolute "never" while cloud chat sends prompt text | Critical | "Source files stay local; only the prompt text you send to an opted-in cloud model leaves your Mac." |
| "Indexing and semantic search use a bundled local model, so **nothing leaves the device to become searchable**." | `docs/shipmind-product-copy.md:32` | Narrowly true for indexing but reads as blanket privacy | High | Scope to indexing explicitly. |
| "### Your data never leaves your machine" (Trust section) | `docs/shipmind-product-copy.md:116` | Absolute, contradicted by cloud modes | Critical | Add cloud-egress caveat. |
| "Keep every byte local." | `makeshiphappenAi/app/v3/shipmind/sections/Hero.tsx:303` | Absolute "every byte" on hero | High | "Keep your sources local; cloud is opt-in." |
| "100% — On-device option — No vendor leaks" | `makeshiphappenAi/app/page.tsx:2956` | "100%" + "No vendor leaks" stat reads as guarantee | High | Frame as "optional 100%-local mode." |
| "✓ on-device" badges | `makeshiphappenAi/app/page.tsx:628, 839` | Implies blanket on-device when cloud is default-available | Medium | Tie badge to the local-mode toggle. |
| "Local works **fully offline** in English." | `makeshiphappenAi/app/page.tsx:2991` | "fully offline" — acceptable IF scoped to local mode (it is, marginally) | Low | OK; keep the "Local" qualifier. |
| "OFFLINE · SEALED" / "all sealed" / "machine sealed offline" (ShipTalk visuals) | `makeshiphappenAi/app/products/shiptalk/v3/page.tsx:16, 1160, 1241` | "sealed" implies impenetrability/no egress | Medium | "Local mode runs offline." Avoid "sealed." |
| "Your second brain, **sealed shut**." (hero headline) | `docs/shipmind-product-copy.md:11` | "sealed shut" = absolute no-egress | High | Soften to "local-first." |
| "Drop sensitive files in. **They stay in.**" | `docs/shipmind-product-copy.md:52` | Absolute retention claim vs cloud chat | High | Scope to source files vs prompt text. |
| "Local SQLite storage… **No cloud sync unless you turn one on.**" | `shipmind-product-page-mockup*.html:315/476`; `TrustBand.tsx:12` | This one is correctly qualified — model example | Low | Already qualified — fine. |

## Category 2 — Regulated-Data / Sector Claims (no certification)

Targeting attorneys, clinicians, healthcare, FERPA/schools, finance, government with named-compliance signaling and no certification, audit, BAA, or DPA. Highest-liability cluster: a clinician relying on "privilege-safe"/"ferpa-safe" framing creates malpractice/HIPAA/FERPA exposure for both user and vendor.

| Claim (verbatim) | file:line | Exposure | Severity | Truthful/qualified form |
|---|---|---|---|---|
| `<span>🛡</span> ferpa-safe` (rendered badge) | `makeshiphappenAi/app/v3/shipmind/sections/mockups/BuiltForVisuals.tsx:392` | FERPA misrepresentation; "FERPA-safe" is a compliance assertion with no certification; schools rely on it | **Critical** | Remove the badge or replace with "keeps student data local — you remain the FERPA-responsible party." |
| "the **compliance story short**: data doesn't cross your firewall. That posture suits law firms, **healthcare teams**, finance, and **government contractors**" | `docs/shipmind-product-copy.md:68` | Implied HIPAA/regulatory fitness; no BAA/SOC2; "Audit-friendly by construction" (line 66) | **Critical** | "Local-first architecture reduces data exposure; we make no HIPAA/SOC2/compliance certification — assess fitness yourself." |
| "For **attorneys, clinicians**, and anyone handling privileged material." | `docs/shipmind-product-copy.md:56` | Targets privileged/PHI handlers; clinician + patient files implies HIPAA fitness | **High** | Keep audience framing only with explicit "not a HIPAA-compliant / certified solution" disclaimer. |
| "Clinicians can't drop patient files into Claude." (problem framing positioning ShipMind as the answer) | `docs/shipmind-product-copy.md:22` | Sets up implied PHI-suitable solution | High | Avoid implying ShipMind solves the PHI/HIPAA problem. |
| "**Privileged material cannot touch a cloud AI without breaking confidentiality.**" (Lawyers card) | `makeshiphappenAi/app/v3/shipmind-v2/page.tsx:415` | Legal-confidentiality assertion; if user enables cloud mode, claim is self-contradicting | High | Note that cloud mode does egress; local mode only. |
| "A learning assistant that respects student data" / "ferpa-safe" pairing (Schools) | `makeshiphappenAi/app/v3/shipmind/sections/BuiltFor.tsx:33` | FERPA reliance | High | "respects student data" OK; remove the "ferpa-safe" badge. |
| "Lawyers can verify. Researchers can defend." | `makeshiphappenAi/app/v3/shipmind-v2/page.tsx:850` | Professional-reliance framing | Medium | Fine if paired with accuracy disclaimer (see Cat 8). |
| "ShipMind is a private second brain for businesses, **schools, legal teams**, and researchers" | `makeshiphappenAi/app/v3/shipmind/sections/CTA.tsx:125` | Sector targeting — mitigated by adjacent disclaimer at line 17 | Medium | Disclaimer present — keep it adjacent. |
| Audience pills "Lawyers", "Schools", "Clinicians"-adjacent in `v2`/`shipmind-v2` | `makeshiphappenAi/app/v2/page.tsx:76`; `app/v3/shipmind-v2/page.tsx:408,461` | Sector targeting without disclaimer on those pages | Medium | Add the v3 CTA disclaimer to v2 surfaces. |
| **Mitigant:** "you are responsible for deciding whether it fits your legal, privacy, workplace, school, or **compliance obligations**." | `makeshiphappenAi/app/v3/shipmind/sections/CTA.tsx:17` | This is the correct disclaimer — only present on the v3 page | n/a | Replicate everywhere regulated audiences appear. |

## Category 3 — Security Warranties

Phrases that a court could read as express warranties of security.

| Claim (verbatim) | file:line | Exposure | Severity | Truthful/qualified form |
|---|---|---|---|---|
| "Cloud mode **encrypts over HTTPS**. You choose." | `makeshiphappenAi/app/page.tsx:2990` | Security warranty; HTTPS is transport-only (not E2E/at-rest); over-implies security of cloud egress | High | "Cloud requests use HTTPS in transit; the provider then handles your data per their policy." |
| "The **trust boundary**… Your release pipeline **stays private**." (ShipRelease) | `makeshiphappenAi/app/products/page.tsx:62` | Security assurance for an unshipped product ("In development") | Medium | Keep "in development" prominent; avoid present-tense assurances. |
| "ShipRelease is the planned **secure** shipping, signing, and distribution layer" | `makeshiphappenAi/app/products/shiprelease/page.tsx:77` | "secure" as bare adjective | Low | "planned signing/notarization layer." |
| "Secure checkout via Stripe" | `makeshiphappenAi/app/pricing/page.tsx:221` | Attributable to Stripe; low risk | Low | Fine. |
| "we **never see** them" (BYO keys) | `makeshiphappenAi/app/v3/shipmind/sections/TrustBand.tsx:22`; same pattern `sections/TrustBand.tsx` BYO | Architecture claim — verifiable; low risk if true | Low | Ensure keychain-only is actually enforced. |

## Category 4 — Performance Claims (unsubstantiated quantified)

Quantified speed claims with no substantiation register / test conditions.

| Claim (verbatim) | file:line | Exposure | Severity | Truthful/qualified form |
|---|---|---|---|---|
| "**<500ms Latency** — End-to-end transcription in under half a second. **Faster than typing.**" | `makeshiphappenAi/app/page.tsx:2989` | Quantified perf + superiority claim; no test basis; "faster than typing" is comparative | High | "Typically sub-second on Apple Silicon; varies by hardware/length." Keep a substantiation file. |
| "<500ms — End-to-end latency — Whisper · Local" (stat) | `makeshiphappenAi/app/page.tsx:2954`; `products/shiptalk/v3` stat band | Same quantified claim repeated | High | Add hardware/conditions qualifier. |
| "semantic search returns in **milliseconds**" / "indexing is **real-time**" | `docs/shipmind-product-copy.md:60-62` | Unqualified speed | Medium | "fast local search; speed depends on corpus size/hardware." |
| "**sub-second** answers when a deadline demands them" (Groq) | `makeshiphappenAi/app/v3/shipmind/sections/CTA.tsx:21` | Quantified, third-party-dependent (Groq) | Medium | "Groq is typically sub-second; latency depends on the provider." |
| "100% — cited or flagged" (SpeedBand stat) | `makeshiphappenAi/app/v3/shipmind/sections/SpeedBand.tsx:12` | "100% cited or flagged" = accuracy/coverage guarantee | High | See Cat 8 — drop "100%". |
| "Instant search across thousands of sources." | `docs/shipmind-product-copy.md:60` | "Instant" absolute | Low | "near-instant local search." |

## Category 5 — Comparative / Trademark

Named-competitor comparison tables with `×`/`—` cells = Lanham Act §43(a) false-comparative-advertising + trademark use risk. Notably the dev's **own internal note flags this risk**.

| Claim (verbatim) | file:line | Exposure | Severity | Truthful/qualified form |
|---|---|---|---|---|
| Comparison table cols `['ShipMind','NotebookLM','ChatGPT / Claude','Obsidian']` with `yes/no/partial` cells (e.g. NotebookLM/ChatGPT marked no on "Local-first storage", "Cited answers" → ChatGPT `no`) | `makeshiphappenAi/app/v3/shipmind/sections/TrustBand.tsx:31-41` | Lanham §43(a); each `no` is a factual claim about a competitor that must be currently true & substantiated | High | Date-stamp, cite sources, re-verify each cell at publish; avoid blanket `×`. |
| "**ShipMind vs. the alternatives.**" table, cols NotebookLM / ChatGPT-Claude / Obsidian, `×` cells | `shipmind-product-page-mockup.html:427-450`; `…-v2-editorial.html:596-619` | Same | High | Same. |
| **Dev's own warning:** "📝 NOTE: **Verify each "×" before launching live — claims about competitors should be defensible.** Worth re-checking NotebookLM's current feature list right before publish." | `shipmind-product-page-mockup.html:456` | Internal acknowledgement the comparative claims are not yet substantiated | High (evidence) | Treat as an open action item; do not ship unverified `×`. |
| "ShipMind vs. the alternatives" heading | `makeshiphappenAi/app/v3/shipmind/sections/TrustBand.tsx:557` | Comparative positioning | Medium | OK if cells substantiated. |
| "tiny **compared to Electron-based alternatives**" | `makeshiphappenAi/app/v3/shipspace/page.tsx:1496` | Comparative perf vs unnamed class | Low | Generally defensible. |
| Naming Claude / ChatGPT / GPT / Gemini / NotebookLM / Obsidian / Cursor / Windsurf / VS Code throughout | many (`app/page.tsx:1454,3056`; `app/v3/page.tsx:1447,3043,3310`; `shipmind-v2:395,489`) | Nominative trademark use — OK if descriptive & non-confusing; risk only if implying endorsement/partnership | Low | Nominative use is fine; avoid logos/implying partnership. |

## Category 6 — Copyright-Facilitation / Scraping

Prompt packs purpose-built to scrape YouTube creators' transcripts to (a) extract *their* AI prompts verbatim and (b) build competitor-surveillance dossiers. Plus the product itself ingests YouTube/web URLs. Secondary-liability / platform-ToS (YouTube ToS §prohibits scraping/derivative use), trade-secret/CFAA-adjacent, and copyright of transcribed content.

| Claim (verbatim) | file:line | Exposure | Severity | Truthful/qualified form |
|---|---|---|---|---|
| "read the provided **YouTube video transcript** and **extract every instance where the speaker is directing an AI**… Do NOT paraphrase the prompt itself — **keep his words**" | `ShipMindPrompts/Research/PROMPT EXTRACTION RESEARCHER.md:3, 30, 68` | Designed to lift another creator's prompts/IP verbatim from their videos; YouTube ToS + copyright of the speaker's expression | High | If distributed as a product asset: add "use only on content you have rights to; respect platform ToS." |
| "competitive intelligence researcher… extract everything the creator reveals about their goals, plans, progress, pivots, and **weaknesses**… used to **track this competitor over time**" | `ShipMindPrompts/Research/COMPETITOR GOAL _ TIMELINE EXTRACTOR _YOUTUBE_.md:2-3` | Competitor surveillance from scraped YouTube transcripts; ToS + reputational | Medium | Same ToS/rights disclaimer; remove "weaknesses/where I can win" framing if customer-facing. |
| "merge them into a single timeline and tell me what's changed, **what they're hiding**, and **where I can win**." | `ShipMindPrompts/Research/TIMELINE SYNTHESIZER…:2` | Same surveillance framing | Medium | Reframe as "public-information synthesis you have rights to." |
| "PDF, … **web pages by URL, YouTube URLs (transcribed locally)**" (product capability) | `makeshiphappenAi/app/v3/shipmind/sections/CTA.tsx:25`; mockups note "ingest… YouTube" | Product ingests/transcribes third-party YouTube/web content — facilitation of unauthorized copying if marketed for non-owned content | Medium | "Ingest content you have the rights to use." |
| `Prompts/Agents/Web Scraping Agent.txt` — includes "Ethical Scraping… Respect robots.txt… Do NOT scrape private data" | `Prompts/Agents/Web Scraping Agent.txt:9-20` | Actually responsible — a positive model | Low | Good — mirror this disclaimer in the Research packs. |

## Category 7 — Guarantees / Refunds

"All sales final / no refunds" coexisting with "cancel anytime" subscription auto-renew. Auto-renew disclosure laws (CA ARL, FTC click-to-cancel) and some jurisdictions mandate cooling-off/refunds for digital goods (EU/UK consumer rights), creating tension with a blanket "no refunds."

| Claim (verbatim) | file:line | Exposure | Severity | Truthful/qualified form |
|---|---|---|---|---|
| "**All sales are final. We do not offer refunds.**" | `makeshiphappenAi/app/terms/page.tsx:79` | Blanket no-refund may be unenforceable in jurisdictions mandating refunds; UDAP if it overrides statutory rights | Medium | Add "except where required by applicable law" (partly present at line 91-92). |
| "Cancel anytime · No refunds · Secure checkout via Stripe" | `makeshiphappenAi/app/pricing/page.tsx:221`; download pages `download/*/page.tsx` | "Cancel anytime" + auto-renew (`Subscriptions auto-renew until you cancel`, terms:58) → ARL/click-to-cancel disclosure duties | Medium | Ensure clear auto-renew terms + easy cancel path are disclosed pre-purchase. |
| "$50/month gives you access to everything. **Cancel anytime**…" / "No refunds — review before joining" | `makeshiphappenAi/app/pricing/page.tsx:19, 29, 295-296` | Same | Medium | Keep "review before joining"; surface statutory-rights carve-out. |
| "Priority support and onboarding" / "Priority updates" (Team/Pro) | `docs/shipmind-product-copy.md:99, 107` | Soft service promises; low | Low | Avoid SLA-sounding language unless deliverable. |
| Roadmap "**SLA**" (Enterprise tier, not done) | `makeshiphappenAi/app/company/roadmap/page.tsx:37` | Future SLA — fine as roadmap | Low | Keep marked "not done." |

## Category 8 — AI-Output Over-Promises

Citation/accuracy claims without an accuracy/"AI may be wrong" disclaimer, sold to people who "can't afford to be wrong" (legal/medical/financial reliance).

| Claim (verbatim) | file:line | Exposure | Severity | Truthful/qualified form |
|---|---|---|---|---|
| "Trust that takes one click to verify. **Built for people who can't afford to be wrong.**" | `makeshiphappenAi/app/v3/shipmind/sections/Pillars.tsx:39` | Invites high-stakes reliance; no accuracy disclaimer near it | High | Add "AI output can be wrong — verify against the cited source before relying." |
| "**No more guessing whether the AI is making it up.**" | `makeshiphappenAi/app/v3/shipmind/sections/Pillars.tsx:28` | Implies hallucination eliminated; citations reduce but don't eliminate error | High | "Citations let you check the source; the AI can still misread it." |
| "now: 'Every answer cited back to the exact source.'" / "Inline citations on **every claim**" | `makeshiphappenAi/app/v3/shipmind/sections/Pillars.tsx:31, 34` | "every answer/every claim" = coverage guarantee | High | "Answers are grounded in your sources with inline citations where available." |
| "100% — cited or flagged" | `makeshiphappenAi/app/v3/shipmind/sections/SpeedBand.tsx:12` | Absolute 100% citation-coverage guarantee | High | Drop the "100%". |
| "**It's a verifiable fact.**" | `makeshiphappenAi/app/v3/shipmind/sections/TrustBand.tsx:466` | Asserts AI output = fact | High | "It's a claim you can verify against the source." |
| "Lawyers can **verify**. Researchers can **defend**. Students can study from the original." | `makeshiphappenAi/app/v3/shipmind-v2/page.tsx:850` | Professional-reliance + accuracy | Medium | Pair with verify-the-source disclaimer. |
| "the same tooling lawyers, consultants, and researchers use to **defend their conclusions**" | `makeshiphappenAi/app/v3/shipmind/sections/Inspect.tsx:13` | Reliance framing | Medium | Soften; add output-may-err note. |
| "fact-check claims" (researcher card) | `makeshiphappenAi/app/v3/shipmind/sections/BuiltFor.tsx:41` | Implies the AI reliably fact-checks | Medium | "helps you fact-check against your sources." |
| **Mitigant:** "agent should **refuse to answer when no source is cited**" (design intent shown in mockup) | `makeshiphappenAi/app/v3/shipmind/sections/Hero.tsx:171`; `ShipMindInAction.tsx:313` | Shows grounding discipline — supports the citation claim | n/a (positive) | Ensure the shipped product actually enforces this. |

---

## Cross-cutting recommendations (notes only — no files changed)

1. **Single global AI-disclaimer + cloud-egress caveat** replicated on every surface that names a regulated audience or makes an absolute-privacy claim. The good language already exists at `app/v3/shipmind/sections/CTA.tsx:17` — it is missing from `docs/shipmind-product-copy.md`, both `.html` mockups, `app/v3/shipmind-v2/page.tsx`, and `app/page.tsx`.
2. **Remove or reframe named-compliance badges/claims**: `ferpa-safe` (BuiltForVisuals.tsx:392), `Privilege-safe` (BuiltFor.tsx:28), and the "compliance story short / audit-friendly by construction" copy (shipmind-product-copy.md:66-68) are the highest-liability single tokens in the repo.
3. **Substantiation register** for every quantified claim ("<500ms", "milliseconds", "sub-second", "faster than typing", "100% cited") and every competitor `×` cell. The dev already flagged the comparison-table risk at `shipmind-product-page-mockup.html:456` — that note is unresolved.
4. **Prompt-pack rights disclaimer**: the `ShipMindPrompts/Research/*` YouTube-extraction packs should carry the same "respect platform ToS / use only content you have rights to" language that `Prompts/Agents/Web Scraping Agent.txt` already models.
5. **Refund/auto-renew**: confirm ARL / click-to-cancel disclosure compliance; the "except where required by applicable law" carve-out exists in terms but not on pricing/download CTAs.

**Dossier path:** `docs/audit-v2/16-marketing-claims-sweep.md`
