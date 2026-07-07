import { useCallback, useEffect, useRef, useState } from "react";
import {
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { homeDir } from "@tauri-apps/api/path";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { watchImmediate, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { ShipMemory } from "@ship-memory/core";
import { Notepad, type AttachmentOpenRequest } from "@ship-memory/ui";
import { tauriFs } from "./tauriFs";
import { SdSync } from "./SdSync";

const shipMemoryIconUrl = new URL(
  "../src-tauri/icons/icon.png",
  import.meta.url,
).href;

type StartupPhase = "locating-home" | "opening-hub" | "watching-hub";

const STARTUP_TIMEOUT_MS = 8000;

const phaseLabel: Record<StartupPhase, string> = {
  "locating-home": "Locating your ShipMemory hub...",
  "opening-hub": "Opening ~/ShipMemory...",
  "watching-hub": "Starting live sync...",
};

async function withStartupTimeout<T>(
  promise: Promise<T>,
  action: string,
): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`Timed out while ${action}`));
    }, STARTUP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function StartupScreen({ phase }: { phase: StartupPhase }) {
  return (
    <div style={{ padding: 48, fontFamily: "-apple-system, sans-serif" }}>
      <h2>ShipMemory is starting</h2>
      <p style={{ color: "#666" }}>{phaseLabel[phase]}</p>
    </div>
  );
}

// Native menu bar: add Save Session (⌘S) to the top of the File menu. The
// item just pokes the webview — Notepad listens for the event and flushes
// every open pane's pending edits to disk.
async function installAppMenu() {
  // Once per webview: StrictMode double-mounts and HMR re-runs the effect,
  // and each pass would append another Save Session item.
  const w = window as unknown as { __shipMemoryMenuInstalled?: boolean };
  if (w.__shipMemoryMenuInstalled) return;
  w.__shipMemoryMenuInstalled = true;

  const menu = await Menu.default();
  const save = await MenuItem.new({
    id: "save-session",
    text: "Save Session",
    accelerator: "CmdOrCtrl+S",
    action: () => window.dispatchEvent(new Event("ship-memory:save-session")),
  });
  const sep = await PredefinedMenuItem.new({ item: "Separator" });
  let file: Submenu | undefined;
  for (const it of await menu.items()) {
    if (it.kind === "Submenu" && (await (it as Submenu).text()) === "File") {
      file = it as Submenu;
      break;
    }
  }
  // Tauri's default menu has a File submenu; if its shape ever changes,
  // fall back to inserting a fresh one after the app submenu.
  if (file) {
    await file.insert([save, sep], 0);
  } else {
    await menu.insert(await Submenu.new({ text: "File", items: [save] }), 1);
  }
  await menu.setAsAppMenu();
}

// Attachment clicks open a dedicated viewer window (label keyed by path, so
// re-clicking the same picture focuses its window instead of duplicating).
// The window loads this same page with `?viewer=` — see main.tsx / Viewer.tsx.
function openAttachmentWindow(req: AttachmentOpenRequest): boolean {
  const label = "viewer-" + req.relPath.replace(/[^a-zA-Z0-9_-]/g, "_");
  void (async () => {
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.setFocus();
      return;
    }
    new WebviewWindow(label, {
      url: `index.html?viewer=${encodeURIComponent(req.relPath)}`,
      title: req.name,
      width: req.kind === "video" ? 980 : 920,
      height: req.kind === "video" ? 640 : 720,
      minWidth: 320,
      minHeight: 240,
      center: true,
    });
  })();
  return true;
}

export function App() {
  const [engine, setEngine] = useState<ShipMemory | null>(null);
  const [vaultVersion, setVaultVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<StartupPhase>("locating-home");
  const debounceRef = useRef<number | undefined>(undefined);

  const onOpenAttachment = useCallback(openAttachmentWindow, []);

  useEffect(() => {
    // Best-effort: in a plain browser (vite without Tauri) there's no menu.
    installAppMenu().catch(() => {});
  }, []);

  useEffect(() => {
    let unwatch: UnwatchFn | undefined;
    let cancelled = false;

    void (async () => {
      try {
        setPhase("locating-home");
        const home = (
          await withStartupTimeout(homeDir(), "locating the home folder")
        ).replace(/\/+$/, "");
        // Same hub every agent and ShipSpace use; create() attaches if it exists.
        setPhase("opening-hub");
        const mem = await withStartupTimeout(
          ShipMemory.create(`${home}/ShipMemory`, tauriFs),
          `opening ${home}/ShipMemory`,
        );
        if (cancelled) return;
        setEngine(mem);

        // Live sync: edits from ShipSpace, Claude agents, or Obsidian show up
        // here without reopening. Notepad ignores echoes of its own saves.
        setPhase("watching-hub");
        try {
          unwatch = await watchImmediate(
            mem.root,
            () => {
              window.clearTimeout(debounceRef.current);
              debounceRef.current = window.setTimeout(
                () => setVaultVersion((v) => v + 1),
                250,
              );
            },
            { recursive: true },
          );
        } catch (e) {
          console.warn("ShipMemory live sync watcher failed", e);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      unwatch?.();
      window.clearTimeout(debounceRef.current);
    };
  }, []);

  if (error) {
    return (
      <div style={{ padding: 48, fontFamily: "-apple-system, sans-serif" }}>
        <h2>Couldn’t open the ShipMemory hub</h2>
        <p style={{ color: "#888" }}>{error}</p>
      </div>
    );
  }

  if (!engine) return <StartupScreen phase={phase} />;

  return (
    <>
      <Notepad
        engine={engine}
        vaultVersion={vaultVersion}
        onOpenAttachment={onOpenAttachment}
        appLogoSrc={shipMemoryIconUrl}
      />
      <SdSync vaultRoot={engine.root} />
    </>
  );
}
