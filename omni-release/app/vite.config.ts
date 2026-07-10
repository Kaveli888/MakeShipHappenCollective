import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port and no clobbering of the terminal.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    // 1430 — unique to Omni Release. The Ship ecosystem owns 1420 (ShipSpace)
    // and 1421 (ShipWatch); colliding there loads the wrong app into our window.
    // PORT env override lets a second instance (browser preview) coexist with
    // the Tauri-owned one on 1430.
    port: Number(process.env.PORT) || 1430,
    strictPort: true,
  },
});
