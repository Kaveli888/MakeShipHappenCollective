import { test } from "node:test";
import assert from "node:assert/strict";
import type { FetchImpl } from "./youtube.js";
import { chunkBytes, publishVideo as xPublish, X_CHUNK_BYTES } from "./x.js";
import { publishVideo as tiktokPublish, uploadToInbox as tiktokInbox } from "./tiktok.js";
import { uploadFacebookVideo, publishInstagramReel } from "./meta.js";
import { publish } from "./publish.js";

interface Capture {
  url: string;
  init?: RequestInit;
}
const media = { bytes: new Uint8Array([1, 2, 3, 4, 5]), mimeType: "video/mp4" };

/* -------------------------------- X / Twitter ------------------------------- */

test("x.chunkBytes splits on the chunk ceiling", () => {
  const big = new Uint8Array(X_CHUNK_BYTES + 10);
  const chunks = chunkBytes(big);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].byteLength, X_CHUNK_BYTES);
  assert.equal(chunks[1].byteLength, 10);
});

test("x publishVideo runs INIT→APPEND→FINALIZE then creates a post", async () => {
  const calls: Capture[] = [];
  const fetchImpl: FetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes("/media/upload")) {
      const body = String(init?.body ?? "");
      if (body.includes("command=INIT")) {
        return json({ data: { id: "MEDIA1" } });
      }
      // APPEND (FormData) and FINALIZE return ok; FINALIZE reports succeeded
      return json({ data: { id: "MEDIA1", processing_info: { state: "succeeded" } } });
    }
    if (url.endsWith("/2/tweets")) return json({ data: { id: "TWEET9" } });
    return new Response("404", { status: 404 });
  };
  const res = await xPublish("tok", media, "hello world", fetchImpl);
  assert.equal(res.postId, "TWEET9");
  assert.equal(res.url, "https://x.com/i/web/status/TWEET9");
  assert.ok(calls.some((c) => String(c.init?.body ?? "").includes("command=INIT")));
  assert.ok(calls.some((c) => c.url.endsWith("/2/tweets")));
});

test("x publishVideo surfaces an INIT failure", async () => {
  const fetchImpl: FetchImpl = async () => new Response("bad", { status: 401 });
  await assert.rejects(() => xPublish("tok", media, "x", fetchImpl), /x media INIT failed: 401/);
});

/* ---------------------------------- TikTok ---------------------------------- */

test("tiktok publishVideo inits, uploads, and polls to completion", async () => {
  const calls: Capture[] = [];
  const fetchImpl: FetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/video/init/")) {
      return json({ data: { publish_id: "PUB1", upload_url: "https://up.tiktok/sess" } });
    }
    if (url.startsWith("https://up.tiktok/")) return new Response(null, { status: 200 });
    if (url.endsWith("/status/fetch/")) {
      return json({ data: { status: "PUBLISH_COMPLETE", publicly_available_post_id: ["999"] } });
    }
    return new Response("404", { status: 404 });
  };
  const res = await tiktokPublish("tok", media, { title: "t", pollIntervalMs: 0 }, fetchImpl);
  assert.equal(res.publishId, "PUB1");
  assert.equal(res.url, "https://www.tiktok.com/video/999");
  // single-chunk PUT happened
  assert.ok(calls.some((c) => c.url.startsWith("https://up.tiktok/") && (c.init?.method ?? "").toUpperCase() === "PUT"));
});

test("tiktok publishVideo throws when status returns FAILED", async () => {
  const fetchImpl: FetchImpl = async (url) => {
    if (url.endsWith("/video/init/")) return json({ data: { publish_id: "P", upload_url: "https://up.tiktok/s" } });
    if (url.startsWith("https://up.tiktok/")) return new Response(null, { status: 200 });
    return json({ data: { status: "FAILED" } });
  };
  await assert.rejects(
    () => tiktokPublish("tok", media, { title: "t", pollIntervalMs: 0 }, fetchImpl),
    /tiktok publish failed/,
  );
});

test("tiktok uploadToInbox posts a draft (inbox endpoint, no public URL)", async () => {
  const calls: Capture[] = [];
  const fetchImpl: FetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/inbox/video/init/")) {
      return json({ data: { publish_id: "DRAFT1", upload_url: "https://up.tiktok/draft" } });
    }
    if (url.startsWith("https://up.tiktok/")) return new Response(null, { status: 200 });
    if (url.endsWith("/status/fetch/")) return json({ data: { status: "SEND_TO_USER_INBOX" } });
    return new Response("404", { status: 404 });
  };
  const res = await tiktokInbox("tok", media, { pollIntervalMs: 0 }, fetchImpl);
  assert.equal(res.publishId, "DRAFT1");
  assert.equal(res.url, null);
  assert.ok(calls.some((c) => c.url.endsWith("/inbox/video/init/")));
});

