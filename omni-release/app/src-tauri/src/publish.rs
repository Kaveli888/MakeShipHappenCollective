//! Publisher contract + capability matrix + the Sprint-1 MOCK publisher.
//!
//! HONESTY RULES (enforced here, not by convention):
//!   * `mode = "mock"`  → deterministic success with a CLEARLY-FAKE url
//!                        (`mock://…`). Proves the spine end-to-end.
//!   * `mode = "dry_run"` → no state change; returns a preview only.
//!   * `mode = "live"`  → ALWAYS fails in Sprint 1 with a human-readable
//!                        reason. There are no connected accounts and no real
//!                        platform integrations yet, so nothing may report a
//!                        real publish. This is deliberate.
//!
//! A target may set `options.mock_outcome = "fail"` to force a mock failure —
//! used to exercise the retry/backoff path.

use crate::db;
use crate::models::{Platform, PostPlatformTarget};
use rusqlite::Connection;
use serde::Serialize;
use serde_json::json;

#[derive(Debug, Clone, Serialize)]
pub struct PlatformCapability {
    pub platform: String,
    pub label: String,
    pub can_upload_video: bool,
    pub can_direct_publish: bool,
    pub can_schedule_native: bool,
    pub requires_business_account: bool,
    pub requires_app_review: bool,
    pub requires_paid_tier: bool,
    pub supports_link: bool,
    pub supports_hashtags: bool,
    pub supports_thumbnail: bool,
    pub supports_analytics: bool,
    pub oauth_scopes: Vec<&'static str>,
    /// "not_started" for Sprint 1 (nothing live yet).
    pub implementation_status: &'static str,
    pub notes: &'static str,
}

/// The living capability matrix (see docs/audit-2026-06-26/01-…). Verify against
/// official docs before each platform's sprint — confidence flags live in the doc.
pub fn capabilities() -> Vec<PlatformCapability> {
    use Platform::*;
    let row = |p: Platform,
               label: &str,
               caps: [bool; 10],
               scopes: Vec<&'static str>,
               notes: &'static str| PlatformCapability {
        platform: p.as_str().to_string(),
        label: label.to_string(),
        can_upload_video: caps[0],
        can_direct_publish: caps[1],
        can_schedule_native: caps[2],
        requires_business_account: caps[3],
        requires_app_review: caps[4],
        requires_paid_tier: caps[5],
        supports_link: caps[6],
        supports_hashtags: caps[7],
        supports_thumbnail: caps[8],
        supports_analytics: caps[9],
        oauth_scopes: scopes,
        implementation_status: "not_started",
        notes,
    };
    vec![
        row(Youtube, "YouTube",
            [true, true, true, false, false, false, true, true, true, true],
            vec!["youtube.upload", "youtube", "yt-analytics.readonly"],
            "Most mature. Quota-limited; schedule via publishAt+private. Build first."),
        row(Instagram, "Instagram",
            [true, true, false, true, true, false, false, true, true, true],
            vec!["instagram_basic", "instagram_content_publish", "pages_show_list", "business_management"],
            "Business/Creator + linked FB Page; Meta App Review for Advanced Access. No native schedule API."),
        row(Facebook, "Facebook",
            [true, true, true, true, true, false, true, true, false, true],
            vec!["pages_manage_posts", "pages_read_engagement", "pages_show_list", "business_management"],
            "Page + admin role + App Review. Native scheduled Page posts. Pairs with Instagram."),
        row(Tiktok, "TikTok",
            [true, true, false, true, true, false, false, true, false, true],
            vec!["user.info.basic", "video.upload", "video.publish"],
            "Posts as a draft to your TikTok inbox — open the app to finish. Direct Post unlocks after TikTok app audit."),
        row(X, "X / Twitter",
            [true, true, false, false, false, true, true, true, false, true],
            vec!["tweet.read", "tweet.write", "users.read", "offline.access"],
            "Most write access is on PAID tiers — verify pricing before building."),
        row(Linkedin, "LinkedIn",
            [true, true, false, false, false, false, true, true, false, true],
            vec!["openid", "profile", "email", "w_member_social"],
            "Posts text/images/video to a personal profile or org page via the Share/Posts API. No native schedule API. Org posting needs the Community Management API (review)."),
        row(Twitch, "Twitch",
            [false, false, false, false, false, false, true, true, true, true],
            vec!["clips:edit", "channel:read:stream_key", "analytics:read:games"],
            "No generic VOD upload API. Clips/VOD metadata/embed + stream announce only."),
        row(Rumble, "Rumble",
            [false, false, false, false, false, false, false, false, false, false],
            vec![],
            "No public API or OAuth — upload is partner/approval-gated. Display-only until Rumble grants API access."),
    ]
}

