// LinkedIn publisher — text and video posts via the versioned REST API.
//   Text:  POST https://api.linkedin.com/rest/posts
//   Video: POST /rest/videos?action=initializeUpload → PUT chunk(s) → finalizeUpload
//          → POST /rest/posts referencing the video URN.
// The author is a person URN (urn:li:person:{id}); {id} is the OIDC `sub` we
// store as the account's external_account_id at connect time. Needs the
// w_member_social scope. Never fakes success; throws with a readable reason.

import type { FetchImpl, MediaBytes } from "./youtube.js";

const REST = "https://api.linkedin.com/rest";
// LinkedIn versions its API by YYYYMM and only honors roughly the trailing ~12
// months. This MUST be kept to a currently-supported month or every call 400s.
// Override per-deploy via LINKEDIN_API_VERSION without a code change.
const LINKEDIN_VERSION =
  (typeof process !== "undefined" && process.env?.LINKEDIN_API_VERSION) || "202505";

export interface LinkedInResult {
  externalId: string;
  url: string;
}

function headers(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    "linkedin-version": LINKEDIN_VERSION,
    "x-restli-protocol-version": "2.0.0",
    "content-type": "application/json",
  };
}

/** Build the share URL from a returned post/share/ugc URN. */
function postUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}`;
}

/** Pull the created entity URN from the response (header first, then body). */
async function readPostUrn(res: Response): Promise<string> {
  const hdr = res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id");
  if (hdr) return hdr;
  try {
    const json = (await res.json()) as { id?: string };
    if (json.id) return json.id;
  } catch {
    /* no body */
  }
  throw new Error("linkedin: response missing post id");
}

/** Text-only share. `author` must be a full URN, e.g. urn:li:person:abc123. */
export async function publishText(
  accessToken: string,
  author: string,
  text: string,
  fetchImpl: FetchImpl,
): Promise<LinkedInResult> {
  const body = {
    author,
    commentary: text,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  const res = await fetchImpl(`${REST}/posts`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`linkedin text post failed: ${res.status} ${await safeText(res)}`);
  const urn = await readPostUrn(res);
  return { externalId: urn, url: postUrl(urn) };
}

interface InitUploadResponse {
  value?: {
    video?: string;
    uploadToken?: string;
    uploadInstructions?: Array<{ uploadUrl: string; firstByte: number; lastByte: number }>;
  };
}

/**
 * Video share: initialize an upload, PUT the bytes per instruction (capturing
 * each part's ETag), finalize, then create a post that references the video URN.
 */
export async function publishVideo(
  accessToken: string,
  author: string,
  media: MediaBytes,
  text: string,
  fetchImpl: FetchImpl,
): Promise<LinkedInResult> {
  const total = media.bytes.byteLength;

  // 1. initialize
  const initRes = await fetchImpl(`${REST}/videos?action=initializeUpload`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      initializeUploadRequest: { owner: author, fileSizeBytes: total, uploadCaptions: false, uploadThumbnail: false },
    }),
  });
  if (!initRes.ok) throw new Error(`linkedin video init failed: ${initRes.status} ${await safeText(initRes)}`);
  const init = (await initRes.json()) as InitUploadResponse;
  const videoUrn = init.value?.video;
  const uploadToken = init.value?.uploadToken ?? "";
  const instructions = init.value?.uploadInstructions ?? [];
  if (!videoUrn || !instructions.length) throw new Error("linkedin video init: missing video urn / upload instructions");

  // 2. upload each part, collecting ETags
  const uploadedPartIds: string[] = [];
  for (const inst of instructions) {
    const slice = media.bytes.subarray(inst.firstByte, inst.lastByte + 1);
    const put = await fetchImpl(inst.uploadUrl, {
      method: "PUT",
      // LinkedIn upload URLs are not self-authenticating — the bearer token is
      // required on the PUT (unlike S3 pre-signed URLs).
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": media.mimeType || "application/octet-stream",
      },
      body: slice as unknown as BodyInit,
    });
    if (!put.ok) throw new Error(`linkedin video upload failed: ${put.status} ${await safeText(put)}`);
    const etag = put.headers.get("etag");
    if (!etag) throw new Error("linkedin video upload: missing ETag on uploaded part");
    uploadedPartIds.push(etag.replace(/"/g, ""));
  }

  // 3. finalize
  const fin = await fetchImpl(`${REST}/videos?action=finalizeUpload`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds },
    }),
  });
  if (!fin.ok) throw new Error(`linkedin video finalize failed: ${fin.status} ${await safeText(fin)}`);

  // 4. create the post referencing the video
  const body = {
    author,
    commentary: text,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    content: { media: { id: videoUrn, title: text.slice(0, 100) || "Video" } },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  const res = await fetchImpl(`${REST}/posts`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`linkedin video post failed: ${res.status} ${await safeText(res)}`);
  const urn = await readPostUrn(res);
  return { externalId: urn, url: postUrl(urn) };
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}
