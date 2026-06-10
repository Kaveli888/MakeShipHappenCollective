/**
 * Vault store — the only module that touches the filesystem.
 *
 * A "hub" is a `.shipmemory/` directory of `.md` notes. Keeping all disk I/O
 * here means the engine stays pure logic and an alternate backend (S3, a DB, a
 * remote API) can implement the same small surface later without rewriting the
 * engine.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import { extractLinks } from "./links.js";
import { slugify } from "./slug.js";
import { HUB_DIRNAME, type Memory } from "./types.js";

export function findHub(startDir: string): string | null {
  let dir = resolve(startDir);
  // Already inside a hub.
  if (dir.endsWith(HUB_DIRNAME) && existsSync(dir)) return dir;
  while (true) {
    const candidate = join(dir, HUB_DIRNAME);
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function initHub(dir: string): string {
  const root =
    resolve(dir).endsWith(HUB_DIRNAME)
      ? resolve(dir)
      : join(resolve(dir), HUB_DIRNAME);
  mkdirSync(root, { recursive: true });
  return root;
}

function noteFiles(hubRoot: string): string[] {
  if (!existsSync(hubRoot)) return [];
  return readdirSync(hubRoot)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(hubRoot, f));
}

export function loadMemory(path: string): Memory {
  const raw = readFileSync(path, "utf8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const stat = statSync(path);
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

export function loadAll(hubRoot: string): Memory[] {
  return noteFiles(hubRoot).map(loadMemory);
}

export function pathForSlug(hubRoot: string, slug: string): string {
  return join(hubRoot, `${slug}.md`);
}

export function writeMemory(
  hubRoot: string,
  slug: string,
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const path = pathForSlug(hubRoot, slug);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeFrontmatter(frontmatter, body), "utf8");
  return path;
}

export function removeMemory(path: string): void {
  if (existsSync(path)) unlinkSync(path);
}

export function uniqueSlug(hubRoot: string, title: string): string {
  const base = slugify(title);
  let slug = base;
  let n = 2;
  while (existsSync(pathForSlug(hubRoot, slug))) {
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
