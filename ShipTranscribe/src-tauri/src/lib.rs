use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::Emitter;
use tauri_plugin_updater::UpdaterExt;

// ── Binary Resolution ────────────────────────────────────────────────────
// Tauri apps on macOS don't inherit the shell PATH, so we resolve binaries explicitly.

fn find_binary(name: &str) -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users".to_string());
    let candidates = [
        format!("{}/bin/{}", home, name),
        format!("/opt/homebrew/bin/{}", name),
        format!("/usr/local/bin/{}", name),
        format!("/usr/bin/{}", name),
    ];
    candidates.iter()
        .find(|p| std::path::Path::new(p).exists())
        .cloned()
        .unwrap_or_else(|| name.to_string())
}

// ── Data Models ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Video {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub duration_secs: f64,
    pub file_size: u64,
    pub added_at: String,
    pub transcribed_at: Option<String>,
    pub status: String, // "pending" | "extracting" | "transcribing" | "completed" | "error"
    pub group_id: Option<String>,
    pub transcript_txt: Option<String>,
    pub transcript_srt: Option<String>,
    pub thumbnail_path: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppData {
    pub videos: Vec<Video>,
    pub groups: Vec<Group>,
}

impl Default for AppData {
    fn default() -> Self {
        Self {
            videos: Vec::new(),
            groups: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct TranscribeEvent {
    pub video_id: String,
    pub status: String,
    pub progress: f64,
    pub message: String,
}

// ── State ────────────────────────────────────────────────────────────────

pub struct AppState {
    pub data: Mutex<AppData>,
}

// ── Helpers ──────────────────────────────────────────────────────────────

fn data_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join("Documents").join("ShipTranscript")
}

fn data_file() -> PathBuf {
    data_dir().join("data.json")
}

fn transcripts_dir() -> PathBuf {
    data_dir().join("transcripts")
}

fn thumbnails_dir() -> PathBuf {
    data_dir().join("thumbnails")
}

fn temp_dir() -> PathBuf {
    data_dir().join("temp")
}

fn ensure_dirs() {
    let _ = fs::create_dir_all(data_dir());
    let _ = fs::create_dir_all(transcripts_dir());
    let _ = fs::create_dir_all(thumbnails_dir());
    let _ = fs::create_dir_all(temp_dir());
}

fn load_data() -> AppData {
    let path = data_file();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
            Err(_) => AppData::default(),
        }
    } else {
        AppData::default()
    }
}

