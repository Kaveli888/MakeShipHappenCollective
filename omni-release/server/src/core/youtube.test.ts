import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadVideo, buildVideoResource, type FetchImpl } from "./youtube.js";

function youtubeMock(captures: Request2[]): FetchImpl {
  return async (url, init) => {
    captures.push({ url, init });
    if (url.includes("uploadType=resumable")) {
      return new Response(null, { status: 200, headers: { location: "https://upload.example/sess-1" } });
    }
    if (url.startsWith("https://upload.example/")) {
      return new Response(JSON.stringify({ id: "VID123", snippet: { title: "t" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  };
}
interface Request2 {
  url: string;
  init?: RequestInit;
}

test("buildVideoResource schedules as private when publishAt is set", () => {
  const r = buildVideoResource({ title: "x", publishAt: "2026-07-01T00:00:00Z" }) as any;
  assert.equal(r.status.privacyStatus, "private");
  assert.equal(r.status.publishAt, "2026-07-01T00:00:00Z");
});

test("title is clamped to 100 chars", () => {
  const r = buildVideoResource({ title: "a".repeat(200) }) as any;
  assert.equal(r.snippet.title.length, 100);
});

test("uploadVideo does the resumable two-step and returns the watch URL", async () => {
  const calls: Request2[] = [];
  const res = await uploadVideo(
    "access-token-xyz",
    { bytes: new Uint8Array([1, 2, 3, 4]), mimeType: "video/mp4" },
    { title: "Hello", description: "d", tags: ["ai"], privacyStatus: "public" },
    youtubeMock(calls),
  );
  assert.equal(res.videoId, "VID123");
  assert.equal(res.url, "https://youtu.be/VID123");

  // init request carries auth + resumable upload headers
  const init = calls[0];
  assert.ok(init.url.includes("uploadType=resumable"));
  const h = init.init!.headers as Record<string, string>;
  assert.equal(h["authorization"], "Bearer access-token-xyz");
  assert.equal(h["x-upload-content-type"], "video/mp4");
  assert.equal(h["x-upload-content-length"], "4");

  // second request PUTs bytes to the session URL
  assert.equal(calls[1].url, "https://upload.example/sess-1");
  assert.equal((calls[1].init!.method ?? "").toUpperCase(), "PUT");
});

test("uploadVideo throws a clear error on init failure", async () => {
  const failing: FetchImpl = async () => new Response("quota exceeded", { status: 403 });
  await assert.rejects(
    () => uploadVideo("t", { bytes: new Uint8Array([1]), mimeType: "video/mp4" }, { title: "x" }, failing),
    /youtube init failed: 403/,
  );
});
