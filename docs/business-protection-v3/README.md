# Ship Ecosystem — Business Protection Blueprint (Part 2)

**Date:** 2026-06-07
**Type:** Non-code business, legal, and governance protection guidance for a solo-founder AI software company
**Company:** Make Ship Happen Collective (Ship Ecosystem product family) — solo founder, early-revenue, US-based
**Source audit:** [`docs/audit-v3/`](../audit-v3/) — this Blueprint is **Part 2** (the actionable defensive playbook) built on top of **Part 1** (the v3 assessment).

---

## What this is

This is the **business, legal, and governance wrapper** around the v3 technical audit. The audit (`docs/audit-v3/`) already catalogs the technical issues; this Blueprint does **not** prescribe code changes, refactors, or architecture changes.

Where an audit finding has a technical root cause — GPL-licensed ffmpeg, raw-shell agents, keystroke injection, no data-deletion path, undisclosed cross-border transfer — it is addressed here through **corporate, legal, documentation, policy, operational, insurance, governance, and user-responsibility instruments**: entity formation, counsel-reviewed licensing decision records, NOTICE/attribution documents, EULAs and acceptable-use terms, runbooks, registers, attestations, and consent gates. The goal is to operate a legitimate AI software company with clear user responsibility, strong documentation, and reduced personal liability — **without changing product functionality.**

Every recommendation in these documents is grounded in a specific audit finding and tagged with an **EFFORT** tier (Low / Medium / Long-term) and a **PROTECTION VALUE** (High / Medium / Low). The deliverable is prioritized highest-protection-for-lowest-effort first; see `00-blueprint-and-roadmap.md` for the consolidated, tiered roadmap.

---

## ⚠️ Advisory only — not legal advice

This Blueprint is **advisory guidance, not a substitute for licensed legal counsel.** It is prepared for a solo founder to organize, prioritize, and brief counsel — not to replace them. Several items (LLC formation state, the GPL ffmpeg licensing decision, the DeepSeek/China data-transfer question, EULA/ToS/AUP drafting, and insurance disclosures) **must** be reviewed and finalized with a qualified attorney and a licensed insurance broker before reliance. Nothing here creates an attorney-client relationship.

---

## Documents

| Document | Description |
|----------|-------------|
| [00-blueprint-and-roadmap.md](00-blueprint-and-roadmap.md) | Master roadmap and executive action plan — the prioritized, tiered (Low/Medium/Long-term effort × High/Medium/Low protection) sequence of every protection across the suite, plus the highest-leverage moves. Start here. |
| [01-corporate-protections.md](01-corporate-protections.md) | Entity formation and corporate hygiene — LLC as contracting party/payee/IP owner/insured, formation state, EIN, business banking, Stripe re-titling, operating agreement, registered agent, DBA/naming reconciliation, veil-preservation. |
| [02-legal-agreements.md](02-legal-agreements.md) | The legal-document suite — clickwrap EULA/ToS with liability cap, warranty disclaimer (AS IS), AI-output disclaimer, provider/sub-processor addendum, BYO-API-key billing clause, indemnification, termination, survival, IP hooks. |
| [03-ip-and-oss-compliance.md](03-ip-and-oss-compliance.md) | IP and open-source license compliance — counsel-routed GPL ffmpeg decision, OSS intake/allowlist policy, MPL-2.0 source-availability duty, NOTICE/attribution, first-party license-of-record metadata, model-weights and native-binary provenance. |
| [04-documentation-protections.md](04-documentation-protections.md) | Documentation and recordkeeping — licensing decision records, marketing-claims substantiation log, accurate versioned sub-processor disclosure, pricing record, control-ownership register, audit-finding status register, canonical document register. |
| [05-policy-suite.md](05-policy-suite.md) | Public and internal policies — Acceptable Use Policy, marketing-claims substantiation policy, recording/consent policy, vulnerability-disclosure policy (SECURITY.md), access-control policy, OSS intake policy. |
| [06-operational-protections.md](06-operational-protections.md) | Operational controls and runbooks — DSAR (deletion/export) handling SOP and ledger, release checklist with prod-matches-repo gate, MFA on all admin accounts, Supabase email-confirmation re-check, comp-access register, credential custody, operational cadence. |
| [07-insurance.md](07-insurance.md) | Risk transfer — Tech E&O + Cyber + Media liability program bound in the entity's name, binding conditions (MFA), and honest disclosure of known matters (GPL ffmpeg, on-device contradiction) to avoid rescission. |
| [08-governance-controls.md](08-governance-controls.md) | Governance and accountability — tier-definition and owner-bypass decision records, privileged-access register, standing-controls register, ADR-style decision log, audit-finding status register, governing-law/venue, monthly risk review. |
| [09-user-responsibility-controls.md](09-user-responsibility-controls.md) | User-responsibility allocation — click-through acceptance with evidence retention, high-privilege agent/shell first-run consent gate, cloud-features consent gate, voice/two-party-consent acknowledgment, BYO-key spend responsibility. |

---

## How to use this Blueprint

1. Read `00-blueprint-and-roadmap.md` for the prioritized roadmap and the single highest-leverage moves.
2. Execute Tier 1 (High-protection, Low-effort) items first — most are founder-draftable and shippable before the next paid sale; the LLC sits at the head as the keystone that gates the liability cap, insurance, and IP license.
3. Route counsel-required and broker-required items (GPL ffmpeg, DeepSeek/China transfer, EULA/ToS/AUP, insurance disclosures) to licensed professionals.
4. Cross-reference each recommendation back to its source finding in [`docs/audit-v3/`](../audit-v3/).
