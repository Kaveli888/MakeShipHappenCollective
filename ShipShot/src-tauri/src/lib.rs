mod mouse_capture;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use std::thread;
use std::time::Duration;
use tauri::{
    menu::MenuBuilder, tray::TrayIconBuilder, AppHandle, Emitter, LogicalSize, Manager, Monitor,
    PhysicalPosition, PhysicalSize, Position, Size, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

#[cfg(not(target_os = "macos"))]
use tauri::LogicalPosition;

#[cfg(target_os = "macos")]
use objc2::MainThreadMarker;
#[cfg(target_os = "macos")]
use objc2_app_kit::{NSPopUpMenuWindowLevel, NSScreen, NSWindow, NSWindowCollectionBehavior};
#[cfg(target_os = "macos")]
use objc2_foundation::{NSPoint, NSRect, NSSize};

const TRAY_ICON: tauri::image::Image<'_> = tauri::include_image!("./icons/tray-icon.png");
const MAX_PENDING_CAPTURES: usize = 10;
/// Cursor-tracker samples (180ms apart) a new display must win before the stack follows.
const MONITOR_SETTLE_SAMPLES: u8 = 5;

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

#[cfg(target_os = "macos")]
fn configure_quick_access_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    window
        .set_always_on_top(true)
        .map_err(|error| error.to_string())?;
    window
        .set_visible_on_all_workspaces(true)
        .map_err(|error| error.to_string())?;

    let native_window = window.clone();
    window
        .run_on_main_thread(move || {
            let Ok(pointer) = native_window.ns_window() else {
                return;
            };
            let window = unsafe { &*(pointer as *const NSWindow) };
            let mut behavior = window.collectionBehavior();
            behavior.remove(
                NSWindowCollectionBehavior::MoveToActiveSpace
                    | NSWindowCollectionBehavior::FullScreenPrimary
                    | NSWindowCollectionBehavior::FullScreenNone,
            );
            behavior.insert(
                NSWindowCollectionBehavior::CanJoinAllSpaces
                    | NSWindowCollectionBehavior::CanJoinAllApplications
                    | NSWindowCollectionBehavior::FullScreenAuxiliary
                    | NSWindowCollectionBehavior::Stationary
                    | NSWindowCollectionBehavior::IgnoresCycle,
            );
            window.setCollectionBehavior(behavior);
            window.setLevel(NSPopUpMenuWindowLevel);
            window.setHidesOnDeactivate(false);
            window.setIgnoresMouseEvents(false);
        })
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
fn configure_quick_access_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    window
        .set_always_on_top(true)
        .map_err(|error| error.to_string())?;
    window
        .set_visible_on_all_workspaces(true)
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
fn raise_quick_access_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    let native_window = window.clone();
    window
        .run_on_main_thread(move || {
            let Ok(pointer) = native_window.ns_window() else {
                return;
            };
            let window = unsafe { &*(pointer as *const NSWindow) };
            window.setLevel(NSPopUpMenuWindowLevel);
            window.setHidesOnDeactivate(false);
            window.orderFrontRegardless();
        })
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
fn set_quick_access_frame(
    window: &tauri::WebviewWindow,
    left: f64,
    top: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let native_window = window.clone();
    window
        .run_on_main_thread(move || {
            let Some(main_thread) = MainThreadMarker::new() else {
                return;
            };
            let Some(main_screen) = NSScreen::mainScreen(main_thread) else {
                return;
            };
            let Ok(pointer) = native_window.ns_window() else {
                return;
            };
            let window = unsafe { &*(pointer as *const NSWindow) };
            let main_height = main_screen.frame().size.height;
            let frame = NSRect::new(
                NSPoint::new(left, main_height - top - height),
                NSSize::new(width, height),
            );
            window.setFrame_display(frame, true);
        })
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
fn raise_quick_access_window(_window: &tauri::WebviewWindow) -> Result<(), String> {
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Capture {
    id: String,
    filename: String,
    path: String,
    media_type: String,
    mode: String,
    created_at: String,
    width: u32,
    height: u32,
    file_size: u64,
    remembered: bool,
    memory_slug: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PendingCapture {
    id: String,
    filename: String,
    path: String,
    media_type: String,
    mode: String,
    created_at: String,
    width: u32,
    height: u32,
    file_size: u64,
}

struct CaptureState {
    captures: Mutex<Vec<Capture>>,
    pending: Mutex<Vec<PendingCapture>>,
    capture_in_progress: AtomicBool,
    quick_access_expanded: Mutex<bool>,
    quick_access_pinned: Mutex<bool>,
    quick_access_user_positioned: Mutex<bool>,
    /// Set while the webview is running a drag-out, so the cursor tracker can't
    /// move the stack out from under the pointer mid-gesture.
    quick_access_busy: AtomicBool,
    quick_access_monitor: Mutex<Option<MonitorBounds>>,
    quick_access_candidate: Mutex<Option<(MonitorBounds, u8)>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct MonitorBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

fn monitor_bounds(monitor: &Monitor) -> MonitorBounds {
    MonitorBounds {
        x: monitor.position().x,
        y: monitor.position().y,
        width: monitor.size().width,
        height: monitor.size().height,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoryAttachment {
    name: String,
    rel_path: String,
}

fn capture_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let pictures = app
        .path()
        .picture_dir()
        .map_err(|error| format!("Can't locate the Pictures folder: {error}"))?;
    Ok(pictures.join("ShipShot"))
}

fn pending_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("Can't locate the ShipShot cache: {error}"))?
        .join("pending");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Can't create the temporary capture folder: {error}"))?;
    Ok(directory)
}

fn history_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Can't locate ShipShot app data: {error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("Can't create ShipShot app data: {error}"))?;
    Ok(dir.join("captures.json"))
}

fn pending_history_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Can't locate ShipShot app data: {error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("Can't create ShipShot app data: {error}"))?;
    Ok(dir.join("pending-captures.json"))
}

fn write_capture_log(app: &AppHandle, event: &str, detail: &str) {
    let Ok(directory) = app.path().app_log_dir() else {
        return;
    };
    if fs::create_dir_all(&directory).is_err() {
        return;
    }
    let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(directory.join("capture.log"))
    else {
        return;
    };
    let sanitized = detail.replace(['\n', '\r'], " ");
    let _ = writeln!(
        file,
        "{} [{}] {}",
        Utc::now().to_rfc3339(),
        event,
        sanitized
    );
}

fn show_main_window(app: &AppHandle, view: Option<&str>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    if let Some(view) = view {
        let _ = app.emit_to("main", "tray-navigate", view);
    }
}

fn load_history(app: &AppHandle) -> Vec<Capture> {
    history_file(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

fn save_history(app: &AppHandle, captures: &[Capture]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(captures)
        .map_err(|error| format!("Can't encode capture history: {error}"))?;
    fs::write(history_file(app)?, json)
        .map_err(|error| format!("Can't save capture history: {error}"))
}

fn load_pending_history(app: &AppHandle) -> Vec<PendingCapture> {
    pending_history_file(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|json| serde_json::from_str::<Vec<PendingCapture>>(&json).ok())
        .unwrap_or_default()
        .into_iter()
        .filter(|capture| Path::new(&capture.path).is_file())
        .collect()
}

fn save_pending_history(app: &AppHandle, captures: &[PendingCapture]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(captures)
        .map_err(|error| format!("Can't encode temporary capture history: {error}"))?;
    fs::write(pending_history_file(app)?, json)
        .map_err(|error| format!("Can't save temporary capture history: {error}"))
}

fn capture_is_expired(created_at: &str) -> bool {
    DateTime::parse_from_rfc3339(created_at)
        .map(|created| created.with_timezone(&Utc) < Utc::now() - ChronoDuration::hours(24))
        .unwrap_or(false)
}

fn move_file_to_trash(app: &AppHandle, source: &Path, filename: &str) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }
    let trash = app
        .path()
        .home_dir()
        .map_err(|error| format!("Can't locate the Trash: {error}"))?
        .join(".Trash");
    fs::create_dir_all(&trash).map_err(|error| format!("Can't open the Trash: {error}"))?;
    let destination = unique_destination(&trash, filename);
    if fs::rename(source, &destination).is_err() {
        fs::copy(source, &destination)
            .map_err(|error| format!("Can't move capture to Trash: {error}"))?;
        fs::remove_file(source)
            .map_err(|error| format!("Can't remove expired capture: {error}"))?;
    }
    Ok(())
}

fn image_dimensions(path: &Path) -> (u32, u32) {
    let output = Command::new("/usr/bin/sips")
        .args(["-g", "pixelWidth", "-g", "pixelHeight"])
        .arg(path)
        .output();
    let Ok(output) = output else { return (0, 0) };
    let text = String::from_utf8_lossy(&output.stdout);
    let mut width = 0;
    let mut height = 0;
    for line in text.lines() {
        if let Some(value) = line.trim().strip_prefix("pixelWidth:") {
            width = value.trim().parse().unwrap_or(0);
        }
        if let Some(value) = line.trim().strip_prefix("pixelHeight:") {
            height = value.trim().parse().unwrap_or(0);
        }
    }
    (width, height)
}

fn safe_capture_path(app: &AppHandle, path: &Path) -> Result<bool, String> {
    Ok(path.starts_with(capture_dir(app)?))
}

fn safe_pending_path(app: &AppHandle, path: &Path) -> Result<bool, String> {
    Ok(path.starts_with(pending_dir(app)?))
}

fn unique_destination(directory: &Path, filename: &str) -> PathBuf {
    let original = Path::new(filename);
    let stem = original
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("ShipShot");
    let extension = original
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{value}"))
        .unwrap_or_default();
    let mut candidate = directory.join(filename);
    let mut suffix = 2;
    while candidate.exists() {
        candidate = directory.join(format!("{stem}-{suffix}{extension}"));
        suffix += 1;
    }
    candidate
}

fn copy_image_to_clipboard(path: &Path) -> Result<(), String> {
    let script = r#"on run argv
set the clipboard to (read (POSIX file (item 1 of argv)) as PNG picture)
end run"#;
    let status = Command::new("/usr/bin/osascript")
        .args(["-e", script])
        .arg(path)
        .status()
        .map_err(|error| format!("Can't copy the screenshot: {error}"))?;
    if !status.success() {
        return Err("macOS couldn't copy the screenshot".into());
    }
    Ok(())
}

fn cursor_monitor(app: &AppHandle) -> Result<Monitor, String> {
    let cursor = app
        .cursor_position()
        .map_err(|error| format!("Can't locate the cursor: {error}"))?;
    app.monitor_from_point(cursor.x, cursor.y)
        .map_err(|error| error.to_string())?
        .or_else(|| app.primary_monitor().ok().flatten())
        .ok_or_else(|| "No display is available".to_string())
}

fn quick_access_size(count: usize, scale: f64) -> PhysicalSize<u32> {
    let logical = quick_access_logical_size(count);
    PhysicalSize::new(
        (logical.width * scale).round() as u32,
        (logical.height * scale).round() as u32,
    )
}

fn quick_access_logical_size(count: usize) -> LogicalSize<f64> {
    let visible_cards = count.clamp(1, MAX_PENDING_CAPTURES) as f64;
    let width = 200.0;
    let height = visible_cards * 125.0 + (visible_cards - 1.0) * 8.0;
    LogicalSize::new(width, height)
}

fn repair_quick_access_route(app: &AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("quick-access")
        .ok_or_else(|| "Quick Access window is unavailable".to_string())?;
    let current = window.url().map_err(|error| error.to_string())?;
    let is_quick_access = current.scheme() != "file"
        && current
            .query_pairs()
            .any(|(key, value)| key == "window" && value == "quick-access");
    if is_quick_access {
        return Ok(false);
    }

    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "Main ShipShot window is unavailable".to_string())?;
    let mut target = main.url().map_err(|error| error.to_string())?;
    target.set_query(Some("window=quick-access"));
    target.set_fragment(None);
    window.navigate(target).map_err(|error| error.to_string())?;
    write_capture_log(app, "quick-access-repaired", current.as_str());
    Ok(true)
}

fn position_quick_access_on_monitor(
    app: &AppHandle,
    monitor: &Monitor,
    count: usize,
) -> Result<(), String> {
    let window = app
        .get_webview_window("quick-access")
        .ok_or_else(|| "Quick Access window is unavailable".to_string())?;
    let scale = monitor.scale_factor();
    let monitor_position = monitor.position().to_logical::<f64>(scale);
    let monitor_size = monitor.size().to_logical::<f64>(scale);
    let window_size = quick_access_logical_size(count);
    let left = monitor_position.x + 22.0;
    let top = monitor_position.y + monitor_size.height - window_size.height - 44.0;
    #[cfg(target_os = "macos")]
    set_quick_access_frame(&window, left, top, window_size.width, window_size.height)?;
    #[cfg(not(target_os = "macos"))]
    {
        window
            .set_size(Size::Logical(window_size))
            .map_err(|error| error.to_string())?;
        window
            .set_position(Position::Logical(LogicalPosition::new(left, top)))
            .map_err(|error| error.to_string())?;
    }
    if let Some(state) = app.try_state::<CaptureState>() {
        *state
            .quick_access_monitor
            .lock()
            .map_err(|error| error.to_string())? = Some(monitor_bounds(monitor));
        *state
            .quick_access_candidate
            .lock()
            .map_err(|error| error.to_string())? = None;
    }
    write_capture_log(
        app,
        "quick-access-position",
        &format!(
            "monitor_x={} monitor_y={} scale={} logical_x={} logical_y={} logical_width={} logical_height={}",
            monitor.position().x,
            monitor.position().y,
            scale,
            left,
            top,
            window_size.width,
            window_size.height
        ),
    );
    Ok(())
}

fn position_quick_access(app: &AppHandle, count: usize) -> Result<(), String> {
    let monitor = cursor_monitor(app)?;
    position_quick_access_on_monitor(app, &monitor, count)
}

fn sync_quick_access_to_cursor(app: &AppHandle, count: usize) -> Result<bool, String> {
    let window = app
        .get_webview_window("quick-access")
        .ok_or_else(|| "Quick Access window is unavailable".to_string())?;
    if !window.is_visible().map_err(|error| error.to_string())? {
        return Ok(false);
    }
    let state = app
        .try_state::<CaptureState>()
        .ok_or_else(|| "ShipShot is still starting".to_string())?;
    if *state
        .quick_access_user_positioned
        .lock()
        .map_err(|error| error.to_string())?
    {
        return Ok(false);
    }
    // A drag-out is in flight — moving the window would cancel the gesture.
    if state.quick_access_busy.load(Ordering::Acquire) {
        return Ok(false);
    }
    // Never relocate the stack while the pointer is on it. macOS hands the cursor to
    // whichever display owns the shared edge, so without this the window teleports to
    // the other screen exactly as the user reaches in to grab a capture.
    if cursor_is_inside_quick_access(app).unwrap_or(false) {
        *state
            .quick_access_candidate
            .lock()
            .map_err(|error| error.to_string())? = None;
        return Ok(false);
    }
    let target = cursor_monitor(app)?;
    let target_bounds = monitor_bounds(&target);
    if *state
        .quick_access_monitor
        .lock()
        .map_err(|error| error.to_string())?
        == Some(target_bounds)
    {
        *state
            .quick_access_candidate
            .lock()
            .map_err(|error| error.to_string())? = None;
        return Ok(false);
    }

    // macOS can alternate which display owns a cursor resting on the shared edge.
    // Require the new display to remain stable for several samples before moving.
    let should_move = {
        let mut candidate = state
            .quick_access_candidate
            .lock()
            .map_err(|error| error.to_string())?;
        let next_count = match *candidate {
            Some((bounds, samples)) if bounds == target_bounds => samples.saturating_add(1),
            _ => 1,
        };
        *candidate = Some((target_bounds, next_count));
        next_count >= MONITOR_SETTLE_SAMPLES
    };
    if !should_move {
        return Ok(false);
    }

    position_quick_access_on_monitor(app, &target, count)?;
    write_capture_log(
        app,
        "quick-access-monitor",
        &format!(
            "x={} y={} width={} height={}",
            target.position().x,
            target.position().y,
            target.size().width,
            target.size().height
        ),
    );
    Ok(true)
}

fn cursor_is_inside_quick_access(app: &AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("quick-access")
        .ok_or_else(|| "Quick Access window is unavailable".to_string())?;
    let cursor = app
        .cursor_position()
        .map_err(|error| format!("Can't locate the cursor: {error}"))?;
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let right = position.x as f64 + size.width as f64;
    let bottom = position.y as f64 + size.height as f64;
    Ok(cursor.x >= position.x as f64
        && cursor.x < right
        && cursor.y >= position.y as f64
        && cursor.y < bottom)
}

fn collapse_quick_access(app: &AppHandle, state: &CaptureState) -> Result<(), String> {
    *state
        .quick_access_expanded
        .lock()
        .map_err(|error| error.to_string())? = false;
    show_quick_access(app, false)?;
    app.emit_to("quick-access", "quick-access-collapsed", ())
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn show_quick_access(app: &AppHandle, expanded: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("quick-access")
        .ok_or_else(|| "Quick Access window is unavailable".to_string())?;
    configure_quick_access_window(&window)?;
    repair_quick_access_route(app)?;
    let (count, user_positioned) = app
        .try_state::<CaptureState>()
        .map(|state| {
            let count = state
                .pending
                .lock()
                .map(|pending| pending.len())
                .unwrap_or(0);
            let positioned = state
                .quick_access_user_positioned
                .lock()
                .map(|value| *value)
                .unwrap_or(false);
            (count, positioned)
        })
        .unwrap_or((0, false));
    if count == 0 {
        return window.hide().map_err(|error| error.to_string());
    }
    let _ = expanded;
    if user_positioned && window.is_visible().unwrap_or(false) {
        let monitor = window
            .current_monitor()
            .map_err(|error| error.to_string())?
            .unwrap_or(cursor_monitor(app)?);
        let new_size = quick_access_size(count, monitor.scale_factor());
        let old_size = window.outer_size().map_err(|error| error.to_string())?;
        let old_position = window.outer_position().map_err(|error| error.to_string())?;
        window
            .set_size(Size::Physical(new_size))
            .map_err(|error| error.to_string())?;
        let bottom = old_position.y + old_size.height as i32;
        window
            .set_position(Position::Physical(PhysicalPosition::new(
                old_position.x,
                bottom - new_size.height as i32,
            )))
            .map_err(|error| error.to_string())?;
    } else {
        position_quick_access(app, count)?;
    }
    window.show().map_err(|error| error.to_string())?;
    raise_quick_access_window(&window)?;
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    write_capture_log(
        app,
        "quick-access-show",
        &format!(
            "visible={} x={} y={} width={} height={}",
            window.is_visible().unwrap_or(false),
            position.x,
            position.y,
            size.width,
            size.height
        ),
    );
    let verify_app = app.clone();
    let verify_window = window.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(350));
        let Ok(position) = verify_window.outer_position() else {
            return;
        };
        let Ok(size) = verify_window.outer_size() else {
            return;
        };
        write_capture_log(
            &verify_app,
            "quick-access-placement",
            &format!(
                "visible={} x={} y={} width={} height={}",
                verify_window.is_visible().unwrap_or(false),
                position.x,
                position.y,
                size.width,
                size.height
            ),
        );
    });
    Ok(())
}

