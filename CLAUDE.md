# CLAUDE.md - MakeShipHappen Collective

Read `AGENTS.md` for durable Jake / MakeShipHappen context.

## Launch Command Rule

Use colon-delimited npm script names from the repo root. Do not recommend space-separated forms like `npm run shipspace dev`; npm treats the second word as an argument, not as part of the script name.

Clean root commands:

```sh
npm run shipspace:dev
npm run shiptalk:dev
npm run shipmind:dev
npm run shipmemory:app
```

Ship Memory also has:

```sh
npm run shipmemory:dev
npm run shipmemory:mcp
```

`shipmemory:app` opens the Tauri app. `shipmemory:dev` runs the core package dev workflow.

## ShipSpace Dev Launch

From the repo root, open ShipSpace with:

```sh
npm run shipspace:dev
```

Also valid:

```sh
npm run shipspace
npm run shipspace:detached
npm run shipspace:attached
```

Do not use `npm run shipspace dev` as the recommended command. npm treats `dev` as a trailing argument to the `shipspace` script, not as a script name. It may appear to work because the current launcher ignores that extra argument, but it is ambiguous and confusing.

ShipSpace lives at `ShipSpace/`. If already inside that directory, use:

```sh
npm run shipspace:dev
```

The default ShipSpace dev launcher is detached. It starts or reuses Vite on port `1420`, builds the Tauri debug binary, creates a temporary signed `ShipSpace Dev.app`, launches it, then exits so the terminal is free.

Useful diagnostics:

```sh
ps aux | grep -E 'ShipSpace Dev.app|ShipSpace/node_modules/.bin/vite' | grep -v grep
lsof -nP -iTCP:1420 -sTCP:LISTEN
tail -120 ShipSpace/.shipspace-dev.log
tail -120 ShipSpace/.shipspace-vite.log
```

To force a clean relaunch:

```sh
SHIPSPACE_FORCE_RELAUNCH=1 npm run shipspace:dev
```

To stop the detached app:

```sh
pkill -f "ShipSpace Dev.app"
```

When scanning source, exclude `node_modules/` and `ShipSpace/.claude/worktrees/`; those copied worktrees and assets can mislead broad searches.
