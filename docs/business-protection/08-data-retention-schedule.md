# Data Retention Schedule

Status: Internal baseline for attorney review.

Purpose: define how long MakeShipHappen intends to retain different data classes and where local-only user responsibility begins.

| Data class | Location | Baseline retention | Deletion path | Notes |
|---|---|---|---|---|
| Account email/profile | Supabase | Active account + 90 days after deletion request | Account deletion SOP | Retain if legally required. |
| Auth/session metadata | Supabase/local app storage | Session lifetime / until sign-out or local deletion | Sign out, local app data deletion | Local sessions may persist after cloud account deletion. |
| Billing records | Stripe/Supabase | 7 years or legally required period | Deletion exception | Tax/accounting/fraud records may be retained. |
| Subscription status | Supabase/Stripe | Active account + billing retention | Account deletion + Stripe handling | Keep minimal audit trail if required. |
| Support emails | Email/helpdesk | 3 years by default | Support deletion request where practical | Keep longer for legal disputes. |
| Security reports | Email/internal tracker | 5 years | Internal archival | Preserve evidence. |
| Usage events | Supabase/Sentry/logs | 12-24 months unless aggregated sooner | Deletion/export SOP | Minimize content in logs. |
| Crash/error logs | Sentry/logs | 30-180 days | Vendor dashboard | Avoid personal data where possible. |
| AI prompts/outputs through hosted web routes | Provider/server logs depending provider | Provider-specific | Provider-specific + account deletion where possible | Disclose provider retention. |
| BYO provider prompts/outputs | Third-party provider selected by user | Provider-specific | User's provider account | User responsibility. |
| Local documents/sources | User device | Until user deletes | Local deletion | Platform cannot delete local-only files remotely. |
| Local transcripts/audio | User device | Until user deletes or retention setting applies | Local deletion | Product docs must identify storage. |
| ShipWatch screenshots/audio/OCR/clipboard | User device | User-configured; recommend short default | Clear memories/local deletion | Very high sensitivity. |
| Ship Memory vault | User device | Until user deletes | Delete `.shipmemory` vault | Plain markdown files. |
| Stripe local token in Ship AOS | User device | Until disconnect/delete local config | Disconnect Stripe/delete config | Treat as high sensitivity. |
| Merch/shipping data | Stripe/Printful | Order fulfillment + tax/support retention | Vendor request where available | Printful is subprocessor. |

## Retention Principles

1. Retain the minimum needed to operate, support, secure, and comply.
2. Do not promise deletion of data that is local-only, provider-controlled, legally retained, or outside the platform's control.
3. Distinguish account deletion from local app data deletion.
4. Distinguish MakeShipHappen-hosted providers from BYO provider accounts.
5. Keep billing/tax exceptions explicit.

