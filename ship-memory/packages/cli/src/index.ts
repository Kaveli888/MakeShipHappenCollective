#!/usr/bin/env node

import {
  lstat,
  mkdir,
  readlink,
  realpath,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import {
  MemoryNotFoundError,
  ShipMemory,
  serializeFrontmatter,
  slugify,
} from "@ship-memory/core";
import { nodeFs } from "@ship-memory/core/node";

interface ConnectOptions {
  projectDir: string;
  projectName: string;
  storeRoot: string;
  attachExisting: boolean;
  dryRun: boolean;
}

async function main(): Promise<void> {
  const [command = "help", ...args] = process.argv.slice(2);
  if (command === "connect") {
    await connect(parseConnectArgs(args));
    return;
  }
  if (command === "context") {
    await printContext(parseContextArgs(args));
    return;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  throw new Error(`Unknown command: ${command}. Run 'ship-memory help'.`);
}

function parseConnectArgs(args: string[]): ConnectOptions {
  let projectDir = process.cwd();
  let projectName: string | undefined;
  let storeRoot =
    process.env.SHIP_MEMORY_PROJECTS_DIR ?? join(homedir(), "ShipMemory", "projects");
  let attachExisting = false;
  let dryRun = false;
  let positionalSeen = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--name") projectName = requiredValue(args, ++i, "--name");
    else if (arg === "--store") storeRoot = requiredValue(args, ++i, "--store");
    else if (arg === "--attach-existing") attachExisting = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else if (!positionalSeen) {
      projectDir = arg;
      positionalSeen = true;
    } else throw new Error(`Unexpected argument: ${arg}`);
  }

  const resolvedProject = resolve(projectDir);
  const name = (projectName ?? basename(resolvedProject)).trim();
  validateProjectName(name);
  return {
    projectDir: resolvedProject,
    projectName: name,
    storeRoot: resolve(storeRoot),
    attachExisting,
    dryRun,
  };
}

async function connect(options: ConnectOptions): Promise<void> {
  const projectDir = await realpath(options.projectDir);
  if (!(await stat(projectDir)).isDirectory()) {
    throw new Error(`Project path is not a directory: ${projectDir}`);
  }

  const storeRoot = options.storeRoot;
  if (isWithin(storeRoot, projectDir)) {
    throw new Error("The project directory cannot be inside the Ship Memory project store.");
  }

  const projectSlug = slugify(options.projectName);
  if (!projectSlug) throw new Error("Project name must contain letters or numbers.");
  const projectStore = resolve(storeRoot, projectSlug);
  if (!isWithin(storeRoot, projectStore)) {
    throw new Error("Resolved project store escaped the configured storage root.");
  }

  const hub = join(projectStore, ".shipmemory");
  const link = join(projectDir, ".shipmemory");
  const existingLink = await pathKind(link);
  if (existingLink) {
    if (existingLink === "symlink") {
      const current = resolve(projectDir, await readlink(link));
      if (current === hub) {
        console.log(`Already connected: ${projectDir}\nShip Memory hub: ${hub}`);
        return;
      }
    }
    throw new Error(
      `Refusing to replace existing ${link}. No files were changed.`,
    );
  }

  const existingHub = await pathKind(hub);
  if (existingHub && !options.attachExisting) {
    throw new Error(
      `A project memory already exists at ${hub}. Use --attach-existing only after confirming it belongs to this project.`,
    );
  }
  if (existingHub && existingHub !== "directory") {
    throw new Error(`Expected a directory at ${hub}; found ${existingHub}.`);
  }

  if (options.dryRun) {
    console.log(
      [
        "Dry run — no files changed.",
        `Project: ${projectDir}`,
        `Create hub: ${hub}`,
        `Create connection: ${link} -> ${hub}`,
      ].join("\n"),
    );
    return;
  }

  await mkdir(hub, { recursive: true });
  await createIndexIfMissing(hub, options.projectName, projectSlug);
  await symlink(hub, link, "dir");
  console.log(
    [
      `Connected ${options.projectName} to Ship Memory.`,
      `Project: ${projectDir}`,
      `Hub: ${hub}`,
      `Entry context: ${join(hub, "index.md")}`,
    ].join("\n"),
  );
}

async function createIndexIfMissing(
  hub: string,
  projectName: string,
  projectSlug: string,
): Promise<void> {
  const indexPath = join(hub, "index.md");
  if (await pathKind(indexPath)) return;
  const today = new Date().toISOString().slice(0, 10);
  const frontmatter = {
    title: `${projectName} Project Context`,
    type: "project-context",
    project: projectSlug,
    status: "draft",
    created: today,
    updated: today,
  };
  const body = `# ${projectName} Project Context

## Purpose

Describe what this project is and who it serves.

## Current State

Record what exists today and what is actively being built.

## Decisions and Constraints

Record durable choices, safety boundaries, and requirements that agents must preserve.

## Next Steps

Record the next concrete priorities.

## Related Memory

Add [[wikilinks]] to deeper reviewed notes as the project grows.
`;
  await writeFile(indexPath, serializeFrontmatter(frontmatter, body), {
    encoding: "utf8",
    flag: "wx",
  });
}

function parseContextArgs(args: string[]): { cwd: string; json: boolean } {
  let cwd = process.cwd();
  let json = false;
  let positionalSeen = false;
  for (const arg of args) {
    if (arg === "--json") json = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else if (!positionalSeen) {
      cwd = arg;
      positionalSeen = true;
    } else throw new Error(`Unexpected argument: ${arg}`);
  }
  return { cwd: resolve(cwd), json };
}

async function printContext(options: { cwd: string; json: boolean }): Promise<void> {
  const memory = await ShipMemory.open(options.cwd, nodeFs);
  let entry;
  try {
    entry = await memory.read("index");
  } catch (error) {
    if (error instanceof MemoryNotFoundError) {
      throw new Error(
        `Ship Memory is connected at ${memory.root}, but it has no index.md project briefing.`,
      );
    }
    throw error;
  }
  if (options.json) {
    console.log(JSON.stringify({ hub: memory.root, entry }, null, 2));
  } else {
    console.log(entry.body.trim());
  }
}

async function pathKind(
  path: string,
): Promise<"file" | "directory" | "symlink" | "other" | null> {
  try {
    const result = await lstat(path);
    if (result.isSymbolicLink()) return "symlink";
    if (result.isDirectory()) return "directory";
    if (result.isFile()) return "file";
    return "other";
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

function isWithin(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function requiredValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith("-")) throw new Error(`${option} requires a value.`);
  return value;
}

function validateProjectName(name: string): void {
  if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error("Project name must be 1–100 characters without control characters.");
  }
}

function printHelp(): void {
  console.log(`Ship Memory project context

Usage:
  ship-memory connect [project-directory] [--name NAME] [--store DIRECTORY]
                      [--attach-existing] [--dry-run]
  ship-memory context [directory] [--json]

The connect command is opt-in and additive. It never replaces an existing
.shipmemory path. New project hubs default to ~/ShipMemory/projects/<name>/.
Existing Ship Memory vaults are not migrated or modified.`);
}

main().catch((error) => {
  console.error(`ship-memory: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
