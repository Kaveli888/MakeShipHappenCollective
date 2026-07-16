import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyBase64, importKey, encryptTokens } from "../core/crypto.js";
import type { FetchImpl } from "../core/youtube.js";
import { runDueJobs } from "./runner.js";
import { InMemoryStore, type TargetCtx } from "./store.js";

const PAST = new Date(Date.now() - 60_000).toISOString();
const NOW = new Date().toISOString();

function youtubeMock(): FetchImpl {
  return async (url) => {
    if (url.includes("uploadType=resumable")) {
      return new Response(null, { status: 200, headers: { location: "https://upload.example/s" } });
    }
    if (url.startsWith("https://upload.example/")) {
      return new Response(JSON.stringify({ id: "YT_OK" }), { status: 200 });
    }
    return new Response("no", { status: 404 });
  };
}

async function vaultKey() {
  return importKey(await generateKeyBase64());
}

function ctxWith(account: TargetCtx["account"]): TargetCtx {
  return {
    target: {
      id: "tgt1",
      postId: "post1",
      platform: "youtube",
      captionOverride: null,
      titleOverride: "My Video",
      hashtags: ["#ai", "#ship"],
      privacy: "public",
    },
    post: { id: "post1", masterCaption: "master caption" },
    media: { bytes: new Uint8Array([9, 9, 9]), mimeType: "video/mp4", title: "media title" },
    account,
  };
}

function seed(store: InMemoryStore, ctx: TargetCtx, maxAttempts = 5) {
  store.seedTarget({ status: "scheduled", externalUrl: null, externalId: null, failureReason: null, ctx });
  store.seedJob({
    id: "job1",
    targetId: "tgt1",
    postId: "post1",
    scheduledFor: PAST,
    attempts: 0,
    maxAttempts,
    status: "pending",
    runAfter: PAST,
    lockedBy: null,
  });
}

test("worker publishes a due job to YouTube and stores the confirmed URL", async () => {
  const key = await vaultKey();
  const store = new InMemoryStore();
  const tokensEnc = await encryptTokens(key, { access_token: "live-token" });
  seed(store, ctxWith({ id: "acct1", tokensEnc, scopes: ["youtube.upload"], status: "connected" }));

  const summary = await runDueJobs(
    { store, vaultKey: key, fetchImpl: youtubeMock(), workerId: "w1" },
    NOW,
  );

  assert.deepEqual(summary, { claimed: 1, succeeded: 1, failed: 0 });
  const t = store.targets.get("tgt1")!;
  assert.equal(t.status, "published");
  assert.equal(t.externalUrl, "https://youtu.be/YT_OK");
  assert.equal(store.jobs.get("job1")!.status, "done");
  assert.equal(store.attempts.length, 1);
  assert.equal(store.attempts[0].outcome, "success");
  assert.ok(store.audits.some((a) => a.action === "publish.success"));
});

test("worker fails honestly when no account is connected (no fake success)", async () => {
  const key = await vaultKey();
  const store = new InMemoryStore();
  seed(store, ctxWith(null), 1); // maxAttempts=1 → exhausts immediately

  const summary = await runDueJobs(
    { store, vaultKey: key, fetchImpl: youtubeMock(), workerId: "w1" },
    NOW,
  );

  assert.deepEqual(summary, { claimed: 1, succeeded: 0, failed: 1 });
  const t = store.targets.get("tgt1")!;
  assert.equal(t.status, "failed");
  assert.equal(t.externalUrl, null, "no URL may be stored on failure");
  assert.match(t.failureReason!, /No connected youtube account/);
  assert.equal(store.jobs.get("job1")!.status, "failed");
});

test("an expired token is refreshed just-in-time before publishing", async () => {
  const key = await vaultKey();
  const store = new InMemoryStore();
  // expired access token + a refresh token
  const tokensEnc = await encryptTokens(key, {
    access_token: "stale",
    refresh_token: "refresh-1",
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  });
  seed(store, ctxWith({ id: "acct1", tokensEnc, scopes: [], status: "connected" }));

  // mock handles the Google token endpoint + the YouTube resumable flow
  const mock: FetchImpl = async (url) => {
    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "fresh", expires_in: 3600 }), { status: 200 });
    }
    if (url.includes("uploadType=resumable")) {
      return new Response(null, { status: 200, headers: { location: "https://upload.example/s" } });
    }
    if (url.startsWith("https://upload.example/")) {
      return new Response(JSON.stringify({ id: "YT_FRESH" }), { status: 200 });
    }
    return new Response("no", { status: 404 });
  };

  const summary = await runDueJobs(
    {
      store,
      vaultKey: key,
      fetchImpl: mock,
      workerId: "w1",
      getClientCreds: () => ({ clientId: "cid", clientSecret: "sec" }),
    },
    NOW,
  );

  assert.deepEqual(summary, { claimed: 1, succeeded: 1, failed: 0 });
  assert.equal(store.targets.get("tgt1")!.externalUrl, "https://youtu.be/YT_FRESH");
  assert.equal(store.tokenUpdates.length, 1, "refreshed tokens were persisted");
  assert.ok(store.audits.some((a) => a.action === "token.refresh"));
  // the stored bundle now decrypts to the fresh token
  const { decryptTokens } = await import("../core/crypto.js");
  const updated = await decryptTokens(key, store.targets.get("tgt1")!.ctx.account!.tokensEnc!);
  assert.equal(updated.access_token, "fresh");
});

test("a failing publish with attempts remaining is rescheduled (retry)", async () => {
  const key = await vaultKey();
  const store = new InMemoryStore();
  const tokensEnc = await encryptTokens(key, { access_token: "t" });
  seed(store, ctxWith({ id: "acct1", tokensEnc, scopes: [], status: "connected" }), 3);
  const failingYouTube: FetchImpl = async () => new Response("server error", { status: 500 });

  const summary = await runDueJobs(
    { store, vaultKey: key, fetchImpl: failingYouTube, workerId: "w1", retryBackoffSecs: 0 },
    NOW,
  );

  assert.deepEqual(summary, { claimed: 1, succeeded: 0, failed: 1 });
  const job = store.jobs.get("job1")!;
  assert.equal(job.status, "pending", "should be back to pending for retry");
  assert.equal(job.attempts, 1);
  assert.equal(store.targets.get("tgt1")!.status, "scheduled", "not marked failed while retries remain");
});
