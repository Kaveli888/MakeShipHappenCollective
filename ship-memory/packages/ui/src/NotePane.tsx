import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import type { MemoryMeta, ShipMemory } from "@ship-memory/core";
import { MarkdownEditor } from "./MarkdownEditor.js";
import { EditorToolbar, type NoteFont } from "./EditorToolbar.js";
import {
  attachmentKind,
  attachmentPreviews,
  type AttachmentOpener,
} from "./attachments.js";
import { insertAtCursor } from "./commands.js";
import { formatFullDate } from "./dates.js";
import { folderOf } from "./FolderSidebar.js";
import { IconArrowLeft, IconArrowRight } from "./icons.js";

/**
 * One note tab — the full editing pane (header with back/forward +
 * breadcrumb, toolbar, CodeMirror, attachments) with its own load/autosave
 * lifecycle. Panes stay mounted while their tab is in the background
 * (display:none), so editor state and pending saves survive tab switches.
 */

export interface NotePaneProps {
  engine: ShipMemory;
  /** Slug to show, or null for an empty "New tab". */
  slug: string | null;
  /** List meta for the slug (breadcrumb, date, font) — null while unknown. */
  meta: MemoryMeta | null;
  /** Bumped by the host's fs watcher when the vault changed on disk. */
  vaultVersion: number;
  visible: boolean;
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  /** A save hit disk — host refreshes the notes list. */
  onSaved: () => void;
  /** Bumped by the host (File ▸ Save Session, ⌘S) — force-flush pending edits. */
  saveSignal?: number;
  /**
   * Host viewer for image/video attachments (e.g. a separate Tauri window).
   * Return true if handled; false/absent falls back to the in-page lightbox.
   */
  onOpenAttachment?: AttachmentOpener;
  /**
   * Only this slug's editor grabs focus when it loads (new note, daily
   * note). List navigation keeps focus in the list — Apple Notes style —
   * so ⇧↑/⇧↓ mass selection keeps working after a note opens.
   */
  autoFocusSlug?: string | null;
}

interface Loaded {
  slug: string;
  body: string;
  /** Editor remount stamp — bumped only when disk content must replace the editor. */
  stamp: number;
}

