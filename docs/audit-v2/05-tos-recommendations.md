# Audit v2 — Phase 5: Terms of Service Review (Recommendations)

> **NOT LEGAL ADVICE.** This is a technical auditor's recommendation inventory — *which* clauses the products' behavior necessitates and *why*, tied to specific findings. It does **not** draft binding contract language (only illustrative clause *intent*) and is not a substitute for a licensed attorney drafting and reviewing the actual Terms. Validate before publishing.
>
> **Method:** Synthesized read-only across dossiers 10–16. Citations preserved (`file:line`). Independent of `docs/audit/` and `docs/business-protection/`.
> **Date:** 2026-06-07.

**Live ToS surface:** `makeshiphappenAi/app/terms/page.tsx` + `app/privacy/page.tsx`. References below to "**already exists**" mean present in those files; "**missing**" means not found in scope. **Cluster key:** shipmind-10, space-11, voice-12, web-13, util-14, lic-15, mktg-16.

---

## 0. Two structural gaps that undermine every clause below

| Gap | Why it neutralizes the rest of the Terms | Evidence | Recommendation |
|---|---|---|---|
| **No ToS/Privacy acceptance gate** (no checkbox / "by signing up you agree" at signup, login, pricing, CLI-login) | A liability cap, warranty disclaimer, AUP, and AI-disclaimer are only as enforceable as the user's assent. Browsewrap is weak; clickwrap is strong. Without acceptance, **all** clauses below are at risk. | web-13 L-2 (`app/signup/page.tsx`, grep for "agree/accept" = none) | Add a clickwrap acceptance gate (checkbox + dated link to Terms+Privacy) at **every** entry point: web signup/login/checkout, **and** each desktop app's first run, **and** CLI login. Record acceptance (version + timestamp). |
| **Placeholder governing-law / venue** ("the state in which MakeShipHappen is registered" — no state named) | An indeterminate forum-selection clause is likely unenforceable; disputes land in an unintended forum. | web-13 L-4 (`app/terms/page.tsx:167-171`) | Name the actual state of registration + venue + governing law; pair with the acceptance gate above. |

---

## 1. Required ToS Clauses

| Clause | Why (product behavior / risk) | Evidence | Status |
|---|---|---|---|
| **Clickwrap acceptance + versioning** | See §0. Necessary to bind the liability cap and disclaimers. | web-13 L-2 | **Missing** |
| **Named governing law, venue, dispute resolution** | Placeholder venue is unenforceable. | web-13 L-4 | **Partial/placeholder** — exists but unnamed |
| **Scope-of-service / "as-is, no fitness for regulated use"** | Marketing targets schools/clinicians/attorneys; Terms must disclaim regulated-use fitness so the User remains the data controller. | shipmind-10 L-1; mktg-16 Cat 2; web-13 L-5 | **Partial** — ShipCode no-safety-critical clause exists (`terms:138-144`); regulated-data carve-out missing |
| **Auto-renewal terms with conspicuous point-of-sale disclosure** | Subscription auto-renews; ARL/click-to-cancel require clear pre-purchase disclosure. Terms §4 discloses it; checkout CTA does not. | web-13 L-3; mktg-16 Cat 7 | **Partial** — in Terms (`terms:53-63`), weak at checkout (`pricing:198-222`) |
| **Refund policy aligned with mandatory consumer rights** | "All sales final" is partly unenforceable where statutory withdrawal/refund rights apply. | web-13 L-1; mktg-16 Cat 7 | **Partial** — "unless required by applicable law" in Terms (`terms:91-92`), absent on pricing/download CTAs |
| **Age eligibility (single, enforced minimum)** | 18 site-wide vs "under 13" extension; neither enforced at signup. | web-13 §6/§8 | **Inconsistent / unenforced** |
| **Third-party-services / subprocessor list (complete)** | Terms §9 omits Printful; regulated buyers need a subprocessor list/DPA. | web-13 P-4/P-5 | **Partial** — incomplete (`terms:130-136`) |
| **Local-vs-cloud data-flow disclosure** | "Local/private/sealed" branding co-exists with cloud egress; Terms must state that cloud modes egress user content to the chosen provider. | shipmind-10 P-1; voice-12 P-1/P-2; util-14 P-6; mktg-16 Cat 1 | **Missing in Terms** (only on v3 page FAQ) |

