import { useEffect, useRef } from "react";
import type { MemoryMeta } from "@ship-memory/core";

/**
 * Obsidian-style graph view: a force-directed canvas of every note and its
 * `[[wikilinks]]`. The physics run on preallocated typed arrays with alpha
 * decay, so the sim always settles and stops (no per-frame allocation, no
 * runaway loop — the failure mode that froze the ShipSpace graph). Hover
 * highlights a node's neighborhood; click opens the note; drag background to
 * pan, scroll to zoom, drag nodes to rearrange.
 */

const REPULSION = 1800;
const SPRING = 0.06;
const SPRING_LEN = 110;
const CENTER_PULL = 0.015;
const DAMPING = 0.8;
const ALPHA_DECAY = 0.985;
const MIN_ALPHA = 0.02;

interface GNode {
  slug: string;
  title: string;
  deg: number;
}

class GraphSim {
  private ctx: CanvasRenderingContext2D;
  private nodes: GNode[] = [];
  /** Flat [i, j, i, j, …] index pairs, deduped, i < j. */
  private edges: number[] = [];
  private x = new Float64Array(0);
  private y = new Float64Array(0);
  private vx = new Float64Array(0);
  private vy = new Float64Array(0);
  private alpha = 0;
  private raf = 0;
  private running = false;
  private visible = true;
  // View transform: screen = world * k + (tx, ty), in CSS px.
  private tx = 0;
  private ty = 0;
  private k = 1;
  private centered = false;
  private hover = -1;
  private hoverAdj = new Set<number>();
  private drag: { node: number; lastX: number; lastY: number; moved: boolean } | null =
    null;
  private ac = new AbortController();

  constructor(
    private canvas: HTMLCanvasElement,
    private onOpen: (slug: string) => void,
  ) {
    this.ctx = canvas.getContext("2d")!;
    const opts = { signal: this.ac.signal };
    canvas.addEventListener("pointerdown", this.onDown, opts);
    canvas.addEventListener("pointermove", this.onMove, opts);
    canvas.addEventListener("pointerup", this.onUp, opts);
    canvas.addEventListener("pointerleave", this.onLeave, opts);
    canvas.addEventListener("wheel", this.onWheel, {
      signal: this.ac.signal,
      passive: false,
    });
  }

  destroy() {
    this.stop();
    this.ac.abort();
  }

