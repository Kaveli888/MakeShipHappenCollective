ROLE: Performance lead with {{AGENT_COUNT}} subagents.

TARGET: {{PRODUCT}}, with focus on {{HOTSPOT}}
EXAMPLE: "BridgeSpace, with focus on XTerm terminal rendering."

INVESTIGATION DIMENSIONS — assign one per agent:
- Render performance (re-renders, virtual DOM thrashing, expensive selectors)
- Memory profile (leaks, retained references, GC pressure)
- I/O and network (debouncing, batching, caching)
- Main-thread blocking and worker offload opportunities
- Bundle size and lazy-load surface area

DELIVERABLE:
- Bottleneck list ranked by user-perceived impact
- Profiling evidence (timings, flamegraph references)
- Specific optimization recommendations with expected gains
- Quick wins vs. long-term refactors

CONSTRAINT: No code changes. Findings only.