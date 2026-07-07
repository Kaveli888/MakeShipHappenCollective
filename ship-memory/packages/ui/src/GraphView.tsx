import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MemoryMeta } from "@ship-memory/core";
import { IconChevronDown } from "./icons";

/**
 * Oracle view — the vault as a true-3D WebGL data-orb. A dense volumetric
 * cloud of glowing particles is the body of the galaxy; every note is a
 * bright category node coloured by the "world" it belongs to (project cluster
 * from folder + source + tags), sized by connectivity, wired by `[[wikilinks]]`.
 * Drag to orbit, scroll to fly *into* the cloud (perspective dolly), click a
 * node to open it.
 *
 * Pure new *lens* on the same vault: reads metas, opens notes, nothing more.
 * The render loop only runs while the tab is visible (paused otherwise), so it
 * never burns CPU in the background — and the GL context is released on unmount.
 */

// ── Worlds — vivid category nodes on the cyan field ─────────────────────────
export type World =
  | "shipspace" | "aos" | "msht" | "ref" | "logs" | "trueyou" | "loose";

export const WORLDS: Record<
  World,
  { label: string; color: string; rgb: [number, number, number] }
> = {
  shipspace: { label: "ShipSpace", color: "#f5c542", rgb: [0.96, 0.77, 0.26] },
  aos: { label: "Ship Agentic OS", color: "#32e6f0", rgb: [0.2, 0.9, 0.94] },
  msht: { label: "MakeShipHappen", color: "#e0559f", rgb: [0.88, 0.33, 0.62] },
  ref: { label: "Reference", color: "#5b8cff", rgb: [0.36, 0.55, 1.0] },
  logs: { label: "Agent Logs", color: "#57d98a", rgb: [0.34, 0.85, 0.54] },
  trueyou: { label: "True You", color: "#ff7a59", rgb: [1.0, 0.48, 0.35] },
  loose: { label: "Loose", color: "#9aa3b2", rgb: [0.6, 0.64, 0.7] },
};
export const WORLD_ORDER: World[] = [
  "shipspace", "aos", "msht", "ref", "logs", "trueyou", "loose",
];

const HUB_SLUGS = new Set([
  "ship-memory", "architecture", "connectors", "pricing-decision",
]);
const TWO_PI = Math.PI * 2;
const ORB_R = 620;
// Dust scales with the vault: ~60 motes per note, so the orb literally grows
// as you save to Ship Memory (floored so a small vault still reads as a cloud,
// capped so a huge vault stays performant).
const DUST_PER_NOTE = 60;
const DUST_MIN = 400;
const DUST_MAX = 6000;
// Focus fly-in: the blue dust field clears as you dolly inside a cluster
// (fully gone by NEAR, fully back by FAR), so a zoomed section shows only
// its note stars and links.
const DUST_FADE_FAR = 950;
const DUST_FADE_NEAR = 420;
const LEGEND_PRIVACY_KEY = "shipmemory:galaxy-legend-hidden";

function tagsOf(m: MemoryMeta): string[] {
  const t = (m.frontmatter as { tags?: unknown }).tags;
  return Array.isArray(t) ? t.map((x) => String(x).toLowerCase()) : [];
}

/** Classify a note into a world. Order matters — first match wins. */
export function worldOf(m: MemoryMeta): World {
  const tags = tagsOf(m);
  const type = String((m.frontmatter as { type?: unknown }).type ?? "").toLowerCase();
  const folder = String((m.frontmatter as { folder?: unknown }).folder ?? "");
  const opath = String((m.frontmatter as { obsidianPath?: unknown }).obsidianPath ?? "");
  if (HUB_SLUGS.has(m.slug) || type === "reference") return "ref";
  if (tags.includes("chat")) return "logs";
  if (tags.includes("makeshiphappen.tech")) return "msht";
  if (
    /^(ship )?agentic os/i.test(folder) ||
    /agentic os|ship aos/i.test(opath) ||
    tags.some((t) => t === "ship-agentic-os" || t === "agentic-os" || t === "ship-aos")
  )
    return "aos";
  if (tags.includes("shipspace") || type === "session-summary") return "shipspace";
  if (/^true you/i.test(folder) || tags.includes("true-you")) return "trueyou";
  return "loose";
}

// ── deterministic layout helpers ────────────────────────────────────────────
// Seeded PRNG so dust and node jitter are STABLE across saves and sessions —
// the orb must not reshuffle every time the vault changes (comets land on a
// still sky; only what's new moves).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Memory heat: 1 = touched today (burns, pulses), cooling to 0.25 embers. */
function heatOf(modified: number): number {
  const days = (Date.now() - modified) / 86400000;
  if (days < 1) return 1;
  if (days < 7) return 1 - (0.35 * (days - 1)) / 6;
  if (days < 30) return 0.65 - (0.4 * (days - 7)) / 23;
  return 0.25;
}

type GalaxyModel = {
  metas: MemoryMeta[];
  worlds: World[];
  present: World[];
  edges: number[];
  deg: Int32Array<ArrayBufferLike>;
  hub: number;
  nodePos: Float32Array<ArrayBufferLike>;
  slugIndex: Map<string, number>;
};

function buildGalaxyModel(metas: MemoryMeta[]): GalaxyModel {
  const N = metas.length;

  // world membership + counts
  const worldCount = new Map<World, number>();
  const worlds = metas.map((m) => {
    const w = worldOf(m);
    worldCount.set(w, (worldCount.get(w) ?? 0) + 1);
    return w;
  });
  const present = WORLD_ORDER.filter((w) => (worldCount.get(w) ?? 0) > 0);

  // edges + degree
  const index = new Map<string, number>();
  metas.forEach((m, i) => { index.set(m.title.toLowerCase(), i); index.set(m.slug.toLowerCase(), i); });
  const edges: number[] = [];
  const seen = new Set<number>();
  const deg = new Int32Array(N);
  metas.forEach((m, i) => {
    for (const raw of m.links) {
      const target = raw.split("|")[0].split("#")[0].trim().toLowerCase();
      const j = index.get(target);
      if (j === undefined || j === i) continue;
      const a = Math.min(i, j), b = Math.max(i, j), key = a * 65536 + b;
      if (seen.has(key)) continue;
      seen.add(key); edges.push(a, b); deg[a]++; deg[b]++;
    }
  });
  let hub = -1, maxDeg = 0;
  for (let i = 0; i < N; i++) if (deg[i] > maxDeg) { maxDeg = deg[i]; hub = i; }

  // world lobe directions on a sphere
  const wdir = new Map<World, [number, number, number]>();
  present.forEach((w, wi) => {
    const phi = Math.acos(1 - 2 * (wi + 0.5) / present.length);
    const theta = Math.PI * (1 + Math.sqrt(5)) * wi;
    wdir.set(w, [Math.sin(phi) * Math.cos(theta), Math.cos(phi) * 0.75, Math.sin(phi) * Math.sin(theta)]);
  });

  // node 3D positions inside their world lobe — everything derives from the
  // slug hash, so a note keeps its exact spot across saves and app restarts.
  const nodePos = new Float32Array(N * 3);
  const slugIndex = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    slugIndex.set(metas[i].slug, i);
    const w = worlds[i];
    const d = wdir.get(w)!;
    const rng = mulberry32(hashStr(metas[i].slug));
    const shell = ORB_R * (0.42 + 0.36 * rng());
    nodePos[i*3]   = d[0] * shell + (rng() - 0.5) * ORB_R * 0.34;
    nodePos[i*3+1] = d[1] * shell + (rng() - 0.5) * ORB_R * 0.34;
    nodePos[i*3+2] = d[2] * shell + (rng() - 0.5) * ORB_R * 0.34;
  }

  return { metas, worlds, present, edges, deg, hub, nodePos, slugIndex };
}

