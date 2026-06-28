// ShipMemory is deliberately an empty shell: ALL memory logic lives in
// @ship-memory/core (TS) running in the webview, doing file I/O through
// tauri-plugin-fs. The Rust side only grants scoped fs access — keeping the
// core engine the single owner of the vault, same as the MCP server.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running ShipMemory");
}