---

## 2. Required Limitation-of-Liability Clauses

| Clause | Why (product behavior / risk) | Evidence | Status |
|---|---|---|---|
| **General LoL cap + exclusion of consequential/indirect/data-loss damages** | Autonomous agents can destroy data; LoL must cap and exclude consequential loss. (Only enforceable with §0 acceptance gate.) | space-11 S-1/S-8; util-14 L-2 | **Verify presence/strength** — Terms have a cap referenced (web-13 L-2 context); confirm scope |
| **Autonomous-execution / agent-action carve-out** | Raw shell (space-11 S-1), auto-approve-all (S-3), auto-merge (S-8), bypassPermissions computer-use (util-14 S-5/L-2) can take irreversible real-world actions. *Illustrative intent:* User assumes all risk of agent-initiated commands, file changes, merges, and computer-use actions; vendor not liable for resulting damage. | space-11 S-1/S-3/S-8; util-14 L-2 | **Missing** |
| **Data-loss / deletion disclaimer (ship-memory, file ops)** | Permanent delete over unauthenticated MCP; cwd-escape file writes; no undo. | util-14 S-7/S-6; space-11 | **Missing** |
| **Third-party-provider passthrough disclaimer** | User content is processed by Anthropic/OpenAI/Apple/Groq/Google under *their* terms; vendor not liable for provider acts/retention. | shipmind-10 P-1; voice-12 §5; util-14 P-6 | **Partial** — providers named (`terms:130-136`); liability passthrough should be explicit |
| **Security / breach LoL (no encryption-at-rest)** | Data stored unencrypted; LoL must cover breach of the local store despite the marketed "AES-256/encrypted at rest." | shipmind-10 P-2; voice-12 P-4; util-14 P-5; web-13 L-7 | **Missing** |
| **Operator-cost / abuse disclaimer (cloud relays)** | ShipWatch Cloud relay / server-paid chat can be abused; cap operator exposure and prohibit abuse. | util-14 S-1/L-5; web-13 S-7 | **Missing** |

---

## 3. Required Acceptable-Use (AUP) Restrictions

| Restriction | Why (product behavior / risk) | Evidence | Status |
|---|---|---|---|
| **Lawful-recording / consent requirement** | Mic + system-audio capture bystanders/meeting participants; product *auto-arms*; two-party-consent + BIPA exposure. *Intent:* User must obtain all legally required consents before recording; no recording where prohibited. | voice-12 §5; util-14 L-1/P-2 | **Missing** |
| **No surveillance of non-consenting third parties / employees** | Continuous screen+clipboard capture on shared/managed machines sweeps in others' PII. | util-14 L-3/P-1/P-3 | **Missing** |
| **No unlawful autonomous/computer-use actions; human-oversight duty** | bypassPermissions + auto-approve-all + raw shell can act irreversibly. *Intent:* User responsible for supervising agents; may not use autonomous modes for destructive/unauthorized actions or against systems they don't own. | space-11 S-1/S-3/S-5; util-14 S-5/L-2 | **Missing** |
| **No access to systems/data without authorization (CFAA-adjacent)** | `read_file`/unguarded browser navigation/`open_path` could touch unauthorized resources. | space-11 S-2/S-13/S-14 | **Missing** |
| **Respect platform ToS & content rights when ingesting/scraping** | yt-dlp YouTube ingestion + web scraping + creator-prompt-extraction/competitor-dossier packs facilitate ToS/IP violations. *Intent:* Use ingestion/scraping/extraction only on content the User has rights to and consistent with the source's ToS. | shipmind-10 L-2; mktg-16 Cat 6 | **Missing** (a good model disclaimer already exists at `Prompts/Agents/Web Scraping Agent.txt:9-20` — replicate it) |
| **No regulated data without independent compliance assessment** | Implied HIPAA/FERPA/GLBA/privilege fitness; no BAA/DPA. *Intent:* User must not place PHI/PII/privileged/student data into cloud modes without their own legal assessment; vendor makes no compliance certification. | shipmind-10 L-1; mktg-16 Cat 2; web-13 L-5 | **Missing** |
| **Network-exposure prohibition for local-only tools** | ship-aos (live Stripe key, no auth) and ShipWatch Cloud relay are localhost-safe only. *Intent:* User must not expose these on public/shared interfaces. | web-13 S-1; util-14 S-1 | **Missing** |
| **No paywall/entitlement circumvention** | Client-side owner-bypass + bypassable free-tier meter. | shipmind-10 S-7; util-14 §7 | **Missing** (low priority; BYO-key economics limit harm) |

