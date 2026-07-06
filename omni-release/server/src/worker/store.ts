// Data layer for the publishing worker. The runner depends only on this
// interface, so it can run against Postgres in production and an in-memory store
// in tests. The Supabase implementation lives in supabaseStore.ts.

import type { MediaBytes } from "../core/youtube.js";

export interface JobRow {
  id: string;
  targetId: string;
  postId: string;
  scheduledFor: string;
  attempts: number;
  maxAttempts: number;
}

export interface TargetCtx {
  target: {
    id: string;
    postId: string;
    platform: string;
    captionOverride: string | null;
    titleOverride: string | null;
    hashtags: string[];
    privacy: "public" | "unlisted" | "private" | null;
    categoryId?: string;
    /** Facebook: target Page id (from target.options). */
    pageId?: string;
    /** Instagram: IG business account id (from target.options). */
    igUserId?: string;
    /** Instagram: public media URL the Graph API can pull (from target.options). */
    mediaUrl?: string;
  };
  post: { id: string; masterCaption: string | null };
  media: (MediaBytes & { title?: string | null }) | null;
  /** Encrypted token bundle + scopes for the connected account, if any. */
  account: {
    id: string;
    tokensEnc: string | null;
    scopes: string[];
    status: string;
    /** Platform-side id (LinkedIn person id, etc.) for building author URNs. */
    externalAccountId?: string | null;
  } | null;
}

export interface FinishAttemptInput {
  outcome: "success" | "failure";
  externalId?: string;
  externalUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  responseSummary?: unknown;
}

export interface JobStore {
  claimDueJobs(nowIso: string, worker: string): Promise<JobRow[]>;
  getContext(targetId: string): Promise<TargetCtx | null>;
  nextAttemptNo(targetId: string): Promise<number>;
  startAttempt(jobId: string, targetId: string, attemptNo: number, mode: string): Promise<string>;
  finishAttempt(attemptId: string, input: FinishAttemptInput): Promise<void>;
  markPublished(targetId: string, externalId: string, externalUrl: string): Promise<void>;
  markFailed(targetId: string, reason: string): Promise<void>;
  markJobDone(jobId: string): Promise<void>;
  /** Bump attempts; reschedule (return true) or exhaust → failed (return false). */
  failJob(jobId: string, retryDelaySecs: number): Promise<boolean>;
  /** Persist refreshed (re-encrypted) tokens for a connected account. */
  updateAccountTokens(accountId: string, tokensEnc: string, expiresAt: string | null): Promise<void>;
  audit(action: string, targetId: string, metadata: unknown): Promise<void>;
}

/* ----------------------- in-memory store (tests) ----------------------- */

interface MemJob extends JobRow {
  status: string;
  runAfter: string;
  lockedBy: string | null;
}
interface MemTarget {
  status: string;
  externalUrl: string | null;
  externalId: string | null;
  failureReason: string | null;
  ctx: TargetCtx;
}
interface MemAttempt extends FinishAttemptInput {
  id: string;
  jobId: string;
  targetId: string;
  attemptNo: number;
  mode: string;
  finished: boolean;
}

export class InMemoryStore implements JobStore {
  jobs = new Map<string, MemJob>();
  targets = new Map<string, MemTarget>();
  attempts: MemAttempt[] = [];
  audits: { action: string; targetId: string; metadata: unknown }[] = [];
  private seq = 0;

  seedJob(job: MemJob) {
    this.jobs.set(job.id, job);
  }
  seedTarget(target: MemTarget) {
    this.targets.set(target.ctx.target.id, target);
  }

  async claimDueJobs(nowIso: string, worker: string): Promise<JobRow[]> {
    const out: JobRow[] = [];
    for (const j of this.jobs.values()) {
      if (j.status === "pending" && j.runAfter <= nowIso && j.attempts < j.maxAttempts) {
        j.status = "claimed";
        j.lockedBy = worker;
        out.push({ ...j });
      }
    }
    return out;
  }
  async getContext(targetId: string): Promise<TargetCtx | null> {
    return this.targets.get(targetId)?.ctx ?? null;
  }
  async nextAttemptNo(targetId: string): Promise<number> {
    return this.attempts.filter((a) => a.targetId === targetId).length + 1;
  }
  async startAttempt(jobId: string, targetId: string, attemptNo: number, mode: string): Promise<string> {
    const id = `att_${++this.seq}`;
    this.attempts.push({ id, jobId, targetId, attemptNo, mode, finished: false, outcome: "failure" });
    return id;
  }
  async finishAttempt(attemptId: string, input: FinishAttemptInput): Promise<void> {
    const a = this.attempts.find((x) => x.id === attemptId);
    if (a) Object.assign(a, input, { finished: true });
  }
  async markPublished(targetId: string, externalId: string, externalUrl: string): Promise<void> {
    const t = this.targets.get(targetId);
    if (t) {
      t.status = "published";
      t.externalId = externalId;
      t.externalUrl = externalUrl;
      t.failureReason = null;
    }
  }
  async markFailed(targetId: string, reason: string): Promise<void> {
    const t = this.targets.get(targetId);
    if (t) {
      t.status = "failed";
      t.failureReason = reason;
    }
  }
  async markJobDone(jobId: string): Promise<void> {
    const j = this.jobs.get(jobId);
    if (j) j.status = "done";
  }
  async failJob(jobId: string, retryDelaySecs: number): Promise<boolean> {
    const j = this.jobs.get(jobId);
    if (!j) return false;
    j.attempts += 1;
    j.lockedBy = null;
    if (j.attempts >= j.maxAttempts) {
      j.status = "failed";
      return false;
    }
    j.status = "pending";
    j.runAfter = new Date(Date.now() + retryDelaySecs * 1000).toISOString();
    return true;
  }
  async updateAccountTokens(accountId: string, tokensEnc: string, expiresAt: string | null): Promise<void> {
    for (const t of this.targets.values()) {
      if (t.ctx.account && t.ctx.account.id === accountId) {
        t.ctx.account.tokensEnc = tokensEnc;
        this.tokenUpdates.push({ accountId, expiresAt });
      }
    }
  }
  tokenUpdates: { accountId: string; expiresAt: string | null }[] = [];

  async audit(action: string, targetId: string, metadata: unknown): Promise<void> {
    this.audits.push({ action, targetId, metadata });
  }
}
