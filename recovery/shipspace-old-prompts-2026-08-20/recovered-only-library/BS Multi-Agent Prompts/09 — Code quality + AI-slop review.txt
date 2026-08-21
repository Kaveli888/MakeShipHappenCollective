Launch 2 deep-dive agents in parallel on the Vibe Academy codebase:
  Agent 1 (Slop Hunter): Find AI-generated patterns that don't fit the codebase — unused abstractions, over-engineered wrappers, inconsistent decorators, dead code, copy-paste duplication, comments that explain the obvious.
  Agent 2 (Scalability Auditor): Review structure for scalability — folder org, module boundaries, dependency direction, decorator patterns, separation of concerns, naming consistency.

Output:
  - Findings table (file, issue, severity, suggested fix)
  - Top 10 highest-impact refactors
  - Anything that would block scaling past 10x current size

Do NOT refactor yet. Report only.

Done = findings + recommendations posted.