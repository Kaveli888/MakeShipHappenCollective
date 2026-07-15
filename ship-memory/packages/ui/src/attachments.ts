/**
 * Inline attachment previews for the markdown editor.
 *
 * Notes reference attachments with ordinary markdown links —
 * `![photo](attachments/photo.png)` — and this extension renders the media
 * (image / audio / video) as a block widget under the line, Apple-Notes
 * style. Bytes come through the host-provided loader (the engine), get
 * wrapped in a Blob URL once, and are cached for the editor's lifetime.
 */

import { StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";

export type AttachmentKind = "image" | "audio" | "video" | "file";

const EXT_KIND: Record<string, AttachmentKind> = {
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  heic: "image", svg: "image", bmp: "image",
  mp3: "audio", m4a: "audio", wav: "audio", ogg: "audio", opus: "audio",
  aac: "audio", flac: "audio", weba: "audio", aif: "audio", aiff: "audio",
  caf: "audio",
  mp4: "video", mov: "video", webm: "video", mkv: "video", m4v: "video",
};

const EXT_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", heic: "image/heic", svg: "image/svg+xml", bmp: "image/bmp",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg",
  opus: "audio/ogg", aac: "audio/aac", flac: "audio/flac", weba: "audio/webm",
  aif: "audio/aiff", aiff: "audio/aiff", caf: "audio/x-caf",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/mp4",
};

function extOf(name: string): string {
  return (name.split(".").pop() ?? "").toLowerCase();
}

export function attachmentKind(name: string): AttachmentKind {
  // webm is ambiguous; recordings from the notepad are audio.
  const ext = extOf(name);
  if (ext === "webm" && /recording/i.test(name)) return "audio";
  return EXT_KIND[ext] ?? "file";
}

export function attachmentMime(name: string): string {
  return EXT_MIME[extOf(name)] ?? "application/octet-stream";
}

/** Host hook: hub-relative path → raw bytes. */
export type AttachmentLoader = (relPath: string) => Promise<Uint8Array>;

/** An attachment already copied into the hub by the host application. */
export interface SavedAttachment {
  name: string;
  relPath: string;
}

/**
 * Native desktop drops arrive as filesystem paths instead of browser Files.
 * The host imports those paths into the hub and returns link-ready metadata.
 */
export type AttachmentPathImporter = (
  paths: string[],
) => Promise<SavedAttachment[]>;

/** A click on a media preview asking for the big view. */
export interface AttachmentOpenRequest {
  relPath: string;
  name: string;
  kind: "image" | "video";
}

/**
 * Host hook: open an attachment large. Return true if handled (e.g. the
 * Tauri shell opened a dedicated viewer window); return false to fall back
 * to the built-in in-page lightbox (browser/embed hosts).
 */
export type AttachmentOpener = (req: AttachmentOpenRequest) => boolean;

const LINK_RE = /!?\[[^\]\n]*\]\((attachments\/[^)\s]+)\)/g;

/**
 * Quick-Look-style overlay: image or video blown up over a dimmed backdrop.
 * Closes on Esc, backdrop click, or the ✕ button. One at a time.
 */
