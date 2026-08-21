Launch 2 deep-dive verification agents in parallel:
  Agent 1 (Code Reviewer): Audit the MCP Servers page diff. Flag dead code, unused imports, inconsistent patterns vs. the rest of the codebase.
  Agent 2 (QA): Test the page in light mode, dark mode, with 0 servers, with 1 server, with many servers. Test keyboard nav and hover states.

If either agent finds an issue, fix it. Re-run until both report clean.

Done = both agents return zero findings + I see "✅ MCP Servers page complete — nothing left to do" as your final line.