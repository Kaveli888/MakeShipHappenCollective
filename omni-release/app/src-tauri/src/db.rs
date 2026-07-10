//! Local-first SQLite store. Schema mirrors the target Postgres model so the
//! later move to a hosted backend is additive. All access goes through typed
//! functions here — no raw SQL crosses into the frontend.

use crate::models::*;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde_json::Value;

/// The single local workspace id (multi-tenancy arrives with the server).
pub const LOCAL_WS: &str = "ws_local";

/// Tauri-managed handle to the database connection.
pub struct DbState(pub std::sync::Mutex<Connection>);

pub fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}
pub fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}", uuid::Uuid::new_v4().simple())
}
fn to_json_arr(v: &[String]) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "[]".into())
}
fn from_json_arr(s: Option<String>) -> Vec<String> {
    s.and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}
fn from_json_val(s: Option<String>) -> Value {
    s.and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Value::Null)
}

/// Open the DB at `path`, run migrations, and ensure the local workspace exists.
pub fn init(path: &std::path::Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT, created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS campaigns (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL,
            color TEXT, created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS media_assets (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
            storage_key TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL,
            byte_size INTEGER NOT NULL, duration_sec REAL, width INTEGER, height INTEGER,
            aspect_ratio TEXT, thumbnail_key TEXT, title TEXT, description TEXT,
            tags TEXT, campaign_id TEXT, notes TEXT,
            status TEXT NOT NULL DEFAULT 'ready', checksum TEXT, source TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, media_asset_id TEXT,
            master_caption TEXT, link TEXT, cta TEXT, campaign_id TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS post_media (
            post_id TEXT NOT NULL, media_asset_id TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (post_id, media_asset_id)
        );

        CREATE TABLE IF NOT EXISTS post_platform_targets (
            id TEXT PRIMARY KEY, post_id TEXT NOT NULL, platform TEXT NOT NULL,
            caption_override TEXT, title_override TEXT, hashtags TEXT,
            thumbnail_media_id TEXT, privacy TEXT, options TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            external_post_id TEXT, external_url TEXT, published_at TEXT, failure_reason TEXT,
            UNIQUE(post_id, platform)
        );

        CREATE TABLE IF NOT EXISTS scheduled_jobs (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
            post_platform_target_id TEXT NOT NULL,
            scheduled_for TEXT NOT NULL, timezone TEXT NOT NULL,
            idempotency_key TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'pending', run_after TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 5,
            locked_by TEXT, locked_at TEXT, created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS publish_attempts (
            id TEXT PRIMARY KEY, scheduled_job_id TEXT, post_platform_target_id TEXT NOT NULL,
            attempt_no INTEGER NOT NULL, mode TEXT NOT NULL,
            started_at TEXT NOT NULL, finished_at TEXT, outcome TEXT,
            external_post_id TEXT, external_url TEXT, response_summary TEXT,
            error_code TEXT, error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor TEXT NOT NULL,
            action TEXT NOT NULL, target_type TEXT, target_id TEXT,
            metadata TEXT, created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY, value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_jobs_due ON scheduled_jobs(status, run_after);
        CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media(post_id, position);
        CREATE INDEX IF NOT EXISTS idx_targets_post ON post_platform_targets(post_id);
        CREATE INDEX IF NOT EXISTS idx_attempts_target ON publish_attempts(post_platform_target_id);
        "#,
    )?;
    // Additive migration for DBs created before media source-referencing:
    // NULL = copied into the app media dir, 'shipmemory' = referenced from the
    // Ship Memory hub. Errors only when the column already exists — ignore.
    let _ = conn.execute("ALTER TABLE media_assets ADD COLUMN source TEXT", []);
    conn.execute(
        "INSERT OR IGNORE INTO workspaces (id, name, plan, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![LOCAL_WS, "My Workspace", "local", now()],
    )?;
    Ok(conn)
}

/* ------------------------- UI state (key-value) ------------------------- */
// Persists small UI state (active view, open composer) so the app reopens where
// the user left off. Lives in SQLite because the webview's localStorage does not
// reliably survive app restarts here.

pub fn get_state(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    let mut st = conn.prepare("SELECT value FROM app_state WHERE key = ?1")?;
    let mut rows = st.query_map(params![key], |r| r.get::<_, String>(0))?;
    rows.next().transpose()
}

pub fn set_state(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO app_state (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn delete_state(conn: &Connection, key: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM app_state WHERE key = ?1", params![key])?;
    Ok(())
}

/* ------------------------- row mappers ------------------------- */

fn map_media(r: &Row) -> rusqlite::Result<MediaAsset> {
    Ok(MediaAsset {
        id: r.get("id")?,
        workspace_id: r.get("workspace_id")?,
        storage_key: r.get("storage_key")?,
        filename: r.get("filename")?,
        mime_type: r.get("mime_type")?,
        byte_size: r.get("byte_size")?,
        duration_sec: r.get("duration_sec")?,
        width: r.get("width")?,
        height: r.get("height")?,
        aspect_ratio: r.get("aspect_ratio")?,
        thumbnail_key: r.get("thumbnail_key")?,
        title: r.get("title")?,
        description: r.get("description")?,
        tags: from_json_arr(r.get("tags")?),
        campaign_id: r.get("campaign_id")?,
        notes: r.get("notes")?,
        status: r.get("status")?,
        checksum: r.get("checksum")?,
        source: r.get("source")?,
        created_at: r.get("created_at")?,
    })
}

fn map_post(r: &Row) -> rusqlite::Result<Post> {
    Ok(Post {
        id: r.get("id")?,
        workspace_id: r.get("workspace_id")?,
        media_asset_id: r.get("media_asset_id")?,
        master_caption: r.get("master_caption")?,
        link: r.get("link")?,
        cta: r.get("cta")?,
        campaign_id: r.get("campaign_id")?,
        status: r.get("status")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
    })
}

fn map_target(r: &Row) -> rusqlite::Result<PostPlatformTarget> {
    Ok(PostPlatformTarget {
        id: r.get("id")?,
        post_id: r.get("post_id")?,
        platform: r.get("platform")?,
        caption_override: r.get("caption_override")?,
        title_override: r.get("title_override")?,
        hashtags: from_json_arr(r.get("hashtags")?),
        thumbnail_media_id: r.get("thumbnail_media_id")?,
        privacy: r.get("privacy")?,
        options: from_json_val(r.get("options")?),
        status: r.get("status")?,
        external_post_id: r.get("external_post_id")?,
        external_url: r.get("external_url")?,
        published_at: r.get("published_at")?,
        failure_reason: r.get("failure_reason")?,
    })
}

fn map_job(r: &Row) -> rusqlite::Result<ScheduledJob> {
    Ok(ScheduledJob {
        id: r.get("id")?,
        workspace_id: r.get("workspace_id")?,
        post_platform_target_id: r.get("post_platform_target_id")?,
        scheduled_for: r.get("scheduled_for")?,
        timezone: r.get("timezone")?,
        idempotency_key: r.get("idempotency_key")?,
        status: r.get("status")?,
        run_after: r.get("run_after")?,
        attempts: r.get("attempts")?,
        max_attempts: r.get("max_attempts")?,
        locked_by: r.get("locked_by")?,
        locked_at: r.get("locked_at")?,
        created_at: r.get("created_at")?,
    })
}

fn map_attempt(r: &Row) -> rusqlite::Result<PublishAttempt> {
    Ok(PublishAttempt {
        id: r.get("id")?,
        scheduled_job_id: r.get("scheduled_job_id")?,
        post_platform_target_id: r.get("post_platform_target_id")?,
        attempt_no: r.get("attempt_no")?,
        mode: r.get("mode")?,
        started_at: r.get("started_at")?,
        finished_at: r.get("finished_at")?,
        outcome: r.get("outcome")?,
        external_post_id: r.get("external_post_id")?,
        external_url: r.get("external_url")?,
        response_summary: from_json_val(r.get("response_summary")?),
        error_code: r.get("error_code")?,
        error_message: r.get("error_message")?,
    })
}

fn map_audit(r: &Row) -> rusqlite::Result<AuditLog> {
    Ok(AuditLog {
        id: r.get("id")?,
        workspace_id: r.get("workspace_id")?,
        actor: r.get("actor")?,
        action: r.get("action")?,
        target_type: r.get("target_type")?,
        target_id: r.get("target_id")?,
        metadata: from_json_val(r.get("metadata")?),
        created_at: r.get("created_at")?,
    })
}

/* ------------------------- audit ------------------------- */

pub fn audit(
    conn: &Connection,
    actor: &str,
    action: &str,
    target_type: Option<&str>,
    target_id: Option<&str>,
    metadata: Value,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO audit_logs (id, workspace_id, actor, action, target_type, target_id, metadata, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            new_id("aud"), LOCAL_WS, actor, action, target_type, target_id,
            metadata.to_string(), now()
        ],
    )?;
    Ok(())
}

pub fn list_audit(conn: &Connection, limit: i64) -> rusqlite::Result<Vec<AuditLog>> {
    let mut st = conn.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?1")?;
    let rows = st.query_map(params![limit], map_audit)?;
    rows.collect()
}

/* ------------------------- media ------------------------- */

#[allow(clippy::too_many_arguments)]
pub fn insert_media(conn: &Connection, m: &MediaAsset) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO media_assets
         (id, workspace_id, storage_key, filename, mime_type, byte_size, duration_sec,
          width, height, aspect_ratio, thumbnail_key, title, description, tags,
          campaign_id, notes, status, checksum, source, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)",
        params![
            m.id,
            m.workspace_id,
            m.storage_key,
            m.filename,
            m.mime_type,
            m.byte_size,
            m.duration_sec,
            m.width,
            m.height,
            m.aspect_ratio,
            m.thumbnail_key,
            m.title,
            m.description,
            to_json_arr(&m.tags),
            m.campaign_id,
            m.notes,
            m.status,
            m.checksum,
            m.source,
            m.created_at
        ],
    )?;
    Ok(())
}

/// Existing referenced asset for a given source + storage_key, if any —
/// lets re-importing the same Ship Memory file return the existing row
/// instead of creating a duplicate.
pub fn find_media_by_source_key(
    conn: &Connection,
    source: &str,
    storage_key: &str,
) -> rusqlite::Result<Option<MediaAsset>> {
    conn.query_row(
        "SELECT * FROM media_assets WHERE source = ?1 AND storage_key = ?2 AND status != 'archived' LIMIT 1",
        params![source, storage_key],
        map_media,
    )
    .optional()
}

pub fn list_media(conn: &Connection, include_archived: bool) -> rusqlite::Result<Vec<MediaAsset>> {
    let sql = if include_archived {
        "SELECT * FROM media_assets ORDER BY created_at DESC"
    } else {
        "SELECT * FROM media_assets WHERE status != 'archived' ORDER BY created_at DESC"
    };
    let mut st = conn.prepare(sql)?;
    let rows = st.query_map([], map_media)?;
    rows.collect()
}

pub fn get_media(conn: &Connection, id: &str) -> rusqlite::Result<Option<MediaAsset>> {
    let mut st = conn.prepare("SELECT * FROM media_assets WHERE id = ?1")?;
    let mut rows = st.query_map(params![id], map_media)?;
    rows.next().transpose()
}

pub fn update_media_meta(
    conn: &Connection,
    id: &str,
    title: Option<String>,
    description: Option<String>,
    tags: Vec<String>,
    notes: Option<String>,
    campaign_id: Option<String>,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE media_assets SET title=?2, description=?3, tags=?4, notes=?5, campaign_id=?6 WHERE id=?1",
        params![id, title, description, to_json_arr(&tags), notes, campaign_id],
    )?;
    Ok(())
}

pub fn set_media_status(conn: &Connection, id: &str, status: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE media_assets SET status=?2 WHERE id=?1",
        params![id, status],
    )?;
    Ok(())
}

