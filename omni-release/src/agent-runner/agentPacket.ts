export interface MediaItem {
  file: string;
  mime: string;
  filename?: string | null;
  duration_sec?: number | null;
  aspect_ratio?: string | null;
  thumbnail?: string | null;
}

export interface AgentPacket {
  schema_version?: number;
  source?: string;
  generated_at?: string;
  job_id?: string;
  target_id?: string | null;
  post_id?: string | null;
  platform?: string | null;
  post_type?: string | null;
  publish_surface?: string | null;
  platform_url?: string | null;
  playbook?: string | null;
  required_identity?: string | null;
  brief?: string | null;
  content?: Record<string, unknown>;
  media?: Record<string, unknown>;
  release?: unknown;
  delivery?: unknown;
  files?: Record<string, unknown>;
  checklist?: string[];
  human_gates?: string[];
  result_contract?: Record<string, unknown>;
}

export interface AgentCardForPacket {
  job_id: string;
  idempotency_key?: string | null;
  target_id?: string | null;
  post_id?: string | null;
  platform: string;
  scheduled_for?: string | null;
  timezone?: string | null;
  caption?: string | null;
  title?: string | null;
  hashtags?: string[] | string | null;
  privacy?: string | null;
  link?: string | null;
  cta?: string | null;
  media?: MediaItem[];
  options?: Record<string, unknown>;
  agent?: AgentPacket | null;
  release?: unknown;
  delivery?: unknown;
}

export type AgentValidationStatus = "pass" | "warn" | "block";

export interface AgentValidation {
  status: AgentValidationStatus;
  blocks: string[];
  warnings: string[];
}

export interface AgentValidationOptions {
  mediaExists?: (item: MediaItem) => boolean | undefined;
}

const SURFACE_URLS: Record<string, string> = {
  youtube_community_post: "https://www.youtube.com/@MakeShipHappenTech/posts",
  youtube_video_upload: "https://studio.youtube.com",
  x_post: "https://x.com/compose/post",
  linkedin_profile_post: "https://www.linkedin.com/feed/",
  facebook_page_post: "https://www.facebook.com/profile.php?id=61589607458265",
  instagram_browser_post: "https://www.instagram.com/",
  tiktok_studio_video_upload: "https://www.tiktok.com/upload",
  rumble_video_upload: "https://rumble.com/upload.php",
};

const PLATFORM_FALLBACK_SURFACES: Record<string, string> = {
  x: "x_post",
  linkedin: "linkedin_profile_post",
  facebook: "facebook_page_post",
  instagram: "instagram_browser_post",
  tiktok: "tiktok_studio_video_upload",
  rumble: "rumble_video_upload",
};

const PLAYBOOKS: Record<string, string> = {
  youtube_community_post: "docs/platform-playbooks/youtube-community-post.md",
  youtube_video_upload: "docs/platform-playbooks/youtube-community-post.md#youtube-routing-rule",
  x_post: "docs/platform-playbooks/x-post.md",
  linkedin_profile_post: "docs/platform-playbooks/linkedin-post.md",
  facebook_page_post: "docs/platform-playbooks/facebook-post.md",
  instagram_browser_post: "docs/platform-playbooks/instagram-browser-post.md",
  tiktok_studio_video_upload: "docs/platform-playbooks/tiktok-upload.md",
  rumble_video_upload: "docs/platform-playbooks/rumble-video-upload.md",
};

const REQUIRED_IDENTITIES: Record<string, string> = {
  youtube_community_post: "MakeShipHappenTech YouTube channel",
  youtube_video_upload: "MakeShipHappenTech YouTube channel",
  x_post: "@1MakeShipHappen",
  linkedin_profile_post: "Jacob Felton LinkedIn profile",
  facebook_page_post: "Make Ship Happen Tech Facebook Page",
  instagram_browser_post: "MakeShipHappenTech Instagram account",
  tiktok_studio_video_upload: "MakeShipHappen TikTok account",
  rumble_video_upload: "MakeShipHappen Rumble account",
};

