// Server-side publisher contract. Mirrors the app's Rust contract: never throws
// to the caller, never fakes success. YouTube is the one fully-verified live
// route; the other platform modules are code-complete + unit-tested but their
// OAuth apps are not provisioned yet (providers carry verified:false). Twitch has
// no video-upload API at all, so it fails honestly with a clear reason.

import { uploadVideo, type FetchImpl, type MediaBytes } from "./youtube.js";
import { publishVideo as xPublishVideo } from "./x.js";
import { publishVideo as tiktokPublishVideo, type TikTokPrivacy } from "./tiktok.js";
import { uploadFacebookVideo, publishInstagramReel } from "./meta.js";

export interface PublishInput {
  platform: string;
  media: MediaBytes;
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

export async function publish(input: PublishInput, fetchImpl: FetchImpl): Promise<PublishResult> {
  try {
    switch (input.platform) {
      case "youtube": {
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
        const res = await xPublishVideo(
          input.accessToken,
          input.media,
          withHashtags(input.caption, input.hashtags),
          fetchImpl,
        );
        return { outcome: "success", externalId: res.postId, externalUrl: res.url };
      }

      case "tiktok": {
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
        const res = await uploadFacebookVideo(
          input.pageId,
          input.accessToken,
          input.media,
          { title: input.title, description: withHashtags(input.caption, input.hashtags) },
          fetchImpl,
        );
        return { outcome: "success", externalId: res.externalId, externalUrl: res.url };
      }

      case "instagram": {
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