/* ------------------------- campaigns ------------------------- */

pub fn list_campaigns(conn: &Connection) -> rusqlite::Result<Vec<Campaign>> {
    let mut st = conn.prepare("SELECT * FROM campaigns ORDER BY created_at DESC")?;
    let rows = st.query_map([], |r| {
        Ok(Campaign {
            id: r.get("id")?,
            workspace_id: r.get("workspace_id")?,
            name: r.get("name")?,
            color: r.get("color")?,
            created_at: r.get("created_at")?,
        })
    })?;
    rows.collect()
}

pub fn insert_campaign(
    conn: &Connection,
    name: &str,
    color: Option<&str>,
) -> rusqlite::Result<String> {
    let id = new_id("cmp");
    conn.execute(
        "INSERT INTO campaigns (id, workspace_id, name, color, created_at) VALUES (?1,?2,?3,?4,?5)",
        params![id, LOCAL_WS, name, color, now()],
    )?;
    Ok(id)
}

/* ------------------------- posts ------------------------- */

pub fn insert_post(conn: &Connection, media_asset_id: Option<&str>) -> rusqlite::Result<String> {
    let id = new_id("post");
    let t = now();
    conn.execute(
        "INSERT INTO posts (id, workspace_id, media_asset_id, status, created_at, updated_at)
         VALUES (?1,?2,?3,'draft',?4,?4)",
        params![id, LOCAL_WS, media_asset_id, t],
    )?;
    Ok(id)
}

