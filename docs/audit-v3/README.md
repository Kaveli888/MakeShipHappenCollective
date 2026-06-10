# Ship Ecosystem — Audit v3 (Index)

**Date:** 2026-06-07
**Type:** Fresh, independent, read-only risk / inventory / governance audit (v3)
**Methodology:** Multi-agent. Independent specialist agents each produced a phase or per-product cluster document; a lead synthesis agent consolidated findings into the Executive Report. No source code was modified, no packages installed, no builds or deploys run.

---

## Scope

This audit covers four products in the Ship Ecosystem (MakeShipHappen Collective):

- **ShipTalk** — Tauri 2 macOS voice-dictation & transcription desktop app
- **ShipMind** — local-first markdown "second brain" / knowledge & transcript desktop app
- **ShipSpace** — agentic IDE / orchestration Tauri 2 desktop app
- **makeshiphappen.tech** — Next.js 16 commerce / identity / account website (`makeshiphappenAi/`)

Companion stdio MCP servers (`shiptalk-mcp`, `shipmind-mcp`, `shipspace-mcp`) and the `shipmind` Chrome extension are covered where they touch these products.

**Out of scope:** ShipWatch is explicitly **excluded** from this audit.

This is a risk / inventory / governance assessment. The software is assumed to function correctly; the audit evaluates legal, privacy, security, licensing, marketing, and user-responsibility risk — not code correctness or bugs.

---

## Documents

| Document | Description |
|----------|-------------|
| [00-EXECUTIVE-REPORT.md](00-EXECUTIVE-REPORT.md) | Lead synthesis of all phases — consolidated findings, risk posture, and priorities across the ecosystem. |
| [01-ecosystem-map.md](01-ecosystem-map.md) | Full inventory and map of products, repos, MCP servers, extensions, and how the pieces connect. |
| [02-data-flow-audit.md](02-data-flow-audit.md) | Every flow of user input, audio, files, logs, analytics, and API/agent traffic — origin → destination → retention → controls → responsible party. |
| [03-liability-review.md](03-liability-review.md) | Legal and business exposure across all four products for a single-developer commercial venture. |
| [04-user-responsibility.md](04-user-responsibility.md) | Allocation of responsibility between operator, administrator/self-hoster, and end user. |
| [05-tos-recommendations.md](05-tos-recommendations.md) | Terms of Service / EULA drafting recommendations across the ecosystem. |
| [06-privacy-review.md](06-privacy-review.md) | Privacy and data-protection posture, data-controller analysis, and retention review. |
| [07-security-review.md](07-security-review.md) | Read-only security risk inventory with severity ratings (no remediations prescribed). |
| [08-open-source-review.md](08-open-source-review.md) | License, attribution, and distribution-obligation review for paid distributed binaries and the web service. |
| [09-marketing-claims-review.md](09-marketing-claims-review.md) | Public marketing copy and claims cross-checked against actual product behavior, with evidence ratings. |
| [11-shiptalk-cluster.md](11-shiptalk-cluster.md) | Single deep reference for ShipTalk (app + `shiptalk-mcp`). |
| [12-shipmind-cluster.md](12-shipmind-cluster.md) | Single deep reference for ShipMind (app + `shipmind-mcp` + `shipmind-extension`). |
| [13-shipspace-cluster.md](13-shipspace-cluster.md) | Single deep reference for ShipSpace (app + `shipspace-mcp`). |
| [14-website-cluster.md](14-website-cluster.md) | Single deep reference for the makeshiphappen.tech website (`makeshiphappenAi/`). |

> Document 10 is intentionally not present; the phase numbering reflects the multi-agent split (Phases 1–9 thematic, Phases 11–14 per-product clusters, Phase 00/10 executive synthesis).

---

## ⚠️ Pending: Business Protection Blueprint (Part 2)

**This v3 audit is Part 1 (assessment) only.** The **Business Protection Blueprint (Part 2)** — the actionable defensive playbook (concrete ToS/EULA/privacy-policy language, remediation plans, governance controls, and risk-mitigation steps) — is **not yet produced**.

Part 2 will be created **separately, only on the user's explicit go-ahead.** Do not assume the recommendations in these documents have been implemented; they are findings and proposals pending the Part 2 engagement.
