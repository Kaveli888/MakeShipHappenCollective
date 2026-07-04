//! Agent bridge — hand due scheduled jobs to the Claude agent (a browser
//! publisher) and ingest its results, all through a file "outbox" inside the
//! engine repo. See `docs/AGENT-BRIDGE.md`.
//!
//!   * `handoff()`        — write `outbox/due/<job_id>/card.json` + staged media,
//!                          set the target to `awaiting_agent`. The scheduler
//!                          then marks the job `done` so it never double-fires.
//!   * `ingest_results()` — read `outbox/done/<job_id>.result.json`, record a
//!                          `publish_attempts` row, mark the target
//!                          published/failed/needs_attention, and archive finished
//!                          handoffs. `needs_attention` keeps the due card alive
//!                          so the agent can resume after a human clears the gate.
//!
//! The app stays the ONLY writer to `omni.db`; the agent only writes files under
//! `outbox/done/`. The `idempotency_key` in the card guards against double-posts.

use crate::db;
use crate::models::{PostPlatformTarget, ScheduledJob};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

/// Target status while a job is waiting for the agent to post it.
pub const AGENT_STATUS: &str = "awaiting_agent";
const HEARTBEAT_STALE_SECS: i64 = 90;
const HANDOFF_STALE_SECS: i64 = 10 * 60;

/// Root of the app↔agent file exchange (inside the repo so a mounted agent sees it).
pub fn outbox_dir(engine_root: &Path) -> PathBuf {
    engine_root.join("outbox")
}

