# Ship Memory

A **standalone, portable memory engine** for the Ship ecosystem. It's its own
product first, a ShipSpace feature second: a folder of markdown notes connected
by `[[wikilinks]]`, exposed through adapters (MCP today; REST + UI next) and fed
by connectors from third-party sources.

> Lineage: the 12-tool surface is modeled on BridgeSpace's `bridgememory`, which
> proved the format works. This is a clean-room reimplementation we **own** —
> no vendor runtime gating, no host-app coupling.

## Why it's built this way

```
              @ship-memory/core         ← the product (headless, owns the data)
              markdown vault · [[links]] · search · connector seam
                        │
        ┌───────────────┼───────────────────────────┐
   @ship-memory/mcp   (REST adapter)        (ShipSpace UI panel)
   AI clients          any app / mobile      native vault view
                        │
                  connectors  →  Obsidian · Notion · Drive · Gmail …
```

**The one rule:** nothing owns the memory except `core`. ShipSpace is just the
first client. Your next app is another client. Obsidian is another client (it
opens the same vault folder). Keep host-specific logic in the *adapter*, never
in core — the moment core imports anything that knows about ShipSpace, it stops
being a standalone product.

## Packages

| Package | What it is | Status |
|---|---|---|
| `@ship-memory/core` | Headless engine — vault store, frontmatter, `[[links]]`, backlinks, search, connector seam. Zero deps. | ✅ scaffolded |
| `@ship-memory/mcp` | Thin MCP server exposing the 12-tool surface to AI clients. | ✅ scaffolded |
| `@ship-memory/connector-obsidian` | Imports an Obsidian vault — notes, frontmatter, tags, normalized `[[links]]` — idempotently. | ✅ built |
| REST adapter | HTTP door for non-AI apps. Same core. | ⬜ next, build when a consumer needs it |
| more connectors | Notion, Drive, Gmail → notes via the same seam. | ⬜ seam defined |

## The data format (the contract)

A hub is a `.shipmemory/` directory. Each note is one `.md` file:

```markdown
---
title: Auth Architecture
type: project
tags: [security, decisions]
---

# Auth Architecture

We chose russh 0.46 because of CVE-2025-54804. See [[SSH Architecture]].
```

Plain files, human-editable, Obsidian-compatible. No database, no lock-in.

## Tool surface (parity with bridgememory)

`hub_status` · `init_hub` · `list_memories` · `read_memory` · `search_memories`
· `find_backlinks` · `create_memory` · `append_to_memory` · `update_memory` ·
`delete_memory` · `suggest_connections` · `list_orphans`

## Build

```bash
cd ship-memory
npm install          # wires the workspace; links @ship-memory/core into mcp
npm run build        # tsc both packages
```

## Run the MCP server

```bash
SHIP_MEMORY_HUB=/path/to/project node packages/mcp/dist/index.js
```

Register it with any MCP client (Claude, ShipSpace agents):

```json
{
  "mcpServers": {
    "ship-memory": {
      "command": "node",
      "args": ["/abs/path/ship-memory/packages/mcp/dist/index.js"],
      "env": { "SHIP_MEMORY_HUB": "/abs/path/to/your/project" }
    }
  }
}
```

## Roadmap

1. ✅ Core engine + MCP adapter
2. ✅ Obsidian-vault connector (`@ship-memory/connector-obsidian`)
3. ⬜ REST adapter (when the first non-AI consumer lands)
4. ⬜ ShipSpace UI panel (native vault render + graph) over the same core
5. ⬜ Semantic ranker behind the existing `search` seam (optional)
6. ⬜ More connectors (Notion, Drive, Gmail) via the same seam
