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

/// Which route the scheduler uses to publish a due job. Defaults to `agent` (hand
/// off to the Claude browser publisher via the outbox). Override with
/// `OMNI_PUBLISH_ROUTE=mock` (or `live`) to use the in-process publisher instead.
fn route() -> String {
    std::env::var("OMNI_PUBLISH_ROUTE").unwrap_or_else(|_| "agent".to_string())
}

fn tick(app: &tauri::AppHandle, worker: &str) {
    let state = app.state::<DbState>();
    let conn = match state.0.lock() {
        Ok(c) => c,
        Err(_) => return, // poisoned; skip this tick
    };

    let route = route();
    let engine_root = crate::engine_root();

    // In agent mode, first pull in any results the agent has written back.
    if route == "agent" {
        let _ = crate::agent::ingest_results(&conn, &engine_root);
        let _ = crate::agent::mark_stale_handoffs(&conn, &engine_root);
    }

    let now = db::now();
    let claimed = match db::claim_due_jobs(&conn, &now, worker) {
        Ok(c) => c,
        Err(_) => return,
    };

    // Media lives under the app-data dir; the agent reads copies the handoff
    // stages into the outbox.
    let media_root = app
        .path()
        .app_data_dir()
        .map(|d| d.join("media"))
        .unwrap_or_else(|_| engine_root.join("media"));

    for job in claimed {
        let target = match db::get_target(&conn, &job.post_platform_target_id) {
            Ok(Some(t)) => t,
            _ => {
                // Orphaned job (target deleted) — close it out, don't loop forever.
                let _ = db::mark_job_done(&conn, &job.id);
                continue;
            }
        };

        if route == "agent" {
            // Hand the due post to the Claude agent via the outbox, then close the
            // job so it never retries/double-fires. The target sits at
            // `awaiting_agent` until the agent's result is ingested (above).
            match crate::agent::handoff(&conn, &engine_root, &media_root, &target, &job) {
                Ok(()) => {
                    let _ = db::mark_job_done(&conn, &job.id);
                }
                Err(e) => {
                    eprintln!("[scheduler] agent handoff failed for {}: {e}", job.id);
                    let _ = db::fail_job(&conn, &job.id, RETRY_BACKOFF_SECS);
                }
            }
            continue;
        }

        // Legacy in-process route (mock/live) — kept for tests and local validation.
        let success = matches!(
            crate::publish::publish_target(&conn, &target, Some(&job.id), &route),
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
