import { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import type { MediaAsset, ShipMemoryMediaItem } from "../types.js";
import { fmtBytes, fmtDuration, fmtTime } from "../util.js";
import { cloudConfigured, ensureWorkspace, getUser, uploadMediaToStorage } from "../cloud/cloud.js";

function Thumb({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api.mediaThumb(id).then((s) => live && setSrc(s)).catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  return src ? (
    <img className="thumb" src={src} alt="" />
  ) : (
    <div className="thumb placeholder">▶</div>
  );
}

export default function Library({
  onCompose,
}: {
  onCompose: (postId: string) => void;
}) {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<MediaAsset | null>(null);
  const [smPicker, setSmPicker] = useState<ShipMemoryMediaItem[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await api.mediaList());
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function importVideos() {
    setError(null);
    try {
      const paths = await api.pickMediaFiles();
      if (!paths.length) return;
      setBusy(true);
      for (const p of paths) {
        await api.mediaImport(p);
      }
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openShipMemoryPicker() {
    setError(null);
    try {
      setSmPicker(await api.shipmemoryMediaList());
    } catch (e) {
      setError(String(e));
    }
  }

  async function importFromShipMemory(name: string) {
    setError(null);
    try {
      setBusy(true);
      await api.mediaImportShipMemory(name);
      setSmPicker(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function composeFrom(m: MediaAsset) {
    try {
      const postId = await api.postCreate(m.id);
      onCompose(postId);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>Media Library</h2>
          <p className="sub">Import assets once, then attach them to release cards.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ghost" disabled={busy} onClick={openShipMemoryPicker}>
            ⚭ From Ship Memory
          </button>
          <button className="primary" disabled={busy} onClick={importVideos}>
            {busy ? "Importing…" : "+ Import media"}
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {smPicker && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="view-head" style={{ marginBottom: 8 }}>
            <div>
              <strong>Ship Memory attachments</strong>
              <p className="sub">
                Referenced in place — nothing is copied into Omni Release.
              </p>
            </div>
            <button className="ghost sm" onClick={() => setSmPicker(null)}>
              Close
            </button>
          </div>
          {smPicker.length === 0 ? (
            <p className="sub">
              No media in the Ship Memory attachments folder yet. Add
              video/images to a note in Ship Memory first.
            </p>
          ) : (
            <div>
              {smPicker.map((f) => (
                <div
                  key={f.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 0",
                  }}
                >
                  <span>
                    {f.kind === "video" ? "🎬" : "🖼"} {f.name}{" "}
                    <span className="sub">{fmtBytes(f.byteSize)}</span>
                  </span>
                  <button
                    className="ghost sm"
                    disabled={busy}
                    onClick={() => importFromShipMemory(f.name)}
                  >
                    Reference →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <p>No media yet.</p>
          <p className="sub">
            Import video (mp4, mov, webm, mkv, avi, m4v) or images (jpg, png,
            gif, webp, heic). We extract duration, resolution and a thumbnail
            automatically.
          </p>
        </div>
      ) : (
        <div className="media-grid">
          {items.map((m) => (
            <div className="media-card" key={m.id} onClick={() => setSel(m)}>
              <Thumb id={m.id} />
              <div className="media-meta">
                <strong title={m.filename}>{m.title || m.filename}</strong>
                <span className="sub">
                  {fmtDuration(m.duration_sec)} ·{" "}
                  {m.width && m.height ? `${m.width}×${m.height}` : "—"} ·{" "}
                  {fmtBytes(m.byte_size)}
                </span>
                {m.aspect_ratio && <span className="chip">{m.aspect_ratio}</span>}
                {m.source === "shipmemory" && (
                  <span className="chip" title="Referenced from Ship Memory — no local copy">
                    ⚭ Ship Memory
                  </span>
                )}
              </div>
              <button
                className="ghost sm"
                onClick={(e) => {
                  e.stopPropagation();
                  composeFrom(m);
                }}
              >
                New card →
              </button>
            </div>
          ))}
        </div>
      )}

      {sel && (
        <MediaDetail
          asset={sel}
          onClose={() => setSel(null)}
          onSaved={() => {
            setSel(null);
            refresh();
          }}
          onCompose={() => composeFrom(sel)}
        />
      )}
    </div>
  );
}

function MediaDetail({
  asset,
  onClose,
  onSaved,
  onCompose,
}: {
  asset: MediaAsset;
  onClose: () => void;
  onSaved: () => void;
  onCompose: () => void;
}) {
  const [title, setTitle] = useState(asset.title ?? "");
  const [description, setDescription] = useState(asset.description ?? "");
  const [tags, setTags] = useState((asset.tags ?? []).join(", "));
  const [notes, setNotes] = useState(asset.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  async function pushToCloud() {
    setCloudMsg(null);
    setPushing(true);
    try {
      if (!(await getUser())) {
        setCloudMsg("Sign in (sidebar) to push media to cloud.");
        return;
      }
      const ws = await ensureWorkspace();
      const path = await uploadMediaToStorage(ws, asset.id);
      setCloudMsg(`Uploaded → ${path}`);
    } catch (e) {
      setCloudMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPushing(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await api.mediaUpdate(
        asset.id,
        title || null,
        description || null,
        tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes || null,
        asset.campaign_id,
      );
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>{asset.filename}</h3>
          <button className="ghost sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="kv">
          <span>Imported</span>
          <span>{fmtTime(asset.created_at)}</span>
          <span>Duration</span>
          <span>{fmtDuration(asset.duration_sec)}</span>
          <span>Resolution</span>
          <span>
            {asset.width && asset.height
              ? `${asset.width}×${asset.height} (${asset.aspect_ratio})`
              : "—"}
          </span>
          <span>Size</span>
          <span>{fmtBytes(asset.byte_size)}</span>
        </div>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Tags (comma separated)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label className="field">
          <span>Internal notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="drawer-actions">
          <button className="ghost" onClick={() => api.mediaSetStatus(asset.id, "archived").then(onSaved)}>
            Archive
          </button>
          {cloudConfigured && (
            <button className="ghost" disabled={pushing} onClick={pushToCloud}>
              {pushing ? "Uploading…" : "Push to cloud"}
            </button>
          )}
          <button className="ghost" onClick={onCompose}>
            New card →
          </button>
          <button className="primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {cloudMsg && <p className="sub">{cloudMsg}</p>}
      </div>
    </div>
  );
}
