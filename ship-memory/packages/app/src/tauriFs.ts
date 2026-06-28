/**
 * VaultFs implementation over tauri-plugin-fs — the Tauri counterpart of
 * `nodeFs` in @ship-memory/core/node. Scoped by capabilities/default.json to
 * ~/ShipMemory only; anything outside the hub is refused by the Rust side.
 */

import {
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  stat,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { FileStat, VaultFs } from "@ship-memory/core";

export const tauriFs: VaultFs = {
  exists(path: string): Promise<boolean> {
    return exists(path);
  },

  async stat(path: string): Promise<FileStat> {
    const s = await stat(path);
    const mtimeMs = s.mtime ? new Date(s.mtime).getTime() : 0;
    const birthtimeMs = s.birthtime ? new Date(s.birthtime).getTime() : mtimeMs;
    return { mtimeMs, birthtimeMs: birthtimeMs || mtimeMs, isDirectory: s.isDirectory };
  },

  async mkdir(path: string): Promise<void> {
    if (!(await exists(path))) await mkdir(path, { recursive: true });
  },

  async readdir(path: string): Promise<string[]> {
    return (await readDir(path)).map((e) => e.name);
  },

  readFile(path: string): Promise<string> {
    return readTextFile(path);
  },

  writeFile(path: string, content: string): Promise<void> {
    return writeTextFile(path, content);
  },

  readFileBinary(path: string): Promise<Uint8Array> {
    return readFile(path);
  },

  writeFileBinary(path: string, data: Uint8Array): Promise<void> {
    return writeFile(path, data);
  },

  async remove(path: string): Promise<void> {
    try {
      await remove(path);
    } catch {
      // already gone — fine, the contract says remove() must not throw
    }
  },
};
