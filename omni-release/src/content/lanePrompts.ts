/**
 * Lane prompts.
 *
 * A *lane* is a recurring content format (e.g. the daily "Evening Battle Card").
 * Each lane carries its tone, target platforms, structural beats, and the system
 * + user prompts an LLM writer uses. `writeCaptions` consumes these; when no LLM
 * is wired, it falls back to a deterministic composer that follows the same
 * `structure` beats.
 *
 * Keep this in sync with the lane table in `omni-release.config.md` and the
 * `LaneConfig` registry in `src/core/config.ts` (the orchestrator, t6, drives
 * runs from `LaneConfig`; these prompts supply the editorial detail).
 */

import type { LaneId } from "../core/index.js";
import type { ResearchItem } from "../research/index.js";
import type { LanePrompt, LanePromptInput } from "./types.js";

/** Shared system-prompt preamble that carries the brand into every lane. */
const BRAND_PREAMBLE =
  "You write social posts for MakeShipHappen — makers of ShipSpace, ShipTalk, " +
  "ShipMind, and Ship Memory. Audience: builders, indie hackers, small teams. " +
  "You are a practitioner, not a pundit. Follow the voice rules provided exactly. " +
  "Every factual claim must be traceable to one of the supplied sources — never " +
  "invent facts, numbers, or quotes. Output only the post text (hook, body, then " +
  "hashtags on the final line). Do not add commentary.";

/** Render the supplied research items into a compact, numbered source block. */
function renderItems(items: ResearchItem[], max: number): string {
  return items
    .slice(0, max)
    .map((it, i) => {
      const tags = it.tags?.length ? `\n   tags: ${it.tags.join(", ")}` : "";
      const when = it.publishedAt ? ` (${it.publishedAt})` : "";
      return `${i + 1}. ${it.title}${when}\n   ${it.summary}\n   source: ${it.sourceName} — ${it.url}${tags}`;
    })
    .join("\n");
}

/** Standard user-prompt builder shared by lanes; emphasises a lane's beats. */
function makeUserPromptBuilder(lane: LanePrompt) {
  return (input: LanePromptInput): string => {
    const { research, platform, voiceRules, hashtagGuidance } = input;
    const items = renderItems(research.items, lane.maxItems);
    return [
      `LANE: ${lane.title} — ${lane.description}`,
      `PLATFORM: ${platform}`,
      `TONE: ${lane.tone}`,
      ``,
      `STRUCTURE (hit these beats in order):`,
      ...lane.structure.map((s, i) => `  ${i + 1}. ${s}`),
      ``,
      `CALL TO ACTION (use or adapt): ${lane.cta}`,
      `HASHTAGS: ${hashtagGuidance}`,
      ``,
      `RESEARCH (only use facts from here; cite the source URL):`,
      items || "  (no items)",
      ``,
      `VOICE RULES (obey strictly):`,
      voiceRules,
    ].join("\n");
  };
}

function defineLane(spec: Omit<LanePrompt, "system" | "buildUserPrompt"> & { system?: string }): LanePrompt {
  const lane = {
    ...spec,
    system: spec.system ?? `${BRAND_PREAMBLE}\nLane focus: ${spec.description}`,
  } as LanePrompt;
  lane.buildUserPrompt = makeUserPromptBuilder(lane);
  return lane;
}