type GalaxySim = {
  ok: boolean;
  destroy(): void;
  setAutoSpin(v: boolean): void;
  setFilter(w: World | null): void;
  recenter(): void;
  setData(metas: MemoryMeta[]): void;
  setVisible(v: boolean): void;
  resize(): void;
  comet(slug: string): void;
  flare(slug: string): void;
};

// ── mat4 helpers (column-major) ─────────────────────────────────────────────
type M4 = Float32Array;
function ident(o: M4): M4 { o.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); return o; }
function perspective(o: M4, fovy: number, aspect: number, near: number, far: number): M4 {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  o[0]=f/aspect;o[1]=0;o[2]=0;o[3]=0; o[4]=0;o[5]=f;o[6]=0;o[7]=0;
  o[8]=0;o[9]=0;o[10]=(far+near)*nf;o[11]=-1; o[12]=0;o[13]=0;o[14]=2*far*near*nf;o[15]=0;
  return o;
}
function mul(o: M4, a: M4, b: M4): M4 {
  const t = new Float32Array(16);
  for (let r=0;r<4;r++) for (let c=0;c<4;c++)
    t[c*4+r] = a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  o.set(t); return o;
}
function rotY(o: M4, a: number): M4 { ident(o); const c=Math.cos(a),s=Math.sin(a); o[0]=c;o[2]=-s;o[8]=s;o[10]=c; return o; }
function rotX(o: M4, a: number): M4 { ident(o); const c=Math.cos(a),s=Math.sin(a); o[5]=c;o[6]=s;o[9]=-s;o[10]=c; return o; }
function transl(o: M4, x: number, y: number, z: number): M4 { ident(o); o[12]=x;o[13]=y;o[14]=z; return o; }

const VS = `
  attribute vec3 aPos; attribute vec3 aColor; attribute float aSize; attribute float aSeed; attribute float aHeat; attribute float aKind;
  uniform mat4 uProj; uniform mat4 uView; uniform float uTime; uniform float uFocal; uniform float uDust;
  varying vec3 vColor; varying float vFade;
  void main(){
    vec4 vp = uView * vec4(aPos,1.0);
    float dist = -vp.z;
    gl_Position = uProj * vp;
    // Hot memories pulse hard; cool ones barely shimmer.
    float amp = mix(0.10, 0.42, aHeat);
    float tw = (1.0 - amp) + amp*sin(uTime*1.8 + aSeed*6.2831);
    gl_PointSize = clamp(aSize * uFocal / max(dist,0.1), 0.6, 180.0) * tw;
    float far = smoothstep(3800.0, 150.0, dist);
    float near = smoothstep(3.0, 130.0, dist);
    vColor = aColor;
    // dust (aKind=1) obeys the fly-in fade; note stars (aKind=0) always show
    vFade = far * near * (0.78 + 0.22*tw) * mix(0.30, 1.25, aHeat) * mix(1.0, uDust, aKind);
    if (dist <= 0.2) gl_Position = vec4(2.0,2.0,2.0,1.0);
  }`;
const FS = `
  precision mediump float;
  varying vec3 vColor; varying float vFade;
  void main(){
    vec2 pc = gl_PointCoord - 0.5;
    float d = length(pc);
    if (d > 0.5) discard;
    float a = pow(smoothstep(0.5, 0.0, d), 1.25);
    float core = smoothstep(0.22, 0.0, d) * 0.85;
    gl_FragColor = vec4((vColor + core) * a * vFade, a * vFade);
  }`;

class GalaxyGL {
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private octx: CanvasRenderingContext2D | null = null;
  private buffers: WebGLBuffer[] = [];
  private uProj!: WebGLUniformLocation | null;
  private uView!: WebGLUniformLocation | null;
  private uTime!: WebGLUniformLocation | null;
  private uFocal!: WebGLUniformLocation | null;
  private uDust!: WebGLUniformLocation | null;

  private count = 0;
  private nodePos: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private metas: MemoryMeta[] = [];
  private deg: Int32Array<ArrayBufferLike> = new Int32Array(0);
  private edges: number[] = [];
  private hub = -1;
  private slugIndex = new Map<string, number>();

  // Save-comet + flare state (drawn on the 2D overlay, sim clock seconds).
  private tNow = 0;
  private comets: { slug: string; from: [number, number, number]; t0: number }[] = [];
  private bursts: { slug: string; t0: number; big: boolean }[] = [];
  private lastFlare = new Map<string, number>();

  private proj: M4 = new Float32Array(16);
  private view: M4 = new Float32Array(16);
  private mT: M4 = new Float32Array(16);
  private mX: M4 = new Float32Array(16);
  private mY: M4 = new Float32Array(16);
  private tmp: M4 = new Float32Array(16);

  private yaw = 0.6;
  private pitch = -0.25;
  private dist = 1480;
  private dustFade = 1;
  private lastT = 0;
  private autoSpin = true;
  private filter: World | null = null;

  private W = 0;
  private H = 0;
  private dpr = 1;
  private focal = 1;

  private hover = -1;
  private selected = -1;
  private drag: { lx: number; ly: number; moved: boolean; node: number } | null = null;

  private raf = 0;
  private running = false;
  private visible = true;
  private t0 = 0;
  private ac = new AbortController();
  private tip: HTMLDivElement;
  private reduced: boolean;

  ok = false;

