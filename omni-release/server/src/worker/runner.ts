// The publishing worker's core loop — pure orchestration over a JobStore.
// Mirrors the desktop app's Rust scheduler spine, but publishes for real:
// claim due jobs → decrypt the account token from the vault → call the platform
// publisher → record a confirmed URL or an honest failure with retry/backoff.

import { decryptTokens, encryptTokens } from "../core/crypto.js";
import { publish } from "../core/publish.js";
import { needsRefresh, refreshTokens } from "../core/refresh.js";
import type { FetchImpl } from "../core/youtube.js";
import type { JobStore } from "./store.js";

export interface ClientCreds {
  clientId: string;
  clientSecret: string;
}

export interface RunnerConfig {
  store: JobStore;
  /** AES key for the token vault (importKey of TOKEN_ENC_KEY). */
  vaultKey: CryptoKey;
  fetchImpl: FetchImpl;
  workerId: string;
  retryBackoffSecs?: number;
  /** Per-platform OAuth client creds (from env) for token refresh. */
  getClientCreds?: (platform: string) => ClientCreds | null;
}

export interface TickSummary {
  claimed: number;
  succeeded: number;
  failed: number;
}

/** Process all currently-due jobs once. Returns a summary for logging/tests. */
export async function runDueJobs(cfg: RunnerConfig, nowIso: string): Promise<TickSummary> {
  const backoff = cfg.retryBackoffSecs ?? 60;
  const jobs = await cfg.store.claimDueJobs(nowIso, cfg.workerId);
  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    const attemptNo = await cfg.store.nextAttemptNo(job.targetId);
    const attemptId = await cfg.store.startAttempt(job.id, job.targetId, attemptNo, "live");

    const result = await publishOne(cfg, job.targetId);

    if (result.outcome === "success") {
      await cfg.store.finishAttempt(attemptId, {
        outcome: "success",
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        responseSummary: { platform: result.platform },
      });
      await cfg.store.markPublished(job.targetId, result.externalId!, result.externalUrl!);
      await cfg.store.markJobDone(job.id);
      await cfg.store.audit("publish.success", job.targetId, {
        url: result.externalUrl,
        platform: result.platform,
      });
      succeeded++;
    } else {
      await cfg.store.finishAttempt(attemptId, {
        outcome: "failure",
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        responseSummary: { platform: result.platform },
      });
      const willRetry = await cfg.store.failJob(job.id, backoff);
      if (!willRetry) await cfg.store.markFailed(job.targetId, result.errorMessage ?? "unknown error");
      await cfg.store.audit("publish.failure", job.targetId, {
        reason: result.errorMessage,
        willRetry,
      });
      failed++;
    }
  }
  return { claimed: jobs.length, succeeded, failed };
}

interface OneResult {
  platform: string;
  outcome: "success" | "failure";
  externalId?: string;
  externalUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

async function publishOne(cfg: RunnerConfig, targetId: string): Promise<OneResult> {
  const ctx = await cfg.store.getContext(targetId);
  if (!ctx) {
    return { platform: "?", outcome: "failure", errorCode: "no_context", errorMessage: "target not found" };
  }
  const platform = ctx.target.platform;
  if (!ctx.media) {
    return { platform, outcome: "failure", errorCode: "no_media", errorMessage: "post has no media attached" };
  }
  if (!ctx.account || !ctx.account.tokensEnc || ctx.account.status !== "connected") {
    return {
      platform,
      outcome: "failure",
      errorCode: "no_account",
      errorMessage: `No connected ${platform} account — connect one before publishing.`,
    };
  }

  let bundle;
  try {
    bundle = await decryptTokens(cfg.vaultKey, ctx.account.tokensEnc);
  } catch {
    return { platform, outcome: "failure", errorCode: "token_decrypt", errorMessage: "could not decrypt stored token" };
  }

  // Refresh just-in-time if the access token is at/near expiry.
  const now = Date.now();
  if (needsRefresh(bundle, now) && bundle.refresh_token && cfg.getClientCreds) {
    const creds = cfg.getClientCreds(platform);
    if (creds) {
      try {
        bundle = await refreshTokens(platform, bundle, { fetchImpl: cfg.fetchImpl, ...creds, nowMs: now });
        const enc = await encryptTokens(cfg.vaultKey, bundle);
        await cfg.store.updateAccountTokens(ctx.account.id, enc, bundle.expires_at ?? null);
        await cfg.store.audit("token.refresh", targetId, { platform });
      } catch {
        // Refresh failed — try the existing token; a real expiry will surface as a publish failure.
      }
    }
  }
  const accessToken = bundle.access_token;

  const title = ctx.target.titleOverride ?? ctx.media.title ?? "Untitled";
  const caption = ctx.target.captionOverride ?? ctx.post.masterCaption ?? "";

  const res = await publish(
    {
      platform,
      media: { bytes: ctx.media.bytes, mimeType: ctx.media.mimeType },
      title,
      caption,
      hashtags: ctx.target.hashtags,
      privacy: ctx.target.privacy ?? "private",
      categoryId: ctx.target.categoryId,
      accessToken,
    },
    cfg.fetchImpl,
  );
  return { platform, ...res };
}
