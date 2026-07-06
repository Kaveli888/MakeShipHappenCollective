/**
 * "Back up to SD" — a floating button + modal that mirrors the whole vault
 * onto a removable volume. One-way and additive (never deletes on the card),
 * into a `ShipMemory/` folder at the root of the chosen card.
 *
 * Lives in the app (host) package on purpose: the shared @ship-memory/ui
 * Notepad stays SD-agnostic. Rendered as an overlay on top of it by App.tsx.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatBytes,
  listVolumes,
  onSyncProgress,
  syncVaultToDir,
  type SyncProgress,
  type SyncReport,
  type VolumeInfo,
} from "./sdSyncApi";

/** Folder created at the root of the card. Self-contained, per the design. */
const CARD_SUBDIR = "ShipMemory";

type Phase = "idle" | "syncing" | "done" | "error";

export function SdSync({ vaultRoot }: { vaultRoot: string }) {
  const [open, setOpen] = useState(false);
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    try {
      const vols = await listVolumes();
      setVolumes(vols);
      // Keep the current pick if it's still mounted, else default to the first.
      setSelected((prev) =>
        prev && vols.some((v) => v.path === prev)
          ? prev
          : (vols[0]?.path ?? null),
      );
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Refresh the volume list whenever the modal opens.
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => () => unlistenRef.current?.(), []);

  const run = useCallback(async () => {
    if (!selected) return;
    setPhase("syncing");
    setReport(null);
    setErrorMsg(null);
    setProgress({ done: 0, total: 0, current: "" });

    unlistenRef.current?.();
    unlistenRef.current = await onSyncProgress(setProgress);

    try {
      const dest = `${selected.replace(/\/+$/, "")}/${CARD_SUBDIR}`;
      const rep = await syncVaultToDir(vaultRoot, dest);
      setReport(rep);
      setPhase("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    } finally {
      unlistenRef.current?.();
      unlistenRef.current = null;
    }
  }, [selected, vaultRoot]);

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <>
      <button
        type="button"
        title="Back up vault to SD card"
        onClick={() => setOpen(true)}
        style={fab}
      >
        ⤓ SD
      </button>

      {open && (
        <div style={scrim} onClick={() => phase !== "syncing" && setOpen(false)}>
          <div style={card} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Back up to SD card</h2>
              <span style={{ marginLeft: "auto", opacity: 0.5, fontSize: 12 }}>
                one-way · never deletes
              </span>
            </div>

            <p style={{ margin: "6px 0 14px", fontSize: 13, opacity: 0.7 }}>
              Copies new and changed notes into a{" "}
              <code style={code}>{CARD_SUBDIR}/</code> folder on the card.
            </p>

            {phase === "idle" || phase === "done" || phase === "error" ? (
              <>
                <div style={row}>
                  <label style={{ fontSize: 12, opacity: 0.6 }}>Card</label>
                  <button type="button" onClick={refresh} style={linkBtn}>
                    Refresh
                  </button>
                </div>
                {volumes.length === 0 ? (
                  <div style={empty}>
                    No removable volume detected. Plug in your SD card, then
                    press Refresh.
                  </div>
                ) : (
                  <select
                    value={selected ?? ""}
                    onChange={(e) => setSelected(e.target.value)}
                    style={select}
                  >
                    {volumes.map((v) => (
                      <option key={v.path} value={v.path}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                )}

                {phase === "done" && report && (
                  <div style={reportBox}>
                    ✓ Backed up — {report.copied} copied, {report.skipped}{" "}
                    unchanged, {formatBytes(report.bytes)} written.
                    {report.errors.length > 0 && (
                      <div style={{ color: "#d66", marginTop: 6 }}>
                        {report.errors.length} file
                        {report.errors.length > 1 ? "s" : ""} failed (
                        {report.errors[0]}
                        {report.errors.length > 1 ? " …" : ""})
                      </div>
                    )}
                    <div style={{ opacity: 0.55, marginTop: 4, fontSize: 11 }}>
                      {report.dest}
                    </div>
                  </div>
                )}
                {phase === "error" && errorMsg && (
                  <div style={{ ...reportBox, color: "#d66" }}>{errorMsg}</div>
                )}

                <div style={actions}>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    style={ghostBtn}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={run}
                    disabled={!selected}
                    style={{ ...primaryBtn, opacity: selected ? 1 : 0.4 }}
                  >
                    {phase === "done" ? "Sync again" : "Sync now"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, margin: "8px 0 10px" }}>
                  Copying… {progress?.done ?? 0}
                  {progress && progress.total > 0 ? ` / ${progress.total}` : ""}
                </div>
                <div style={barTrack}>
                  <div style={{ ...barFill, width: `${pct}%` }} />
                </div>
                <div style={currentFile}>{progress?.current || "…"}</div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// — inline styles: no dependency on the shared UI's CSS —
const fab: React.CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  zIndex: 40,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(128,128,128,0.35)",
  background: "rgba(120,120,130,0.16)",
  backdropFilter: "blur(10px)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const scrim: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background: "rgba(0,0,0,0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const card: React.CSSProperties = {
  width: 420,
  maxWidth: "90vw",
  padding: 20,
  borderRadius: 14,
  background: "var(--surface, #1c1c1e)",
  color: "var(--ink, #f2f2f2)",
  border: "1px solid rgba(128,128,128,0.28)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
  fontFamily: "-apple-system, sans-serif",
};
const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: 6,
};
const select: React.CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  borderRadius: 9,
  border: "1px solid rgba(128,128,128,0.35)",
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontSize: 14,
};
const empty: React.CSSProperties = {
  padding: "12px 12px",
  borderRadius: 9,
  border: "1px dashed rgba(128,128,128,0.4)",
  fontSize: 13,
  opacity: 0.75,
};
const actions: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 18,
};
const primaryBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 9,
  border: "none",
  background: "#3b82f6",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 9,
  border: "1px solid rgba(128,128,128,0.35)",
  background: "transparent",
  color: "inherit",
  fontSize: 13,
  cursor: "pointer",
};
const linkBtn: React.CSSProperties = {
  marginLeft: "auto",
  border: "none",
  background: "transparent",
  color: "#3b82f6",
  fontSize: 12,
  cursor: "pointer",
};
const reportBox: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 9,
  background: "rgba(128,128,128,0.12)",
  fontSize: 13,
  lineHeight: 1.5,
};
const barTrack: React.CSSProperties = {
  height: 8,
  borderRadius: 999,
  background: "rgba(128,128,128,0.25)",
  overflow: "hidden",
};
const barFill: React.CSSProperties = {
  height: "100%",
  background: "#3b82f6",
  transition: "width 120ms linear",
};
const currentFile: React.CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  opacity: 0.55,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const code: React.CSSProperties = {
  fontSize: 12,
  padding: "1px 5px",
  borderRadius: 5,
  background: "rgba(128,128,128,0.2)",
};