fn emit_pending_stack(app: &AppHandle, pending: &[PendingCapture]) -> Result<(), String> {
    app.emit_to("quick-access", "pending-stack-updated", pending)
        .map_err(|error| error.to_string())
}

fn refresh_quick_access(app: &AppHandle) -> Result<(), String> {
    let expanded = app
        .try_state::<CaptureState>()
        .and_then(|state| state.quick_access_expanded.lock().ok().map(|value| *value))
        .unwrap_or(false);
    show_quick_access(app, expanded)
}

fn cleanup_expired_captures(app: &AppHandle) -> Result<(), String> {
    let Some(state) = app.try_state::<CaptureState>() else {
        return Ok(());
    };

    let pending_stack = {
        let mut pending = state.pending.lock().map_err(|error| error.to_string())?;
        let mut kept = Vec::with_capacity(pending.len());
        for capture in pending.drain(..) {
            let path = PathBuf::from(&capture.path);
            if capture_is_expired(&capture.created_at)
                && safe_pending_path(app, &path)?
                && move_file_to_trash(app, &path, &capture.filename).is_ok()
            {
                continue;
            }
            kept.push(capture);
        }
        *pending = kept;
        save_pending_history(app, &pending)?;
        pending.clone()
    };

    let library = {
        let mut captures = state.captures.lock().map_err(|error| error.to_string())?;
        let mut kept = Vec::with_capacity(captures.len());
        for capture in captures.drain(..) {
            let path = PathBuf::from(&capture.path);
            if !capture.remembered
                && capture_is_expired(&capture.created_at)
                && safe_capture_path(app, &path)?
                && move_file_to_trash(app, &path, &capture.filename).is_ok()
            {
                continue;
            }
            kept.push(capture);
        }
        *captures = kept;
        save_history(app, &captures)?;
        captures.clone()
    };

    if let Err(error) = emit_pending_stack(app, &pending_stack) {
        write_capture_log(app, "pending-stack-delivery-error", &error);
    }
    if let Err(error) = app.emit_to("main", "captures-pruned", library) {
        write_capture_log(app, "library-delivery-error", &error.to_string());
    }
    if let Err(error) = refresh_quick_access(app) {
        write_capture_log(app, "quick-access-refresh-error", &error);
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn screen_capture_authorized() -> bool {
    unsafe { CGPreflightScreenCaptureAccess() }
}

#[cfg(target_os = "macos")]
fn ensure_screen_capture_access() -> Result<(), String> {
    if screen_capture_authorized() {
        return Ok(());
    }
    if unsafe { CGRequestScreenCaptureAccess() } {
        Ok(())
    } else {
        Err("ShipShot needs Screen Recording permission. Enable ShipShot in System Settings → Privacy & Security → Screen Recording, then reopen the app.".into())
    }
}

#[cfg(not(target_os = "macos"))]
fn screen_capture_authorized() -> bool {
    false
}

#[cfg(not(target_os = "macos"))]
fn ensure_screen_capture_access() -> Result<(), String> {
    Err("ShipShot capture is currently available on macOS".into())
}

#[tauri::command]
fn screen_capture_permission_status() -> bool {
    screen_capture_authorized()
}

#[tauri::command]
fn open_screen_recording_settings(app: AppHandle) -> Result<(), String> {
    write_capture_log(
        &app,
        "permission-settings",
        "opening macOS Screen Recording settings",
    );
    Command::new("/usr/bin/open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
        .spawn()
        .map_err(|error| format!("Can't open Screen Recording settings: {error}"))?;
    Ok(())
}

#[tauri::command]
fn list_captures(state: tauri::State<'_, CaptureState>) -> Result<Vec<Capture>, String> {
    Ok(state
        .captures
        .lock()
        .map_err(|error| error.to_string())?
        .clone())
}

#[tauri::command]
fn get_pending_capture(
    state: tauri::State<'_, CaptureState>,
) -> Result<Option<PendingCapture>, String> {
    Ok(state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .last()
        .cloned())
}

#[tauri::command]
fn get_pending_captures(
    state: tauri::State<'_, CaptureState>,
) -> Result<Vec<PendingCapture>, String> {
    Ok(state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .clone())
}

async fn capture_screen_inner(app: AppHandle, mode: String) -> Result<PendingCapture, String> {
    write_capture_log(&app, "capture-start", &format!("mode={mode}"));
    if !matches!(
        mode.as_str(),
        "area" | "window" | "fullscreen" | "recording"
    ) {
        return Err(format!("Unsupported capture mode: {mode}"));
    }
    let pending_count = app
        .try_state::<CaptureState>()
        .ok_or_else(|| "ShipShot is still starting".to_string())?
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .len();
    if pending_count >= MAX_PENDING_CAPTURES {
        return Err(format!(
            "ShipShot can hold up to {MAX_PENDING_CAPTURES} temporary captures. Save or delete one before taking another screenshot."
        ));
    }
    if let Err(error) = ensure_screen_capture_access() {
        write_capture_log(&app, "capture-permission-denied", &error);
        return Err(error);
    }
    let directory = pending_dir(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let timestamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let extension = if mode == "recording" { "mov" } else { "png" };
    let filename = format!("ShipShot_{timestamp}_{}.{}", &id[..8], extension);
    let output_path = directory.join(&filename);
    let command_path = output_path.clone();
    let command_mode = mode.clone();

    let status = tauri::async_runtime::spawn_blocking(move || {
        let mut command = Command::new("/usr/sbin/screencapture");
        match command_mode.as_str() {
            "area" => {
                command.args(["-i", "-s", "-x"]);
            }
            "window" => {
                command.args(["-i", "-w", "-x"]);
            }
            "fullscreen" => {
                command.args(["-x"]);
            }
            "recording" => {
                command.args(["-v", "-i", "-g", "-k", "-x"]);
            }
            _ => unreachable!(),
        }
        command.arg(&command_path).status()
    })
    .await
    .map_err(|error| format!("Capture task failed: {error}"))?
    .map_err(|error| format!("Unable to start macOS screen capture: {error}"))?;

    if !status.success() || !output_path.exists() {
        write_capture_log(
            &app,
            "capture-cancelled",
            &format!("mode={mode} status={status}"),
        );
        return Err("Capture cancelled".into());
    }

    let metadata = fs::metadata(&output_path)
        .map_err(|error| format!("Can't read the temporary capture: {error}"))?;
    let (width, height) = if mode == "recording" {
        (0, 0)
    } else {
        image_dimensions(&output_path)
    };
    let pending = PendingCapture {
        id,
        filename,
        path: output_path.to_string_lossy().to_string(),
        media_type: if mode == "recording" {
            "video".into()
        } else {
            "image".into()
        },
        mode,
        created_at: Utc::now().to_rfc3339(),
        width,
        height,
        file_size: metadata.len(),
    };
    let state = app.state::<CaptureState>();
    let stack = {
        let mut captures = state.pending.lock().map_err(|error| error.to_string())?;
        captures.push(pending.clone());
        save_pending_history(&app, &captures)?;
        captures.clone()
    };
    *state
        .quick_access_expanded
        .lock()
        .map_err(|error| error.to_string())? = false;
    // The pin is deliberately NOT reset here: the webview keeps its own pinned state
    // across captures, and clearing it here made the pin icon disagree with the backend.
    state.quick_access_busy.store(false, Ordering::Release);
    if let Err(error) = emit_pending_stack(&app, &stack) {
        write_capture_log(&app, "pending-stack-delivery-error", &error);
    }
    if let Err(error) = show_quick_access(&app, false) {
        write_capture_log(&app, "quick-access-show-error", &error);
    }
    write_capture_log(
        &app,
        "capture-ready",
        &format!(
            "id={} mode={} bytes={}",
            pending.id, pending.mode, pending.file_size
        ),
    );
    Ok(pending)
}

async fn capture_with_window_policy(
    app: AppHandle,
    mode: String,
) -> Result<PendingCapture, String> {
    let state = app
        .try_state::<CaptureState>()
        .ok_or_else(|| "ShipShot is still starting".to_string())?;
    if state.capture_in_progress.swap(true, Ordering::AcqRel) {
        return Err("A ShipShot capture is already in progress".into());
    }
    drop(state);

    let main_window = app.get_webview_window("main");
    let was_visible = main_window
        .as_ref()
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false);
    let was_minimized = main_window
        .as_ref()
        .and_then(|window| window.is_minimized().ok())
        .unwrap_or(false);
    let restore_on_failure = was_visible && !was_minimized;

    if restore_on_failure {
        if let Some(window) = &main_window {
            let _ = window.hide();
        }
        let _ = tauri::async_runtime::spawn_blocking(|| {
            thread::sleep(Duration::from_millis(220));
        })
        .await;
    }

    let result = capture_screen_inner(app.clone(), mode).await;

    if let Some(state) = app.try_state::<CaptureState>() {
        state.capture_in_progress.store(false, Ordering::Release);
    }

    if result.is_err() && restore_on_failure {
        if let Some(window) = &main_window {
            let _ = window.show();
            let _ = window.set_focus();
        }
    } else if was_minimized {
        if let Some(window) = &main_window {
            let _ = window.minimize();
        }
    }

    result
}

#[tauri::command]
async fn capture_screen(app: AppHandle, mode: String) -> Result<PendingCapture, String> {
    capture_with_window_policy(app, mode).await
}

pub(crate) fn trigger_background_capture(app: &AppHandle, mode: &str) {
    trigger_background_capture_from(app, mode, "native-mouse");
}

fn trigger_background_capture_from(app: &AppHandle, mode: &str, source: &str) {
    let cursor = app.cursor_position().ok();
    let monitor = cursor_monitor(app).ok();
    let main_window = app.get_webview_window("main");
    let main_visible = main_window
        .as_ref()
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false);
    let main_minimized = main_window
        .as_ref()
        .and_then(|window| window.is_minimized().ok())
        .unwrap_or(false);
    write_capture_log(
        app,
        "capture-trigger",
        &format!(
            "source={source} mode={mode} cursor={} monitor={} main_visible={main_visible} main_minimized={main_minimized}",
            cursor
                .map(|position| format!("{},{}", position.x, position.y))
                .unwrap_or_else(|| "unknown".into()),
            monitor
                .map(|display| format!(
                    "{},{},{},{}",
                    display.position().x,
                    display.position().y,
                    display.size().width,
                    display.size().height
                ))
                .unwrap_or_else(|| "unknown".into())
        ),
    );
    let app = app.clone();
    let mode = mode.to_string();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = capture_with_window_policy(app.clone(), mode.clone()).await {
            let lowered = error.to_lowercase();
            let is_expected = lowered.contains("cancel") || lowered.contains("already in progress");
            if !is_expected {
                write_capture_log(&app, "background-capture-error", &error);
                let _ = app.emit_to("main", "capture-error", error);
            }
        }
    });
}

