use crate::{db, media_ops, models::MediaAsset};

fn temp_conn() -> rusqlite::Connection {
    let dir = std::env::temp_dir().join(format!("omni-test-{}", uuid::Uuid::new_v4().simple()));
    std::fs::create_dir_all(&dir).unwrap();
    db::init(&dir.join("t.db")).unwrap()
}

fn test_media_asset(
    id: &str,
    storage_key: &str,
    filename: &str,
    thumbnail_key: Option<&str>,
    byte_size: i64,
) -> MediaAsset {
    MediaAsset {
        id: id.into(),
        workspace_id: db::LOCAL_WS.into(),
        storage_key: storage_key.into(),
        filename: filename.into(),
        mime_type: "video/mp4".into(),
        byte_size,
        duration_sec: None,
        width: None,
        height: None,
        aspect_ratio: None,
        thumbnail_key: thumbnail_key.map(str::to_string),
        title: None,
        description: None,
        tags: vec![],
        campaign_id: None,
        notes: None,
        status: "ready".into(),
        checksum: None,
        source: None,
        created_at: db::now(),
    }
}

fn media_test_dirs(label: &str) -> (std::path::PathBuf, std::path::PathBuf) {
    let root = std::env::temp_dir().join(format!(
        "omni-media-{label}-{}",
        uuid::Uuid::new_v4().simple()
    ));
    let media = root.join("media");
    let attachments = root.join("attachments");
    std::fs::create_dir_all(media.join("thumbs")).unwrap();
    std::fs::create_dir_all(&attachments).unwrap();
    (media, attachments)
}

#[test]
fn media_usage_counts_distinct_release_cards() {
    let conn = temp_conn();
    let media_id = db::new_id("med");
    let asset = test_media_asset(&media_id, "clip.mp4", "clip.mp4", None, 4);
    db::insert_media(&conn, &asset).unwrap();
    let post_id = db::insert_post(&conn, Some(&media_id)).unwrap();
    db::set_post_media(&conn, &post_id, std::slice::from_ref(&media_id)).unwrap();

    assert_eq!(db::media_usage_count(&conn, &media_id).unwrap(), 1);
}

#[test]
fn migration_sha256_verifies_and_commits_with_audit() {
    let conn = temp_conn();
    let (media_dir, attachments_dir) = media_test_dirs("migrate");
    let bytes = b"verified migration bytes";
    std::fs::write(media_dir.join("stored.mp4"), bytes).unwrap();
    let media_id = db::new_id("med");
    db::insert_media(
        &conn,
        &test_media_asset(&media_id, "stored.mp4", "friendly.mp4", None, 1),
    )
    .unwrap();
    let conn = std::sync::Mutex::new(conn);

    let migrated =
        media_ops::migrate_media_to_shipmemory(&conn, &media_dir, &attachments_dir, &media_id)
            .unwrap();

    assert_eq!(migrated.source.as_deref(), Some("shipmemory"));
    assert_eq!(migrated.storage_key, "friendly.mp4");
    assert_eq!(migrated.byte_size, bytes.len() as i64);
    assert!(migrated.checksum.as_deref().unwrap().starts_with("sha256:"));
    assert!(!media_dir.join("stored.mp4").exists());
    assert_eq!(
        std::fs::read(attachments_dir.join("friendly.mp4")).unwrap(),
        bytes
    );
    let db = conn.lock().unwrap();
    assert!(db::list_audit(&db, 20)
        .unwrap()
        .iter()
        .any(|entry| entry.action == "media.migrate_shipmemory"));
}

#[test]
fn migration_reuses_an_identical_hub_file_without_duplication() {
    let conn = temp_conn();
    let (media_dir, attachments_dir) = media_test_dirs("dedupe");
    let bytes = b"same content";
    std::fs::write(media_dir.join("stored.mp4"), bytes).unwrap();
    std::fs::write(attachments_dir.join("friendly.mp4"), bytes).unwrap();
    let media_id = db::new_id("med");
    db::insert_media(
        &conn,
        &test_media_asset(
            &media_id,
            "stored.mp4",
            "friendly.mp4",
            None,
            bytes.len() as i64,
        ),
    )
    .unwrap();
    let conn = std::sync::Mutex::new(conn);

    let migrated =
        media_ops::migrate_media_to_shipmemory(&conn, &media_dir, &attachments_dir, &media_id)
            .unwrap();

    assert_eq!(migrated.storage_key, "friendly.mp4");
    assert!(!attachments_dir.join("friendly-2.mp4").exists());
}

#[test]
fn migration_restores_source_when_database_audit_fails() {
    let conn = temp_conn();
    let (media_dir, attachments_dir) = media_test_dirs("migrate-rollback");
    let bytes = b"rollback migration bytes";
    std::fs::write(media_dir.join("stored.mp4"), bytes).unwrap();
    let media_id = db::new_id("med");
    db::insert_media(
        &conn,
        &test_media_asset(
            &media_id,
            "stored.mp4",
            "friendly.mp4",
            None,
            bytes.len() as i64,
        ),
    )
    .unwrap();
    conn.execute_batch(
        "CREATE TRIGGER block_migration_audit
         BEFORE INSERT ON audit_logs
         WHEN NEW.action = 'media.migrate_shipmemory'
         BEGIN SELECT RAISE(ABORT, 'blocked by test'); END;",
    )
    .unwrap();
    let conn = std::sync::Mutex::new(conn);

    assert!(
        media_ops::migrate_media_to_shipmemory(&conn, &media_dir, &attachments_dir, &media_id,)
            .is_err()
    );

    assert_eq!(std::fs::read(media_dir.join("stored.mp4")).unwrap(), bytes);
    assert!(std::fs::read_dir(&attachments_dir)
        .unwrap()
        .next()
        .is_none());
    let db = conn.lock().unwrap();
    let unchanged = db::get_media(&db, &media_id).unwrap().unwrap();
    assert!(unchanged.source.is_none());
    assert_eq!(unchanged.storage_key, "stored.mp4");
}

