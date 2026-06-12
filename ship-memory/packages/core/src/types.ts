/**
 * Core domain types for Ship Memory.
 *
 * The storage format is deliberately dumb: a folder of `.md` files, each with
 * optional YAML frontmatter and `[[wikilink]]` cross-references. That format is
 * the product's contract — portable, human-editable, and Obsidian-compatible.
 * Everything else (MCP, REST, connectors, UI) is a layer over this.
 */

/** A single memory note, fully loaded. */
export interface Memory {
  /** Human title — the H1 and the basis for the filename slug. */
  title: string;
  /** Filename without extension; stable id used by `[[links]]`. */
  slug: string;
  /** Absolute path to the `.md` file on disk. */
  path: string;
  /** Parsed frontmatter (best-effort YAML subset). */
  frontmatter: Record<string, unknown>;
  /** Markdown body with frontmatter stripped. */
  body: string;
  /** Outgoing wikilink targets (raw, as written inside `[[ ]]`). */
  links: string[];
  /** mtime in epoch ms. */
  modified: number;
  /** birthtime in epoch ms (falls back to mtime where unsupported). */
  created: number;
}

/** Lightweight memory record without the body — for listings. */
export interface MemoryMeta extends Omit<Memory, "body"> {
  /** First ~120 chars of prose after the H1 — list previews (iOS-Notes style). */
  snippet: string;
}

/** A resolved hub (vault). */
export interface Hub {
  /** Absolute path to the `.shipmemory/` directory holding the notes. */
  root: string;
}

export interface HubStatus {
  /** Absolute hub root, or null if none was found. */
  hub: string | null;
  /** Where discovery started walking up from. */
  searchedFrom: string;
  /** Number of `.md` notes in the hub (0 when hub is null). */
  count: number;
}

export interface SearchHit {
  memory: MemoryMeta;
  /** Higher is better. Term-overlap count by default. */
  score: number;
  /** Terms that matched, for explainability. */
  sharedTerms: string[];
}

export interface ConnectionSuggestion {
  memory: MemoryMeta;
  score: number;
  sharedTerms: string[];
}

export interface CreateMemoryInput {
  title: string;
  body: string;
  frontmatter?: Record<string, unknown>;
}

/** The directory name that marks a hub. Mirrors bridgememory's `.bridgememory`. */
export const HUB_DIRNAME = ".shipmemory";
