/**
 * Publish-layer types.
 *
 * Cross-pipeline contracts (`Publisher`, `QueueItem`, `PublishResult`,
 * `PublishMode`, `Platform`) live in core and are imported, not redeclared.
 * This file adds only the shapes specific to routing + the ready-to-post
 * fallback package.
 */

import type { Platform, PublishMode, PublishResult } from "../core/index.js";

/** Which adapter family handles a platform. */
export type PublishRoute = "api" | "browser";

/** A named source attached to a post (for attribution in the package). */
export interface PackageSource {
  name: string;
  url: string;
}

/** One platform's finished post inside a ready-to-post package. */
export interface PackagePost {
  platform: Platform;
  /** Final body text (hook + body), ready to paste. */
  body: string;
  hashtags: string[];
  charCount: number;
  cta: string;
  imageAltText?: string;
  /** Result of attempting to publish this post (live mode), if attempted. */
  result?: PublishResult;
}

/**
 * The durable artifact written to `ready-to-post/` so a post is NEVER lost when
 * automated publishing is unavailable or fails. Contains everything a human
 * needs to post manually.
 */
export interface ReadyToPostPackage {
  runId: string;
  laneId: string;
  laneName: string;
  topic: string;
  /** ISO timestamp the package was created. */
  createdAt: string;
  mode: PublishMode;
  dryRun: boolean;
  sources: PackageSource[];
  /** Path to the proof image (relative to project root), if one was rendered. */
  proofImagePath?: string;
  posts: PackagePost[];
  /** Why automated publishing didn't happen / failed (drives the fallback). */
  failureReason?: string;
}
