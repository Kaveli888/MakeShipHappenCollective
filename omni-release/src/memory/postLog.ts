/**
 * postLog — the append-only ledger of everything omni-release writes.
 *
 * Stored as JSON Lines (one `PostRecord` per line) at `state/post-log.jsonl` by
 * default. Append-only by design: it's the evidence trail for de-duplication
 * (`duplicateCheck`) and CTA rotation, so we never rewrite history — we only add.
 *
 * Reads are tolerant: malformed lines are skipped rather than throwing, so a
 * single bad write can't take down the whole pipeline.
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { PROJECT_ROOT } from "../content/rules.js";
import type { LaneId, Platform } from "../core/index.js";
import type { PostRecord, PostStatus } from "./types.js";
import { hashContent } from "./duplicateCheck.js";

/**
 * The minimal post shape the ledger needs. The orchestrator builds this from a
 * core `Caption`; keeping it local decouples the memory layer from the content
 * layer's evolving caption shapes.
 */
export interface LoggablePost {
  lane: LaneId;
  platform: Platform;
  /** Final published text (hook + body), used for the content hash. */
  text: string;
  hashtags: string[];
  /** Source URLs cited by the post. */
  sources: string[];
  /** Research item ids the post was grounded in. */
  sourceItemIds: string[];
}

export interface PostLogOptions {
  /** Full path to the ledger file. Overrides `dataDir`. */
  logPath?: string;
  /** Directory for state files; the ledger is `<dataDir>/post-log.jsonl`. */
  dataDir?: string;
}

/** Resolve the ledger path from options, falling back to `<root>/social-post-log.jsonl`. */
export function resolveLogPath(options: PostLogOptions = {}): string {
  if (options.logPath) return options.logPath;
  if (options.dataDir) return join(options.dataDir, "social-post-log.jsonl");
  return join(PROJECT_ROOT, "social-post-log.jsonl");
}

/** Read all records from the ledger. Returns `[]` if the file doesn't exist. */
export async function readPostLog(options: PostLogOptions = {}): Promise<PostRecord[]> {
  const path = resolveLogPath(options);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }
  const out: PostRecord[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as PostRecord);
    } catch {
      // Skip a corrupt line rather than failing the whole read.
    }
  }
  return out;
}

/** Append one record to the ledger, creating the directory if needed. */
export async function appendPostLog(record: PostRecord, options: PostLogOptions = {}): Promise<void> {
  const path = resolveLogPath(options);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(record) + "\n", "utf8");
}

export interface RecordExtras {
  status?: PostStatus;
  score?: number;
  url?: string;
  /** CTA used in the post (pass from the draft; the caption doesn't carry it). */
  cta?: string;
  /** Topic / lead headline this post covered. */
  topic?: string;
  /** Whether the topic may be reused later. */
  reusable?: boolean;
  /** Mark this record as a dry run (excluded from duplicate detection). */
  dryRun?: boolean;
  /** Override the generated id (useful for tests). */
  id?: string;
  /** Override the timestamp (useful for tests). */
  loggedAt?: string;
  postedAt?: string;
}

/** Build a PostRecord from a formatted post (computes the content hash). */
export function recordFromPost(post: LoggablePost, extras: RecordExtras = {}): PostRecord {
  return {
    id: extras.id ?? randomUUID(),
    contentHash: hashContent(post.text),
    lane: post.lane,
    platform: post.platform,
    text: post.text,
    hashtags: post.hashtags,
    sources: post.sources,
    sourceItemIds: post.sourceItemIds,
    cta: extras.cta,
    score: extras.score,
    status: extras.status ?? "queued",
    loggedAt: extras.loggedAt ?? new Date().toISOString(),
    postedAt: extras.postedAt,
    url: extras.url,
    topic: extras.topic,
    reusable: extras.reusable,
    dryRun: extras.dryRun,
  };
}

/** Build a record from a post and append it. Returns the stored record. */
export async function logPost(
  post: LoggablePost,
  extras: RecordExtras = {},
  options: PostLogOptions = {},
): Promise<PostRecord> {
  const record = recordFromPost(post, extras);
  await appendPostLog(record, options);
  return record;
}

/** The CTA used most recently for a lane (so the writer can rotate it). */
export function lastCtaForLane(records: PostRecord[], lane: string): string | undefined {
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r && r.lane === lane && r.cta) return r.cta;
  }
  return undefined;
}
