// TikTok video publisher — Content Posting API (Direct Post, FILE_UPLOAD source).
// All network I/O goes through an injectable `fetch` so the flow is unit-testable
// without hitting TikTok.
//
// Flow:
//   1. POST /v2/post/publish/video/init/  → { publish_id, upload_url }
//   2. PUT bytes to upload_url (single chunk for small files; Content-Range required)
//   3. POST /v2/post/publish/status/fetch/ → poll until status === "PUBLISH_COMPLETE"
//
// Note: unaudited apps are limited to SELF_ONLY (private) posts until TikTok
// approves the app for public posting. ⚠️ provider.verified is false until then.

import type { FetchImpl, MediaBytes } from "./youtube.js";

const INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const INBOX_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

export interface TikTokInitResult {
  publishId: string;
  uploadUrl: string;
}
export interface TikTokPublishResult {
  publishId: string;
  /** TikTok does not return a canonical post URL from status; may be null. */
  url: string | null;
}

export type TikTokPrivacy =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR"
  | "SELF_ONLY";

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8" };
}

/** Initialize a direct-post upload; returns the publish id + the URL to PUT bytes to. */
export async function initUpload(
  accessToken: string,
  opts: { title: string; sizeBytes: number; privacy?: TikTokPrivacy },
  fetchImpl: FetchImpl,
): Promise<TikTokInitResult> {
  const body = {
    post_info: {
      title: opts.title.slice(0, 2200),
      privacy_level: opts.privacy ?? "SELF_ONLY",
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false,
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: opts.sizeBytes,
      chunk_size: opts.sizeBytes,
      total_chunk_count: 1,
    },
  };
  const res = await fetchImpl(INIT_URL, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`tiktok init failed: ${res.status} ${await safeText(res)}`);
  const json = (await res.json()) as { data?: { publish_id?: string; upload_url?: string }; error?: { code?: string; message?: string } };
  if (json.error && json.error.code && json.error.code !== "ok") {
    throw new Error(`tiktok init error: ${json.error.code} ${json.error.message ?? ""}`);
  }
  const publishId = json.data?.publish_id;
  const uploadUrl = json.data?.upload_url;
  if (!publishId || !uploadUrl) throw new Error("tiktok init: response missing publish_id/upload_url");
  return { publishId, uploadUrl };
}

/** Initialize an inbox/draft upload. Unlike Direct Post, this needs no app
 * audit and only the `video.upload` scope — the video lands in the creator's
 * TikTok inbox and they finish posting (title, privacy, etc.) inside the app.
 * No `post_info` is sent; the creator sets it in-app. */
export async function initInboxUpload(
  accessToken: string,
  sizeBytes: number,
  fetchImpl: FetchImpl,
): Promise<TikTokInitResult> {
  const body = {
    source_info: {
      source: "FILE_UPLOAD",
      video_size: sizeBytes,
      chunk_size: sizeBytes,
      total_chunk_count: 1,
    },
  };
  const res = await fetchImpl(INBOX_INIT_URL, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`tiktok inbox init failed: ${res.status} ${await safeText(res)}`);
  const json = (await res.json()) as { data?: { publish_id?: string; upload_url?: string }; error?: { code?: string; message?: string } };
  if (json.error && json.error.code && json.error.code !== "ok") {
    throw new Error(`tiktok inbox init error: ${json.error.code} ${json.error.message ?? ""}`);
  }
  const publishId = json.data?.publish_id;
  const uploadUrl = json.data?.upload_url;
  if (!publishId || !uploadUrl) throw new Error("tiktok inbox init: response missing publish_id/upload_url");
  return { publishId, uploadUrl };
}

/** PUT the whole file as a single chunk to the upload URL. */
export async function uploadBytes(uploadUrl: string, media: MediaBytes, fetchImpl: FetchImpl): Promise<void> {
  const total = media.bytes.byteLength;
  const res = await fetchImpl(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": media.mimeType,
      "content-length": String(total),
      "content-range": `bytes 0-${total - 1}/${total}`,
    },
    body: media.bytes as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`tiktok upload failed: ${res.status} ${await safeText(res)}`);
}

/** Poll publish status until terminal. Returns the final status string. */
export async function fetchStatus(
  accessToken: string,
  publishId: string,
  fetchImpl: FetchImpl,
): Promise<{ status: string; publiclyAvailablePostId?: string }> {
  const res = await fetchImpl(STATUS_URL, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ publish_id: publishId }),
  });
  if (!res.ok) throw new Error(`tiktok status failed: ${res.status} ${await safeText(res)}`);
  const json = (await res.json()) as {
    data?: { status?: string; publicaly_available_post_id?: string[]; publicly_available_post_id?: string[] };
  };
  const status = json.data?.status ?? "UNKNOWN";
  const ids = json.data?.publicly_available_post_id ?? json.data?.publicaly_available_post_id;
  return { status, publiclyAvailablePostId: ids?.[0] };
}

/** Full publish: init → upload → poll until PUBLISH_COMPLETE (or throw on failure). */
export async function publishVideo(
  accessToken: string,
  media: MediaBytes,
  opts: { title: string; privacy?: TikTokPrivacy; pollIntervalMs?: number; maxPolls?: number },
  fetchImpl: FetchImpl,
): Promise<TikTokPublishResult> {
  const { publishId, uploadUrl } = await initUpload(
    accessToken,
    { title: opts.title, sizeBytes: media.bytes.byteLength, privacy: opts.privacy },
    fetchImpl,
  );
  await uploadBytes(uploadUrl, media, fetchImpl);

  const maxPolls = opts.maxPolls ?? 30;
  for (let i = 0; i < maxPolls; i++) {
    const { status, publiclyAvailablePostId } = await fetchStatus(accessToken, publishId, fetchImpl);
    if (status === "PUBLISH_COMPLETE") {
      const url = publiclyAvailablePostId ? `https://www.tiktok.com/video/${publiclyAvailablePostId}` : null;
      return { publishId, url };
    }
    if (status === "FAILED") throw new Error("tiktok publish failed");
    await delay(opts.pollIntervalMs ?? 2000);
  }
  throw new Error("tiktok publish timed out");
}

/** Full inbox/draft flow: init → upload → poll until the draft is in the
 * creator's inbox. Returns the publish id; there is no public URL yet (the
 * creator publishes from the app), so `url` is always null. */
export async function uploadToInbox(
  accessToken: string,
  media: MediaBytes,
  opts: { pollIntervalMs?: number; maxPolls?: number },
  fetchImpl: FetchImpl,
): Promise<TikTokPublishResult> {
  const { publishId, uploadUrl } = await initInboxUpload(accessToken, media.bytes.byteLength, fetchImpl);
  await uploadBytes(uploadUrl, media, fetchImpl);

  const maxPolls = opts.maxPolls ?? 30;
  for (let i = 0; i < maxPolls; i++) {
    const { status } = await fetchStatus(accessToken, publishId, fetchImpl);
    // Inbox uploads terminate at SEND_TO_USER_INBOX (the draft is now in the
    // app); accept PUBLISH_COMPLETE too in case the status taxonomy shifts.
    if (status === "SEND_TO_USER_INBOX" || status === "PUBLISH_COMPLETE") {
      return { publishId, url: null };
    }
    if (status === "FAILED") throw new Error("tiktok inbox upload failed");
    await delay(opts.pollIntervalMs ?? 2000);
  }
  throw new Error("tiktok inbox upload timed out");
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
