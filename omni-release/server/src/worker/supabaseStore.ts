// Postgres/Supabase implementation of JobStore (production). Uses the SERVICE
// ROLE key (bypasses RLS) — runs only in the trusted worker, never the client.
//
// NOTE: requires `npm install` (@supabase/supabase-js). It is intentionally
// excluded from the offline typecheck; the pure runner is covered by tests.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FinishAttemptInput, JobRow, JobStore, TargetCtx } from "./store.js";

const MEDIA_BUCKET = "media";

export class SupabaseStore implements JobStore {
  private db: SupabaseClient;
  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  async claimDueJobs(nowIso: string, worker: string): Promise<JobRow[]> {
    const { data } = await this.db
      .from("scheduled_jobs")
      .select("id, post_platform_target_id, scheduled_for, attempts, max_attempts")
      .eq("status", "pending")
      .lte("run_after", nowIso)
      .order("run_after", { ascending: true })
      .limit(25);
    const claimed: JobRow[] = [];
    for (const j of data ?? []) {
      // optimistic lease: only succeeds if still pending
      const { data: upd } = await this.db
        .from("scheduled_jobs")
        .update({ status: "claimed", locked_by: worker, locked_at: new Date().toISOString() })
        .eq("id", j.id)
        .eq("status", "pending")
        .select("id");
      if (upd && upd.length === 1) {
        const tgt = await this.targetPostId(j.post_platform_target_id);
        claimed.push({
          id: j.id,
          targetId: j.post_platform_target_id,
          postId: tgt,
          scheduledFor: j.scheduled_for,
          attempts: j.attempts,
          maxAttempts: j.max_attempts,
        });
      }
    }
    return claimed;
  }

  private async targetPostId(targetId: string): Promise<string> {
    const { data } = await this.db
      .from("post_platform_targets")
      .select("post_id")
      .eq("id", targetId)
      .single();
    return data?.post_id ?? "";
  }

  async getContext(targetId: string): Promise<TargetCtx | null> {
    const { data: t } = await this.db
      .from("post_platform_targets")
      .select("id, post_id, platform, caption_override, title_override, hashtags, privacy, options")
      .eq("id", targetId)
      .single();
    if (!t) return null;

    const { data: post } = await this.db
      .from("posts")
      .select("id, workspace_id, master_caption, media_asset_id")
      .eq("id", t.post_id)
      .single();
    if (!post) return null;

    let media: TargetCtx["media"] = null;
    if (post.media_asset_id) {
      const { data: m } = await this.db
        .from("media_assets")
        .select("storage_key, mime_type, title")
        .eq("id", post.media_asset_id)
        .single();
      if (m) {
        const dl = await this.db.storage.from(MEDIA_BUCKET).download(m.storage_key);
        if (dl.data) {
          media = {
            bytes: new Uint8Array(await dl.data.arrayBuffer()),
            mimeType: m.mime_type,
            title: m.title,
          };
        }
      }
    }

    const { data: acct } = await this.db
      .from("platform_accounts")
      .select("id, tokens_enc, scopes, status, external_account_id")
      .eq("workspace_id", post.workspace_id)
      .eq("platform", t.platform)
      .eq("status", "connected")
      .maybeSingle();

    const opts = t.options ?? {};
    return {
      target: {
        id: t.id,
        postId: t.post_id,
        platform: t.platform,
        captionOverride: t.caption_override,
        titleOverride: t.title_override,
        hashtags: t.hashtags ?? [],
        privacy: t.privacy,
        categoryId: opts.categoryId,
        pageId: opts.pageId,
        igUserId: opts.igUserId,
        mediaUrl: opts.mediaUrl,
      },
      post: { id: post.id, masterCaption: post.master_caption },
      media,
      account: acct
        ? {
            id: acct.id,
            tokensEnc: acct.tokens_enc,
            scopes: acct.scopes ?? [],
            status: acct.status,
            externalAccountId: acct.external_account_id,
          }
        : null,
    };
  }

  async nextAttemptNo(targetId: string): Promise<number> {
    const { data } = await this.db
      .from("publish_attempts")
      .select("attempt_no")
      .eq("post_platform_target_id", targetId)
      .order("attempt_no", { ascending: false })
      .limit(1);
    return (data?.[0]?.attempt_no ?? 0) + 1;
  }

