/**
 * qualityGate — the final editorial check before a post may be queued/published.
 *
 * Runs a fixed set of rules against a formatted core `Caption` and returns a
 * core `QualityGateResult` with a 0..1 score and a list of issues. A caption
 * `passed` only when it has ZERO `block`-severity issues AND its score ≥
 * `minScore`. In `strict` mode, `warn` issues are also treated as blocking.
 *
 * Rule sources (single source of truth):
 *  - voice-rules.md     → banned words (warn), required elements
 *  - blocked-phrases.md → hard-stop phrases/patterns (block)
 *  - hashtag-rules.md   → per-platform caps (enforced by formatting; warn here)
 *  - core config        → platform char limits, thresholds
 *
 * Fact-check and duplicate results are computed by their own modules and passed
 * in, so the gate stays a pure decision over already-gathered evidence (it only
 * touches disk to lazily load rule files).
 */

import type {
  Caption,
  FactCheckResult,
  PlatformLimits,
  QualityGateResult,
  QualityIssue,
  QualitySeverity,
} from "../core/index.js";
import { clamp01, DEFAULT_PLATFORM_LIMITS } from "../core/index.js";
import { loadVoiceRules, type VoiceRules } from "../content/rules.js";
import { findBlocked, loadBlockedRules, type BlockedRules } from "./blockedPhrases.js";

/** Minimal shape of a duplicate-check result (decoupled from the memory layer). */
export interface DuplicateSignal {
  isDuplicate: boolean;
  similarity?: number;
  similarTo?: string;
}

export interface QualityGateContext {
  /** Lane id (for the result + logging). */
  laneId: string;
  voice?: VoiceRules;
  blocked?: BlockedRules;
  /** Per-platform limits; defaults to core's DEFAULT_PLATFORM_LIMITS. */
  limits?: PlatformLimits;
  /** Result of `factCheck` for this caption, if available. */
  factCheck?: FactCheckResult;
  /** Result of the duplicate check for this caption, if available. */
  duplicate?: DuplicateSignal;
  /** Minimum composite score (0..1) required to pass. Default 0.7. */
  minScore?: number;
  /** Minimum fact-check confidence (0..1) to pass. Default 0.6. */
  minFactCheckConfidence?: number;
  /** Whether a source/citation is required (blocking if missing). Default true. */
  requireSource?: boolean;
  /** Minimum number of cited sources for a factual claim. Default 2. */
  minSources?: number;
  /** The lane requires a proof image (blocking if none is attached). */
  requireProofImage?: boolean;
  /** Whether a proof image is actually attached to this caption. */
  hasProofImage?: boolean;
  /** Treat `warn` issues as blocking. Default false. */
  strict?: boolean;
  /** Config dir for rule files (defaults to project root). */
  configDir?: string;
}

const HOOK_MAX = 120;
const BLOCK_PENALTY = 0.35;
const WARN_PENALTY = 0.08;

/** Does the text contain a number or a multi-word proper noun (specificity signal)? */
function hasSpecificity(text: string): boolean {
  if (/\d/.test(text)) return true;
  return /\b[A-Z][a-zA-Z0-9]+\s+[A-Z][a-zA-Z0-9]+/.test(text);
}

/**
 * Run the quality gate against a formatted caption. Loads voice + blocked rules
 * from disk if not supplied.
 */
