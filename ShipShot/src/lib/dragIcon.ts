// macOS draws the drag ghost at the icon's native size, so handing the native drag session
// a full-resolution capture produced a ghost as large as the screenshot itself — it covered
// the drop target and the floating stack. Everything that starts a drag goes through here.

export const DRAG_ICON_WIDTH = 200;
const DRAG_ICON_HEIGHT = 125;

function scaledDataUrl(source: CanvasImageSource, width: number, height: number): string | null {
  const scale = Math.min(1, DRAG_ICON_WIDTH / (width || DRAG_ICON_WIDTH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((width || DRAG_ICON_WIDTH) * scale));
  canvas.height = Math.max(1, Math.round((height || DRAG_ICON_HEIGHT) * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/** A labelled card for captures with no usable preview — recordings, or a failed decode. */
export function placeholderDragIcon(): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = DRAG_ICON_WIDTH;
  canvas.height = DRAG_ICON_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#1b1d21";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,.32)";
  context.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  context.fillStyle = "#f3ad3c";
  context.font = "600 13px -apple-system, sans-serif";
  context.textAlign = "center";
  context.fillText("ShipShot capture", canvas.width / 2, canvas.height / 2 + 4);
  return canvas.toDataURL("image/png");
}

/** Thumbnail from an already-rendered canvas (the annotation editor's stage). */
export function dragIconFromCanvas(canvas: HTMLCanvasElement | null): string | null {
  if (!canvas) return null;
  return scaledDataUrl(canvas, canvas.width, canvas.height);
}

/**
 * Thumbnail from an <img> the page has already decoded. Building the ghost from a fresh
 * `new Image()` meant a second full-resolution PNG decode at the instant the gesture began —
 * hundreds of milliseconds of stall between "moved 6px" and the drag session opening.
 */
export function dragIconFromImage(image: HTMLImageElement): string | null {
  if (!image.naturalWidth) return null;
  return scaledDataUrl(image, image.naturalWidth, image.naturalHeight);
}
