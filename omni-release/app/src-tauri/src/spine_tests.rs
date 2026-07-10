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
        &conn,
        &post_id,
        "youtube",
        Some("hello".into()),
        Some("My Title".into()),
        vec!["#ai".into()],
        None,
        Some("public".into()),
        json!({}),
    )
    .unwrap();

    // Scheduled one minute in the past so it is immediately due.
    let past = (chrono::Utc::now() - chrono::Duration::minutes(1)).to_rfc3339();
    let job_id = db::insert_job(&conn, &tid, &past, "UTC", 5).unwrap();

    // Scheduler step: claim, publish (mock), close out.
    let claimed = db::claim_due_jobs(&conn, &db::now(), "test-worker").unwrap();
    assert_eq!(
        claimed.len(),
        1,
        "the due job should be claimed exactly once"
    );
    let job = &claimed[0];
    assert_eq!(job.id, job_id);

    let target = db::get_target(&conn, &job.post_platform_target_id)
        .unwrap()
        .unwrap();
    let outcome = publish::publish_target(&conn, &target, Some(&job.id), "mock").unwrap();
    assert_eq!(outcome.outcome, "success");
    assert!(outcome.is_mock);
    assert!(outcome
        .external_url
        .as_deref()
        .unwrap()
        .starts_with("mock://"));
    db::mark_job_done(&conn, &job.id).unwrap();

    // Target is published with a stored URL.
    let t2 = db::get_target(&conn, &tid).unwrap().unwrap();
    assert_eq!(t2.status, "published");
    assert!(t2.external_url.is_some());
    assert!(t2.published_at.is_some());

    // Post rollup status reflects it.
    assert_eq!(
        db::get_post(&conn, &post_id).unwrap().unwrap().status,
        "published"
    );

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
    let tid = db::upsert_target(
        &conn,
        &post_id,
        "x",
        None,
        None,
        vec![],
        None,
        None,
        json!({}),
    )
    .unwrap();
    let target = db::get_target(&conn, &tid).unwrap().unwrap();

    let outcome = publish::publish_target(&conn, &target, None, "live").unwrap();
    assert_eq!(
        outcome.outcome, "failure",
        "live must fail — no integration exists yet"
    );
    assert_eq!(outcome.error_code.as_deref(), Some("no_integration"));
    assert!(!outcome.is_mock);

    let t2 = db::get_target(&conn, &tid).unwrap().unwrap();
    assert_eq!(t2.status, "failed");
    assert!(
        t2.external_url.is_none(),
        "no URL may be stored for a failed publish"
    );
    assert!(t2.failure_reason.is_some());
}

