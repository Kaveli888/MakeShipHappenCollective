# @ship-memory/connector-obsidian

Imports an existing **Obsidian vault** into a Ship Memory hub. First connector,
and the cheapest: Obsidian already stores markdown + `[[wikilinks]]`, so the job
is mostly *normalization* so the imported graph still resolves.

The vault is **read-only** — nothing in your Obsidian vault is modified.

## CLI

```bash
ship-memory-import-obsidian <vault> [hub] [--ignore=a,b] [--since=<iso>]
```

| Arg | Meaning |
|---|---|
| `<vault>` | Path to the Obsidian vault to read |
| `[hub]` | Where to create/use the `.shipmemory` hub (default: cwd) |
| `--ignore` | Comma-separated extra directory names to skip (e.g. `_templates`) |
| `--since` | Only import notes modified after this ISO date/time |

Re-running is **idempotent**: notes are matched by their vault path
(`source: obsidian`, `sourceId: <relative path>`) and updated in place, never
duplicated.

```bash
# first import
ship-memory-import-obsidian ~/ShipVault ~/my-project --ignore=_templates
# later — only changed notes
ship-memory-import-obsidian ~/ShipVault ~/my-project --since=2026-06-01
```

## Programmatic

```ts
import { ShipMemory, syncConnector } from "@ship-memory/core";
import { createObsidianConnector } from "@ship-memory/connector-obsidian";

const mem = ShipMemory.create("/path/to/project");
const connector = createObsidianConnector({ vaultPath: "/path/to/vault" });
const report = await syncConnector(mem, connector); // { pulled, created, updated }
```

## What it normalizes

| Obsidian | Stored as | Why |
|---|---|---|
| `[[folder/Note]]` | `[[Note]]` | Ship Memory resolves links by slugified basename |
| `[[Note#Heading]]`, `[[Note#^block]]` | `[[Note]]` | heading/block refs would break resolution |
| `[[Note\|alias]]` | `[[Note\|alias]]` | alias preserved |
| `![[Note]]` (note embed) | `[[Note]]` | transclusion downgraded to a link |
| `![[image.png]]` (attachment) | unchanged | attachments are left intact |
| frontmatter `tags:` + inline `#tag` | merged `tags` | unified tag list |
| `.obsidian/`, `.trash/`, dotdirs | skipped | config/trash noise |
| `_index.md` / `index.md` (folder notes) | titled by parent folder | else every index note collapses to `_index` |

Frontmatter is preserved (aliases, custom fields). `title` comes from the
filename (Obsidian's identity) unless frontmatter sets one; `obsidianPath`,
`source`, and `sourceId` are stamped for traceability and re-sync.

## Folder notes (`_index.md`)

Vaults that use a per-folder `_index.md` (or `index.md`) convention would
otherwise produce many notes sharing the basename `_index`. Instead, an index
note is **titled by its parent folder** — `20_Projects/ShipMind/_index.md`
becomes "ShipMind" (slug `shipmind`), matching how Obsidian displays folder
notes. The vault-root index falls back to the vault folder's own name. Two
folders with the same name disambiguate at the slug level (`auth`, `auth-2`)
while staying distinct by `sourceId`.

Configure which filenames count via `indexFilenames` (default
`["_index", "index"]`) or the CLI `--index-names=` flag; pass `--index-names=`
(empty) to disable and keep raw stems.
