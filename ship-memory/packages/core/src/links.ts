/**
 * `[[wikilink]]` parsing. Supports `[[Target]]` and `[[Target|alias text]]`.
 * We capture the *target* (left of the pipe); alias is display-only.
 */

const WIKILINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

export function extractLinks(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  WIKILINK.lastIndex = 0;
  while ((m = WIKILINK.exec(body)) !== null) {
    const target = m[1].trim();
    if (target && !seen.has(target)) {
      seen.add(target);
      out.push(target);
    }
  }
  return out;
}
