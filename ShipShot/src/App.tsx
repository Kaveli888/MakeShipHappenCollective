import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Aperture,
  AppWindow,
  ArrowUpRight,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  Copy,
  Database,
  FolderOpen,
  Fullscreen,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  Keyboard,
  Library,
  Link2,
  Maximize2,
  MemoryStick,
  Monitor,
  MousePointer2,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Video,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { formatBytes, formatRelativeTime, isTauri } from "./lib/platform";
import { rememberCapture } from "./lib/shipMemory";
import { AnnotationEditor } from "./AnnotationEditor";
import { QuickAccess } from "./QuickAccess";
import { mouseButtonLabel, useMouseCapture } from "./hooks/useMouseCapture";
import type { Capture, CaptureMode, PendingCapture, ShortcutBinding, View } from "./types";

const bindings: ShortcutBinding[] = [
  { mode: "area", label: "Capture area", shortcut: "Alt+Shift+1" },
  { mode: "window", label: "Capture window", shortcut: "Alt+Shift+2" },
  { mode: "fullscreen", label: "Capture fullscreen", shortcut: "Alt+Shift+3" },
  { mode: "recording", label: "Record screen", shortcut: "Alt+Shift+4" },
];

const captureInfo: Record<CaptureMode, { label: string; hint: string }> = {
  area: { label: "Capture area", hint: "Select any region" },
  window: { label: "Capture window", hint: "Choose an app window" },
  fullscreen: { label: "Fullscreen", hint: "Capture every display" },
  recording: { label: "Record screen", hint: "Video, mic and clicks" },
};

type Toast = {
  tone: "success" | "error" | "neutral";
  message: string;
  action?: { label: string; run: () => void };
} | null;

function captureUrl(capture: Capture) {
  return isTauri() ? convertFileSrc(capture.path) : "";
}

export default function App() {
  const surface = new URLSearchParams(window.location.search).get("window");
  if (surface === "quick-access") return <QuickAccess />;
  if (surface === "annotation") return <AnnotationEditor />;
  return <MainApp />;
}

