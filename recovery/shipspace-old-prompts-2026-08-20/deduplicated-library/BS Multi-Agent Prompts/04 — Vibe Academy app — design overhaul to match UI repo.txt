Working dirs: vibe-academy-ui (source of truth), vibe-academy-app (target)

Goal: bring the Vibe Academy app's design fully in line with the design system and aesthetic of vibe-academy-ui. Use the front-end design plugin.

Phase 1 — Audit (parallel, 4 agents):
  Agent 1: Read vibe-academy-ui/design.md (or design-system.md, DESIGN.md — find it). Extract every token, rule, and principle into a checklist.
  Agent 2: Inventory vibe-academy-ui's component library, typography pairings, spacing scale, color tokens, motion patterns.
  Agent 3: Inventory every page/screen in vibe-academy-app. Screenshot each one (current state).
  Agent 4: Diff: for each app screen, what specifically diverges from the UI design system? Output a per-screen gap list.

Pause here. Show me:
  - The extracted design rules
  - Per-screen current screenshots
  - The gap list

Wait for my approval before Phase 2.

Phase 2 — Implement (6 agents in parallel, each owns 2-3 screens):
  Distribute the app's screens across 6 agents. Each agent:
    - Updates that screen to use the shared design system
    - Reuses components from vibe-academy-ui where they exist; ports them when missing
    - Keeps the screen's existing functionality 1:1 (no behavior changes in this pass)
    - Captures before/after screenshots
    - Commits with message: "design: align <screen-name> with UI system"

Phase 3 — Reconciliation (you, the orchestrator):
  - Verify visual consistency across all screens (sidebar, navbar, modals, toasts should be identical)
  - Catch one-offs that should be promoted to shared components
  - Final visual QA pass: spacing, typography hierarchy, color usage, dark mode parity

Hard rules:
  - Do NOT change any behavior, routing, data flow, or state management. Design only.
  - Do NOT introduce new colors or new font families. Use existing tokens.
  - If a screen needs a component that doesn't exist in the UI repo, propose it but don't build it without my sign-off.
  - One screen = one commit. No mega-commits.

Done = Phase 1 audit delivered → my approval → Phase 2 commits per screen → Phase 3 reconciliation summary + before/after gallery.