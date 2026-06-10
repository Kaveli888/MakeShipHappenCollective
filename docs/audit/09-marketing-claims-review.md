# PHASE 9 — Marketing Claim Review

Full claim-by-claim table with file citations is in [`16-marketing-and-prior-audits.md`](16-marketing-and-prior-audits.md). This is the executive synthesis. **Explanations only — no copy was changed.**

---

## The dominant pattern — absolute privacy language next to a cloud opt-in

The single most repeated and most dangerous marketing failure mode across the ecosystem is **stating an absolute, unqualified privacy/security guarantee on the same product (often the same page) that ships a cloud feature contradicting it.** Absolute claims ("100%", "never", "not a single byte", "no vendor leaks", "period") are unsupportable the moment any cloud path exists — and every flagship product has one (Phase 2).

## Highest-exposure claims (verbatim, with exposure type)

| Claim (verbatim) | File | Exposure |
|---|---|---|
| "a private AI workspace… without sending a single byte to the cloud" | `docs/shipmind-product-copy.md:13` | (a) Privacy — self-contradicted by same doc's cloud chat (lines 32/62). FTC §5 / UDAP. 🔴 |
| "Your data never leaves your machine, period." | `app/products/shiptalk/v3/page.tsx:1277` | (a) Privacy — same page sells cloud mode. 🔴 |
| "No recordings are stored, uploaded, or analyzed externally." | `app/products/shiptalk/v3/page.tsx:1291` | (a) Privacy — cloud STT uploads audio; transcripts persist. 🔴 |
| "100% — On-device option — No vendor leaks" | `app/page.tsx:2956` | (a) Privacy — "no vendor leaks" is an unprovable absolute. 🟠 |
| "FERPA-protected… regulated data never leaves the device by default" | `app/v3/shipmind/…:17` | (a)+(e) Invokes a statute the product isn't certified for. 🔴 |
| "<500ms Latency… Faster than typing" / "sub-second on Groq" | mockups / v3 | (b) Performance — quantified claim, **no substantiation file**. 🟡 |
| NotebookLM / ChatGPT / Claude comparison table marking competitors "✗" | `app/v3/shipmind/sections/TrustBand.tsx:31-40`; both mockups | (d) Comparative/Lanham + trademark; mockup itself warns "verify each '×'" but no verification exists. 🟠 |
| Auto-renew + "All sales are final" + "Cancel anytime" | `app/terms/page.tsx`, `app/pricing/page.tsx` | (c) ROSCA/Click-to-Cancel + refund contradiction. 🟠 |
| "encrypts over HTTPS" / security assurances | shiptalk v3 page | Could create an express **security warranty** → breach exposure. 🟡 |
| Stale pricing ($20/$40 in product-copy doc vs live $50/mo) | `docs/shipmind-product-copy.md` | (c) Price inconsistency → billing disputes. 🟡 |

## Exposure-type legend

- **(a) Privacy/security claim** that must be *literally* true → FTC Act §5 / state UDAP deceptive-practice if not. **Highest frequency and severity here.**
- **(b) Performance/results claim** needing substantiation on file → FTC advertising-substantiation doctrine.
- **(c) Pricing/billing claim** (refunds, "cancel anytime", "free forever", auto-renew) → ROSCA, CA ARL, deceptive-pricing.
- **(d) Comparative claim** naming competitors → Lanham Act §43(a) false advertising + trademark.
- **(e) AI-capability/guarantee claim** (citations, "grounded") → must match implementation (note: ShipMind grounding is unimplemented on 4/7 providers → the guarantee can silently fail).

## Why this matters more than the security findings

A deceptive-advertising or privacy-promise-breach action does **not** require a breach to occur — only a contradiction between the words and the build, which already exists and is **documented in the company's own source comments** (ShipTalk's `Cargo.toml` admits the cloud egress "contradicts the '100% on-device' marketing claim"). That makes these the **highest-likelihood** legal exposures in the audit, and the cheapest to fix: **edit the copy to match reality.**

## Recommended (copy-only) remediation pattern

- Replace absolutes with mode-accurate, qualified language: *"Local-first. Your data is processed on-device by default. Optional cloud features (clearly labeled) send data to [provider] only when you turn them on."*
- Remove or substantiate every quantified performance number; keep a substantiation file.
- Remove competitor "✗" claims or back each with dated, reproducible evidence; consider neutral framing.
- Reconcile refund/pricing/auto-renew copy across ToS, pricing page, and product copy.
- Drop statutory-protection language (FERPA/HIPAA) unless and until certified and contractually supported.
- Avoid express security warranties ("no leaks", "encrypted, secure") — describe measures, don't guarantee outcomes.

**No code or copy was modified by this audit. The above are recommendations only.**
