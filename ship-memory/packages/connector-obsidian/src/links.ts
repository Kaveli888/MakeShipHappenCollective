/**
 * Obsidian → Ship Memory link & tag normalization.
 *
 * This is the real work of the connector. Obsidian's `[[wikilinks]]` are richer
 * than Ship Memory's resolver expects:
 *   [[Note]]                     basic
 *   [[Note|alias]]               aliased
 *   [[folder/sub/Note]]          path-qualified
 *   [[Note#Heading]]             heading ref
 *   [[Note#^blockid]]            block ref
 *   ![[Note]]                    note transclusion (embed)
 *   ![[diagram.png]]             attachment embed
 *
 * Ship Memory resolves a link by slugifying its target to a note slug. A note
 * imported from `20_Projects/Auth Architecture.md` becomes slug
 * `auth-architecture`, so a link like `[[20_Projects/Auth Architecture#Keys]]`
 * must be rewritten to `[[Auth Architecture]]` or the backlink silently breaks.
 * That rewrite is what makes an imported vault's graph survive intact.
 */

const WIKILINK = /(!?)\[\[([^\]]+)\]\]/g;

/** Embeds whose target is one of these are attachments, not notes — leave them. */
const ATTACHMENT_EXT =
  /\.(png|jpe?g|gif|svg|webp|bmp|pdf|mp[34]|m4a|mov|webm|wav|ogg|excalidraw|canvas)$/i;

export function rewriteObsidianLinks(body: string): string {
  return body.replace(WIKILINK, (full, bang: string, inner: string) => {
    const pipe = inner.indexOf("|");
    const rawTarget = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
    const alias = pipe === -1 ? "" : inner.slice(pipe + 1).trim();

    // Keep attachment embeds (images/PDFs/etc.) exactly as written.
    if (bang && ATTACHMENT_EXT.test(rawTarget)) return full;

    // Drop heading (#) and block (^) refs, then reduce a path to its basename.
    const noRef = rawTarget.split("#")[0].split("^")[0].trim();
    const base = noRef.split("/").pop()?.replace(/\.md$/i, "").trim() ?? "";

    // Pure in-note refs like [[#Section]] have no note target — leave intact.
    if (!base) return full;

    return alias ? `[[${base}|${alias}]]` : `[[${base}]]`;
  });
}

/**
 * Pull inline `#tags` from a note body, ignoring those inside code spans/blocks
 * and markdown headings (which are `# ` with a space). Best-effort.
 */
export function extractInlineTags(body: string): string[] {
  const stripped = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ");
  const out = new Set<string>();
  const re = /(?:^|\s)#([A-Za-z][\w-]*(?:\/[\w-]+)*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) out.add(m[1]);
  return [...out];
}

/** Merge frontmatter tags (array | "a b c" | "a,b") with inline tags. */
export function mergeTags(fmTags: unknown, inline: string[]): string[] {
  const out = new Set<string>();
  const add = (t: string) => {
    const c = t.replace(/^#/, "").trim();
    if (c) out.add(c);
  };
  if (Array.isArray(fmTags)) fmTags.forEach((t) => add(String(t)));
  else if (typeof fmTags === "string") fmTags.split(/[,\s]+/).forEach(add);
  inline.forEach(add);
  return [...out];
}
