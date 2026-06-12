/**
 * Node implementation of the {@link VaultFs} seam.
 *
 * Lives behind the `@ship-memory/core/node` subpath export — NOT the main
 * entry — so browser/Tauri bundles of core never pull in `node:fs`. Node
 * hosts (MCP server, connector CLIs) import it explicitly and pass it to the
 * engine.
 */

import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import type { FileStat, VaultFs } from "./fs.js";

export const nodeFs: VaultFs = {
  async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  },

  async stat(path: string): Promise<FileStat> {
    const s = await stat(path);
    return {
      mtimeMs: s.mtimeMs,
      birthtimeMs: s.birthtimeMs || s.mtimeMs,
      isDirectory: s.isDirectory(),
    };
  },

  async mkdir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  },

  async readdir(path: string): Promise<string[]> {
    return readdir(path);
  },

  async readFile(path: string): Promise<string> {
    return readFile(path, "utf8");
  },

  async writeFile(path: string, content: string): Promise<void> {
    await writeFile(path, content, "utf8");
  },

  async remove(path: string): Promise<void> {
    await rm(path, { force: true });
  },
};
