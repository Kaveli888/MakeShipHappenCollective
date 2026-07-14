/**
 * Pure path helpers — the subset of `node:path` (posix flavor) that core
 * needs, reimplemented so core runs in any JS host (node, Tauri webview,
 * browser). Callers hand core ABSOLUTE paths; these helpers only join,
 * normalize, and walk them. No cwd, no platform branching.
 */

/** Collapse `//`, `.` and `..` segments. Preserves a leading `/`. */
export function normalizePath(path: string): string {
  const abs = path.startsWith("/");
  const out: string[] = [];
  for (const seg of path.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (out.length && out[out.length - 1] !== "..") out.pop();
      else if (!abs) out.push("..");
      continue;
    }
    out.push(seg);
  }
  return (abs ? "/" : "") + out.join("/") || (abs ? "/" : ".");
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join("/"));
}

export function dirnamePath(path: string): string {
  const p = normalizePath(path);
  const i = p.lastIndexOf("/");
  if (i < 0) return ".";
  if (i === 0) return "/";
  return p.slice(0, i);
}
