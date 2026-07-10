//! Tauri command surface for the local-first foundation. Each command maps 1:1
//! to a future REST endpoint, so the server migration is a transport swap.

use crate::db::{self, DbState};
use crate::models::*;
use crate::publish::{self, PlatformCapability, PublishOutcome};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager, State};

const ALLOWED_VIDEO_EXT: &[&str] = &["mp4", "mov", "webm", "mkv", "avi", "m4v"];
const ALLOWED_IMAGE_EXT: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "heic"];
const MAX_BYTES: i64 = 5 * 1024 * 1024 * 1024; // 5 GB guardrail

fn is_image_ext(ext: &str) -> bool {
    ALLOWED_IMAGE_EXT.contains(&ext)
}
fn allowed_ext(ext: &str) -> bool {
    ALLOWED_VIDEO_EXT.contains(&ext) || ALLOWED_IMAGE_EXT.contains(&ext)
}

/* ---------- helpers ---------- */

fn find_bin(name: &str) -> Option<PathBuf> {
    let candidates = [
        format!("/opt/homebrew/bin/{name}"),
        format!("/usr/local/bin/{name}"),
        format!("/usr/bin/{name}"),
    ];
    candidates
        .into_iter()
        .map(PathBuf::from)
        .find(|p| p.exists())
}

fn app_media_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    let media = base.join("media");
    std::fs::create_dir_all(media.join("thumbs")).map_err(|e| e.to_string())?;
    Ok(media)
}

pub const MEDIA_SOURCE_SHIPMEMORY: &str = "shipmemory";

/// The Ship Memory hub's attachments dir (`$SHIP_MEMORY_HUB/.shipmemory/attachments`,
/// hub defaulting to ~/ShipMemory). Referenced media lives here — omni-release
/// reads it in place instead of duplicating bytes into its own media dir.
pub fn shipmemory_attachments_dir() -> Result<PathBuf, String> {
    let hub = std::env::var("SHIP_MEMORY_HUB")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join("ShipMemory"))
        })
        .ok_or("cannot locate Ship Memory hub (no SHIP_MEMORY_HUB or HOME)")?;
    Ok(hub.join(".shipmemory").join("attachments"))
}

/// A referenced storage_key must be a bare filename — no separators, no
/// traversal — so it can only resolve inside the attachments dir.
fn valid_attachment_name(name: &str) -> bool {
    !name.is_empty() && !name.contains('/') && !name.contains('\\') && name != "." && name != ".."
}

/// Absolute path of an asset's bytes: the Ship Memory hub for referenced
/// assets, the app media dir for copied ones.
pub fn resolve_media_path(app: &AppHandle, m: &MediaAsset) -> Result<PathBuf, String> {
    if m.source.as_deref() == Some(MEDIA_SOURCE_SHIPMEMORY) {
        if !valid_attachment_name(&m.storage_key) {
            return Err(format!("invalid ship memory media key: {}", m.storage_key));
        }
        Ok(shipmemory_attachments_dir()?.join(&m.storage_key))
    } else {
        Ok(app_media_dir(app)?.join(&m.storage_key))
    }
}

fn lock<'a>(
    state: &'a State<DbState>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, String> {
    state.0.lock().map_err(|_| "db lock poisoned".to_string())
}

