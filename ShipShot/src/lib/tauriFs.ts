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
  exists,
  async stat(path: string): Promise<FileStat> {
    const result = await stat(path);
    const mtimeMs = result.mtime ? new Date(result.mtime).getTime() : 0;
    const birthtimeMs = result.birthtime ? new Date(result.birthtime).getTime() : mtimeMs;
    return { mtimeMs, birthtimeMs: birthtimeMs || mtimeMs, isDirectory: result.isDirectory };
  },
  async mkdir(path: string) {
    if (!(await exists(path))) await mkdir(path, { recursive: true });
  },
  async readdir(path: string) {
    return (await readDir(path)).map((entry) => entry.name);
  },
  readFile: readTextFile,
  writeFile: writeTextFile,
  readFileBinary: readFile,
  writeFileBinary: writeFile,
  async remove(path: string) {
    try {
      await remove(path);
    } catch {
      // The memory contract treats an already-removed file as success.
    }
  },
};
