ROLE: Compatibility investigator with {{AGENT_COUNT}} subagents.

ISSUE: {{FEATURE}} works on {{PLATFORM_A}} but fails on {{PLATFORM_B}}
EXAMPLE: "Jarvis terminal launching works on macOS but fails on Windows."

INVESTIGATION:
- Agent 1: Audit platform-specific code paths (path handling, shell, permissions, IPC)
- Agent 2: Review process spawning, env var handling, and binary resolution
- Agent 3: Reproduce the failure and capture exact error surface

DELIVERABLE:
- Root cause statement
- Platform-specific fix plan
- Regression checklist for both platforms
- CI test recommendation to prevent recurrence