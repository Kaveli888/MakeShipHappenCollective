import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { startCaptureDrag } from "./lib/captureDrag";
import { dragIconFromCanvas, placeholderDragIcon } from "./lib/dragIcon";
import {
  ArrowDownRight,
  Check,
  Circle,
  Download,
  GripHorizontal,
  Highlighter,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  RotateCcw,
  Square,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { rememberCapture } from "./lib/shipMemory";
import type { Capture, PendingCapture } from "./types";

type Tool = "select" | "pen" | "highlight" | "line" | "arrow" | "rectangle" | "ellipse" | "text";
type Point = { x: number; y: number };

const tools: Array<{ id: Tool; label: string; icon: typeof Pencil }> = [
  { id: "select", label: "Move", icon: MousePointer2 },
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "line", label: "Line", icon: Minus },
  { id: "arrow", label: "Arrow", icon: ArrowDownRight },
  { id: "pen", label: "Pencil", icon: Pencil },
  { id: "highlight", label: "Highlight", icon: Highlighter },
  { id: "text", label: "Text", icon: Type },
];

export function AnnotationEditor() {
  const params = new URLSearchParams(window.location.search);
  const demo = params.get("demo") === "true";
  const [pending, setPending] = useState<PendingCapture | null>(null);
  const [source, setSource] = useState("");
  const [tool, setTool] = useState<Tool>("rectangle");
  const [color, setColor] = useState("#ff3b3b");
  const [lineWidth, setLineWidth] = useState(5);
  const [textValue, setTextValue] = useState("Ship it");
  const [status, setStatus] = useState("Temporary • not saved to library");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const startPoint = useRef<Point>({ x: 0, y: 0 });
  const previewFrame = useRef<ImageData | null>(null);
  const history = useRef<string[]>([]);
  const redo = useRef<string[]>([]);

  useEffect(() => {
    document.documentElement.classList.add("annotation-surface");
    return () => document.documentElement.classList.remove("annotation-surface");
  }, []);

  const loadCapture = useCallback(async (capture: PendingCapture) => {
    setPending(capture);
    // The editor window is reused, so re-arm the red rectangle for every capture instead of
    // inheriting whatever tool the previous edit finished on.
    setTool("rectangle");
    setColor("#ff3b3b");
    setStatus("Temporary • not saved to library");
    const data = await invoke<string>("read_pending_image", { id: capture.id });
    setSource(data);
    window.focus();
  }, []);

  useEffect(() => {
    if (demo) {
      const mock: PendingCapture = {
        id: "shipshot-demo",
        filename: "ShipShot_Quick_Access.png",
        path: "",
        mediaType: "image",
        mode: "area",
        createdAt: new Date().toISOString(),
        width: 1440,
        height: 900,
        fileSize: 840000,
      };
      setPending(mock);
      setSource(params.get("preview") || "/src-tauri/icons/128x128@2x.png");
      return;
    }
    void invoke<PendingCapture | null>("get_pending_capture").then((capture) => {
      if (capture) void loadCapture(capture);
    });
    const unlisten = listen<PendingCapture>("annotation-opened", ({ payload }) => {
      void loadCapture(payload);
    });
    return () => { void unlisten.then((stop) => stop()); };
  }, [demo, loadCapture]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    const image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context?.drawImage(image, 0, 0);
      history.current = [canvas.toDataURL("image/png")];
      redo.current = [];
    };
    image.src = source;
  }, [source]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const snapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    history.current.push(canvas.toDataURL("image/png"));
    if (history.current.length > 24) history.current.shift();
    redo.current = [];
  };

  const restore = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = new Image();
    image.onload = () => {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
      context?.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = dataUrl;
  };

  const undoLast = () => {
    if (history.current.length <= 1) return;
    const removed = history.current.pop();
    if (removed) redo.current.push(removed);
    restore(history.current.at(-1)!);
  };

  const redoLast = () => {
    const next = redo.current.pop();
    if (!next) return;
    history.current.push(next);
    restore(next);
  };

  const configureContext = (context: CanvasRenderingContext2D) => {
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = tool === "highlight" ? lineWidth * 4 : lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalAlpha = tool === "highlight" ? 0.34 : 1;
  };

  const drawShape = (context: CanvasRenderingContext2D, start: Point, end: Point) => {
    configureContext(context);
    const width = end.x - start.x;
    const height = end.y - start.y;
    if (tool === "rectangle") context.strokeRect(start.x, start.y, width, height);
    if (tool === "ellipse") {
      context.beginPath();
      context.ellipse(start.x + width / 2, start.y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
      context.stroke();
    }
    if (tool === "line" || tool === "arrow") {
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
      if (tool === "arrow") {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const head = Math.max(18, lineWidth * 5);
        context.beginPath();
        context.moveTo(end.x, end.y);
        context.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
        context.moveTo(end.x, end.y);
        context.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  };

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === "select") return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    canvas.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    startPoint.current = point;
    previewFrame.current = context.getImageData(0, 0, canvas.width, canvas.height);
    drawing.current = true;
    if (tool === "text") {
      configureContext(context);
      context.font = `700 ${Math.max(28, lineWidth * 9)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      context.fillText(textValue.trim() || "Text", point.x, point.y);
      context.globalAlpha = 1;
      drawing.current = false;
      snapshot();
      return;
    }
    if (tool === "pen" || tool === "highlight") {
      configureContext(context);
      context.beginPath();
      context.moveTo(point.x, point.y);
    }
  };

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = pointFromEvent(event);
    if (tool === "pen" || tool === "highlight") {
      context.lineTo(point.x, point.y);
      context.stroke();
      return;
    }
    if (previewFrame.current) context.putImageData(previewFrame.current, 0, 0);
    drawShape(context, startPoint.current, point);
  };

  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    canvasRef.current?.releasePointerCapture(event.pointerId);
    const context = canvasRef.current?.getContext("2d");
    if (context) context.globalAlpha = 1;
    previewFrame.current = null;
    snapshot();
  };

  const commit = async () => {
    if (!pending || !canvasRef.current) throw new Error("No screenshot is open");
    if (demo) return pending;
    const updated = await invoke<PendingCapture>("save_annotated_pending", {
      id: pending.id,
      dataUrl: canvasRef.current.toDataURL("image/png"),
    });
    setPending(updated);
    return updated;
  };

  const finalizeCapture = async (captureToSave: PendingCapture) => {
    const capture = await invoke<Capture>("save_pending_capture", {
      id: captureToSave.id,
    });
    if (localStorage.getItem("shipshot:auto-remember") !== "false") {
      try {
        const memory = await rememberCapture(capture);
        await invoke("mark_remembered", { id: capture.id, memorySlug: memory.slug });
      } catch {
        // The ShipShot library save is complete even if Ship Memory is unavailable.
      }
    }
  };

  const done = async () => {
    try {
      await commit();
      if (demo) setStatus("Annotations ready • press Save in Quick Access to add to library");
      else await invoke("close_annotation");
    } catch (error) {
      setStatus(String(error));
    }
  };

  const cancel = async () => {
    try {
      if (demo) window.history.back();
      else await invoke("close_annotation");
    } catch (error) {
      setStatus(String(error));
    }
  };

  const exportDesktop = async () => {
    try {
      const updated = await commit();
      if (!demo) {
        const destination = await invoke<string | null>("export_pending_with_picker", { id: updated.id });
        if (!destination) return;
        await finalizeCapture(updated);
      }
      setStatus("Saved to your folder + ShipShot temporary workspace");
    } catch (error) {
      setStatus(String(error));
    }
  };

  const dragEdited = async () => {
    try {
      const updated = await commit();
      if (demo) {
        setStatus("Dropped + saved to ShipShot");
        return;
      }
      const icon = dragIconFromCanvas(canvasRef.current) ?? placeholderDragIcon() ?? updated.path;
      await startCaptureDrag(
        updated,
        icon,
        ({ result }) => {
          if (result === "Dropped") {
            void (async () => {
              try {
                await invoke("complete_pending_drag", { id: updated.id });
                await invoke("close_annotation");
              } catch (error) {
                setStatus(`Dropped, but cleanup failed: ${String(error)}`);
              }
            })();
            return;
          }
          setStatus("Drag cancelled");
        },
      );
    } catch (error) {
      setStatus(String(error));
    }
  };

  const clearAnnotations = () => {
    if (!source) return;
    restore(source);
    history.current = [source];
    redo.current = [];
  };

  return (
    <main className="annotation-root">
      <header className="annotation-titlebar" data-tauri-drag-region>
        <div className="annotation-traffic-space" data-tauri-drag-region />
        <span>ShipShot Editor</span>
        <button onClick={() => void cancel()} title="Close editor"><X size={16} /></button>
      </header>

      <nav className="annotation-toolbar" aria-label="Annotation tools">
        <div className="annotation-tool-group">
          {tools.map(({ id, label, icon: Icon }) => (
            <button key={id} className={tool === id ? "active" : ""} onClick={() => setTool(id)} title={label}>
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="annotation-divider" />
        <div className="annotation-style-tools">
          <label title="Annotation color"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><i style={{ background: color }} /></label>
          <label className="line-width-control" title="Line width"><input type="range" min="2" max="16" value={lineWidth} onChange={(event) => setLineWidth(Number(event.target.value))} /></label>
          {tool === "text" && <input className="annotation-text-input" value={textValue} onChange={(event) => setTextValue(event.target.value)} aria-label="Text to add" />}
        </div>
        <div className="annotation-divider" />
        <div className="annotation-history-tools">
          <button onClick={undoLast} title="Undo"><RotateCcw size={16} /></button>
          <button onClick={redoLast} title="Redo"><Redo2 size={16} /></button>
          <button onClick={clearAnnotations} title="Clear annotations"><Trash2 size={16} /></button>
        </div>
      </nav>

      <section className="annotation-stage">
        {source ? (
          <div className="annotation-canvas-frame">
            <canvas
              ref={canvasRef}
              className={`annotation-canvas tool-${tool}`}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
            />
          </div>
        ) : (
          <div className="annotation-loading">Loading temporary screenshot…</div>
        )}
      </section>

      <footer className="annotation-footer">
        <span className="annotation-status">{status}</span>
        <button className="drag-edited" onMouseDown={() => void dragEdited()}><GripHorizontal size={15} /> Drag Me</button>
        <div className="annotation-footer-actions">
          <button onClick={() => void exportDesktop()}><Download size={15} /> Save As…</button>
          <button className="done" onClick={() => void done()}><Check size={15} /> Done</button>
        </div>
      </footer>
    </main>
  );
}
