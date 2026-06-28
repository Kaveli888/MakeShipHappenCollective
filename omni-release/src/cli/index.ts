#!/usr/bin/env node
/**
 * omni-release CLI.
 *
 * Thin command router over the orchestrator (`src/runs`) and the supporting
 * modules. SAFE BY DEFAULT: runs queue posts (nothing live) unless `--mode live`
 * is passed and a publisher is configured.
 *
 * Commands:
 *   run-lane --lane <id> [--mode queue|live] [--dry-run] [--platforms x,linkedin]
 *                        [--skip-proof] [--strict]
 *   run-all  [same flags]
 *   dry-run  [--lane <id>]      alias for run-lane --dry-run (default lane: evening-battle-card)
 *   research --lane <id>        research stage only (prints ranked items)
 *   queue                       list ready-to-post packages
 *   log:latest [--n N]          show the last N social-post-log entries
 *   health                      source registry + health summary
 *   lanes                       list configured lanes
 *   help
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  loadConfig,
  paths,
  ensureRuntimeDirs,
  createLogger,
  type Platform,
  type RunOptions,
} from "../core/index.js";
import { runLane, runAll } from "../runs/index.js";
import { researchLane, summarizeRegistry, SOURCE_REGISTRY } from "../research/index.js";

interface ParsedArgs {
  _: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      _.push(a);
    }
  }
  return { _, flags };
}

/** In JSON mode, keep stdout clean — route all log lines to stderr. */
function loggerFor(json: boolean) {
  return json
    ? createLogger({ sink: (_lvl, line) => process.stderr.write(`${line}\n`) })
    : createLogger();
}

function runOptionsFromFlags(flags: ParsedArgs["flags"]): Partial<RunOptions> {
  const opts: Partial<RunOptions> = {};
  if (flags.mode === "live" || flags.mode === "queue") opts.mode = flags.mode;
  if (flags["dry-run"]) opts.dryRun = true;
  if (flags["skip-proof"]) opts.skipProofImage = true;
  if (flags.strict) opts.strict = true;
  if (typeof flags.platforms === "string") {
    opts.platforms = flags.platforms.split(",").map((p) => p.trim()).filter(Boolean) as Platform[];
  }
  return opts;
}

function printRunResult(r: Awaited<ReturnType<typeof runLane>>): void {
  const icon = r.status === "ok" ? "✓" : r.status === "blocked" ? "⊘" : "✗";
  console.log(`\n${icon} ${r.laneId} [${r.status}] — ${r.summary}`);
  for (const s of r.stages) {
    const si = s.status === "ok" ? "·" : s.status === "skipped" ? "–" : s.status === "blocked" ? "⊘" : "✗";
    console.log(`   ${si} ${s.stage.padEnd(16)} ${s.status.padEnd(8)} ${s.durationMs}ms${s.error ? ` — ${s.error}` : ""}`);
    if (s.notes?.length) for (const n of s.notes) console.log(`       • ${n}`);
  }
}

async function cmdRunLane(args: ParsedArgs): Promise<number> {
  const laneId = (args.flags.lane as string) || args._[1];
  if (!laneId) {
    console.error("run-lane requires --lane <id>. Try: omni lanes");
    return 1;
  }
  ensureRuntimeDirs();
  const cfg = loadConfig();
  const json = Boolean(args.flags.json);
  const r = await runLane({
    laneId,
    options: runOptionsFromFlags(args.flags),
    cfg,
    logger: loggerFor(json),
  });
  if (json) console.log(JSON.stringify(r));
  else printRunResult(r);
  return r.status === "failed" ? 1 : 0;
}

async function cmdRunAll(args: ParsedArgs): Promise<number> {
  ensureRuntimeDirs();
  const cfg = loadConfig();
  const res = await runAll({
    options: runOptionsFromFlags(args.flags),
    cfg,
    logger: loggerFor(Boolean(args.flags.json)),
  });
  if (args.flags.json) {
    console.log(JSON.stringify(res));
  } else {
    for (const r of res.lanes) printRunResult(r);
    console.log(`\n${res.ok ? "✓" : "✗"} run-all: ${res.lanes.length} lane(s), ok=${res.ok}`);
  }
  return res.ok ? 0 : 1;
}

async function cmdDryRun(args: ParsedArgs): Promise<number> {
  const laneId = (args.flags.lane as string) || args._[1] || "evening-battle-card";
  return cmdRunLane({ _: ["run-lane", laneId], flags: { ...args.flags, lane: laneId, "dry-run": true } });
}

async function cmdResearch(args: ParsedArgs): Promise<number> {
  const laneId = (args.flags.lane as string) || args._[1];
  const cfg = loadConfig();
  const lane = laneId ? cfg.lanes.find((l) => l.id === laneId) : undefined;
  const res = await researchLane(
    laneId ?? "ad-hoc",
    {
      categories: lane?.sourceCategories,
      keywords: lane?.keywords,
      maxTotalItems: cfg.maxResearchItems,
      timeoutMs: cfg.fetchTimeoutMs,
    },
    { dataDir: paths.data },
  );
  if (args.flags.json) {
    console.log(JSON.stringify(res));
    return 0;
  }
  console.log(`\nResearch: ${res.items.length} items from ${res.stats.sourcesOk}/${res.stats.sourcesAttempted} sources (${res.stats.sourcesFailed} failed, ${res.stats.sourcesSkipped} skipped)\n`);
  for (const [i, it] of res.items.slice(0, 15).entries()) {
    console.log(`${String(i + 1).padStart(2)}. [${it.score}] ${it.title}`);
    console.log(`    ${it.sourceName} — ${it.url}`);
  }
  if (res.notes.length) console.log(`\nNotes:\n${res.notes.map((n) => `  • ${n}`).join("\n")}`);
  return 0;
}

