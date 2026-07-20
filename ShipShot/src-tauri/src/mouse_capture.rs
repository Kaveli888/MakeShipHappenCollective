use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    sync::{
        mpsc::{channel, Sender},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};

const CONFIG_FILE: &str = "mouse_capture.json";
const BOUND_EVENT: &str = "shipshot://mouse-bound";
const DEBOUNCE_MS: u64 = 80;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", content = "code")]
pub enum MouseButton {
    Right,
    Middle,
    Other(u8),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseBinding {
    pub action: String,
    pub button: MouseButton,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseCaptureConfig {
    pub enabled: bool,
    pub swallow: bool,
    pub bindings: Vec<MouseBinding>,
}

impl Default for MouseCaptureConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            swallow: true,
            bindings: Vec::new(),
        }
    }
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseCaptureStatus {
    pub backend: &'static str,
    pub permission_ok: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BoundPayload {
    action: String,
    button: MouseButton,
}

pub struct MouseCaptureState {
    config: Mutex<MouseCaptureConfig>,
    binding_action: Mutex<Option<String>>,
    pending_release: Mutex<Option<MouseButton>>,
    backend: Mutex<&'static str>,
    last_event: Mutex<Instant>,
    tx: Sender<Message>,
}

enum Message {
    Trigger(String),
    Bound(BoundPayload),
    Persist,
}

fn valid_action(action: &str) -> bool {
    matches!(action, "area" | "window" | "fullscreen" | "recording")
}

pub fn init(app: AppHandle) {
    let (tx, rx) = channel::<Message>();
    let state = Arc::new(MouseCaptureState {
        config: Mutex::new(load_config(&app).unwrap_or_default()),
        binding_action: Mutex::new(None),
        pending_release: Mutex::new(None),
        backend: Mutex::new("starting"),
        last_event: Mutex::new(Instant::now()),
        tx,
    });
    app.manage(state.clone());

    {
        let worker_app = app.clone();
        let worker_state = state.clone();
        thread::spawn(move || {
            for message in rx {
                match message {
                    Message::Trigger(action) => {
                        let _ = worker_app.emit_to("main", "tray-capture", action);
                    }
                    Message::Bound(payload) => {
                        let _ = save_config(&worker_app, &worker_state.config.lock().unwrap());
                        let _ = worker_app.emit(BOUND_EVENT, payload);
                    }
                    Message::Persist => {
                        let _ = save_config(&worker_app, &worker_state.config.lock().unwrap());
                    }
                }
            }
        });
    }

    spawn_input_thread(state);
}

fn handle_button(state: &Arc<MouseCaptureState>, button: MouseButton, is_press: bool) -> bool {
    if is_press {
        let pending_action = state.binding_action.lock().unwrap().take();
        if let Some(action) = pending_action {
            let mut config = state.config.lock().unwrap();
            config
                .bindings
                .retain(|binding| binding.action != action && binding.button != button);
            config.bindings.push(MouseBinding {
                action: action.clone(),
                button,
            });
            config.enabled = true;
            *state.pending_release.lock().unwrap() = Some(button);
            let _ = state
                .tx
                .send(Message::Bound(BoundPayload { action, button }));
            return true;
        }
    } else {
        let mut pending_release = state.pending_release.lock().unwrap();
        if *pending_release == Some(button) {
            *pending_release = None;
            return true;
        }
    }

    let (enabled, swallow, action) = {
        let config = state.config.lock().unwrap();
        let action = config
            .bindings
            .iter()
            .find(|binding| binding.button == button)
            .map(|binding| binding.action.clone());
        (config.enabled, config.swallow, action)
    };
    let Some(action) = action else {
        return false;
    };
    if !enabled {
        return false;
    }

    if is_press {
        let now = Instant::now();
        let mut last_event = state.last_event.lock().unwrap();
        if now.duration_since(*last_event) >= Duration::from_millis(DEBOUNCE_MS) {
            *last_event = now;
            let _ = state.tx.send(Message::Trigger(action));
        }
    }
    swallow
}

#[cfg(target_os = "macos")]
fn spawn_input_thread(state: Arc<MouseCaptureState>) {
    thread::spawn(move || {
        use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
        use core_graphics::event::{
            CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventType,
            EventField,
        };

        let events = vec![
            CGEventType::RightMouseDown,
            CGEventType::RightMouseUp,
            CGEventType::OtherMouseDown,
            CGEventType::OtherMouseUp,
        ];
        let try_tap = |options: CGEventTapOptions, backend: &'static str| -> bool {
            let callback_state = state.clone();
            let can_swallow = matches!(options, CGEventTapOptions::Default);
            let tap = CGEventTap::new(
                CGEventTapLocation::Session,
                CGEventTapPlacement::HeadInsertEventTap,
                options,
                events.clone(),
                move |_proxy, event_type, event| {
                    let is_press = matches!(
                        event_type,
                        CGEventType::RightMouseDown | CGEventType::OtherMouseDown
                    );
                    let is_release = matches!(
                        event_type,
                        CGEventType::RightMouseUp | CGEventType::OtherMouseUp
                    );
                    if is_press || is_release {
                        let number =
                            event.get_integer_value_field(EventField::MOUSE_EVENT_BUTTON_NUMBER);
                        let button = match number {
                            1 => MouseButton::Right,
                            2 => MouseButton::Middle,
                            other => MouseButton::Other(other as u8),
                        };
                        if handle_button(&callback_state, button, is_press) && can_swallow {
                            event.set_type(CGEventType::Null);
                        }
                    }
                    None
                },
            );

            match tap {
                Ok(tap) => {
                    let Ok(source) = tap.mach_port.create_runloop_source(0) else {
                        return false;
                    };
                    *state.backend.lock().unwrap() = backend;
                    let run_loop = CFRunLoop::get_current();
                    unsafe {
                        run_loop.add_source(&source, kCFRunLoopCommonModes);
                    }
                    tap.enable();
                    CFRunLoop::run_current();
                    true
                }
                Err(_) => false,
            }
        };

        if !try_tap(CGEventTapOptions::Default, "grab")
            && !try_tap(CGEventTapOptions::ListenOnly, "listen")
        {
            *state.backend.lock().unwrap() = "failed";
        }
    });
}

