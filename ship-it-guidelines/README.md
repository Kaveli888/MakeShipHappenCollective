# Ship It — Claude Code Guidelines for Vibe Coders

> Inspired by [Andrej Karpathy's guidelines](https://github.com/forrestchang/andrej-karpathy-skills). Rebuilt for builders who ship.

## The Problem with Defensive Guidelines

Karpathy's guidelines (24k+ stars) solve a real problem: LLMs write bloated code, make hidden assumptions, and break things they don't understand. His fix? Make the AI cautious — ask questions first, write minimum code, touch only what you must, never go beyond what was asked.

**That works great for professional codebases where the goal is "don't break prod."**

But if you're vibe coding — building ambitious projects fast, iterating creatively, shipping features daily — those same guidelines become a straitjacket:

| Karpathy says | What actually happens |
|---|---|
| "Ask clarifying questions before implementing" | AI stalls with 5 questions instead of building |
| "No features beyond what was asked" | AI becomes a literal order-taker with zero creative input |
| "Minimum code that solves the problem" | Simple features get simple code, but growing systems get starved of architecture |
| "Touch only what you must" | Bold refactors that would improve the whole system never happen |

## Ship It: The Alternative

Ship It keeps what works — don't break existing features, verify your work, understand code before changing it — but replaces the defensive posture with a creative one.

### The 5 Principles

**1. Read Before You Write** — Understand what exists, but don't overthink it. Ask when genuinely ambiguous. When the direction is clear, just build.

**2. Right-Sized Code** — Not minimum. Not maximum. Match the code to the ambition of the feature. A utility should be lean. A core system deserves real architecture.

**3. Build Bold, Break Nothing** — Take creative swings on new features. Be surgical on existing code. These are different modes, not a single rule.

**4. Verify and Ship** — Make it work, prove it works, ship it. Don't declare victory without checking.

**5. Protect the Ship** — Speed means nothing if you break what already works. Existing features are sacred.

## Installation

### Option A: Global (all projects)

```bash
cp CLAUDE.md ~/.claude/CLAUDE.md
```

### Option B: Per-project

```bash
cp CLAUDE.md /path/to/your/project/CLAUDE.md
```

### Option C: One-liner

```bash
curl -sL https://raw.githubusercontent.com/MakeShipHappen/ship-it-guidelines/main/CLAUDE.md > ~/.claude/CLAUDE.md
```

## When to Use Which

| If you're... | Use |
|---|---|
| Vibe coding, building new products, shipping fast | **Ship It** |
| Maintaining a large production codebase | **Karpathy's guidelines** |
| Doing both | **Ship It** globally, Karpathy's per-project where needed |

## Side-by-Side Comparison

### On ambiguity

**Karpathy:** "If multiple interpretations exist, present them — don't pick silently."
**Ship It:** "When genuinely ambiguous, surface it briefly. When the direction is clear, just build."

### On code scope

**Karpathy:** "No features beyond what was asked. No abstractions for single-use code."
**Ship It:** "Propose ideas that elevate the feature. Abstractions earn their place by being used — don't fear them when clearly needed."

### On editing existing code

**Karpathy:** "Don't improve adjacent code. Every changed line should trace to the user's request."
**Ship It:** "Take creative swings on new features. Be precise on existing code." (Two different modes.)

### On ambition

**Karpathy:** "Would a senior engineer say this is overcomplicated? If yes, simplify."
**Ship It:** "Does this code match the ambition of the feature?"

## Credits

- Original concept: [Andrej Karpathy](https://x.com/karpathy) via [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills)
- Ship It adaptation: [MakeShipHappen](https://makeshiphappen.ai)

## License

MIT