async function cmdQueue(args: ParsedArgs): Promise<number> {
  const dir = join(paths.root, "ready-to-post");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort().reverse();
  } catch {
    files = [];
  }
  const items: Array<{ file: string; path: string; topic: string; lane: string; createdAt: string }> = [];
  for (const f of files) {
    const text = await readFile(join(dir, f), "utf8");
    items.push({
      file: f,
      path: join(dir, f),
      topic: /\*\*Topic:\*\* (.+)/.exec(text)?.[1] ?? "",
      lane: /\*\*Lane:\*\* (.+)/.exec(text)?.[1] ?? "",
      createdAt: /\*\*Date\/time:\*\* (.+)/.exec(text)?.[1] ?? "",
    });
  }
  if (args.flags.json) {
    console.log(JSON.stringify(items));
    return 0;
  }
  if (!items.length) {
    console.log("No ready-to-post packages yet.");
    return 0;
  }
  console.log(`\nReady-to-post packages (${items.length}) in ${dir}:\n`);
  for (const it of items) console.log(`  • ${it.file}${it.topic ? `  — ${it.topic}` : ""}`);
  return 0;
}

async function cmdLogLatest(args: ParsedArgs): Promise<number> {
  const n = Number(args.flags.n ?? 5) || 5;
  const path = join(paths.root, "social-post-log.jsonl");
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    console.log("No social-post-log.jsonl yet.");
    return 0;
  }
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const tail = lines.slice(-n);
  if (args.flags.json) {
    const entries = tail
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
    console.log(JSON.stringify(entries));
    return 0;
  }
  console.log(`\nLast ${tail.length} log entries (${path}):\n`);
  for (const line of tail) {
    try {
      const e = JSON.parse(line);
      console.log(`  ${e.loggedAt}  ${e.lane}/${e.platform}  [${e.status}]${e.dryRun ? " (dry)" : ""}  ${e.topic ?? ""}`);
    } catch {
      // skip
    }
  }
  return 0;
}

async function cmdHealth(args: ParsedArgs): Promise<number> {
  const summary = summarizeRegistry(SOURCE_REGISTRY);
  if (args.flags.json) {
    let health: unknown = null;
    try {
      health = JSON.parse(await readFile(join(paths.data, "research", "source-health.json"), "utf8"));
    } catch {
      // none yet
    }
    console.log(JSON.stringify({ registry: summary, health }));
    return 0;
  }
  console.log(`\nSource registry: ${summary.enabled}/${summary.total} enabled\n`);
  for (const [cat, c] of Object.entries(summary.categories)) {
    console.log(`  ${cat.padEnd(12)} ${c.enabled}/${c.total} enabled`);
  }
  const healthFile = join(paths.data, "research", "source-health.json");
  try {
    const raw = await readFile(healthFile, "utf8");
    const data = JSON.parse(raw);
    const records = Object.values(data.records ?? {}) as Array<{ sourceId: string; status: string; lastItemCount: number }>;
    console.log(`\nHealth (last run, ${healthFile}):`);
    for (const r of records.sort((a, b) => a.sourceId.localeCompare(b.sourceId))) {
      console.log(`  ${r.status.padEnd(9)} ${r.sourceId} (${r.lastItemCount} items)`);
    }
  } catch {
    console.log("\nNo source-health snapshot yet (run a lane or `omni research` first).");
  }
  return 0;
}

function cmdLanes(args: ParsedArgs): number {
  const cfg = loadConfig();
  if (args.flags.json) {
    console.log(JSON.stringify(cfg.lanes));
    return 0;
  }
  console.log("\nConfigured lanes:\n");
  for (const l of cfg.lanes) {
    console.log(`  ${l.enabled ? "●" : "○"} ${l.id.padEnd(20)} ${l.name}`);
    console.log(`      ${l.cadence ?? ""} → ${l.platforms.join(", ")}`);
  }
  return 0;
}

function help(): number {
  console.log(`omni-release — AI-news → social-content release engine

Usage: omni <command> [flags]

Commands:
  run-lane --lane <id>     Run one lane end-to-end (default mode: queue, no live posting)
  run-all                  Run every enabled lane
  dry-run [--lane <id>]    Full pipeline, never posts live (default lane: evening-battle-card)
  research --lane <id>     Research stage only (prints ranked items)
  queue                    List ready-to-post packages
  log:latest [--n N]       Show the last N social-post-log entries
  health                   Source registry + health summary
  lanes                    List configured lanes
  help

Flags (run-lane / run-all / dry-run):
  --mode queue|live        queue (default, safe) or live (requires creds/session)
  --dry-run                Never publish live; still writes proof + ready-to-post + log
  --platforms x,linkedin   Restrict to a subset of platforms
  --skip-proof             Skip proof image rendering
  --strict                 Treat quality-gate warnings as blocking

Lanes: ai-daily-shift (morning) · model-watch (afternoon) · evening-battle-card (evening)
`);
  return 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const cmd = args._[0] ?? "help";
  switch (cmd) {
    case "run-lane":
      return cmdRunLane(args);
    case "run-all":
      return cmdRunAll(args);
    case "dry-run":
      return cmdDryRun(args);
    case "research":
      return cmdResearch(args);
    case "queue":
      return cmdQueue(args);
    case "log:latest":
    case "log-latest":
      return cmdLogLatest(args);
    case "health":
      return cmdHealth(args);
    case "lanes":
      return cmdLanes(args);
    case "help":
    case "--help":
    case "-h":
      return help();
    default:
      console.error(`Unknown command: ${cmd}\n`);
      help();
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e instanceof Error ? e.stack ?? e.message : String(e));
    process.exit(1);
  });