  /** Rebuild nodes/edges from metas, keeping positions of surviving notes. */
  setData(metas: MemoryMeta[]) {
    const prev = new Map<string, [number, number, number, number]>();
    for (let i = 0; i < this.nodes.length; i++) {
      prev.set(this.nodes[i].slug, [this.x[i], this.y[i], this.vx[i], this.vy[i]]);
    }
    const nodes: GNode[] = metas.map((m) => ({
      slug: m.slug,
      title: m.title,
      deg: 0,
    }));
    // Wikilinks may target a slug or a title — index both.
    const index = new Map<string, number>();
    metas.forEach((m, i) => {
      index.set(m.title.toLowerCase(), i);
      index.set(m.slug.toLowerCase(), i);
    });
    const edges: number[] = [];
    const seen = new Set<number>();
    metas.forEach((m, i) => {
      for (const raw of m.links) {
        const target = raw.split("|")[0].split("#")[0].trim().toLowerCase();
        const j = index.get(target);
        if (j === undefined || j === i) continue;
        const a = Math.min(i, j);
        const b = Math.max(i, j);
        const key = a * 65536 + b;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push(a, b);
        nodes[a].deg++;
        nodes[b].deg++;
      }
    });
    const n = nodes.length;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    const vx = new Float64Array(n);
    const vy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = prev.get(nodes[i].slug);
      if (p) {
        [x[i], y[i], vx[i], vy[i]] = p;
      } else {
        // Golden-angle spiral spreads newcomers without overlaps.
        const r = 60 * Math.sqrt(i + 1);
        const a = i * 2.39996;
        x[i] = Math.cos(a) * r;
        y[i] = Math.sin(a) * r;
      }
    }
    const changed =
      n !== this.nodes.length || edges.length !== this.edges.length;
    this.nodes = nodes;
    this.edges = edges;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.hover = -1;
    this.hoverAdj.clear();
    this.alpha = Math.max(this.alpha, changed ? 0.9 : 0.06);
    this.resize();
    this.start();
  }

  setVisible(v: boolean) {
    this.visible = v;
    if (v) {
      this.resize();
      this.start();
    } else {
      this.stop();
    }
  }

  resize() {
    const host = this.canvas.parentElement;
    if (!host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return; // hidden pane — wait for the ResizeObserver
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (!this.centered) {
      this.tx = w / 2;
      this.ty = h / 2;
      this.centered = true;
    }
    this.draw();
  }

  private start() {
    if (this.running || !this.visible) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      const live = this.tick();
      this.draw();
      if (live) this.raf = requestAnimationFrame(loop);
      else this.running = false;
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private tick(): boolean {
    const n = this.nodes.length;
    if (!n || this.alpha <= MIN_ALPHA) return false;
    const { x, y, vx, vy, edges } = this;
    const a = this.alpha;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = x[i] - x[j];
        let dy = y[i] - y[j];
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = 0.5;
          dy = 0.5;
          d2 = 0.5;
        }
        const d = Math.sqrt(d2);
        const f = (REPULSION * a) / d2;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        vx[i] += fx;
        vy[i] += fy;
        vx[j] -= fx;
        vy[j] -= fy;
      }
    }
    for (let e = 0; e < edges.length; e += 2) {
      const i = edges[e];
      const j = edges[e + 1];
      const dx = x[j] - x[i];
      const dy = y[j] - y[i];
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (SPRING * a * (d - SPRING_LEN)) / d;
      vx[i] += dx * f;
      vy[i] += dy * f;
      vx[j] -= dx * f;
      vy[j] -= dy * f;
    }
    const held = this.drag?.node ?? -1;
    for (let i = 0; i < n; i++) {
      if (i === held) {
        vx[i] = 0;
        vy[i] = 0;
        continue;
      }
      vx[i] = (vx[i] - x[i] * CENTER_PULL * a) * DAMPING;
      vy[i] = (vy[i] - y[i] * CENTER_PULL * a) * DAMPING;
      x[i] += vx[i];
      y[i] += vy[i];
    }
    this.alpha *= ALPHA_DECAY;
    return this.alpha > MIN_ALPHA;
  }

  private radius(i: number): number {
    return 3.5 + Math.sqrt(this.nodes[i].deg) * 1.7;
  }

  private draw() {
    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cs = getComputedStyle(canvas);
    const ink = cs.getPropertyValue("--smui-ink").trim() || "#888";
    const ink2 = cs.getPropertyValue("--smui-ink-2").trim() || "#888";
    const accent = cs.getPropertyValue("--smui-accent").trim() || "#d99e1b";
    const n = this.nodes.length;
    if (!n) {
      ctx.fillStyle = ink2;
      ctx.font = `${13 * dpr}px -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("No notes to graph", canvas.width / 2, canvas.height / 2);
      return;
    }
    ctx.setTransform(dpr * this.k, 0, 0, dpr * this.k, dpr * this.tx, dpr * this.ty);
    ctx.lineWidth = 1 / this.k;
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = ink2;
    ctx.beginPath();
    for (let e = 0; e < this.edges.length; e += 2) {
      const i = this.edges[e];
      const j = this.edges[e + 1];
      if (this.hover >= 0 && (i === this.hover || j === this.hover)) continue;
      ctx.moveTo(this.x[i], this.y[i]);
      ctx.lineTo(this.x[j], this.y[j]);
    }
    ctx.stroke();
    if (this.hover >= 0) {
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = accent;
      ctx.beginPath();
      for (let e = 0; e < this.edges.length; e += 2) {
        const i = this.edges[e];
        const j = this.edges[e + 1];
        if (i !== this.hover && j !== this.hover) continue;
        ctx.moveTo(this.x[i], this.y[i]);
        ctx.lineTo(this.x[j], this.y[j]);
      }
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const lit = this.hover === -1 || i === this.hover || this.hoverAdj.has(i);
      ctx.globalAlpha = lit ? 0.9 : 0.25;
      ctx.fillStyle = i === this.hover ? accent : ink2;
      ctx.beginPath();
      ctx.arc(this.x[i], this.y[i], this.radius(i), 0, Math.PI * 2);
      ctx.fill();
    }
    const showAll = this.k > 0.45;
    ctx.textAlign = "center";
    ctx.font = `${11 / this.k}px -apple-system, BlinkMacSystemFont, sans-serif`;
    for (let i = 0; i < n; i++) {
      const isHover = i === this.hover;
      const isAdj = this.hoverAdj.has(i);
      if (!showAll && !isHover && !isAdj) continue;
      ctx.globalAlpha = isHover ? 1 : this.hover >= 0 && !isAdj ? 0.15 : 0.55;
      ctx.fillStyle = isHover ? ink : ink2;
      ctx.fillText(
        this.nodes[i].title,
        this.x[i],
        this.y[i] + this.radius(i) + 13 / this.k,
      );
    }
    ctx.globalAlpha = 1;
  }

  private toWorld(e: PointerEvent | WheelEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left - this.tx) / this.k,
      (e.clientY - rect.top - this.ty) / this.k,
    ];
  }

  private pick(wx: number, wy: number): number {
    let best = -1;
    let bestD2 = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const t = Math.max(this.radius(i) + 3, 8 / this.k);
      const dx = this.x[i] - wx;
      const dy = this.y[i] - wy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= t * t && d2 < bestD2) {
        best = i;
        bestD2 = d2;
      }
    }
    return best;
  }

  private setHover(i: number) {
    if (i === this.hover) return;
    this.hover = i;
    this.hoverAdj.clear();
    if (i >= 0) {
      for (let e = 0; e < this.edges.length; e += 2) {
        if (this.edges[e] === i) this.hoverAdj.add(this.edges[e + 1]);
        else if (this.edges[e + 1] === i) this.hoverAdj.add(this.edges[e]);
      }
    }
    this.canvas.style.cursor = i >= 0 ? "pointer" : "default";
    this.draw();
  }

  private onDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId);
    const [wx, wy] = this.toWorld(e);
    this.drag = {
      node: this.pick(wx, wy),
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
    };
  };

  private onMove = (e: PointerEvent) => {
    if (this.drag) {
      const dx = e.clientX - this.drag.lastX;
      const dy = e.clientY - this.drag.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.drag.moved = true;
      this.drag.lastX = e.clientX;
      this.drag.lastY = e.clientY;
      if (this.drag.node >= 0) {
        this.x[this.drag.node] += dx / this.k;
        this.y[this.drag.node] += dy / this.k;
        this.alpha = Math.max(this.alpha, 0.3);
        this.start();
      } else {
        this.tx += dx;
        this.ty += dy;
        this.draw();
      }
      return;
    }
    const [wx, wy] = this.toWorld(e);
    this.setHover(this.pick(wx, wy));
  };

  private onUp = () => {
    const d = this.drag;
    this.drag = null;
    if (d && !d.moved && d.node >= 0) this.onOpen(this.nodes[d.node].slug);
  };

  private onLeave = () => {
    if (!this.drag) this.setHover(-1);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const nk = Math.min(5, Math.max(0.12, this.k * Math.exp(-e.deltaY * 0.0015)));
    const wx = (px - this.tx) / this.k;
    const wy = (py - this.ty) / this.k;
    this.tx = px - wx * nk;
    this.ty = py - wy * nk;
    this.k = nk;
    this.draw();
  };
}

export interface GraphViewProps {
  metas: MemoryMeta[];
  /** Pause the sim while the tab is hidden. */
  visible: boolean;
  onOpenNote: (slug: string) => void;
}

export function GraphView({ metas, visible, onOpenNote }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<GraphSim | null>(null);
  const openRef = useRef(onOpenNote);
  openRef.current = onOpenNote;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sim = new GraphSim(canvas, (slug) => openRef.current(slug));
    simRef.current = sim;
    const ro = new ResizeObserver(() => sim.resize());
    ro.observe(canvas.parentElement!);
    return () => {
      ro.disconnect();
      sim.destroy();
      simRef.current = null;
    };
  }, []);

  useEffect(() => {
    simRef.current?.setData(metas);
  }, [metas]);

  useEffect(() => {
    simRef.current?.setVisible(visible);
  }, [visible]);

  return (
    <div className="smui-graph">
      <canvas ref={canvasRef} />
    </div>
  );
}