export async function runQualityGate(
  caption: Caption,
  ctx: QualityGateContext,
): Promise<QualityGateResult> {
  const minScore = ctx.minScore ?? 0.7;
  const minConfidence = ctx.minFactCheckConfidence ?? 0.6;
  const requireSource = ctx.requireSource ?? true;
  const minSources = ctx.minSources ?? 2;
  const limits = ctx.limits ?? DEFAULT_PLATFORM_LIMITS[caption.platform];
  const voice = ctx.voice ?? (await loadVoiceRules(ctx.configDir));
  const blocked = ctx.blocked ?? (await loadBlockedRules(ctx.configDir));

  const issues: QualityIssue[] = [];
  const add = (rule: string, severity: QualitySeverity, message: string) =>
    issues.push({ rule, severity, message });

  // The published footprint = body + hashtags.
  const published = caption.hashtags.length
    ? `${caption.body}\n\n${caption.hashtags.join(" ")}`
    : caption.body;
  const hook = caption.body.split(/\r?\n/)[0]?.trim() ?? "";

  // ── Blocking rules ─────────────────────────────────────────────────────────

  if (caption.charCount > limits.maxChars) {
    add(
      "char-limit",
      "block",
      `Post is ${caption.charCount} chars; ${caption.platform} limit is ${limits.maxChars}.`,
    );
  }

  for (const hit of findBlocked(published, blocked)) {
    add("blocked-phrase", "block", `Contains blocked phrase/pattern: ${hit}`);
  }

  if (caption.hashtags.length === 0) {
    add("no-hashtags", "block", "Post has no hashtags.");
  }

  if (requireSource && caption.citedItemIds.length === 0) {
    add("no-citation", "block", "No source cited for a factual post.");
  } else if (requireSource && caption.citedItemIds.length < minSources) {
    add(
      "insufficient-sources",
      "warn",
      `Only ${caption.citedItemIds.length} source(s) cited; ${minSources}+ recommended for factual claims.`,
    );
  }

  if (ctx.requireProofImage && !ctx.hasProofImage) {
    add("missing-proof-image", "block", "Lane requires a proof image but none is attached.");
  }

  if (ctx.factCheck) {
    if (!ctx.factCheck.passed) {
      const bad = ctx.factCheck.claims.filter(
        (c) => c.verdict === "unsupported" || c.verdict === "contradicted",
      );
      for (const c of bad) {
        add(
          "unsupported-claim",
          "block",
          `${c.verdict} claim: "${c.claim}"${c.note ? ` — ${c.note}` : ""}`,
        );
      }
    }
    if (ctx.factCheck.confidence < minConfidence) {
      add(
        "low-factcheck-confidence",
        "block",
        `Fact-check confidence ${ctx.factCheck.confidence.toFixed(2)} below threshold ${minConfidence}.`,
      );
    }
  }

  if (ctx.duplicate?.isDuplicate) {
    const sim = ctx.duplicate.similarity != null ? ` (similarity ${ctx.duplicate.similarity})` : "";
    const ref = ctx.duplicate.similarTo ? ` of ${ctx.duplicate.similarTo}` : "";
    add("duplicate-topic", "block", `Near-duplicate${ref}${sim}.`);
  }

  // ── Warning rules ──────────────────────────────────────────────────────────

  const lowered = published.toLowerCase();
  for (const word of voice.bannedWords) {
    if (word && lowered.includes(word)) {
      add("banned-word", "warn", `Uses banned word: "${word}"`);
    }
  }

  if (!hook) {
    add("weak-hook", "warn", "Missing hook (empty first line).");
  } else if (hook.length > HOOK_MAX) {
    add("weak-hook", "warn", `Hook is ${hook.length} chars; aim for under ${HOOK_MAX}.`);
  }

  if (caption.hashtags.length > limits.maxHashtags) {
    add(
      "too-many-hashtags",
      "warn",
      `${caption.hashtags.length} hashtags; ${caption.platform} max is ${limits.maxHashtags}.`,
    );
  }

  const requiredKeys = new Set(voice.requiredElements.map((e) => e.key.toLowerCase()));
  if (requiredKeys.has("specificity") && !hasSpecificity(published)) {
    add("low-specificity", "warn", "No concrete number or proper noun found.");
  }

  const bangs = (published.match(/!/g) ?? []).length;
  if (bangs > 1) {
    add("over-punctuation", "warn", `Uses ${bangs} exclamation points; max 1.`);
  }

  // ── Score & verdict ────────────────────────────────────────────────────────

  const blocks = issues.filter((i) => i.severity === "block").length;
  const warns = issues.filter((i) => i.severity === "warn").length;
  const score = clamp01(1 - blocks * BLOCK_PENALTY - warns * WARN_PENALTY);
  const blockingWarns = ctx.strict ? warns : 0;
  const passed = blocks === 0 && blockingWarns === 0 && score >= minScore;

  return {
    laneId: ctx.laneId,
    platform: caption.platform,
    checkedAt: new Date().toISOString(),
    issues,
    passed,
    score,
  };
}
