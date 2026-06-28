// YouTube Data API v3 publisher — resumable video upload + optional thumbnail.
// All network I/O goes through an injectable `fetch` so the flow is unit-testable
// without hitting Google. The caller supplies a valid OAuth access token (the
// worker decrypts it from the token vault just-in-time).
//
// Docs: videos.insert (resumable), thumbnails.set. Quota: an upload ~1600 units.

export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export interface VideoMetadata {
  title: string;
  description?: string;
  tags?: string[];
  categoryId?: string; // default "22" (People & Blogs)
  privacyStatus?: "public" | "unlisted" | "private";
  /** ISO time; when set, video uploads as private and goes public then. */
  publishAt?: string;
  madeForKids?: boolean;
}

export interface MediaBytes {
  bytes: Uint8Array;
  mimeType: string;
}

export interface UploadResult {
  videoId: string;
  url: string;
}

const UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

/** Build the snippet/status body YouTube expects for videos.insert. */
export function buildVideoResource(meta: VideoMetadata): Record<string, unknown> {
  const status: Record<string, unknown> = {
    privacyStatus: meta.publishAt ? "private" : meta.privacyStatus ?? "private",
    selfDeclaredMadeForKids: meta.madeForKids ?? false,
  };
  if (meta.publishAt) status.publishAt = meta.publishAt;
  return {
    snippet: {
      title: meta.title.slice(0, 100), // YouTube title hard limit
      description: meta.description ?? "",
      tags: meta.tags ?? [],
      categoryId: meta.categoryId ?? "22",
    },
    status,
  };
}

/**
 * Resumable upload: (1) POST metadata → receive upload URL in Location header,
 * (2) PUT the bytes → receive the video resource. Returns the id + watch URL.
 * Throws on any non-OK response (caller records the failure honestly).
 */
export async function uploadVideo(
  accessToken: string,
  media: MediaBytes,
  meta: VideoMetadata,
  fetchImpl: FetchImpl,
): Promise<UploadResult> {
  const init = await fetchImpl(UPLOAD_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "x-upload-content-type": media.mimeType,
      "x-upload-content-length": String(media.bytes.byteLength),
    },
    body: JSON.stringify(buildVideoResource(meta)),
  });
  if (!init.ok) {
    throw new Error(`youtube init failed: ${init.status} ${await safeText(init)}`);
  }
  const location = init.headers.get("location");
  if (!location) throw new Error("youtube init: missing resumable upload URL (Location header)");

  const put = await fetchImpl(location, {
    method: "PUT",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": media.mimeType },
    body: media.bytes as unknown as BodyInit,
  });
  if (!put.ok) throw new Error(`youtube upload failed: ${put.status} ${await safeText(put)}`);

  const resource = (await put.json()) as { id?: string };
  if (!resource.id) throw new Error("youtube upload: response missing video id");
  return { videoId: resource.id, url: `https://youtu.be/${resource.id}` };
}

/** Set a custom thumbnail (requires a verified channel). Best-effort. */
export async function setThumbnail(
  accessToken: string,
  videoId: string,
  thumb: MediaBytes,
  fetchImpl: FetchImpl,
): Promise<void> {
  const url = `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": thumb.mimeType },
    body: thumb.bytes as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`youtube thumbnail failed: ${res.status} ${await safeText(res)}`);
}

async function safeText(r: Response): Promise<string> {
  try {
    return (await r.text()).slice(0, 300);
  } catch {
    return "";
  }
}
