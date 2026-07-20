export type CaptureMode = "area" | "window" | "fullscreen" | "recording";

export interface Capture {
  id: string;
  filename: string;
  path: string;
  mediaType: "image" | "video";
  mode: CaptureMode;
  createdAt: string;
  width: number;
  height: number;
  fileSize: number;
  remembered: boolean;
  memorySlug?: string | null;
}

export interface PendingCapture {
  id: string;
  filename: string;
  path: string;
  mediaType: "image" | "video";
  mode: CaptureMode;
  createdAt: string;
  width: number;
  height: number;
  fileSize: number;
}

export type View = "capture" | "library" | "memory" | "shortcuts" | "settings";

export interface ShortcutBinding {
  mode: CaptureMode;
  label: string;
  shortcut: string;
}
