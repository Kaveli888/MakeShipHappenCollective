/**
 * Rule-file loaders.
 *
 * The markdown config files (`voice-rules.md`, `hashtag-rules.md`) are the single
 * source of truth for brand voice and hashtag policy. This module reads the
 * machine-readable sections so the writer, formatter, and quality gate all
 * enforce the *same* rules an editor sees.
 *
 * File resolution: a file is looked up in `[configDir?, paths.config, root]`, in
 * that order — so the rule files work whether they sit at the repo root (t3's
 * assigned scope) or in `config/` (t1's `paths.config`). A missing file degrades
 * to safe empty defaults rather than throwing, so the pipeline keeps running.
 */

import { readFile } from "node:fs/promises";
import type { Platform } from "../core/index.js";
import { paths } from "../core/index.js";

/** Project root (re-exported from core for convenience). */
export const PROJECT_ROOT = paths.root;
/** Default directory checked first for the markdown rule files. */
export const DEFAULT_CONFIG_DIR = paths.config;

export interface RequiredElement {
  key: string;
  description: string;
}

export interface VoiceRules {
  /** Full file text, injected verbatim into the writer prompt. */
  text: string;
  /** Soft-banned hype words (warning-level in the quality gate). */
  bannedWords: string[];
  /** Elements every post must include (enforced by the quality gate). */
  requiredElements: RequiredElement[];
  /** CTA suggestions parsed from the "## CTA bank" section. */
  ctaBank: string[];
}

export interface PlatformHashtagRule {
  max: number;
  core: string[];
  avoid: string[];
}

export interface HashtagRules {
  /** Global prose rules (kept for reference / docs). */
  global: string[];
  platforms: Record<Platform, PlatformHashtagRule>;
}

const PLATFORMS: Platform[] = ["x", "linkedin", "facebook", "browser"];

/** Conservative fallback if hashtag-rules.md can't be read. */
const FALLBACK_HASHTAG_RULE: PlatformHashtagRule = { max: 2, core: [], avoid: [] };

/** Read a config file by name, trying the candidate directories in order. */
export async function readConfigFile(filename: string, configDir?: string): Promise<string> {
  const candidates = [configDir, paths.config, paths.root].filter(Boolean) as string[];
  for (const dir of candidates) {
    try {
      return await readFile(`${dir}/${filename}`, "utf8");
    } catch {
      // try the next candidate
    }
  }
  return "";
}

/** Return the lines of the section under a heading (any `#` level), until the next heading. */
export function sectionLines(md: string, heading: string): string[] {
  const lines = md.split(/\r?\n/);
  const norm = (s: string) => s.replace(/^#+\s*/, "").trim().toLowerCase();
  let inSection = false;
  const out: string[] = [];
  for (const line of lines) {
    if (/^#+\s/.test(line)) {
      if (inSection) break; // next heading ends the section
      if (norm(line) === heading.trim().toLowerCase()) inSection = true;
      continue;
    }
    if (inSection) out.push(line);
  }
  return out;
}

/** Extract `- item` bullets from a block of lines. */
export function bullets(lines: string[]): string[] {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
}

/**
 * Load voice rules. Returns the full text plus parsed banned words, required
 * elements, and the CTA bank.
 */
export async function loadVoiceRules(configDir?: string): Promise<VoiceRules> {
  const text = await readConfigFile("voice-rules.md", configDir);

  const bannedWords = bullets(sectionLines(text, "Banned Words")).map((w) => w.toLowerCase());

  const requiredElements: RequiredElement[] = bullets(sectionLines(text, "Required Elements"))
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { key: line.trim(), description: "" };
      return { key: line.slice(0, idx).trim(), description: line.slice(idx + 1).trim() };
    })
    .filter((e) => e.key);

  const ctaBank = bullets(sectionLines(text, "CTA bank"));

  return { text, bannedWords, requiredElements, ctaBank };
}

function parsePlatformBlock(lines: string[]): PlatformHashtagRule {
  const rule: PlatformHashtagRule = { max: FALLBACK_HASHTAG_RULE.max, core: [], avoid: [] };
  for (const raw of bullets(lines)) {
    const idx = raw.indexOf(":");
    if (idx === -1) continue;
    const key = raw.slice(0, idx).trim().toLowerCase();
    const val = raw.slice(idx + 1).trim();
    if (key === "max") {
      const n = parseInt(val, 10);
      if (!Number.isNaN(n)) rule.max = n;
    } else if (key === "core") {
      rule.core = val.split(/\s+/).filter((t) => t.startsWith("#"));
    } else if (key === "avoid") {
      rule.avoid = val.split(/\s+/).filter((t) => t.startsWith("#")).map((t) => t.toLowerCase());
    }
  }
  return rule;
}

/** Load per-platform hashtag rules. Missing platforms fall back to a safe default. */
export async function loadHashtagRules(configDir?: string): Promise<HashtagRules> {
  const text = await readConfigFile("hashtag-rules.md", configDir);
  const global = bullets(sectionLines(text, "Global"));

  const platforms = {} as Record<Platform, PlatformHashtagRule>;
  for (const p of PLATFORMS) {
    const block = sectionLines(text, p);
    platforms[p] = block.length ? parsePlatformBlock(block) : { ...FALLBACK_HASHTAG_RULE };
  }
  return { global, platforms };
}

/** Build a one-line human-readable hashtag guidance string for the writer prompt. */
export function hashtagGuidanceFor(rules: HashtagRules, platform: Platform): string {
  const r = rules.platforms[platform];
  const core = r.core.length ? ` Preferred: ${r.core.join(" ")}.` : "";
  return `Use at most ${r.max} hashtag${r.max === 1 ? "" : "s"} on ${platform}, placed at the end.${core}`;
}

/** Convenience: load both rule sets at once. */
export async function loadAllRules(configDir?: string): Promise<{
  voice: VoiceRules;
  hashtags: HashtagRules;
}> {
  const [voice, hashtags] = await Promise.all([loadVoiceRules(configDir), loadHashtagRules(configDir)]);
  return { voice, hashtags };
}