export function hasMediaPrefix(card: AgentCardForPacket, prefix: string): boolean {
  return (card.media ?? []).some((item) => item.mime.startsWith(prefix));
}

function firstVideo(card: AgentCardForPacket): MediaItem | undefined {
  return (card.media ?? []).find((item) => item.mime.startsWith("video/"));
}

function isVerticalShort(aspectRatio: string | null | undefined): boolean {
  const normalized = (aspectRatio ?? "").replace(/\s/g, "");
  return normalized === "9:16" || normalized === "3:4" || normalized === "4:5";
}

export function isShortVideo(card: AgentCardForPacket): boolean {
  const video = firstVideo(card);
  if (!video) return false;
  return (video.duration_sec ?? Number.POSITIVE_INFINITY) <= 61 && isVerticalShort(video.aspect_ratio);
}

export function publishSurface(card: AgentCardForPacket): string {
  const packetSurface = card.agent?.publish_surface;
  if (packetSurface) return packetSurface;

  if (card.platform === "youtube") {
    const explicit = card.options?.publishSurface;
    if (typeof explicit === "string" && explicit.trim()) return explicit;
    return hasMediaPrefix(card, "video/") ? "youtube_video_upload" : "youtube_community_post";
  }

  return PLATFORM_FALLBACK_SURFACES[card.platform] ?? card.platform;
}

export function platformUrl(card: AgentCardForPacket): string | null {
  if (card.agent?.platform_url) return card.agent.platform_url;
  return SURFACE_URLS[publishSurface(card)] ?? null;
}

export function postType(card: AgentCardForPacket): string {
  if (card.agent?.post_type) return card.agent.post_type;
  const surface = publishSurface(card);

  if (hasMediaPrefix(card, "video/")) {
    if (isShortVideo(card)) return "short_video";
    if (surface.endsWith("video_upload") || surface === "youtube_video_upload") return "video_upload";
    return "video_post";
  }

  if (hasMediaPrefix(card, "image/")) return "image_post";
  if ((card.link ?? "").trim()) return "link_post";
  return "regular_post";
}

export function hashtagText(card: AgentCardForPacket): string {
  const raw = card.hashtags;
  if (Array.isArray(raw)) return raw.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
  if (typeof raw === "string") return raw.trim();
  return "";
}

export function postText(card: AgentCardForPacket): string {
  const tags = hashtagText(card);
  const caption = (card.caption ?? "").trim();
  if (!caption) return tags;
  return tags && !caption.includes(tags) ? `${caption}\n\n${tags}` : caption;
}

function mediaKind(card: AgentCardForPacket): string {
  const media = card.media ?? [];
  if (media.length === 0) return "none";
  const hasVideo = hasMediaPrefix(card, "video/");
  const hasImage = hasMediaPrefix(card, "image/");
  if (media.length === 1 && hasVideo) return "video";
  if (media.length === 1 && hasImage) return "image";
  if (hasVideo && hasImage) return "mixed";
  if (hasVideo) return "video_carousel";
  if (hasImage) return "image_carousel";
  return "file";
}

function requiredMediaKind(card: AgentCardForPacket): string {
  const surface = publishSurface(card);
  const type = postType(card);
  if (surface === "youtube_video_upload" || surface === "tiktok_studio_video_upload" || surface === "rumble_video_upload") return "video";
  if (surface === "instagram_browser_post") return "image_or_video";
  if (type === "short_video" || type === "video_upload" || type === "video_post") return "video";
  if (type === "image_post") return "image";
  return "optional";
}

function validationStatus(blocks: string[], warnings: string[]): AgentValidationStatus {
  if (blocks.length > 0) return "block";
  if (warnings.length > 0) return "warn";
  return "pass";
}

function mediaLabel(kind: string): string {
  switch (kind) {
    case "video":
      return "video";
    case "image":
      return "image";
    case "none":
      return "no media";
    case "mixed":
      return "mixed media";
    case "video_carousel":
      return "video carousel media";
    case "image_carousel":
      return "image carousel media";
    default:
      return kind || "unknown media";
  }
}