function bodyWithTitle(body: string, title: string): string {
  const clean = title.trim();
  if (!clean) return body;
  if (/^#\s+.*$/m.test(body)) return body.replace(/^#\s+.*$/m, `# ${clean}`);
  return `# ${clean}\n\n${body.trim()}\n`;
}

export function NotePane({
  engine,
  slug,
  meta,
  vaultVersion,
  visible,
  canBack,
  canForward,
  onBack,
  onForward,
  onSaved,
  saveSignal = 0,
  onOpenAttachment,
  autoFocusSlug = null,
}: NotePaneProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [titleDraft, setTitleDraft] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const dirtyRef = useRef(false);
  const editorTextRef = useRef(""); // live editor content
  const diskBodyRef = useRef(""); // what we believe the file holds
  const saveTimerRef = useRef<number | undefined>(undefined);
  const loadedRef = useRef<Loaded | null>(null);
  loadedRef.current = loaded;
  const viewRef = useRef<EditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<(files: File[]) => void>(() => {});
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const openAttachmentRef = useRef(onOpenAttachment);
  openAttachmentRef.current = onOpenAttachment;

  useEffect(() => {
    if (!isEditingTitle) setTitleDraft(meta?.title ?? "");
  }, [isEditingTitle, meta?.title]);

  const save = useCallback(
    async (noteSlug: string, text: string) => {
      setSaveState("saving");
      try {
        const updated = await engine.update(noteSlug, text);
        diskBodyRef.current = updated.body;
        // First H1 is the note's name (iOS Notes' first-line-is-title rule) —
        // keep frontmatter.title in sync so lists and wikilinks agree.
        const h1 = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
        if (h1 && h1 !== updated.title) {
          const after = await engine.setFrontmatter(noteSlug, { title: h1 });
          diskBodyRef.current = after.body;
        }
        if (editorTextRef.current === text) dirtyRef.current = false;
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
      onSavedRef.current();
    },
    [engine],
  );

  const flushPendingSave = useCallback(async () => {
    window.clearTimeout(saveTimerRef.current);
    const current = loadedRef.current;
    if (current && dirtyRef.current) {
      await save(current.slug, editorTextRef.current);
    }
  }, [save]);

  // Navigation within the tab: flush the outgoing note, load the incoming one.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await flushPendingSave();
      if (cancelled) return;
      if (!slug) {
        dirtyRef.current = false;
        setLoaded(null);
        return;
      }
      if (loadedRef.current?.slug === slug) return;
      try {
        const m = await engine.read(slug);
        if (cancelled) return;
        dirtyRef.current = false;
        editorTextRef.current = m.body;
        diskBodyRef.current = m.body;
        setLoaded({ slug, body: m.body, stamp: Date.now() });
      } catch {
        if (!cancelled) setLoaded(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // flushPendingSave is stable per engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, engine]);

  // External changes (ShipSpace, agents, Obsidian) → reload when clean.
  useEffect(() => {
    if (!vaultVersion) return;
    void (async () => {
      const current = loadedRef.current;
      if (!current || dirtyRef.current) return;
      try {
        const m = await engine.read(current.slug);
        if (m.body !== diskBodyRef.current) {
          editorTextRef.current = m.body;
          diskBodyRef.current = m.body;
          setLoaded({ slug: current.slug, body: m.body, stamp: Date.now() });
        }
      } catch {
        setLoaded(null); // note deleted externally
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultVersion]);

  const onEditorChange = useCallback(
    (text: string) => {
      editorTextRef.current = text;
      dirtyRef.current = true;
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        const current = loadedRef.current;
        if (current) void save(current.slug, editorTextRef.current);
      }, 500);
    },
    [save],
  );

  // Autosave floor: the debounce above resets on every keystroke, so an
  // uninterrupted typing streak could stay dirty indefinitely — this puts
  // dirty notes on disk at least once a minute no matter what.
  useEffect(() => {
    const id = window.setInterval(() => void flushPendingSave(), 60_000);
    return () => window.clearInterval(id);
  }, [flushPendingSave]);

  // File ▸ Save Session / ⌘S — host bumps saveSignal to force a flush now.
  useEffect(() => {
    if (saveSignal) void flushPendingSave();
  }, [saveSignal, flushPendingSave]);

  // Flush unsaved edits if the window closes mid-debounce.
  useEffect(() => {
    const onBlurOrClose = () => void flushPendingSave();
    window.addEventListener("blur", onBlurOrClose);
    window.addEventListener("beforeunload", onBlurOrClose);
    return () => {
      window.removeEventListener("blur", onBlurOrClose);
      window.removeEventListener("beforeunload", onBlurOrClose);
      void flushPendingSave(); // tab closed with pending edits
    };
  }, [flushPendingSave]);

  // ── attachments ──────────────────────────────────────────────────────────

  // Save files into <hub>/attachments/ and link them at the cursor. Media
  // gets the `!` image-link form so the preview widget renders it inline.
  const attachFiles = useCallback(
    async (files: File[]) => {
      const view = viewRef.current;
      if (!view || !loadedRef.current || !files.length) return;
      const parts: string[] = [];
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const { name, relPath } = await engine.saveAttachment(f.name, bytes);
        const bang = attachmentKind(relPath) === "file" ? "" : "!";
        parts.push(`${bang}[${name}](${relPath})`);
      }
      insertAtCursor(view, parts.join("\n") + "\n");
    },
    [engine],
  );
  attachRef.current = (files) => void attachFiles(files);

  const pickFiles = useCallback((accept: string) => {
    const el = fileInputRef.current;
    if (!el) return;
    el.accept = accept === "*/*" ? "" : accept;
    el.click();
  }, []);

  const onRecorded = useCallback(
    (blob: Blob) => {
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      void attachFiles([
        new File([blob], `Recording ${stamp}.${ext}`, { type: blob.type }),
      ]);
    },
    [attachFiles],
  );

  // Inline previews + paste/drop-to-attach, recreated only per engine.
  const editorExtensions = useMemo(
    () => [
      attachmentPreviews(
        (rel) => engine.readAttachment(rel),
        (req) => openAttachmentRef.current?.(req) ?? false,
      ),
      EditorView.domEventHandlers({
        paste: (e) => {
          const files = Array.from(e.clipboardData?.files ?? []);
          if (!files.length) return false;
          e.preventDefault();
          attachRef.current(files);
          return true;
        },
        drop: (e) => {
          const files = Array.from(e.dataTransfer?.files ?? []);
          if (!files.length) return false;
          e.preventDefault();
          attachRef.current(files);
          return true;
        },
      }),
    ],
    [engine],
  );

  const changeFont = useCallback(
    async (f: NoteFont) => {
      const current = loadedRef.current;
      if (!current) return;
      await engine.setFrontmatter(current.slug, {
        font: f === "system" ? undefined : f,
      });
      onSavedRef.current();
    },
    [engine],
  );

  const commitTitle = useCallback(async () => {
    const current = loadedRef.current;
    if (!current || !meta) return;
    const title = titleDraft.trim();
    if (!title || title === meta.title) {
      setTitleDraft(meta.title);
      setIsEditingTitle(false);
      return;
    }
    window.clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    try {
      const nextBody = bodyWithTitle(editorTextRef.current, title);
      await engine.setFrontmatter(current.slug, { title });
      const updated = await engine.update(current.slug, nextBody);
      editorTextRef.current = updated.body;
      diskBodyRef.current = updated.body;
      dirtyRef.current = false;
      setLoaded({ slug: current.slug, body: updated.body, stamp: Date.now() });
      setSaveState("saved");
      onSavedRef.current();
    } catch {
      setSaveState("idle");
    }
    setIsEditingTitle(false);
  }, [engine, meta, titleDraft]);

  const rawFont = meta?.frontmatter.font;
  const font: NoteFont =
    rawFont === "serif" || rawFont === "mono" ? rawFont : "system";

  // Obsidian-style breadcrumb: folder path segments, then the note title.
  const crumbs = meta
    ? [...(folderOf(meta)?.split("/") ?? []), meta.title]
    : loaded
      ? [loaded.slug]
      : ["New tab"];

  return (
    <div
      className={`smui-pane smui-font-${font}`}
      style={visible ? undefined : { display: "none" }}
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        if (e.defaultPrevented) return; // editor's own drop handler took it
        const files = Array.from(e.dataTransfer.files);
        if (!files.length) return;
        e.preventDefault();
        attachRef.current(files);
      }}
    >
      <div className="smui-pane-header">
        <div className="smui-pane-nav">
          <button
            className="smui-chrome-btn"
            title="Back"
            disabled={!canBack}
            onClick={onBack}
          >
            <IconArrowLeft />
          </button>
          <button
            className="smui-chrome-btn"
            title="Forward"
            disabled={!canForward}
            onClick={onForward}
          >
            <IconArrowRight />
          </button>
        </div>
        <div className="smui-breadcrumb" title={crumbs.join(" / ")}>
          {crumbs.map((c, i) => (
            <span key={i} className="smui-crumb-wrap">
              {i > 0 && <span className="smui-crumb-sep">/</span>}
              {meta && loaded && i === crumbs.length - 1 ? (
                <input
                  className="smui-title-input"
                  value={titleDraft}
                  aria-label="Note title"
                  onFocus={(e) => {
                    setIsEditingTitle(true);
                    e.currentTarget.select();
                  }}
                  onChange={(e) => setTitleDraft(e.currentTarget.value)}
                  onBlur={() => void commitTitle()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    } else if (e.key === "Escape") {
                      setTitleDraft(meta.title);
                      setIsEditingTitle(false);
                      e.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <span className="smui-crumb">{c}</span>
              )}
            </span>
          ))}
        </div>
        <div className="smui-pane-aux">
          {saveState === "saving" ? "Saving…" : ""}
        </div>
      </div>
      <EditorToolbar
        getView={() => viewRef.current}
        disabled={!loaded}
        font={font}
        onFontChange={(f) => void changeFont(f)}
        onPickFiles={pickFiles}
        onRecorded={onRecorded}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = "";
          if (files.length) attachRef.current(files);
        }}
      />
      {loaded ? (
        <>
          {meta && (
            <div className="smui-note-date">{formatFullDate(meta.modified)}</div>
          )}
          <MarkdownEditor
            key={`${loaded.slug}:${loaded.stamp}`}
            initialDoc={loaded.body}
            onChange={onEditorChange}
            autoFocus={visible && loaded.slug === autoFocusSlug}
            extensions={editorExtensions}
            onViewReady={(v) => {
              viewRef.current = v;
            }}
          />
        </>
      ) : (
        <div className="smui-empty">
          <p>No file is open</p>
          <p className="smui-empty-hint">
            Pick a note from the list, or ⌘N for a new one
          </p>
        </div>
      )}
    </div>
  );
}
