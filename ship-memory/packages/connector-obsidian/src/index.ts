/**
 * @ship-memory/connector-obsidian
 *
 * Imports an existing Obsidian vault into a Ship Memory hub. Implements the
 * core {@link Connector} contract: it only PULLS (reads the vault, normalizes
 * each note). Writing/idempotency is the engine's job via `syncConnector`, so
 * this connector never touches the hub directly.
 *
 * The vault is read-only here — nothing in the user's Obsidian vault is mutated.
 */

import { readFileSync, statSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import {
  parseFrontmatter,
  type Connector,
  type ConnectorContext,
  type ConnectorNote,
} from "@ship-memory/core";
import { walkVault } from "./vault.js";
import { extractInlineTags, mergeTags, rewriteObsidianLinks } from "./links.js";

export interface ObsidianConfig {
  /** Absolute or relative path to the vault root. */
  vaultPath: string;
  /** Extra directory names to skip (beyond dotdirs). e.g. ["_templates"]. */
  ignoreDirs?: string[];
  /** Harvest inline `#tags` from bodies. Default true. */
  includeInlineTags?: boolean;
  /**
   * Filenames (sans `.md`) treated as folder notes: their title is taken from
   * the parent FOLDER, not the meaningless stem. Default `["_index", "index"]`.
   * Matched case-insensitively.
   */
  indexFilenames?: string[];
}

const ALWAYS_IGNORE = [".obsidian", ".trash", ".git", "node_modules"];
const DEFAULT_INDEX_NAMES = ["_index", "index"];

/**
 * Title for a note, honoring the Obsidian folder-note convention.
 *
 * A vault of `Auth/_index.md`, `SSH/_index.md`, … would otherwise collapse to
 * the stem `_index` for every note (disambiguated to `_index-2`, `_index-3`…).
 * Obsidian displays such notes by their folder name, so we do too: an index
 * note inherits its parent folder's name. The vault-root index falls back to
 * the vault folder's own name.
 */
export function deriveTitle(
  file: string,
  vault: string,
  frontmatterTitle: unknown,
  indexNames: Set<string>,
): string {
  if (typeof frontmatterTitle === "string" && frontmatterTitle.trim()) {
    return frontmatterTitle.trim();
  }
  const stem = basename(file).replace(/\.md$/i, "");
  if (indexNames.has(stem.toLowerCase())) {
    // basename(dirname) is the folder; at the vault root it's the vault itself.
    const folder = basename(dirname(file)) || basename(vault);
    if (folder) return folder;
  }
  return stem;
}

export class ObsidianConnector implements Connector {
  readonly id = "obsidian";
  readonly label = "Obsidian Vault";

  constructor(private readonly cfg: ObsidianConfig) {}

  async pull(ctx: ConnectorContext = {}): Promise<ConnectorNote[]> {
    const vault = resolve(this.cfg.vaultPath);
    const ignore = new Set([...ALWAYS_IGNORE, ...(this.cfg.ignoreDirs ?? [])]);
    const files = walkVault(vault, ignore);
    const wantInlineTags = this.cfg.includeInlineTags !== false;
    const indexNames = new Set(
      (this.cfg.indexFilenames ?? DEFAULT_INDEX_NAMES).map((s) =>
        s.toLowerCase(),
      ),
    );

    const notes: ConnectorNote[] = [];
    for (const file of files) {
      // `since` watermark — skip notes unchanged since the last sync.
      if (ctx.since && statSync(file).mtimeMs <= ctx.since) continue;

      const raw = readFileSync(file, "utf8");
      const { frontmatter, body } = parseFrontmatter(raw);

      const rel = relative(vault, file);
      const sourceId = rel.replace(/\.md$/i, ""); // stable id within the vault
      // Title is the filename (Obsidian's identity), unless frontmatter sets
      // one or this is a folder-note index (then the parent folder names it).
      const title = deriveTitle(file, vault, frontmatter.title, indexNames);

      const tags = mergeTags(
        frontmatter.tags,
        wantInlineTags ? extractInlineTags(body) : [],
      );

      // Preserve original frontmatter (aliases, custom fields), but title and
      // tags are recomputed above, and source/sourceId are stamped by the core.
      const fm: Record<string, unknown> = { obsidianPath: rel };
      for (const [k, v] of Object.entries(frontmatter)) {
        if (k !== "title" && k !== "tags") fm[k] = v;
      }
      if (tags.length) fm.tags = tags;

      notes.push({
        title,
        body: rewriteObsidianLinks(body),
        frontmatter: fm,
        sourceId,
      });
    }
    return notes;
  }
}

export function createObsidianConnector(cfg: ObsidianConfig): ObsidianConnector {
  return new ObsidianConnector(cfg);
}

export { walkVault } from "./vault.js";
export {
  rewriteObsidianLinks,
  extractInlineTags,
  mergeTags,
} from "./links.js";
