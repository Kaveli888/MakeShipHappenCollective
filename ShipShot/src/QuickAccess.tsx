import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { Copy, Download, Film, Pencil, Pin, PinOff, X } from "lucide-react";
import { dragIconFromImage, placeholderDragIcon } from "./lib/dragIcon";
import { rememberCapture } from "./lib/shipMemory";
import type { Capture, PendingCapture } from "./types";

type Notice = {
  id: string;
  tone: "success" | "error" | "neutral";
  message: string;
} | null;

// A press has to travel this far before it counts as a drag. Without it a plain click
// opened a native drag session that ended on ShipShot's own window.
const DRAG_THRESHOLD_PX = 6;
// Backstop in case the drag callback never fires, so the stack can't stay frozen.
const DRAG_BUSY_TIMEOUT_MS = 20000;
// Off by default: the stack stays where it lands, and every pixel of the card — including
// the top strip — drags the capture out into whatever you drop it on. Settings flips it.
const STACK_MOVABLE_KEY = "shipshot:stack-movable";

export function QuickAccess() {
  const params = new URLSearchParams(window.location.search);
  const demo = params.get("demo") === "true";
  const [pending, setPending] = useState<PendingCapture[]>([]);
  const [pinned, setPinned] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const pendingDrag = useRef<{ id: string; x: number; y: number } | null>(null);
  const busyTimer = useRef<number | null>(null);
  // Drag ghosts are built once, off the already-decoded thumbnail, so starting a drag is free.
  const dragIcons = useRef<Record<string, string>>({});
  const [stackMovable, setStackMovable] = useState(
    () => localStorage.getItem(STACK_MOVABLE_KEY) === "true",
  );
  // A drag that starts on a button must not also fire that button's click on release.
  const dragSuppressedClick = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add("quick-surface");
    if (demo) document.documentElement.classList.add("quick-demo");
    const preventFileNavigation = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("dragover", preventFileNavigation, true);
    window.addEventListener("drop", preventFileNavigation, true);
    return () => {
      document.documentElement.classList.remove("quick-surface");
      document.documentElement.classList.remove("quick-demo");
      window.removeEventListener("dragover", preventFileNavigation, true);
      window.removeEventListener("drop", preventFileNavigation, true);
      if (busyTimer.current) window.clearTimeout(busyTimer.current);
      if (!demo) void invoke("set_quick_access_busy", { busy: false }).catch(() => {});
    };
  }, [demo]);

  // Settings lives in the main window, so the toggle arrives as an event rather than a prop.
  // localStorage is shared (same origin) but its `storage` event doesn't cross WKWebViews.
  useEffect(() => {
    if (demo) return;
    const unlisten = listen<boolean>("stack-movable-changed", ({ payload }) => {
      localStorage.setItem(STACK_MOVABLE_KEY, String(payload));
      setStackMovable(payload);
    });
    return () => { void unlisten.then((off) => off()); };
  }, [demo]);

  // Previews stream off disk through the asset protocol (already scoped to $APPCACHE/pending).
  // They used to come back from an IPC command as base64 data URLs: every stack update
  // re-read and re-encoded every full-resolution PNG on the main thread, which is what froze
  // the app for seconds after each capture.
  const demoPreview = params.get("preview") || "/src-tauri/icons/128x128@2x.png";
  const previewSrc = useCallback((capture: PendingCapture): string | null => {
    if (demo) return demoPreview;
    if (capture.mediaType !== "image" || !capture.path) return null;
    return convertFileSrc(capture.path);
  }, [demo, demoPreview]);

  const applyStack = useCallback((captures: PendingCapture[]) => {
    setPending(captures);
  }, []);

  useEffect(() => {
    if (demo) {
      const makeMock = (id: string, filename: string): PendingCapture => ({
        id,
        filename,
        path: "",
        mediaType: "image",
        mode: "area",
        createdAt: new Date().toISOString(),
        width: 1440,
        height: 900,
        fileSize: 840000,
      });
      const captures = [
        makeMock("shipshot-demo-1", "ShipShot_One.png"),
        makeMock("shipshot-demo-2", "ShipShot_Two.png"),
        makeMock("shipshot-demo-3", "ShipShot_Three.png"),
        makeMock("shipshot-demo-4", "ShipShot_Four.png"),
      ];
      setPending(captures);
      return;
    }

    void invoke<PendingCapture[]>("get_pending_captures").then(applyStack);
    const unlistenStack = listen<PendingCapture[]>("pending-stack-updated", ({ payload }) => {
      applyStack(payload);
    });
    return () => {
      void unlistenStack.then((stop) => stop());
    };
  }, [applyStack, demo]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Pinning keeps the stack exactly where it sits instead of following the cursor's screen.
  const togglePin = (id: string) => {
    const next = !pinned;
    setPinned(next);
    setNotice({ id, tone: "neutral", message: next ? "Stack pinned here" : "Stack follows your cursor" });
    if (demo) return;
    void invoke("set_quick_access_pinned", { pinned: next });
    void invoke("set_quick_access_user_positioned", { positioned: next });
  };

  const removeLocal = (id: string) => {
    setPending((captures) => captures.filter((capture) => capture.id !== id));
    delete dragIcons.current[id];
  };

  const persistPending = async (captureToSave: PendingCapture, preserveSource = false) => {
    const capture = await invoke<Capture>("save_pending_capture", {
      id: captureToSave.id,
      preserveSource,
    });
    removeLocal(captureToSave.id);
    if (localStorage.getItem("shipshot:auto-remember") !== "false") {
      try {
        const memory = await rememberCapture(capture);
        await invoke("mark_remembered", { id: capture.id, memorySlug: memory.slug });
      } catch {
        // The ShipShot library save is complete even if Ship Memory is unavailable.
      }
    }
    return capture;
  };

  const discard = async (capture: PendingCapture) => {
    if (demo) {
      removeLocal(capture.id);
      return;
    }
    try {
      await invoke("discard_pending_capture", { id: capture.id });
      removeLocal(capture.id);
    } catch (error) {
      setNotice({ id: capture.id, tone: "error", message: String(error) });
    }
  };

  const copyToClipboard = async (capture: PendingCapture) => {
    if (demo) {
      setNotice({ id: capture.id, tone: "success", message: "Copied to clipboard" });
      return;
    }
    try {
      await invoke("copy_pending_capture", { id: capture.id });
      setNotice({ id: capture.id, tone: "success", message: "Copied to clipboard" });
    } catch (error) {
      setNotice({ id: capture.id, tone: "error", message: String(error) });
    }
  };

  const edit = async (capture: PendingCapture) => {
    if (demo) {
      window.location.href = `/?window=annotation&demo=true&preview=${encodeURIComponent(previewSrc(capture) || "")}`;
      return;
    }
    try {
      await invoke("open_annotation", { id: capture.id });
    } catch (error) {
      setNotice({ id: capture.id, tone: "error", message: String(error) });
    }
  };

  const setBusy = (busy: boolean) => {
    if (demo) return;
    void invoke("set_quick_access_busy", { busy }).catch(() => {});
  };

  const releaseBusy = () => {
    if (busyTimer.current) {
      window.clearTimeout(busyTimer.current);
      busyTimer.current = null;
    }
    setBusy(false);
  };

  const beginDragOut = async (capture: PendingCapture) => {
    if (demo) {
      removeLocal(capture.id);
      return;
    }
    // Already built when the thumbnail decoded — nothing to compute at gesture time.
    const icon = dragIcons.current[capture.id] ?? placeholderDragIcon() ?? capture.path;

    setBusy(true);
    busyTimer.current = window.setTimeout(releaseBusy, DRAG_BUSY_TIMEOUT_MS);

    try {
      await startDrag(
        { item: [capture.path], icon, mode: "copy" },
        ({ result }) => {
          void (async () => {
            // A release over the stack itself is not a drop — the drag ghost sits under
            // the cursor, so letting it count silently filed the capture away.
            const overStack = await invoke<boolean>("quick_access_contains_cursor").catch(() => false);
            releaseBusy();
            if (result !== "Dropped" || overStack) {
              setNotice({ id: capture.id, tone: "neutral", message: "Drag cancelled" });
              return;
            }
            try {
              await persistPending(capture, true);
            } catch (error) {
              setNotice({ id: capture.id, tone: "error", message: `Dropped, but save failed: ${String(error)}` });
            }
          })();
        },
      );
    } catch (error) {
      releaseBusy();
      setNotice({ id: capture.id, tone: "error", message: String(error) });
    }
  };

  const dragStart = (capture: PendingCapture): React.PointerEventHandler<HTMLElement> => (event) => {
    if (event.button !== 0) return;
    // preventDefault suppresses the compatibility mouse events, which is what we want on the
    // preview (no text selection, no WebKit image drag) but not on a real button — click is
    // derived from them, and killing it would take Copy down with it.
    if (event.currentTarget.tagName !== "BUTTON") event.preventDefault();
    event.stopPropagation();
    // Each fresh press clears the guard, so a suppressed click can't leak into the next gesture.
    dragSuppressedClick.current = false;
    pendingDrag.current = { id: capture.id, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const dragMove = (capture: PendingCapture): React.PointerEventHandler<HTMLElement> => (event) => {
    const origin = pendingDrag.current;
    if (!origin || origin.id !== capture.id) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < DRAG_THRESHOLD_PX) return;
    pendingDrag.current = null;
    dragSuppressedClick.current = true;
    // macOS owns the mouse once the drag session opens, so hand the pointer back first.
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    void beginDragOut(capture);
  };

  const dragEnd: React.PointerEventHandler<HTMLElement> = () => {
    pendingDrag.current = null;
  };

  /** Spread onto anything that should be grab-and-drag-out surface. */
  const dragOutHandlers = (capture: PendingCapture) => ({
    onPointerDown: dragStart(capture),
    onPointerMove: dragMove(capture),
    onPointerUp: dragEnd,
    onPointerCancel: dragEnd,
  });

  /** Buttons that double as drag surface: run the click only if the press didn't become a drag. */
  const unlessDragged = (run: () => void) => () => {
    if (dragSuppressedClick.current) {
      dragSuppressedClick.current = false;
      return;
    }
    run();
  };

  if (!pending.length) return <div className="quick-access-empty" />;

  return (
    <main className="quick-access-root">
      {pending.map((capture, index) => (
        <section
          className="quick-access-card"
          aria-label={`Temporary ShipShot capture ${index + 1} of ${pending.length}`}
          key={capture.id}
        >
          <div
            className="quick-preview"
            {...dragOutHandlers(capture)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") void edit(capture);
            }}
            role="button"
            tabIndex={0}
            title="Press and drag the screenshot"
          >
            {previewSrc(capture)
              ? (
                <img
                  src={previewSrc(capture) as string}
                  alt=""
                  decoding="async"
                  draggable={false}
                  onLoad={(event) => {
                    const built = dragIconFromImage(event.currentTarget);
                    if (built) dragIcons.current[capture.id] = built;
                  }}
                />
              )
              : <Film size={25} />}
            <div className="quick-preview-shade" />
          </div>

          {/* The strip between the top corner buttons only relocates the stack when Settings
              says so. Off by default, it is ordinary drag-out surface like the rest of the card. */}
          {/* No data-tauri-drag-region here: Tauri's own mousedown listener would call
              startDragging a second time on top of the handler below. */}
          {stackMovable ? (
            <div
              className="quick-stack-handle is-movable"
              onPointerDown={(event) => {
                if (event.button !== 0 || demo) return;
                event.preventDefault();
                // Moving the stack by hand is a pin: keep the icon, the backend flag and the
                // cursor tracker telling the same story.
                setPinned(true);
                void invoke("set_quick_access_pinned", { pinned: true });
                void invoke("set_quick_access_user_positioned", { positioned: true });
                void getCurrentWindow().startDragging();
              }}
              title="Drag to move the ShipShot stack"
            />
          ) : (
            <div
              className="quick-stack-handle"
              {...dragOutHandlers(capture)}
              title="Press and drag the screenshot"
            />
          )}

          <button
            type="button"
            className="quick-corner quick-delete-x"
            onClick={() => void discard(capture)}
            title="Delete this temporary capture"
            aria-label="Delete this temporary capture"
          >
            <X size={13} />
          </button>

          <button
            type="button"
            className={`quick-corner quick-pin ${pinned ? "is-pinned" : ""}`}
            onClick={() => togglePin(capture.id)}
            title={pinned ? "Unpin the stack so it follows your cursor" : "Pin the stack here"}
            aria-label={pinned ? "Unpin the ShipShot stack" : "Pin the ShipShot stack here"}
            aria-pressed={pinned}
          >
            {pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>

          <button
            type="button"
            className="quick-corner quick-edit"
            onClick={() => void edit(capture)}
            title="Annotate this capture"
            aria-label="Annotate this capture"
          >
            <Pencil size={12} />
          </button>

          <button
            type="button"
            className="quick-corner quick-save"
            title="Save to export"
            aria-label="Save this capture"
            onClick={async () => {
              if (demo) {
                removeLocal(capture.id);
                return;
              }
              try {
                const destination = await invoke<string | null>("export_pending_with_picker", { id: capture.id });
                if (destination) await persistPending(capture);
              } catch (error) {
                setNotice({ id: capture.id, tone: "error", message: String(error) });
              }
            }}
          >
            <Download size={13} />
          </button>

          {/* The pill sits dead centre, the most natural place to grab the thumbnail — so a
              press that travels becomes a drag-out and only a clean click copies. */}
          <div className="quick-center-actions">
            <button
              type="button"
              {...dragOutHandlers(capture)}
              onClick={unlessDragged(() => void copyToClipboard(capture))}
              title="Copy to clipboard — or drag to pull the capture out"
            >
              <Copy size={11} /> Copy
            </button>
          </div>

          {notice?.id === capture.id
            ? <div className={`quick-notice ${notice.tone}`}>{notice.message}</div>
            : null}
        </section>
      ))}
    </main>
  );
}
