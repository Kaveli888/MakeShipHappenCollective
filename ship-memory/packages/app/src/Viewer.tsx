import { useEffect, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ShipMemory } from "@ship-memory/core";
import { attachmentKind, attachmentMime } from "@ship-memory/ui";
import { tauriFs } from "./tauriFs";

/**
 * Standalone attachment viewer — rendered when the page is opened with
 * `?viewer=<hub-relative path>` in its own WebviewWindow (see App.tsx).
 * Reads the bytes through the engine (path-traversal guarded) and shows
 * the media full-window. Esc closes the window.
 */
export function Viewer({ relPath }: { relPath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = attachmentKind(relPath);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | undefined;
    void (async () => {
      try {
        const home = (await homeDir()).replace(/\/+$/, "");
        const mem = await ShipMemory.create(`${home}/ShipMemory`, tauriFs);
        const bytes = await mem.readAttachment(relPath);
        if (cancelled) return;
        blobUrl = URL.createObjectURL(
          new Blob([bytes as BlobPart], { type: attachmentMime(relPath) }),
        );
        setUrl(blobUrl);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [relPath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void getCurrentWindow().close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const media =
    error != null ? (
      <p style={{ color: "#aaa", fontFamily: "-apple-system, sans-serif" }}>
        Couldn’t open attachment: {error}
      </p>
    ) : url == null ? null : kind === "image" ? (
      <img src={url} alt={relPath} style={mediaStyle} />
    ) : kind === "video" ? (
      <video src={url} controls autoPlay style={mediaStyle} />
    ) : kind === "audio" ? (
      <audio src={url} controls autoPlay style={{ width: "min(90%, 480px)" }} />
    ) : (
      <p style={{ color: "#aaa", fontFamily: "-apple-system, sans-serif" }}>
        No preview for this file type.
      </p>
    );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#161616",
      }}
    >
      {media}
    </div>
  );
}

const mediaStyle: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
};