pub fn update_post(
    conn: &Connection,
    id: &str,
    media_asset_id: Option<String>,
    master_caption: Option<String>,
    link: Option<String>,
    cta: Option<String>,
    campaign_id: Option<String>,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE posts SET media_asset_id=?2, master_caption=?3, link=?4, cta=?5, campaign_id=?6, updated_at=?7 WHERE id=?1",
        params![id, media_asset_id, master_caption, link, cta, campaign_id, now()],
    )?;
    Ok(())
}

pub fn set_post_status(conn: &Connection, id: &str, status: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE posts SET status=?2, updated_at=?3 WHERE id=?1",
        params![id, status, now()],
    )?;
    Ok(())
}

pub fn get_post(conn: &Connection, id: &str) -> rusqlite::Result<Option<Post>> {
    let mut st = conn.prepare("SELECT * FROM posts WHERE id=?1")?;
    let mut rows = st.query_map(params![id], map_post)?;
    rows.next().transpose()
}

pub fn list_posts(conn: &Connection) -> rusqlite::Result<Vec<Post>> {
    let mut st =
        conn.prepare("SELECT * FROM posts WHERE status != 'archived' ORDER BY updated_at DESC")?;
    let rows = st.query_map([], map_post)?;
    rows.collect()
}

/// Recompute a post's rollup status from its targets (partial/published/failed).
pub fn recompute_post_status(conn: &Connection, post_id: &str) -> rusqlite::Result<()> {
    let targets = list_targets(conn, post_id)?;
    if targets.is_empty() {
        return Ok(());
    }
    let all = |s: &str| targets.iter().all(|t| t.status == s);
    let any = |s: &str| targets.iter().any(|t| t.status == s);
    // Includes the agent-bridge statuses: `awaiting_agent` (handed to the Claude
    // agent, in flight) and `needs_attention` (agent paused — needs a human tap).
    let status = if all("published") {
        "published"
    } else if any("published") {
        "partial"
    } else if any("publishing") || any("awaiting_agent") {
        "publishing"
    } else if any("scheduled") || any("queued") {
        "scheduled"
    } else if any("needs_attention") {
        "needs_attention"
    } else if any("failed") {
        "failed"
    } else {
        "draft"
    };
    set_post_status(conn, post_id, status)
}

