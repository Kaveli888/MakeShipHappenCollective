# PHASE 5 — Terms of Service Review (Recommendations Only)

Based on the **actual functionality** found in source, this is the set of clauses a commercial AI desktop + web ecosystem with paying users should have. **Recommendations only — no documents were drafted or modified.** Engage a licensed attorney to draft and localize.

**Current state (from `16-marketing-and-prior-audits.md`):** A `terms` and `privacy` page exist in `makeshiphappenAi`, but they contain placeholder governing-law, "not legal advice — consult a lawyer" text (indicating unfinished/templated docs), and contradict the marketing (refunds) and the code (deletion). No verified acceptance gate. No per-product ToS, no Acceptable Use Policy, no DPA. **Treat the existing ToS/Privacy as drafts, not protections.**

---

## A. Required Terms of Service clauses

| Clause | Why this ecosystem needs it |
|---|---|
| **Acceptance & formation** (click-through at signup *and* checkout, versioned, logged) | Without provable acceptance, every protection below is challengeable (LR-2). |
| **Service description & modifications** | Multiple apps with cloud + local modes; reserve the right to change features/providers. |
| **Account terms & eligibility** | Define minimum age **consistently** (resolve the 13-vs-18 conflict); one account per user; accurate info. |
| **Subscription, billing & auto-renewal** | $50/mo (and any $500 tier) recurring billing; must state price, renewal cadence, that it auto-renews, and how to cancel — meeting CA ARL / FTC Click-to-Cancel. |
| **Refund policy (reconciled)** | Resolve "all sales are final" vs. "7-day money-back." Pick one, state it identically in ToS and marketing (LR-1). |
| **Cancellation & termination** (by user and by platform) | Self-serve cancel as easy as signup; platform termination rights for AUP violations. |
| **License grant to use the software** | Define the license to the desktop apps/CLI; reserve all IP. |
| **User content & data ownership** | User owns their inputs/outputs; grant platform a limited license to process (incl. via subprocessors) to provide the service. |
| **Third-party services & subprocessors** | Name Anthropic/OpenAI/Groq/Google/Supabase/Stripe/Printful/Sentry; user data may be processed by them. |
| **Beta/experimental features** | Cover autonomous-agent and "danger" modes explicitly. |
| **Dispute resolution, governing law, venue** | Replace placeholders; choose a real state (founder is in CA) and forum; consider arbitration + class waiver. |
| **Changes to terms & notice** | How updates are communicated and accepted. |

## B. Required limitation-of-liability clauses

- **Liability cap** (e.g., fees paid in the prior 12 months) — essential given autonomous-agent and data-loss exposure (LR-12).
- **Exclusion of consequential/indirect damages** (lost data, lost profits, business interruption).
- **Carve-outs** as legally required (gross negligence, willful misconduct, statutory non-waivable rights — esp. consumer-protection jurisdictions).
- **"As-is" allocation of risk** tied to the warranty disclaimer (Section D).

## C. Required acceptable-use restrictions (currently NO AUP exists)

The AUP is the single most important *missing* document for this ecosystem because the products are dual-use. It should prohibit / require:

- **No recording of third parties without their consent** (wiretap/BIPA) — user warrants compliance (ShipTalk/ShipWatch).
- **No ingesting/scraping content the user lacks rights to**; user warrants they hold rights to ingested material (ShipMind/yt-dlp).
- **No use of autonomous-agent / "danger"/bypass modes against systems the user is not authorized to modify** (ShipSpace/ShipClick) — anti-CFAA-abuse clause.
- **No use to process regulated data (PHI/FERPA/financial)** unless the user has independent legal authority and accepts that cloud features transmit data externally.
- **No illegal content, malware, or harassment.**
- **User responsibility for agent actions** taken on their machine/accounts and for reviewing auto-merged code/PRs.
- **No reverse-engineering / reselling / abusing metered tiers.**

## D. Required warranty disclaimers

- **"AS IS / AS AVAILABLE", no implied warranties** (merchantability, fitness, non-infringement).
- **No uptime/availability warranty** unless an SLA is separately offered.
- **No warranty of security** beyond reasonable measures — important because marketing currently says "encrypts over HTTPS"/"no vendor leaks" (avoid creating an express security warranty, LR-23/S claims).

## E. Required AI-output disclaimers

- **AI output may be inaccurate, incomplete, or fabricated ("hallucinations"); verify before relying.**
- **Not professional advice** (legal/medical/financial/educational) — directly counters the regulated-vertical marketing (FERPA/HIPAA framing).
- **User is responsible for outputs** they act on or publish.
- **Citation/grounding is best-effort**, not a guarantee (note: ShipMind's tool-loop grounding is unimplemented on 4/7 providers — the "grounded in your sources" guarantee can silently fail).
- **EU AI Act transparency:** disclose that the user is interacting with AI.

## F. Required intellectual-property protections

- **Platform IP reservation** (brand "Ship" family, trademarks, software).
- **User-content license** (limited, to operate the service).
- **Feedback license** (platform may use feedback freely).
- **DMCA/notice-and-takedown** process and agent designation (relevant given ingestion features).
- **Open-source attribution** incorporated by reference to a NOTICE/licenses file (currently missing).

## G. Required account-responsibility language

- **Credential security is the user's responsibility**; notify on compromise.
- **Responsibility for all activity under the account**, including agent actions and metered usage.
- **Accurate billing information**; responsibility for taxes where applicable.
- **Comp/promotional access** terms (revocable at any time; no auto-expiry today → state it).

---

## H. Companion documents to publish alongside the ToS

| Document | Status | Priority |
|---|---|---|
| Privacy Policy (accurate to real data flows) | Draft exists, **inaccurate** | 🔴 |
| Acceptable Use Policy | **Absent** | 🔴 |
| Refund Policy (reconciled) | Contradictory | 🟠 |
| Auto-Renewal / Cancellation disclosure | **Absent/insufficient** | 🟠 |
| Data Processing Agreement + subprocessor list | **Absent** | 🟠 |
| Cookie/Tracking notice (if analytics added) | **Absent** | 🟡 |
| AI Transparency / Output disclaimer (in-product) | **Absent** | 🟠 |
| DMCA policy | **Absent** | 🟡 |
| Accessibility statement | **Absent** | 🟢 |

**Bottom line:** The ToS is the cheapest, highest-leverage risk reduction in this entire audit. Finalizing it (with an enforceable acceptance gate, a reconciled refund term, an AUP, AI disclaimers, and accurate subprocessor disclosure) converts most "Platform Owner / Unclear" responsibilities from Phase 4 into user-allocated, contractually-capped risk — **without touching the products.**