/// Lightweight row for the desktop Agent Queue view. It is intentionally derived
/// from the file bridge, not `omni.db`, so it reflects exactly what a browser
/// agent can currently see and act on.
#[derive(Debug, Clone, Serialize)]
pub struct AgentQueueItem {
    pub job_id: String,
    pub target_id: Option<String>,
    pub post_id: Option<String>,
    pub platform: String,
    pub release_platforms: Vec<String>,
    pub release_target_count: usize,
    pub release_done_count: usize,
    pub release_attention_count: usize,
    pub release_pending_count: usize,
    pub delivery_index: Option<usize>,
    pub platform_url: Option<String>,
    pub scheduled_for: Option<String>,
    pub timezone: Option<String>,
    pub title: Option<String>,
    pub caption_preview: Option<String>,
    pub media_count: usize,
    pub media_files: Vec<String>,
    pub handed_off_at: Option<String>,
    pub needs_attention: bool,
    pub attention_code: Option<String>,
    pub attention_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentHealth {
    pub heartbeat_present: bool,
    pub runner_online: bool,
    pub last_seen_at: Option<String>,
    pub age_seconds: Option<i64>,
    pub status: Option<String>,
    pub mode: Option<String>,
    pub current_job_id: Option<String>,
    pub current_platform: Option<String>,
    pub message: Option<String>,
    pub due_count: usize,
    pub stale_count: usize,
    pub stale_job_ids: Vec<String>,
    pub heartbeat_stale_seconds: i64,
    pub handoff_stale_seconds: i64,
    pub warning: Option<String>,
}

fn str_field(v: &Value, key: &str) -> Option<String> {
    v.get(key)
        .and_then(|x| x.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
}

fn platform_url(card: &Value) -> Option<String> {
    let platform = str_field(card, "platform")?;
    let surface = card
        .get("options")
        .and_then(|o| o.get("publishSurface"))
        .and_then(|x| x.as_str())
        .unwrap_or("");
    let url = match (platform.as_str(), surface) {
        ("youtube", "youtube_video_upload") => "https://studio.youtube.com",
        ("youtube", _) => "https://www.youtube.com/@MakeShipHappenTech/posts",
        ("x", _) => "https://x.com/compose/post",
        ("linkedin", _) => "https://www.linkedin.com/feed/",
        ("facebook", _) => "https://www.facebook.com/",
        ("instagram", _) => "https://www.instagram.com/",
        ("tiktok", _) => "https://www.tiktok.com/upload",
        ("rumble", _) => "https://rumble.com/upload.php",
        _ => return None,
    };
    Some(url.to_string())
}

fn media_files(dir: &Path, card: &Value) -> Vec<String> {
    card.get("media")
        .and_then(|m| m.as_array())
        .into_iter()
        .flatten()
        .filter_map(|item| item.get("file").and_then(|f| f.as_str()))
        .map(|file| dir.join(file).to_string_lossy().to_string())
        .collect()
}

fn release_platforms(card: &Value, fallback_platform: &str) -> Vec<String> {
    let platforms: Vec<String> = card
        .get("release")
        .and_then(|r| r.get("platforms"))
        .and_then(|p| p.as_array())
        .into_iter()
        .flatten()
        .filter_map(|p| p.as_str())
        .map(ToString::to_string)
        .collect();
    if platforms.is_empty() {
        vec![fallback_platform.to_string()]
    } else {
        platforms
    }
}

fn usize_field(v: &Value, key: &str) -> Option<usize> {
    v.get(key).and_then(|x| x.as_u64()).map(|n| n as usize)
}

fn parse_time(raw: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(raw)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

fn heartbeat(engine_root: &Path) -> Option<Value> {
    std::fs::read_to_string(outbox_dir(engine_root).join("agent-heartbeat.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

fn heartbeat_age_seconds(hb: &Value) -> Option<i64> {
    hb.get("last_seen_at")
        .and_then(|v| v.as_str())
        .and_then(parse_time)
        .map(|dt| (Utc::now() - dt).num_seconds().max(0))
}

fn heartbeat_is_online(hb: &Value) -> bool {
    let status = hb.get("status").and_then(|v| v.as_str()).unwrap_or("");
    status != "stopped"
        && heartbeat_age_seconds(hb)
            .map(|age| age <= HEARTBEAT_STALE_SECS)
            .unwrap_or(false)
}

fn handoff_age_seconds(item: &AgentQueueItem) -> Option<i64> {
    item.handed_off_at
        .as_deref()
        .and_then(parse_time)
        .map(|dt| (Utc::now() - dt).num_seconds().max(0))
}

pub fn health(engine_root: &Path) -> Result<AgentHealth, String> {
    let queue = list_queue(engine_root)?;
    let hb = heartbeat(engine_root);
    let runner_online = hb.as_ref().map(heartbeat_is_online).unwrap_or(false);
    let stale_job_ids: Vec<String> = queue
        .iter()
        .filter(|item| {
            !item.needs_attention
                && !runner_online
                && handoff_age_seconds(item)
                    .map(|age| age >= HANDOFF_STALE_SECS)
                    .unwrap_or(false)
        })
        .map(|item| item.job_id.clone())
        .collect();
    let warning = if queue.is_empty() {
        None
    } else if runner_online {
        None
    } else if hb.is_some() {
        Some(format!(
            "Browser agent heartbeat is stale or stopped while {} handoff{} remain due.",
            queue.len(),
            if queue.len() == 1 { "" } else { "s" }
        ))
    } else {
        Some(format!(
            "No browser agent heartbeat found while {} handoff{} remain due.",
            queue.len(),
            if queue.len() == 1 { "" } else { "s" }
        ))
    };

    Ok(AgentHealth {
        heartbeat_present: hb.is_some(),
        runner_online,
        last_seen_at: hb
            .as_ref()
            .and_then(|v| v.get("last_seen_at"))
            .and_then(|v| v.as_str())
            .map(ToString::to_string),
        age_seconds: hb.as_ref().and_then(heartbeat_age_seconds),
        status: hb
            .as_ref()
            .and_then(|v| v.get("status"))
            .and_then(|v| v.as_str())
            .map(ToString::to_string),
        mode: hb
            .as_ref()
            .and_then(|v| v.get("mode"))
            .and_then(|v| v.as_str())
            .map(ToString::to_string),
        current_job_id: hb
            .as_ref()
            .and_then(|v| v.get("current_job_id"))
            .and_then(|v| v.as_str())
            .map(ToString::to_string),
        current_platform: hb
            .as_ref()
            .and_then(|v| v.get("current_platform"))
            .and_then(|v| v.as_str())
            .map(ToString::to_string),
        message: hb
            .as_ref()
            .and_then(|v| v.get("message"))
            .and_then(|v| v.as_str())
            .map(ToString::to_string),
        due_count: queue.len(),
        stale_count: stale_job_ids.len(),
        stale_job_ids,
        heartbeat_stale_seconds: HEARTBEAT_STALE_SECS,
        handoff_stale_seconds: HANDOFF_STALE_SECS,
        warning,
    })
}

/// List active cards under `outbox/due/` for the UI and agent operator.
pub fn list_queue(engine_root: &Path) -> Result<Vec<AgentQueueItem>, String> {
    let due = outbox_dir(engine_root).join("due");
    let entries = match std::fs::read_dir(&due) {
        Ok(e) => e,
        Err(_) => return Ok(Vec::new()),
    };

    let mut out = Vec::new();
    for entry in entries.flatten() {
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        let card_path = dir.join("card.json");
        let raw = match std::fs::read_to_string(&card_path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let card: Value = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let attention_path = dir.join("attention.json");
        let attention: Option<Value> = std::fs::read_to_string(&attention_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok());
        let caption_preview = str_field(&card, "caption").map(|s| {
            const MAX: usize = 160;
            if s.chars().count() > MAX {
                format!("{}…", s.chars().take(MAX).collect::<String>())
            } else {
                s
            }
        });
        let media_count = card
            .get("media")
            .and_then(|m| m.as_array())
            .map(|m| m.len())
            .unwrap_or(0);

        out.push(AgentQueueItem {
            job_id: str_field(&card, "job_id").unwrap_or_else(|| {
                dir.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string()
            }),
            target_id: str_field(&card, "target_id"),
            post_id: str_field(&card, "post_id"),
            platform: str_field(&card, "platform").unwrap_or_else(|| "unknown".to_string()),
            release_platforms: release_platforms(
                &card,
                str_field(&card, "platform")
                    .unwrap_or_else(|| "unknown".to_string())
                    .as_str(),
            ),
            release_target_count: card
                .get("release")
                .and_then(|r| usize_field(r, "target_count"))
                .unwrap_or(1),
            release_done_count: card
                .get("release")
                .and_then(|r| usize_field(r, "done_count"))
                .unwrap_or(0),
            release_attention_count: card
                .get("release")
                .and_then(|r| usize_field(r, "needs_attention_count"))
                .unwrap_or(0),
            release_pending_count: card
                .get("release")
                .and_then(|r| usize_field(r, "pending_count"))
                .unwrap_or(1),
            delivery_index: card.get("delivery").and_then(|d| usize_field(d, "index")),
            platform_url: platform_url(&card),
            scheduled_for: str_field(&card, "scheduled_for"),
            timezone: str_field(&card, "timezone"),
            title: str_field(&card, "title"),
            caption_preview,
            media_count,
            media_files: media_files(&dir, &card),
            handed_off_at: str_field(&card, "handed_off_at"),
            needs_attention: attention.is_some(),
            attention_code: attention.as_ref().and_then(|v| str_field(v, "error_code")),
            attention_message: attention
                .as_ref()
                .and_then(|v| str_field(v, "error_message")),
        });
    }

    out.sort_by(|a, b| {
        a.scheduled_for
            .as_deref()
            .unwrap_or("")
            .cmp(b.scheduled_for.as_deref().unwrap_or(""))
    });
    Ok(out)
}

pub fn mark_stale_handoffs(conn: &Connection, engine_root: &Path) -> Result<u32, String> {
    let h = health(engine_root)?;
    if h.runner_online || h.stale_job_ids.is_empty() {
        return Ok(0);
    }

    let base = outbox_dir(engine_root);
    let mut marked = 0u32;
    for job_id in h.stale_job_ids {
        let due_dir = base.join("due").join(&job_id);
        let card_path = due_dir.join("card.json");
        let card: Value = match std::fs::read_to_string(&card_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
        {
            Some(v) => v,
            None => continue,
        };
        let target_id = match card.get("target_id").and_then(|v| v.as_str()) {
            Some(id) => id.to_string(),
            None => continue,
        };
        let target = match db::get_target(conn, &target_id).map_err(|e| e.to_string())? {
            Some(t) if t.status == AGENT_STATUS => t,
            _ => continue,
        };
        let platform = target.platform.clone();

        let error_code = "agent_loop_not_running";
        let error_message = format!(
            "This handoff has been due for more than {} minutes, but no live browser agent heartbeat is active. Start npm run agent:loop:live or open the handoff manually.",
            HANDOFF_STALE_SECS / 60
        );
        let result = json!({
            "job_id": job_id.clone(),
            "idempotency_key": card.get("idempotency_key").cloned().unwrap_or(Value::Null),
            "target_id": target_id.clone(),
            "platform": platform.clone(),
            "outcome": "needs_attention",
            "external_url": null,
            "external_post_id": null,
            "posted_at": null,
            "error_code": error_code,
            "error_message": error_message,
            "detected_at": db::now(),
            "detected_by": "omni_release",
        });

        let attempt_no = db::next_attempt_no(conn, &target_id).map_err(|e| e.to_string())?;
        let att = db::start_attempt(conn, Some(&job_id), &target_id, attempt_no, "agent_watchdog")
            .map_err(|e| e.to_string())?;
        db::finish_attempt(
            conn,
            &att,
            "skipped",
            None,
            None,
            result.clone(),
            Some(error_code),
            Some(&error_message),
        )
        .map_err(|e| e.to_string())?;
        db::set_target_status(conn, &target_id, "needs_attention").map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE post_platform_targets SET failure_reason=?2 WHERE id=?1",
            params![&target_id, &error_message],
        )
        .map_err(|e| e.to_string())?;
        let _ = db::recompute_post_status(conn, &target.post_id);
        let _ = std::fs::write(
            due_dir.join("attention.json"),
            serde_json::to_vec_pretty(&result).unwrap_or_default(),
        );
        db::audit(
            conn,
            "scheduler",
            "agent.handoff_stale",
            Some("job"),
            Some(&job_id),
            json!({ "target": target_id, "platform": platform, "error_code": error_code }),
        )
        .map_err(|e| e.to_string())?;
        marked += 1;
    }

    Ok(marked)
}

/// Write a job-card + stage the media into `outbox/due/<job_id>/`, and set the
/// target to `awaiting_agent`. Returns Err if the card/media couldn't be written
/// (the caller then leaves the job for retry).
pub fn handoff(
    conn: &Connection,
    engine_root: &Path,
    media_root: &Path,
    target: &PostPlatformTarget,
    job: &ScheduledJob,
) -> Result<(), String> {
    let due = outbox_dir(engine_root).join("due").join(&job.id);
    let media_out = due.join("media");
    std::fs::create_dir_all(&media_out).map_err(|e| e.to_string())?;

    let post = db::get_post(conn, &target.post_id).map_err(|e| e.to_string())?;

    // Ordered media set; fall back to the post's single primary asset.
    let mut media_items = db::list_post_media(conn, &target.post_id).map_err(|e| e.to_string())?;
    if media_items.is_empty() {
        if let Some(mid) = post.as_ref().and_then(|p| p.media_asset_id.clone()) {
            if let Some(m) = db::get_media(conn, &mid).map_err(|e| e.to_string())? {
                media_items.push(m);
            }
        }
    }

    // Copy each media file (and any thumbnail) into the outbox, build the manifest.
    let mut media_json: Vec<Value> = Vec::new();
    for m in &media_items {
        let src = media_root.join(&m.storage_key);
        let dest = media_out.join(&m.storage_key);
        if src.exists() {
            std::fs::copy(&src, &dest).map_err(|e| format!("copy media {}: {e}", src.display()))?;
        }
        let thumb_rel = match &m.thumbnail_key {
            Some(tk) => {
                let tsrc = media_root.join(tk);
                if tsrc.exists() {
                    let tname = format!("thumb_{}.jpg", m.id);
                    let _ = std::fs::copy(&tsrc, media_out.join(&tname));
                    Some(format!("media/{tname}"))
                } else {
                    None
                }
            }
            None => None,
        };
        media_json.push(json!({
            "file": format!("media/{}", m.storage_key),
            "filename": m.filename,
            "mime": m.mime_type,
            "duration_sec": m.duration_sec,
            "aspect_ratio": m.aspect_ratio,
            "thumbnail": thumb_rel,
        }));
    }

    let caption = target
        .caption_override
        .clone()
        .or_else(|| post.as_ref().and_then(|p| p.master_caption.clone()));
    let link = post.as_ref().and_then(|p| p.link.clone());
    let cta = post.as_ref().and_then(|p| p.cta.clone());
    let release_targets = db::list_targets(conn, &target.post_id).map_err(|e| e.to_string())?;
    let release_total = release_targets.len().max(1);
    let delivery_index = release_targets
        .iter()
        .position(|t| t.id == target.id)
        .map(|i| i + 1)
        .unwrap_or(1);
    let release_statuses: Vec<Value> = release_targets
        .iter()
        .map(|t| {
            let status = if t.id == target.id {
                AGENT_STATUS
            } else {
                t.status.as_str()
            };
            json!({
                "target_id": t.id,
                "platform": t.platform,
                "status": status,
            })
        })
        .collect();
    let release_platforms: Vec<String> =
        release_targets.iter().map(|t| t.platform.clone()).collect();
    let release_done_count = release_statuses
        .iter()
        .filter(|t| t.get("status").and_then(|s| s.as_str()) == Some("published"))
        .count();
    let release_attention_count = release_statuses
        .iter()
        .filter(|t| t.get("status").and_then(|s| s.as_str()) == Some("needs_attention"))
        .count();
    let release_pending_count =
        release_total.saturating_sub(release_done_count + release_attention_count);

    let card = json!({
        "job_id": job.id,
        "idempotency_key": job.idempotency_key,
        "target_id": target.id,
        "post_id": target.post_id,
        "platform": target.platform,
        "scheduled_for": job.scheduled_for,
        "timezone": job.timezone,
        "caption": caption,
        "title": target.title_override,
        "hashtags": target.hashtags,
        "link": link,
        "cta": cta,
        "privacy": target.privacy,
        "options": target.options,
        "media": media_json,
        "release": {
            "post_id": target.post_id,
            "target_count": release_total,
            "platforms": release_platforms,
            "target_statuses": release_statuses,
            "done_count": release_done_count,
            "needs_attention_count": release_attention_count,
            "pending_count": release_pending_count,
        },
        "delivery": {
            "index": delivery_index,
            "total": release_total,
            "terminal_states": ["published", "needs_attention", "failed"],
            "clear_rule": "Clear this platform target only after proof; clear the parent release only after every selected platform target is terminal.",
        },
        "handed_off_at": db::now(),
    });

    let bytes = serde_json::to_vec_pretty(&card).map_err(|e| e.to_string())?;
    std::fs::write(due.join("card.json"), bytes).map_err(|e| e.to_string())?;

    db::set_target_status(conn, &target.id, AGENT_STATUS).map_err(|e| e.to_string())?;
    let _ = db::recompute_post_status(conn, &target.post_id);
    db::audit(
        conn,
        "scheduler",
        "agent.handoff",
        Some("target"),
        Some(&target.id),
        json!({ "job": job.id, "platform": target.platform }),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Ingest any `outbox/done/<job_id>.result.json` the agent has written: record an
/// attempt, update the target, and archive terminal cards. A `needs_attention`
/// result archives only that attempt result and leaves `outbox/due/<job_id>/`
/// intact, which lets the browser agent keep retrying after Jake clears login,
/// 2FA, CAPTCHA, or a similar human-only gate.
pub fn ingest_results(conn: &Connection, engine_root: &Path) -> Result<u32, String> {
    let base = outbox_dir(engine_root);
    let done = base.join("done");
    let archive = base.join("archive");
    let entries = match std::fs::read_dir(&done) {
        Ok(e) => e,
        Err(_) => return Ok(0), // no done/ dir yet
    };
    std::fs::create_dir_all(&archive).map_err(|e| e.to_string())?;

    let mut processed = 0u32;
    for entry in entries.flatten() {
        let path = entry.path();
        let fname = match path.file_name().and_then(|f| f.to_str()) {
            Some(f) if f.ends_with(".result.json") => f.to_string(),
            _ => continue,
        };
        let raw = match std::fs::read_to_string(&path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let v: Value = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => continue, // half-written; pick it up next tick
        };

        let job_id = v
            .get("job_id")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let target_id = v
            .get("target_id")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                db::get_job(conn, &job_id)
                    .ok()
                    .flatten()
                    .map(|j| j.post_platform_target_id)
            });
        let target_id = match target_id {
            Some(t) => t,
            None => continue,
        };

        let outcome = v
            .get("outcome")
            .and_then(|x| x.as_str())
            .unwrap_or("failed");
        let url = v.get("external_url").and_then(|x| x.as_str());
        let ext_id = v.get("external_post_id").and_then(|x| x.as_str());
        let err = v.get("error_message").and_then(|x| x.as_str());
        let err_code = v.get("error_code").and_then(|x| x.as_str());

        let attempt_no = db::next_attempt_no(conn, &target_id).map_err(|e| e.to_string())?;
        let att = db::start_attempt(conn, Some(&job_id), &target_id, attempt_no, "agent")
            .map_err(|e| e.to_string())?;
        match outcome {
            "posted" => {
                db::finish_attempt(conn, &att, "success", ext_id, url, v.clone(), None, None)
                    .map_err(|e| e.to_string())?;
                db::mark_target_published(
                    conn,
                    &target_id,
                    ext_id.unwrap_or(""),
                    url.unwrap_or(""),
                )
                .map_err(|e| e.to_string())?;
            }
            "needs_attention" => {
                db::finish_attempt(conn, &att, "skipped", None, None, v.clone(), err_code, err)
                    .map_err(|e| e.to_string())?;
                db::set_target_status(conn, &target_id, "needs_attention")
                    .map_err(|e| e.to_string())?;
            }
            _ => {
                db::finish_attempt(conn, &att, "failure", None, None, v.clone(), err_code, err)
                    .map_err(|e| e.to_string())?;
                db::mark_target_failed(conn, &target_id, err.unwrap_or("agent reported failure"))
                    .map_err(|e| e.to_string())?;
            }
        }
        if let Some(t) = db::get_target(conn, &target_id).map_err(|e| e.to_string())? {
            let _ = db::recompute_post_status(conn, &t.post_id);
        }

        // Archive the result so it isn't reprocessed. Terminal outcomes also
        // archive the due card; needs_attention keeps it live for resume.
        let keep_due_live = outcome == "needs_attention";
        let stamp = db::now()
            .replace(':', "-")
            .replace('/', "-")
            .replace('+', "-");
        let arch_job = archive.join(&job_id);
        let _ = std::fs::create_dir_all(&arch_job);
        let result_name = if keep_due_live {
            format!("attention-{stamp}-{fname}")
        } else {
            fname.clone()
        };
        let _ = std::fs::rename(&path, arch_job.join(result_name));
        let due_dir = base.join("due").join(&job_id);
        if keep_due_live {
            let _ = std::fs::write(
                due_dir.join("attention.json"),
                serde_json::to_vec_pretty(&v).unwrap_or_default(),
            );
        } else if due_dir.exists() {
            let _ = std::fs::rename(&due_dir, arch_job.join("due"));
        }
        let shot = done.join(format!("{job_id}.png"));
        if shot.exists() {
            let screenshot_name = if keep_due_live {
                format!("attention-{stamp}.png")
            } else {
                "screenshot.png".to_string()
            };
            let _ = std::fs::rename(&shot, arch_job.join(screenshot_name));
        }
        processed += 1;
    }
    Ok(processed)
}
