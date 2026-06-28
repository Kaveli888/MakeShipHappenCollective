/**
 * blockedPhrases — loader for blocked-phrases.md.
 *
 * Parses the hard-stop phrase list and the regex pattern list. Anything matched
 * here is a *blocking* quality-gate failure (distinct from the soft "banned
 * words" in voice-rules.md). A missing file degrades to empty lists so the
 * pipeline keeps running.
 */

import { bullets, readConfigFile, sectionLines } from "../content/rules.js";

export interface BlockedRules {
  /** Case-insensitive plain-text substrings that must not appear. */
  phrases: string[];
  /** Compiled case-insensitive regexes that must not match. */
  patterns: RegExp[];
}

/** Strip surrounding backticks from a parsed pattern bullet. */
function unbacktick(s: string): string {
  return s.replace(/^`+|`+$/g, "").trim();
}

export async function loadBlockedRules(configDir?: string): Promise<BlockedRules> {
  const text = await readConfigFile("blocked-phrases.md", configDir);

  const phrases = bullets(sectionLines(text, "Blocked Phrases")).map((p) => p.toLowerCase());

  const patterns: RegExp[] = [];
  for (const raw of bullets(sectionLines(text, "Blocked Patterns"))) {
    const src = unbacktick(raw);
    if (!src) continue;
    try {
      patterns.push(new RegExp(src, "i"));
    } catch {
      // Skip a malformed pattern rather than crashing the gate.
    }
  }

  return { phrases, patterns };
}

/** Return every blocked phrase/pattern that matches the given text. */
export function findBlocked(text: string, rules: BlockedRules): string[] {
  const hay = text.toLowerCase();
  const hits: string[] = [];
  for (const p of rules.phrases) {
    if (p && hay.includes(p)) hits.push(p);
  }
  for (const re of rules.patterns) {
    if (re.test(text)) hits.push(`/${re.source}/`);
  }
  return hits;
}