---

## 4. Required IP-Protection Clauses

| Clause | Why (product behavior / risk) | Evidence | Status |
|---|---|---|---|
| **LICENSE file per product + IP-ownership statement** | No product ships a LICENSE; ShipCode/root *claim* MIT without backing it; IP/usage terms undefined. | lic-15 A.4; shipmind-10 L-4 | **Missing** (all 6 products) |
| **Third-party NOTICE / attribution bundle** | Bundled MIT/Apache/BSD binaries (deno, ollama, ggml) and npm deps require reproduced notices in distributed binaries. | lic-15 A.3 (missing-attribution); shipmind-10 L-5 | **Missing** (every distributed app) |
| **GPL-ffmpeg remediation / source-offer (or swap to LGPL build)** | GPL ffmpeg in a proprietary `.app` triggers copyleft obligations — distribution-blocking. (Primarily an engineering fix; the ToS/NOTICE cannot cure it alone.) | lic-15 A.3 (ffmpeg, **Critical**), A.5 | **Unmet — Critical** |
| **AI-generated-output ownership & provenance disclaimer** | ShipGang/ShipCode produce model-authored code that may carry copyrighted snippets; auto-merge bypasses review. *Intent:* User owns/assumes responsibility for generated output; vendor disclaims warranty of non-infringement/originality; User responsible for provenance review. | space-11 §5; util-14 §7 | **Missing** |
| **Comparative-advertising / trademark substantiation** | Competitor comparison tables with ✗ cells; dev's own note says verify before launch. (Not a ToS clause per se but an IP/advertising-compliance action.) | web-13 L-8; mktg-16 Cat 5 | **Unresolved action item** |

---

## 5. Required Account-Responsibility Language

| Clause | Why (product behavior / risk) | Evidence | Status |
|---|---|---|---|
| **API-key custody & spend responsibility (BYO key)** | User supplies keys; owns spend/limits; keys in keychain. | space-11 §6; shipmind-10 §6; util-14 §7 | **Partial** — disclosed for ShipCode/keys (`terms:130-136`); generalize |
| **Local-data custody & no-server-backup notice** | Account deletion does not delete local files; no encryption at rest; user owns device security. | web-13 §6 (`privacy:42,72`); shipmind-10 P-2 | **Partial** — exists for local files; extend to encryption/backup |
| **Administrator/deployer responsibility (shared machines)** | Surveillance + autonomous tools on managed machines implicate workplace-monitoring law. | util-14 L-3 | **Missing** |
| **MCP-wiring responsibility & exposure acknowledgement** | Wiring any MCP server exposes transcripts/state/notes (and write/delete for ship-memory) to the connected LLM with no auth. *Intent:* User responsible for what they connect; acknowledges full read (and, for ship-memory, write/delete) exposure. | voice-12 S-1; space-11 S-10; util-14 S-7 | **Missing** |
| **Account-security & credential-hygiene duty** | Live Stripe key locally (ship-aos); secrets visible in terminals can egress to providers. | web-13 S-1; space-11 S-11 | **Missing** |
| **Self-serve cancellation availability** | Terms assert self-serve cancel; UI not verified. | web-13 §6/L-3 | **Asserted — verify implementation** |

---

## 6. Required AI-Output Disclaimers