fn save_data(data: &AppData) -> Result<(), String> {
    ensure_dirs();
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(data_file(), json).map_err(|e| format!("Failed to save data: {}", e))
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn get_video_duration(file_path: &str) -> f64 {
    // Try ffprobe first, fall back to ffmpeg duration extraction
    let ffprobe = find_binary("ffprobe");
    let ffmpeg = find_binary("ffmpeg");

    // If ffprobe exists, use it
    if std::path::Path::new(&ffprobe).exists() && ffprobe != "ffprobe" {
        let output = Command::new(&ffprobe)
            .args(["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", file_path])
            .output();
        if let Ok(o) = output {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if let Ok(d) = s.parse::<f64>() {
                return d;
            }
        }
    }

    // Fallback: use ffmpeg to get duration
    let output = Command::new(&ffmpeg)
        .args(["-i", file_path])
        .output();
    if let Ok(o) = output {
        let stderr = String::from_utf8_lossy(&o.stderr);
        // Parse "Duration: HH:MM:SS.ss" from ffmpeg output
        if let Some(dur_start) = stderr.find("Duration: ") {
            let dur_str = &stderr[dur_start + 10..];
            if let Some(comma) = dur_str.find(',') {
                let time_str = &dur_str[..comma];
                let parts: Vec<&str> = time_str.split(':').collect();
                if parts.len() == 3 {
                    let h: f64 = parts[0].parse().unwrap_or(0.0);
                    let m: f64 = parts[1].parse().unwrap_or(0.0);
                    let s: f64 = parts[2].parse().unwrap_or(0.0);
                    return h * 3600.0 + m * 60.0 + s;
                }
            }
        }
    }
    0.0
}


fn get_file_size(file_path: &str) -> u64 {
    fs::metadata(file_path).map(|m| m.len()).unwrap_or(0)
}

fn format_duration(secs: f64) -> String {
    let total = secs as u64;
    let h = total / 3600;
    let m = (total % 3600) / 60;
    let s = total % 60;
    if h > 0 {
        format!("{}h {}m {}s", h, m, s)
    } else if m > 0 {
        format!("{}m {}s", m, s)
    } else {
        format!("{}s", s)
    }
}

// ── Tauri Commands ───────────────────────────────────────────────────────

#[tauri::command]
fn get_all_data(state: tauri::State<'_, AppState>) -> Result<AppData, String> {
    let data = state.data.lock().map_err(|e| e.to_string())?;
    Ok(data.clone())
}

#[tauri::command]
fn import_video(file_path: String, state: tauri::State<'_, AppState>) -> Result<Video, String> {
    ensure_dirs();

    let name = std::path::Path::new(&file_path)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let duration = get_video_duration(&file_path);
    let size = get_file_size(&file_path);
    let id = uuid::Uuid::new_v4().to_string();

    // Generate thumbnail
    let thumb_path = thumbnails_dir().join(format!("{}.jpg", id));
    let thumb_str = thumb_path.to_string_lossy().to_string();

    // Grab a frame at 10% into the video
    let seek_time = (duration * 0.1).max(1.0);
    let _ = Command::new(&find_binary("ffmpeg"))
        .args([
            "-ss", &format!("{:.1}", seek_time),
            "-i", &file_path,
            "-vframes", "1",
            "-q:v", "3",
            "-vf", "scale=480:-1",
            "-y",
            &thumb_str,
        ])
        .output();

    let video = Video {
        id: id.clone(),
        name,
        file_path,
        duration_secs: duration,
        file_size: size,
        added_at: now_iso(),
        transcribed_at: None,
        status: "pending".to_string(),
        group_id: None,
        transcript_txt: None,
        transcript_srt: None,
        thumbnail_path: if thumb_path.exists() {
            Some(thumb_str)
        } else {
            None
        },
        error_message: None,
    };

    let mut data = state.data.lock().map_err(|e| e.to_string())?;
    data.videos.push(video.clone());
    save_data(&data)?;

    Ok(video)
}

#[tauri::command]
async fn start_transcription(
    video_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let file_path: String;
    let duration_secs: f64;
    let vid_id = video_id.clone();

    // Get the video info and update status
    {
        let mut data = state.data.lock().map_err(|e| e.to_string())?;
        let video = data.videos.iter_mut().find(|v| v.id == video_id)
            .ok_or("Video not found")?;
        video.status = "extracting".to_string();
        video.error_message = None;
        file_path = video.file_path.clone();
        duration_secs = video.duration_secs;
        save_data(&data)?;
    }

    let app_handle = app.clone();
    let vid_id_emit = vid_id.clone();
    let emit_progress = move |status: &str, progress: f64, message: &str| {
        let _ = app_handle.emit("transcribe-progress", TranscribeEvent {
            video_id: vid_id_emit.clone(),
            status: status.to_string(),
            progress,
            message: message.to_string(),
        });
    };

    // Estimate transcription time (whisper-cli ≈ 0.5x realtime on Metal GPU)
    let est_minutes = (duration_secs / 60.0 * 0.5).ceil() as u64;
    let duration_str = format_duration(duration_secs);

    emit_progress("extracting", 0.05, &format!("Extracting audio ({})...", duration_str));

    // Step 1: Extract audio with FFmpeg
    let audio_path = temp_dir().join(format!("{}.wav", video_id));
    let audio_str = audio_path.to_string_lossy().to_string();

    let ffmpeg_result = tauri::async_runtime::spawn_blocking(move || {
        Command::new(&find_binary("ffmpeg"))
            .args([
                "-i", &file_path,
                "-ar", "16000",
                "-ac", "1",
                "-c:a", "pcm_s16le",
                "-y",
                &audio_str,
            ])
            .output()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| format!("FFmpeg failed: {}", e))?;

    if !ffmpeg_result.status.success() {
        let err = String::from_utf8_lossy(&ffmpeg_result.stderr).to_string();
        let mut data = state.data.lock().map_err(|e| e.to_string())?;
        if let Some(video) = data.videos.iter_mut().find(|v| v.id == video_id) {
            video.status = "error".to_string();
            video.error_message = Some(format!("Audio extraction failed: {}", err));
        }
        save_data(&data)?;
        emit_progress("error", 0.0, &format!("Audio extraction failed: {}", String::from_utf8_lossy(&ffmpeg_result.stderr).chars().take(100).collect::<String>()));
        return Err("Audio extraction failed".to_string());
    }

    // Determine which engine we'll use BEFORE starting transcription
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let model_candidates = [
        format!("{}/.local/share/whisper-cpp/models/ggml-large-v3-turbo.bin", home),
        format!("{}/.local/share/whisper-cpp/models/ggml-large-v3.bin", home),
        format!("{}/.local/share/whisper-cpp/models/ggml-base.bin", home),
    ];
    let model_path = model_candidates.iter().find(|p| std::path::Path::new(p).exists()).cloned();
    let whisper_bin = find_binary("whisper-cli");
    let use_cpp = model_path.is_some() && std::path::Path::new(&whisper_bin).exists() && whisper_bin != "whisper-cli";

    let engine_name = if use_cpp { "whisper.cpp (Metal GPU)" } else { "Python Whisper (CPU)" };
    emit_progress("transcribing", 0.15, &format!(
        "Transcribing with {} — est. ~{} min for {} audio. Do not close the app.",
        engine_name, est_minutes, duration_str
    ));

    // Update status
    {
        let mut data = state.data.lock().map_err(|e| e.to_string())?;
        if let Some(video) = data.videos.iter_mut().find(|v| v.id == video_id) {
            video.status = "transcribing".to_string();
        }
        save_data(&data)?;
    }

    // Step 2: Transcribe with whisper — run as a spawned process so we can track elapsed time
    let audio_for_whisper = temp_dir().join(format!("{}.wav", video_id));
    let audio_whisper_str = audio_for_whisper.to_string_lossy().to_string();
    let output_dir = transcripts_dir().to_string_lossy().to_string();
    let vid_id_for_whisper = video_id.clone();

    // Spawn a background timer that updates progress every 15 seconds
    let app_for_timer = app.clone();
    let vid_for_timer = video_id.clone();
    let timer_est = est_minutes;
    let timer_engine = engine_name.to_string();
    let timer_dur_str = duration_str.clone();
    let timer_running = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
    let timer_flag = timer_running.clone();

    std::thread::spawn(move || {
        let start = std::time::Instant::now();
        loop {
            std::thread::sleep(std::time::Duration::from_secs(15));
            if !timer_flag.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }
            let elapsed = start.elapsed().as_secs();
            let elapsed_min = elapsed / 60;
            let elapsed_sec = elapsed % 60;
            // Estimate progress as elapsed / estimated_total (capped at 85%)
            let est_total = timer_est as f64 * 60.0;
            let progress = (0.15 + (elapsed as f64 / est_total) * 0.7).min(0.85);
            let msg = format!(
                "Transcribing with {} — {}m {}s elapsed (est. ~{} min) for {}",
                timer_engine, elapsed_min, elapsed_sec, timer_est, timer_dur_str
            );
            let _ = app_for_timer.emit("transcribe-progress", TranscribeEvent {
                video_id: vid_for_timer.clone(),
                status: "transcribing".to_string(),
                progress,
                message: msg,
            });
        }
    });

    let whisper_result = tauri::async_runtime::spawn_blocking(move || {
        if use_cpp {
            let model = model_path.unwrap();
            let output = Command::new(&whisper_bin)
                .args([
                    "-m", &model,
                    "-f", &audio_whisper_str,
                    "--output-txt",
                    "--output-srt",
                    "-of", &format!("{}/{}", output_dir, vid_id_for_whisper),
                ])
                .output()
                .map_err(|e| format!("whisper-cli failed to start: {}", e))?;
            Ok(("cpp".to_string(), output))
        } else {
            let py_bin = find_binary("whisper");
            let py_result = Command::new(&py_bin)
                .args([
                    &audio_whisper_str,
                    "--model", "base",
                    "--output_format", "txt",
                    "--output_dir", &output_dir,
                    "--verbose", "False",
                ])
                .output()
                .map_err(|e| format!("Whisper failed to start: {}", e))?;
            Ok(("python".to_string(), py_result))
        }
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e: String| format!("Transcription failed: {}", e))?;

    // Stop the timer
    timer_running.store(false, std::sync::atomic::Ordering::Relaxed);

    let (engine, output) = whisper_result;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let err_detail = if stderr.is_empty() { stdout } else { stderr };
        let mut data = state.data.lock().map_err(|e| e.to_string())?;
        if let Some(video) = data.videos.iter_mut().find(|v| v.id == video_id) {
            video.status = "error".to_string();
            video.error_message = Some(format!("Transcription failed ({}): {}", engine, err_detail.chars().take(300).collect::<String>()));
        }
        save_data(&data)?;
        emit_progress("error", 0.0, &format!("Transcription failed: {}", err_detail.chars().take(100).collect::<String>()));
        return Err(format!("Transcription failed: {}", err_detail.chars().take(200).collect::<String>()));
    }

    emit_progress("completing", 0.92, "Saving transcript...");

    // Step 3: Read the transcript files
    let txt_path = transcripts_dir().join(format!("{}.txt", video_id));
    let srt_path = transcripts_dir().join(format!("{}.srt", video_id));

    // Python whisper names files after the input filename, so we may need to rename
    if engine == "python" {
        let py_wav_txt = transcripts_dir().join(format!("{}.wav.txt", video_id));
        if !txt_path.exists() && py_wav_txt.exists() {
            let _ = fs::rename(&py_wav_txt, &txt_path);
        }
        let py_wav_srt = transcripts_dir().join(format!("{}.wav.srt", video_id));
        if !srt_path.exists() && py_wav_srt.exists() {
            let _ = fs::rename(&py_wav_srt, &srt_path);
        }
    }

    let transcript_text = fs::read_to_string(&txt_path).ok();
    let transcript_srt = fs::read_to_string(&srt_path).ok();

    // Update video record
    {
        let mut data = state.data.lock().map_err(|e| e.to_string())?;
        if let Some(video) = data.videos.iter_mut().find(|v| v.id == video_id) {
            video.status = "completed".to_string();
            video.transcribed_at = Some(now_iso());
            video.transcript_txt = transcript_text;
            video.transcript_srt = transcript_srt;
            video.error_message = None;
        }
        save_data(&data)?;
    }

    // Clean up temp audio file
    let _ = fs::remove_file(temp_dir().join(format!("{}.wav", video_id)));

    emit_progress("completed", 1.0, "Transcription complete!");

    Ok(())
}

#[tauri::command]
fn create_group(name: String, state: tauri::State<'_, AppState>) -> Result<Group, String> {
    let group = Group {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        created_at: now_iso(),
    };

    let mut data = state.data.lock().map_err(|e| e.to_string())?;
    data.groups.push(group.clone());
    save_data(&data)?;
    Ok(group)
}

#[tauri::command]
fn assign_group(video_id: String, group_id: Option<String>, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut data = state.data.lock().map_err(|e| e.to_string())?;
    if let Some(video) = data.videos.iter_mut().find(|v| v.id == video_id) {
        video.group_id = group_id;
    }
    save_data(&data)?;
    Ok(())
}

#[tauri::command]
fn rename_video(video_id: String, name: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut data = state.data.lock().map_err(|e| e.to_string())?;
    if let Some(video) = data.videos.iter_mut().find(|v| v.id == video_id) {
        video.name = name;
    }
    save_data(&data)?;
    Ok(())
}

#[tauri::command]
fn rename_group(group_id: String, name: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut data = state.data.lock().map_err(|e| e.to_string())?;
    if let Some(group) = data.groups.iter_mut().find(|g| g.id == group_id) {
        group.name = name;
    }
    save_data(&data)?;
    Ok(())
}

#[tauri::command]
fn delete_video(video_id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut data = state.data.lock().map_err(|e| e.to_string())?;

    // Clean up files
    let _ = fs::remove_file(transcripts_dir().join(format!("{}.txt", video_id)));
    let _ = fs::remove_file(transcripts_dir().join(format!("{}.srt", video_id)));
    let _ = fs::remove_file(thumbnails_dir().join(format!("{}.jpg", video_id)));

    data.videos.retain(|v| v.id != video_id);
    save_data(&data)?;
    Ok(())
}

#[tauri::command]
fn delete_group(group_id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut data = state.data.lock().map_err(|e| e.to_string())?;

    // Unassign all videos from this group
    for video in data.videos.iter_mut() {
        if video.group_id.as_deref() == Some(&group_id) {
            video.group_id = None;
        }
    }

    data.groups.retain(|g| g.id != group_id);
    save_data(&data)?;
    Ok(())
}

// ── Updater Commands ─────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct UpdateCheckResult {
    pub available: bool,
    pub version: Option<String>,
    pub current_version: Option<String>,
    pub body: Option<String>,
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateCheckResult, String> {
    let updater = app
        .updater_builder()
        .build()
        .map_err(|e| e.to_string())?;

    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateCheckResult {
            available: true,
            version: Some(update.version.clone()),
            current_version: Some(update.current_version.clone()),
            body: update.body.clone(),
        }),
        Ok(None) => Ok(UpdateCheckResult {
            available: false,
            version: None,
            current_version: None,
            body: None,
        }),
        Err(e) => {
            log::warn!("Update check failed: {}", e);
            // Return no-update rather than propagating network errors
            Ok(UpdateCheckResult {
                available: false,
                version: None,
                current_version: None,
                body: None,
            })
        }
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app
        .updater_builder()
        .build()
        .map_err(|e| e.to_string())?;

    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_chunk, _total| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    }
    Ok(())
}

