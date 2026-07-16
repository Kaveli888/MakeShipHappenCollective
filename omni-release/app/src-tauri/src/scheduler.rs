//! Background scheduled-job runner.
//!
//! Polls `scheduled_jobs` for due `pending` jobs, atomically claims each (lease),
//! runs it through the MOCK publisher, then marks it `done` or applies
//! retry/backoff via `db::fail_job`. This is the reliable-runner spine that a
//! real platform publisher later slots into (swap mode "mock" for a live route).

use crate::db::{self, DbState};
use std::time::Duration;
use tauri::Manager;

const TICK_SECS: u64 = 5;
const RETRY_BACKOFF_SECS: i64 = 30;

pub fn start(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let worker = format!("scheduler-{}", std::process::id());
        loop {
            tokio::time::sleep(Duration::from_secs(TICK_SECS)).await;
            tick(&app, &worker);
        }
    });
}

fn tick(app: &tauri::AppHandle, worker: &str) {
    let state = app.state::<DbState>();
    let conn = match state.0.lock() {
        Ok(c) => c,
        Err(_) => return, // poisoned; skip this tick
    };
    let now = db::now();
    let claimed = match db::claim_due_jobs(&conn, &now, worker) {
        Ok(c) => c,
        Err(_) => return,
    };
    for job in claimed {
        let target = match db::get_target(&conn, &job.post_platform_target_id) {
            Ok(Some(t)) => t,
            _ => {
                // Orphaned job (target deleted) — close it out, don't loop forever.
                let _ = db::mark_job_done(&conn, &job.id);
                continue;
            }
        };
        // Sprint 1: publish via the mock route so the spine runs end-to-end.
        let success = matches!(
            crate::publish::publish_target(&conn, &target, Some(&job.id), "mock"),
            Ok(o) if o.outcome == "success"
        );
        if success {
            let _ = db::mark_job_done(&conn, &job.id);
        } else {
            // fail_job bumps attempts; returns true if it will retry (back to pending).
            let _ = db::fail_job(&conn, &job.id, RETRY_BACKOFF_SECS);
        }
    }
}
