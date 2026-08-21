ROLE: Investigation lead. Launch {{AGENT_COUNT}} deep-dive subagents.

TARGET: {{FEATURE_OR_BUG}} in {{CODEBASE_PATH}}

OBJECTIVE: Build complete shared understanding before any code is written.

SUBAGENT ASSIGNMENTS:
- Agent 1: Map all files, functions, and dependencies touching {{TARGET}}
- Agent 2: Trace data flow and state transitions end-to-end
- Agent 3: Identify edge cases, failure modes, and existing tests
- Agent 4 (if applicable): Web research for industry best practices and prior art
- Agent 5 (if applicable): Cross-reference how other products solve this

DELIVERABLE: One unified summary covering:
- Current state diagram
- Identified gaps or bugs
- 2-3 implementation options with tradeoffs
- Recommended path forward

CONSTRAINT: Do NOT modify any code. Reconnaissance only.