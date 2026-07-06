import { describe, expect, it } from "vitest";
import {
  agentPacketForCard,
  agentValidationForCard,
  platformUrl,
  postText,
  postType,
  publishSurface,
} from "../src/agent-runner/agentPacket.js";

describe("agent handoff packet resolver", () => {
  it("routes vertical short video cards to video upload surfaces", () => {
    const card = {
      job_id: "job_short",
      platform: "youtube",
      caption: "ShipSpace short",
      hashtags: ["#ai", "builders"],
      media: [
        {
          file: "media/clip.mp4",
          mime: "video/mp4",
          duration_sec: 20.9,
          aspect_ratio: "9:16",
        },
      ],
      options: {},
    };

    expect(publishSurface(card)).toBe("youtube_video_upload");
    expect(postType(card)).toBe("short_video");
    expect(platformUrl(card)).toBe("https://studio.youtube.com");
    expect(postText(card)).toBe("ShipSpace short\n\n#ai #builders");

    const packet = agentPacketForCard(card, "/tmp/outbox/due/job_short");
    expect(packet.post_type).toBe("short_video");
    expect(packet.publish_surface).toBe("youtube_video_upload");
    expect(packet.content?.full_text).toBe("ShipSpace short\n\n#ai #builders");
    expect(packet.media?.primary).toMatchObject({
      role: "primary_video",
      absolute_path: "/tmp/outbox/due/job_short/media/clip.mp4",
      short_candidate: true,
    });
  });

  it("routes text-only YouTube cards to Community posts", () => {
    const card = {
      job_id: "job_text",
      platform: "youtube",
      caption: "Regular update",
      hashtags: [],
      media: [],
      options: {},
    };

    expect(publishSurface(card)).toBe("youtube_community_post");
    expect(postType(card)).toBe("regular_post");
    expect(platformUrl(card)).toBe("https://www.youtube.com/@MakeShipHappenTech/posts");
  });

  it("lets an embedded agent packet override legacy inference", () => {
    const card = {
      job_id: "job_packet",
      platform: "youtube",
      caption: "Packet wins",
      media: [],
      options: {},
      agent: {
        post_type: "image_post",
        publish_surface: "youtube_community_post",
        platform_url: "https://example.test/custom",
      },
    };

    expect(publishSurface(card)).toBe("youtube_community_post");
    expect(postType(card)).toBe("image_post");
    expect(platformUrl(card)).toBe("https://example.test/custom");
  });

  it("passes a complete short video handoff", () => {
    const card = {
      job_id: "job_ready_short",
      platform: "tiktok",
      caption: "Ready short",
      media: [
        {
          file: "media/clip.mp4",
          mime: "video/mp4",
          duration_sec: 26.8,
          aspect_ratio: "9:16",
        },
      ],
      options: {},
    };

    const validation = agentValidationForCard(card, { mediaExists: () => true });
    expect(validation.status).toBe("pass");
    expect(validation.blocks).toEqual([]);
  });

  it("blocks upload surfaces that are missing required video", () => {
    const card = {
      job_id: "job_missing_video",
      platform: "rumble",
      caption: "No video here",
      media: [],
      options: {},
    };

    const validation = agentValidationForCard(card);
    expect(validation.status).toBe("block");
    expect(validation.blocks.join("\n")).toContain("requires a video");
  });
});