/* ------------------------- targets ------------------------- */

#[allow(clippy::too_many_arguments)]
pub fn upsert_target(
    conn: &Connection,
    post_id: &str,
    platform: &str,
    caption_override: Option<String>,
    title_override: Option<String>,
    hashtags: Vec<String>,
    thumbnail_media_id: Option<String>,
    privacy: Option<String>,
    options: Value,
) -> rusqlite::Result<String> {
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM post_platform_targets WHERE post_id=?1 AND platform=?2",
            params![post_id, platform],
            |r| r.get(0),
        )
        .ok();
    let id = existing.unwrap_or_else(|| new_id("tgt"));
    conn.execute(
        "INSERT INTO post_platform_targets
         (id, post_id, platform, caption_override, title_override, hashtags,
          thumbnail_media_id, privacy, options, status)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'draft')
         ON CONFLICT(post_id, platform) DO UPDATE SET
          caption_override=excluded.caption_override,
          title_override=excluded.title_override,
          hashtags=excluded.hashtags,
          thumbnail_media_id=excluded.thumbnail_media_id,
          privacy=excluded.privacy,
          options=excluded.options",
        params![
            id,
            post_id,
            platform,
            caption_override,
            title_override,
            to_json_arr(&hashtags),
            thumbnail_media_id,
            privacy,
            options.to_string()
        ],
    )?;
    Ok(id)
}