export function agentValidationForCard(card: AgentCardForPacket, options: AgentValidationOptions = {}): AgentValidation {
  const blocks: string[] = [];
  const warnings: string[] = [];
  const surface = publishSurface(card);
  const type = postType(card);
  const media = card.media ?? [];
  const hasVideo = hasMediaPrefix(card, "video/");
  const hasImage = hasMediaPrefix(card, "image/");
  const required = requiredMediaKind(card);
  const video = firstVideo(card);
  const text = postText(card).trim();

  if (!platformUrl(card)) blocks.push(`No platform URL resolved for ${card.platform}/${surface}.`);
  if (!PLAYBOOKS[surface]) warnings.push(`No platform playbook mapped for ${surface}.`);
  if (!REQUIRED_IDENTITIES[surface]) warnings.push(`No required account identity mapped for ${surface}.`);

  if (!text && !(card.link ?? "").trim() && media.length === 0) {
    blocks.push("No caption, hashtags, link, or media are available for the agent to post.");
  }

  if (required === "video" && !hasVideo) {
    blocks.push(`${surface} requires a video, but this card has ${mediaLabel(mediaKind(card))}.`);
  }
  if (required === "image" && !hasImage) {
    blocks.push(`${surface} requires an image, but this card has ${mediaLabel(mediaKind(card))}.`);
  }
  if (required === "image_or_video" && !hasVideo && !hasImage) {
    blocks.push(`${surface} requires staged image or video media.`);
  }

  for (const item of media) {
    if (!item.file?.trim()) blocks.push("A media item is missing its file path.");
    if (!item.mime?.trim()) warnings.push(`Media item ${item.file || "(unknown file)"} is missing a MIME type.`);
    const exists = options.mediaExists?.(item);
    if (exists === false) blocks.push(`Media file is missing: ${item.file}`);
  }

  if (hasVideo) {
    if (video?.duration_sec == null) warnings.push("Primary video duration is missing; short/video routing cannot be fully verified.");
    if (!video?.aspect_ratio) {
      warnings.push("Primary video aspect ratio is missing; vertical short routing cannot be fully verified.");
    } else if (
      !isVerticalShort(video.aspect_ratio) &&
      (surface === "youtube_video_upload" || surface === "tiktok_studio_video_upload" || surface === "instagram_browser_post")
    ) {
      warnings.push(`Primary video aspect ratio is ${video.aspect_ratio}; short-form upload surfaces expect vertical media.`);
    }
    const duration = video?.duration_sec;
    if (video && type !== "short_video" && isVerticalShort(video.aspect_ratio) && duration != null && duration > 61) {
      warnings.push(`Primary video is vertical but ${duration.toFixed(1)}s, so the local handoff classifies it as ${type}.`);
    }
  }

  return {
    status: validationStatus(blocks, warnings),
    blocks,
    warnings,
  };
}

function mediaRole(index: number, item: MediaItem): string {
  if (index === 0 && item.mime.startsWith("video/")) return "primary_video";
  if (index === 0 && item.mime.startsWith("image/")) return "primary_image";
  if (item.mime.startsWith("video/")) return "supporting_video";
  if (item.mime.startsWith("image/")) return "supporting_image";
  return index === 0 ? "primary_file" : "supporting_file";
}

function agentBrief(card: AgentCardForPacket): string {
  const surface = publishSurface(card);
  switch (surface) {
    case "youtube_video_upload":
      return "Upload the staged video in YouTube Studio using the exact title, caption, visibility, and media from this packet.";
    case "youtube_community_post":
      return "Create a YouTube channel Community post using the exact text and any staged image from this packet.";
    case "tiktok_studio_video_upload":
      return "Upload the staged short/video in TikTok Studio using the exact description from this packet.";
    case "rumble_video_upload":
      return "Upload the staged video to Rumble using the exact title, description, visibility, and media from this packet.";
    case "instagram_browser_post":
      return "Create an Instagram browser post using the exact staged media and caption from this packet.";
    case "facebook_page_post":
      return "Create a Make Ship Happen Tech Facebook Page post using the exact text and staged media from this packet.";
    case "linkedin_profile_post":
      return "Create a LinkedIn profile post using the exact text and staged media from this packet.";
    case "x_post":
      return "Create an X post using the exact text and staged media from this packet.";
    default:
      return `Publish this ${postType(card)} to ${card.platform} using the exact card payload.`;
  }
}

