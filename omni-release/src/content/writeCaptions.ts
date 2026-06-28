/**
 * writeCaptions — the writing layer.
 *
 * Turns a `ResearchResult` (t2) into a core `CaptionSet` (t1): one `Caption` per
 * target platform, following the lane's structure and the brand voice rules.
 *
 * Two modes:
 *  - **LLM mode**: pass `complete` (any async text-completion fn). The lane's
 *    system + user prompt are sent and the reply is parsed into hook/body/tags.
 *  - **Deterministic mode** (default): no LLM needed. A template composer builds
 *    captions from the research items following the lane's structural beats —
 *    the mode the dry-run integration (t6) relies on.
 *
 * Either way the output is a core `CaptionSet`; fact-check, the quality gate, and
 * publishing all run identically downstream.
 */

import type { CaptionSet, LaneId, Platform } from "../core/index.js";
import { nowIso } from "../core/index.js";
import type { ResearchItem, ResearchResult } from "../research/index.js";
import type { CaptionDraft, CompleteFn, LanePrompt } from "./types.js";
import { getLanePrompt } from "./lanePrompts.js";
import {
  hashtagGuidanceFor,
  loadAllRules,
  type HashtagRules,
  type VoiceRules,
} from "./rules.js";
import { formatAll } from "./platformFormatting.js";

export interface WriteCaptionsOptions {
  /** Limit to these platforms; defaults to the lane's configured platforms. */
  platforms?: Platform[];
  /** Optional LLM completion fn. If omitted, the deterministic composer is used. */
  complete?: CompleteFn;
  /** Pre-loaded voice rules; loaded from disk if omitted. */
  voice?: VoiceRules;
  /** Pre-loaded hashtag rules; loaded from disk if omitted. */
  hashtags?: HashtagRules;
  /** Config directory for rule files. */
  configDir?: string;
  /** Override the lane id (otherwise taken from `research.lane`). */
  lane?: LaneId;
}

/** Build hashtag candidates from research tags, topped up with the lane's core tags. */
function gatherHashtags(items: ResearchItem[], core: string[], wanted: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const tag = raw.startsWith("#") ? raw : "#" + raw.replace(/[^A-Za-z0-9]/g, "");
    const key = tag.toLowerCase();
    if (tag.length > 1 && !seen.has(key)) {
      seen.add(key);
      out.push(tag);
    }
  };
  for (const it of items) for (const t of it.tags ?? []) add(t);
  for (const c of core) add(c);
  return out.slice(0, Math.max(wanted, 0));
}

/** Trim text to a sentence boundary near `max` chars without cutting mid-word. */
function clampSentence(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (lastStop > max * 0.5) return slice.slice(0, lastStop + 1);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).replace(/[\s,;:.]+$/, "") + "…";
}

const HOOK_PREFIX: Record<string, string> = {
  "ai-daily-shift": "AI overnight",
  "model-watch": "Model watch",
  "evening-battle-card": "Today in AI",
  "proof-drop": "",
  "hot-take": "Take",
  "build-log": "Build log",
  launch: "Launching",
};

/** Compute the lane-level hook from the top item (platform-independent). */
function composeHook(lane: LanePrompt, items: ResearchItem[]): string {
  const top = items[0];
  const prefix = HOOK_PREFIX[lane.lane] ?? "";
  if (!top) return prefix ? `${prefix}: nothing notable to report.` : "Nothing notable to report.";
  return prefix ? `${prefix}: ${top.title}` : top.title;
}

/** Deterministic body composer — follows the lane's beats, ends with CTA + source. */
function composeBody(lane: LanePrompt, items: ResearchItem[]): string {
  const used = items.slice(0, lane.maxItems);
  const top = used[0];
  if (!top) return lane.cta;

  const RANKED_LANES = new Set(["evening-battle-card", "ai-daily-shift", "model-watch"]);
  let core: string;
  if (RANKED_LANES.has(lane.lane)) {
    const ranked = used.map((it, i) => `${i + 1}. ${it.title} — ${it.sourceName}`).join("\n");
    core = `${ranked}\n\nWhy it matters: ${clampSentence(top.summary, 180)}`;
  } else if (used.length > 1 && used[1]) {
    core = `${clampSentence(top.summary, 200)}\n\nAlso: ${clampSentence(used[1].summary, 140)}`;
  } else {
    core = clampSentence(top.summary, 240);
  }

  const source = top.url ? `↳ ${top.url}` : "";
  return [core, lane.cta, source].filter(Boolean).join("\n\n");
}

