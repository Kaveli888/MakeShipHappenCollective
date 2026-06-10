# Product Claims Register

Status: Internal and public-copy governance tracker.

Purpose: every strong marketing, privacy, security, performance, pricing, or availability claim must have evidence, conditions, and an owner.

## Claim Review Rules

1. Absolute claims require absolute proof.
2. Prefer scoped claims over universal claims.
3. "Local-first" is safer than "never leaves your machine."
4. "Cloud providers are opt-in" must be true for the feature being described.
5. Performance claims need benchmark evidence.
6. Security claims need documented controls.
7. Privacy claims must match all modes, not just the best mode.
8. Comparative claims need substantiation and trademark care.
9. Product availability claims must match the product-status matrix.
10. Pricing claims must match Terms, checkout, and support policy.

## High-Risk Claims to Review

| Claim family | Risk | Safer framing |
|---|---|---|
| "100% on-device" | False/deceptive if any cloud mode exists | "Local mode processes on-device; cloud features are optional and provider-dependent." |
| "Never leaves your machine" | False if providers receive prompts/audio | "Your sources stay local unless you choose a cloud provider or feature that sends data externally." |
| "Zero telemetry" | False if usage/error events exist | "No content telemetry by default" or "limited operational telemetry, described in Privacy Policy." |
| "Zero hallucination" | Impossible guarantee | "Citation-grounded answers help you verify claims." |
| "Every answer cites its source" | Must hold across all providers/modes | "Citation support where source-grounding is available." |
| "No API calls" | Contradicted by cloud/provider features | "No API calls in local-only mode." |
| "Sub-second / <10ms" | Needs benchmarks and hardware conditions | "Designed for low-latency local capture; performance varies by device/model." |
| "Air-gapped" | Only true if no account/update/cloud features are used | "Can be used offline/local for supported workflows." |
| "Secure checkout" | Needs precise Stripe framing | "Payments processed by Stripe." |
| "Full audit log" | Needs implemented evidence | "Agent actions can be reviewed where audit logging is available." |
| "No destructive actions" | Risky for agent/terminal tools | "Destructive actions require user responsibility and review according to mode." |
| "Works in any app" | OS limitations/accessibility/security may apply | "Works across supported apps and OS environments." |

## Claim Entry Template

| Field | Value |
|---|---|
| Claim |  |
| Product/page |  |
| Exact wording |  |
| Evidence |  |
| Conditions/limits |  |
| Legal risk | Low / Medium / High / Critical |
| Owner |  |
| Review date |  |
| Approved wording |  |