  constructor(
    private glc: HTMLCanvasElement,
    private ov: HTMLCanvasElement,
    private onOpen: (slug: string) => void,
  ) {
    this.tip = document.createElement("div");
    const gl = glc.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true });
    const octx = ov.getContext("2d");
    this.octx = octx;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!gl || !octx) return;
    this.gl = gl;

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("[galaxy] shader", gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VS);
    const fs = sh(gl.FRAGMENT_SHADER, FS);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog); gl.useProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[galaxy] link", gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }
    this.prog = prog;
    this.ok = true;
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.uProj = gl.getUniformLocation(prog, "uProj");
    this.uView = gl.getUniformLocation(prog, "uView");
    this.uTime = gl.getUniformLocation(prog, "uTime");
    this.uFocal = gl.getUniformLocation(prog, "uFocal");
    this.uDust = gl.getUniformLocation(prog, "uDust");
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    this.tip.className = "smui-galaxy-tip";
    glc.parentElement?.appendChild(this.tip);

    const opts = { signal: this.ac.signal };
    glc.addEventListener("pointerdown", this.onDown, opts);
    glc.addEventListener("pointermove", this.onMove, opts);
    glc.addEventListener("pointerup", this.onUp, opts);
    glc.addEventListener("pointerleave", this.onLeave, opts);
    glc.addEventListener("wheel", this.onWheel, { signal: this.ac.signal, passive: false });
  }

  destroy() {
    this.stop();
    this.ac.abort();
    this.tip.remove();
    const gl = this.gl;
    if (gl) {
      for (const b of this.buffers) gl.deleteBuffer(b);
      // Deleting our buffers/listeners is enough here. Forcing WEBGL_lose_context
      // can poison React StrictMode's immediate effect remount in dev and make the
      // next Galaxy boot report WebGL as unavailable.
    }
  }

  setAutoSpin(v: boolean) { this.autoSpin = v; }
  setFilter(w: World | null) { this.filter = w; }
  recenter() { this.yaw = 0.6; this.pitch = -0.25; this.dist = 1480; }

  setData(metas: MemoryMeta[]) {
    const gl = this.gl;
    if (!gl || !this.prog) return;
    const N = metas.length;
    const model = buildGalaxyModel(metas);
    const worlds = model.worlds;
    const deg = model.deg;
    const nodePos = model.nodePos;
    this.metas = model.metas;
    this.edges = model.edges;
    this.deg = model.deg;
    this.hub = model.hub;
    this.nodePos = model.nodePos;
    this.slugIndex = model.slugIndex;

    // interleaved particle attributes: dust + nodes. Dust comes from a fixed
    // seed: growing the vault appends new motes without moving existing ones.
    const dustN = Math.min(DUST_MAX, Math.max(DUST_MIN, N * DUST_PER_NOTE));
    const P = dustN + N;
    this.count = P;
    const aPos = new Float32Array(P * 3), aCol = new Float32Array(P * 3);
    const aSize = new Float32Array(P), aSeed = new Float32Array(P);
    const aHeat = new Float32Array(P);
    const aKind = new Float32Array(P);
    aKind.fill(1, 0, dustN); // dust fades on fly-in; nodes (0) never do
    const rand = mulberry32(0xc0ffee);
    for (let i = 0; i < dustN; i++) {
      const u = rand() * 2 - 1, th = rand() * TWO_PI, sp = Math.sqrt(1 - u * u);
      const r = ORB_R * Math.pow(rand(), 0.55) * (0.9 + 0.2 * rand());
      let x = r * sp * Math.cos(th), y = r * u * 0.92, z = r * sp * Math.sin(th);
      x += Math.sin(y * 0.01) * 22; z += Math.cos(y * 0.011) * 22;
      aPos[i*3]=x; aPos[i*3+1]=y; aPos[i*3+2]=z;
      const b = 0.33 + 0.27 * rand();
      const coreT = 1 - r / ORB_R;
      aCol[i*3]=(0.22 + coreT*0.38)*b; aCol[i*3+1]=(0.76 + coreT*0.22)*b; aCol[i*3+2]=0.88*b;
      aSize[i] = 10 + rand() * 14;
      aSeed[i] = rand();
      aHeat[i] = 0.55; // dust is heat-neutral
    }
    for (let i = 0; i < N; i++) {
      const p = dustN + i, c = WORLDS[worlds[i]].rgb;
      const rng = mulberry32(hashStr(metas[i].slug) ^ 0x9e3779b9);
      aPos[p*3]=nodePos[i*3]; aPos[p*3+1]=nodePos[i*3+1]; aPos[p*3+2]=nodePos[i*3+2];
      aCol[p*3]=c[0]*1.25; aCol[p*3+1]=c[1]*1.25; aCol[p*3+2]=c[2]*1.25;
      aSize[p] = 66 + Math.sqrt(deg[i]) * 30 + (metas[i].slug === "ship-memory" ? 44 : 0);
      aSeed[p] = rng();
      aHeat[p] = heatOf(metas[i].modified);
    }

    for (const b of this.buffers) gl.deleteBuffer(b);
    this.buffers = [];
    const bind = (data: Float32Array, attr: string, size: number) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(this.prog!, attr);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      this.buffers.push(b);
    };
    bind(aPos, "aPos", 3); bind(aCol, "aColor", 3); bind(aSize, "aSize", 1); bind(aSeed, "aSeed", 1); bind(aHeat, "aHeat", 1); bind(aKind, "aKind", 1);

    this.resize();
    this.start();
  }

  setVisible(v: boolean) {
    this.visible = v;
    if (v) { this.resize(); this.start(); } else this.stop();
  }

  resize() {
    const host = this.glc.parentElement;
    if (!host || !this.gl) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = w; this.H = h;
    for (const c of [this.glc, this.ov]) {
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
      c.style.width = `${w}px`; c.style.height = `${h}px`;
    }
    this.gl.viewport(0, 0, this.glc.width, this.glc.height);
    this.focal = this.glc.height * 0.5;
  }

  private buildView() {
    transl(this.mT, 0, 0, -this.dist);
    rotX(this.mX, this.pitch);
    rotY(this.mY, this.yaw);
    mul(this.tmp, this.mX, this.mY);
    mul(this.view, this.mT, this.tmp);
  }

  private project(x: number, y: number, z: number): [number, number, number, boolean] {
    const v = this.view, p = this.proj;
    const vx = v[0]*x+v[4]*y+v[8]*z+v[12];
    const vy = v[1]*x+v[5]*y+v[9]*z+v[13];
    const vz = v[2]*x+v[6]*y+v[10]*z+v[14];
    const vw = v[3]*x+v[7]*y+v[11]*z+v[15];
    const cx = p[0]*vx+p[4]*vy+p[8]*vz+p[12]*vw;
    const cy = p[1]*vx+p[5]*vy+p[9]*vz+p[13]*vw;
    const cw = p[3]*vx+p[7]*vy+p[11]*vz+p[15]*vw;
    if (cw <= 0.01) return [0, 0, 0, false];
    // device px — the overlay canvas is dpr-scaled
    return [
      (cx/cw*0.5+0.5)*this.W*this.dpr,
      (1-(cy/cw*0.5+0.5))*this.H*this.dpr,
      this.focal/(-vz),
      true,
    ];
  }

  private start() {
    if (this.running || !this.visible || !this.gl) return;
    this.running = true;
    this.t0 = this.t0 || performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.render((now - this.t0) / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop() { this.running = false; cancelAnimationFrame(this.raf); }

  /** New note saved → streak a comet in from deep space and land on it. */
  comet(slug: string) {
    if (!this.visible || this.reduced) return;
    const i = this.slugIndex.get(slug);
    if (i === undefined) return;
    const u = Math.random() * 2 - 1, th = Math.random() * TWO_PI;
    const sp = Math.sqrt(1 - u * u), R = 2600;
    this.comets.push({
      slug,
      from: [
        this.nodePos[i*3] + R * sp * Math.cos(th),
        this.nodePos[i*3+1] + R * u,
        this.nodePos[i*3+2] + R * sp * Math.sin(th),
      ],
      t0: this.tNow,
    });
  }

  /** Existing note saved → quick ring-flare on its star (throttled per note). */
  flare(slug: string) {
    if (!this.visible || this.reduced) return;
    const last = this.lastFlare.get(slug) ?? -Infinity;
    if (this.tNow - last < 10) return;
    this.lastFlare.set(slug, this.tNow);
    this.bursts.push({ slug, t0: this.tNow, big: false });
  }

  private render(t: number) {
    const gl = this.gl;
    if (!gl || !this.count) return;
    this.tNow = t;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    if (this.autoSpin && !this.reduced) this.yaw += 0.0016;
    // Fly-in focus: ease the dust toward hidden when inside DUST_FADE_NEAR,
    // toward visible past DUST_FADE_FAR (temporal ease = no pop on a flick).
    const k = Math.min(1, Math.max(0, (this.dist - DUST_FADE_NEAR) / (DUST_FADE_FAR - DUST_FADE_NEAR)));
    const target = k * k * (3 - 2 * k);
    this.dustFade += (target - this.dustFade) * (this.reduced ? 1 : Math.min(1, dt * 5));
    perspective(this.proj, (58 * Math.PI) / 180, this.W / this.H, 8, 5000);
    this.buildView();
    gl.clearColor(0.016, 0.027, 0.047, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix4fv(this.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.uView, false, this.view);
    gl.uniform1f(this.uTime, this.reduced ? 0.5 : t);
    gl.uniform1f(this.uFocal, this.focal * 1.4);
    gl.uniform1f(this.uDust, this.dustFade);
    gl.drawArrays(gl.POINTS, 0, this.count);
    this.drawOverlay();
  }

  private drawOverlay() {
    const g = this.octx, ov = this.ov, s = this.dpr;
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, ov.width, ov.height);
    const cx = ov.width / 2, cy = ov.height / 2, R = Math.min(ov.width, ov.height) * 0.34;
    g.strokeStyle = "#4bd0e0"; g.lineWidth = 1 * s;
    g.globalAlpha = 0.12; g.beginPath(); g.arc(cx, cy, R, 0, TWO_PI); g.stroke();
    g.globalAlpha = 0.06; g.beginPath(); g.moveTo(ov.width * 0.06, cy); g.lineTo(ov.width * 0.94, cy); g.stroke();
    g.globalAlpha = 0.18; const tk = 8 * s;
    for (const a of [0, Math.PI/2, Math.PI, 3*Math.PI/2]) {
      const ox = Math.cos(a), oy = Math.sin(a);
      g.beginPath(); g.moveTo(cx+ox*(R-tk), cy+oy*(R-tk)); g.lineTo(cx+ox*(R+tk), cy+oy*(R+tk)); g.stroke();
    }
    // links
    g.lineWidth = 1 * s;
    for (let e = 0; e < this.edges.length; e += 2) {
      const i = this.edges[e], j = this.edges[e + 1];
      const a = this.project(this.nodePos[i*3], this.nodePos[i*3+1], this.nodePos[i*3+2]);
      const b = this.project(this.nodePos[j*3], this.nodePos[j*3+1], this.nodePos[j*3+2]);
      if (!a[3] || !b[3]) continue;
      const lit = this.hover >= 0 && (i === this.hover || j === this.hover);
      g.globalAlpha = lit ? 0.6 : 0.12;
      g.strokeStyle = lit ? "#8ff3fb" : "#3a5f68";
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    // save-comets: streak in from deep space, land, then burst
    this.comets = this.comets.filter((c) => {
      const i = this.slugIndex.get(c.slug);
      if (i === undefined) return false;
      const tc = (this.tNow - c.t0) / 1.3;
      if (tc >= 1) { this.bursts.push({ slug: c.slug, t0: this.tNow, big: true }); return false; }
      const ease = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
      const at = (k: number): [number, number, number] => {
        const e = ease(k);
        return [
          c.from[0] + (this.nodePos[i*3] - c.from[0]) * e,
          c.from[1] + (this.nodePos[i*3+1] - c.from[1]) * e,
          c.from[2] + (this.nodePos[i*3+2] - c.from[2]) * e,
        ];
      };
      const hd = at(tc), tl = at(tc - 0.16);
      const hp = this.project(hd[0], hd[1], hd[2]);
      const tp = this.project(tl[0], tl[1], tl[2]);
      if (!hp[3]) return true;
      if (tp[3]) {
        // trail: wide faint pass + narrow bright pass
        g.globalAlpha = 0.25; g.strokeStyle = "#5be6f2"; g.lineWidth = 5 * s;
        g.beginPath(); g.moveTo(tp[0], tp[1]); g.lineTo(hp[0], hp[1]); g.stroke();
        g.globalAlpha = 0.85; g.strokeStyle = "#eafcff"; g.lineWidth = 1.8 * s;
        g.beginPath(); g.moveTo(tp[0], tp[1]); g.lineTo(hp[0], hp[1]); g.stroke();
      }
      const hr = 7 * s;
      const rg = g.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], hr);
      rg.addColorStop(0, "rgba(255,255,255,0.95)");
      rg.addColorStop(0.4, "rgba(91,230,242,0.55)");
      rg.addColorStop(1, "rgba(91,230,242,0)");
      g.globalAlpha = 1; g.fillStyle = rg;
      g.beginPath(); g.arc(hp[0], hp[1], hr, 0, TWO_PI); g.fill();
      return true;
    });

    // landing bursts + save flares: expanding ring in the note's world colour
    this.bursts = this.bursts.filter((b) => {
      const i = this.slugIndex.get(b.slug);
      if (i === undefined) return false;
      const d = (this.tNow - b.t0) / (b.big ? 0.7 : 0.45);
      if (d >= 1) return false;
      const p = this.project(this.nodePos[i*3], this.nodePos[i*3+1], this.nodePos[i*3+2]);
      if (!p[3]) return true;
      const col = WORLDS[worldOf(this.metas[i])].color;
      const R = (b.big ? 46 : 20) * s * d + 4 * s;
      g.globalAlpha = (1 - d) * 0.9;
      g.strokeStyle = col; g.lineWidth = (b.big ? 2 : 1.5) * s;
      g.beginPath(); g.arc(p[0], p[1], R, 0, TWO_PI); g.stroke();
      if (b.big) {
        g.globalAlpha = (1 - d) * 0.5;
        g.beginPath(); g.arc(p[0], p[1], R * 0.55, 0, TWO_PI); g.stroke();
      }
      return true;
    });

    // label + ring for hovered/selected
    const lab = (i: number) => {
      if (i < 0 || i >= this.metas.length) return;
      const p = this.project(this.nodePos[i*3], this.nodePos[i*3+1], this.nodePos[i*3+2]);
      if (!p[3]) return;
      g.globalAlpha = 0.9;
      g.strokeStyle = WORLDS[worldOf(this.metas[i])].color;
      g.lineWidth = 1.5 * s;
      g.beginPath(); g.arc(p[0], p[1], Math.max(10 * s, 22 * s * p[2]), 0, TWO_PI); g.stroke();
      g.globalAlpha = 1; g.fillStyle = "#eafcff";
      g.font = `${12 * s}px ui-monospace, Menlo, monospace`; g.textAlign = "center";
      const ti = this.metas[i].title;
      g.fillText(ti.length > 30 ? ti.slice(0, 29) + "…" : ti, p[0], p[1] - Math.max(16 * s, 26 * s * p[2]));
    };
    if (this.selected >= 0 && this.selected !== this.hover) lab(this.selected);
    if (this.hover >= 0) lab(this.hover);
    g.globalAlpha = 1;
  }

  private pick(mx: number, my: number): number {
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.metas.length; i++) {
      if (this.filter && worldOf(this.metas[i]) !== this.filter) continue;
      const p = this.project(this.nodePos[i*3], this.nodePos[i*3+1], this.nodePos[i*3+2]);
      if (!p[3]) continue;
      const rr = Math.max(14, 26 * p[2]);
      const dx = p[0]/this.dpr - mx, dy = p[1]/this.dpr - my, d2 = dx*dx + dy*dy;
      if (d2 <= rr*rr && d2 < bd) { best = i; bd = d2; }
    }
    return best;
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.glc.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private onDown = (e: PointerEvent) => {
    this.glc.setPointerCapture(e.pointerId);
    const [mx, my] = this.local(e);
    this.drag = { lx: e.clientX, ly: e.clientY, moved: false, node: this.pick(mx, my) };
    this.glc.classList.add("is-dragging");
  };

  private onMove = (e: PointerEvent) => {
    if (this.drag) {
      const dx = e.clientX - this.drag.lx, dy = e.clientY - this.drag.ly;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.drag.moved = true;
      this.drag.lx = e.clientX; this.drag.ly = e.clientY;
      if (this.drag.moved) {
        this.yaw += dx * 0.006;
        this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch + dy * 0.006));
      }
      return;
    }
    const [mx, my] = this.local(e);
    const i = this.pick(mx, my);
    if (i !== this.hover) { this.hover = i; this.glc.classList.toggle("is-picking", i >= 0); }
    if (i >= 0) {
      this.tip.textContent = this.metas[i].title;
      this.tip.style.left = `${mx}px`; this.tip.style.top = `${my}px`;
      this.tip.classList.add("is-shown");
    } else this.tip.classList.remove("is-shown");
  };

  private onUp = () => {
    const d = this.drag;
    this.drag = null;
    this.glc.classList.remove("is-dragging");
    if (d && !d.moved && d.node >= 0) {
      this.selected = d.node;
      this.onOpen(this.metas[d.node].slug);
    }
  };

  private onLeave = () => {
    this.hover = -1;
    this.tip.classList.remove("is-shown");
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.dist = Math.max(70, Math.min(3400, this.dist * Math.exp(e.deltaY * 0.0022)));
  };
}