fn b64(bytes: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(T[((n >> 18) & 63) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            T[((n >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            T[(n & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}

#[derive(Default)]
struct Probe {
    duration: Option<f64>,
    width: Option<i64>,
    height: Option<i64>,
}

fn ffprobe(path: &Path) -> Probe {
    let Some(bin) = find_bin("ffprobe") else {
        return Probe::default();
    };
    let out = Command::new(bin)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
        ])
        .arg(path)
        .output();
    let Ok(out) = out else {
        return Probe::default();
    };
    let json: serde_json::Value =
        serde_json::from_slice(&out.stdout).unwrap_or(serde_json::Value::Null);
    let mut p = Probe::default();
    if let Some(streams) = json.get("streams").and_then(|s| s.as_array()) {
        if let Some(v) = streams
            .iter()
            .find(|s| s.get("codec_type").and_then(|c| c.as_str()) == Some("video"))
        {
            p.width = v.get("width").and_then(|w| w.as_i64());
            p.height = v.get("height").and_then(|h| h.as_i64());
        }
    }
    p.duration = json
        .get("format")
        .and_then(|f| f.get("duration"))
        .and_then(|d| d.as_str())
        .and_then(|s| s.parse::<f64>().ok());
    p
}

fn make_thumbnail(src: &Path, dest: &Path) -> bool {
    let Some(bin) = find_bin("ffmpeg") else {
        return false;
    };
    // Try 1s in; fall back to frame 0 for very short clips.
    for ss in ["1", "0"] {
        let ok = Command::new(&bin)
            .args(["-y", "-ss", ss, "-i"])
            .arg(src)
            .args(["-frames:v", "1", "-vf", "scale=480:-1"])
            .arg(dest)
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if ok && dest.exists() {
            return true;
        }
    }
    false
}

/// Downscale a still image (or first frame of an animated gif/webp) to a JPEG
/// thumbnail. Unlike video, there's no seek — just decode + scale.
fn make_image_thumb(src: &Path, dest: &Path) -> bool {
    let Some(bin) = find_bin("ffmpeg") else {
        return false;
    };
    Command::new(&bin)
        .args(["-y", "-i"])
        .arg(src)
        .args(["-frames:v", "1", "-vf", "scale=480:-1"])
        .arg(dest)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
        && dest.exists()
}

fn gcd(a: i64, b: i64) -> i64 {
    if b == 0 {
        a
    } else {
        gcd(b, a % b)
    }
}
fn aspect(w: Option<i64>, h: Option<i64>) -> Option<String> {
    match (w, h) {
        (Some(w), Some(h)) if w > 0 && h > 0 => {
            let g = gcd(w, h).max(1);
            Some(format!("{}:{}", w / g, h / g))
        }
        _ => None,
    }
}

/* ---------- capability matrix ---------- */

#[tauri::command]
pub fn platform_capabilities() -> Vec<PlatformCapability> {
    publish::capabilities()
}

/* ---------- media ---------- */

#[tauri::command]
pub async fn pick_media_files(app: AppHandle) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let all_media: Vec<&str> = ALLOWED_VIDEO_EXT
        .iter()
        .chain(ALLOWED_IMAGE_EXT.iter())
        .copied()
        .collect();
    let files = app
        .dialog()
        .file()
        .add_filter("Media", &all_media)
        .add_filter("Video", ALLOWED_VIDEO_EXT)
        .add_filter("Image", ALLOWED_IMAGE_EXT)
        .blocking_pick_files();
    Ok(files
        .unwrap_or_default()
        .into_iter()
        .filter_map(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub fn media_import(
    app: AppHandle,
    state: State<DbState>,
    path: String,
) -> Result<MediaAsset, String> {
    let src = PathBuf::from(&path);
    if !src.is_file() {
        return Err(format!("not a file: {path}"));
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    if !allowed_ext(&ext) {
        return Err(format!(
            "unsupported file type '.{ext}'. Allowed: {}, {}",
            ALLOWED_VIDEO_EXT.join(", "),
            ALLOWED_IMAGE_EXT.join(", ")
        ));
    }
    let is_image = is_image_ext(&ext);
    let byte_size = std::fs::metadata(&src).map_err(|e| e.to_string())?.len() as i64;
    if byte_size > MAX_BYTES {
        return Err(format!(
            "file too large ({byte_size} bytes); max is {MAX_BYTES}."
        ));
    }

    let media_dir = app_media_dir(&app)?;
    let id = db::new_id("med");
    let stored_name = format!("{id}.{ext}");
    let dest = media_dir.join(&stored_name);
    std::fs::copy(&src, &dest).map_err(|e| format!("copy failed: {e}"))?;

    // ffprobe reads dimensions for both video and image; duration only matters
    // for video (it stays None for stills).
    let probe = ffprobe(&dest);
    let thumb_name = format!("thumbs/{id}.jpg");
    let thumb_path = media_dir.join(&thumb_name);
    let made_thumb = if is_image {
        make_image_thumb(&dest, &thumb_path)
    } else {
        make_thumbnail(&dest, &thumb_path)
    };
    let thumb_key = if made_thumb { Some(thumb_name) } else { None };

    let filename = src
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| stored_name.clone());

    // image/jpg isn't a real MIME subtype — normalize to jpeg.
    let mime_type = if is_image {
        let sub = if ext == "jpg" { "jpeg" } else { ext.as_str() };
        format!("image/{sub}")
    } else {
        format!("video/{ext}")
    };

    let asset = MediaAsset {
        id: id.clone(),
        workspace_id: db::LOCAL_WS.to_string(),
        storage_key: stored_name,
        filename,
        mime_type,
        byte_size,
        duration_sec: if is_image { None } else { probe.duration },
        width: probe.width,
        height: probe.height,
        aspect_ratio: aspect(probe.width, probe.height),
        thumbnail_key: thumb_key,
        title: None,
        description: None,
        tags: vec![],
        campaign_id: None,
        notes: None,
        status: "ready".into(),
        checksum: None,
        source: None,
        created_at: db::now(),
    };
    let conn = lock(&state)?;
    db::insert_media(&conn, &asset).map_err(|e| e.to_string())?;
    db::audit(
        &conn,
        "user",
        "media.import",
        Some("media"),
        Some(&id),
        serde_json::json!({ "filename": asset.filename, "bytes": byte_size }),
    )
    .map_err(|e| e.to_string())?;
    Ok(asset)
}

/// Delete a Library asset from disk and the database. Refuses while any post
/// still uses it. Copied assets lose their file + thumbnail; referenced assets
/// lose only the row + local thumbnail — the Ship Memory hub file is never
/// touched (it belongs to Ship Memory, not us).
#[tauri::command]
pub fn media_delete(app: AppHandle, state: State<DbState>, id: String) -> Result<(), String> {
    let conn = lock(&state)?;
    let m = db::get_media(&conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or("media not found")?;
    let used = db::media_usage_count(&conn, &id).map_err(|e| e.to_string())?;
    if used > 0 {
        return Err(format!(
            "in use by {used} release card(s) — remove it from those cards first"
        ));
    }
    db::delete_media_row(&conn, &id).map_err(|e| e.to_string())?;
    // Row is gone; file cleanup is best-effort (a stray file is harmless,
    // a dangling row is not).
    let media_dir = app_media_dir(&app)?;
    if m.source.as_deref() != Some(MEDIA_SOURCE_SHIPMEMORY) {
        let _ = std::fs::remove_file(media_dir.join(&m.storage_key));
    }
    if let Some(tk) = &m.thumbnail_key {
        let _ = std::fs::remove_file(media_dir.join(tk));
    }
    db::audit(
        &conn,
        "user",
        "media.delete",
        Some("media"),
        Some(&id),
        serde_json::json!({
            "filename": m.filename,
            "bytes": m.byte_size,
            "source": m.source,
        }),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Move a copied asset's bytes into the Ship Memory hub and convert the row
/// into a reference — reclaims the local duplicate while every post keeps
/// working (the asset id never changes).
#[tauri::command]
pub fn media_migrate_shipmemory(
    app: AppHandle,
    state: State<DbState>,
    id: String,
) -> Result<MediaAsset, String> {
    let conn = lock(&state)?;
    let m = db::get_media(&conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or("media not found")?;
    if m.source.as_deref() == Some(MEDIA_SOURCE_SHIPMEMORY) {
        return Err("already referenced from Ship Memory".into());
    }
    let src = app_media_dir(&app)?.join(&m.storage_key);
    if !src.is_file() {
        return Err(format!("local file missing: {}", src.display()));
    }
    let att = shipmemory_attachments_dir()?;
    std::fs::create_dir_all(&att).map_err(|e| e.to_string())?;

    // Prefer the human filename; fall back to the storage key. De-conflict
    // with -2/-3 suffixes, matching Ship Memory's own convention.
    let preferred = if valid_attachment_name(&m.filename) {
        m.filename.clone()
    } else {
        m.storage_key.clone()
    };
    let (stem, ext) = match preferred.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s.to_string(), Some(e.to_string())),
        _ => (preferred.clone(), None),
    };
    let mut candidate = preferred.clone();
    let mut n = 1u32;
    while att.join(&candidate).exists() {
        n += 1;
        candidate = match &ext {
            Some(e) => format!("{stem}-{n}.{e}"),
            None => format!("{stem}-{n}"),
        };
        if n > 999 {
            return Err("could not find a free attachment name".into());
        }
    }
    let dest = att.join(&candidate);
    std::fs::copy(&src, &dest).map_err(|e| format!("copy to hub failed: {e}"))?;
    let src_len = std::fs::metadata(&src).map(|md| md.len()).unwrap_or(0);
    let dest_len = std::fs::metadata(&dest).map(|md| md.len()).unwrap_or(u64::MAX);
    if src_len != dest_len {
        let _ = std::fs::remove_file(&dest);
        return Err("copy verification failed (size mismatch); nothing changed".into());
    }
    db::set_media_source_key(&conn, &id, Some(MEDIA_SOURCE_SHIPMEMORY), &candidate)
        .map_err(|e| e.to_string())?;
    // DB now points at the hub — the local duplicate is dead weight.
    let _ = std::fs::remove_file(&src);
    db::audit(
        &conn,
        "user",
        "media.migrate_shipmemory",
        Some("media"),
        Some(&id),
        serde_json::json!({ "from": m.storage_key, "to": candidate, "bytes": m.byte_size }),
    )
    .map_err(|e| e.to_string())?;
    db::get_media(&conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or("media vanished mid-migration".into())
}

/// Media files available in the Ship Memory hub's attachments dir that the
/// Library can reference without copying.
#[tauri::command]
pub fn shipmemory_media_list() -> Result<Vec<serde_json::Value>, String> {
    let dir = shipmemory_attachments_dir()?;
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()).map(String::from) else {
            continue;
        };
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_ascii_lowercase())
            .unwrap_or_default();
        if !allowed_ext(&ext) {
            continue;
        }
        let bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
        out.push(serde_json::json!({
            "name": name,
            "byteSize": bytes,
            "kind": if is_image_ext(&ext) { "image" } else { "video" },
        }));
    }
    out.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
    Ok(out)
}

/// Add a Library entry that REFERENCES a Ship Memory attachment in place.
/// No bytes are copied — only a small local thumbnail is generated. Importing
/// the same attachment twice returns the existing entry instead of a duplicate.
#[tauri::command]
pub fn media_import_shipmemory(
    app: AppHandle,
    state: State<DbState>,
    name: String,
) -> Result<MediaAsset, String> {
    if !valid_attachment_name(&name) {
        return Err(format!("invalid attachment name: {name}"));
    }
    let ext = Path::new(&name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    if !allowed_ext(&ext) {
        return Err(format!(
            "unsupported file type '.{ext}'. Allowed: {}, {}",
            ALLOWED_VIDEO_EXT.join(", "),
            ALLOWED_IMAGE_EXT.join(", ")
        ));
    }
    let src = shipmemory_attachments_dir()?.join(&name);
    if !src.is_file() {
        return Err(format!("not found in Ship Memory attachments: {name}"));
    }
    let byte_size = std::fs::metadata(&src).map_err(|e| e.to_string())?.len() as i64;
    if byte_size > MAX_BYTES {
        return Err(format!(
            "file too large ({byte_size} bytes); max is {MAX_BYTES}."
        ));
    }

    // Re-importing the same attachment is a no-op returning the existing row.
    {
        let conn = lock(&state)?;
        if let Some(existing) =
            db::find_media_by_source_key(&conn, MEDIA_SOURCE_SHIPMEMORY, &name)
                .map_err(|e| e.to_string())?
        {
            return Ok(existing);
        }
    }

    let is_image = is_image_ext(&ext);
    let media_dir = app_media_dir(&app)?; // thumbs still live locally (tiny)
    let id = db::new_id("med");
    let probe = ffprobe(&src);
    let thumb_name = format!("thumbs/{id}.jpg");
    let thumb_path = media_dir.join(&thumb_name);
    let made_thumb = if is_image {
        make_image_thumb(&src, &thumb_path)
    } else {
        make_thumbnail(&src, &thumb_path)
    };
    let thumb_key = if made_thumb { Some(thumb_name) } else { None };

    let mime_type = if is_image {
        let sub = if ext == "jpg" { "jpeg" } else { ext.as_str() };
        format!("image/{sub}")
    } else {
        format!("video/{ext}")
    };

    let asset = MediaAsset {
        id: id.clone(),
        workspace_id: db::LOCAL_WS.to_string(),
        storage_key: name.clone(),
        filename: name.clone(),
        mime_type,
        byte_size,
        duration_sec: if is_image { None } else { probe.duration },
        width: probe.width,
        height: probe.height,
        aspect_ratio: aspect(probe.width, probe.height),
        thumbnail_key: thumb_key,
        title: None,
        description: None,
        tags: vec![],
        campaign_id: None,
        notes: None,
        status: "ready".into(),
        checksum: None,
        source: Some(MEDIA_SOURCE_SHIPMEMORY.to_string()),
        created_at: db::now(),
    };
    let conn = lock(&state)?;
    db::insert_media(&conn, &asset).map_err(|e| e.to_string())?;
    db::audit(
        &conn,
        "user",
        "media.import_ref",
        Some("media"),
        Some(&id),
        serde_json::json!({ "filename": asset.filename, "bytes": byte_size, "source": MEDIA_SOURCE_SHIPMEMORY }),
    )
    .map_err(|e| e.to_string())?;
    Ok(asset)
}

#[tauri::command]
pub fn media_list(
    state: State<DbState>,
    include_archived: bool,
) -> Result<Vec<MediaAsset>, String> {
    let conn = lock(&state)?;
    db::list_media(&conn, include_archived).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn media_thumb(
    app: AppHandle,
    state: State<DbState>,
    id: String,
) -> Result<Option<String>, String> {
    let conn = lock(&state)?;
    let Some(m) = db::get_media(&conn, &id).map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    let Some(key) = m.thumbnail_key else {
        return Ok(None);
    };
    drop(conn);
    let path = app_media_dir(&app)?.join(key);
    match std::fs::read(&path) {
        Ok(bytes) => Ok(Some(format!("data:image/jpeg;base64,{}", b64(&bytes)))),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn media_update(
    state: State<DbState>,
    id: String,
    title: Option<String>,
    description: Option<String>,
    tags: Vec<String>,
    notes: Option<String>,
    campaign_id: Option<String>,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::update_media_meta(&conn, &id, title, description, tags, notes, campaign_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn media_set_status(state: State<DbState>, id: String, status: String) -> Result<(), String> {
    let conn = lock(&state)?;
    db::set_media_status(&conn, &id, &status).map_err(|e| e.to_string())
}

/* ---------- campaigns ---------- */

#[tauri::command]
pub fn campaigns_list(state: State<DbState>) -> Result<Vec<Campaign>, String> {
    let conn = lock(&state)?;
    db::list_campaigns(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn campaign_create(
    state: State<DbState>,
    name: String,
    color: Option<String>,
) -> Result<String, String> {
    let conn = lock(&state)?;
    db::insert_campaign(&conn, &name, color.as_deref()).map_err(|e| e.to_string())
}

/* ---------- posts ---------- */

#[tauri::command]
pub fn post_create(
    state: State<DbState>,
    media_asset_id: Option<String>,
) -> Result<String, String> {
    let conn = lock(&state)?;
    let id = db::insert_post(&conn, media_asset_id.as_deref()).map_err(|e| e.to_string())?;
    db::audit(
        &conn,
        "user",
        "post.create",
        Some("post"),
        Some(&id),
        serde_json::Value::Null,
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn posts_list(state: State<DbState>) -> Result<Vec<Post>, String> {
    let conn = lock(&state)?;
    db::list_posts(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn post_get(state: State<DbState>, id: String) -> Result<Option<PostBundle>, String> {
    let conn = lock(&state)?;
    db::bundle(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn post_update(
    state: State<DbState>,
    id: String,
    media_asset_id: Option<String>,
    master_caption: Option<String>,
    link: Option<String>,
    cta: Option<String>,
    campaign_id: Option<String>,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::update_post(
        &conn,
        &id,
        media_asset_id,
        master_caption,
        link,
        cta,
        campaign_id,
    )
    .map_err(|e| e.to_string())
}

/// Replace the ordered set of media attached to a post (the carousel that ships
/// together). Pass the media ids in the order the user selected them.
#[tauri::command]
pub fn post_set_media(
    state: State<DbState>,
    post_id: String,
    media_ids: Vec<String>,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::set_post_media(&conn, &post_id, &media_ids).map_err(|e| e.to_string())?;
    db::audit(
        &conn,
        "user",
        "post.set_media",
        Some("post"),
        Some(&post_id),
        serde_json::json!({ "count": media_ids.len() }),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/* ---------- targets ---------- */

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn target_upsert(
    state: State<DbState>,
    post_id: String,
    platform: String,
    caption_override: Option<String>,
    title_override: Option<String>,
    hashtags: Vec<String>,
    thumbnail_media_id: Option<String>,
    privacy: Option<String>,
    options: Option<serde_json::Value>,
) -> Result<String, String> {
    let conn = lock(&state)?;
    db::upsert_target(
        &conn,
        &post_id,
        &platform,
        caption_override,
        title_override,
        hashtags,
        thumbnail_media_id,
        privacy,
        options.unwrap_or(serde_json::Value::Null),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn target_delete(
    state: State<DbState>,
    post_id: String,
    platform: String,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::delete_target(&conn, &post_id, &platform).map_err(|e| e.to_string())
}

/// Delete a scheduled job (calendar entry) from the local DB.
#[tauri::command]
pub fn job_delete(state: State<DbState>, job_id: String) -> Result<(), String> {
    let conn = lock(&state)?;
    db::delete_job(&conn, &job_id).map_err(|e| e.to_string())?;
    db::audit(
        &conn,
        "user",
        "job.delete",
        Some("job"),
        Some(&job_id),
        serde_json::json!({}),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/* ---------- scheduling ---------- */

#[tauri::command]
pub fn schedule_create(
    state: State<DbState>,
    target_id: String,
    scheduled_for: String,
    timezone: String,
    max_attempts: Option<i64>,
) -> Result<String, String> {
    let conn = lock(&state)?;
    let id = db::insert_job(
        &conn,
        &target_id,
        &scheduled_for,
        &timezone,
        max_attempts.unwrap_or(5),
    )
    .map_err(|e| e.to_string())?;
    db::audit(
        &conn,
        "user",
        "schedule.create",
        Some("job"),
        Some(&id),
        serde_json::json!({ "target": target_id, "for": scheduled_for, "tz": timezone }),
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn schedule_cancel(state: State<DbState>, job_id: String) -> Result<(), String> {
    let conn = lock(&state)?;
    db::cancel_job(&conn, &job_id).map_err(|e| e.to_string())?;
    db::audit(
        &conn,
        "user",
        "schedule.cancel",
        Some("job"),
        Some(&job_id),
        serde_json::Value::Null,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn schedule_reschedule(
    state: State<DbState>,
    job_id: String,
    scheduled_for: String,
    timezone: String,
) -> Result<(), String> {
    let conn = lock(&state)?;
    db::reschedule_job(&conn, &job_id, &scheduled_for, &timezone).map_err(|e| e.to_string())?;
    db::audit(
        &conn,
        "user",
        "schedule.reschedule",
        Some("job"),
        Some(&job_id),
        serde_json::json!({ "for": scheduled_for }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn calendar_list(
    state: State<DbState>,
    from: String,
    to: String,
) -> Result<Vec<CalendarEntry>, String> {
    let conn = lock(&state)?;
    db::calendar_range(&conn, &from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn job_retry(state: State<DbState>, job_id: String) -> Result<(), String> {
    let conn = lock(&state)?;
    let now = db::now();
    // Reset a failed/exhausted job so the scheduler picks it up immediately.
    conn.execute(
        "UPDATE scheduled_jobs SET status='pending', run_after=?2, locked_by=NULL, locked_at=NULL WHERE id=?1",
        rusqlite::params![job_id, now],
    )
    .map_err(|e| e.to_string())?;
    db::audit(
        &conn,
        "user",
        "job.retry",
        Some("job"),
        Some(&job_id),
        serde_json::Value::Null,
    )
    .map_err(|e| e.to_string())
}

/// Manually mark a scheduled release as published — for when the user posts it
/// on the platform themselves. Records a manual publish attempt, flips the
/// target to `published`, completes the calendar job, and retires any live
/// browser-agent card so the agent can never double-post it (an archived
/// job_id is blocked by the agent's idempotency rule).
#[tauri::command]
pub fn job_mark_published(
    state: State<DbState>,
    job_id: String,
    external_url: Option<String>,
) -> Result<(), String> {
    let conn = lock(&state)?;
    let job = db::get_job(&conn, &job_id)
        .map_err(|e| e.to_string())?
        .ok_or("job not found")?;
    let target_id = job.post_platform_target_id.clone();
    let url = external_url.unwrap_or_default();

    let attempt_no = db::next_attempt_no(&conn, &target_id).map_err(|e| e.to_string())?;
    let att = db::start_attempt(&conn, Some(&job_id), &target_id, attempt_no, "manual")
        .map_err(|e| e.to_string())?;
    db::finish_attempt(
        &conn,
        &att,
        "success",
        None,
        (!url.is_empty()).then_some(url.as_str()),
        serde_json::json!({ "manual": true, "note": "marked published by user" }),
        None,
        None,
    )
    .map_err(|e| e.to_string())?;
    db::mark_target_published(&conn, &target_id, "", &url).map_err(|e| e.to_string())?;
    db::mark_job_done(&conn, &job_id).map_err(|e| e.to_string())?;
    if let Some(t) = db::get_target(&conn, &target_id).map_err(|e| e.to_string())? {
        let _ = db::recompute_post_status(&conn, &t.post_id);
    }

    let base = crate::agent::outbox_dir(&crate::engine_root());
    let due_dir = base.join("due").join(&job_id);
    if due_dir.exists() {
        let arch = base.join("archive").join(&job_id);
        std::fs::create_dir_all(&arch).map_err(|e| e.to_string())?;
        let stamp = db::now().replace([':', '/', '+'], "-");
        let dest = if arch.join("due").exists() {
            arch.join(format!("due-manual-{stamp}"))
        } else {
            arch.join("due")
        };
        std::fs::rename(&due_dir, &dest)
            .map_err(|e| format!("archive handoff {job_id}: {e}"))?;
        let note = serde_json::json!({ "manually_published_at": db::now(), "by": "user" });
        let _ = std::fs::write(
            arch.join("manual-published.json"),
            serde_json::to_vec_pretty(&note).unwrap_or_default(),
        );
    }

    db::audit(
        &conn,
        "user",
        "job.mark_published",
        Some("job"),
        Some(&job_id),
        serde_json::json!({ "target": target_id, "url": url }),
    )
    .map_err(|e| e.to_string())
}

/* ---------- publishing ---------- */

#[tauri::command]
pub fn publish_now(
    state: State<DbState>,
    target_id: String,
    mode: String,
) -> Result<PublishOutcome, String> {
    let conn = lock(&state)?;
    let target = db::get_target(&conn, &target_id)
        .map_err(|e| e.to_string())?
        .ok_or("target not found")?;
    publish::publish_target(&conn, &target, None, &mode).map_err(|e| e.to_string())
}

/// Pull in any results the Claude agent has written to `outbox/done/` — records a
/// publish attempt + updates the target — and return how many were processed. The
/// scheduler calls this each tick; exposed here for a manual "sync now" from the UI.
#[tauri::command]
pub fn ingest_agent_results(state: State<DbState>) -> Result<u32, String> {
    let root = crate::engine_root();
    let conn = lock(&state)?;
    crate::agent::ingest_results(&conn, &root)
}

/// List active cards in `outbox/due/` exactly as the browser publishing agent sees
/// them. This powers the desktop Agent Queue view.
#[tauri::command]
pub fn agent_queue() -> Result<Vec<crate::agent::AgentQueueItem>, String> {
    let root = crate::engine_root();
    crate::agent::list_queue(&root)
}

#[tauri::command]
pub fn agent_health() -> Result<crate::agent::AgentHealth, String> {
    let root = crate::engine_root();
    crate::agent::health(&root)
}

/// Cancel one browser handoff outright: archive its `outbox/due/` card so the
/// agent can never post it (an archived job_id is also blocked by the agent's
/// idempotency rule), delete its calendar job, and drop the platform target so
/// the release card shows that platform unchecked/unpublished again.
#[tauri::command]
pub fn agent_handoff_delete(state: State<DbState>, job_id: String) -> Result<(), String> {
    let root = crate::engine_root();
    let conn = lock(&state)?;

    // Resolve the target before removing anything: the card is the source of
    // truth for what the agent sees; the DB job is the fallback.
    let base = crate::agent::outbox_dir(&root);
    let due_dir = base.join("due").join(&job_id);
    let card: Option<serde_json::Value> = std::fs::read_to_string(due_dir.join("card.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());
    let target_id = card
        .as_ref()
        .and_then(|c| c.get("target_id").and_then(|x| x.as_str()))
        .map(ToString::to_string)
        .or_else(|| {
            db::get_job(&conn, &job_id)
                .ok()
                .flatten()
                .map(|j| j.post_platform_target_id)
        });

    // 1. Archive the due card. The agent must never find this job in due/ again.
    if due_dir.exists() {
        let arch = base.join("archive").join(&job_id);
        std::fs::create_dir_all(&arch).map_err(|e| e.to_string())?;
        let stamp = db::now().replace([':', '/', '+'], "-");
        let dest = if arch.join("due").exists() {
            arch.join(format!("due-canceled-{stamp}"))
        } else {
            arch.join("due")
        };
        std::fs::rename(&due_dir, &dest)
            .map_err(|e| format!("archive handoff {job_id}: {e}"))?;
        let note = serde_json::json!({ "canceled_at": db::now(), "by": "user" });
        let _ = std::fs::write(
            arch.join("canceled.json"),
            serde_json::to_vec_pretty(&note).unwrap_or_default(),
        );
    }

    // 2. Clear the calendar entry.
    db::delete_job(&conn, &job_id).map_err(|e| e.to_string())?;

    // 3. Drop the platform target — the platform reads as unchecked on the
    //    release card and disappears from the calendar's grouped release bar.
    if let Some(tid) = target_id.as_deref() {
        if let Some(t) = db::get_target(&conn, tid).map_err(|e| e.to_string())? {
            conn.execute(
                "DELETE FROM post_platform_targets WHERE id=?1",
                rusqlite::params![tid],
            )
            .map_err(|e| e.to_string())?;
            let _ = db::recompute_post_status(&conn, &t.post_id);
        }
    }

    db::audit(
        &conn,
        "user",
        "agent.handoff_delete",
        Some("job"),
        Some(&job_id),
        serde_json::json!({ "target": target_id }),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/* ---------- activity / audit ---------- */

#[tauri::command]
pub fn attempts_list(
    state: State<DbState>,
    limit: Option<i64>,
) -> Result<Vec<PublishAttempt>, String> {
    let conn = lock(&state)?;
    db::list_attempts(&conn, limit.unwrap_or(50)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn audit_list(state: State<DbState>, limit: Option<i64>) -> Result<Vec<AuditLog>, String> {
    let conn = lock(&state)?;
    db::list_audit(&conn, limit.unwrap_or(100)).map_err(|e| e.to_string())
}

/* ---------- UI state persistence ---------- */

/// Read a persisted UI-state value (e.g. the active view) from SQLite.
#[tauri::command]
pub fn state_get(state: State<DbState>, key: String) -> Result<Option<String>, String> {
    let conn = lock(&state)?;
    db::get_state(&conn, &key).map_err(|e| e.to_string())
}

/// Persist a UI-state value. An empty value clears the key.
#[tauri::command]
pub fn state_set(state: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = lock(&state)?;
    if value.is_empty() {
        db::delete_state(&conn, &key).map_err(|e| e.to_string())
    } else {
        db::set_state(&conn, &key, &value).map_err(|e| e.to_string())
    }
}

/* ---------- cloud bridge (Phase 2) ---------- */

/// Open an external URL in the system browser (for the OAuth hand-off).
/// Refuses anything that isn't https (or a localhost callback).
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    let ok = url.starts_with("https://")
        || url.starts_with("http://localhost")
        || url.starts_with("http://127.0.0.1");
    if !ok {
        return Err("refused: only https or localhost URLs may be opened".into());
    }
    Command::new("open")
        .arg(&url)
        .status()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Open a publishing URL specifically in Google Chrome so handoffs reuse Jake's
/// active Chrome profile instead of the system default browser.
#[tauri::command]
pub fn open_chrome_url(url: String) -> Result<(), String> {
    let ok = url.starts_with("https://")
        || url.starts_with("http://localhost")
        || url.starts_with("http://127.0.0.1");
    if !ok {
        return Err("refused: only https or localhost URLs may be opened".into());
    }
    Command::new("open")
        .args(["-a", "Google Chrome"])
        .arg(&url)
        .status()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Call the oauth-start Edge Function natively and return the provider authorize
/// URL. Routed through Rust because the webview's fetch to Edge Functions is
/// rejected by a CORS preflight the function doesn't answer; native HTTP isn't
/// subject to CORS, so this works against the function exactly as deployed.
#[tauri::command]
pub fn oauth_start(
    functions_url: String,
    anon_key: String,
    access_token: String,
    platform: String,
    workspace_id: String,
) -> Result<String, String> {
    if !functions_url.starts_with("https://") {
        return Err("refused: functions_url must be https".into());
    }
    let url = format!("{}/oauth-start", functions_url.trim_end_matches('/'));
    let resp = ureq::post(&url)
        .set("apikey", &anon_key)
        .set("Authorization", &format!("Bearer {access_token}"))
        .send_json(serde_json::json!({
            "platform": platform,
            "workspace_id": workspace_id,
        }));
    match resp {
        Ok(r) => {
            let v: serde_json::Value = r.into_json().map_err(|e| e.to_string())?;
            v.get("authorize_url")
                .and_then(|u| u.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| format!("no authorize_url in response: {v}"))
        }
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            Err(format!("oauth-start returned {code}: {body}"))
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Upload a media file to Supabase Storage using the resumable (TUS) protocol,
/// streaming from disk in 6 MB chunks. This replaces the base64 path for large
/// videos — the webview never holds the whole file in memory, and TUS supports
/// files up to 5 GB. Returns the storage key + metadata for the media_assets row.
///
/// Async + spawn_blocking so the (minutes-long) upload runs OFF the main thread —
/// a synchronous command would block the UI thread and freeze the window.
#[tauri::command]
pub async fn media_upload_resumable(
    app: AppHandle,
    state: State<'_, DbState>,
    supabase_url: String,
    anon_key: String,
    access_token: String,
    workspace_id: String,
    media_id: String,
) -> Result<serde_json::Value, String> {
    if !supabase_url.starts_with("https://") {
        return Err("refused: supabase_url must be https".into());
    }
    // Resolve the file + metadata up front (DB lock is dropped before the upload).
    let (local_key, filename, mime_type, path) = {
        let conn = lock(&state)?;
        let m = db::get_media(&conn, &media_id)
            .map_err(|e| e.to_string())?
            .ok_or("media not found")?;
        let path = resolve_media_path(&app, &m)?;
        (m.storage_key, m.filename, m.mime_type, path)
    };
    let object_key = format!("{workspace_id}/{local_key}");
    eprintln!(
        "[upload] start media_id={media_id} key={local_key} path={} exists={} token_len={}",
        path.display(),
        path.exists(),
        access_token.len()
    );

    // Move the blocking chunked transfer to a worker thread so the UI stays live.
    let app_handle = app.clone();
    let mid = media_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        tus_upload(
            &app_handle,
            &mid,
            &supabase_url,
            &anon_key,
            &access_token,
            &object_key,
            &mime_type,
            &filename,
            &path,
        )
    })
    .await
    .map_err(|e| e.to_string())?;
    match &result {
        Ok(_) => eprintln!("[upload] OK"),
        Err(e) => eprintln!("[upload] FAILED: {e}"),
    }
    result
}

/// Blocking TUS resumable upload of `path` to the `media` bucket at `object_key`.
/// Emits an "upload-progress" event after each chunk so the UI can show a %.
fn tus_upload(
    app: &AppHandle,
    media_id: &str,
    supabase_url: &str,
    anon_key: &str,
    access_token: &str,
    object_key: &str,
    mime_type: &str,
    filename: &str,
    path: &Path,
) -> Result<serde_json::Value, String> {
    let total = std::fs::metadata(path)
        .map_err(|e| format!("stat failed: {e}"))?
        .len();
    let base = supabase_url.trim_end_matches('/');

    // 1. TUS create — declare the upload; server returns the per-upload URL.
    let upload_metadata = format!(
        "bucketName {},objectName {},contentType {},cacheControl {}",
        b64(b"media"),
        b64(object_key.as_bytes()),
        b64(mime_type.as_bytes()),
        b64(b"3600"),
    );
    let create = ureq::post(&format!("{base}/storage/v1/upload/resumable"))
        .set("apikey", anon_key)
        .set("Authorization", &format!("Bearer {access_token}"))
        .set("Tus-Resumable", "1.0.0")
        .set("Upload-Length", &total.to_string())
        .set("Upload-Metadata", &upload_metadata)
        .set("x-upsert", "true")
        .call();
    let location = match create {
        Ok(r) => r
            .header("Location")
            .map(|s| s.to_string())
            .ok_or("resumable create: missing Location header")?,
        Err(ureq::Error::Status(code, r)) => {
            return Err(format!(
                "resumable create {code}: {}",
                r.into_string().unwrap_or_default()
            ));
        }
        Err(e) => return Err(e.to_string()),
    };
    let upload_url = if location.starts_with("http") {
        location
    } else {
        format!("{base}{location}")
    };

    // 2. PATCH the bytes in 6 MB chunks (Supabase requires non-final chunks to be
    //    multiples of 6 MB). Stream from disk so memory stays flat.
    use std::io::{Read, Seek, SeekFrom};
    const CHUNK: usize = 6 * 1024 * 1024;
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; CHUNK];
    let mut offset: u64 = 0;
    while offset < total {
        file.seek(SeekFrom::Start(offset))
            .map_err(|e| e.to_string())?;
        let want = std::cmp::min(CHUNK as u64, total - offset) as usize;
        let mut filled = 0;
        while filled < want {
            let n = file
                .read(&mut buf[filled..want])
                .map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            filled += n;
        }
        let patch = ureq::request("PATCH", &upload_url)
            .set("apikey", anon_key)
            .set("Authorization", &format!("Bearer {access_token}"))
            .set("Tus-Resumable", "1.0.0")
            .set("Upload-Offset", &offset.to_string())
            // Must be on the data/finalize requests too, not just create — otherwise
            // Supabase rejects an already-existing object with 409 "resource already exists".
            .set("x-upsert", "true")
            .set("Content-Type", "application/offset+octet-stream")
            .send_bytes(&buf[..filled]);
        match patch {
            Ok(r) => {
                offset = r
                    .header("Upload-Offset")
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(offset + filled as u64);
                let pct = if total > 0 {
                    (offset.min(total) * 100 / total) as u32
                } else {
                    100
                };
                let _ = app.emit(
                    "upload-progress",
                    serde_json::json!({ "mediaId": media_id, "uploaded": offset, "total": total, "pct": pct }),
                );
            }
            Err(ureq::Error::Status(code, r)) => {
                return Err(format!(
                    "resumable PATCH {code} at offset {offset}: {}",
                    r.into_string().unwrap_or_default()
                ));
            }
            Err(e) => return Err(e.to_string()),
        }
    }

    Ok(serde_json::json!({
        "storageKey": object_key,
        "filename": filename,
        "mimeType": mime_type,
        "byteSize": total,
    }))
}

/// Read a media file as base64 so the frontend can upload it to cloud Storage.
/// Used for small files / thumbnails; large videos go through
/// `media_upload_resumable` instead.
#[tauri::command]
pub fn media_read_base64(
    app: AppHandle,
    state: State<DbState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let conn = lock(&state)?;
    let m = db::get_media(&conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or("media not found")?;
    drop(conn);
    let path = resolve_media_path(&app, &m)?;
    let bytes = std::fs::read(&path).map_err(|e| format!("read failed: {e}"))?;
    Ok(serde_json::json!({
        "filename": m.filename,
        "mimeType": m.mime_type,
        "storageKey": m.storage_key,
        "base64": b64(&bytes),
    }))
}
