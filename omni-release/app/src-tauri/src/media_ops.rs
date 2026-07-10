//! Failure-aware filesystem operations for Library media.
//!
//! File bytes are staged and verified without holding SQLite's mutex. Database
//! changes and their audit rows commit together. If a database step fails, the
//! staged files are restored before the operation returns.

use crate::{db, models::MediaAsset};
use rusqlite::{params, Connection};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

static MEDIA_FILE_OP_LOCK: Mutex<()> = Mutex::new(());

struct HubCopy {
    name: String,
    path: PathBuf,
    checksum: String,
    byte_size: u64,
    created: bool,
}

struct StagedFile {
    original: PathBuf,
    staged: PathBuf,
}

fn lock_db(conn: &Mutex<Connection>) -> Result<MutexGuard<'_, Connection>, String> {
    conn.lock().map_err(|_| "db lock poisoned".to_string())
}

fn lock_media_files() -> Result<MutexGuard<'static, ()>, String> {
    MEDIA_FILE_OP_LOCK
        .lock()
        .map_err(|_| "media file-operation lock poisoned".to_string())
}

fn valid_attachment_name(name: &str) -> bool {
    !name.is_empty() && !name.contains('/') && !name.contains('\\') && name != "." && name != ".."
}

fn local_media_path(media_dir: &Path, key: &str) -> Result<PathBuf, String> {
    let relative = Path::new(key);
    if key.is_empty()
        || relative.is_absolute()
        || !relative
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
    {
        return Err(format!("invalid local media key: {key}"));
    }
    Ok(media_dir.join(relative))
}

fn sha256_file(path: &Path) -> Result<(u64, String), String> {
    let mut file = File::open(path).map_err(|e| format!("open {}: {e}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut total = 0u64;
    let mut buffer = vec![0u8; 1024 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|e| format!("read {}: {e}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        total += read as u64;
    }
    Ok((total, format!("sha256:{:x}", hasher.finalize())))
}

fn verified_temp_copy(
    src: &Path,
    attachments_dir: &Path,
) -> Result<(PathBuf, u64, String), String> {
    fs::create_dir_all(attachments_dir)
        .map_err(|e| format!("create Ship Memory attachments directory: {e}"))?;
    let temp = attachments_dir.join(format!(
        ".omni-migrate-{}.tmp",
        uuid::Uuid::new_v4().simple()
    ));

    let result = (|| -> Result<(u64, String), String> {
        let (before_len, before_hash) = sha256_file(src)?;
        let mut input = File::open(src).map_err(|e| format!("open {}: {e}", src.display()))?;
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)
            .map_err(|e| format!("create migration staging file: {e}"))?;
        let copied = io::copy(&mut input, &mut output)
            .map_err(|e| format!("copy to Ship Memory staging file: {e}"))?;
        output
            .flush()
            .and_then(|_| output.sync_all())
            .map_err(|e| format!("flush Ship Memory staging file: {e}"))?;
        drop(output);

        let (after_len, after_hash) = sha256_file(src)?;
        let (temp_len, temp_hash) = sha256_file(&temp)?;
        if before_len != copied
            || before_len != after_len
            || before_len != temp_len
            || before_hash != after_hash
            || before_hash != temp_hash
        {
            return Err(
                "copy verification failed (SHA-256 or size mismatch); nothing changed".into(),
            );
        }
        Ok((before_len, before_hash))
    })();

    match result {
        Ok((len, checksum)) => Ok((temp, len, checksum)),
        Err(error) => {
            let _ = fs::remove_file(&temp);
            Err(error)
        }
    }
}

fn candidate_name(preferred: &str, number: u32) -> String {
    if number == 1 {
        return preferred.to_string();
    }
    match preferred.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => format!("{stem}-{number}.{ext}"),
        _ => format!("{preferred}-{number}"),
    }
}

fn copy_to_hub(src: &Path, attachments_dir: &Path, preferred: &str) -> Result<HubCopy, String> {
    if !valid_attachment_name(preferred) {
        return Err(format!("invalid Ship Memory attachment name: {preferred}"));
    }
    let (temp, source_len, checksum) = verified_temp_copy(src, attachments_dir)?;

    for number in 1..=999 {
        let name = candidate_name(preferred, number);
        let dest = attachments_dir.join(&name);
        if dest.exists() {
            if dest.is_file() {
                let (existing_len, existing_hash) = match sha256_file(&dest) {
                    Ok(result) => result,
                    Err(error) => {
                        let _ = fs::remove_file(&temp);
                        return Err(error);
                    }
                };
                if existing_len == source_len && existing_hash == checksum {
                    fs::remove_file(&temp)
                        .map_err(|e| format!("remove migration staging file: {e}"))?;
                    return Ok(HubCopy {
                        name,
                        path: dest,
                        checksum,
                        byte_size: source_len,
                        created: false,
                    });
                }
            }
            continue;
        }

        match fs::hard_link(&temp, &dest) {
            Ok(()) => {
                if let Err(error) = fs::remove_file(&temp) {
                    let _ = fs::remove_file(&dest);
                    return Err(format!("finalize Ship Memory copy: {error}"));
                }
                return Ok(HubCopy {
                    name,
                    path: dest,
                    checksum,
                    byte_size: source_len,
                    created: true,
                });
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                let _ = fs::remove_file(&temp);
                return Err(format!(
                    "atomically finalize Ship Memory copy at {}: {error}",
                    dest.display()
                ));
            }
        }
    }

    let _ = fs::remove_file(&temp);
    Err("could not find a free Ship Memory attachment name".into())
}

fn stage_file(
    media_dir: &Path,
    original: PathBuf,
    label: &str,
) -> Result<Option<StagedFile>, String> {
    let metadata = match fs::symlink_metadata(&original) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("inspect {}: {error}", original.display())),
    };
    if metadata.is_dir() {
        return Err(format!(
            "refusing to delete directory: {}",
            original.display()
        ));
    }

    let trash = media_dir.join(".omni-trash");
    fs::create_dir_all(&trash).map_err(|e| format!("create media recovery directory: {e}"))?;
    let staged = trash.join(format!("{label}-{}", uuid::Uuid::new_v4().simple()));
    fs::rename(&original, &staged)
        .map_err(|e| format!("stage {} for deletion: {e}", original.display()))?;
    Ok(Some(StagedFile { original, staged }))
}

