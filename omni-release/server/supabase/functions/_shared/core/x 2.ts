// X (Twitter) video publisher — chunked media upload (INIT/APPEND/FINALIZE/STATUS)
// then create a post referencing the uploaded media. All network I/O goes through
// an injectable `fetch` so the flow is unit-testable without hitting X.
//
// Endpoints (v2 media upload, current as of 2026):
//   POST https://api.x.com/2/media/upload  (command=INIT|APPEND|FINALIZE|STATUS)
//   POST https://api.x.com/2/tweets        (create post with media.media_ids)
// Video uploads are async: FINALIZE may return processing_info; poll STATUS until
// state === "succeeded" before creating the post.
//
// ⚠️ Not yet verified against a live X developer app — provider.verified is false.

import type { FetchImpl, MediaBytes } from "./youtube.ts";

const MEDIA_URL = "https://api.x.com/2/media/upload";
const TWEETS_URL = "https://api.x.com/2/tweets";

/** 5 MB per APPEND chunk — under X's per-chunk ceiling with headroom. */
export const X_CHUNK_BYTES = 5 * 1024 * 1024;

export interface XPostResult {
  postId: string;
  url: string;
}

interface InitResponse {
  data?: { id?: string };
  media_id_string?: string;
}
interface StatusResponse {
  data?: { processing_info?: { state?: string; check_after_secs?: number } };
  processing_info?: { state?: string; check_after_secs?: number };
}

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

/** Split a buffer into <=X_CHUNK_BYTES segments. Exported for testing. */
export function chunkBytes(bytes: Uint8Array, size = X_CHUNK_BYTES): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let off = 0; off < bytes.byteLength; off += size) {
    out.push(bytes.subarray(off, Math.min(off + size, bytes.byteLength)));
  }
  return out.length ? out : [bytes.subarray(0, 0)];
}

/**
 * Upload a video to X via the chunked protocol and return its media id.
 * Throws on any non-OK response (caller records the failure honestly).
 */
export async function uploadMedia(
  accessToken: string,
  media: MediaBytes,
  fetchImpl: FetchImpl,
  opts: { pollIntervalMs?: number; maxPolls?: number } = {},
): Promise<string> {
  // INIT
  const initBody = new URLSearchParams({
    command: "INIT",
    media_type: media.mimeType,
    total_bytes: String(media.bytes.byteLength),
    media_category: "tweet_video",
  });
  const init = await fetchImpl(MEDIA_URL, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "content-type": "application/x-www-form-urlencoded" },
    body: initBody.toString(),
  });
  if (!init.ok) throw new Error(`x media INIT failed: ${init.status} ${await safeText(init)}`);
  const initJson = (await init.json()) as InitResponse;
  const mediaId = initJson.data?.id ?? initJson.media_id_string;
  if (!mediaId) throw new Error("x media INIT: response missing media id");

  // APPEND each chunk
  const chunks = chunkBytes(media.bytes);
  for (let i = 0; i < chunks.length; i++) {
    const form = new FormData();
    form.set("command", "APPEND");
    form.set("media_id", mediaId);
    form.set("segment_index", String(i));
    form.set("media", new Blob([chunks[i] as unknown as BlobPart], { type: media.mimeType }));
    const ap = await fetchImpl(MEDIA_URL, { method: "POST", headers: authHeaders(accessToken), body: form });
    if (!ap.ok) throw new Error(`x media APPEND ${i} failed: ${ap.status} ${await safeText(ap)}`);
  }

  // FINALIZE
  const finBody = new URLSearchParams({ command: "FINALIZE", media_id: mediaId });
  const fin = await fetchImpl(MEDIA_URL, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "content-type": "application/x-www-form-urlencoded" },
    body: finBody.toString(),
  });
  if (!fin.ok) throw new Error(`x media FINALIZE failed: ${fin.status} ${await safeText(fin)}`);
  let proc = readProcessing(await fin.json());

  // Poll STATUS until the async transcode finishes.
  const maxPolls = opts.maxPolls ?? 20;
  let polls = 0;
  while (proc && proc.state && proc.state !== "succeeded") {
    if (proc.state === "failed") throw new Error("x media processing failed");
    if (polls++ >= maxPolls) throw new Error("x media processing timed out");
    await delay(opts.pollIntervalMs ?? (proc.check_after_secs ?? 1) * 1000);
    const st = await fetchImpl(
      `${MEDIA_URL}?command=STATUS&media_id=${encodeURIComponent(mediaId)}`,
      { method: "GET", headers: authHeaders(accessToken) },
    );
    if (!st.ok) throw new Error(`x media STATUS failed: ${st.status} ${await safeText(st)}`);
    proc = readProcessing(await st.json());
  }
  return mediaId;
}

/** Create a post (tweet) that references already-uploaded media. */
export async function createPost(
  accessToken: string,
  text: string,
  mediaIds: string[],
  fetchImpl: FetchImpl,
): Promise<XPostResult> {
  const body: Record<string, unknown> = { text };
  if (mediaIds.length) body.media = { media_ids: mediaIds };
  const res = await fetchImpl(TWEETS_URL, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`x create post failed: ${res.status} ${await safeText(res)}`);
  const json = (await res.json()) as { data?: { id?: string } };
  const id = json.data?.id;
  if (!id) throw new Error("x create post: response missing tweet id");
  return { postId: id, url: `https://x.com/i/web/status/${id}` };
}

/** Full publish: upload the video, then post `text` referencing it. */
export async function publishVideo(
  accessToken: string,
  media: MediaBytes,
  text: string,
  fetchImpl: FetchImpl,
  opts?: { pollIntervalMs?: number; maxPolls?: number },
): Promise<XPostResult> {
  const mediaId = await uploadMedia(accessToken, media, fetchImpl, opts);
  return createPost(accessToken, text, [mediaId], fetchImpl);
}

function readProcessing(json: unknown): { state?: string; check_after_secs?: number } | null {
  const j = json as StatusResponse;
  return j.data?.processing_info ?? j.processing_info ?? null;
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

async function safeText(r: Response): Promise<string> {
  try {
    return (await r.text()).slice(0, 300);
  } catch {
    return "";
  }
}
