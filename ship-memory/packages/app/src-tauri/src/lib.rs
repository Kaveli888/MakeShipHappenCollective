// ShipMemory is deliberately an empty shell: ALL memory logic lives in
// @ship-memory/core (TS) running in the webview, doing file I/O through
// tauri-plugin-fs. The Rust side only grants scoped fs access — keeping the
// core engine the single owner of the vault, same as the MCP server.
//
// The one exception is SD-card backup: the fs plugin is scoped to
// ~/ShipMemory, so the webview can't reach /Volumes. The two commands below
// run on the Rust side (which is NOT bound by that scope) to mirror the vault
// onto a removable volume. One-way and additive — they copy new/changed files
// and never delete anything on the card.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
struct VolumeInfo {
    name: String,
    path: String,
}

/// List mounted removable volumes under /Volumes, excluding the boot volume
/// (which shows up as a symlink to `/`) and macOS bookkeeping entries.
#[tauri::command]
fn list_removable_volumes() -> Vec<VolumeInfo> {
    let mut out = Vec::new();
    let Ok(entries) = fs::read_dir("/Volumes") else {
        return out;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        // Skip dotfiles and macOS bookkeeping entries. The latter (e.g.
        // `com.apple.TimeMachine.localsnapshots`) are real, non-symlink dirs
        // under /Volumes that would otherwise pass the checks below and show
        // up as bogus "cards" — and never let the empty-state message appear.
        if name.starts_with('.') || name.starts_with("com.apple.") {
            continue;
        }
        let path = entry.path();
        // The boot volume ("Macintosh HD") is a symlink to /. Real external
        // volumes are actual directories — keep only those.
        match fs::symlink_metadata(&path) {
            Ok(m) if m.file_type().is_symlink() => continue,
            Ok(m) if m.is_dir() => {}
            _ => continue,
        }
        out.push(VolumeInfo {
            name,
            path: path.to_string_lossy().to_string(),
        });
    }
    out
}

#[derive(Serialize, Clone)]
struct SyncReport {
    copied: usize,
    skipped: usize,
    bytes: u64,
    errors: Vec<String>,
    dest: String,
}

#[derive(Serialize, Clone)]
struct SyncProgress {
    done: usize,
    total: usize,
    current: String,
}

fn collect_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let p = entry.path();
        match entry.file_type() {
            Ok(ft) if ft.is_dir() => collect_files(&p, out),
            Ok(ft) if ft.is_file() => out.push(p),
            _ => {}
        }
    }
}

/// Copy if the target is missing, a different size, or older than the source.
/// A missing/unreadable timestamp errs toward copying — safe for a backup.
fn needs_copy(src: &Path, dst: &Path) -> bool {
    let (Ok(sm), Ok(dm)) = (fs::metadata(src), fs::metadata(dst)) else {
        return true;
    };
    if sm.len() != dm.len() {
        return true;
    }
    let st = sm.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok());
    let dt = dm.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok());
    match (st, dt) {
        (Some(s), Some(d)) => s > d,
        _ => true,
    }
}

/// Mirror `src` (the vault hub) into `dest` on the card. One-way, additive:
/// copies new/changed files, never deletes. Emits `sd-sync://progress` as it
/// goes so the UI can show a live count.
#[tauri::command]
async fn sync_vault_to_dir(
    app: AppHandle,
    src: String,
    dest: String,
) -> Result<SyncReport, String> {
    let src = PathBuf::from(src);
    let dest = PathBuf::from(dest);

    tauri::async_runtime::spawn_blocking(move || {
        if !src.is_dir() {
            return Err(format!("Vault folder not found: {}", src.display()));
        }
        fs::create_dir_all(&dest)
            .map_err(|e| format!("Can't create destination {}: {e}", dest.display()))?;

        let mut files = Vec::new();
        collect_files(&src, &mut files);
        let total = files.len();

        let mut report = SyncReport {
            copied: 0,
            skipped: 0,
            bytes: 0,
            errors: Vec::new(),
            dest: dest.to_string_lossy().to_string(),
        };

        for (i, f) in files.iter().enumerate() {
            let rel = f.strip_prefix(&src).unwrap_or(f);
            let target = dest.join(rel);
            let _ = app.emit(
                "sd-sync://progress",
                SyncProgress {
                    done: i,
                    total,
                    current: rel.to_string_lossy().to_string(),
                },
            );

            if !needs_copy(f, &target) {
                report.skipped += 1;
                continue;
            }
            if let Some(parent) = target.parent() {
                if let Err(e) = fs::create_dir_all(parent) {
                    report.errors.push(format!("{}: {e}", rel.to_string_lossy()));
                    continue;
                }
            }
            match fs::copy(f, &target) {
                Ok(n) => {
                    report.copied += 1;
                    report.bytes += n;
                }
                Err(e) => report.errors.push(format!("{}: {e}", rel.to_string_lossy())),
            }
        }

        let _ = app.emit(
            "sd-sync://progress",
            SyncProgress {
                done: total,
                total,
                current: String::new(),
            },
        );
        Ok(report)
    })
    .await
    .map_err(|e| format!("sync task failed: {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            list_removable_volumes,
            sync_vault_to_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running ShipMemory");
}