function openLightbox(url: string, name: string, kind: "image" | "video"): void {
  document.querySelector(".smui-lightbox")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "smui-lightbox";

  let media: HTMLImageElement | HTMLVideoElement;
  if (kind === "image") {
    media = document.createElement("img");
    media.alt = name;
  } else {
    media = document.createElement("video");
    media.controls = true;
    media.autoplay = true;
  }
  media.className = "smui-lightbox-media";
  media.src = url;

  const caption = document.createElement("div");
  caption.className = "smui-lightbox-caption";
  caption.textContent = name;

  const closeBtn = document.createElement("button");
  closeBtn.className = "smui-lightbox-close";
  closeBtn.title = "Close (Esc)";
  closeBtn.textContent = "✕";

  const close = () => {
    if (media instanceof HTMLVideoElement) media.pause();
    window.removeEventListener("keydown", onKey, true);
    overlay.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener("keydown", onKey, true);

  overlay.append(closeBtn, media, caption);
  document.body.appendChild(overlay);
}

class MediaWidget extends WidgetType {
  constructor(
    private readonly relPath: string,
    private readonly kind: Exclude<AttachmentKind, "file">,
    private readonly resolve: (relPath: string) => Promise<string>,
    private readonly onOpen: AttachmentOpener | undefined,
  ) {
    super();
  }

  /** Host viewer first; in-page lightbox when no host claims it. */
  private openLarge(url: string, name: string, kind: "image" | "video"): void {
    if (this.onOpen?.({ relPath: this.relPath, name, kind })) return;
    openLightbox(url, name, kind);
  }

  override eq(other: MediaWidget): boolean {
    return other.relPath === this.relPath && other.kind === this.kind;
  }

  override toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = `smui-attachment smui-attachment-${this.kind}`;
    const name = this.relPath.split("/").pop() ?? this.relPath;
    this.resolve(this.relPath).then(
      (url) => {
        if (this.kind === "image") {
          const img = document.createElement("img");
          img.src = url;
          img.alt = name;
          img.title = "Click to enlarge";
          img.className = "smui-attachment-zoomable";
          img.addEventListener("click", () => this.openLarge(url, name, "image"));
          wrap.replaceChildren(img);
        } else if (this.kind === "audio") {
          const audio = document.createElement("audio");
          audio.controls = true;
          audio.src = url;
          wrap.replaceChildren(audio);
        } else {
          const video = document.createElement("video");
          video.controls = true;
          video.src = url;
          const box = document.createElement("div");
          box.className = "smui-media-box";
          const expand = document.createElement("button");
          expand.className = "smui-expand-btn";
          expand.title = "Open large";
          expand.textContent = "⤢";
          expand.addEventListener("click", () => {
            video.pause();
            this.openLarge(url, name, "video");
          });
          box.append(video, expand);
          wrap.replaceChildren(box);
        }
      },
      () => {
        wrap.classList.add("is-missing");
        wrap.textContent = `⚠︎ missing: ${this.relPath}`;
      },
    );
    return wrap;
  }

  override ignoreEvent(): boolean {
    return true; // let <audio>/<video> controls receive clicks
  }
}

/**
 * Editor extension rendering attachment previews. Block widgets must come
 * from a StateField (not a ViewPlugin), so we scan the whole doc — notes are
 * small and the scan is a single regex pass.
 */
export function attachmentPreviews(
  load: AttachmentLoader,
  onOpen?: AttachmentOpener,
): Extension {
  const urls = new Map<string, Promise<string>>();
  const resolve = (relPath: string): Promise<string> => {
    let p = urls.get(relPath);
    if (!p) {
      p = load(relPath).then((bytes) =>
        URL.createObjectURL(
          new Blob([bytes as BlobPart], { type: attachmentMime(relPath) }),
        ),
      );
      urls.set(relPath, p);
    }
    return p;
  };

  function build(state: EditorState): DecorationSet {
    const widgets: Range<Decoration>[] = [];
    const text = state.doc.toString();
    LINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_RE.exec(text))) {
      let relPath: string;
      try {
        relPath = decodeURI(m[1]);
      } catch {
        continue;
      }
      const kind = attachmentKind(relPath);
      if (kind === "file") continue;
      const line = state.doc.lineAt(m.index + m[0].length);
      widgets.push(
        Decoration.widget({
          widget: new MediaWidget(relPath, kind, resolve, onOpen),
          block: true,
          side: 1,
        }).range(line.to),
      );
    }
    return Decoration.set(widgets, true);
  }

  return StateField.define<DecorationSet>({
    create: build,
    update: (deco, tr) => (tr.docChanged ? build(tr.state) : deco),
    provide: (f) => EditorView.decorations.from(f),
  });
}
