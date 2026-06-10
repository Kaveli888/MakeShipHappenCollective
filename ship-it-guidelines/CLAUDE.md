# Ship It — Coding Guidelines

Guidelines for building ambitious software fast without being sloppy.
Tuned for creative vibe coding — take swings, move quick, don't break what works.

## 1. Read Before You Write

**Understand what exists before changing it.**

- Read the relevant code before proposing changes. Don't guess at architecture.
- When something is genuinely ambiguous or there are multiple directions with real tradeoffs, surface it briefly — don't stall with a checklist of questions.
- When the direction is clear, just build. Momentum matters.
- If a simpler approach exists, mention it — but don't refuse to build something ambitious.

## 2. Right-Sized Code

**Not minimum code. Not maximum code. The right amount for what this will become.**

- Don't bloat simple things — if 50 lines does it, don't write 200.
- But DO build real architecture when the system calls for it. Stores, parsers, engines — if the feature is growing, give it structure.
- No error handling for impossible scenarios. No premature config/flexibility.
- Abstractions earn their place by being used — don't create them speculatively, but don't fear them when they're clearly needed.

The test: "Does this code match the ambition of the feature?" A quick utility should be lean. A core system deserves real engineering.

## 3. Build Bold, Break Nothing

**Take creative swings on new features. Be precise on existing code.**

When building new features:
- Run with the vision. Add creative touches that elevate the feature.
- Propose ideas that go beyond the literal ask when they clearly serve the goal.

When editing existing code:
- Match existing style and patterns.
- Don't "improve" adjacent code or do drive-by refactors.
- Clean up only what YOUR changes made unused.
- If you spot something broken or dead elsewhere, mention it — don't silently change it.

When refactoring:
- Bold refactors are fine when they're the point. Just make sure things work after.
- Present the plan for major restructuring before executing.

## 4. Verify and Ship

**Make it work. Prove it works. Ship it.**

- After building, verify: run the dev server, check the build, test the feature.
- For bug fixes: reproduce first, then fix, then confirm it's gone.
- For multi-step work, state a brief plan so we stay aligned:
  ```
  1. [Step] → verify: [how]
  2. [Step] → verify: [how]
  ```
- Don't declare victory without checking. If you can't verify (e.g. no test suite, UI-only), say so explicitly.

## 5. Protect the Ship

**Speed means nothing if you break what already works.**

- Before major changes, understand what you're touching and what depends on it.
- Don't delete files, stores, or exports without checking for dependents.
- When in doubt about a destructive action, ask once — then move.
- Existing features are sacred until the user says otherwise.

---

**These guidelines are working if:** features ship fast, creative ideas land in the code,
existing features don't regress, and the codebase stays clean enough to keep building on.
