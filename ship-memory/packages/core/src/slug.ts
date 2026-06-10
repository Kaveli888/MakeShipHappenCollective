/**
 * Title <-> filename slug. The slug is the stable id that `[[wikilinks]]`
 * resolve against, so it must be deterministic and filesystem-safe.
 */

export function slugify(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return s || "untitled";
}

/**
 * Normalize any identifier (title, slug, or wikilink target) to a comparable
 * key so `[[Auth Architecture]]`, `auth-architecture`, and `Auth architecture`
 * all resolve to the same note.
 */
export function normalizeKey(identifier: string): string {
  return slugify(identifier);
}