test("publish() routes tiktok to the inbox draft while the app is unaudited", async () => {
  const calls: Capture[] = [];
  const fetchImpl: FetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/inbox/video/init/")) {
      return json({ data: { publish_id: "DRAFT2", upload_url: "https://up.tiktok/d2" } });
    }
    if (url.startsWith("https://up.tiktok/")) return new Response(null, { status: 200 });
    if (url.endsWith("/status/fetch/")) return json({ data: { status: "SEND_TO_USER_INBOX" } });
    return new Response("404", { status: 404 });
  };
  const res = await publish(
    { platform: "tiktok", media, title: "t", caption: "c", hashtags: [], accessToken: "tok", privacy: "private" },
    fetchImpl,
  );
  assert.equal(res.outcome, "success");
  assert.equal(res.externalId, "DRAFT2");
  assert.equal(res.externalUrl, undefined);
  // It used the inbox endpoint, not Direct Post.
  assert.ok(calls.some((c) => c.url.endsWith("/inbox/video/init/")));
  assert.ok(!calls.some((c) => c.url.endsWith("/post/publish/video/init/")));
});

/* ---------------------------------- Meta ------------------------------------ */

test("facebook resumable upload returns the video id + url", async () => {
  const fetchImpl: FetchImpl = async (_url, init) => {
    const body = String(init?.body ?? "");
    if (body.includes("upload_phase=start") || (init?.body instanceof URLSearchParams)) {
      const bs = init?.body instanceof URLSearchParams ? init.body.toString() : body;
      if (bs.includes("upload_phase=start")) {
        return json({ video_id: "FBVID", upload_session_id: "SESS", start_offset: "0", end_offset: "5" });
      }
      if (bs.includes("upload_phase=finish")) return json({ success: true });
    }
    // transfer is FormData → signal completion (no further progress)
    return json({ start_offset: "5", end_offset: "5" });
  };
  const res = await uploadFacebookVideo("PAGE1", "pagetok", media, { description: "d" }, fetchImpl);
  assert.equal(res.externalId, "FBVID");
  assert.equal(res.url, "https://www.facebook.com/FBVID");
});

test("instagram reel creates a container, polls FINISHED, publishes", async () => {
  let polls = 0;
  const fetchImpl: FetchImpl = async (url, init) => {
    if (url.includes("/media_publish")) return json({ id: "IGMEDIA" });
    if ((init?.method ?? "GET") === "POST" && url.includes("/media")) return json({ id: "CREATION1" });
    if (url.includes("status_code")) {
      polls++;
      return json({ status_code: polls >= 2 ? "FINISHED" : "IN_PROGRESS" });
    }
    return new Response("404", { status: 404 });
  };
  const res = await publishInstagramReel("IG1", "tok", "https://cdn/vid.mp4", "cap", fetchImpl, { pollIntervalMs: 0 });
  assert.equal(res.externalId, "IGMEDIA");
  assert.ok(res.url.includes("/reel/IGMEDIA"));
});

/* --------------------------- publish() router ------------------------------- */

test("router: twitch fails honestly as unsupported", async () => {
  const res = await publish(
    { platform: "twitch", media, title: "t", caption: "c", hashtags: [], accessToken: "x" },
    async () => new Response("", { status: 200 }),
  );
  assert.equal(res.outcome, "failure");
  assert.equal(res.errorCode, "unsupported_platform");
});

test("router: facebook without pageId fails with a clear reason", async () => {
  const res = await publish(
    { platform: "facebook", media, title: "t", caption: "c", hashtags: [], accessToken: "x" },
    async () => new Response("", { status: 200 }),
  );
  assert.equal(res.outcome, "failure");
  assert.equal(res.errorCode, "missing_page_id");
});

test("router: instagram without ig params fails with a clear reason", async () => {
  const res = await publish(
    { platform: "instagram", media, title: "t", caption: "c", hashtags: [], accessToken: "x" },
    async () => new Response("", { status: 200 }),
  );
  assert.equal(res.outcome, "failure");
  assert.equal(res.errorCode, "missing_ig_params");
});

test("router: unknown platform reports not_implemented", async () => {
  const res = await publish(
    { platform: "myspace", media, title: "t", caption: "c", hashtags: [], accessToken: "x" },
    async () => new Response("", { status: 200 }),
  );
  assert.equal(res.outcome, "failure");
  assert.equal(res.errorCode, "not_implemented");
});

function json(obj: unknown): Response {
  return new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json" } });
}
