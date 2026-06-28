/**
 * omni-release — shared utilities.
 *
 * Small, dependency-free helpers used across stages. Centralized so dedupe
 * fingerprints, run ids, and score clamping are computed identically everywhere.
 */

import { createHash } from "node:crypto";

/** Current time as an ISO-8601 string. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Stable content fingerprint. Normalizes whitespace + case so trivially
 * different strings hash equal. Used for QueueItem.contentHash / PostLogEntry.
 */
export function contentHash(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/** URL/file-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Build a stable run id: "<laneId>-<timestamp>" with a filesystem-safe stamp.
 * Pass an explicit Date for deterministic ids in tests.
 */
export function makeRunId(laneId: string, when: Date = new Date()): string {
  const stamp = when.toISOString().replace(/[:.]/g, "-").replace("Z", "");
  return `${slugify(laneId)}-${stamp}`;
}

/** Clamp a number into the inclusive [0, 1] range. */
export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Truncate to a max length, appending an ellipsis when cut. */
export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  if (max <= 1) return input.slice(0, max);
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

/** Jaccard similarity over word sets — cheap text similarity for dedupe. */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** A minimal success/failure result wrapper for fallible stage helpers. */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
