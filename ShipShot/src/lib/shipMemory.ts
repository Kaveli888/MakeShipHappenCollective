import { ShipMemory, type Memory } from "@ship-memory/core";
import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";
import type { Capture } from "../types";
import { tauriFs } from "./tauriFs";

interface MemoryAttachment {
  name: string;
  relPath: string;
}

export async function rememberCapture(capture: Capture): Promise<Memory> {
  const root = await join(await homeDir(), "ShipMemory");
  const memory = await ShipMemory.create(root, tauriFs);
  // Rust performs a streaming filesystem copy so long recordings never need
  // to be materialized as a giant Uint8Array inside the webview.
  const attachment = await invoke<MemoryAttachment>("copy_capture_to_memory", { id: capture.id });
  const capturedAt = new Date(capture.createdAt);
  const title = `ShipShot — ${capturedAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} at ${capturedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;

  const media = capture.mediaType === "image"
    ? `![${title}](${attachment.relPath})`
    : `[Open screen recording](${attachment.relPath})`;

  return memory.create({
    title,
    frontmatter: {
      type: "capture",
      source: "shipshot",
      sourceId: capture.id,
      capturedAt: capture.createdAt,
      captureMode: capture.mode,
      mediaType: capture.mediaType,
      dimensions: capture.width && capture.height ? `${capture.width}x${capture.height}` : undefined,
      tags: ["shipshot", "capture", capture.mode],
    },
    body: `${media}\n\n## Context\n\nCaptured with ShipShot and saved automatically to Ship Memory.\n`,
  });
}