| Disclaimer | Why (product behavior / risk) | Evidence | Status |
|---|---|---|---|
| **"AI output may be inaccurate — verify before relying" (global)** | "100% cited," "verifiable fact," "no more guessing whether the AI is making it up," sold to "people who can't afford to be wrong." | mktg-16 Cat 8; shipmind-10 L-3 | **Partial** — present on v3 CTA (`CTA.tsx:17`), **missing** from product copy doc, both `.html` mockups, `shipmind-v2`, `app/page.tsx` |
| **No-professional-reliance carve-out (legal/medical/financial)** | "Privilege-safe," "attorneys/clinicians," "defend their conclusions" invite high-stakes reliance. | mktg-16 Cat 2/Cat 8 | **Missing** |
| **No-safety-critical-use (generated code)** | ShipCode code may be wrong/insecure. | web-13 §6 (`terms:138-144`) | **Already exists** — replicate to other AI surfaces |
| **Citation-coverage qualifier (drop "100%")** | Citations reduce but don't eliminate hallucination/miscitation. | mktg-16 Cat 8 (`SpeedBand.tsx:12`) | **Missing** (marketing fix) |
| **Autonomous-agent action disclaimer** | Agents act without per-action human review in opt-out modes. | space-11 S-1/S-3; util-14 L-2 | **Missing** |

---

## 7. Required Warranty Disclaimers

| Disclaimer | Why (product behavior / risk) | Evidence | Status |
|---|---|---|---|
| **General "AS-IS / no implied warranties (merchantability, fitness)"** | Broad product surface; foundational. | all clusters | **Verify presence** in Terms |
| **No security/encryption warranty (counter the express claims)** | Marketing asserts "AES-256 at rest," "encrypts over HTTPS," "encrypted at rest and in transit" while data is stored **unencrypted**; express warranties create breach exposure. The disclaimer must reconcile with — and the marketing must stop overstating — actual behavior. | web-13 L-7; mktg-16 Cat 3; contradicted by shipmind-10 P-2, util-14 P-5 | **Missing / contradicted by marketing** |
| **No performance/latency warranty** | "<500ms / faster than typing" presented as fact, hardware-dependent. | web-13 L-6; mktg-16 Cat 4 | **Missing** |
| **No privacy/locality warranty for cloud modes** | "Never leaves your machine"/"sealed" contradicted by cloud egress; disclaim any guarantee of non-egress once a cloud mode/Polish/provider is selected. | shipmind-10 P-1; voice-12 P-1/P-2; mktg-16 Cat 1 | **Missing** (and marketing must be qualified) |
| **No regulated-compliance warranty (HIPAA/FERPA/GLBA/SOC2)** | "ferpa-safe"/"compliance story short" with zero certification. | shipmind-10 L-1; web-13 L-5; mktg-16 Cat 2 | **Missing** (and badges should be removed/reframed) |
| **No third-party-provider warranty** | Provider availability/accuracy/retention out of vendor control. | shipmind-10 P-1; util-14 P-6 | **Partial** |

---

## 8. Priority sequencing (auditor view)

1. **Add the acceptance gate + name governing law** (§0) — without these, every clause below is weak. *(web-13 L-2/L-4.)*
2. **Add AUP: lawful-recording/consent + autonomous-action oversight + regulated-data restriction** — these map to the three Critical liability classes (wiretap, agent-harm, regulated-data). *(voice-12 §5; util-14 L-1/L-2; shipmind-10 L-1.)*
3. **Reconcile marketing with warranty disclaimers** — remove/qualify "ferpa-safe," "never leaves," "AES-256/encrypted," "100% cited," "<500ms"; add the global AI-output disclaimer everywhere (the good language already exists at `CTA.tsx:17`). *(mktg-16 Cats 1–8.)*
4. **Add LoL autonomous-execution + data-loss + provider-passthrough carve-outs.** *(space-11; util-14.)*
5. **IP: ship LICENSE + NOTICE files; remediate GPL ffmpeg (swap to LGPL build).** The ffmpeg item is **Critical and distribution-blocking** and cannot be cured by ToS text alone. *(lic-15 A.3/A.4.)*
6. **Auto-renewal point-of-sale disclosure + refund/statutory-rights carve-out at checkout.** *(web-13 L-3/L-1.)*
7. **Implement (not just promise) data export/delete; complete subprocessor list.** *(web-13 P-1/P-4.)*

**Already-present, keep/replicate:** ShipCode "solely responsible / no safety-critical" disclaimer (`terms:138-144`); BYO-key/local-file-deletion notices (`privacy:41,42,72`); refund "unless required by applicable law" hedge (`terms:91-92`); v3 responsibility + cloud-opt-in disclaimer (`CTA.tsx:17`); the responsible scraping model at `Prompts/Agents/Web Scraping Agent.txt:9-20`.
