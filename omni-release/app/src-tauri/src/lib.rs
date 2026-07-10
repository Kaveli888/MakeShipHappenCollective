//! Omni Release desktop shell.
//!
//! The UI is a thin front-end; all work runs through the existing Node/TS engine
//! (`<root>/dist/cli/index.js`). These commands shell out to that CLI with
//! `--json` and return its stdout for the front-end to parse. This keeps a
//! single source of truth (the engine) and makes the desktop app a pure view.

mod agent;
mod commands;
mod db;
mod models;
mod publish;
mod scheduler;

#[cfg(test)]
mod spine_tests;

use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

/// Resolve the engine repo root (the `omni-release` directory).
/// Override with `OMNI_ENGINE_ROOT`; otherwise it's two levels up from this
/// crate (app/src-tauri -> app -> omni-release), baked at compile time.
pub(crate) fn engine_root() -> PathBuf {
    if let Ok(p) = std::env::var("OMNI_ENGINE_ROOT") {
        return PathBuf::from(p);
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
}

/// Locate a Node binary. GUI apps don't inherit the shell PATH, so we probe the
/// usual locations (nvm versions newest-first, Homebrew, /usr/local, /usr).
/// Override with `OMNI_NODE_BIN`.
fn find_node() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("OMNI_NODE_BIN") {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Some(pb);
        }
    }
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        let nvm = PathBuf::from(&home).join(".nvm/versions/node");
        if let Ok(entries) = std::fs::read_dir(&nvm) {
            let mut versions: Vec<PathBuf> =
                entries.filter_map(|e| e.ok().map(|e| e.path())).collect();
            versions.sort();
            versions.reverse(); // newest first
            for v in versions {
                candidates.push(v.join("bin/node"));
            }
        }
    }
    candidates.push(PathBuf::from("/opt/homebrew/bin/node"));
    candidates.push(PathBuf::from("/usr/local/bin/node"));
    candidates.push(PathBuf::from("/usr/bin/node"));
    candidates.into_iter().find(|p| p.exists())
}

/// Run the engine CLI with the given args; return stdout on success.
fn run_engine(args: Vec<String>) -> Result<String, String> {
    let root = engine_root();
    let node = find_node()
        .ok_or_else(|| "Could not find a Node binary. Set OMNI_NODE_BIN.".to_string())?;
    let cli = root.join("dist/cli/index.js");
    if !cli.exists() {
        return Err(format!(
            "Engine not built: {} is missing. Run `npm run build` in {}.",
            cli.display(),
            root.display()
        ));
    }
    let output = Command::new(&node)
        .arg(&cli)
        .args(&args)
        .current_dir(&root)
        .output()
        .map_err(|e| format!("failed to spawn node: {e}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(format!(
            "engine error ({}): {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

#[tauri::command]
fn engine_info() -> serde_json::Value {
    let root = engine_root();
    serde_json::json!({
        "root": root.to_string_lossy(),
        "node": find_node().map(|p| p.to_string_lossy().to_string()),
        "built": root.join("dist/cli/index.js").exists(),
    })
}

#[tauri::command]
fn list_lanes() -> Result<String, String> {
    run_engine(vec!["lanes".into(), "--json".into()])
}

#[tauri::command]
async fn run_lane(lane: String, mode: String, dry_run: bool) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut args = vec![
            "run-lane".to_string(),
            "--lane".to_string(),
            lane,
            "--mode".to_string(),
            mode,
        ];
        if dry_run {
            args.push("--dry-run".to_string());
        }
        args.push("--json".to_string());
        run_engine(args)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn list_queue() -> Result<String, String> {
    run_engine(vec!["queue".into(), "--json".into()])
}

#[tauri::command]
fn read_log(n: u32) -> Result<String, String> {
    run_engine(vec![
        "log:latest".into(),
        "--n".into(),
        n.to_string(),
        "--json".into(),
    ])
}

/// File extensions `open_path` is allowed to open. Anything else is refused so a
/// crafted engine-output path can't be used to launch an arbitrary executable.
const OPENABLE_EXTENSIONS: &[&str] = &["md", "png", "jpg", "jpeg", "webp", "svg", "json", "txt"];

/// Open a file produced by the engine in the OS default app.
///
/// SECURITY: the resolved, canonicalized target MUST live inside the engine root
/// (defeats `..` traversal and absolute-path escapes), must exist, and — when it
/// is a file — must have a whitelisted extension. Directories inside the root are
/// allowed (e.g. opening a ready-to-post package folder).
#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    let root = engine_root()
        .canonicalize()
        .map_err(|e| format!("cannot resolve engine root: {e}"))?;
    let pb = PathBuf::from(&path);
    let candidate = if pb.is_absolute() { pb } else { root.join(pb) };
    let full = candidate
        .canonicalize()
        .map_err(|_| format!("refused: path does not exist: {}", candidate.display()))?;
    if !full.starts_with(&root) {
        return Err("refused: path is outside the engine root".to_string());
    }
    if full.is_file() {
        let ext_ok = full
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_ascii_lowercase())
            .is_some_and(|ext| OPENABLE_EXTENSIONS.contains(&ext.as_str()));
        if !ext_ok {
            return Err("refused: file type is not allowed to be opened".to_string());
        }
    }
    Command::new("open")
        .arg(&full)
        .status()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Local-first DB lives under the app data dir.
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let conn =
                db::init(&data_dir.join("omni.db")).map_err(|e| format!("db init failed: {e}"))?;
            app.manage(db::DbState(std::sync::Mutex::new(conn)));
            // Start the background scheduled-job runner.
            scheduler::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // existing engine bridge
            engine_info,
            list_lanes,
            run_lane,
            list_queue,
            read_log,
            open_path,
            // capability matrix
            commands::platform_capabilities,
            // media library
            commands::pick_media_files,
            commands::media_import,
            commands::media_list,
            commands::media_thumb,
            commands::media_update,
            commands::media_set_status,
            commands::shipmemory_media_list,
            commands::media_import_shipmemory,
            // campaigns
            commands::campaigns_list,
            commands::campaign_create,
            // posts + composer
            commands::post_create,
            commands::posts_list,
            commands::post_get,
            commands::post_update,
            commands::post_set_media,
            commands::target_upsert,
            commands::target_delete,
            // calendar / scheduling
            commands::schedule_create,
            commands::schedule_cancel,
            commands::schedule_reschedule,
            commands::calendar_list,
            commands::job_retry,
            commands::job_delete,
            commands::job_mark_published,
            // publishing
            commands::publish_now,
            commands::ingest_agent_results,
            commands::agent_queue,
            commands::agent_health,
            commands::agent_handoff_delete,
            // activity
            commands::attempts_list,
            commands::audit_list,
            // cloud bridge
            commands::open_url,
            commands::open_chrome_url,
            commands::media_read_base64,
            commands::media_upload_resumable,
            commands::oauth_start,
            // UI state persistence
            commands::state_get,
            commands::state_set,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
