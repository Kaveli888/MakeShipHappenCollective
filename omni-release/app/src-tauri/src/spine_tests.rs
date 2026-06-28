//! Integration tests for the publishing spine (DB + mock publisher + job
//! lifecycle) — no GUI/Tauri needed. Proves the Sprint 1 exit criteria:
//! schedule → claim → mock publish → confirmed URL + audit trail, while LIVE
//! never fakes success and failures drive retry/backoff honestly.

use crate::{db, publish};
use serde_json::json;

fn temp_conn() -> rusqlite::Connection {
    let dir = std::env::temp_dir().join(format!("omni-test-{}", uuid::Uuid::new_v4().simple()));
    std::fs::create_dir_all(&dir).unwrap();
    db::init(&dir.join("t.db")).unwrap()
}

#[test]
fn mock_publish_flows_end_to_end() {
    let conn = temp_conn();
    let post_id = db::insert_post(&conn, None).unwrap();
    let tid = db::upsert_target(
        &conn, &post_id, "youtube",
        Some("hello".into()), Some("My Title".into()),
        vec!["#ai".into()], None, Some("public".into()), json!({}),
    )
    .unwrap();

    // Scheduled one minute in the past so it is immediately due.
    let past = (chrono::Utc::now() - chrono::Duration::minutes(1)).to_rfc3339();
    let job_id = db::insert_job(&conn, &tid, &past, "UTC", 5).unwrap();

    // Scheduler step: claim, publish (mock), close out.
    let claimed = db::claim_due_jobs(&conn, &db::now(), "test-worker").unwrap();
    assert_eq!(claimed.len(), 1, "the due job should be claimed exactly once");
    let job = &claimed[0];
    assert_eq!(job.id, job_id);

    let target = db::get_target(&conn, &job.post_platform_target_id).unwrap().unwrap();
    let outcome = publish::publish_target(&conn, &target, Some(&job.id), "mock").unwrap();
    assert_eq!(outcome.outcome, "success");
    assert!(outcome.is_mock);
    assert!(outcome.external_url.as_deref().unwrap().starts_with("mock://"));
    db::mark_job_done(&conn, &job.id).unwrap();

    // Target is published with a stored URL.
    let t2 = db::get_target(&conn, &tid).unwrap().unwrap();
    assert_eq!(t2.status, "published");
    assert!(t2.external_url.is_some());
    assert!(t2.published_at.is_some());

    // Post rollup status reflects it.
    assert_eq!(db::get_post(&conn, &post_id).unwrap().unwrap().status, "published");

    // Exactly one successful attempt is recorded.
    let attempts = db::list_attempts(&conn, 10).unwrap();
    assert_eq!(attempts.len(), 1);
    assert_eq!(attempts[0].outcome.as_deref(), Some("success"));

    // Audit trail contains the publish event.
    let audit = db::list_audit(&conn, 50).unwrap();
    assert!(audit.iter().any(|a| a.action == "publish.success"));
}

#[test]
fn live_mode_never_fakes_success() {
    let conn = temp_conn();
    let post_id = db::insert_post(&conn, None).unwrap();
    let tid = db::upsert_target(&conn, &post_id, "x", None, None, vec![], None, None, json!({})).unwrap();
    let target = db::get_target(&conn, &tid).unwrap().unwrap();

    let outcome = publish::publish_target(&conn, &target, None, "live").unwrap();
    assert_eq!(outcome.outcome, "failure", "live must fail — no integration exists yet");
    assert_eq!(outcome.error_code.as_deref(), Some("no_integration"));
    assert!(!outcome.is_mock);

    let t2 = db::get_target(&conn, &tid).unwrap().unwrap();
    assert_eq!(t2.status, "failed");
    assert!(t2.external_url.is_none(), "no URL may be stored for a failed publish");
    assert!(t2.failure_reason.is_some());
}

#[test]
fn forced_failure_drives_retry_then_exhausts() {
    let conn = temp_conn();
    let post_id = db::insert_post(&conn, None).unwrap();
    // options.mock_outcome=fail forces the mock publisher to fail.
    let tid = db::upsert_target(
        &conn, &post_id, "tiktok", None, None, vec![], None, None,
        json!({ "mock_outcome": "fail" }),
    )
    .unwrap();
    let past = (chrono::Utc::now() - chrono::Duration::minutes(1)).to_rfc3339();
    let job_id = db::insert_job(&conn, &tid, &past, "UTC", 2).unwrap();

    // Attempt 1 fails → job goes back to pending (will retry).
    let target = db::get_target(&conn, &tid).unwrap().unwrap();
    let o1 = publish::publish_target(&conn, &target, Some(&job_id), "mock").unwrap();
    assert_eq!(o1.outcome, "failure");
    let will_retry = db::fail_job(&conn, &job_id, 0).unwrap();
    assert!(will_retry, "attempt 1 of 2 should schedule a retry");
    assert_eq!(db::get_job(&conn, &job_id).unwrap().unwrap().status, "pending");

    // Attempt 2 fails → exhausted → job failed.
    let o2 = publish::publish_target(&conn, &target, Some(&job_id), "mock").unwrap();
    assert_eq!(o2.outcome, "failure");
    let will_retry2 = db::fail_job(&conn, &job_id, 0).unwrap();
    assert!(!will_retry2, "attempt 2 of 2 should exhaust");
    assert_eq!(db::get_job(&conn, &job_id).unwrap().unwrap().status, "failed");

    // Two failed attempts recorded.
    let attempts = db::list_attempts(&conn, 10).unwrap();
    assert_eq!(attempts.len(), 2);
    assert!(attempts.iter().all(|a| a.outcome.as_deref() == Some("failure")));
}

#[test]
fn scheduling_is_idempotent_per_slot() {
    let conn = temp_conn();
    let post_id = db::insert_post(&conn, None).unwrap();
    let tid = db::upsert_target(&conn, &post_id, "facebook", None, None, vec![], None, None, json!({})).unwrap();
    let when = (chrono::Utc::now() + chrono::Duration::hours(1)).to_rfc3339();

    let j1 = db::insert_job(&conn, &tid, &when, "UTC", 5).unwrap();
    let j2 = db::insert_job(&conn, &tid, &when, "UTC", 5).unwrap();
    assert_eq!(j1, j2, "re-scheduling the same slot must not create a duplicate job");
}