fn restore_staged_files(staged: &[StagedFile]) -> Result<(), String> {
    let mut errors = Vec::new();
    for file in staged.iter().rev() {
        if let Err(error) = fs::rename(&file.staged, &file.original) {
            errors.push(format!(
                "restore {} from {}: {error}",
                file.original.display(),
                file.staged.display()
            ));
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

fn delete_staged_files(staged: &[StagedFile]) -> Result<(), String> {
    let mut errors = Vec::new();
    for file in staged {
        if let Err(error) = fs::remove_file(&file.staged) {
            errors.push(format!("remove {}: {error}", file.staged.display()));
        }
    }
    if let Some(parent) = staged.first().and_then(|f| f.staged.parent()) {
        let _ = fs::remove_dir(parent);
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

fn cleanup_new_hub_copy(copy: &HubCopy) -> Result<(), String> {
    if !copy.created {
        return Ok(());
    }
    match fs::remove_file(&copy.path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "remove rollback copy {}: {error}",
            copy.path.display()
        )),
    }
}

fn verify_hub_copy(copy: &HubCopy) -> Result<(), String> {
    let (byte_size, checksum) = sha256_file(&copy.path)?;
    if byte_size != copy.byte_size || checksum != copy.checksum {
        return Err(format!(
            "Ship Memory copy changed before commit: {}",
            copy.path.display()
        ));
    }
    Ok(())
}

pub(crate) fn delete_media(
    conn: &Mutex<Connection>,
    media_dir: &Path,
    id: &str,
) -> Result<(), String> {
    let _file_guard = lock_media_files()?;
    let (media, initial_usage) = {
        let db = lock_db(conn)?;
        let media = db::get_media(&db, id)
            .map_err(|e| e.to_string())?
            .ok_or("media not found")?;
        let usage = db::media_usage_count(&db, id).map_err(|e| e.to_string())?;
        (media, usage)
    };
    if initial_usage > 0 {
        return Err(format!(
            "in use by {initial_usage} release card(s) — remove it from those cards first"
        ));
    }

    let mut staged = Vec::new();
    let mut local_file_missing = false;
    let stage_result = (|| -> Result<(), String> {
        if media.source.as_deref() != Some(crate::commands::MEDIA_SOURCE_SHIPMEMORY) {
            let path = local_media_path(media_dir, &media.storage_key)?;
            match stage_file(media_dir, path, "media")? {
                Some(file) => staged.push(file),
                None => local_file_missing = true,
            }
        }
        if let Some(thumbnail_key) = &media.thumbnail_key {
            let path = local_media_path(media_dir, thumbnail_key)?;
            if let Some(file) = stage_file(media_dir, path, "thumb")? {
                staged.push(file);
            }
        }
        Ok(())
    })();
    if let Err(error) = stage_result {
        return match restore_staged_files(&staged) {
            Ok(()) => Err(error),
            Err(restore_error) => Err(format!(
                "{error}; CRITICAL: staging rollback also failed: {restore_error}"
            )),
        };
    }

    let db_result = (|| -> Result<(), String> {
        let mut db = lock_db(conn)?;
        let tx = db.transaction().map_err(|e| e.to_string())?;
        let used = db::media_usage_count(&tx, id).map_err(|e| e.to_string())?;
        if used > 0 {
            return Err(format!(
                "in use by {used} release card(s) — remove it from those cards first"
            ));
        }
        let deleted = tx
            .execute("DELETE FROM media_assets WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        if deleted != 1 {
            return Err("media changed before deletion; nothing was deleted".into());
        }
        db::audit(
            &tx,
            "user",
            "media.delete",
            Some("media"),
            Some(id),
            json!({
                "filename": media.filename,
                "bytes": media.byte_size,
                "source": media.source,
                "localFileMissing": local_file_missing,
            }),
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())
    })();

    if let Err(error) = db_result {
        return match restore_staged_files(&staged) {
            Ok(()) => Err(error),
            Err(restore_error) => Err(format!(
                "{error}; CRITICAL: file rollback also failed: {restore_error}"
            )),
        };
    }

    delete_staged_files(&staged).map_err(|cleanup_error| {
        format!("Library deletion committed, but local cleanup is pending: {cleanup_error}")
    })
}

pub(crate) fn migrate_media_to_shipmemory(
    conn: &Mutex<Connection>,
    media_dir: &Path,
    attachments_dir: &Path,
    id: &str,
) -> Result<MediaAsset, String> {
    let _file_guard = lock_media_files()?;
    let media = {
        let db = lock_db(conn)?;
        db::get_media(&db, id)
            .map_err(|e| e.to_string())?
            .ok_or("media not found")?
    };
    if media.source.as_deref() == Some(crate::commands::MEDIA_SOURCE_SHIPMEMORY) {
        return Err("already referenced from Ship Memory".into());
    }

    let src = local_media_path(media_dir, &media.storage_key)?;
    if !src.is_file() {
        return Err(format!("local file missing: {}", src.display()));
    }
    let preferred = if valid_attachment_name(&media.filename) {
        media.filename.clone()
    } else if valid_attachment_name(&media.storage_key) {
        media.storage_key.clone()
    } else {
        return Err("media has no safe filename for Ship Memory".into());
    };

    let hub_copy = copy_to_hub(&src, attachments_dir, &preferred)?;
    let staged_source = match stage_file(media_dir, src, "migration-source") {
        Ok(Some(file)) => file,
        Ok(None) => {
            let _ = cleanup_new_hub_copy(&hub_copy);
            return Err("local source vanished during migration; database unchanged".into());
        }
        Err(error) => {
            let cleanup = cleanup_new_hub_copy(&hub_copy);
            return match cleanup {
                Ok(()) => Err(error),
                Err(cleanup_error) => Err(format!("{error}; copy cleanup failed: {cleanup_error}")),
            };
        }
    };
    let staged = vec![staged_source];

    if let Err(error) = verify_hub_copy(&hub_copy) {
        let restore = restore_staged_files(&staged);
        if let Err(restore_error) = restore {
            return Err(format!(
                "{error}; CRITICAL: source rollback failed: {restore_error}"
            ));
        }
        let cleanup = cleanup_new_hub_copy(&hub_copy);
        return match cleanup {
            Ok(()) => Err(error),
            Err(cleanup_error) => Err(format!("{error}; copy cleanup failed: {cleanup_error}")),
        };
    }

    let db_result = (|| -> Result<MediaAsset, String> {
        let mut db = lock_db(conn)?;
        let tx = db.transaction().map_err(|e| e.to_string())?;
        let updated = tx
            .execute(
                "UPDATE media_assets
                 SET source = ?3, storage_key = ?4, checksum = ?5, byte_size = ?6
                 WHERE id = ?1 AND storage_key = ?2 AND source IS NULL",
                params![
                    id,
                    media.storage_key,
                    crate::commands::MEDIA_SOURCE_SHIPMEMORY,
                    hub_copy.name,
                    hub_copy.checksum,
                    hub_copy.byte_size as i64,
                ],
            )
            .map_err(|e| e.to_string())?;
        if updated != 1 {
            return Err("media changed during migration; database unchanged".into());
        }
        db::audit(
            &tx,
            "user",
            "media.migrate_shipmemory",
            Some("media"),
            Some(id),
            json!({
                "from": media.storage_key,
                "to": hub_copy.name,
                "bytes": hub_copy.byte_size,
                "checksum": hub_copy.checksum,
                "destinationCreated": hub_copy.created,
            }),
        )
        .map_err(|e| e.to_string())?;
        let migrated = db::get_media(&tx, id)
            .map_err(|e| e.to_string())?
            .ok_or("media vanished during migration")?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(migrated)
    })();

    let migrated = match db_result {
        Ok(migrated) => migrated,
        Err(error) => {
            let restore = restore_staged_files(&staged);
            if let Err(restore_error) = restore {
                return Err(format!(
                    "{error}; CRITICAL: source rollback failed: {restore_error}. Verified hub copy retained at {}",
                    hub_copy.path.display()
                ));
            }
            return match cleanup_new_hub_copy(&hub_copy) {
                Ok(()) => Err(error),
                Err(cleanup_error) => Err(format!("{error}; copy cleanup failed: {cleanup_error}")),
            };
        }
    };

    delete_staged_files(&staged).map_err(|cleanup_error| {
        format!(
            "Migration committed and the SHA-256-verified hub copy is active, but local cleanup is pending: {cleanup_error}"
        )
    })?;
    Ok(migrated)
}
