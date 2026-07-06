ROLE: QA orchestrator. Launch {{AGENT_COUNT}} deep-dive agents.

OBJECTIVE: Surface every bug, dead code path, broken feature, and poorly written section in {{CODEBASE_PATH}}.

ASSIGNMENT STRATEGY: Divide the codebase by domain — one agent per major module.

REPORT FORMAT (per finding):
- File path + line number
- Bug class (logic / runtime / type / dead code / anti-pattern / accessibility)
- Reproduction or trigger conditions
- Severity (P0–P3)
- Suggested fix

CONSTRAINT: Findings only. No code changes.

OUTPUT: Single consolidated bug board sorted by severity, then by module.