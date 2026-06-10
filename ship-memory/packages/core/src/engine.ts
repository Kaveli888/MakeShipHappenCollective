/**
 * ShipMemory — the headless engine.
 *
 * This is the whole product in one class: the 12-method surface that
 * bridgememory proved out, reimplemented as code we own, with ZERO coupling to
 * any host app. No MCP, no HTTP, no ShipSpace/BridgeSpace runtime — those are
 * all thin adapters that call into this. Bind it to a hub root and go.
 */

import {
  type ConnectionSuggestion,
  type CreateMemoryInput,
  type HubStatus,
  type Memory,
  type MemoryMeta,
  type SearchHit,
} from "./types.js";
import {
  scoreOverlap,
  substringMatch,
  termSet,
} from "./search.js";
import { extractLinks } from "./links.js";
import { normalizeKey } from "./slug.js";
import {
  findHub,
  initHub,
  loadAll,
  loadMemory,
  pathForSlug,
  removeMemory,
  uniqueSlug,
  writeMemory,
} from "./vault.js";

export class HubNotFoundError extends Error {
  constructor(searchedFrom: string) {
    super(`No Ship Memory hub found at or above: ${searchedFrom}`);
    this.name = "HubNotFoundError";
  }
}

export class MemoryNotFoundError extends Error {
  constructor(identifier: string) {
    super(`No memory matches: ${identifier}`);
    this.name = "MemoryNotFoundError";
  }
}

export class ShipMemory {
  /** Absolute path to the `.shipmemory/` hub directory. */
  readonly root: string;

  constructor(hubRoot: string) {
    this.root = hubRoot;
  }

  /**
   * Discover a hub by walking up from `cwd`. Throws if none exists — callers
   * that want "create if missing" should call {@link ShipMemory.create}.
   */
  static open(cwd: string = process.cwd()): ShipMemory {
    const root = findHub(cwd);
    if (!root) throw new HubNotFoundError(cwd);
    return new ShipMemory(root);
  }

  /** Create (or attach to) a hub under `dir`. */
  static create(dir: string): ShipMemory {
    return new ShipMemory(initHub(dir));
  }

  // ── 1. hub_status ────────────────────────────────────────────────────────
  static status(cwd: string = process.cwd()): HubStatus {
    const root = findHub(cwd);
    if (!root) return { hub: null, searchedFrom: cwd, count: 0 };
    return { hub: root, searchedFrom: cwd, count: loadAll(root).length };
  }

  // ── 2. list_memories ─────────────────────────────────────────────────────
  list(): MemoryMeta[] {
    return loadAll(this.root)
      .map(strip)
      .sort((a, b) => b.modified - a.modified);
  }

  // ── 3. read_memory ───────────────────────────────────────────────────────
  read(identifier: string): Memory {
    return this.resolve(identifier);
  }

  // ── 4. search_memories ───────────────────────────────────────────────────
  search(query: string, limit = 20): SearchHit[] {
    const q = termSet(query);
    const hits: SearchHit[] = [];
    for (const m of loadAll(this.root)) {
      const doc = termSet(`${m.title} ${m.body}`);
      const { score, sharedTerms } = scoreOverlap(q, doc);
      const matched =
        score > 0 ||
        substringMatch(query, m.title) ||
        substringMatch(query, m.body);
      if (matched) {
        hits.push({ memory: strip(m), score: Math.max(score, 1), sharedTerms });
      }
    }
    return hits
      .sort((a, b) => b.score - a.score || b.memory.modified - a.memory.modified)
      .slice(0, limit);
  }

  // ── 5. find_backlinks ────────────────────────────────────────────────────
  backlinks(target: string): MemoryMeta[] {
    const key = normalizeKey(target);
    const out: MemoryMeta[] = [];
    for (const m of loadAll(this.root)) {
      if (m.links.some((l) => normalizeKey(l) === key)) out.push(strip(m));
    }
    return out;
  }

  // ── 6. create_memory ─────────────────────────────────────────────────────
  create(input: CreateMemoryInput): Memory {
    const slug = uniqueSlug(this.root, input.title);
    const frontmatter = { title: input.title, ...(input.frontmatter ?? {}) };
    const body = ensureH1(input.body, input.title);
    const path = writeMemory(this.root, slug, frontmatter, body);
    return loadMemory(path);
  }

  // ── 7. append_to_memory ──────────────────────────────────────────────────
  append(identifier: string, text: string): Memory {
    const m = this.resolve(identifier);
    const sep = m.body.endsWith("\n") ? "\n" : "\n\n";
    const body = m.body + sep + text.trim() + "\n";
    writeMemory(this.root, m.slug, m.frontmatter, body);
    return loadMemory(m.path);
  }

  // ── 8. update_memory ─────────────────────────────────────────────────────
  update(identifier: string, body: string): Memory {
    const m = this.resolve(identifier);
    writeMemory(this.root, m.slug, m.frontmatter, ensureH1(body, m.title));
    return loadMemory(m.path);
  }