/** The built-in lane registry, keyed by lane id. */
export const LANE_PROMPTS: Record<string, LanePrompt> = {
  "ai-daily-shift": defineLane({
    lane: "ai-daily-shift",
    title: "AI Daily Shift",
    description: "Morning briefing on the overnight shift in AI for solo builders.",
    platforms: ["x", "linkedin", "facebook"],
    tone: "Awake and useful. A clear-eyed morning read from a builder who already scanned the feeds.",
    structure: [
      "Hook: the single most important overnight development in one line.",
      "2-3 terse items (what happened, why it matters to someone shipping).",
      "One-line 'what this means for solo builders trying to ship'.",
      "Close with the CTA and link the sources.",
    ],
    wantsProofImage: true,
    maxItems: 4,
    cta: "Full breakdown in the thread.",
  }),

  "model-watch": defineLane({
    lane: "model-watch",
    title: "Model Watch",
    description: "Afternoon look at new models, weights, and benchmark/leaderboard movement.",
    platforms: ["x", "linkedin"],
    tone: "Technical but plain. Numbers over adjectives. Tell builders what actually changed.",
    structure: [
      "Hook: the model or benchmark move that matters, named plainly.",
      "What changed (weights, score, context window, price) with the figure + source.",
      "The practical 'so what' for people building on top.",
      "Close with the CTA and link the sources.",
    ],
    wantsProofImage: true,
    maxItems: 3,
    cta: "Source + our read linked below.",
  }),

  "evening-battle-card": defineLane({
    lane: "evening-battle-card",
    title: "Evening Battle Card",
    description: "End-of-day ranked roundup of the day's most important AI news.",
    platforms: ["x", "linkedin"],
    tone: "Crisp, scannable, confident. A daily briefing from someone who reads everything so you don't have to.",
    structure: [
      "Hook: name the single biggest story of the day in one line.",
      "List the top items as terse ranked bullets (rank, what happened, why it matters).",
      "One-line 'so what' takeaway for builders.",
      "Close with the CTA and link the sources.",
    ],
    wantsProofImage: true,
    maxItems: 5,
    cta: "Full breakdown + sources in the thread.",
  }),

  "proof-drop": defineLane({
    lane: "proof-drop",
    title: "Proof Drop",
    description: "Show a concrete thing we shipped or measured, backed by evidence.",
    platforms: ["x", "linkedin"],
    tone: "Understated and specific. Let the evidence do the bragging.",
    structure: [
      "Hook: state the concrete result or thing shipped (with the number).",
      "Body: how it works / what changed, in one short paragraph.",
      "Point to the proof image and link the source.",
      "Close with the CTA.",
    ],
    wantsProofImage: true,
    maxItems: 2,
    cta: "We wired this into ShipSpace; details linked.",
  }),

  "hot-take": defineLane({
    lane: "hot-take",
    title: "Hot Take",
    description: "One opinionated, sourced take on a single AI news item.",
    platforms: ["x", "linkedin"],
    tone: "Opinionated but earned. Have a spine, then back it with the source.",
    structure: [
      "Hook: the take, stated plainly.",
      "The fact that prompted it (with the source).",
      "Why it matters / the contrarian angle.",
      "Close with the CTA.",
    ],
    wantsProofImage: false,
    maxItems: 1,
    cta: "Source + our take linked below.",
  }),

  "build-log": defineLane({
    lane: "build-log",
    title: "Build Log",
    description: "Running 'here's what we built today' log, tied to the day's news where relevant.",
    platforms: ["x", "linkedin", "facebook"],
    tone: "Casual builder-to-builder. Show the work in progress.",
    structure: [
      "Hook: what we built/changed today, in one line.",
      "A couple of specifics (what, why, any number).",
      "Optional: tie to a relevant news item with its source.",
      "Close with the CTA.",
    ],
    wantsProofImage: false,
    maxItems: 3,
    cta: "Building in public — follow along.",
  }),

  launch: defineLane({
    lane: "launch",
    title: "Launch",
    description: "Product or feature launch announcement.",
    platforms: ["x", "linkedin", "facebook", "browser"],
    tone: "Clear and proud, not hypey. State what it is and who it's for.",
    structure: [
      "Hook: what launched, in one line.",
      "What it does and the one problem it solves.",
      "Who it's for + how to get it (with link).",
      "Close with the CTA.",
    ],
    wantsProofImage: true,
    maxItems: 2,
    cta: "What would you ship with this?",
  }),
};

/** All registered lane ids. */
export function listLanes(): LaneId[] {
  return Object.keys(LANE_PROMPTS);
}

/** Look up a lane prompt; throws on an unknown lane (callers should validate input). */
export function getLanePrompt(lane: LaneId): LanePrompt {
  const prompt = LANE_PROMPTS[lane];
  if (!prompt) {
    throw new Error(
      `Unknown lane "${lane}". Known lanes: ${listLanes().join(", ")}. Add it to src/content/lanePrompts.ts.`,
    );
  }
  return prompt;
}

/** Safe lookup variant that returns undefined instead of throwing. */
export function tryGetLanePrompt(lane: LaneId): LanePrompt | undefined {
  return LANE_PROMPTS[lane];
}
