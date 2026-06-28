import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port 1440 — ShipSpace dev owns 1420, sandbox 1430, ShipMind 1422.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1440,
    strictPort: true,
  },
  optimizeDeps: {
    // Workspace-linked source packages — let Vite transform them directly.
    exclude: ["@ship-memory/ui", "@ship-memory/core"],
  },
  build: {
    target: "es2022",
  },
});
