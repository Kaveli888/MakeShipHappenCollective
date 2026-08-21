Prompt all 6 open Claude Code agents simultaneously. Each should:
  1. Use the Bridge Security Skill.
  2. Audit the BridgeMind API.
  3. Output findings in this exact format:
     - Agent ID
     - Severity (Critical/High/Medium/Low)
     - File:line
     - Issue
     - Fix recommendation

Assign distinct focus areas so they don't duplicate work:
  Agent 1: Auth + sessions
  Agent 2: Input validation + injection
  Agent 3: Authorization + IDOR
  Agent 4: Secrets + config + env
  Agent 5: Dependencies + supply chain
  Agent 6: Rate limiting + DoS + abuse

After all 6 return, you (orchestrator) consolidate into a single deduped, severity-sorted report.

Done = 6 agents reported + consolidated report delivered.