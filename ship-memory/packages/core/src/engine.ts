/**
 * ShipMemory — the headless engine.
 *
 * This is the whole product in one class: the 12-method surface that
 * bridgememory proved out, reimplemented as code we own, with ZERO coupling to
 * any host app. No MCP, no HTTP, no ShipSpace/BridgeSpace runtime — those are
 * all thin adapters that call into this. Bind it to a hub root + a VaultFs
 * and go.
 *
 * Every method is async and all I/O flows through the injected {@link VaultFs}
 * (node, Tauri, or anything else) — see fs.ts for why.
 */

import {
  ATTACHMENTS_DIRNAME,
  type ConnectionSuggestion,
  type CreateMemoryInput,
  type HubStatus,
  type Memory,
  type MemoryMeta,
  type SearchHit,
} from "./types.js";
import type { VaultFs } from "./fs.js";
import {
  scoreOverlap,
  substringMatch,
  termSet,
} from "./search.js";
import { extractLinks } from "./links.js";
import { normalizeKey, slugify } from "./slug.js";
import { joinPath, normalizePath } from "./path.js";
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
  private readonly fs: VaultFs;

  constructor(hubRoot: string, fs: VaultFs) {
    this.root = hubRoot;
    this.fs = fs;
  }

  /**
   * Discover a hub by walking up from `cwd` (absolute). Throws if none exists —
   * callers that want "create if missing" should call {@link ShipMemory.create}.
   */
  static async open(cwd: string, fs: VaultFs): Promise<ShipMemory> {
    const root = await findHub(fs, cwd);
    if (!root) throw new HubNotFoundError(cwd);
    return new ShipMemory(root, fs);
  }

  /** Create (or attach to) a hub under `dir`. */
  static async create(dir: string, fs: VaultFs): Promise<ShipMemory> {
    return new ShipMemory(await initHub(fs, dir), fs);
  }

  // ── 1. hub_status ────────────────────────────────────────────────────────
  static async status(cwd: string, fs: VaultFs): Promise<HubStatus> {
    const root = await findHub(fs, cwd);
    if (!root) return { hub: null, searchedFrom: cwd, count: 0 };
    return {
      hub: root,
      searchedFrom: cwd,
      count: (await loadAll(fs, root)).length,
    };
  }

  // ── 2. list_memories ─────────────────────────────────────────────────────
  async list(): Promise<MemoryMeta[]> {
    return (await loadAll(this.fs, this.root))
      .map(strip)
      .sort((a, b) => b.modified - a.modified);
  }

  // ── 3. read_memory ───────────────────────────────────────────────────────
  async read(identifier: string): Promise<Memory> {
    return this.resolve(identifier);
  }

  // ── 4. search_memories ───────────────────────────────────────────────────
  async search(query: string, limit = 20): Promise<SearchHit[]> {
    const q = termSet(query);
    const hits: SearchHit[] = [];
    for (const m of await loadAll(this.fs, this.root)) {
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
  async backlinks(target: string): Promise<MemoryMeta[]> {
    const key = normalizeKey(target);
    const out: MemoryMeta[] = [];
    for (const m of await loadAll(this.fs, this.root)) {
      if (m.links.some((l) => normalizeKey(l) === key)) out.push(strip(m));
    }
    return out;
  }

  // ── 6. create_memory ─────────────────────────────────────────────────────
  async create(input: CreateMemoryInput): Promise<Memory> {
    const slug = await uniqueSlug(this.fs, this.root, input.title);
    const frontmatter = { title: input.title, ...(input.frontmatter ?? {}) };
    const body = ensureH1(input.body, input.title);
    const path = await writeMemory(this.fs, this.root, slug, frontmatter, body);
    return loadMemory(this.fs, path);
  }

  // ── 7. append_to_memory ──────────────────────────────────────────────────
  async append(identifier: string, text: string): Promise<Memory> {
    const m = await this.resolve(identifier);
    const sep = m.body.endsWith("\n") ? "\n" : "\n\n";
    const body = m.body + sep + text.trim() + "\n";
    await writeMemory(this.fs, this.root, m.slug, m.frontmatter, body);
    return loadMemory(this.fs, m.path);
  }

  // ── 8. update_memory ─────────────────────────────────────────────────────
  async update(identifier: string, body: string): Promise<Memory> {
    const m = await this.resolve(identifier);
    await writeMemory(
      this.fs,
      this.root,
      m.slug,
      m.frontmatter,
      ensureH1(body, m.title),
    );
    return loadMemory(this.fs, m.path);
  }

  // ── 9. delete_memory ─────────────────────────────────────────────────────
  async delete(
    identifier: string,
  ): Promise<{ deleted: string; backlinks: MemoryMeta[] }> {
    const m = await this.resolve(identifier);
    const backlinks = await this.backlinks(m.slug);
    await removeMemory(this.fs, m.path);
    return { deleted: m.slug, backlinks };
  }

  // ── 10. suggest_connections ──────────────────────────────────────────────
  async suggestConnections(
    identifier: string,
    limit = 10,
  ): Promise<ConnectionSuggestion[]> {
    const self = await this.resolve(identifier);
    const selfKey = normalizeKey(self.slug);
    const selfTerms = termSet(`${self.title} ${self.body}`);
    const already = new Set(self.links.map(normalizeKey));

    const out: ConnectionSuggestion[] = [];
    for (const m of await loadAll(this.fs, this.root)) {
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
  async orphans(): Promise<MemoryMeta[]> {
    const all = await loadAll(this.fs, this.root);
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

  // ── frontmatter patch ────────────────────────────────────────────────────
  //
  // Merge keys into a note's frontmatter without touching the body. NOT part
  // of the 12-tool MCP surface — it's the host/UI API (pinning, tags,
  // properties panels). A key set to `undefined` is removed.

  async setFrontmatter(
    identifier: string,
    patch: Record<string, unknown>,
  ): Promise<Memory> {
    const m = await this.resolve(identifier);
    const fm: Record<string, unknown> = { ...m.frontmatter };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete fm[k];
      else fm[k] = v;
    }
    await writeMemory(this.fs, this.root, m.slug, fm, m.body);
    return loadMemory(this.fs, m.path);
  }

  // ── attachments ──────────────────────────────────────────────────────────
  //
  // Binary sidecar files (images, audio, anything) live in
  // `<hub>/attachments/`. The note scanner only reads top-level `*.md`, so
  // this directory is invisible to list/search. Notes reference attachments
  // with ordinary markdown links: `![photo](attachments/photo.png)`.

  /**
   * Store bytes under `attachments/`, de-conflicting the name. Returns the
   * hub-relative path to embed in a note body.
   */
  async saveAttachment(
    name: string,
    data: Uint8Array,
  ): Promise<{ name: string; relPath: string }> {
    const dir = joinPath(this.root, ATTACHMENTS_DIRNAME);
    await this.fs.mkdir(dir);
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
    const stem = slugify(dot > 0 ? name.slice(0, dot) : name) || "attachment";
    let file = `${stem}${ext}`;
    let n = 2;
    while (await this.fs.exists(joinPath(dir, file))) {
      file = `${stem}-${n++}${ext}`;
    }
    await this.fs.writeFileBinary(joinPath(dir, file), data);
    return { name: file, relPath: `${ATTACHMENTS_DIRNAME}/${file}` };
  }

  /** Read an attachment by its hub-relative path (as embedded in notes). */
  async readAttachment(relPath: string): Promise<Uint8Array> {
    const full = normalizePath(joinPath(this.root, relPath));
    // Confine to the attachments dir — a note body is untrusted input.
    if (!full.startsWith(joinPath(this.root, ATTACHMENTS_DIRNAME) + "/")) {
      throw new Error(`Not an attachment path: ${relPath}`);
    }
    return this.fs.readFileBinary(full);
  }

  /** Delete an attachment by its hub-relative path. */
  async deleteAttachment(relPath: string): Promise<void> {
    const full = normalizePath(joinPath(this.root, relPath));
    if (!full.startsWith(joinPath(this.root, ATTACHMENTS_DIRNAME) + "/")) {
      throw new Error(`Not an attachment path: ${relPath}`);
    }
    await this.fs.remove(full);
  }

  // ── connector ingest ─────────────────────────────────────────────────────
  //
  // The seam every connector funnels through. NOT part of the 12-tool MCP
  // surface — it's the host/sync API. Idempotent by (`source`, `sourceId`):
  // a note seen before is rewritten in place, never duplicated, so re-running
  // a vault import converges instead of multiplying.

  /** Find a note previously imported from a connector. */
  async findBySource(source: string, sourceId: string): Promise<Memory | null> {
    const want = String(sourceId);
    for (const m of await loadAll(this.fs, this.root)) {
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
  async ingestMany(
    source: string,
    notes: Array<CreateMemoryInput & { sourceId: string }>,
  ): Promise<{ created: number; updated: number }> {
    const prior = new Map<string, Memory>();
    for (const m of await loadAll(this.fs, this.root)) {
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
        await writeMemory(
          this.fs,
          this.root,
          existing.slug,
          fm,
          ensureH1(n.body, n.title),
        );
        updated++;
      } else {
        const slug = await uniqueSlug(this.fs, this.root, n.title);
        const fm = {
          title: n.title,
          ...(n.frontmatter ?? {}),
          source,
          sourceId: n.sourceId,
        };
        await writeMemory(this.fs, this.root, slug, fm, ensureH1(n.body, n.title));
        // Keep the map current so two incoming notes with the same sourceId
        // collapse onto one file within a single batch.
        prior.set(
          String(n.sourceId),
          await loadMemory(this.fs, pathForSlug(this.root, slug)),
        );
        created++;
      }
    }
    return { created, updated };
  }

  /** Resolve an identifier (slug, title, path, or wikilink target) to a note. */
  private async resolve(identifier: string): Promise<Memory> {
    // Exact slug path first — cheapest.
    const direct = pathForSlug(this.root, identifier.replace(/\.md$/i, ""));
    const all = await loadAll(this.fs, this.root);
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
  const { body, ...meta } = m;
  return { ...meta, snippet: snippetOf(body) };
}

/** Plain-text preview: drop the H1 line and markdown noise, collapse space. */
function snippetOf(body: string): string {
  return body
    .replace(/^#\s+.*$/m, "")
    .replace(/[#*_>`]|\[\[|\]\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Guarantee the body opens with an H1 matching the title. */
function ensureH1(body: string, title: string): string {
  const trimmed = body.trimStart();
  if (/^#\s+/.test(trimmed)) return body;
  return `# ${title}\n\n${body.trim()}\n`;
}

/** Re-export so a downstream ranker can see what links a body declares. */
export { extractLinks };
