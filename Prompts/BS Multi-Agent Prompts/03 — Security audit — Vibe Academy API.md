Working dir: vibe-academy-api

Use the Bridge Security skill. Launch 5 parallel deep-dive subagents with distinct attack-surface mandates:

  Agent 1 (Auth + Sessions): Login, signup, password reset, JWT/session config, token expiry, refresh flow, password hashing, OAuth scopes, MFA gaps.
  Agent 2 (AuthZ + IDOR): Permission checks on every endpoint, object-level authorization, tenant isolation, role escalation paths, missing ownership checks.
  Agent 3 (Input + Injection): SQLi, NoSQLi, XSS, SSRF, command injection, path traversal, prototype pollution, deserialization, file upload abuse.
  Agent 4 (Infra + Secrets + Deps): .env handling, secrets in repo history (git log), CORS config, rate limiting, dependency CVEs (npm audit + Snyk-style review), exposed admin endpoints.
  Agent 5 (Business Logic + Abuse): Race conditions, time-of-check / time-of-use bugs, replay attacks, enumeration leaks (user existence via timing or messages), webhook signature validation, idempotency.

Output a single consolidated structured findings report:
  - Severity: Critical / High / Medium / Low / Info
  - File:line + endpoint
  - Description (what + why it's exploitable)
  - PoC sketch (1-2 lines, conceptual — don't actually exploit)
  - Recommended fix (concrete code direction, not just "validate input")
  - Effort (S/M/L)

Then a structured fix plan:
  - Fix order (Critical → High → Medium, with dependencies between fixes called out)
  - What ships in this PR vs. follow-ups
  - Anything requiring infra/config changes outside the codebase

Hard rules:
  - Do NOT auto-fix. Audit + plan only this round.
  - Scrub any actual secrets you find from your output (e.g. show "AWS_KEY=AKIA****" not the real value).
  - If you find something requiring immediate action (live secret in repo, public admin endpoint), surface it at the TOP of the report flagged 🚨 IMMEDIATE.

Done = consolidated severity-sorted report + fix plan + immediate items flagged + waiting on my approval before any changes.