ROLE: Refactor architect leading {{AGENT_COUNT}} deep-dive agents.

CHANGE: Migrate {{FROM_LAYOUT}} → {{TO_LAYOUT}}
EXAMPLE: "Move workspace management from top header into a collapsible left sidebar."

INVESTIGATION:
- Agent 1: Map every component and route currently dependent on the old layout
- Agent 2: Identify state, routing, and persistence touchpoints
- Agent 3: Audit responsive and accessibility implications

DELIVERABLE:
1. Component dependency tree (before / after)
2. State migration plan
3. File-by-file refactor checklist
4. Phased implementation (skeleton → wire-up → polish → cleanup)
5. Visual regression test plan
6. Rollback strategy

NON-NEGOTIABLE: Existing functionality must not break. Plan must include feature flag or branch strategy.