#[tauri::command]
fn save_pending_capture(
    app: AppHandle,
    id: String,
    preserve_source: Option<bool>,
    state: tauri::State<'_, CaptureState>,
) -> Result<Capture, String> {
    let pending = state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .iter()
        .find(|pending| pending.id == id)
        .cloned()
        .ok_or_else(|| "Temporary capture not found".to_string())?;
    let source = PathBuf::from(&pending.path);
    if !safe_pending_path(&app, &source)? || !source.is_file() {
        return Err("Temporary capture file is missing".into());
    }

    let directory = capture_dir(&app)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Can't create the ShipShot capture folder: {error}"))?;
    let destination = unique_destination(&directory, &pending.filename);
    if preserve_source.unwrap_or(false) {
        fs::copy(&source, &destination)
            .map_err(|error| format!("Can't save the capture: {error}"))?;
    } else if fs::rename(&source, &destination).is_err() {
        fs::copy(&source, &destination)
            .map_err(|error| format!("Can't save the capture: {error}"))?;
        fs::remove_file(&source)
            .map_err(|error| format!("Can't remove the temporary capture: {error}"))?;
    }
    let filename = destination
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(&pending.filename)
        .to_string();
    let capture = Capture {
        id: pending.id,
        filename,
        path: destination.to_string_lossy().to_string(),
        media_type: pending.media_type,
        mode: pending.mode,
        created_at: pending.created_at,
        width: pending.width,
        height: pending.height,
        file_size: pending.file_size,
        remembered: false,
        memory_slug: None,
    };
    {
        let mut captures = state.captures.lock().map_err(|error| error.to_string())?;
        captures.insert(0, capture.clone());
        save_history(&app, &captures)?;
    }
    let stack = {
        let mut pending = state.pending.lock().map_err(|error| error.to_string())?;
        pending.retain(|item| item.id != id);
        save_pending_history(&app, &pending)?;
        pending.clone()
    };
    emit_pending_stack(&app, &stack)?;
    refresh_quick_access(&app)?;
    app.emit_to("main", "capture-saved", &capture)
        .map_err(|error| error.to_string())?;
    Ok(capture)
}

