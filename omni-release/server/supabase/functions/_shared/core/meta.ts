// Meta video publishers — Facebook Pages (resumable upload) and Instagram Reels
// (hosted-URL container). All network I/O goes through an injectable `fetch` so
// the flows are unit-testable without hitting the Graph API.
//
// Two important platform realities baked in here:
//  • Facebook Page video uses the resumable upload protocol (start→transfer→finish)
//    against /{page_id}/videos and needs a PAGE access token (not the user token).
//  • Instagram cannot accept raw bytes. It pulls the video from a public URL you
//    host (e.g. our Supabase Storage signed URL): create a REELS container with
//    video_url → poll status_code until FINISHED → media_publish.
//
// ⚠️ provider.verified is false until tested against a real Meta app + page/IG
// business account.

import type { FetchImpl, MediaBytes } from "./youtube.ts";

const GRAPH = "https://graph.facebook.com/v21.0";

export interface MetaPublishResult {
  externalId: string;
  url: string;
}

/* ----------------------------- Facebook Pages ----------------------------- */

interface FbStartResponse {
  video_id?: string;
  upload_session_id?: string;
  start_offset?: string;
  end_offset?: string;
}

/**
 * Resumable Page video upload. `pageId` + `pageToken` identify the Page; the
 * token must be a Page access token with pages_manage_posts.
 */
export async function uploadFacebookVideo(
  pageId: string,
  pageToken: string,
  media: MediaBytes,
  meta: { description?: string; title?: string },
  fetchImpl: FetchImpl,
): Promise<MetaPublishResult> {
  const endpoint = `${GRAPH}/${encodeURIComponent(pageId)}/videos`;
  const total = media.bytes.byteLength;

  // Phase 1: start
  const startForm = new URLSearchParams({
    upload_phase: "start",
    access_token: pageToken,
    file_size: String(total),
  });
  const startRes = await fetchImpl(endpoint, { method: "POST", body: startForm });
  if (!startRes.ok) throw new Error(`facebook start failed: ${startRes.status} ${await safeText(startRes)}`);
  const start = (await startRes.json()) as FbStartResponse;
  const sessionId = start.upload_session_id;
  const videoId = start.video_id;
  if (!sessionId || !videoId) throw new Error("facebook start: missing upload_session_id/video_id");

  // Phase 2: transfer (single chunk — Graph accepts the whole file for modest sizes)
  let startOffset = Number(start.start_offset ?? 0);
  let endOffset = Number(start.end_offset ?? total);
  while (startOffset < endOffset) {
    const slice = media.bytes.subarray(startOffset, endOffset);
    const form = new FormData();
    form.set("upload_phase", "transfer");
    form.set("access_token", pageToken);
    form.set("upload_session_id", sessionId);
    form.set("start_offset", String(startOffset));
    form.set("video_file_chunk", new Blob([slice as unknown as BlobPart], { type: media.mimeType }));
    const tr = await fetchImpl(endpoint, { method: "POST", body: form });
    if (!tr.ok) throw new Error(`facebook transfer failed: ${tr.status} ${await safeText(tr)}`);
    const next = (await tr.json()) as FbStartResponse;
    const ns = Number(next.start_offset ?? endOffset);
    const ne = Number(next.end_offset ?? endOffset);
    if (ns === startOffset && ne === endOffset) break; // no progress signalled → done
    startOffset = ns;
    endOffset = ne;
  }

  // Phase 3: finish
  const finForm = new URLSearchParams({
    upload_phase: "finish",
    access_token: pageToken,
    upload_session_id: sessionId,
  });
  if (meta.description) finForm.set("description", meta.description);
  if (meta.title) finForm.set("title", meta.title);
  const fin = await fetchImpl(endpoint, { method: "POST", body: finForm });
  if (!fin.ok) throw new Error(`facebook finish failed: ${fin.status} ${await safeText(fin)}`);

  return { externalId: videoId, url: `https://www.facebook.com/${videoId}` };
}

/* ------------------------------- Instagram -------------------------------- */

/**
 * Instagram Reels via a publicly reachable video URL (Meta pulls it server-side).
 * `igUserId` is the IG business account id; `userToken` needs
 * instagram_content_publish. Polls the container until FINISHED, then publishes.
 */
export async function publishInstagramReel(
  igUserId: string,
  userToken: string,
  videoUrl: string,
  caption: string,
  fetchImpl: FetchImpl,
  opts: { pollIntervalMs?: number; maxPolls?: number } = {},
): Promise<MetaPublishResult> {
  // 1. create container
  const createForm = new URLSearchParams({
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: userToken,
  });
  const create = await fetchImpl(`${GRAPH}/${encodeURIComponent(igUserId)}/media`, {
    method: "POST",
    body: createForm,
  });
  if (!create.ok) throw new Error(`instagram container failed: ${create.status} ${await safeText(create)}`);
  const creationId = ((await create.json()) as { id?: string }).id;
  if (!creationId) throw new Error("instagram container: response missing creation id");

  // 2. poll status_code until FINISHED
  const maxPolls = opts.maxPolls ?? 30;
  let ready = false;
  for (let i = 0; i < maxPolls; i++) {
    const st = await fetchImpl(
      `${GRAPH}/${encodeURIComponent(creationId)}?fields=status_code&access_token=${encodeURIComponent(userToken)}`,
      { method: "GET" },
    );
    if (!st.ok) throw new Error(`instagram status failed: ${st.status} ${await safeText(st)}`);
    const code = ((await st.json()) as { status_code?: string }).status_code;
    if (code === "FINISHED") {
      ready = true;
      break;
    }
    if (code === "ERROR" || code === "EXPIRED") throw new Error(`instagram container ${code}`);
    await delay(opts.pollIntervalMs ?? 3000);
  }
  if (!ready) throw new Error("instagram container processing timed out");

  // 3. publish
  const pubForm = new URLSearchParams({ creation_id: creationId, access_token: userToken });
  const pub = await fetchImpl(`${GRAPH}/${encodeURIComponent(igUserId)}/media_publish`, {
    method: "POST",
    body: pubForm,
  });
  if (!pub.ok) throw new Error(`instagram publish failed: ${pub.status} ${await safeText(pub)}`);
  const mediaId = ((await pub.json()) as { id?: string }).id;
  if (!mediaId) throw new Error("instagram publish: response missing media id");
  return { externalId: mediaId, url: `https://www.instagram.com/reel/${mediaId}` };
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
