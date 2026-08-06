import { Channel, invoke } from "@tauri-apps/api/core";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import type { PendingCapture } from "../types";

export type CaptureDragResult = "Dropped" | "Cancelled";

export interface CaptureDragEvent {
  result: CaptureDragResult;
  cursorPos: { x: number; y: number };
}

/**
 * Starts a native drag with the richest payload the capture can provide.
 *
 * A plain file URL works for Finder and upload controls, but many rich-text editors ask
 * macOS for image bytes instead. The native image path advertises both public.png and
 * public.file-url on the same pasteboard item so one gesture works in either destination.
 */
export async function startCaptureDrag(
  capture: PendingCapture,
  icon: string,
  onEvent: (event: CaptureDragEvent) => void,
): Promise<void> {
  if (capture.mediaType !== "image") {
    await startDrag(
      { item: [capture.path], icon, mode: "copy" },
      ({ result, cursorPos }) => onEvent({
        result: result === "Dropped" ? "Dropped" : "Cancelled",
        cursorPos: { x: Number(cursorPos.x), y: Number(cursorPos.y) },
      }),
    );
    return;
  }

  const onEventChannel = new Channel<{ result: "Dropped" | "Cancelled"; cursorPos: { x: number; y: number } }>();
  onEventChannel.onmessage = onEvent;
  await invoke("start_pending_image_drag", {
    id: capture.id,
    image: icon,
    onEvent: onEventChannel,
  });
}
