//! Serde data models for the local-first foundation (Sprint 1).
//!
//! These mirror the Postgres schema in
//! `docs/audit-2026-06-26/02-ARCHITECTURE-AND-DATA-MODEL.md` so that moving to a
//! hosted backend later is additive: the same shapes flow over a REST API
//! instead of over Tauri commands. Single local user → no RLS / tenancy columns
//! beyond `workspace_id`.

use serde::{Deserialize, Serialize};

/// The target platforms. `Platform::all()` drives capability descriptors.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Youtube,
    Tiktok,
    Instagram,
    Facebook,
    X,
    Linkedin,
    Twitch,
    Rumble,
}

impl Platform {
    pub fn as_str(&self) -> &'static str {
        match self {
            Platform::Youtube => "youtube",
            Platform::Tiktok => "tiktok",
            Platform::Instagram => "instagram",
            Platform::Facebook => "facebook",
            Platform::X => "x",
            Platform::Linkedin => "linkedin",
            Platform::Twitch => "twitch",
            Platform::Rumble => "rumble",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAsset {
    pub id: String,
    pub workspace_id: String,
    pub storage_key: String,
    pub filename: String,
    pub mime_type: String,
    pub byte_size: i64,
    pub duration_sec: Option<f64>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub aspect_ratio: Option<String>,
    pub thumbnail_key: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub campaign_id: Option<String>,
    pub notes: Option<String>,
    pub status: String, // draft | ready | archived
    pub checksum: Option<String>,
    /// None = file copied into the app media dir (legacy default).
    /// Some("shipmemory") = storage_key names a file in the Ship Memory hub's
    /// attachments dir; the bytes are never duplicated into the app dir.
    pub source: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Post {
    pub id: String,
    pub workspace_id: String,
    pub media_asset_id: Option<String>,
    pub master_caption: Option<String>,
    pub link: Option<String>,
    pub cta: Option<String>,
    pub campaign_id: Option<String>,
    pub status: String, // draft|scheduled|publishing|published|partial|failed|archived
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostPlatformTarget {
    pub id: String,
    pub post_id: String,
    pub platform: String,
    pub caption_override: Option<String>,
    pub title_override: Option<String>,
    pub hashtags: Vec<String>,
    pub thumbnail_media_id: Option<String>,
    pub privacy: Option<String>,
    pub options: serde_json::Value,
    pub status: String, // draft|scheduled|queued|publishing|published|failed|skipped
    pub external_post_id: Option<String>,
    pub external_url: Option<String>,
    pub published_at: Option<String>,
    pub failure_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledJob {
    pub id: String,
    pub workspace_id: String,
    pub post_platform_target_id: String,
    pub scheduled_for: String, // UTC ISO-8601
    pub timezone: String,
    pub idempotency_key: String,
    pub status: String, // pending|claimed|running|done|failed|canceled
    pub run_after: String,
    pub attempts: i64,
    pub max_attempts: i64,
    pub locked_by: Option<String>,
    pub locked_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishAttempt {
    pub id: String,
    pub scheduled_job_id: Option<String>,
    pub post_platform_target_id: String,
    pub attempt_no: i64,
    pub mode: String, // live | dry_run | mock
    pub started_at: String,
    pub finished_at: Option<String>,
    pub outcome: Option<String>, // success|failure|rate_limited|skipped
    pub external_post_id: Option<String>,
    pub external_url: Option<String>,
    pub response_summary: serde_json::Value,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: String,
    pub workspace_id: String,
    pub actor: String,
    pub action: String,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Campaign {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub color: Option<String>,
    pub created_at: String,
}

/// A post joined with its media + targets, for the composer/calendar.
/// `media` is the primary/cover asset (first in the carousel) kept for legacy
/// single-media consumers; `media_items` is the full ordered set attached to the
/// post (carousel of images and/or video) the composer ships together.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostBundle {
    pub post: Post,
    pub media: Option<MediaAsset>,
    pub media_items: Vec<MediaAsset>,
    pub targets: Vec<PostPlatformTarget>,
}

/// One row of the calendar: a scheduled job joined with enough context to render.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEntry {
    pub job: ScheduledJob,
    pub target: PostPlatformTarget,
    pub post_id: String,
    pub media_title: Option<String>,
}