#[tauri::command]
fn get_data_path() -> String {
    data_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn open_in_finder(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open: {}", e))?;
    Ok(())
}

#[tauri::command]
fn check_dependencies() -> Result<serde_json::Value, String> {
    let ffmpeg = Command::new(&find_binary("ffmpeg")).arg("-version").output().is_ok();
    let ffprobe_bin = find_binary("ffprobe");
    let ffprobe = std::path::Path::new(&ffprobe_bin).exists() && ffprobe_bin != "ffprobe";

    let whisper_bin = find_binary("whisper-cli");
    let whisper_cpp = std::path::Path::new(&whisper_bin).exists() && whisper_bin != "whisper-cli";

    let whisper_py_bin = find_binary("whisper");
    let whisper_py = std::path::Path::new(&whisper_py_bin).exists() && whisper_py_bin != "whisper";

    Ok(serde_json::json!({
        "ffmpeg": ffmpeg,
        "ffprobe": ffprobe,
        "whisper_cpp": whisper_cpp,
        "whisper_python": whisper_py,
        "engine": if whisper_cpp { "whisper.cpp (Metal GPU)" } else if whisper_py { "Python Whisper" } else { "None" }
    }))
}

// ── App Entry ────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    ensure_dirs();

    // Reset any stuck "transcribing"/"extracting" videos from previous crashes
    let mut initial_data = load_data();
    let mut had_stuck = false;
    for video in initial_data.videos.iter_mut() {
        if video.status == "transcribing" || video.status == "extracting" {
            video.status = "pending".to_string();
            video.error_message = Some("Interrupted — ready to retry".to_string());
            had_stuck = true;
        }
    }
    if had_stuck {
        let _ = save_data(&initial_data);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            data: Mutex::new(initial_data),
        })
        .invoke_handler(tauri::generate_handler![
            get_all_data,
            import_video,
            start_transcription,
            create_group,
            assign_group,
            rename_video,
            rename_group,
            delete_video,
            delete_group,
            get_data_path,
            open_in_finder,
            check_dependencies,
            check_for_updates,
            install_update,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            log::error!("Failed to start ShipTranscript: {}", e);
            std::process::exit(1);
        });
}
