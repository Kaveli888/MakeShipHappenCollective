/**
 * duplicateCheck — stop the pipeline from posting the same thing twice.
 *
 * Two-tier detection against the post log:
 *  1. **Exact**: identical normalized text (sha256 hash match) → certain dupe.
 *  2. **Similarity**: Jaccard overlap of token sets ≥ threshold → near-dupe.
 *
 * Normalization strips hashtags, URLs, punctuation, and casing so "same story,
 * tweaked wording" is still caught. The default threshold (0.82) is tuned to flag
 * reworded reposts without tripping on two legitimately different posts that
 * happen to share a topic vocabulary.
 */

import { createHash } from "node:crypto";
import type { DuplicateResult, PostRecord } from "./types.js";
import { readPostLog, type PostLogOptions } from "./postLog.js";

/** Normalize text for comparison: drop urls/hashtags/punct, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#[\w-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** sha256 of the normalized text — the value stored as `contentHash`. */
export function hashContent(text: string): string {
  return createHash("sha256").update(normalizeText(text)).digest("hex");
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeText(text).split(" ").filter((t) => t.length > 2));
}

/** Jaccard similarity of two token sets, in [0,1]. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface DuplicateCheckOptions extends PostLogOptions {
  /** Similarity threshold for a near-duplicate. Default 0.82. */
  threshold?: number;
  /** Pre-loaded records (skips disk read if provided). */
  records?: PostRecord[];
  /** Only compare against records on the same platform. Default false. */
  samePlatformOnly?: boolean;
  /** Restrict comparison to the same lane. Default false. */
  sameLaneOnly?: boolean;
}

/** Anything carrying the fields needed to dedupe (PlatformPost satisfies this). */
export interface DuplicateCheckInput {
  text: string;
  platform?: string;
  lane?: string;
}

/**
 * Check whether `post` duplicates anything in the post log.
 */
export async function checkDuplicate(
  post: DuplicateCheckInput,
  options: DuplicateCheckOptions = {},
): Promise<DuplicateResult> {
  const threshold = options.threshold ?? 0.82;
  const records = options.records ?? (await readPostLog(options));

  const candidates = records.filter((r) => {
    if (r.dryRun) return false; // dry-run records never count as prior posts
    if (options.samePlatformOnly && post.platform && r.platform !== post.platform) return false;
    if (options.sameLaneOnly && post.lane && r.lane !== post.lane) return false;
    return true;
  });

  const hash = hashContent(post.text);
  for (const r of candidates) {
    if (r.contentHash === hash) {
      return { isDuplicate: true, method: "exact", similarity: 1, similarTo: r.id, similarPlatform: r.platform };
    }
  }

  const tokens = tokenSet(post.text);
  let best: { id?: string; sim: number; platform?: PostRecord["platform"] } = { sim: 0 };
  for (const r of candidates) {
    const sim = jaccard(tokens, tokenSet(r.text));
    if (sim > best.sim) best = { id: r.id, sim, platform: r.platform };
  }

  const isDuplicate = best.sim >= threshold;
  return {
    isDuplicate,
    method: isDuplicate ? "similarity" : "none",
    similarity: Math.round(best.sim * 100) / 100,
    similarTo: isDuplicate ? best.id : undefined,
    similarPlatform: isDuplicate ? best.platform : undefined,
  };
}