#[test]
fn forced_failure_drives_retry_then_exhausts() {
    let conn = temp_conn();
    let post_id = db::insert_post(&conn, None).unwrap();
    // options.mock_outcome=fail forces the mock publisher to fail.
    let tid = db::upsert_target(
        &conn,
        &post_id,
        "tiktok",
        None,
        None,
        vec![],
        None,
        None,
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
    assert_eq!(
        db::get_job(&conn, &job_id).unwrap().unwrap().status,
        "pending"
    );

    // Attempt 2 fails → exhausted → job failed.
    let o2 = publish::publish_target(&conn, &target, Some(&job_id), "mock").unwrap();
    assert_eq!(o2.outcome, "failure");
    let will_retry2 = db::fail_job(&conn, &job_id, 0).unwrap();
    assert!(!will_retry2, "attempt 2 of 2 should exhaust");
    assert_eq!(
        db::get_job(&conn, &job_id).unwrap().unwrap().status,
        "failed"
    );

    // Two failed attempts recorded.
    let attempts = db::list_attempts(&conn, 10).unwrap();
    assert_eq!(attempts.len(), 2);
    assert!(attempts
        .iter()
        .all(|a| a.outcome.as_deref() == Some("failure")));
}

#[test]
fn scheduling_is_idempotent_per_slot() {
    let conn = temp_conn();
    let post_id = db::insert_post(&conn, None).unwrap();
    let tid = db::upsert_target(
        &conn,
        &post_id,
        "facebook",
        None,
        None,
        vec![],
        None,
        None,
        json!({}),
    )
    .unwrap();
    let when = (chrono::Utc::now() + chrono::Duration::hours(1)).to_rfc3339();

    let j1 = db::insert_job(&conn, &tid, &when, "UTC", 5).unwrap();
    let j2 = db::insert_job(&conn, &tid, &when, "UTC", 5).unwrap();
    assert_eq!(
        j1, j2,
        "re-scheduling the same slot must not create a duplicate job"
    );
}

#[test]
fn agent_handoff_and_ingest_roundtrip() {
    use crate::agent;
    let conn = temp_conn();

    // Temp engine root (holds the outbox) + a media root with a real staged file.
    let base = std::env::temp_dir().join(format!("omni-agent-{}", uuid::Uuid::new_v4().simple()));
    let engine_root = base.join("repo");
    let media_root = base.join("media");
    std::fs::create_dir_all(&media_root).unwrap();

    let media_id = db::new_id("med");
    let storage_key = format!("{media_id}.mp4");
    std::fs::write(media_root.join(&storage_key), b"fake-bytes").unwrap();
    let asset = crate::models::MediaAsset {
        id: media_id.clone(),
        workspace_id: db::LOCAL_WS.to_string(),
        storage_key: storage_key.clone(),
        filename: "clip.mp4".into(),
        mime_type: "video/mp4".into(),
        byte_size: 10,
        duration_sec: Some(5.0),
        width: Some(1080),
        height: Some(1920),
        aspect_ratio: Some("9:16".into()),
        thumbnail_key: None,
        title: Some("Clip".into()),
        description: None,
        tags: vec![],
        campaign_id: None,
        notes: None,
        status: "ready".into(),
        checksum: None,
        source: None,
        created_at: db::now(),
    };
    db::insert_media(&conn, &asset).unwrap();

    let post_id = db::insert_post(&conn, Some(media_id.as_str())).unwrap();
    db::set_post_media(&conn, &post_id, &[media_id.clone()]).unwrap();
    db::update_post(
        &conn,
        &post_id,
        Some(media_id.clone()),
        Some("hello world".into()),
        None,
        Some("Try it".into()),
        None,
    )
    .unwrap();
    let tid = db::upsert_target(
        &conn,
        &post_id,
        "x",
        None,
        None,
        vec!["#ai".into()],
        None,
        Some("public".into()),
        json!({}),
    )
    .unwrap();
    let _facebook_tid = db::upsert_target(
        &conn,
        &post_id,
        "facebook",
        None,
        None,
        vec!["#ai".into()],
        None,
        Some("public".into()),
        json!({}),
    )
    .unwrap();

    let past = (chrono::Utc::now() - chrono::Duration::minutes(1)).to_rfc3339();
    let job_id = db::insert_job(&conn, &tid, &past, "UTC", 5).unwrap();
    let claimed = db::claim_due_jobs(&conn, &db::now(), "test").unwrap();
    let job = claimed.into_iter().find(|j| j.id == job_id).unwrap();
    let target = db::get_target(&conn, &tid).unwrap().unwrap();

    // Handoff writes a card + stages the media; target -> awaiting_agent.
    agent::handoff(&conn, &engine_root, &media_root, &target, &job).unwrap();
    db::mark_job_done(&conn, &job.id).unwrap();

    let due = engine_root.join("outbox").join("due").join(&job_id);
    assert!(
        due.join("card.json").exists(),
        "card.json should be written"
    );
    assert!(
        due.join("agent.json").exists(),
        "agent.json should be written for a simple browser-agent handoff"
    );
    assert!(
        due.join("media").join(&storage_key).exists(),
        "media should be staged"
    );
    let card: serde_json::Value =
        serde_json::from_slice(&std::fs::read(due.join("card.json")).unwrap()).unwrap();
    assert_eq!(card["platform"], "x");
    assert_eq!(card["caption"], "hello world");
    assert_eq!(card["release"]["target_count"], 2);
    assert_eq!(card["delivery"]["total"], 2);
    assert!(card["release"]["platforms"]
        .as_array()
        .unwrap()
        .iter()
        .any(|p| p.as_str() == Some("facebook")));
    assert_eq!(card["agent"]["post_type"], "short_video");
    assert_eq!(card["agent"]["publish_surface"], "x_post");
    assert_eq!(card["agent"]["media"]["kind"], "video");
    assert_eq!(card["agent"]["media"]["required"], "video");
    assert_eq!(card["agent"]["media"]["primary"]["role"], "primary_video");
    assert!(card["agent"]["media"]["primary"]["absolute_path"]
        .as_str()
        .unwrap()
        .ends_with(&format!("outbox/due/{job_id}/media/{storage_key}")));
    assert_eq!(card["agent"]["content"]["full_text"], "hello world\n\n#ai");
    let packet: serde_json::Value =
        serde_json::from_slice(&std::fs::read(due.join("agent.json")).unwrap()).unwrap();
    assert_eq!(packet["job_id"], job_id);
    assert_eq!(packet["post_type"], "short_video");
    assert_eq!(packet["publish_surface"], "x_post");
    assert_eq!(
        db::get_target(&conn, &tid).unwrap().unwrap().status,
        "awaiting_agent"
    );

    // The agent writes a result; ingest records it and marks the target published.
    let done = engine_root.join("outbox").join("done");
    std::fs::create_dir_all(&done).unwrap();
    let result = json!({
        "job_id": job_id,
        "target_id": tid,
        "platform": "x",
        "outcome": "posted",
        "external_url": "https://x.com/u/status/123",
        "external_post_id": "123",
        "posted_at": db::now(),
    });
    std::fs::write(
        done.join(format!("{job_id}.result.json")),
        serde_json::to_vec(&result).unwrap(),
    )
    .unwrap();

    assert_eq!(agent::ingest_results(&conn, &engine_root).unwrap(), 1);
    let t2 = db::get_target(&conn, &tid).unwrap().unwrap();
    assert_eq!(t2.status, "published");
    assert_eq!(
        t2.external_url.as_deref(),
        Some("https://x.com/u/status/123")
    );
    assert!(db::list_attempts(&conn, 10)
        .unwrap()
        .iter()
        .any(|a| a.mode == "agent" && a.outcome.as_deref() == Some("success")));

    // Result is archived, so a second ingest is a no-op.
    assert!(!done.join(format!("{job_id}.result.json")).exists());
    assert_eq!(agent::ingest_results(&conn, &engine_root).unwrap(), 0);
}

#[test]
fn agent_needs_attention_keeps_due_card_live_until_resume() {
    use crate::agent;
    let conn = temp_conn();

    let base = std::env::temp_dir().join(format!(
        "omni-agent-pause-{}",
        uuid::Uuid::new_v4().simple()
    ));
    let engine_root = base.join("repo");
    let media_root = base.join("media");
    std::fs::create_dir_all(&media_root).unwrap();

    let post_id = db::insert_post(&conn, None).unwrap();
    db::update_post(
        &conn,
        &post_id,
        None,
        Some("manual login gate test".into()),
        None,
        None,
        None,
    )
    .unwrap();
    let tid = db::upsert_target(
        &conn,
        &post_id,
        "x",
        None,
        None,
        vec!["#ai".into()],
        None,
        Some("public".into()),
        json!({}),
    )
    .unwrap();

    let past = (chrono::Utc::now() - chrono::Duration::minutes(1)).to_rfc3339();
    let job_id = db::insert_job(&conn, &tid, &past, "UTC", 5).unwrap();
    let claimed = db::claim_due_jobs(&conn, &db::now(), "test").unwrap();
    let job = claimed.into_iter().find(|j| j.id == job_id).unwrap();
    let target = db::get_target(&conn, &tid).unwrap().unwrap();

    agent::handoff(&conn, &engine_root, &media_root, &target, &job).unwrap();
    db::mark_job_done(&conn, &job.id).unwrap();

    let due = engine_root.join("outbox").join("due").join(&job_id);
    let done = engine_root.join("outbox").join("done");
    std::fs::create_dir_all(&done).unwrap();
    assert!(due.join("card.json").exists());

    let attention = json!({
        "job_id": job_id,
        "target_id": tid,
        "platform": "x",
        "outcome": "needs_attention",
        "error_code": "login_required",
        "error_message": "Jake needs to sign in, then the agent can resume.",
    });
    std::fs::write(
        done.join(format!("{job_id}.result.json")),
        serde_json::to_vec(&attention).unwrap(),
    )
    .unwrap();

    assert_eq!(agent::ingest_results(&conn, &engine_root).unwrap(), 1);
    assert_eq!(
        db::get_target(&conn, &tid).unwrap().unwrap().status,
        "needs_attention"
    );
    assert_eq!(
        db::get_post(&conn, &post_id).unwrap().unwrap().status,
        "needs_attention",
        "human gates are resumable, not terminal failures"
    );
    assert!(
        due.join("card.json").exists(),
        "needs_attention must keep the job card resumable"
    );
    assert!(
        due.join("attention.json").exists(),
        "latest blocker should be visible beside the card"
    );
    assert!(!done.join(format!("{job_id}.result.json")).exists());

    let posted = json!({
        "job_id": job_id,
        "target_id": tid,
        "platform": "x",
        "outcome": "posted",
        "external_url": "https://x.com/u/status/456",
        "external_post_id": "456",
        "posted_at": db::now(),
    });
    std::fs::write(
        done.join(format!("{job_id}.result.json")),
        serde_json::to_vec(&posted).unwrap(),
    )
    .unwrap();

    assert_eq!(agent::ingest_results(&conn, &engine_root).unwrap(), 1);
    let t2 = db::get_target(&conn, &tid).unwrap().unwrap();
    assert_eq!(t2.status, "published");
    assert_eq!(
        db::get_post(&conn, &post_id).unwrap().unwrap().status,
        "published"
    );
    assert_eq!(
        t2.external_url.as_deref(),
        Some("https://x.com/u/status/456")
    );
    assert!(
        !due.exists(),
        "successful resume should close and archive the due card"
    );
}
