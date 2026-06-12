import { useEffect, useRef, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { watchImmediate, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { ShipMemory } from "@ship-memory/core";
import { Notepad } from "@ship-memory/ui";
import { tauriFs } from "./tauriFs";

export function App() {
  const [engine, setEngine] = useState<ShipMemory | null>(null);
  const [vaultVersion, setVaultVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let unwatch: UnwatchFn | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const home = (await homeDir()).replace(/\/+$/, "");
        // Same hub every agent and ShipSpace use; create() attaches if it exists.
        const mem = await ShipMemory.create(`${home}/ShipMemory`, tauriFs);
        if (cancelled) return;
        setEngine(mem);

        // Live sync: edits from ShipSpace, Claude agents, or Obsidian show up
        // here without reopening. Notepad ignores echoes of its own saves.
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

  if (!engine) return null;

  return <Notepad engine={engine} vaultVersion={vaultVersion} />;
}