function checklistFor(card: AgentCardForPacket): string[] {
  const surface = publishSurface(card);
  const type = postType(card);
  const steps = [
    "Read agent.json first, then card.json only if extra raw detail is needed.",
    "Open platform_url in Jake's signed-in Chrome session.",
    "Confirm the required account/page identity before entering content.",
    "Use content.full_text exactly; do not rewrite or summarize.",
  ];
  if ((card.media ?? []).length > 0) {
    steps.push("Attach the exact staged media path from media.items; do not substitute files.");
  }
  if (surface === "youtube_video_upload" || surface === "rumble_video_upload") {
    steps.push("Use content.title for the video title; use content.full_text for the description.");
  }
  if (type === "short_video") {
    steps.push("Treat the vertical under-61-second video as short-form content where the platform supports it.");
  }
  steps.push("Stop before posting if login, 2FA, CAPTCHA, checkpoint, missing media, rejected media, or changed UI blocks proof.");
  steps.push("Only write posted after the platform shows the trained success signal.");
  return steps;
}

function titleFor(card: AgentCardForPacket): string {
  const explicit = (card.title ?? "").trim();
  if (explicit) return explicit;
  const firstLine = (card.caption ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return (firstLine ?? card.media?.[0]?.filename ?? card.job_id).slice(0, 95);
}

export function agentPacketForCard(card: AgentCardForPacket, jobDir?: string): AgentPacket {
  const surface = publishSurface(card);
  const type = postType(card);
  const mediaItems = (card.media ?? []).map((item, index) => ({
    ...item,
    role: mediaRole(index, item),
    relative_path: item.file,
    absolute_path: jobDir ? `${jobDir}/${item.file}` : undefined,
    short_candidate: item.mime.startsWith("video/") && (item.duration_sec ?? Number.POSITIVE_INFINITY) <= 61 && isVerticalShort(item.aspect_ratio),
  }));

  return {
    schema_version: 1,
    source: "omni-release.agent-handoff",
    generated_at: new Date().toISOString(),
    job_id: card.job_id,
    target_id: card.target_id ?? null,
    post_id: card.post_id ?? null,
    platform: card.platform,
    post_type: type,
    publish_surface: surface,
    platform_url: platformUrl(card),
    playbook: PLAYBOOKS[surface] ?? null,
    required_identity: REQUIRED_IDENTITIES[surface] ?? "platform account from the due card",
    brief: agentBrief(card),
    content: {
      title: titleFor(card),
      caption: card.caption ?? null,
      hashtags: Array.isArray(card.hashtags) ? card.hashtags : hashtagText(card) ? [hashtagText(card)] : [],
      full_text: postText(card),
      privacy: card.privacy ?? "public",
      link: card.link ?? null,
      cta: card.cta ?? null,
    },
    media: {
      kind: mediaKind(card),
      required: requiredMediaKind(card),
      count: card.media?.length ?? 0,
      is_short_video: isShortVideo(card),
      primary: mediaItems[0] ?? null,
      items: mediaItems,
    },
    release: card.release ?? null,
    delivery: card.delivery ?? null,
    files: {
      card: "card.json",
      agent_packet: "agent.json",
      result: `../../done/${card.job_id}.result.json`,
      screenshot: `../../done/${card.job_id}.png`,
    },
    checklist: checklistFor(card),
    human_gates: [
      "login_required",
      "two_factor_required",
      "captcha_or_checkpoint",
      "wrong_identity",
      "missing_media",
      "media_rejected",
      "upload_stalled",
      "composer_not_found",
      "success_missing",
      "ui_changed",
    ],
    result_contract: {
      write_path: `outbox/done/${card.job_id}.result.json`,
      posted_requires_external_url_or_visible_proof: true,
      outcomes: ["posted", "failed", "needs_attention"],
      needs_attention_keeps_due_card_live: true,
    },
  };
}
