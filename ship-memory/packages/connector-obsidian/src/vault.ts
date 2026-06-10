/**
 * Vault scanning — recursively collect `.md` notes, skipping the noise.
 *
 * Dotfiles/dotdirs (`.obsidian`, `.trash`, `.git`) are always skipped. Callers
 * can add more directory names to ignore (e.g. `_templates`, attachment folders).
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

export function walkVault(root: string, ignoreDirs: Set<string>): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable dir — skip rather than abort the whole import
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue; // .obsidian, .trash, .git, …
      if (e.isDirectory()) {
        if (!ignoreDirs.has(e.name)) stack.push(join(dir, e.name));
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
        out.push(join(dir, e.name));
      }
    }
  }
  return out.sort();
}