fn config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|directory| directory.join(CONFIG_FILE))
}

fn load_config(app: &AppHandle) -> Option<MouseCaptureConfig> {
    serde_json::from_str(&fs::read_to_string(config_path(app)?).ok()?).ok()
}

fn save_config(app: &AppHandle, config: &MouseCaptureConfig) -> std::io::Result<()> {
    if let Some(path) = config_path(app) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, serde_json::to_string_pretty(config).unwrap())?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn accessibility_trusted(prompt: bool) -> bool {
    if prompt {
        macos_accessibility_client::accessibility::application_is_trusted_with_prompt()
    } else {
        macos_accessibility_client::accessibility::application_is_trusted()
    }
}

#[tauri::command]
pub fn mouse_capture_get_config(state: tauri::State<Arc<MouseCaptureState>>) -> MouseCaptureConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn mouse_capture_set_enabled(state: tauri::State<Arc<MouseCaptureState>>, enabled: bool) {
    state.config.lock().unwrap().enabled = enabled;
    let _ = state.tx.send(Message::Persist);
}

#[tauri::command]
pub fn mouse_capture_begin_bind(
    state: tauri::State<Arc<MouseCaptureState>>,
    action: String,
) -> Result<(), String> {
    if !valid_action(&action) {
        return Err(format!("Unsupported mouse action: {action}"));
    }
    *state.binding_action.lock().unwrap() = Some(action);
    Ok(())
}

#[tauri::command]
pub fn mouse_capture_cancel_bind(state: tauri::State<Arc<MouseCaptureState>>) {
    *state.binding_action.lock().unwrap() = None;
}

#[tauri::command]
pub fn mouse_capture_remove_binding(state: tauri::State<Arc<MouseCaptureState>>, action: String) {
    state
        .config
        .lock()
        .unwrap()
        .bindings
        .retain(|binding| binding.action != action);
    let _ = state.tx.send(Message::Persist);
}

#[tauri::command]
pub fn mouse_capture_status(state: tauri::State<Arc<MouseCaptureState>>) -> MouseCaptureStatus {
    MouseCaptureStatus {
        backend: *state.backend.lock().unwrap(),
        permission_ok: accessibility_trusted(false),
    }
}

#[tauri::command]
pub fn mouse_capture_request_permission() -> bool {
    accessibility_trusted(true)
}

#[tauri::command]
pub fn mouse_capture_open_permission_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn();
}