pub fn delete_target(conn: &Connection, post_id: &str, platform: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM post_platform_targets WHERE post_id=?1 AND platform=?2",
        params![post_id, platform],
    )?;
    Ok(())
}

/// Remove a scheduled job (calendar entry) outright. Leaves the post/target +
/// published history intact — this just clears it from the calendar.
pub fn delete_job(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM scheduled_jobs WHERE id=?1", params![id])?;
    Ok(())
}

pub fn list_targets(conn: &Connection, post_id: &str) -> rusqlite::Result<Vec<PostPlatformTarget>> {
    let mut st =
        conn.prepare("SELECT * FROM post_platform_targets WHERE post_id=?1 ORDER BY platform")?;
    let rows = st.query_map(params![post_id], map_target)?;
    rows.collect()
}

pub fn get_target(conn: &Connection, id: &str) -> rusqlite::Result<Option<PostPlatformTarget>> {
    let mut st = conn.prepare("SELECT * FROM post_platform_targets WHERE id=?1")?;
    let mut rows = st.query_map(params![id], map_target)?;
    rows.next().transpose()
}

pub fn set_target_status(conn: &Connection, id: &str, status: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE post_platform_targets SET status=?2 WHERE id=?1",
        params![id, status],
    )?;
    Ok(())
}

pub fn mark_target_published(
    conn: &Connection,
    id: &str,
    external_post_id: &str,
    external_url: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE post_platform_targets SET status='published', external_post_id=?2,
         external_url=?3, published_at=?4, failure_reason=NULL WHERE id=?1",
        params![id, external_post_id, external_url, now()],
    )?;
    Ok(())
}

pub fn mark_target_failed(conn: &Connection, id: &str, reason: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE post_platform_targets SET status='failed', failure_reason=?2 WHERE id=?1",
        params![id, reason],
    )?;
    Ok(())
}

/// Replace the ordered media set attached to a post (the carousel the composer
/// ships together). `position` preserves selection order. The first item is also
/// mirrored into `posts.media_asset_id` so legacy single-media consumers (calendar
/// title, cloud upload, back-compat) keep working unchanged.
pub fn set_post_media(
    conn: &Connection,
    post_id: &str,
    media_ids: &[String],
) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM post_media WHERE post_id=?1", params![post_id])?;
    for (i, mid) in media_ids.iter().enumerate() {
        conn.execute(
            "INSERT INTO post_media (post_id, media_asset_id, position) VALUES (?1,?2,?3)",
            params![post_id, mid, i as i64],
        )?;
    }
    let primary = media_ids.first().map(|s| s.as_str());
    conn.execute(
        "UPDATE posts SET media_asset_id=?2, updated_at=?3 WHERE id=?1",
        params![post_id, primary, now()],
    )?;
    Ok(())
}

/// The ordered media set attached to a post (carousel order).
pub fn list_post_media(conn: &Connection, post_id: &str) -> rusqlite::Result<Vec<MediaAsset>> {
    let mut st = conn.prepare(
        "SELECT m.* FROM post_media pm JOIN media_assets m ON m.id = pm.media_asset_id
         WHERE pm.post_id=?1 ORDER BY pm.position",
    )?;
    let rows = st.query_map(params![post_id], map_media)?;
    rows.collect()
}

pub fn bundle(conn: &Connection, post_id: &str) -> rusqlite::Result<Option<PostBundle>> {
    let Some(post) = get_post(conn, post_id)? else {
        return Ok(None);
    };
    let mut media_items = list_post_media(conn, post_id)?;
    // Back-compat: posts created before the post_media join table carry only a
    // single media_asset_id. Surface it as a one-item set so old drafts render.
    if media_items.is_empty() {
        if let Some(mid) = &post.media_asset_id {
            if let Some(m) = get_media(conn, mid)? {
                media_items.push(m);
            }
        }
    }
    let media = media_items.first().cloned();
    let targets = list_targets(conn, post_id)?;
    Ok(Some(PostBundle {
        post,
        media,
        media_items,
        targets,
    }))
}

