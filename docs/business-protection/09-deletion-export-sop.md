# Deletion and Export SOP

Status: Internal operating procedure for privacy requests.

Request mailbox: privacy@makeshiphappen.tech

## Request Types

1. Access / copy of data.
2. Export / portability.
3. Correction.
4. Deletion.
5. Opt-out / restriction.
6. Account closure.

## Intake

1. Log request date.
2. Identify requester email/account.
3. Verify identity before disclosing or deleting data.
4. Classify jurisdiction if user provides it.
5. Acknowledge receipt within 7 days.
6. Target response within 30 days unless law or complexity requires extension.

## Systems to Check

1. Supabase account/profile/subscription/team records.
2. Stripe customer/subscription/payment metadata.
3. Printful merch/shipping records if merch was purchased.
4. Sentry/error logs if enabled.
5. Support email/helpdesk records.
6. Community/Discord records if tied to account.
7. Vercel/logging records where practical.
8. Product-specific cloud records.
9. Local-only data notice to user.

## Export Package

Provide JSON or CSV where practical:

1. Account profile.
2. Subscription tier/status.
3. Usage events held by MakeShipHappen.
4. Team membership records.
5. Support metadata where appropriate.
6. Product cloud data held by MakeShipHappen.

Do not export:

1. Other users' data.
2. Security-sensitive internals.
3. Vendor records outside MakeShipHappen control except by referral.
4. Data retained for legal/fraud/tax reasons if disclosure is restricted.

## Deletion Process

1. Confirm request and identity.
2. Cancel active subscription or direct user to cancellation path.
3. Delete or anonymize Supabase profile/account data where permitted.
4. Remove team membership records where permitted.
5. Remove usage events where not required for security/legal reasons.
6. Handle Stripe according to Stripe/legal retention limits.
7. Request or document Printful deletion where applicable.
8. Remove support records where not needed for legal/business defense.
9. Document retained exceptions.
10. Send completion notice.

## Local Data Notice

Account deletion does not delete files, transcripts, screenshots, audio, memory vaults, local databases, localStorage, API keys, or config files stored on the user's own device. The user must delete local app data from their own device. Product docs should provide app-specific local deletion instructions.

## Deletion Exceptions

Data may be retained where needed for:

1. Tax/accounting records.
2. Fraud prevention.
3. Security investigation.
4. Legal claims.
5. Chargebacks/disputes.
6. Contract enforcement.
7. Compliance obligations.

