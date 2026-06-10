# Role Email Forwarding Setup

Purpose: create business-facing inboxes that make MakeShipHappen look legitimate, route issues correctly, and preserve evidence for billing, legal, privacy, and security matters.

Decision locked:

- Role addresses may forward to the main email for now.
- Each role address should remain separate publicly, even if all mail lands in one inbox.
- Do not use a personal address on public policy pages once these are active.

## Current DNS Status

Checked June 7, 2026:

- `makeshiphappen.tech` nameservers are Cloudflare.
- MX records already point to Cloudflare Email Routing:
  - `route1.mx.cloudflare.net`
  - `route2.mx.cloudflare.net`
  - `route3.mx.cloudflare.net`
- SPF includes Cloudflare Email Routing: `v=spf1 include:_spf.mx.cloudflare.net ~all`

Status: DNS is ready for Cloudflare Email Routing. Screenshot-confirmed active routes exist for `support@`, `billing@`, `privacy@`, `security@`, `legal@`, and an additional `bugfix@` route. The remaining live step is sending test messages to confirm delivery into the destination inbox.

## Required Forwarders

Set these up at the domain email provider for `makeshiphappen.tech`:

| Address | Use | Forward destination |
| --- | --- | --- |
| `support@makeshiphappen.tech` | General help, product questions, access issues | Main inbox |
| `billing@makeshiphappen.tech` | Subscription, chargeback, payment, refund-policy questions | Main inbox |
| `privacy@makeshiphappen.tech` | Privacy requests, deletion/export requests, data questions | Main inbox |
| `security@makeshiphappen.tech` | Vulnerability reports, abuse, suspicious activity | Main inbox |
| `legal@makeshiphappen.tech` | Legal notices, contracts, attorney correspondence | Main inbox |

## Inbox Filters

Create labels or folders:

- MakeShipHappen / Support
- MakeShipHappen / Billing
- MakeShipHappen / Privacy
- MakeShipHappen / Security
- MakeShipHappen / Legal

Create rules so messages sent to each role address are automatically labeled.

## Response Targets

| Category | Target |
| --- | --- |
| Support | 2 business days |
| Billing | 2 business days |
| Privacy | Acknowledge within 5 business days |
| Security | Acknowledge within 2 business days |
| Legal | Review immediately; do not casually reply to formal notices |

## Evidence Rules

- Do not delete support, billing, legal, privacy, or security correspondence.
- Keep cancellation/refund/no-refund communications.
- Keep Stripe receipts, chargeback evidence, and account history.
- Keep privacy deletion/export request history, even after fulfilling the user request.
- Move threatening, legal, regulator, or attorney mail to the Legal label immediately.

## Public Copy Replacement

Use:

> For support, contact support@makeshiphappen.tech. For billing questions, contact billing@makeshiphappen.tech. Privacy requests should be sent to privacy@makeshiphappen.tech. Security reports should be sent to security@makeshiphappen.tech.

## Founder Checklist

- [x] Create all five forwarders.
- [x] Confirm each forwards to the main inbox.
- [ ] Send a test email to each role address.
- [ ] Confirm labels/filters apply correctly.
- [ ] Update Terms, Privacy, checkout, and footer contact references as needed.
- [ ] Save screenshots of provider forwarding settings for governance records.

## Cloudflare Dashboard Steps

1. Open Cloudflare.
2. Select `makeshiphappen.tech`.
3. Go to Email > Email Routing.
4. Confirm the destination inbox is verified.
5. Create a custom address for each required role address.
6. Set each route to forward to the verified destination inbox.
7. Send a test email to each role address.
8. Archive screenshots of the working routes.
