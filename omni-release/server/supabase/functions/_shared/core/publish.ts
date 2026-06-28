// Server-side publisher contract. Mirrors the app's Rust contract: never throws
// to the caller, never fakes success. YouTube is the one fully-verified live
// route; the other platform modules are code-complete + unit-tested but their
// OAuth apps are not provisioned yet (providers carry verified:false). Twitch has
// no video-upload API at all, so it fails honestly with a clear reason.

import { uploadVideo, type FetchImpl, type MediaBytes } from "./youtube.ts";
import { publishVideo as xPublishVideo, publishText as xPublishText } from "./x.ts";
import { publishVideo as tiktokPublishVideo, type TikTokPrivacy } from "./tiktok.ts";
import { uploadFacebookVideo, publishFacebookText, publishInstagramReel } from "./meta.ts";
import { publishText as liPublishText, publishVideo as liPublishVideo } from "./linkedin.ts";

export interface PublishInput {
  platform: string;
  /** Omitted for text-only posts (X / Facebook / LinkedIn). */
  media?: MediaBytes;
  title: string;
  caption: string;
  hashtags: string[];
  privacy?: "public" | "unlisted" | "private";
  publishAt?: string;
  categoryId?: string;
  accessToken: string;
  /** Facebook: target Page id (token must be that Page's access token). */
  pageId?: string;
  /** Instagram: IG business account id. */
  igUserId?: string;
  /** Instagram: public URL the Graph API can pull the video from (Storage signed URL). */
  mediaUrl?: string;
  /** LinkedIn: author person URN (urn:li:person:{id}) from the connected account. */
  authorUrn?: string;
}

export interface PublishResult {
  outcome: "success" | "failure";
  externalId?: string;
  externalUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

/** Compose the description/caption body: caption + hashtags. */
function withHashtags(caption: string, hashtags: string[]): string {
  const tags = hashtags.length ? `\n\n${hashtags.join(" ")}` : "";
  return `${caption}${tags}`.trim();
}

/** Map our generic privacy to TikTok's privacy levels (default private/SELF_ONLY). */
function tiktokPrivacy(p?: PublishInput["privacy"]): TikTokPrivacy {
  return p === "public" ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY";
}

/** A video is attached when media bytes are present. */
function hasMedia(input: PublishInput): input is PublishInput & { media: MediaBytes } {
  return !!input.media && input.media.bytes.byteLength > 0;
}

const NEEDS_VIDEO = (platform: string): PublishResult => ({
  outcome: "failure",
  errorCode: "media_required",
  errorMessage: `${platform} requires a video — text-only posts aren't supported there.`,
});

export async function publish(input: PublishInput, fetchImpl: FetchImpl): Promise<PublishResult> {
  try {
    switch (input.platform) {
      case "youtube": {
        if (!hasMedia(input)) return NEEDS_VIDEO("YouTube");
        const res = await uploadVideo(
          input.accessToken,
          input.media,
          {
            title: input.title || "Untitled",
            description: withHashtags(input.caption, input.hashtags),
            tags: input.hashtags.map((h) => h.replace(/^#/, "")),
            privacyStatus: input.privacy ?? "private",
            publishAt: input.publishAt,
            categoryId: input.categoryId,
          },
          fetchImpl,
        );
        return { outcome: "success", externalId: res.videoId, externalUrl: res.url };
      }

      case "x": {
        const text = withHashtags(input.caption, input.hashtags);
        const res = hasMedia(input)
          ? await xPublishVideo(input.accessToken, input.media, text, fetchImpl)
          : await xPublishText(input.accessToken, text, fetchImpl);
        return { outcome: "success", externalId: res.postId, externalUrl: res.url };
      }

      case "linkedin": {
        if (!input.authorUrn) {
          return { outcome: "failure", errorCode: "missing_author", errorMessage: "LinkedIn publishing needs the connected account's author URN." };
        }
        const text = withHashtags(input.caption, input.hashtags);
        const res = hasMedia(input)
          ? await liPublishVideo(input.accessToken, input.authorUrn, input.media, text, fetchImpl)
          : await liPublishText(input.accessToken, input.authorUrn, text, fetchImpl);
        return { outcome: "success", externalId: res.externalId, externalUrl: res.url };
      }

      case "tiktok": {
        if (!hasMedia(input)) return NEEDS_VIDEO("TikTok");
        const res = await tiktokPublishVideo(
          input.accessToken,
          input.media,
          { title: input.title || withHashtags(input.caption, input.hashtags), privacy: tiktokPrivacy(input.privacy) },
          fetchImpl,
        );
        return {
          outcome: "success",
          externalId: res.publishId,
          externalUrl: res.url ?? undefined,
        };
      }

      case "facebook": {
        if (!input.pageId) {
          return { outcome: "failure", errorCode: "missing_page_id", errorMessage: "Facebook publishing needs a target Page id." };
        }
        const body = withHashtags(input.caption, input.hashtags);
        const res = hasMedia(input)
          ? await uploadFacebookVideo(input.pageId, input.accessToken, input.media, { title: input.title, description: body }, fetchImpl)
          : await publishFacebookText(input.pageId, input.accessToken, body, fetchImpl);
        return { outcome: "success", externalId: res.externalId, externalUrl: res.url };
      }

      case "instagram": {
        if (!hasMedia(input)) return NEEDS_VIDEO("Instagram");
        if (!input.igUserId || !input.mediaUrl) {
          return {
            outcome: "failure",
            errorCode: "missing_ig_params",
            errorMessage: "Instagram publishing needs an IG business account id and a public media URL.",
          };
        }
        const res = await publishInstagramReel(
          input.igUserId,
          input.accessToken,
          input.mediaUrl,
          withHashtags(input.caption, input.hashtags),
          fetchImpl,
        );
        return { outcome: "success", externalId: res.externalId, externalUrl: res.url };
      }

      case "twitch": {
        // Twitch has no public video-upload API (VODs are produced from live
        // streams). Fail honestly rather than pretend.
        return {
          outcome: "failure",
          errorCode: "unsupported_platform",
          errorMessage: "Twitch does not offer a video-upload API; VODs come from live streams.",
        };
      }

      default:
        return {
          outcome: "failure",
          errorCode: "not_implemented",
          errorMessage: `Live publishing to ${input.platform} is not implemented yet.`,
        };
    }
  } catch (e) {
    return {
      outcome: "failure",
      errorCode: "publish_error",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}
