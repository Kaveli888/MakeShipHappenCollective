/**
 * Editor toolbar — the Apple Notes control strip: paragraph styles + B/I/U/S
 * (Aa popover), checklist, table, and the attachment menu (photo/video,
 * record audio, attach file). Pure UI; every action funnels into commands.ts
 * or back up to the Notepad host.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  type BlockStyle,
  blockStyleAt,
  insertTable,
  setBlockStyle,
  setListStyle,
  toggleBold,
  toggleHighlight,
  toggleItalic,
  toggleStrike,
  toggleUnderline,
} from "./commands";

export type NoteFont = "system" | "serif" | "mono";

export interface EditorToolbarProps {
  /** Live editor view, or null when no note is open. */
  getView: () => EditorView | null;
  disabled: boolean;
  font: NoteFont;
  onFontChange: (font: NoteFont) => void;
  /** Open the host's file picker (accept = input accept string). */
  onPickFiles: (accept: string) => void;
  /** A finished audio recording, ready to attach. */
  onRecorded: (blob: Blob) => void;
}

type Popover = null | "format" | "attach";

export function EditorToolbar({
  getView,
  disabled,
  font,
  onFontChange,
  onPickFiles,
  onRecorded,
}: EditorToolbarProps) {
  const [open, setOpen] = useState<Popover>(null);
  const [activeStyle, setActiveStyle] = useState<BlockStyle>("body");
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = useCallback(
    (fn: (view: EditorView) => unknown, close = false) => {
      const view = getView();
      if (view) fn(view);
      if (close) setOpen(null);
    },
    [getView],
  );

  const toggleFormatMenu = useCallback(() => {
    setOpen((prev) => {
      if (prev === "format") return null;
      const view = getView();
      if (view) setActiveStyle(blockStyleAt(view));
      return "format";
    });
  }, [getView]);

  const styleItem = (style: BlockStyle, label: string, cls: string) => (
    <button
      key={style}
      className={`smui-menu-item smui-style-${cls}`}
      onClick={() => {
        setActiveStyle(style);
        run((v) => setBlockStyle(v, style), true);
      }}
    >
      <span className="smui-menu-check">{activeStyle === style ? "✓" : ""}</span>
      {label}
    </button>
  );

  return (
    <div className="smui-toolbar" ref={rootRef}>
      <div className="smui-toolbar-group">
        <button
          className={`smui-tool-btn${open === "format" ? " is-open" : ""}`}
          title="Format"
          disabled={disabled}
          onClick={toggleFormatMenu}
        >
          Aa
        </button>
        <button
          className="smui-tool-btn"
          title="Checklist"
          disabled={disabled}
          onClick={() => run((v) => setListStyle(v, "check"))}
        >
          ☑︎
        </button>
        <button
          className="smui-tool-btn"
          title="Table"
          disabled={disabled}
          onClick={() => run(insertTable)}
        >
          ⊞
        </button>
        <button
          className={`smui-tool-btn${open === "attach" ? " is-open" : ""}`}
          title="Attach"
          disabled={disabled}
          onClick={() => setOpen((p) => (p === "attach" ? null : "attach"))}
        >
          📎
        </button>
      </div>

      {open === "format" && (
        <div className="smui-popover smui-popover-format">
          <div className="smui-inline-row">
            <button title="Bold (⌘B)" style={{ fontWeight: 700 }} onClick={() => run(toggleBold)}>B</button>
            <button title="Italic (⌘I)" style={{ fontStyle: "italic" }} onClick={() => run(toggleItalic)}>I</button>
            <button title="Underline (⌘U)" style={{ textDecoration: "underline" }} onClick={() => run(toggleUnderline)}>U</button>
            <button title="Strikethrough (⇧⌘X)" style={{ textDecoration: "line-through" }} onClick={() => run(toggleStrike)}>S</button>
            <button title="Highlight (⇧⌘H)" className="smui-highlight-btn" onClick={() => run(toggleHighlight)}>✎</button>
          </div>
          <div className="smui-menu-sep" />
          {styleItem("title", "Title", "title")}
          {styleItem("heading", "Heading", "heading")}
          {styleItem("subheading", "Subheading", "subheading")}
          {styleItem("body", "Body", "body")}
          {styleItem("mono", "Monostyled", "mono")}
          <div className="smui-menu-sep" />
          <button className="smui-menu-item" onClick={() => run((v) => setListStyle(v, "bullet"), true)}>
            <span className="smui-menu-check" />• Bulleted List
          </button>
          <button className="smui-menu-item" onClick={() => run((v) => setListStyle(v, "dash"), true)}>
            <span className="smui-menu-check" />– Dashed List
          </button>
          <button className="smui-menu-item" onClick={() => run((v) => setListStyle(v, "number"), true)}>
            <span className="smui-menu-check" />1. Numbered List
          </button>
          <div className="smui-menu-sep" />
          <button className="smui-menu-item" onClick={() => run((v) => setListStyle(v, "quote"), true)}>
            <span className="smui-menu-check" />❙ Block Quote
          </button>
          <div className="smui-menu-sep" />
          <div className="smui-font-row">
            {(["system", "serif", "mono"] as const).map((f) => (
              <button
                key={f}
                className={`smui-font-chip smui-font-chip-${f}${font === f ? " is-on" : ""}`}
                onClick={() => onFontChange(f)}
              >
                {f === "system" ? "Aa" : f === "serif" ? "Se" : "Mo"}
              </button>
            ))}
          </div>
        </div>
      )}

      {open === "attach" && (
        <AttachMenu
          onPickFiles={(accept) => {
            setOpen(null);
            onPickFiles(accept);
          }}
          onRecorded={(blob) => {
            setOpen(null);
            onRecorded(blob);
          }}
        />
      )}
    </div>
  );
}

// ── attach popover ─────────────────────────────────────────────────────────

function AttachMenu({
  onPickFiles,
  onRecorded,
}: {
  onPickFiles: (accept: string) => void;
  onRecorded: (blob: Blob) => void;
}) {
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (!recorder) return;
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [recorder]);

  // Stop tracks if the popover unmounts mid-recording.
  useEffect(
    () => () => {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorder?.stream.getTracks().forEach((t) => t.stop());
    },
    [recorder],
  );

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        if (blob.size) onRecorded(blob);
      };
      rec.start();
      setElapsed(0);
      setRecorder(rec);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone unavailable");
    }
  };

  const stopRecording = () => {
    recorder?.stop();
    setRecorder(null);
  };

  const mm = String(Math.floor(elapsed / 60));
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="smui-popover smui-popover-attach">
      <button
        className="smui-menu-item"
        onClick={() => onPickFiles("image/*,video/*")}
      >
        <span className="smui-menu-icon">🌄</span>Choose Photo or Video
      </button>
      {recorder ? (
        <button className="smui-menu-item is-recording" onClick={stopRecording}>
          <span className="smui-menu-icon smui-rec-dot">●</span>
          Stop Recording&nbsp;
          <span className="smui-rec-time">
            {mm}:{ss}
          </span>
        </button>
      ) : (
        <button className="smui-menu-item" onClick={() => void startRecording()}>
          <span className="smui-menu-icon">🎙️</span>Record Audio
        </button>
      )}
      <button className="smui-menu-item" onClick={() => onPickFiles("*/*")}>
        <span className="smui-menu-icon">📄</span>Attach File
      </button>
      {error && <div className="smui-menu-error">{error}</div>}
    </div>
  );
}