/** Parse an LLM completion into hook / body / hashtags. */
function parseCompletion(text: string): { hook: string; body: string; hashtags: string[] } {
  const lines = text.trim().split(/\r?\n/);
  const hook = (lines.shift() ?? "").trim();
  let hashtags: string[] = [];
  while (lines.length && !lines[lines.length - 1]?.trim()) lines.pop();
  const last = lines[lines.length - 1]?.trim() ?? "";
  if (last && /^#[\w-]+(\s+#[\w-]+)*$/.test(last)) {
    hashtags = last.match(/#[\w-]+/g) ?? [];
    lines.pop();
  }
  const body = lines.join("\n").trim();
  return { hook, body, hashtags };
}

async function draftOne(
  lane: LanePrompt,
  research: ResearchResult,
  platform: Platform,
  voice: VoiceRules,
  hashtags: HashtagRules,
  complete?: CompleteFn,
): Promise<CaptionDraft> {
  const used = research.items.slice(0, lane.maxItems);
  const coreTags = hashtags.platforms[platform]?.core ?? [];
  const wantedTags = hashtags.platforms[platform]?.max ?? 2;

  let hook: string;
  let body: string;
  let tags: string[];

  if (complete) {
    const prompt = lane.buildUserPrompt({
      research,
      platform,
      voiceRules: voice.text,
      hashtagGuidance: hashtagGuidanceFor(hashtags, platform),
    });
    const out = await complete({ system: lane.system, prompt });
    const parsed = parseCompletion(out);
    hook = parsed.hook;
    body = parsed.body;
    tags = parsed.hashtags.length ? parsed.hashtags : gatherHashtags(used, coreTags, wantedTags);
  } else {
    hook = composeHook(lane, used);
    body = composeBody(lane, used);
    tags = gatherHashtags(used, coreTags, wantedTags);
  }

  return {
    lane: lane.lane,
    platform,
    hook,
    body,
    hashtags: tags,
    citedItemIds: used.map((it) => it.id),
    wantsProofImage: lane.wantsProofImage,
    cta: lane.cta,
  };
}

/**
 * Write a `CaptionSet` for the given research result — one caption per platform.
 */
export async function writeCaptions(
  research: ResearchResult,
  options: WriteCaptionsOptions = {},
): Promise<CaptionSet> {
  const laneId = options.lane ?? research.lane;
  const lane = getLanePrompt(laneId);

  const loaded = options.voice && options.hashtags ? null : await loadAllRules(options.configDir);
  const voice = options.voice ?? loaded!.voice;
  const hashtags = options.hashtags ?? loaded!.hashtags;

  const platforms = options.platforms?.length ? options.platforms : lane.platforms;

  const drafts = await Promise.all(
    platforms.map((platform) => draftOne(lane, research, platform, voice, hashtags, options.complete)),
  );
  const captions = await formatAll(drafts, { hashtags, configDir: options.configDir });

  return {
    laneId,
    writtenAt: nowIso(),
    captions,
    hook: drafts[0]?.hook ?? "",
    leadItemId: research.items[0]?.id,
  };
}

/**
 * Lower-level variant returning the unformatted drafts (used by callers that want
 * to track per-caption CTA for log rotation, which `Caption` doesn't carry).
 */
export async function writeDrafts(
  research: ResearchResult,
  options: WriteCaptionsOptions = {},
): Promise<CaptionDraft[]> {
  const laneId = options.lane ?? research.lane;
  const lane = getLanePrompt(laneId);
  const loaded = options.voice && options.hashtags ? null : await loadAllRules(options.configDir);
  const voice = options.voice ?? loaded!.voice;
  const hashtags = options.hashtags ?? loaded!.hashtags;
  const platforms = options.platforms?.length ? options.platforms : lane.platforms;
  return Promise.all(
    platforms.map((platform) => draftOne(lane, research, platform, voice, hashtags, options.complete)),
  );
}
