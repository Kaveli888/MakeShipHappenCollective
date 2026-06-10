# Incident Response Plan

Status: Internal SOP.

Security contact: security@makeshiphappen.tech
Privacy contact: privacy@makeshiphappen.tech

## Incident Types

1. Account or Supabase data exposure.
2. Stripe/billing abuse or webhook failure.
3. Provider API key exposure.
4. Local app updater/signing compromise.
5. Malicious package/release.
6. Unauthorized access to production systems.
7. User report of data leakage.
8. ShipWatch/capture privacy incident.
9. AI provider transmission contrary to policy.
10. Agent-caused destructive action report.
11. Security vulnerability report.
12. Public claim/privacy complaint.

## Severity

- Critical: active data exposure, credential compromise, payment compromise, malicious release, widespread user harm.
- High: likely sensitive data exposure or exploitable vulnerability.
- Medium: limited exposure, misuse, or policy violation.
- Low: suspected issue, no confirmed exposure.

## First 24 Hours

1. Open incident log.
2. Preserve evidence.
3. Identify affected products/users/systems.
4. Stop further exposure where operationally possible.
5. Rotate or revoke affected credentials if exposed.
6. Contact vendor support if vendor is involved.
7. Determine whether personal data is involved.
8. Determine whether user notification may be required.
9. Draft internal timeline.
10. Avoid speculative public statements.

## Investigation Checklist

1. What happened?
2. When did it start?
3. When was it discovered?
4. What data was involved?
5. How many users/accounts affected?
6. Which vendors involved?
7. Which logs/evidence support the conclusion?
8. Has the exposure stopped?
9. Are notifications required?
10. What follow-up controls are needed?

## Communication

1. User notice should be clear, factual, and timely.
2. Security reports should receive acknowledgement.
3. Regulators should be contacted only after legal review unless emergency law requires otherwise.
4. Vendors should be contacted through official support/security channels.
5. Public statements should not overpromise certainty before investigation.

## Postmortem

Complete within 10 business days:

1. Summary.
2. Root cause.
3. Timeline.
4. Impact.
5. User/vendor notifications.
6. Corrective actions.
7. Policy/docs updates.
8. Claims/register updates.

