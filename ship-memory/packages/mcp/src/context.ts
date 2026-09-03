import { MemoryNotFoundError, ShipMemory } from "@ship-memory/core";
import { nodeFs } from "@ship-memory/core/node";

/**
 * Resolve a project from its working directory and return its curated entry
 * note. This is deliberately read-only and never initializes or mutates a hub.
 */
export async function connectContext(cwd: string): Promise<unknown> {
  const memory = await ShipMemory.open(cwd, nodeFs);
  const available = await memory.list();
  try {
    const entry = await memory.read("index");
    return {
      connected: true,
      configured: true,
      hub: memory.root,
      project:
        typeof entry.frontmatter.project === "string"
          ? entry.frontmatter.project
          : entry.title,
      entry,
      available: available
        .filter((item) => item.slug !== "index")
        .map(({ title, slug, frontmatter, snippet, modified }) => ({
          title,
          slug,
          frontmatter,
          snippet,
          modified,
        })),
    };
  } catch (error) {
    if (!(error instanceof MemoryNotFoundError)) throw error;
    return {
      connected: true,
      configured: false,
      hub: memory.root,
      message:
        "This hub has no index.md project briefing. Existing memory behavior is unchanged; use list/search/read normally.",
      count: available.length,
    };
  }
}
