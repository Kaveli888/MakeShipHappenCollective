# First Paid Customer Readiness

Status: operational launch checklist.

Purpose: confirm MakeShipHappen can accept the first clean paid customer under the locked founder-stage offer.

## Locked Offer

- Price: $50/month.
- Products included: ShipMind, ShipSpace, ShipTalk, ShipCode.
- Refund policy: no refunds.
- Entity posture: founder-operated / pre-LLC until revenue trigger.
- Product posture: actively evolving with frequent updates.

## Completed Technical Checks

Checked June 7, 2026:

- Stripe production price behind `STRIPE_PRICE_ID_PRO` is active.
- Stripe price is USD 5000 cents.
- Stripe price is recurring monthly.
- Hidden first-month promo behavior was removed from checkout code.
- Website production build passed.
- Production deploy completed and aliased to `https://makeshiphappen.tech`.
- Public pricing page shows $50/month, four products, and no-refund language.
- Live unauthenticated checkout request returns `401 Unauthorized`, preserving account-first checkout.
- Download pages route subscribers through gated download endpoints.
- Legacy `/download` page was aligned to the $50/month offer and gated ShipSpace download.

## Remaining Manual Checks

- [x] Confirm Cloudflare Email Routing custom aliases are active.
- [ ] Send test email to `support@makeshiphappen.tech`.
- [ ] Send test email to `billing@makeshiphappen.tech`.
- [ ] Send test email to `privacy@makeshiphappen.tech`.
- [ ] Send test email to `security@makeshiphappen.tech`.
- [ ] Send test email to `legal@makeshiphappen.tech`.
- [ ] Run one Stripe test-mode customer checkout if the production/test environment supports it.
- [ ] Confirm successful subscription updates Supabase profile/subscription records.
- [ ] Confirm subscribed user can download ShipMind.
- [ ] Confirm subscribed user can download ShipSpace.
- [ ] Confirm subscribed user can download ShipTalk.
- [ ] Confirm cancellation removes future billing and preserves no-refund policy language.

## Founder Support Script

Use this for first customer questions:

> MakeShipHappen access is currently $50/month and includes the current downloadable products: ShipMind, ShipSpace, ShipTalk, and ShipCode. The products are actively evolving and updated frequently. All sales are final and there are no refunds, so please review the product status before joining. You can cancel anytime to stop future renewals.

## Do Not Launch Yet

- Lifetime access.
- Enterprise/team claims.
- HIPAA/FERPA/SOC 2/GDPR certification claims.
- Refund windows.
- Security/privacy absolutes such as "never leaves your machine" or "zero telemetry" unless independently verified for that exact feature.
