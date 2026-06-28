/**
 * factCheck — verify a caption's assertions against its research sources.
 *
 * Deterministic, no LLM required. It extracts claim-like sentences from the
 * caption body and, for each, finds the best-supporting research item by token
 * overlap. A claim is `unsupported` if nothing covers it — and *always*
 * unsupported if it states a figure (percentage, currency, year, magnitude, big
 * number) that no source contains. That figure case is the dangerous failure
 * mode this check exists to catch.
 *
 * Produces a core `FactCheckResult` so the orchestrator (t6) and quality gate
 * consume one shared shape.
 */

import type { Caption, FactCheckResult, ClaimVerdict, CheckedClaim, LaneId } from "../core/index.js";
import { clamp01, nowIso } from "../core/index.js";
import type { ResearchItem, ResearchResult } from "../research/index.js";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "as",
  "at", "by", "from", "we", "our", "you", "your", "they", "their", "has", "have",
  "will", "can", "new", "now", "also", "more", "than", "into", "out", "up", "why",
  "matters", "source",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'+-]*/g) ?? []).filter(
    (t) => t.length > 2 && !STOPWORDS.has(t),
  );
}

/** Figures worth sourcing (see module doc). Small list-rank integers are ignored. */
const FIGURE_RE = /\$\s?\d[\d,.]*|\b\d[\d,.]*\s?%|\b(?:19|20)\d{2}\b|\b\d[\d,.]*\s?(?:x|k|m|b|bn|billion|million|thousand)\b|\b\d{3,}[\d,.]*\b/gi;

function normalizeFigure(fig: string): string {
  return fig.toLowerCase().replace(/[\s,$%]/g, "").replace(/(x|k|m|b|bn|billion|million|thousand)$/i, "");
}

/** Split a caption body into checkable claim sentences (drops source/CTA/tag lines). */
function extractClaims(body: string): string[] {
  const claims: string[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("↳")) continue; // source link line
    if (/^#[\w-]/.test(line)) continue; // hashtag line
    // A ranked bullet ("1. Title — Source") or a sentence.
    const cleaned = line.replace(/^\d+\.\s*/, "").trim();
    for (const sentence of cleaned.split(/(?<=[.!?])\s+/)) {
      const s = sentence.trim();
      if (s.split(/\s+/).length >= 4 && /[a-z]/i.test(s)) claims.push(s);
    }
  }
  return claims;
}

export interface FactCheckOptions {
  /** Min token-overlap ratio for a claim to count as supported. Default 0.5. */
  supportThreshold?: number;
  /** Override the lane id (else taken from `research.lane`). */
  lane?: LaneId;
}

/**
 * Fact-check a caption against its research result.
 */
export function factCheck(
  caption: Caption,
  research: ResearchResult,
  options: FactCheckOptions = {},
): FactCheckResult {
  const threshold = options.supportThreshold ?? 0.5;
  const laneId = options.lane ?? research.lane;

  const items = research.items.map((it: ResearchItem) => ({
    id: it.id,
    tokens: new Set(tokenize([it.title, it.summary, ...(it.tags ?? [])].join(" "))),
    text: [it.title, it.summary].join(" ").toLowerCase(),
  }));
  const corpusFigures = new Set(
    (research.items.map((it) => `${it.title} ${it.summary}`).join(" ").match(FIGURE_RE) ?? []).map(
      normalizeFigure,
    ),
  );

  const claimTexts = extractClaims(caption.body);
  const claims: CheckedClaim[] = claimTexts.map((claim) => {
    const claimTokens = tokenize(claim);

    // Any figure in the claim that no source contains → unsupported, full stop.
    const figs = (claim.match(FIGURE_RE) ?? []).map(normalizeFigure);
    const badFigure = figs.find((f) => !corpusFigures.has(f));

    let best = { id: "", score: 0 };
    for (const item of items) {
      if (item.text.includes(claim.toLowerCase().slice(0, 60))) {
        best = { id: item.id, score: 1 };
        break;
      }
      const overlap = claimTokens.length
        ? claimTokens.filter((t) => item.tokens.has(t)).length / claimTokens.length
        : 0;
      if (overlap > best.score) best = { id: item.id, score: overlap };
    }

    let verdict: ClaimVerdict;
    // A claim that states a FIGURE no source contains is the dangerous case and
    // is hard-`unsupported` (blocks). A non-figure sentence with weak overlap —
    // a CTA, a transition, an opinion — is merely `uncertain` (lowers confidence
    // but doesn't block); the quality gate's citation check covers sourcing.
    if (badFigure) verdict = "unsupported";
    else if (best.score >= threshold) verdict = "supported";
    else verdict = "uncertain";

    const note = badFigure ? `figure "${badFigure}" not found in any source` : undefined;
    return {
      claim,
      verdict,
      evidenceItemIds: best.id && best.score > 0 ? [best.id] : [],
      note,
    };
  });

  const total = claims.length;
  const passed = !claims.some((c) => c.verdict === "unsupported" || c.verdict === "contradicted");
  const confidence =
    total === 0
      ? 1
      : clamp01(
          claims.reduce((sum, c) => sum + (c.verdict === "supported" ? 1 : c.verdict === "uncertain" ? 0.5 : 0), 0) /
            total,
        );

  return {
    laneId,
    platform: caption.platform,
    checkedAt: nowIso(),
    claims,
    passed,
    confidence,
  };
}