/// Outcome of attempting to publish a single target.
#[derive(Debug, Clone, Serialize)]
pub struct PublishOutcome {
    pub outcome: String, // success | failure | skipped
    pub external_post_id: Option<String>,
    pub external_url: Option<String>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub is_mock: bool,
}

/// Run a single target through the publisher in the given mode, recording a
/// `publish_attempts` row and updating target status + audit log. Never panics;
/// failures are returned as data with a human-readable reason.
pub fn publish_target(
    conn: &Connection,
    target: &PostPlatformTarget,
    job_id: Option<&str>,
    mode: &str,
) -> rusqlite::Result<PublishOutcome> {
    // dry-run: no state change, just a preview verdict.
    if mode == "dry_run" {
        return Ok(PublishOutcome {
            outcome: "skipped".into(),
            external_post_id: None,
            external_url: None,
            error_code: Some("dry_run".into()),
            error_message: Some(format!(
                "Dry run for {} — would publish, no changes made.",
                target.platform
            )),
            is_mock: false,
        });
    }

    let attempt_no = db::next_attempt_no(conn, &target.id)?;
    let attempt_id = db::start_attempt(conn, job_id, &target.id, attempt_no, mode)?;
    db::set_target_status(conn, &target.id, "publishing")?;

    let outcome = compute_outcome(target, mode);

    match outcome.outcome.as_str() {
        "success" => {
            let ext_id = outcome.external_post_id.clone().unwrap_or_default();
            let url = outcome.external_url.clone().unwrap_or_default();
            db::finish_attempt(
                conn, &attempt_id, "success",
                Some(&ext_id), Some(&url),
                json!({ "mock": outcome.is_mock, "platform": target.platform }),
                None, None,
            )?;
            db::mark_target_published(conn, &target.id, &ext_id, &url)?;
            db::audit(conn, "scheduler", "publish.success", Some("target"), Some(&target.id),
                json!({ "mode": mode, "url": url, "mock": outcome.is_mock }))?;
        }
        _ => {
            db::finish_attempt(
                conn, &attempt_id, "failure", None, None,
                json!({ "platform": target.platform }),
                outcome.error_code.as_deref(),
                outcome.error_message.as_deref(),
            )?;
            db::mark_target_failed(
                conn, &target.id,
                outcome.error_message.as_deref().unwrap_or("unknown error"),
            )?;
            db::audit(conn, "scheduler", "publish.failure", Some("target"), Some(&target.id),
                json!({ "mode": mode, "reason": outcome.error_message }))?;
        }
    }
    db::recompute_post_status(conn, &target.post_id)?;
    Ok(outcome)
}

fn compute_outcome(target: &PostPlatformTarget, mode: &str) -> PublishOutcome {
    // LIVE is never faked in Sprint 1.
    if mode == "live" {
        return PublishOutcome {
            outcome: "failure".into(),
            external_post_id: None,
            external_url: None,
            error_code: Some("no_integration".into()),
            error_message: Some(format!(
                "Live publishing to {} is not available yet: no account is connected and the platform integration is not built (Sprint 1 is local-first). Use mock mode to validate the workflow.",
                target.platform
            )),
            is_mock: false,
        };
    }

    // MOCK mode: deterministic, clearly fake. Honors a forced-failure option.
    let forced = target
        .options
        .get("mock_outcome")
        .and_then(|v| v.as_str())
        .unwrap_or("success");
    if forced == "fail" {
        return PublishOutcome {
            outcome: "failure".into(),
            external_post_id: None,
            external_url: None,
            error_code: Some("mock_forced_failure".into()),
            error_message: Some(format!(
                "Mock forced failure for {} (options.mock_outcome=fail) — exercises retry/backoff.",
                target.platform
            )),
            is_mock: true,
        };
    }

    let ext_id = format!("mock-{}", &db::new_id("p")[2..14]);
    let url = format!("mock://{}/posts/{}", target.platform, ext_id);
    PublishOutcome {
        outcome: "success".into(),
        external_post_id: Some(ext_id),
        external_url: Some(url),
        error_code: None,
        error_message: None,
        is_mock: true,
    }
}
