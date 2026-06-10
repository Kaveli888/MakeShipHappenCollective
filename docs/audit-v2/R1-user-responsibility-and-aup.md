# R1 — User-Responsibility & Acceptable-Use Pack (Decision 1: keep features, shift responsibility)

**Date:** 2026-06-07 · **Status:** Draft for attorney review · **Constraint:** No product functionality changed. This document allocates *responsibility*, it does not modify code.

> ⚠️ **Not legal advice.** This is a structured drafting brief a licensed attorney should finalize before it goes live. It also has **honest limits** (see §6) — a contract reduces exposure; it does not erase criminal liability or active-inducement liability.

---

## Decision recorded

**Keep all features as-is** — ShipMind's YouTube/video downloader (yt-dlp), web/PDF scraping, the "competitor research / prompt-extraction" packs, voice recording (ShipTalk), screen/audio surveillance (ShipWatch), and the autonomous agents (ShipSpace shell, ShipClick computer-use). **Do not disable or gate functionality.** Instead, make the *user* the responsible operator by contract and notice, so that misuse is contractually their liability, not the platform's.

This is the standard posture for a "neutral tool" (like a browser, a screen recorder, or yt-dlp itself): the tool is lawful; the *use* is the user's responsibility.

---

## 1. The core framing: "tool, not a service; you are the operator"

Every clause below rests on one positioning statement that should appear in the Terms:

> *"MakeShipHappen products are general-purpose tools that act under your direction and on your instruction. You are the operator and, where applicable, the data controller. You are solely responsible for the content you choose to download, scrape, record, process, or generate, and for ensuring your use is lawful in your jurisdiction."*

This single sentence converts the riskiest features from "things the platform does" into "things the user does with a tool" — which is exactly the liability shift you asked for.

---

## 2. Acceptable Use Policy (AUP) — prohibited-use list

Add a standalone AUP (and link it from the ToS as binding). It must **prohibit** the misuse so that misuse is a breach of contract by the user:

- **No IP infringement.** You will not use the products to download, copy, scrape, reproduce, or distribute content you do not own or have the right to use (e.g., copyrighted videos, articles, PDFs, images).
- **No platform-ToS violations.** You will not use the products to access or extract content in violation of any third-party platform's terms (e.g., YouTube, websites you scrape). *(Specifically names the yt-dlp/scraping exposure.)*
- **No unlawful recording.** You will not record audio, video, screen, or system audio of any person without all legally required consents in your jurisdiction (including two-party-consent states such as CA, FL, IL, and biometric-notice laws such as Illinois BIPA). *(Covers ShipTalk + ShipWatch.)*
- **No unauthorized system access / damage.** You will not direct the autonomous-agent or computer-use features (ShipSpace, ShipClick) against systems, accounts, or data you are not authorized to access or modify. *(Covers CFAA-adjacent exposure.)*
- **No illegal, harmful, or rights-violating content or use.**
- **You are responsible for outputs.** AI output may be inaccurate; you will independently verify before relying on it.

---

## 3. User representations & warranties (the affirmative "it's on you")

The user must **represent and warrant**, as a condition of use:

1. **Rights to content:** "You represent that you own, or have all necessary rights, licenses, and permissions to, any content you download, scrape, upload, record, or process using the products."
2. **Lawful recording:** "You represent that you have obtained all consents required by law before recording any person or capturing any third party's voice, image, screen content, or data."
3. **Authorization:** "You represent that you are authorized to direct the products to act on any file, system, repository, or account you target."
4. **Compliance:** "You represent that your use complies with all applicable laws and all third-party terms of service."

Representations matter because a breach of them is the user's breach — it is the hook the indemnity hangs on.

---

## 4. Indemnification (the financial transfer of risk)

> *"You agree to indemnify, defend, and hold harmless MakeShipHappen and its founder from and against any claims, damages, liabilities, losses, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) your use of the products; (b) content you download, scrape, record, generate, or process; (c) your violation of any third-party rights, including intellectual-property, privacy, or publicity rights; (d) your violation of any law or third-party terms of service; or (e) actions you direct the autonomous or computer-use features to take."*

This is the clause that operationally means "if a copyright holder, a recorded third party, or a platform comes after this, the user — not you — answers for it."

---

## 5. Supporting clauses (already partly on the site; reconcile them)

