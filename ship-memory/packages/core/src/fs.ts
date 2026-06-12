/**
 * The filesystem seam.
 *
 * Core never touches a real filesystem — it talks to this small async surface.
 * Each host injects an implementation:
 *
 *   - Node (MCP server, connector CLIs):  `nodeFs` from `@ship-memory/core/node`
 *   - Tauri webview (ShipMemory.app):     adapter over `@tauri-apps/plugin-fs`
 *   - Tests / future backends (S3, REST): anything satisfying this interface
 *
 * The interface is async because the lowest common denominator (browser/Tauri
 * IPC) is async; the node implementation just wraps `node:fs/promises`.
 *
 * All paths are absolute, `/`-separated strings. Core's own path helpers
 * (`./path.js`) are pure and platform-agnostic, so no implementation needs
 * `node:path`.
 */

export interface FileStat {
  /** mtime in epoch ms. */
  mtimeMs: number;
  /** birthtime in epoch ms; implementations fall back to mtime if unknown. */
  birthtimeMs: number;
  isDirectory: boolean;
}

export interface VaultFs {
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStat>;
  /** Recursive; succeeds if the directory already exists. */
  mkdir(path: string): Promise<void>;
  /** File/dir NAMES (not paths) of the directory's direct children. */
  readdir(path: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  /** Delete a file. Must not throw if it's already gone. */
  remove(path: string): Promise<void>;
}
