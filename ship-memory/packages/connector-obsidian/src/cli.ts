#!/usr/bin/env node
/**
 * ship-memory-import-obsidian — one-shot vault import.
 *
 *   ship-memory-import-obsidian <vault> [hub] [--ignore=a,b] [--since=<iso>] [--index-names=_index,index]
 *
 *   <vault>        path to the Obsidian vault to read (read-only)
 *   [hub]          directory to create/use the .shipmemory hub in (default: cwd)
 *   --ignore       comma-separated extra directory names to skip
 *   --since        only import notes modified after this ISO date/time
 *   --index-names  filenames treated as folder notes (titled by their folder).
 *                  Default "_index,index". Pass "" to disable.
 *
 * Re-running is safe: notes are matched by source path and updated in place,
 * never duplicated.
 */

import { resolve } from "node:path";
import { ShipMemory, syncConnector } from "@ship-memory/core";
import { createObsidianConnector } from "./index.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const positionals = argv.filter((a) => !a.startsWith("--"));
  const flags = new Map<string, string>();
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, ...v] = a.slice(2).split("=");
      flags.set(k, v.join("="));
    }
  }

  const [vaultArg, hubArg] = positionals;
  if (!vaultArg) {
    console.error(
      "usage: ship-memory-import-obsidian <vault> [hub] [--ignore=a,b] [--since=<iso>] [--index-names=_index,index]",
    );
    process.exit(1);
  }

  const vaultPath = resolve(vaultArg);
  const hubDir = resolve(hubArg ?? process.cwd());
  const ignoreDirs = (flags.get("ignore") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Absent flag → connector default; explicit (even empty) flag → as given.
  const indexFilenames = flags.has("index-names")
    ? flags
        .get("index-names")!
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  let since: number | undefined;
  const sinceRaw = flags.get("since");
  if (sinceRaw) {
    const ms = Date.parse(sinceRaw);
    if (Number.isNaN(ms)) {
      console.error(`invalid --since value: ${sinceRaw}`);
      process.exit(1);
    }
    since = ms;
  }

  const mem = ShipMemory.create(hubDir); // ensure the hub exists
  const connector = createObsidianConnector({
    vaultPath,
    ignoreDirs,
    indexFilenames,
  });

  console.error(`Importing ${vaultPath}\n          → ${mem.root}`);
  const report = await syncConnector(mem, connector, { since });

  console.log(
    JSON.stringify(
      {
        ...report,
        hub: mem.root,
        total: ShipMemory.status(hubDir).count,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("import failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
