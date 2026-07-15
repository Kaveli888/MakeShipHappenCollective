/**
 * Thin bridge to the Rust SD-card backup commands (see src-tauri/src/lib.rs).
 * The webview's fs plugin is scoped to ~/ShipMemory, so the copy itself runs
 * on the Rust side; this module just invokes it and relays progress events.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface VolumeInfo {
  name: string;
  path: string;
}

export interface SyncReport {
  copied: number;
  skipped: number;
  bytes: number;
  errors: string[];
  dest: string;
}

export interface SyncProgress {
  done: number;
  total: number;
  current: string;
}

/** Mounted removable volumes under /Volumes (boot volume excluded). */
export function listVolumes(): Promise<VolumeInfo[]> {
  return invoke<VolumeInfo[]>("list_removable_volumes");
}

/** Back up: one-way additive mirror of the vault hub into `dest` on the card. */
export function syncVaultToDir(src: string, dest: string): Promise<SyncReport> {
  return invoke<SyncReport>("sync_vault_to_dir", { src, dest });
}

/**
 * Restore: import a card's `ShipMemory/` backup (`src`) into the vault
 * (`dest`). Additive and non-destructive — only copies notes the vault is
 * missing, never overwriting existing ones.
 */
export function importDirToVault(src: string, dest: string): Promise<SyncReport> {
  return invoke<SyncReport>("import_dir_to_vault", { src, dest });
}

/** Subscribe to live copy progress. Remember to call the returned unlisten. */
export function onSyncProgress(
  cb: (p: SyncProgress) => void,
): Promise<UnlistenFn> {
  return listen<SyncProgress>("sd-sync://progress", (e) => cb(e.payload));
}

/** "1.2 MB", "834 KB" — for the report line. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
