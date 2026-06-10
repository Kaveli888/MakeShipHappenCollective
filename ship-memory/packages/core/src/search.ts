/**
 * Keyword / term-overlap search and connection suggestions.
 *
 * This mirrors bridgememory's approach: tokenize, drop stopwords, score by
 * shared-term count. It is intentionally a SEAM, not a ceiling — the engine
 * calls `scoreOverlap` through here so a future semantic/vector ranker can be
 * dropped in without touching the engine or the tool surface.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "this", "that", "it", "as", "at",
  "by", "from", "we", "you", "i", "our", "your", "they", "them", "their",
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length > 2 && !STOPWORDS.has(t),
  );
}

export function termSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

export interface OverlapResult {
  score: number;
  sharedTerms: string[];
}

export function scoreOverlap(
  queryTerms: Set<string>,
  docTerms: Set<string>,
): OverlapResult {
  const shared: string[] = [];
  for (const t of queryTerms) {
    if (docTerms.has(t)) shared.push(t);
  }
  return { score: shared.length, sharedTerms: shared };
}

/** Cheap substring fallback so single rare tokens still match. */
export function substringMatch(query: string, haystack: string): boolean {
  return haystack.toLowerCase().includes(query.toLowerCase());
}
