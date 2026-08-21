Working dir: vibe-academy-api

Launch 3 parallel deep-dive security agents:
  Agent 1 (Auth & Sessions): Audit auth flows, session handling, JWT/cookie config, password handling, OAuth scopes.
  Agent 2 (Input & Injection): Audit all user input paths — SQLi, NoSQLi, XSS, SSRF, path traversal, deserialization, command injection.
  Agent 3 (Infra & Secrets): Audit env var handling, secrets in repo, CORS, rate limiting, dependency CVEs, exposed endpoints.

Output a single consolidated report:
  - Severity (Critical / High / Medium / Low)
  - File + line
  - Description
  - Recommended fix
  - Effort estimate

Do NOT fix anything yet. Audit only.

Done = consolidated report delivered + sorted by severity.