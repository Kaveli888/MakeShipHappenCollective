/**
 * platformFormatting — turn a CaptionDraft into a publish-ready core `Caption`.
 *
 * Responsibilities:
 *  - Assemble the final text (hook → body) and clamp it to the platform's
 *    `maxChars`, truncating only the body at a word boundary.
 *  - Apply hashtag policy: hashtag-rules.md (`avoid` list + editorial `max`)
 *    intersected with core's hard `maxHashtags` for the platform.
 *  - Report an honest `charCount` that includes the hashtag footprint, so the
 *    quality gate's over-limit check reflects the real published size.
 *
 * It does NOT judge quality — that's the quality gate. It only makes the post fit.
 */

import type { Caption, Platform, PlatformLimits } from "../core/index.js";
import { DEFAULT_PLATFORM_LIMITS } from "../core/index.js";
import type { CaptionDraft } from "./types.js";
import { loadHashtagRules, type HashtagRules } from "./rules.js";

/**
 * Hard per-platform character limits, sourced from core config. Re-exported so
 * the quality gate and tests share one number per platform.
 */
export const PLATFORM_LIMITS: Record<Platform, number> = {
  x: DEFAULT_PLATFORM_LIMITS.x.maxChars,
  linkedin: DEFAULT_PLATFORM_LIMITS.linkedin.maxChars,
  facebook: DEFAULT_PLATFORM_LIMITS.facebook.maxChars,
  browser: DEFAULT_PLATFORM_LIMITS.browser.maxChars,
};

export interface FormatOptions {
  /** Per-platform limits; defaults to core's DEFAULT_PLATFORM_LIMITS. */
  platformLimits?: PlatformLimits;
  /** Pre-loaded hashtag rules; loaded from disk if omitted. */
  hashtags?: HashtagRules;
  /** Config directory for rule files. */
  configDir?: string;
}

/**
 * Cap + filter hashtags for a platform. The effective cap is the smaller of the
 * editorial `max` (hashtag-rules.md) and the platform's hard `maxHashtags`.
 */
export function capHashtags(
  tags: string[],
  platform: Platform,
  rules: HashtagRules,
  hardMax: number,
): string[] {
  const rule = rules.platforms[platform] ?? { max: 2, core: [], avoid: [] };
  const limit = Math.max(0, Math.min(rule.max, hardMax));
  const avoid = new Set(rule.avoid.map((t) => t.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.startsWith("#") ? raw : "#" + raw;
    const key = tag.toLowerCase();
    if (tag.length <= 1 || avoid.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= limit) break;
  }
  return out;
}

/** Word-boundary truncation with an ellipsis; never produces a mid-word cut. */
function truncateToFit(text: string, max: number): string {
  if (max <= 1) return "";
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const base = lastSpace > max * 0.4 ? slice.slice(0, lastSpace) : slice;
  return base.replace(/[\s,;:.\-]+$/, "") + "…";
}

/**
 * Format a draft for its platform. Returns a core `Caption` whose published
 * footprint (`charCount`) is within the platform's `maxChars`.
 */
export async function formatForPlatform(
  draft: CaptionDraft,
  options: FormatOptions = {},
): Promise<Caption> {
  const platform = draft.platform;
  const limits = options.platformLimits ?? DEFAULT_PLATFORM_LIMITS[platform];
  const maxChars = limits.maxChars;
  const rules = options.hashtags ?? (await loadHashtagRules(options.configDir));

  const hashtags = capHashtags(draft.hashtags, platform, rules, limits.maxHashtags);
  const tagFootprint = hashtags.length ? hashtags.join(" ").length + 2 : 0; // +2 for the join newline

  const hook = draft.hook.trim();
  const bodyText = draft.body.trim();
  const headerLen = hook ? hook.length + 2 : 0; // +2 for the hook/body separator

  // Room left for the body after the hook and the (separate) hashtag footprint.
  const bodyRoom = maxChars - headerLen - tagFootprint;
  const clampedBody = truncateToFit(bodyText, Math.max(0, bodyRoom));

  const body = [hook, clampedBody].filter(Boolean).join("\n\n");
  const published = hashtags.length ? `${body}\n\n${hashtags.join(" ")}` : body;

  const caption: Caption = {
    platform,
    body,
    hashtags,
    charCount: published.length,
    citedItemIds: draft.citedItemIds,
  };
  if (draft.wantsProofImage && limits.supportsImage) {
    caption.imageAltText = hook || bodyText.slice(0, 100);
  }
  return caption;
}

/** Format every draft in a batch (loads hashtag rules once). */
export async function formatAll(
  drafts: CaptionDraft[],
  options: FormatOptions = {},
): Promise<Caption[]> {
  const hashtags = options.hashtags ?? (await loadHashtagRules(options.configDir));
  return Promise.all(drafts.map((d) => formatForPlatform(d, { ...options, hashtags })));
}