function MainApp() {
  const [view, setView] = useState<View>("capture");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [selected, setSelected] = useState<Capture | null>(null);
  const [capturing, setCapturing] = useState<CaptureMode | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [autoRemember, setAutoRemember] = useState(() => {
    if (localStorage.getItem("shipshot:24-hour-workspace") !== "enabled") {
      localStorage.setItem("shipshot:24-hour-workspace", "enabled");
      localStorage.setItem("shipshot:auto-remember", "false");
      return false;
    }
    return localStorage.getItem("shipshot:auto-remember") === "true";
  });
  const autoRememberRef = useRef(autoRemember);

  useEffect(() => {
    autoRememberRef.current = autoRemember;
    localStorage.setItem("shipshot:auto-remember", String(autoRemember));
  }, [autoRemember]);

  useEffect(() => {
    if (!isTauri()) return;
    invoke<Capture[]>("list_captures").then(setCaptures).catch((error) => {
      setToast({ tone: "error", message: String(error) });
    });
    const unlistenSaved = listen<Capture>("capture-saved", ({ payload }) => {
      setCaptures((items) => [payload, ...items.filter((item) => item.id !== payload.id)]);
    });
    const unlistenUpdated = listen<Capture>("capture-updated", ({ payload }) => {
      setCaptures((items) => items.map((item) => item.id === payload.id ? payload : item));
      setSelected((item) => item?.id === payload.id ? payload : item);
    });
    const unlistenPruned = listen<Capture[]>("captures-pruned", ({ payload }) => {
      setCaptures(payload);
      setSelected((item) => item && payload.some((capture) => capture.id === item.id) ? item : null);
    });
    return () => {
      void unlistenSaved.then((unlisten) => unlisten());
      void unlistenUpdated.then((unlisten) => unlisten());
      void unlistenPruned.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (toast.action) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const sendToMemory = useCallback(async (capture: Capture, quiet = false) => {
    if (!isTauri() || capture.remembered) return capture;
    try {
      const memory = await rememberCapture(capture);
      const updated = await invoke<Capture>("mark_remembered", {
        id: capture.id,
        memorySlug: memory.slug,
      });
      setCaptures((items) => items.map((item) => item.id === updated.id ? updated : item));
      setSelected((item) => item?.id === updated.id ? updated : item);
      if (!quiet) setToast({ tone: "success", message: "Saved to Ship Memory" });
      return updated;
    } catch (error) {
      setToast({ tone: "error", message: `Ship Memory: ${String(error)}` });
      return capture;
    }
  }, []);

  const runCapture = useCallback(async (mode: CaptureMode) => {
    if (capturing) return;
    if (!isTauri()) {
      setToast({ tone: "neutral", message: "Native capture runs inside the ShipShot Mac app." });
      return;
    }

    setCapturing(mode);
    try {
      await invoke<PendingCapture>("capture_screen", { mode });
    } catch (error) {
      const message = String(error);
      if (!message.toLowerCase().includes("cancel")) {
        const needsScreenAccess = message.toLowerCase().includes("screen recording permission");
        setToast({
          tone: "error",
          message,
          action: needsScreenAccess
            ? {
                label: "Open Settings",
                run: () => {
                  void invoke("open_screen_recording_settings");
                },
              }
            : undefined,
        });
      }
    } finally {
      setCapturing(null);
    }
  }, [capturing]);

  useEffect(() => {
    if (!isTauri()) return;
    const unlistenNavigate = listen<View>("tray-navigate", ({ payload }) => {
      setView(payload);
    });
    return () => {
      void unlistenNavigate.then((unlisten) => unlisten());
    };
  }, []);

  const removeCapture = useCallback(async (capture: Capture) => {
    if (!isTauri()) return;
    try {
      await invoke("delete_capture", { id: capture.id });
      setCaptures((items) => items.filter((item) => item.id !== capture.id));
      setSelected(null);
      setToast({ tone: "neutral", message: "Capture deleted" });
    } catch (error) {
      setToast({ tone: "error", message: String(error) });
    }
  }, []);

  const revealCapture = useCallback(async (capture: Capture) => {
    if (isTauri()) await invoke("reveal_capture", { id: capture.id });
  }, []);

  const copyCapture = useCallback(async (capture: Capture) => {
    if (!isTauri() || capture.mediaType !== "image") return;
    try {
      await invoke("copy_capture", { id: capture.id });
      setToast({ tone: "success", message: "Screenshot copied" });
    } catch (error) {
      setToast({ tone: "error", message: String(error) });
    }
  }, []);

  const filtered = captures.filter((capture) =>
    `${capture.filename} ${capture.mode}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="app-shell">
      <Sidebar view={view} onChange={setView} memoryCount={captures.filter((item) => item.remembered).length} />
      <main className="main-shell">
        <Titlebar view={view} query={query} onQuery={setQuery} />
        <div className="page-scroll">
          {view === "capture" && (
            <CaptureHome
              captures={filtered}
              capturing={capturing}
              autoRemember={autoRemember}
              onToggleMemory={() => setAutoRemember((value) => !value)}
              onCapture={runCapture}
              onSelect={setSelected}
              onShowLibrary={() => setView("library")}
            />
          )}
          {view === "library" && (
            <LibraryView captures={filtered} onCapture={runCapture} onSelect={setSelected} />
          )}
          {view === "memory" && (
            <MemoryView captures={captures} autoRemember={autoRemember} onToggle={() => setAutoRemember((value) => !value)} />
          )}
          {view === "shortcuts" && <ShortcutView onCapture={runCapture} />}
          {view === "settings" && (
            <SettingsView autoRemember={autoRemember} onToggle={() => setAutoRemember((value) => !value)} />
          )}
        </div>
      </main>

      {selected && (
        <CaptureInspector
          capture={selected}
          onClose={() => setSelected(null)}
          onRemember={() => void sendToMemory(selected)}
          onReveal={() => void revealCapture(selected)}
          onCopy={() => void copyCapture(selected)}
          onDelete={() => void removeCapture(selected)}
        />
      )}

      {toast && (
        <div className={`toast toast-${toast.tone}`}>
          {toast.tone === "success" ? <Check size={15} /> : toast.tone === "error" ? <Circle size={10} fill="currentColor" /> : <Zap size={14} />}
          <span>{toast.message}</span>
          {toast.action && <button onClick={toast.action.run}>{toast.action.label}</button>}
          {toast.action && <button className="toast-close" onClick={() => setToast(null)} title="Dismiss"><X size={13} /></button>}
        </div>
      )}
    </div>
  );
}

function Sidebar({ view, onChange, memoryCount }: { view: View; onChange: (view: View) => void; memoryCount: number }) {
  const top: Array<{ id: View; label: string; icon: typeof Aperture }> = [
    { id: "capture", label: "Capture", icon: Aperture },
    { id: "library", label: "Library", icon: Library },
    { id: "memory", label: "Ship Memory", icon: MemoryStick },
  ];
  const bottom: Array<{ id: View; label: string; icon: typeof Aperture }> = [
    { id: "shortcuts", label: "Mouse & shortcuts", icon: MousePointer2 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="sidebar">
      <div className="traffic-space" data-tauri-drag-region />
      <div className="brand-lockup">
        <div className="brand-mark"><Aperture size={19} strokeWidth={2.2} /></div>
        <div><strong>ShipShot</strong><span>Capture what matters</span></div>
      </div>
      <nav className="nav-stack">
        {top.map((item) => <NavItem key={item.id} {...item} active={view === item.id} onClick={() => onChange(item.id)} badge={item.id === "memory" && memoryCount ? memoryCount : undefined} />)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="memory-mini">
        <div className="memory-mini-icon"><Database size={16} /></div>
        <div><strong>Memory connected</strong><span>{memoryCount} captures remembered</span></div>
        <span className="status-dot" />
      </div>
      <nav className="nav-stack nav-bottom">
        {bottom.map((item) => <NavItem key={item.id} {...item} active={view === item.id} onClick={() => onChange(item.id)} />)}
      </nav>
      <div className="profile-row">
        <div className="avatar">JF</div>
        <div><strong>Jake Felton</strong><span>MakeShipHappen</span></div>
        <ChevronRight size={15} />
      </div>
    </aside>
  );
}

function NavItem({ label, icon: Icon, active, onClick, badge }: { label: string; icon: typeof Aperture; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={17} strokeWidth={1.9} />
      <span>{label}</span>
      {badge !== undefined && <em>{badge}</em>}
    </button>
  );
}

function Titlebar({ view, query, onQuery }: { view: View; query: string; onQuery: (value: string) => void }) {
  const titles: Record<View, string> = {
    capture: "Capture",
    library: "Capture Library",
    memory: "Ship Memory",
    shortcuts: "Mouse & Shortcuts",
    settings: "Settings",
  };
  return (
    <header className="titlebar" data-tauri-drag-region>
      <span data-tauri-drag-region>{titles[view]}</span>
      {(view === "capture" || view === "library") && (
        <label className="search-field">
          <Search size={14} />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search captures" />
          <kbd>⌘ K</kbd>
        </label>
      )}
      <button className="icon-button"><Sparkles size={16} /></button>
    </header>
  );
}

function CaptureHome({ captures, capturing, autoRemember, onToggleMemory, onCapture, onSelect, onShowLibrary }: {
  captures: Capture[];
  capturing: CaptureMode | null;
  autoRemember: boolean;
  onToggleMemory: () => void;
  onCapture: (mode: CaptureMode) => void;
  onSelect: (capture: Capture) => void;
  onShowLibrary: () => void;
}) {
  return (
    <div className="page capture-page">
      <section className="hero-row">
        <div>
          <div className="eyebrow"><span /> SHIPSHOT FOR MAC</div>
          <h1>Capture anything.<br /><em>Remember everything.</em></h1>
          <p>Every screenshot becomes searchable context—saved locally and connected through Ship Memory.</p>
        </div>
        <button className={`memory-toggle ${autoRemember ? "enabled" : ""}`} onClick={onToggleMemory}>
          <div className="toggle-icon"><MemoryStick size={18} /></div>
          <div><strong>Auto-remember</strong><span>{autoRemember ? "Every capture goes to Ship Memory" : "Captures stay in your local library"}</span></div>
          <i><span /></i>
        </button>
      </section>

      <section className="capture-grid">
        <CaptureButton mode="area" icon={Aperture} shortcut="⌥ ⇧ 1" active={capturing === "area"} onClick={() => onCapture("area")} primary />
        <CaptureButton mode="window" icon={AppWindow} shortcut="⌥ ⇧ 2" active={capturing === "window"} onClick={() => onCapture("window")} />
        <CaptureButton mode="fullscreen" icon={Fullscreen} shortcut="⌥ ⇧ 3" active={capturing === "fullscreen"} onClick={() => onCapture("fullscreen")} />
        <CaptureButton mode="recording" icon={Video} shortcut="⌥ ⇧ 4" active={capturing === "recording"} onClick={() => onCapture("recording")} />
      </section>

      <section className="recent-section">
        <div className="section-heading">
          <div><h2>Recent captures</h2><p>Your latest visual memories</p></div>
          <button onClick={onShowLibrary}>View library <ArrowUpRight size={14} /></button>
        </div>
        {captures.length ? (
          <CaptureGallery captures={captures.slice(0, 6)} onSelect={onSelect} />
        ) : (
          <EmptyLibrary onCapture={() => onCapture("area")} />
        )}
      </section>
    </div>
  );
}

function CaptureButton({ mode, icon: Icon, shortcut, active, onClick, primary }: {
  mode: CaptureMode;
  icon: typeof Aperture;
  shortcut: string;
  active: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  const info = captureInfo[mode];
  return (
    <button className={`capture-button ${primary ? "primary" : ""} ${active ? "working" : ""}`} onClick={onClick} disabled={active}>
      <div className="capture-icon"><Icon size={23} strokeWidth={1.8} /></div>
      <div><strong>{active ? "Capturing…" : info.label}</strong><span>{info.hint}</span></div>
      <kbd>{shortcut}</kbd>
    </button>
  );
}

function CaptureGallery({ captures, onSelect }: { captures: Capture[]; onSelect: (capture: Capture) => void }) {
  return (
    <div className="gallery-grid">
      {captures.map((capture) => (
        <button key={capture.id} className="capture-card" onClick={() => onSelect(capture)}>
          <div className="capture-preview">
            {capture.mediaType === "image" ? <img src={captureUrl(capture)} alt="" /> : <div className="video-placeholder"><Video size={30} /><span>Screen recording</span></div>}
            <span className="media-pill">{capture.mediaType === "video" ? <Video size={11} /> : <ImageIcon size={11} />}{capture.width && capture.height ? `${capture.width} × ${capture.height}` : capture.mode}</span>
            {capture.remembered && <span className="remembered-pill"><MemoryStick size={11} /> Remembered</span>}
          </div>
          <div className="capture-meta">
            <div><strong>{captureInfo[capture.mode].label}</strong><span>{formatRelativeTime(capture.createdAt)}</span></div>
            <span>{formatBytes(capture.fileSize)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function EmptyLibrary({ onCapture }: { onCapture: () => void }) {
  return (
    <div className="empty-library">
      <div className="empty-orbit"><Aperture size={28} /></div>
      <div><strong>Your visual memory starts here</strong><span>Take your first screenshot and ShipShot will keep the context.</span></div>
      <button onClick={onCapture}><Plus size={15} /> New capture</button>
    </div>
  );
}

function LibraryView({ captures, onCapture, onSelect }: { captures: Capture[]; onCapture: (mode: CaptureMode) => void; onSelect: (capture: Capture) => void }) {
  return (
    <div className="page library-page">
      <div className="view-header">
        <div><span className="view-kicker">LOCAL CAPTURE ARCHIVE</span><h1>Capture library</h1><p>{captures.length} item{captures.length === 1 ? "" : "s"} stored locally on this Mac.</p></div>
        <button className="primary-action" onClick={() => onCapture("area")}><Plus size={16} /> New capture</button>
      </div>
      <div className="filter-row"><button className="active">All</button><button>Screenshots</button><button>Recordings</button><span /><button><Clock3 size={14} /> Newest first</button></div>
      {captures.length ? <CaptureGallery captures={captures} onSelect={onSelect} /> : <EmptyLibrary onCapture={() => onCapture("area")} />}
    </div>
  );
}

function MemoryView({ captures, autoRemember, onToggle }: { captures: Capture[]; autoRemember: boolean; onToggle: () => void }) {
  const remembered = captures.filter((capture) => capture.remembered);
  return (
    <div className="page settings-page">
      <div className="view-header"><div><span className="view-kicker">CONNECTED KNOWLEDGE</span><h1>Ship Memory</h1><p>Turn visual references into durable, searchable context.</p></div><div className="connection-badge"><span /> Connected locally</div></div>
      <section className="memory-hero-card">
        <div className="memory-visual"><div><MemoryStick size={30} /></div><i /><i /><i /></div>
        <div><span className="view-kicker">MEMORY PIPELINE</span><h2>Every capture can become context.</h2><p>ShipShot stores the original file as a portable attachment and creates a linked Markdown memory with capture metadata.</p></div>
        <button className={`switch-button ${autoRemember ? "on" : ""}`} onClick={onToggle}><span /><div><strong>Auto-remember</strong><small>{autoRemember ? "Enabled" : "Disabled"}</small></div></button>
      </section>
      <div className="stat-grid">
        <StatCard icon={MemoryStick} value={String(remembered.length)} label="Remembered captures" />
        <StatCard icon={ImageIcon} value={String(captures.filter((item) => item.mediaType === "image").length)} label="Screenshots" />
        <StatCard icon={Video} value={String(captures.filter((item) => item.mediaType === "video").length)} label="Recordings" />
      </div>
      <section className="settings-card">
        <div className="settings-row"><div className="settings-icon"><FolderOpen size={17} /></div><div><strong>Memory vault</strong><span>~/ShipMemory/.shipmemory</span></div><button onClick={() => isTauri() && void invoke("open_memory_vault")}>Reveal in Finder</button></div>
        <div className="settings-row"><div className="settings-icon"><Link2 size={17} /></div><div><strong>Portable attachments</strong><span>Media is copied into the vault and linked from Markdown.</span></div><span className="healthy"><Check size={13} /> Healthy</span></div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: typeof Aperture; value: string; label: string }) {
  return <div className="stat-card"><Icon size={18} /><strong>{value}</strong><span>{label}</span></div>;
}

function ShortcutView({ onCapture }: { onCapture: (mode: CaptureMode) => void }) {
  const mouse = useMouseCapture();
  const mouseReady = mouse.status?.permissionOk && mouse.status.backend !== "failed";

  return (
    <div className="page settings-page">
      <div className="view-header"><div><span className="view-kicker">PHYSICAL COMMAND SURFACE</span><h1>Mouse & shortcuts</h1><p>Bind Logitech buttons directly to ShipShot—no keyboard required.</p></div><div className={`connection-badge logi ${mouseReady ? "connected" : ""}`}><MousePointer2 size={14} /> {mouseReady ? "Mouse listener ready" : "Setup required"}</div></div>
      <section className="logi-card">
        <div className="mouse-illustration"><MousePointer2 size={50} strokeWidth={1.2} /><span className="mouse-button-dot" /></div>
        <div><span className="view-kicker">DIRECT MOUSE CONTROL</span><h2>Your mouse becomes a capture console.</h2><p>Press Bind beside an action, then click a side or middle mouse button once. ShipShot remembers it and captures from the background.</p><div className="step-row"><span>1</span>Grant access <ChevronRight size={14} /><span>2</span>Press Bind <ChevronRight size={14} /><span>3</span>Click mouse button</div></div>
        {mouse.config && <button className={`mouse-enable ${mouse.config.enabled ? "on" : ""}`} onClick={() => void mouse.setEnabled(!mouse.config?.enabled)}><i><span /></i><strong>{mouse.config.enabled ? "Mouse capture on" : "Mouse capture off"}</strong></button>}
      </section>

      {mouse.status && !mouse.status.permissionOk && (
        <section className="mouse-permission-card">
          <div><strong>Allow Accessibility access</strong><span>ShipShot needs local Accessibility permission to detect Logitech buttons outside the app. Your clicks never leave this Mac.</span></div>
          <button onClick={() => void mouse.requestPermission()}>Grant access</button>
          <button onClick={() => void mouse.openPermissionSettings()}>Open System Settings</button>
          <small>After enabling ShipShot, quit and reopen it once.</small>
        </section>
      )}

      {mouse.error && <div className="mouse-error">Mouse connection error: {mouse.error}</div>}
      <section className="shortcut-list">
        <div className="list-head"><span>Action</span><span>Keyboard fallback</span><span>Direct mouse binding</span><span /></div>
        {bindings.map((binding) => {
          const Icon = binding.mode === "area" ? Aperture : binding.mode === "window" ? AppWindow : binding.mode === "fullscreen" ? Monitor : Video;
          const directBinding = mouse.config?.bindings.find((item) => item.action === binding.mode);
          const isBinding = mouse.bindingAction === binding.mode;
          return <div className={`shortcut-row ${isBinding ? "binding" : ""}`} key={binding.mode}><div><i><Icon size={16} /></i><strong>{binding.label}</strong></div><kbd>{binding.shortcut.replaceAll("Alt", "⌥").replaceAll("Shift", "⇧").replaceAll("+", " ")}</kbd><span className={directBinding ? "bound" : "unbound"}>{isBinding ? <><Circle size={8} fill="currentColor" /> Press a mouse button…</> : directBinding ? <><Check size={13} /> {mouseButtonLabel(directBinding.button)}</> : "Not bound"}</span><div className="binding-actions">{isBinding ? <button onClick={() => void mouse.cancelBind()}>Cancel</button> : <button className="bind" disabled={!mouse.status?.permissionOk} onClick={() => void mouse.beginBind(binding.mode)}>{directBinding ? "Rebind" : "Bind"}</button>}{directBinding && !isBinding && <button className="unbind" title="Remove binding" onClick={() => void mouse.removeBinding(binding.mode)}>×</button>}<button onClick={() => onCapture(binding.mode)}>Test</button></div></div>;
        })}
      </section>
      <div className="tip-card"><WandSparkles size={17} /><div><strong>Logi Options+ note</strong><span>Leave the button on its normal Back, Forward, or Middle action. Don’t remap it to a keystroke—ShipShot detects and reserves the physical click directly.</span></div></div>
    </div>
  );
}

function SettingsView({ autoRemember, onToggle }: { autoRemember: boolean; onToggle: () => void }) {
  return (
    <div className="page settings-page compact-page">
      <div className="view-header"><div><span className="view-kicker">SHIPSHOT 0.1.0</span><h1>Settings</h1><p>Private by default. Built for the way you work.</p></div></div>
      <section className="settings-card">
        <h3>Capture behavior</h3>
        <div className="settings-row"><div className="settings-icon"><MemoryStick size={17} /></div><div><strong>Save captures to Ship Memory</strong><span>Create a memory and portable attachment after every capture.</span></div><button className={`mini-toggle ${autoRemember ? "on" : ""}`} onClick={onToggle}><span /></button></div>
        <div className="settings-row"><div className="settings-icon"><FolderOpen size={17} /></div><div><strong>Local capture folder</strong><span>~/Pictures/ShipShot</span></div><button onClick={() => isTauri() && void invoke("open_capture_folder")}>Open folder</button></div>
        <div className="settings-row"><div className="settings-icon"><Clock3 size={17} /></div><div><strong>24-hour workspace</strong><span>Unremembered captures automatically move to macOS Trash after 24 hours.</span></div><span className="healthy"><Check size={13} /> Active</span></div>
        <div className="settings-row"><div className="settings-icon"><Keyboard size={17} /></div><div><strong>Global shortcuts</strong><span>Available while ShipShot is running.</span></div><span className="healthy"><Check size={13} /> Active</span></div>
      </section>
      <section className="settings-card"><h3>Privacy</h3><div className="settings-row"><div className="settings-icon"><Database size={17} /></div><div><strong>Local-first storage</strong><span>Your captures and memories remain on this Mac. No cloud account required.</span></div><span className="healthy"><Check size={13} /> Local</span></div></section>
    </div>
  );
}

function CaptureInspector({ capture, onClose, onRemember, onReveal, onCopy, onDelete }: { capture: Capture; onClose: () => void; onRemember: () => void; onReveal: () => void; onCopy: () => void; onDelete: () => void }) {
  return (
    <div className="inspector-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="inspector-panel">
        <div className="inspector-head"><div><span className="view-kicker">CAPTURE DETAIL</span><strong>{captureInfo[capture.mode].label}</strong></div><button className="icon-button" onClick={onClose}><X size={17} /></button></div>
        <div className="inspector-preview">{capture.mediaType === "image" ? <img src={captureUrl(capture)} alt="Selected capture" /> : <div className="video-placeholder"><Video size={40} /><span>{capture.filename}</span></div>}</div>
        <div className="inspector-actions">
          <button className="primary-action" onClick={onRemember} disabled={capture.remembered}>{capture.remembered ? <Check size={15} /> : <MemoryStick size={15} />}{capture.remembered ? "Remembered" : "Save to memory"}</button>
          <button onClick={onReveal}><FolderOpen size={15} /> Reveal</button>
          <button onClick={onCopy} disabled={capture.mediaType !== "image"}><Copy size={15} /> Copy</button>
        </div>
        <dl className="capture-details"><div><dt>Created</dt><dd>{new Date(capture.createdAt).toLocaleString()}</dd></div><div><dt>Dimensions</dt><dd>{capture.width && capture.height ? `${capture.width} × ${capture.height}` : "Video"}</dd></div><div><dt>File size</dt><dd>{formatBytes(capture.fileSize)}</dd></div><div><dt>Memory</dt><dd>{capture.memorySlug ?? "Not connected"}</dd></div></dl>
        <button className="delete-button" onClick={onDelete}><Trash2 size={15} /> Delete capture</button>
      </aside>
    </div>
  );
}
