ROLE: AI integration architect.

FEATURE: {{ONE_LINE_DESCRIPTION}}
EXAMPLE: "Auto-generate contextual titles for terminals based on the prompt the user submits."

INVESTIGATION:
- Agent 1: Audit {{API_NAME}} for existing AI/LLM endpoints and OpenRouter wiring
- Agent 2: Identify the trigger point in the UI and the data available at that moment
- Agent 3: Propose model selection (cost/latency/quality tradeoff)

DELIVERABLE:
- Endpoint contract (request/response schema)
- Trigger logic (when, debounced or not, fallback if model fails)
- Cost projection at expected usage
- Caching strategy
- Implementation plan, file by file