  async startAttempt(jobId: string, targetId: string, attemptNo: number, mode: string): Promise<string> {
    const { data } = await this.db
      .from("publish_attempts")
      .insert({
        scheduled_job_id: jobId,
        post_platform_target_id: targetId,
        attempt_no: attemptNo,
        mode,
      })
      .select("id")
      .single();
    return data!.id;
  }

  async finishAttempt(attemptId: string, input: FinishAttemptInput): Promise<void> {
    await this.db
      .from("publish_attempts")
      .update({
        finished_at: new Date().toISOString(),
        outcome: input.outcome,
        external_post_id: input.externalId ?? null,
        external_url: input.externalUrl ?? null,
        response_summary: input.responseSummary ?? {},
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
      })
      .eq("id", attemptId);
  }

  async markPublished(targetId: string, externalId: string, externalUrl: string): Promise<void> {
    await this.db
      .from("post_platform_targets")
      .update({
        status: "published",
        external_post_id: externalId,
        external_url: externalUrl,
        published_at: new Date().toISOString(),
        failure_reason: null,
      })
      .eq("id", targetId);
  }

  async markFailed(targetId: string, reason: string): Promise<void> {
    await this.db
      .from("post_platform_targets")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", targetId);
  }

  async markJobDone(jobId: string): Promise<void> {
    await this.db.from("scheduled_jobs").update({ status: "done" }).eq("id", jobId);
  }

  async failJob(jobId: string, retryDelaySecs: number): Promise<boolean> {
    const { data: job } = await this.db
      .from("scheduled_jobs")
      .select("attempts, max_attempts")
      .eq("id", jobId)
      .single();
    if (!job) return false;
    const attempts = job.attempts + 1;
    if (attempts >= job.max_attempts) {
      await this.db
        .from("scheduled_jobs")
        .update({ status: "failed", attempts, locked_by: null, locked_at: null })
        .eq("id", jobId);
      return false;
    }
    await this.db
      .from("scheduled_jobs")
      .update({
        status: "pending",
        attempts,
        run_after: new Date(Date.now() + retryDelaySecs * 1000).toISOString(),
        locked_by: null,
        locked_at: null,
      })
      .eq("id", jobId);
    return true;
  }

  async reapStaleClaims(nowIso: string, maxAgeSecs: number): Promise<number> {
    const cutoff = new Date(new Date(nowIso).getTime() - maxAgeSecs * 1000).toISOString();
    const { data } = await this.db
      .from("scheduled_jobs")
      .select("id, post_platform_target_id, attempts, max_attempts")
      .eq("status", "claimed")
      .lt("locked_at", cutoff)
      .limit(25);
    let reaped = 0;
    for (const j of data ?? []) {
      const attempts = j.attempts + 1;
      const exhausted = attempts >= j.max_attempts;
      // CAS guarded by the same stale predicate: if the owning worker finished
      // (or re-locked) between our select and this update, 0 rows match and we
      // leave the job alone.
      const { data: upd } = await this.db
        .from("scheduled_jobs")
        .update({
          status: exhausted ? "failed" : "pending",
          attempts,
          locked_by: null,
          locked_at: null,
        })
        .eq("id", j.id)
        .eq("status", "claimed")
        .lt("locked_at", cutoff)
        .select("id");
      if (!upd || upd.length !== 1) continue;
      if (exhausted) {
        await this.markFailed(j.post_platform_target_id, "worker crashed mid-publish; attempts exhausted");
      }
      await this.audit("job.reaped", j.post_platform_target_id, { jobId: j.id, exhausted });
      reaped++;
    }
    return reaped;
  }

  async updateAccountTokens(accountId: string, tokensEnc: string, expiresAt: string | null): Promise<void> {
    await this.db
      .from("platform_accounts")
      .update({ tokens_enc: tokensEnc, token_expires_at: expiresAt, last_refreshed_at: new Date().toISOString() })
      .eq("id", accountId);
  }

  async audit(action: string, targetId: string, metadata: unknown): Promise<void> {
    // workspace_id resolved via the target's post; best-effort.
    const postId = await this.targetPostId(targetId);
    const { data: post } = await this.db.from("posts").select("workspace_id").eq("id", postId).maybeSingle();
    await this.db.from("audit_logs").insert({
      workspace_id: post?.workspace_id ?? null,
      actor: "worker",
      action,
      target_type: "target",
      target_id: targetId,
      metadata: metadata ?? {},
    });
  }
}
