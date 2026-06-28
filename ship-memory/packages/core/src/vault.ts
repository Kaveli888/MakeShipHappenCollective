/**
 * Vault store — the only module that touches the filesystem.
 *
 * A "hub" is a `.shipmemory/` directory of `.md` notes. All disk I/O funnels
 * through the injected {@link VaultFs}, so the same engine runs on node (MCP,
 * CLIs), inside a Tauri webview (ShipMemory.app), or over any future backend
 * (S3, REST) — without the engine knowing which.
 *
 * Paths are absolute `/`-separated strings; see `./path.js`.
 */

import type { VaultFs } from "./fs.js";
import { dirnamePath, joinPath, normalizePath } from "./path.js";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import { extractLinks } from "./links.js";
import { slugify } from "./slug.js";
import { HUB_DIRNAME, type Memory } from "./types.js";

export async function findHub(
  fs: VaultFs,
  startDir: string,
): Promise<string | null> {
  let dir = normalizePath(startDir);
  // Already inside a hub.
  if (dir.endsWith(HUB_DIRNAME) && (await fs.exists(dir))) return dir;
  while (true) {
    const candidate = joinPath(dir, HUB_DIRNAME);
    if (
      (await fs.exists(candidate)) &&
      (await fs.stat(candidate)).isDirectory
    ) {
      return candidate;
    }
    const parent = dirnamePath(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function initHub(fs: VaultFs, dir: string): Promise<string> {
  const normalized = normalizePath(dir);
  const root = normalized.endsWith(HUB_DIRNAME)
    ? normalized
    : joinPath(normalized, HUB_DIRNAME);
  await fs.mkdir(root);
  return root;
}

async function noteFiles(fs: VaultFs, hubRoot: string): Promise<string[]> {
  if (!(await fs.exists(hubRoot))) return [];
  return (await fs.readdir(hubRoot))
    .filter((f) => f.endsWith(".md"))
    .map((f) => joinPath(hubRoot, f));
}

export async function loadMemory(fs: VaultFs, path: string): Promise<Memory> {
  const raw = await fs.readFile(path);
  const { frontmatter, body } = parseFrontmatter(raw);
  const stat = await fs.stat(path);
  const slug = basenameSlug(path);
  const title = titleOf(body, frontmatter, slug);
  return {
    title,
    slug,
    path,
    frontmatter,
    body,
    links: extractLinks(body),
    modified: stat.mtimeMs,
    created: stat.birthtimeMs || stat.mtimeMs,
  };
}

export async function loadAll(fs: VaultFs, hubRoot: string): Promise<Memory[]> {
  const files = await noteFiles(fs, hubRoot);
  return Promise.all(files.map((f) => loadMemory(fs, f)));
}

export function pathForSlug(hubRoot: string, slug: string): string {
  return joinPath(hubRoot, `${slug}.md`);
}

export async function writeMemory(
  fs: VaultFs,
  hubRoot: string,
  slug: string,
  frontmatter: Record<string, unknown>,
  body: string,
): Promise<string> {
  const path = pathForSlug(hubRoot, slug);
  await fs.mkdir(dirnamePath(path));
  await fs.writeFile(path, serializeFrontmatter(frontmatter, body));
  return path;
}

export async function removeMemory(fs: VaultFs, path: string): Promise<void> {
  await fs.remove(path);
}

export async function uniqueSlug(
  fs: VaultFs,
  hubRoot: string,
  title: string,
): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let n = 2;
  while (await fs.exists(pathForSlug(hubRoot, slug))) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function basenameSlug(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? path;
  return file.replace(/\.md$/i, "");
}

/** Prefer an explicit `title:` in frontmatter, then the first H1, then slug. */
function titleOf(
  body: string,
  frontmatter: Record<string, unknown>,
  slug: string,
): string {
  if (typeof frontmatter.title === "string" && frontmatter.title.trim()) {
    return frontmatter.title.trim();
  }
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return slug;
}
