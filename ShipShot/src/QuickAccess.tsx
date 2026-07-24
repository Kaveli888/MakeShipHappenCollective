import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { Check, Film, GripHorizontal, Pencil, X } from "lucide-react";
import { rememberCapture } from "./lib/shipMemory";
import type { Capture, PendingCapture } from "./types";

type Notice = {
  id: string;
  tone: "success" | "error" | "neutral";
  message: string;
} | null;

export function QuickAccess() {
  const params = new URLSearchParams(window.location.search);
  const demo = params.get("demo") === "true";
  const stackRef = useRef<HTMLElement>(null);
  const [pending, setPending] = useState<PendingCapture[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    document.documentElement.classList.add("quick-surface");
    const preventFileNavigation = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("dragover", preventFileNavigation, true);
    window.addEventListener("drop", preventFileNavigation, true);
    return () => {
      document.documentElement.classList.remove("quick-surface");
      window.removeEventListener("dragover", preventFileNavigation, true);
      window.removeEventListener("drop", preventFileNavigation, true);
    };
  }, []);

  const loadPreviews = useCallback(async (captures: PendingCapture[]) => {
    const imageCaptures = captures.filter((capture) => capture.mediaType === "image");
    const loaded = await Promise.all(imageCaptures.map(async (capture) => {
      try {
        return [capture.id, await invoke<string>("read_pending_image", { id: capture.id })] as const;
      } catch {
        return [capture.id, ""] as const;
      }
    }));
    setPreviews(Object.fromEntries(loaded));
  }, []);

  const applyStack = useCallback((captures: PendingCapture[]) => {
    setPending(captures);
    setActiveId((current) => captures.some((capture) => capture.id === current) ? current : null);
    void loadPreviews(captures);
  }, [loadPreviews]);

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
      ];
      setPending(captures);
      const preview = params.get("preview") || "/src-tauri/icons/128x128@2x.png";
      setPreviews(Object.fromEntries(captures.map((capture) => [capture.id, preview])));
      return;
    }

    void invoke<PendingCapture[]>("get_pending_captures").then(applyStack);
    const unlistenStack = listen<PendingCapture[]>("pending-stack-updated", ({ payload }) => {
      applyStack(payload);
    });
    const unlistenCollapse = listen("quick-access-collapsed", () => {
      setActiveId(null);
    });
    return () => {
      void unlistenStack.then((stop) => stop());
      void unlistenCollapse.then((stop) => stop());
    };
  }, [applyStack, demo]);

  useEffect(() => {
    const element = stackRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [pending.length]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const openActions = (id: string) => {
    setActiveId(id);
    if (!demo) void invoke("set_quick_access_expanded", { expanded: true });
  };

  const closeActions = () => {
    setActiveId(null);
    if (!demo) void invoke("set_quick_access_expanded", { expanded: false });
  };

  const removeLocal = (id: string) => {
    setPending((captures) => captures.filter((capture) => capture.id !== id));
    setPreviews((items) => {
      const next = { ...items };
      delete next[id];
      return next;
    });
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

  const edit = async (capture: PendingCapture) => {
    if (demo) {
      window.location.href = `/?window=annotation&demo=true&preview=${encodeURIComponent(previews[capture.id] || "")}`;
      return;
    }
    try {
      await invoke("open_annotation", { id: capture.id });
    } catch (error) {
      setNotice({ id: capture.id, tone: "error", message: String(error) });
    }
  };

  const dragOut = (capture: PendingCapture): React.PointerEventHandler<HTMLDivElement> => (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (demo) {
      removeLocal(capture.id);
      return;
    }
    void startDrag(
      { item: [capture.path], icon: capture.path, mode: "copy" },
      ({ result }) => {
        if (result === "Dropped") {
          void persistPending(capture, true).catch((error) => {
            setNotice({ id: capture.id, tone: "error", message: `Dropped, but save failed: ${String(error)}` });
          });
          return;
        }
        setNotice({ id: capture.id, tone: "neutral", message: "Drag cancelled" });
      },
    ).catch((error) => setNotice({ id: capture.id, tone: "error", message: String(error) }));
  };

  if (!pending.length) return <div className="quick-access-empty" />;

  return (
    <main ref={stackRef} className="quick-access-root" onMouseLeave={closeActions}>
      <div
        className="quick-stack-handle"
        data-tauri-drag-region
        onPointerDown={(event) => {
          if (event.button !== 0 || demo) return;
          event.preventDefault();
          void invoke("set_quick_access_user_positioned", { positioned: true });
          void getCurrentWindow().startDragging();
        }}
        title="Drag to move the ShipShot stack"
      >
        <GripHorizontal size={13} /> {pending.length} {pending.length === 1 ? "capture" : "captures"} · Move
      </div>
      {pending.map((capture, index) => {
        const isActive = activeId === capture.id;
        return (
          <section
            className={`quick-access-card ${isActive ? "is-active" : ""}`}
            aria-label={`Temporary ShipShot capture ${index + 1} of ${pending.length}`}
            key={capture.id}
            onMouseEnter={() => openActions(capture.id)}
          >
            <div
              className="quick-preview"
              onPointerDown={dragOut(capture)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") void edit(capture);
              }}
              role="button"
              tabIndex={0}
              title="Press and drag the screenshot"
            >
              {previews[capture.id] ? <img src={previews[capture.id]} alt="" /> : <Film size={28} />}
              <div className="quick-preview-shade" />
              <span className="quick-stack-count">{index + 1}/{pending.length}</span>
              <span className="quick-drag-hint"><GripHorizontal size={13} /> Drag anywhere</span>
            </div>

            <button
              type="button"
              className="quick-delete-x"
              onClick={() => void discard(capture)}
              title="Delete this temporary capture"
              aria-label="Delete this temporary capture"
            >
              <X size={14} />
            </button>

            <div className="quick-center-actions">
              <button type="button" onClick={() => void edit(capture)}><Pencil size={13} /> Edit</button>
              <button type="button" className="save" onClick={async () => {
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
              }}><Check size={13} /> Save As</button>
            </div>

            {notice?.id === capture.id && <div className={`quick-notice ${notice.tone}`}>{notice.message}</div>}
          </section>
        );
      })}
    </main>
  );
}