class GalaxyCanvas2D implements GalaxySim {
  private ctx: CanvasRenderingContext2D | null = null;
  private metas: MemoryMeta[] = [];
  private worlds: World[] = [];
  private edges: number[] = [];
  private deg: Int32Array<ArrayBufferLike> = new Int32Array(0);
  private nodePos: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private slugIndex = new Map<string, number>();
  private dustPos = new Float32Array(0);
  private dustSeed = new Float32Array(0);
  private dustSize = new Float32Array(0);

  private proj: M4 = new Float32Array(16);
  private view: M4 = new Float32Array(16);
  private mT: M4 = new Float32Array(16);
  private mX: M4 = new Float32Array(16);
  private mY: M4 = new Float32Array(16);
  private tmp: M4 = new Float32Array(16);

  private yaw = 0.6;
  private pitch = -0.25;
  private dist = 1480;
  private autoSpin = true;
  private filter: World | null = null;

  private W = 0;
  private H = 0;
  private dpr = 1;
  private focal = 1;

  private hover = -1;
  private selected = -1;
  private drag: { lx: number; ly: number; moved: boolean; node: number } | null = null;

  private raf = 0;
  private running = false;
  private visible = true;
  private t0 = 0;
  private lastT = 0;
  private tNow = 0;
  private ac = new AbortController();
  private tip: HTMLDivElement = document.createElement("div");
  private reduced: boolean;
  private comets: { slug: string; from: [number, number, number]; t0: number }[] = [];
  private bursts: { slug: string; t0: number; big: boolean }[] = [];
  private lastFlare = new Map<string, number>();

