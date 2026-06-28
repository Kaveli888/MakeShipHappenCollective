/**
 * Memory-layer types for omni-release (t3).
 *
 * The memory layer is the pipeline's institutional memory: an append-only ledger
 * of everything written/queued/posted, used for de-duplication and CTA rotation.
 */

import type { LaneId, Platform } from "../core/index.js";

/** Lifecycle status of a post record. */
export type PostStatus = "queued" | "posted" | "skipped" | "failed";

/** One entry in the post log ledger. */
export interface PostRecord {
  /** Unique id for this record. */
  id: string;
  /** sha256 of the normalized post text (used for exact-duplicate detection). */
  contentHash: string;
  lane: LaneId;
  platform: Platform;
  /** The final post text. */
  text: string;
  hashtags: string[];
  sources: string[];
  sourceItemIds: string[];
  /** The CTA used (lets the writer avoid repeating it on the next post). */
  cta?: string;
  /** Editorial score from the quality gate at the time of logging. */
  score?: number;
  status: PostStatus;
  /** ISO timestamp the record was written. */
  loggedAt: string;
  /** ISO timestamp the post actually went live, if it did. */
  postedAt?: string;
  /** URL of the live post, if published. */
  url?: string;
  /** Topic/lead headline this post was about (human-readable dedupe aid). */
  topic?: string;
  /** Whether the topic may be reused in a future post. */
  reusable?: boolean;
  /** True when produced by a dry run; excluded from duplicate detection. */
  dryRun?: boolean;
}

/** Result of a duplicate check against the post log. */
export interface DuplicateResult {
  isDuplicate: boolean;
  /** How the match was found. */
  method: "exact" | "similarity" | "none";
  /** Best similarity score found in [0,1]. */
  similarity: number;
  /** Id of the most similar prior record, if any. */
  similarTo?: string;
  /** The platform that match was on, if any. */
  similarPlatform?: Platform;
}