/* ------------------------- scheduling ------------------------- */

#[allow(clippy::too_many_arguments)]
pub fn insert_job(
    conn: &Connection,
    target_id: &str,
    scheduled_for: &str,
    timezone: &str,
    max_attempts: i64,
) -> rusqlite::Result<String> {
    let id = new_id("job");
    // Idempotency: one active job per (target, scheduled time). A retry/reschedule
    // reuses the slot rather than creating a duplicate publish.
    let idem = format!("{target_id}:{scheduled_for}");
    conn.execute(
        "INSERT INTO scheduled_jobs
         (id, workspace_id, post_platform_target_id, scheduled_for, timezone,
          idempotency_key, status, run_after, attempts, max_attempts, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,'pending',?4,0,?7,?8)
         ON CONFLICT(idempotency_key) DO UPDATE SET
           scheduled_for=excluded.scheduled_for,
           run_after=excluded.run_after,
           timezone=excluded.timezone,
           status='pending', attempts=0, locked_by=NULL, locked_at=NULL",
        params![
            id,
            LOCAL_WS,
            target_id,
            scheduled_for,
            timezone,
            idem,
            max_attempts,
            now()
        ],
    )?;
    set_target_status(conn, target_id, "scheduled")?;
    // Return the id that actually owns this slot (may be a pre-existing row).
    let owner: String = conn.query_row(
        "SELECT id FROM scheduled_jobs WHERE idempotency_key=?1",
        params![idem],
        |r| r.get(0),
    )?;
    Ok(owner)
}

pub fn cancel_job(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE scheduled_jobs SET status='canceled' WHERE id=?1",
        params![id],
    )?;
    if let Some(tid) = job_target(conn, id)? {
        set_target_status(conn, &tid, "draft")?;
    }
    Ok(())
}

pub fn reschedule_job(
    conn: &Connection,
    id: &str,
    scheduled_for: &str,
    tz: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE scheduled_jobs SET scheduled_for=?2, run_after=?2, timezone=?3,
         status='pending', attempts=0, locked_by=NULL, locked_at=NULL WHERE id=?1",
        params![id, scheduled_for, tz],
    )?;
    if let Some(tid) = job_target(conn, id)? {
        set_target_status(conn, &tid, "scheduled")?;
    }
    Ok(())
}

fn job_target(conn: &Connection, id: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT post_platform_target_id FROM scheduled_jobs WHERE id=?1",
        params![id],
        |r| r.get(0),
    )
    .map(Some)
    .or(Ok(None))
}

pub fn get_job(conn: &Connection, id: &str) -> rusqlite::Result<Option<ScheduledJob>> {
    let mut st = conn.prepare("SELECT * FROM scheduled_jobs WHERE id=?1")?;
    let mut rows = st.query_map(params![id], map_job)?;
    rows.next().transpose()
}

/// Calendar entries in a UTC ISO range (inclusive start, exclusive end).
pub fn calendar_range(
    conn: &Connection,
    from: &str,
    to: &str,
) -> rusqlite::Result<Vec<CalendarEntry>> {
    let mut st = conn.prepare(
        "SELECT j.*, t.id as t_id FROM scheduled_jobs j
         JOIN post_platform_targets t ON t.id = j.post_platform_target_id
         WHERE j.status != 'canceled' AND j.scheduled_for >= ?1 AND j.scheduled_for < ?2
         ORDER BY j.scheduled_for",
    )?;
    let job_ids: Vec<String> = {
        let rows = st.query_map(params![from, to], |r| r.get::<_, String>("id"))?;
        rows.collect::<rusqlite::Result<_>>()?
    };
    let mut out = Vec::new();
    for jid in job_ids {
        if let Some(job) = get_job(conn, &jid)? {
            if let Some(target) = get_target(conn, &job.post_platform_target_id)? {
                let post_id = target.post_id.clone();
                let media_title = get_post(conn, &post_id)?
                    .and_then(|p| p.media_asset_id)
                    .and_then(|mid| get_media(conn, &mid).ok().flatten())
                    .and_then(|m| m.title.or(Some(m.filename)));
                out.push(CalendarEntry {
                    job,
                    target,
                    post_id,
                    media_title,
                });
            }
        }
    }
    Ok(out)
}