  // ── 9. delete_memory ─────────────────────────────────────────────────────
  delete(identifier: string): { deleted: string; backlinks: MemoryMeta[] } {
    const m = this.resolve(identifier);
    const backlinks = this.backlinks(m.slug);
    removeMemory(m.path);
    return { deleted: m.slug, backlinks };
  }

  // ── 10. suggest_connections ──────────────────────────────────────────────
  suggestConnections(identifier: string, limit = 10): ConnectionSuggestion[] {
    const self = this.resolve(identifier);
    const selfKey = normalizeKey(self.slug);
    const selfTerms = termSet(`${self.title} ${self.body}`);
    const already = new Set(self.links.map(normalizeKey));

    const out: ConnectionSuggestion[] = [];
    for (const m of loadAll(this.root)) {
      if (normalizeKey(m.slug) === selfKey) continue;
      if (already.has(normalizeKey(m.slug))) continue;
      const { score, sharedTerms } = scoreOverlap(
        selfTerms,
        termSet(`${m.title} ${m.body}`),
      );
      if (score > 0) out.push({ memory: strip(m), score, sharedTerms });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // ── 11. list_orphans ─────────────────────────────────────────────────────
  orphans(): MemoryMeta[] {
    const all = loadAll(this.root);
    const incoming = new Set<string>();
    for (const m of all) {
      for (const l of m.links) incoming.add(normalizeKey(l));
    }
    return all
      .filter((m) => m.links.length === 0 && !incoming.has(normalizeKey(m.slug)))
      .map(strip);
  }

  // ── 12. init_hub ─────────────────────────────────────────────────────────
  // (static `create` above is the programmatic form; exposed as a tool too.)

  // ── connector ingest ─────────────────────────────────────────────────────
  //
  // The seam every connector funnels through. NOT part of the 12-tool MCP
  // surface — it's the host/sync API. Idempotent by (`source`, `sourceId`):
  // a note seen before is rewritten in place, never duplicated, so re-running
  // a vault import converges instead of multiplying.

  /** Find a note previously imported from a connector. */
  findBySource(source: string, sourceId: string): Memory | null {
    const want = String(sourceId);
    for (const m of loadAll(this.root)) {
      if (
        m.frontmatter.source === source &&
        m.frontmatter.sourceId != null &&
        String(m.frontmatter.sourceId) === want
      ) {
        return m;
      }
    }
    return null;
  }

  /**
   * Upsert a batch of connector notes in one pass. Existing notes (matched by
   * source + sourceId) are updated in place; new ones are created with a unique
   * slug. `source`/`sourceId` are stamped into frontmatter for the next sync.
   */
  ingestMany(
    source: string,
    notes: Array<CreateMemoryInput & { sourceId: string }>,
  ): { created: number; updated: number } {
    const prior = new Map<string, Memory>();
    for (const m of loadAll(this.root)) {
      if (m.frontmatter.source === source && m.frontmatter.sourceId != null) {
        prior.set(String(m.frontmatter.sourceId), m);
      }
    }

    let created = 0;
    let updated = 0;
    for (const n of notes) {
      const existing = prior.get(String(n.sourceId));
      if (existing) {
        const fm = {
          ...existing.frontmatter,
          ...(n.frontmatter ?? {}),
          title: n.title,
          source,
          sourceId: n.sourceId,
        };
        writeMemory(this.root, existing.slug, fm, ensureH1(n.body, n.title));
        updated++;
      } else {
        const slug = uniqueSlug(this.root, n.title);
        const fm = {
          title: n.title,
          ...(n.frontmatter ?? {}),
          source,
          sourceId: n.sourceId,
        };
        writeMemory(this.root, slug, fm, ensureH1(n.body, n.title));
        // Keep the map current so two incoming notes with the same sourceId
        // collapse onto one file within a single batch.
        prior.set(String(n.sourceId), loadMemory(pathForSlug(this.root, slug)));
        created++;
      }
    }
    return { created, updated };
  }

  /** Resolve an identifier (slug, title, path, or wikilink target) to a note. */
  private resolve(identifier: string): Memory {
    // Exact slug path first — cheapest.
    const direct = pathForSlug(this.root, identifier.replace(/\.md$/i, ""));
    const all = loadAll(this.root);
    const key = normalizeKey(identifier);
    const hit =
      all.find((m) => m.path === direct) ??
      all.find((m) => normalizeKey(m.slug) === key) ??
      all.find((m) => normalizeKey(m.title) === key);
    if (!hit) throw new MemoryNotFoundError(identifier);
    return hit;
  }
}

function strip(m: Memory): MemoryMeta {
  const { body: _body, ...meta } = m;
  return meta;
}

/** Guarantee the body opens with an H1 matching the title. */
function ensureH1(body: string, title: string): string {
  const trimmed = body.trimStart();
  if (/^#\s+/.test(trimmed)) return body;
  return `# ${title}\n\n${body.trim()}\n`;
}

/** Re-export so a downstream ranker can see what links a body declares. */
export { extractLinks };
