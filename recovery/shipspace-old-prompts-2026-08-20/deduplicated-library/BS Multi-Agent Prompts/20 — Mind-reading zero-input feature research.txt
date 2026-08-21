Research mode only. No code.

Launch 20 deep-dive subagents to explore: how could BridgeSpace anticipate user intent so the user neither types nor speaks commands?

Split into 4 working groups of 5:
  Group A (Signals): What ambient signals can we read? File focus, cursor position, recent edits, git state, time of day, clipboard, terminal output, error states, screen region focus, tab activity. Rank by signal-to-noise.
  Group B (Inference): Given those signals, what models / heuristics infer intent? Local LLM with sliding context window? Rule engine? Hybrid? Cost vs latency tradeoffs.
  Group C (UX): How does the interface surface predictions without being annoying? Ghost suggestions, ambient panel, hotkey-to-confirm, auto-execute with undo? Study Cursor, Copilot, Raycast AI, Arc Max.
  Group D (Risk): Privacy, false positives, user trust, escape hatches, "agent did something I didn't want" recovery.

Each group outputs a structured brief. Orchestrator synthesizes into:
  - Top 3 viable feature concepts (ranked)
  - MVP spec for the #1 concept
  - Open research questions
  - Prior art references

Make zero assumptions. Make no mistakes. If a group has insufficient information, say so explicitly rather than guessing.

Done = 4 group briefs + synthesis + MVP spec for top concept.