/// Atomically claim due pending jobs (status->claimed) and return them.
/// `now_iso` is the cutoff; `worker` records the lease holder.
pub fn claim_due_jobs(
    conn: &Connection,
    now_iso: &str,
    worker: &str,
) -> rusqlite::Result<Vec<ScheduledJob>> {
    let ids: Vec<String> = {
        let mut st = conn.prepare(
            "SELECT id FROM scheduled_jobs
             WHERE status='pending' AND run_after <= ?1 AND attempts < max_attempts
             ORDER BY run_after LIMIT 25",
        )?;
        let rows = st.query_map(params![now_iso], |r| r.get(0))?;
        rows.collect::<rusqlite::Result<_>>()?
    };
    let mut claimed = Vec::new();
    for id in ids {
        let updated = conn.execute(
            "UPDATE scheduled_jobs SET status='claimed', locked_by=?2, locked_at=?3
             WHERE id=?1 AND status='pending'",
            params![id, worker, now()],
        )?;
        if updated == 1 {
            if let Some(j) = get_job(conn, &id)? {
                claimed.push(j);
            }
        }
    }
    Ok(claimed)
}

pub fn mark_job_done(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE scheduled_jobs SET status='done' WHERE id=?1",
        params![id],
    )?;
    Ok(())
}

/// Record a failed attempt: bump count; back to pending (for retry) or failed if exhausted.
pub fn fail_job(conn: &Connection, id: &str, retry_delay_secs: i64) -> rusqlite::Result<bool> {
    let job = match get_job(conn, id)? {
        Some(j) => j,
        None => return Ok(false),
    };
    let attempts = job.attempts + 1;
    if attempts >= job.max_attempts {
        conn.execute(
            "UPDATE scheduled_jobs SET status='failed', attempts=?2, locked_by=NULL, locked_at=NULL WHERE id=?1",
            params![id, attempts],
        )?;
        Ok(false) // exhausted
    } else {
        let run_after =
            (chrono::Utc::now() + chrono::Duration::seconds(retry_delay_secs)).to_rfc3339();
        conn.execute(
            "UPDATE scheduled_jobs SET status='pending', attempts=?2, run_after=?3, locked_by=NULL, locked_at=NULL WHERE id=?1",
            params![id, attempts, run_after],
        )?;
        Ok(true) // will retry
    }
}

pub fn next_attempt_no(conn: &Connection, target_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(attempt_no),0)+1 FROM publish_attempts WHERE post_platform_target_id=?1",
        params![target_id],
        |r| r.get(0),
    )
}

/* ------------------------- attempts ------------------------- */

pub fn start_attempt(
    conn: &Connection,
    job_id: Option<&str>,
    target_id: &str,
    attempt_no: i64,
    mode: &str,
) -> rusqlite::Result<String> {
    let id = new_id("att");
    conn.execute(
        "INSERT INTO publish_attempts (id, scheduled_job_id, post_platform_target_id, attempt_no, mode, started_at)
         VALUES (?1,?2,?3,?4,?5,?6)",
        params![id, job_id, target_id, attempt_no, mode, now()],
    )?;
    Ok(id)
}

#[allow(clippy::too_many_arguments)]
pub fn finish_attempt(
    conn: &Connection,
    id: &str,
    outcome: &str,
    external_post_id: Option<&str>,
    external_url: Option<&str>,
    response_summary: Value,
    error_code: Option<&str>,
    error_message: Option<&str>,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE publish_attempts SET finished_at=?2, outcome=?3, external_post_id=?4,
         external_url=?5, response_summary=?6, error_code=?7, error_message=?8 WHERE id=?1",
        params![
            id,
            now(),
            outcome,
            external_post_id,
            external_url,
            response_summary.to_string(),
            error_code,
            error_message
        ],
    )?;
    Ok(())
}

pub fn list_attempts(conn: &Connection, limit: i64) -> rusqlite::Result<Vec<PublishAttempt>> {
    let mut st =
        conn.prepare("SELECT * FROM publish_attempts ORDER BY started_at DESC LIMIT ?1")?;
    let rows = st.query_map(params![limit], map_attempt)?;
    rows.collect()
}
