/**
 * omni-release — filesystem layout.
 *
 * Single source of truth for every directory the pipeline reads from or writes
 * to. Peers MUST resolve paths through here rather than hardcoding strings, so
 * the layout can move without breaking downstream stages.
 *
 * Layout (relative to project root):
 *
 *   config/            static config (source-list.md, voice-rules.md, ...)
 *   data/
 *     post-log/        append-only record of queued/posted content (t3)
 *     source-health/   per-run source health snapshots (t2)
 *   output/
 *     ready-to-post/   queue-mode markdown files, ready for a human to post (t5)
 *     proof-images/    rendered proof images + sidecar metadata (t4)
 *   logs/              run logs
 */

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdirSync } from "node:fs";

/** Project root. Override with OMNI_ROOT for tests / sandboxes. */
export function projectRoot(): string {
  if (process.env.OMNI_ROOT) return resolve(process.env.OMNI_ROOT);
  // this file lives at <root>/src/core/paths.ts (or <root>/dist/core/paths.js)
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..");
}

const root = projectRoot();

export const paths = {
  root,
  config: join(root, "config"),
  data: join(root, "data"),
  postLog: join(root, "data", "post-log"),
  sourceHealth: join(root, "data", "source-health"),
  output: join(root, "output"),
  readyToPost: join(root, "output", "ready-to-post"),
  proofImages: join(root, "output", "proof-images"),
  logs: join(root, "logs"),
} as const;

export type PathKey = keyof typeof paths;

/** Ensure a directory exists (recursive, idempotent). Returns the path. */
export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Ensure every writable runtime directory exists. Call once at run startup.
 * Never touches the source tree or config (which is committed).
 */
export function ensureRuntimeDirs(): void {
  for (const key of ["data", "postLog", "sourceHealth", "output", "readyToPost", "proofImages", "logs"] as const) {
    ensureDir(paths[key]);
  }
}

/** Join a path relative to the project root. */
export function fromRoot(...segments: string[]): string {
  return join(root, ...segments);
}