#[test]
fn delete_is_transactional_and_refuses_used_media() {
    let conn = temp_conn();
    let (media_dir, _) = media_test_dirs("delete");
    std::fs::write(media_dir.join("stored.mp4"), b"media").unwrap();
    std::fs::write(media_dir.join("thumbs/thumb.jpg"), b"thumb").unwrap();
    let media_id = db::new_id("med");
    db::insert_media(
        &conn,
        &test_media_asset(
            &media_id,
            "stored.mp4",
            "friendly.mp4",
            Some("thumbs/thumb.jpg"),
            5,
        ),
    )
    .unwrap();
    let post_id = db::insert_post(&conn, Some(&media_id)).unwrap();
    db::set_post_media(&conn, &post_id, std::slice::from_ref(&media_id)).unwrap();
    let conn = std::sync::Mutex::new(conn);

    let error = media_ops::delete_media(&conn, &media_dir, &media_id).unwrap_err();
    assert!(error.contains("1 release card"));
    assert!(media_dir.join("stored.mp4").exists());
    assert!(media_dir.join("thumbs/thumb.jpg").exists());
    assert!(db::get_media(&conn.lock().unwrap(), &media_id)
        .unwrap()
        .is_some());
}

#[test]
fn delete_removes_files_row_and_audits_together() {
    let conn = temp_conn();
    let (media_dir, _) = media_test_dirs("delete-success");
    std::fs::write(media_dir.join("stored.mp4"), b"media").unwrap();
    std::fs::write(media_dir.join("thumbs/thumb.jpg"), b"thumb").unwrap();
    let media_id = db::new_id("med");
    db::insert_media(
        &conn,
        &test_media_asset(
            &media_id,
            "stored.mp4",
            "friendly.mp4",
            Some("thumbs/thumb.jpg"),
            5,
        ),
    )
    .unwrap();
    let conn = std::sync::Mutex::new(conn);

    media_ops::delete_media(&conn, &media_dir, &media_id).unwrap();

    assert!(!media_dir.join("stored.mp4").exists());
    assert!(!media_dir.join("thumbs/thumb.jpg").exists());
    let db = conn.lock().unwrap();
    assert!(db::get_media(&db, &media_id).unwrap().is_none());
    assert!(db::list_audit(&db, 20)
        .unwrap()
        .iter()
        .any(|entry| entry.action == "media.delete"));
}

#[test]
fn delete_restores_files_when_database_audit_fails() {
    let conn = temp_conn();
    let (media_dir, _) = media_test_dirs("delete-rollback");
    std::fs::write(media_dir.join("stored.mp4"), b"media").unwrap();
    std::fs::write(media_dir.join("thumbs/thumb.jpg"), b"thumb").unwrap();
    let media_id = db::new_id("med");
    db::insert_media(
        &conn,
        &test_media_asset(
            &media_id,
            "stored.mp4",
            "friendly.mp4",
            Some("thumbs/thumb.jpg"),
            5,
        ),
    )
    .unwrap();
    conn.execute_batch(
        "CREATE TRIGGER block_delete_audit
         BEFORE INSERT ON audit_logs
         WHEN NEW.action = 'media.delete'
         BEGIN SELECT RAISE(ABORT, 'blocked by test'); END;",
    )
    .unwrap();
    let conn = std::sync::Mutex::new(conn);

    assert!(media_ops::delete_media(&conn, &media_dir, &media_id).is_err());

    assert!(media_dir.join("stored.mp4").exists());
    assert!(media_dir.join("thumbs/thumb.jpg").exists());
    assert!(db::get_media(&conn.lock().unwrap(), &media_id)
        .unwrap()
        .is_some());
}

#[test]
fn delete_restores_staged_media_when_thumbnail_key_is_unsafe() {
    let conn = temp_conn();
    let (media_dir, _) = media_test_dirs("delete-unsafe-thumb");
    std::fs::write(media_dir.join("stored.mp4"), b"media").unwrap();
    let media_id = db::new_id("med");
    db::insert_media(
        &conn,
        &test_media_asset(
            &media_id,
            "stored.mp4",
            "friendly.mp4",
            Some("../outside.jpg"),
            5,
        ),
    )
    .unwrap();
    let conn = std::sync::Mutex::new(conn);

    let error = media_ops::delete_media(&conn, &media_dir, &media_id).unwrap_err();

    assert!(error.contains("invalid local media key"));
    assert!(media_dir.join("stored.mp4").exists());
    assert!(db::get_media(&conn.lock().unwrap(), &media_id)
        .unwrap()
        .is_some());
}