  ok = false;

  constructor(
    private glc: HTMLCanvasElement,
    private ov: HTMLCanvasElement,
    private onOpen: (slug: string) => void,
  ) {
    this.ctx = ov.getContext("2d");
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!this.ctx) return;
    this.ok = true;
    this.tip.className = "smui-galaxy-tip";
    glc.parentElement?.appendChild(this.tip);

    const opts = { signal: this.ac.signal };
    glc.addEventListener("pointerdown", this.onDown, opts);
    glc.addEventListener("pointermove", this.onMove, opts);
    glc.addEventListener("pointerup", this.onUp, opts);
    glc.addEventListener("pointerleave", this.onLeave, opts);
    glc.addEventListener("wheel", this.onWheel, { signal: this.ac.signal, passive: false });
  }

  destroy() {
    this.stop();
    this.ac.abort();
    this.tip.remove();
    this.ctx?.clearRect(0, 0, this.ov.width, this.ov.height);
  }

  setAutoSpin(v: boolean) { this.autoSpin = v; }
  setFilter(w: World | null) { this.filter = w; }
  recenter() { this.yaw = 0.6; this.pitch = -0.25; this.dist = 1480; }

  setData(metas: MemoryMeta[]) {
    const model = buildGalaxyModel(metas);
    this.metas = model.metas;
    this.worlds = model.worlds;
    this.edges = model.edges;
    this.deg = model.deg;
    this.nodePos = model.nodePos;
    this.slugIndex = model.slugIndex;

    // Canvas fallback keeps a smaller stable dust field so it remains cheap
    // even inside a constrained WebView.
    const dustN = Math.min(2200, Math.max(320, metas.length * 32));
    this.dustPos = new Float32Array(dustN * 3);
    this.dustSeed = new Float32Array(dustN);
    this.dustSize = new Float32Array(dustN);
    const rand = mulberry32(0xc0ffee);
    for (let i = 0; i < dustN; i++) {
      const u = rand() * 2 - 1, th = rand() * TWO_PI, sp = Math.sqrt(1 - u * u);
      const r = ORB_R * Math.pow(rand(), 0.55) * (0.9 + 0.2 * rand());
      let x = r * sp * Math.cos(th), y = r * u * 0.92, z = r * sp * Math.sin(th);
      x += Math.sin(y * 0.01) * 22; z += Math.cos(y * 0.011) * 22;
      this.dustPos[i*3]=x; this.dustPos[i*3+1]=y; this.dustPos[i*3+2]=z;
      this.dustSeed[i] = rand();
      this.dustSize[i] = 0.7 + rand() * 1.8;
    }

    this.resize();
    this.start();
  }

  setVisible(v: boolean) {
    this.visible = v;
    if (v) { this.resize(); this.start(); } else this.stop();
  }

  resize() {
    const host = this.glc.parentElement;
    if (!host) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = w; this.H = h;
    for (const c of [this.glc, this.ov]) {
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
      c.style.width = `${w}px`; c.style.height = `${h}px`;
    }
    this.focal = this.ov.height * 0.5;
  }

  comet(slug: string) {
    if (!this.visible || this.reduced) return;
    const i = this.slugIndex.get(slug);
    if (i === undefined) return;
    const u = Math.random() * 2 - 1, th = Math.random() * TWO_PI;
    const sp = Math.sqrt(1 - u * u), R = 2600;
    this.comets.push({
      slug,
      from: [
        this.nodePos[i*3] + R * sp * Math.cos(th),
        this.nodePos[i*3+1] + R * u,
        this.nodePos[i*3+2] + R * sp * Math.sin(th),
      ],
      t0: this.tNow,
    });
  }

  flare(slug: string) {
    if (!this.visible || this.reduced) return;
    const last = this.lastFlare.get(slug) ?? -Infinity;
    if (this.tNow - last < 10) return;
    this.lastFlare.set(slug, this.tNow);
    this.bursts.push({ slug, t0: this.tNow, big: false });
  }

  private start() {
    if (this.running || !this.visible || !this.ctx) return;
    this.running = true;
    this.t0 = this.t0 || performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.render((now - this.t0) / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop() { this.running = false; cancelAnimationFrame(this.raf); }

  private buildView() {
    transl(this.mT, 0, 0, -this.dist);
    rotX(this.mX, this.pitch);
    rotY(this.mY, this.yaw);
    mul(this.tmp, this.mX, this.mY);
    mul(this.view, this.mT, this.tmp);
  }

  private project(x: number, y: number, z: number): [number, number, number, boolean] {
    const v = this.view, p = this.proj;
    const vx = v[0]*x+v[4]*y+v[8]*z+v[12];
    const vy = v[1]*x+v[5]*y+v[9]*z+v[13];
    const vz = v[2]*x+v[6]*y+v[10]*z+v[14];
    const vw = v[3]*x+v[7]*y+v[11]*z+v[15];
    const cx = p[0]*vx+p[4]*vy+p[8]*vz+p[12]*vw;
    const cy = p[1]*vx+p[5]*vy+p[9]*vz+p[13]*vw;
    const cw = p[3]*vx+p[7]*vy+p[11]*vz+p[15]*vw;
    if (cw <= 0.01) return [0, 0, 0, false];
    return [
      (cx/cw*0.5+0.5)*this.W*this.dpr,
      (1-(cy/cw*0.5+0.5))*this.H*this.dpr,
      this.focal/(-vz),
      true,
    ];
  }

  private render(t: number) {
    const g = this.ctx;
    if (!g) return;
    if (!this.W || !this.H) this.resize();
    if (!this.W || !this.H) return;
    this.tNow = t;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    if (this.autoSpin && !this.reduced) this.yaw += 0.0018 + dt * 0.0005;
    perspective(this.proj, (58 * Math.PI) / 180, this.W / this.H, 8, 5000);
    this.buildView();
    this.drawFrame(t);
  }

  private nodeRadius(i: number, scale: number): number {
    const hubBoost = this.metas[i]?.slug === "ship-memory" ? 8 : 0;
    return Math.max(4 * this.dpr, (13 + Math.sqrt(this.deg[i] || 0) * 4 + hubBoost) * scale);
  }

  private drawFrame(t: number) {
    const g = this.ctx;
    if (!g) return;
    const w = this.ov.width, h = this.ov.height, s = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);

    const bg = g.createRadialGradient(w * 0.5, h * 0.48, 0, w * 0.5, h * 0.48, Math.max(w, h) * 0.72);
    bg.addColorStop(0, "rgba(8, 28, 36, 0.78)");
    bg.addColorStop(0.48, "rgba(2, 10, 17, 0.88)");
    bg.addColorStop(1, "rgba(1, 5, 10, 0.98)");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    this.drawHud(g, w, h, s);

    g.save();
    g.globalCompositeOperation = "lighter";
    this.drawDust(g, t, s);
    this.drawLinks(g, s);
    this.drawNodes(g, s);
    this.drawCometsAndBursts(g, s);
    g.restore();

    if (this.selected >= 0 && this.selected !== this.hover) this.drawLabel(g, this.selected, s);
    if (this.hover >= 0) this.drawLabel(g, this.hover, s);
    g.globalAlpha = 1;
    g.shadowBlur = 0;
  }

  private drawHud(g: CanvasRenderingContext2D, w: number, h: number, s: number) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.34;
    g.strokeStyle = "#4bd0e0"; g.lineWidth = 1 * s;
    g.globalAlpha = 0.12; g.beginPath(); g.arc(cx, cy, R, 0, TWO_PI); g.stroke();
    g.globalAlpha = 0.05;
    for (let i = 1; i <= 2; i++) {
      g.beginPath(); g.arc(cx, cy, R * (1 + i * 0.22), 0, TWO_PI); g.stroke();
    }
    g.globalAlpha = 0.06; g.beginPath(); g.moveTo(w * 0.06, cy); g.lineTo(w * 0.94, cy); g.stroke();
    g.globalAlpha = 0.18; const tk = 8 * s;
    for (const a of [0, Math.PI/2, Math.PI, 3*Math.PI/2]) {
      const ox = Math.cos(a), oy = Math.sin(a);
      g.beginPath(); g.moveTo(cx+ox*(R-tk), cy+oy*(R-tk)); g.lineTo(cx+ox*(R+tk), cy+oy*(R+tk)); g.stroke();
    }
    g.globalAlpha = 1;
  }

  private drawDust(g: CanvasRenderingContext2D, t: number, s: number) {
    g.fillStyle = "#5be6f2";
    for (let i = 0; i < this.dustSeed.length; i++) {
      const p = this.project(this.dustPos[i*3], this.dustPos[i*3+1], this.dustPos[i*3+2]);
      if (!p[3]) continue;
      const pulse = this.reduced ? 0.78 : 0.58 + 0.42 * Math.sin(t * 0.85 + this.dustSeed[i] * TWO_PI);
      const alpha = Math.max(0.03, Math.min(0.22, p[2] * 0.11)) * pulse;
      const r = Math.max(0.55 * s, this.dustSize[i] * p[2]);
      g.globalAlpha = alpha;
      g.beginPath(); g.arc(p[0], p[1], r, 0, TWO_PI); g.fill();
    }
    g.globalAlpha = 1;
  }

  private drawLinks(g: CanvasRenderingContext2D, s: number) {
    g.lineWidth = 1 * s;
    for (let e = 0; e < this.edges.length; e += 2) {
      const i = this.edges[e], j = this.edges[e + 1];
      const wi = worldOf(this.metas[i]), wj = worldOf(this.metas[j]);
      const dimmedByFilter = this.filter && wi !== this.filter && wj !== this.filter;
      const a = this.project(this.nodePos[i*3], this.nodePos[i*3+1], this.nodePos[i*3+2]);
      const b = this.project(this.nodePos[j*3], this.nodePos[j*3+1], this.nodePos[j*3+2]);
      if (!a[3] || !b[3]) continue;
      const lit = this.hover >= 0 && (i === this.hover || j === this.hover);
      g.globalAlpha = dimmedByFilter ? 0.025 : lit ? 0.52 : 0.12;
      g.strokeStyle = lit ? "#8ff3fb" : "#3a5f68";
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    g.globalAlpha = 1;
  }

  private drawNodes(g: CanvasRenderingContext2D, s: number) {
    for (let i = 0; i < this.metas.length; i++) {
      const w = this.worlds[i];
      const p = this.project(this.nodePos[i*3], this.nodePos[i*3+1], this.nodePos[i*3+2]);
      if (!p[3]) continue;
      const dim = this.filter !== null && w !== this.filter;
      const heat = heatOf(this.metas[i].modified);
      const r = this.nodeRadius(i, p[2]);
      const col = WORLDS[w].color;
      const active = i === this.hover || i === this.selected;

      g.globalAlpha = dim ? 0.12 : 0.42 + heat * 0.48;
      g.shadowBlur = dim ? 0 : (active ? 26 : 15) * s;
      g.shadowColor = col;
      g.fillStyle = col;
      g.beginPath(); g.arc(p[0], p[1], active ? r * 1.2 : r, 0, TWO_PI); g.fill();

      g.globalAlpha = dim ? 0.08 : 0.72;
      g.shadowBlur = dim ? 0 : 10 * s;
      g.fillStyle = "#eafcff";
      g.beginPath(); g.arc(p[0], p[1], Math.max(1.5 * s, r * 0.24), 0, TWO_PI); g.fill();
    }
    g.globalAlpha = 1;
    g.shadowBlur = 0;
  }

  private drawCometsAndBursts(g: CanvasRenderingContext2D, s: number) {
    this.comets = this.comets.filter((c) => {
      const i = this.slugIndex.get(c.slug);
      if (i === undefined) return false;
      const tc = (this.tNow - c.t0) / 1.3;
      if (tc >= 1) { this.bursts.push({ slug: c.slug, t0: this.tNow, big: true }); return false; }
      const ease = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
      const at = (k: number): [number, number, number] => {
        const e = ease(k);
        return [
          c.from[0] + (this.nodePos[i*3] - c.from[0]) * e,
          c.from[1] + (this.nodePos[i*3+1] - c.from[1]) * e,
          c.from[2] + (this.nodePos[i*3+2] - c.from[2]) * e,
        ];
      };
      const hd = at(tc), tl = at(tc - 0.16);
      const hp = this.project(hd[0], hd[1], hd[2]);
      const tp = this.project(tl[0], tl[1], tl[2]);
      if (!hp[3]) return true;
      if (tp[3]) {
        g.globalAlpha = 0.28; g.strokeStyle = "#5be6f2"; g.lineWidth = 5 * s;
        g.beginPath(); g.moveTo(tp[0], tp[1]); g.lineTo(hp[0], hp[1]); g.stroke();
        g.globalAlpha = 0.9; g.strokeStyle = "#eafcff"; g.lineWidth = 1.8 * s;
        g.beginPath(); g.moveTo(tp[0], tp[1]); g.lineTo(hp[0], hp[1]); g.stroke();
      }
      const hr = 7 * s;
      const rg = g.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], hr);
      rg.addColorStop(0, "rgba(255,255,255,0.95)");
      rg.addColorStop(0.4, "rgba(91,230,242,0.55)");
      rg.addColorStop(1, "rgba(91,230,242,0)");
      g.globalAlpha = 1; g.fillStyle = rg;
      g.beginPath(); g.arc(hp[0], hp[1], hr, 0, TWO_PI); g.fill();
      return true;
    });

    this.bursts = this.bursts.filter((b) => {
      const i = this.slugIndex.get(b.slug);
      if (i === undefined) return false;
      const d = (this.tNow - b.t0) / (b.big ? 0.7 : 0.45);
      if (d >= 1) return false;
      const p = this.project(this.nodePos[i*3], this.nodePos[i*3+1], this.nodePos[i*3+2]);
      if (!p[3]) return true;
      const col = WORLDS[worldOf(this.metas[i])].color;
      const R = (b.big ? 46 : 20) * s * d + 4 * s;
      g.globalAlpha = (1 - d) * 0.9;
      g.strokeStyle = col; g.lineWidth = (b.big ? 2 : 1.5) * s;
      g.beginPath(); g.arc(p[0], p[1], R, 0, TWO_PI); g.stroke();
      if (b.big) {
        g.globalAlpha = (1 - d) * 0.5;
        g.beginPath(); g.arc(p[0], p[1], R * 0.55, 0, TWO_PI); g.stroke();
      }
      return true;
    });
    g.globalAlpha = 1;
  }

  private drawLabel(g: CanvasRenderingContext2D, i: number, s: number) {
    if (i < 0 || i >= this.metas.length) return;
    const p = this.project(this.nodePos[i*3], this.nodePos[i*3+1], this.nodePos[i*3+2]);
    if (!p[3]) return;
    g.globalAlpha = 0.9;
    g.strokeStyle = WORLDS[worldOf(this.metas[i])].color;
    g.lineWidth = 1.5 * s;
    g.beginPath(); g.arc(p[0], p[1], Math.max(10 * s, 22 * s * p[2]), 0, TWO_PI); g.stroke();
    g.globalAlpha = 1; g.fillStyle = "#eafcff";
    g.font = `${12 * s}px ui-monospace, Menlo, monospace`; g.textAlign = "center";
    const ti = this.metas[i].title;
    g.fillText(ti.length > 30 ? ti.slice(0, 29) + "..." : ti, p[0], p[1] - Math.max(16 * s, 26 * s * p[2]));
  }

  private pick(mx: number, my: number): number {
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.metas.length; i++) {
      if (this.filter && worldOf(this.metas[i]) !== this.filter) continue;
      const p = this.project(this.nodePos[i*3], this.nodePos[i*3+1], this.nodePos[i*3+2]);
      if (!p[3]) continue;
      const rr = Math.max(14, this.nodeRadius(i, p[2]) / this.dpr + 6);
      const dx = p[0]/this.dpr - mx, dy = p[1]/this.dpr - my, d2 = dx*dx + dy*dy;
      if (d2 <= rr*rr && d2 < bd) { best = i; bd = d2; }
    }
    return best;
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.glc.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private onDown = (e: PointerEvent) => {
    this.glc.setPointerCapture(e.pointerId);
    const [mx, my] = this.local(e);
    this.drag = { lx: e.clientX, ly: e.clientY, moved: false, node: this.pick(mx, my) };
    this.glc.classList.add("is-dragging");
  };

  private onMove = (e: PointerEvent) => {
    if (this.drag) {
      const dx = e.clientX - this.drag.lx, dy = e.clientY - this.drag.ly;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.drag.moved = true;
      this.drag.lx = e.clientX; this.drag.ly = e.clientY;
      if (this.drag.moved) {
        this.yaw += dx * 0.006;
        this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch + dy * 0.006));
      }
      return;
    }
    const [mx, my] = this.local(e);
    const i = this.pick(mx, my);
    if (i !== this.hover) { this.hover = i; this.glc.classList.toggle("is-picking", i >= 0); }
    if (i >= 0) {
      this.tip.textContent = this.metas[i].title;
      this.tip.style.left = `${mx}px`; this.tip.style.top = `${my}px`;
      this.tip.classList.add("is-shown");
    } else this.tip.classList.remove("is-shown");
  };

  private onUp = () => {
    const d = this.drag;
    this.drag = null;
    this.glc.classList.remove("is-dragging");
    if (d && !d.moved && d.node >= 0) {
      this.selected = d.node;
      this.onOpen(this.metas[d.node].slug);
    }
  };

  private onLeave = () => {
    this.hover = -1;
    this.tip.classList.remove("is-shown");
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.dist = Math.max(70, Math.min(3400, this.dist * Math.exp(e.deltaY * 0.0022)));
  };
}