#[tauri::command]
fn discard_pending_capture(
    app: AppHandle,
    id: String,
    state: tauri::State<'_, CaptureState>,
) -> Result<(), String> {
    let mut guard = state.pending.lock().map_err(|error| error.to_string())?;
    let pending = guard
        .iter()
        .find(|pending| pending.id == id)
        .cloned()
        .ok_or_else(|| "Temporary capture not found".to_string())?;
    let path = PathBuf::from(&pending.path);
    if !safe_pending_path(&app, &path)? {
        return Err("Refusing to delete a file outside ShipShot's temporary folder".into());
    }
    move_file_to_trash(&app, &path, &pending.filename)?;
    guard.retain(|item| item.id != id);
    save_pending_history(&app, &guard)?;
    let stack = guard.clone();
    drop(guard);
    emit_pending_stack(&app, &stack)?;
    refresh_quick_access(&app)?;
    app.emit_to("main", "capture-discarded", id)
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn copy_pending_capture(id: String, state: tauri::State<'_, CaptureState>) -> Result<(), String> {
    let pending = state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .iter()
        .find(|pending| pending.id == id)
        .cloned()
        .ok_or_else(|| "Temporary capture not found".to_string())?;
    if pending.media_type != "image" {
        return Err("Only screenshots can be copied to the clipboard".into());
    }
    copy_image_to_clipboard(Path::new(&pending.path))
}

#[tauri::command]
fn export_pending_to_desktop(
    app: AppHandle,
    id: String,
    state: tauri::State<'_, CaptureState>,
) -> Result<String, String> {
    let pending = state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .iter()
        .find(|pending| pending.id == id)
        .cloned()
        .ok_or_else(|| "Temporary capture not found".to_string())?;
    let desktop = app
        .path()
        .desktop_dir()
        .map_err(|error| format!("Can't locate the Desktop folder: {error}"))?;
    let destination = unique_destination(&desktop, &pending.filename);
    fs::copy(&pending.path, &destination)
        .map_err(|error| format!("Can't export the capture to Desktop: {error}"))?;
    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
fn export_pending_with_picker(
    id: String,
    state: tauri::State<'_, CaptureState>,
) -> Result<Option<String>, String> {
    let pending = state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .iter()
        .find(|pending| pending.id == id)
        .cloned()
        .ok_or_else(|| "Temporary capture not found".to_string())?;
    let script = r#"try
set targetFolder to choose folder with prompt "Save ShipShot capture to:"
return POSIX path of targetFolder
on error number -128
return ""
end try"#;
    let output = Command::new("/usr/bin/osascript")
        .args(["-e", script])
        .output()
        .map_err(|error| format!("Can't open the folder picker: {error}"))?;
    if !output.status.success() {
        return Err("macOS couldn't open the folder picker".into());
    }
    let folder = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if folder.is_empty() {
        return Ok(None);
    }
    let destination = unique_destination(Path::new(&folder), &pending.filename);
    fs::copy(&pending.path, &destination)
        .map_err(|error| format!("Can't save the capture to that folder: {error}"))?;
    Ok(Some(destination.to_string_lossy().to_string()))
}

#[tauri::command]
fn read_pending_image(id: String, state: tauri::State<'_, CaptureState>) -> Result<String, String> {
    let pending = state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .iter()
        .find(|pending| pending.id == id)
        .cloned()
        .ok_or_else(|| "Temporary capture not found".to_string())?;
    if pending.media_type != "image" {
        return Err("Only screenshots can be annotated".into());
    }
    let bytes = fs::read(&pending.path)
        .map_err(|error| format!("Can't read the temporary screenshot: {error}"))?;
    Ok(format!("data:image/png;base64,{}", BASE64.encode(bytes)))
}

#[tauri::command]
fn save_annotated_pending(
    app: AppHandle,
    id: String,
    data_url: String,
    state: tauri::State<'_, CaptureState>,
) -> Result<PendingCapture, String> {
    let encoded = data_url
        .split_once(',')
        .map(|(_, value)| value)
        .ok_or_else(|| "Annotation image data is invalid".to_string())?;
    let bytes = BASE64
        .decode(encoded)
        .map_err(|error| format!("Can't decode the annotation image: {error}"))?;
    let mut guard = state.pending.lock().map_err(|error| error.to_string())?;
    let pending = guard
        .iter_mut()
        .find(|pending| pending.id == id)
        .ok_or_else(|| "Temporary capture not found".to_string())?;
    let path = PathBuf::from(&pending.path);
    if !safe_pending_path(&app, &path)? {
        return Err("Refusing to edit a file outside ShipShot's temporary folder".into());
    }
    fs::write(&path, bytes).map_err(|error| format!("Can't save annotations: {error}"))?;
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    let (width, height) = image_dimensions(&path);
    pending.file_size = metadata.len();
    pending.width = width;
    pending.height = height;
    let updated = pending.clone();
    save_pending_history(&app, &guard)?;
    let stack = guard.clone();
    drop(guard);
    emit_pending_stack(&app, &stack)?;
    Ok(updated)
}

#[tauri::command]
fn open_annotation(
    app: AppHandle,
    id: String,
    state: tauri::State<'_, CaptureState>,
) -> Result<(), String> {
    let pending = state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .iter()
        .find(|pending| pending.id == id)
        .cloned()
        .ok_or_else(|| "Temporary capture not found".to_string())?;
    if pending.media_type != "image" {
        return Err("Only screenshots can be annotated".into());
    }
    if let Some(quick) = app.get_webview_window("quick-access") {
        let _ = quick.hide();
    }
    let editor = app
        .get_webview_window("annotation")
        .ok_or_else(|| "Annotation window is unavailable".to_string())?;
    editor.center().map_err(|error| error.to_string())?;
    editor.show().map_err(|error| error.to_string())?;
    editor.set_focus().map_err(|error| error.to_string())?;
    // set_focus is a no-op while the window still reports itself as hidden, which left the
    // editor visible but not key — the first drawing press was eaten activating the window.
    let focus_editor = editor.clone();
    thread::spawn(move || {
        for delay in [90, 240] {
            thread::sleep(Duration::from_millis(delay));
            let _ = focus_editor.set_focus();
        }
    });
    app.emit_to("annotation", "annotation-opened", pending)
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_annotation(app: AppHandle, state: tauri::State<'_, CaptureState>) -> Result<(), String> {
    if let Some(editor) = app.get_webview_window("annotation") {
        editor.hide().map_err(|error| error.to_string())?;
    }
    // The card controls are always on screen now, so there is no expanded state to restore —
    // leaving it false keeps the cursor tracker from re-laying out the stack under the pointer.
    *state
        .quick_access_expanded
        .lock()
        .map_err(|error| error.to_string())? = false;
    show_quick_access(&app, false)
}

#[tauri::command]
fn set_quick_access_expanded(
    app: AppHandle,
    expanded: bool,
    state: tauri::State<'_, CaptureState>,
) -> Result<(), String> {
    *state
        .quick_access_expanded
        .lock()
        .map_err(|error| error.to_string())? = expanded;
    show_quick_access(&app, expanded)
}

#[tauri::command]
fn set_quick_access_pinned(
    pinned: bool,
    state: tauri::State<'_, CaptureState>,
) -> Result<(), String> {
    *state
        .quick_access_pinned
        .lock()
        .map_err(|error| error.to_string())? = pinned;
    Ok(())
}

/// Held true for the length of a drag-out so the cursor tracker leaves the stack alone.
#[tauri::command]
fn set_quick_access_busy(busy: bool, state: tauri::State<'_, CaptureState>) {
    state.quick_access_busy.store(busy, Ordering::Release);
}

/// True when the pointer is over the floating stack — used to reject a drop the user
/// released on ShipShot's own window instead of on a real drop target.
#[tauri::command]
fn quick_access_contains_cursor(app: AppHandle) -> bool {
    cursor_is_inside_quick_access(&app).unwrap_or(false)
}

#[tauri::command]
fn set_quick_access_user_positioned(
    positioned: bool,
    state: tauri::State<'_, CaptureState>,
) -> Result<(), String> {
    *state
        .quick_access_user_positioned
        .lock()
        .map_err(|error| error.to_string())? = positioned;
    *state
        .quick_access_candidate
        .lock()
        .map_err(|error| error.to_string())? = None;
    Ok(())
}

#[tauri::command]
fn mark_remembered(
    app: AppHandle,
    id: String,
    memory_slug: String,
    state: tauri::State<'_, CaptureState>,
) -> Result<Capture, String> {
    let mut captures = state.captures.lock().map_err(|error| error.to_string())?;
    let capture = captures
        .iter_mut()
        .find(|capture| capture.id == id)
        .ok_or_else(|| "Capture not found".to_string())?;
    capture.remembered = true;
    capture.memory_slug = Some(memory_slug);
    let updated = capture.clone();
    save_history(&app, &captures)?;
    app.emit_to("main", "capture-updated", &updated)
        .map_err(|error| error.to_string())?;
    Ok(updated)
}

#[tauri::command]
fn reveal_capture(id: String, state: tauri::State<'_, CaptureState>) -> Result<(), String> {
    let captures = state.captures.lock().map_err(|error| error.to_string())?;
    let capture = captures
        .iter()
        .find(|capture| capture.id == id)
        .ok_or_else(|| "Capture not found".to_string())?;
    Command::new("/usr/bin/open")
        .arg("-R")
        .arg(&capture.path)
        .spawn()
        .map_err(|error| format!("Can't reveal the capture: {error}"))?;
    Ok(())
}

#[tauri::command]
fn copy_capture(id: String, state: tauri::State<'_, CaptureState>) -> Result<(), String> {
    let captures = state.captures.lock().map_err(|error| error.to_string())?;
    let capture = captures
        .iter()
        .find(|capture| capture.id == id)
        .ok_or_else(|| "Capture not found".to_string())?;
    if capture.media_type != "image" {
        return Err("Only screenshots can be copied to the clipboard".into());
    }
    copy_image_to_clipboard(Path::new(&capture.path))
}

#[tauri::command]
fn copy_capture_to_memory(
    app: AppHandle,
    id: String,
    state: tauri::State<'_, CaptureState>,
) -> Result<MemoryAttachment, String> {
    let captures = state.captures.lock().map_err(|error| error.to_string())?;
    let capture = captures
        .iter()
        .find(|capture| capture.id == id)
        .ok_or_else(|| "Capture not found".to_string())?;
    let source = PathBuf::from(&capture.path);
    if !safe_capture_path(&app, &source)? || !source.is_file() {
        return Err("Capture file is missing or outside the ShipShot folder".into());
    }
    let home = app
        .path()
        .home_dir()
        .map_err(|error| format!("Can't locate the home folder: {error}"))?;
    let destination = home
        .join("ShipMemory")
        .join(".shipmemory")
        .join("attachments");
    fs::create_dir_all(&destination)
        .map_err(|error| format!("Can't create Ship Memory attachments: {error}"))?;
    let destination_path = unique_destination(&destination, &capture.filename);
    fs::copy(&source, &destination_path)
        .map_err(|error| format!("Can't copy capture into Ship Memory: {error}"))?;
    let filename = destination_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(&capture.filename)
        .to_string();
    Ok(MemoryAttachment {
        rel_path: format!("attachments/{filename}"),
        name: filename,
    })
}

#[tauri::command]
fn open_capture_folder(app: AppHandle) -> Result<(), String> {
    let directory = capture_dir(&app)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Can't create the ShipShot folder: {error}"))?;
    Command::new("/usr/bin/open")
        .arg(directory)
        .spawn()
        .map_err(|error| format!("Can't open the ShipShot folder: {error}"))?;
    Ok(())
}

#[tauri::command]
fn open_memory_vault(app: AppHandle) -> Result<(), String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|error| format!("Can't locate the home folder: {error}"))?;
    let vault = home.join("ShipMemory").join(".shipmemory");
    fs::create_dir_all(&vault)
        .map_err(|error| format!("Can't create the Ship Memory vault: {error}"))?;
    Command::new("/usr/bin/open")
        .arg(vault)
        .spawn()
        .map_err(|error| format!("Can't open Ship Memory: {error}"))?;
    Ok(())
}

#[tauri::command]
fn delete_capture(
    app: AppHandle,
    id: String,
    state: tauri::State<'_, CaptureState>,
) -> Result<(), String> {
    let mut captures = state.captures.lock().map_err(|error| error.to_string())?;
    let index = captures
        .iter()
        .position(|capture| capture.id == id)
        .ok_or_else(|| "Capture not found".to_string())?;
    let path = PathBuf::from(&captures[index].path);
    if !safe_capture_path(&app, &path)? {
        return Err("Refusing to delete a file outside the ShipShot capture folder".into());
    }
    move_file_to_trash(&app, &path, &captures[index].filename)?;
    captures.remove(index);
    save_history(&app, &captures)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let background_launch = std::env::args().any(|argument| argument == "--background");
    let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_shortcuts(["Alt+Shift+1", "Alt+Shift+2", "Alt+Shift+3", "Alt+Shift+4"])
        .expect("ShipShot global shortcuts must be valid")
        .with_handler(|app, shortcut, event| {
            if !matches!(event.state, ShortcutState::Pressed) {
                return;
            }
            let modifiers = Modifiers::ALT | Modifiers::SHIFT;
            let mode = if shortcut.matches(modifiers, Code::Digit1) {
                Some("area")
            } else if shortcut.matches(modifiers, Code::Digit2) {
                Some("window")
            } else if shortcut.matches(modifiers, Code::Digit3) {
                Some("fullscreen")
            } else if shortcut.matches(modifiers, Code::Digit4) {
                Some("recording")
            } else {
                None
            };
            if let Some(mode) = mode {
                trigger_background_capture_from(app, mode, "global-shortcut");
            }
        })
        .build();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(shortcut_plugin)
        .plugin(tauri_plugin_drag::init())
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let tray_menu = MenuBuilder::new(app)
                .text("capture_area", "Capture Area     ⌥⇧1")
                .text("capture_window", "Capture Window  ⌥⇧2")
                .text("capture_fullscreen", "Fullscreen          ⌥⇧3")
                .text("record_screen", "Record Screen    ⌥⇧4")
                .separator()
                .text("open_shipshot", "Open ShipShot")
                .text("open_library", "Capture Library")
                .text("open_memory", "Ship Memory")
                .text("open_shortcuts", "Mouse & Shortcuts")
                .text("open_settings", "Settings…")
                .separator()
                .text("quit_shipshot", "Quit ShipShot")
                .build()?;

            TrayIconBuilder::with_id("shipshot")
                .menu(&tray_menu)
                .tooltip("ShipShot")
                .show_menu_on_left_click(true)
                .icon_as_template(false)
                .icon(TRAY_ICON)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "capture_area" => trigger_background_capture_from(app, "area", "menu-bar"),
                    "capture_window" => trigger_background_capture_from(app, "window", "menu-bar"),
                    "capture_fullscreen" => {
                        trigger_background_capture_from(app, "fullscreen", "menu-bar")
                    }
                    "record_screen" => {
                        trigger_background_capture_from(app, "recording", "menu-bar")
                    }
                    "open_shipshot" => show_main_window(app, Some("capture")),
                    "open_library" => show_main_window(app, Some("library")),
                    "open_memory" => show_main_window(app, Some("memory")),
                    "open_shortcuts" => show_main_window(app, Some("shortcuts")),
                    "open_settings" => show_main_window(app, Some("settings")),
                    "quit_shipshot" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            let _ = pending_dir(app.handle());
            app.manage(CaptureState {
                captures: Mutex::new(load_history(app.handle())),
                pending: Mutex::new(load_pending_history(app.handle())),
                capture_in_progress: AtomicBool::new(false),
                quick_access_expanded: Mutex::new(false),
                quick_access_pinned: Mutex::new(false),
                quick_access_user_positioned: Mutex::new(false),
                quick_access_busy: AtomicBool::new(false),
                quick_access_monitor: Mutex::new(None),
                quick_access_candidate: Mutex::new(None),
            });
            if let Some(window) = app.get_webview_window("quick-access") {
                configure_quick_access_window(&window)?;
            }
            let _ = cleanup_expired_captures(app.handle());
            mouse_capture::init(app.handle().clone());
            let tracker_app = app.handle().clone();
            thread::spawn(move || loop {
                let Some(state) = tracker_app.try_state::<CaptureState>() else {
                    thread::sleep(Duration::from_millis(750));
                    continue;
                };
                let has_pending = state
                    .pending
                    .lock()
                    .map(|pending| !pending.is_empty())
                    .unwrap_or(false);
                if !has_pending {
                    thread::sleep(Duration::from_millis(750));
                    continue;
                }
                let expanded = state
                    .quick_access_expanded
                    .lock()
                    .map(|value| *value)
                    .unwrap_or(false);
                let pinned = state
                    .quick_access_pinned
                    .lock()
                    .map(|value| *value)
                    .unwrap_or(false);
                if state.quick_access_busy.load(Ordering::Acquire) {
                    thread::sleep(Duration::from_millis(180));
                    continue;
                }
                if expanded && !pinned && cursor_is_inside_quick_access(&tracker_app) == Ok(false) {
                    let _ = collapse_quick_access(&tracker_app, &state);
                    continue;
                }
                let count = state
                    .pending
                    .lock()
                    .map(|pending| pending.len())
                    .unwrap_or(1);
                let _ = sync_quick_access_to_cursor(&tracker_app, count);
                thread::sleep(Duration::from_millis(180));
            });
            let cleanup_app = app.handle().clone();
            thread::spawn(move || loop {
                thread::sleep(Duration::from_secs(300));
                let _ = cleanup_expired_captures(&cleanup_app);
            });
            let _ = refresh_quick_access(app.handle());
            if background_launch {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            } else {
                show_main_window(app.handle(), None);
            }
            write_capture_log(
                app.handle(),
                "startup",
                if background_launch {
                    "mode=background"
                } else {
                    "mode=interactive"
                },
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_captures,
            get_pending_capture,
            get_pending_captures,
            screen_capture_permission_status,
            open_screen_recording_settings,
            capture_screen,
            save_pending_capture,
            discard_pending_capture,
            copy_pending_capture,
            export_pending_to_desktop,
            export_pending_with_picker,
            read_pending_image,
            save_annotated_pending,
            open_annotation,
            close_annotation,
            set_quick_access_expanded,
            set_quick_access_pinned,
            set_quick_access_user_positioned,
            set_quick_access_busy,
            quick_access_contains_cursor,
            mark_remembered,
            reveal_capture,
            copy_capture,
            copy_capture_to_memory,
            open_capture_folder,
            open_memory_vault,
            delete_capture,
            mouse_capture::mouse_capture_get_config,
            mouse_capture::mouse_capture_set_enabled,
            mouse_capture::mouse_capture_begin_bind,
            mouse_capture::mouse_capture_cancel_bind,
            mouse_capture::mouse_capture_remove_binding,
            mouse_capture::mouse_capture_status,
            mouse_capture::mouse_capture_request_permission,
            mouse_capture::mouse_capture_open_permission_settings,
        ])
        .build(tauri::generate_context!())
        .expect("error while building ShipShot")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } = event
            {
                if !has_visible_windows {
                    show_main_window(app, None);
                    write_capture_log(app, "reopen", "showing main window");
                }
            }
        });
}