- **Disclaimer of authorization / no endorsement:** State that the company does **not** authorize or encourage infringing downloads or non-consensual recording, and that such features are **provided for lawful uses only** (your own content, licensed content, content you have permission to use, or fair use). This rebuts any "you induced it" argument (see §6).
- **Limitation of liability + warranty disclaimer:** "AS IS," no warranty of fitness for any regulated or specific purpose, liability cap. *(You have a version in `app/terms/page.tsx`; make sure it's accepted — see §7.)*
- **AI-output disclaimer:** outputs may be wrong; not professional (legal/medical/financial) advice; verify independently.
- **Assumption of risk for autonomous features:** the user acknowledges that shell/computer-use agents can take irreversible actions and that the user runs them at their own risk.

---

## 6. ⚠️ Where the liability shift has real limits (read this)

A contract is strong, but it is **not** a force field. Be honest with yourself and your lawyer about three gaps:

1. **Criminal law can't be waived.** Wiretap/eavesdropping statutes are criminal in some states. A ToS can't make non-consensual recording legal — it only shifts *civil* responsibility to the user. The AUP + consent representation is the right move, but the feature still creates criminal exposure *for the user*, and reputational exposure for you if it's seen as built for it.
2. **Active inducement survives disclaimers (the big one for the scraping packs).** Under *MGM v. Grokster*, a tool marketed or designed to induce infringement can carry secondary liability **even with a disclaimer**. Your **`ShipMindPrompts/Research/*` prompt packs are purpose-built to lift specific creators' words** ("extract every instance… keep his words") — that's inducement *evidence* that a disclaimer doesn't cure. **This is the one place where "keep everything unchanged" is genuinely risky.** Mitigation that still keeps the feature: reframe those packs toward analysis/your-own-content/licensed use and remove "copy their words verbatim" phrasing — that's a copy change, not a feature removal. Strongly recommend doing it.
3. **Consumer-protection limits.** Some liability/warranty disclaimers are unenforceable against consumers in some states; an over-broad indemnity can be read down. A lawyer calibrates this.

**Net:** the AUP + representations + indemnity get you most of the way and are clearly worth doing. Pair them with (a) softening any *marketing* that implies the company encourages the risky use (Decision 2 does this), and (b) toning down the inducement-y prompt-pack wording. Those two keep the features while removing the "you built it to break the law" narrative.

---

## 7. The one mechanism that makes all of this actually bind

None of the above protects you unless the user **affirmatively accepts** it. Today there is **no ToS-acceptance gate** at signup/checkout (`app/signup/page.tsx`), and governing law is a **placeholder** (`app/terms/page.tsx:167`). Two fixes — both small, both required for any of §1–§5 to be enforceable:

- **Acceptance gate:** an unchecked "I agree to the Terms and Acceptable Use Policy" checkbox at signup and checkout, with the acceptance timestamp recorded.
- **Name the governing-law state** (your AGENTS.md says Palm Springs, CA — so likely California; confirm with counsel given CA's consumer-protection strictness).

**Optional but high-value (does NOT change core functionality):** a **one-time, per-feature acknowledgment** the first time a user opens the downloader / starts a recording / launches an autonomous agent — e.g., *"I confirm I have the rights/consents for this content and will use this lawfully."* Courts weight point-of-use acknowledgment heavily. It's a small notice, not a functional gate, and it's the single strongest evidence that responsibility sits with the user.

---

## 8. Feature → covering-clause map

| Feature (kept as-is) | Primary risk | Clauses that shift it to the user |
|---|---|---|
| ShipMind YouTube/video downloader (yt-dlp) | Copyright / YouTube-ToS | AUP §2, Reps §3.1, Indemnity §4, No-authorization §5, point-of-use §7 |
| Web/PDF scraping | Copyright / site-ToS | AUP §2, Reps §3.1/3.4, Indemnity §4 |
| Prompt-extraction packs | **Inducement** (limited cure) | AUP §2 + **reword the packs** (§6.2) + Decision-2 softening |
| ShipTalk voice recording | Wiretap/consent, BIPA | AUP §2, Reps §3.2, Indemnity §4 (criminal not waivable §6.1), point-of-use §7 |
| ShipWatch surveillance | Wiretap/consent, bystander PII | Same as above + assumption-of-risk §5 |
| ShipSpace shell agents / ShipClick | CFAA-adjacent, data destruction | AUP §2, Reps §3.3, Assumption-of-risk §5, Indemnity §4 |
| All AI output | Hallucination reliance | AI-output disclaimer §5, Reps §3.4 |

---

**Bottom line:** You can keep every feature. The work is (1) ship the AUP + representations + indemnity, (2) add the acceptance gate + governing law so they bind, (3) optionally add point-of-use acknowledgments, and (4) reword the inducement-y prompt packs + soften the marketing (Decision 2) so the *company's own words* don't undercut the disclaimer. Get a lawyer to finalize §2–§5.