export interface GraphViewProps {
  metas: MemoryMeta[];
  /** Pause the sim while the tab is hidden. */
  visible: boolean;
  onOpenNote: (slug: string) => void;
}

export function GraphView({ metas, visible, onOpenNote }: GraphViewProps) {
  const glRef = useRef<HTMLCanvasElement>(null);
  const ovRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<GalaxySim | null>(null);
  const openRef = useRef(onOpenNote);
  const legendId = useId();
  openRef.current = onOpenNote;
  const [filter, setFilter] = useState<World | null>(null);
  const [spin, setSpin] = useState(true);
  const [legendHidden, setLegendHidden] = useState(() => {
    try {
      return window.localStorage.getItem(LEGEND_PRIVACY_KEY) === "true";
    } catch {
      return false;
    }
  });

  const worlds = useMemo(() => {
    const count = new Map<World, number>();
    for (const m of metas) {
      const w = worldOf(m);
      count.set(w, (count.get(w) ?? 0) + 1);
    }
    return WORLD_ORDER.filter((w) => count.has(w)).map((w) => ({
      key: w, label: WORLDS[w].label, color: WORLDS[w].color, count: count.get(w) ?? 0,
    }));
  }, [metas]);

  useEffect(() => {
    const glc = glRef.current, ov = ovRef.current;
    if (!glc || !ov) return;
    let sim: GalaxySim | null = null;
    const makeCanvas = () => new GalaxyCanvas2D(glc, ov, (slug) => openRef.current(slug));
    try {
      const webgl = new GalaxyGL(glc, ov, (slug) => openRef.current(slug));
      if (webgl.ok) {
        sim = webgl;
      } else {
        webgl.destroy();
        sim = makeCanvas();
      }
    } catch (e) {
      console.warn("ShipMemory Galaxy view failed", e);
      sim?.destroy();
      sim = makeCanvas();
    }
    if (!sim.ok) {
      console.warn("ShipMemory Galaxy fallback could not initialize");
      sim.destroy();
      return;
    }
    simRef.current = sim;
    const ro = new ResizeObserver(() => sim?.resize());
    ro.observe(glc.parentElement!);
    return () => { ro.disconnect(); sim?.destroy(); simRef.current = null; };
  }, []);

  // On every vault refresh: rebuild the sky, then comet new notes in and
  // flare edited ones. First load just records the baseline (no fireworks).
  const knownRef = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.setData(metas);
    const known = knownRef.current;
    if (known) {
      for (const m of metas) {
        const was = known.get(m.slug);
        if (was === undefined) sim.comet(m.slug);
        else if (m.modified !== was) sim.flare(m.slug);
      }
    }
    knownRef.current = new Map(metas.map((m) => [m.slug, m.modified]));
  }, [metas]);
  useEffect(() => { simRef.current?.setVisible(visible); }, [visible]);
  useEffect(() => { simRef.current?.setFilter(filter); }, [filter]);
  useEffect(() => { simRef.current?.setAutoSpin(spin); }, [spin]);
  useEffect(() => {
    try {
      window.localStorage.setItem(LEGEND_PRIVACY_KEY, String(legendHidden));
    } catch {
      // Non-critical privacy preference; leave the current session state alone.
    }
  }, [legendHidden]);

  return (
    <div className="smui-graph smui-galaxy">
      <canvas ref={glRef} className="smui-galaxy-gl" />
      <canvas ref={ovRef} className="smui-galaxy-ov" />
      <span className="smui-galaxy-br tl" />
      <span className="smui-galaxy-br tr" />
      <span className="smui-galaxy-br bl" />
      <span className="smui-galaxy-br br" />
      <div className="smui-galaxy-head">
        <span className="smui-galaxy-online">Online</span>
        <span>Vault Oracle · {metas.length} signals</span>
      </div>
      <div className="smui-galaxy-controls">
        <button
          className={`smui-galaxy-ctl${spin ? " is-on" : ""}`}
          onClick={() => setSpin((s) => !s)}
        >
          Auto-spin
        </button>
        <button className="smui-galaxy-ctl" onClick={() => simRef.current?.recenter()}>
          Recenter
        </button>
      </div>
      <div className="smui-galaxy-legend">
        <button
          type="button"
          className={`smui-galaxy-privacy-toggle${legendHidden ? "" : " is-open"}`}
          aria-expanded={!legendHidden}
          aria-controls={legendId}
          aria-label={legendHidden ? "Show galaxy info" : "Hide galaxy info"}
          onClick={() => setLegendHidden((hidden) => !hidden)}
          title={legendHidden ? "Show galaxy info" : "Hide galaxy info"}
        >
          <IconChevronDown width={14} height={14} />
        </button>
        {!legendHidden && (
          <div id={legendId} className="smui-galaxy-worlds">
            {worlds.map((w) => (
              <button
                key={w.key}
                className={`smui-galaxy-world${filter === w.key ? " is-active" : ""}${
                  filter && filter !== w.key ? " is-dim" : ""
                }`}
                style={{ color: w.color }}
                onClick={() => setFilter((f) => (f === w.key ? null : w.key))}
                title={filter === w.key ? "Show all worlds" : `Isolate ${w.label}`}
              >
                <span className="smui-galaxy-swatch" style={{ background: w.color }} />
                <span className="smui-galaxy-wlabel">{w.label}</span>
                <span className="smui-galaxy-wn">{w.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
