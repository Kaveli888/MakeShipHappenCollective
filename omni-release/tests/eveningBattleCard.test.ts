/**
 * Integration test for the offline content pipeline on the Evening Battle Card
 * lane: write → fact-check → quality gate → proof image. Uses a synthetic
 * ResearchResult so it runs deterministically with no network.
 */

import { describe, expect, it } from "vitest";
import { loadConfig, getLane } from "../src/core/index.js";
import { writeCaptions } from "../src/content/index.js";
import { factCheck, runQualityGate } from "../src/quality/index.js";
import { renderProofImage } from "../src/proof/index.js";
import type { ResearchResult } from "../src/research/index.js";

const ROOT = new URL("..", import.meta.url).pathname; // repo root for rule files

function syntheticResearch(): ResearchResult {
  const items = [
    {
      id: "a1",
      sourceId: "anthropic-news",
      sourceName: "Anthropic News",
      category: "lab-blog" as const,
      title: "Anthropic ships a new Claude model with a larger context window",
      url: "https://www.anthropic.com/news/example",
      summary:
        "Anthropic released an updated Claude model aimed at coding agents, with a longer context window and improved tool use for builders.",
      publishedAt: new Date().toISOString(),
      author: null,
      tags: ["anthropic", "claude", "models"],
      score: 88,
    },
    {
      id: "b2",
      sourceId: "openai-blog",
      sourceName: "OpenAI Blog",
      category: "lab-blog" as const,
      title: "OpenAI updates its API pricing and rate limits for developers",
      url: "https://openai.com/blog/example",
      summary: "OpenAI adjusted API pricing and rate limits, with implications for indie developers shipping on the platform.",
      publishedAt: new Date().toISOString(),
      author: null,
      tags: ["openai", "api", "pricing"],
      score: 80,
    },
    {
      id: "c3",
      sourceId: "venturebeat-ai",
      sourceName: "VentureBeat",
      category: "news" as const,
      title: "Open-weights model lands on the leaderboard near the top",
      url: "https://venturebeat.com/ai/example",
      summary: "A new open-weights model climbed the public leaderboard, narrowing the gap with closed frontier models.",
      publishedAt: new Date().toISOString(),
      author: null,
      tags: ["open-weights", "leaderboard"],
      score: 76,
    },
  ];
  return {
    lane: "evening-battle-card",
    generatedAt: new Date().toISOString(),
    options: {},
    items,
    sources: [],
    stats: {
      sourcesAttempted: 3,
      sourcesOk: 3,
      sourcesFailed: 0,
      sourcesSkipped: 0,
      itemsCollected: 3,
      itemsAfterDedupe: 3,
      itemsReturned: 3,
      durationMs: 1,
    },
    notes: [],
  };
}

describe("evening-battle-card offline pipeline", () => {
  const cfg = loadConfig();
  const lane = getLane("evening-battle-card", cfg)!;

  it("registers the three daily lanes", () => {
    const ids = cfg.lanes.map((l) => l.id);
    expect(ids).toContain("ai-daily-shift");
    expect(ids).toContain("model-watch");
    expect(ids).toContain("evening-battle-card");
  });

  it("writes platform captions within character limits", async () => {
    const research = syntheticResearch();
    const set = await writeCaptions(research, { platforms: lane.platforms, configDir: ROOT });

    expect(set.captions.length).toBe(lane.platforms.length);
    for (const c of set.captions) {
      const limit = cfg.platformLimits[c.platform].maxChars;
      expect(c.charCount).toBeLessThanOrEqual(limit);
      expect(c.hashtags.length).toBeGreaterThan(0);
      expect(c.citedItemIds.length).toBeGreaterThan(0);
    }
  });

  it("fact-checks captions against the research corpus", async () => {
    const research = syntheticResearch();
    const set = await writeCaptions(research, { platforms: lane.platforms, configDir: ROOT });
    for (const c of set.captions) {
      const fc = factCheck(c, research, { lane: lane.id });
      expect(fc.platform).toBe(c.platform);
      expect(fc.confidence).toBeGreaterThanOrEqual(0);
      expect(fc.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("passes the quality gate for clean captions", async () => {
    const research = syntheticResearch();
    const set = await writeCaptions(research, { platforms: lane.platforms, configDir: ROOT });
    for (const c of set.captions) {
      const fc = factCheck(c, research, { lane: lane.id });
      const gate = await runQualityGate(c, {
        laneId: lane.id,
        limits: cfg.platformLimits[c.platform],
        factCheck: fc,
        duplicate: { isDuplicate: false },
        requireProofImage: true,
        hasProofImage: true,
        configDir: ROOT,
      });
      // No blocking issues expected for well-sourced, in-limit captions.
      const blocks = gate.issues.filter((i) => i.severity === "block");
      expect(blocks, JSON.stringify(gate.issues)).toHaveLength(0);
    }
  });

  it("renders a proof image with the headline and sources", () => {
    const research = syntheticResearch();
    const rendered = renderProofImage({
      title: "Anthropic ships a larger-context Claude",
      lane: lane.name,
      proofType: "battle-card",
      publicationDate: new Date().toISOString().slice(0, 10),
      claims: research.items.slice(0, 3).map((it) => ({
        text: it.title.slice(0, 110),
        sourceLabel: it.sourceName,
        sourceUrl: it.url,
        confidence: "high" as const,
      })),
    });
    expect(rendered.content).toContain("<svg");
    expect(rendered.content).toContain("Anthropic");
    expect(rendered.width).toBe(1200);
  });
});
