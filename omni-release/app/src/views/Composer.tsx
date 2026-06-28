import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "../api.js";
import type {
  MediaAsset,
  PlatformCapability,
  PostBundle,
  PostPlatformTarget,
} from "../types.js";
import { LOCAL_TZ, fmtTime, localInputToUtcIso, defaultScheduleInput, statusClass } from "../util.js";
import { PlatformLogo } from "../components/PlatformLogo.js";
import logoUrl from "../assets/logo.png";
import {
  cloudConfigured,
  ensureWorkspace,
  getUser,
  listConnections,
  scheduleToCloud,
} from "../cloud/cloud.js";

// A connected platform account's public identity, mirrored into the previews.
interface CloudAccount {
  display_name: string | null;
  avatar_url: string | null;
  handle: string | null;
}

interface CloudCtx {
  workspaceId: string;
  connected: Set<string>;
  /** platform → connected account identity (name + avatar) for the previews. */
  accounts: Record<string, CloudAccount>;
}

// A reusable caption snippet saved from the editor (Postiz "Saved texts").
interface SavedText {
  id: string;
  text: string;
  savedAt: number;
}

// A document attached to the post via the Files button. Stored as a lightweight
// reference (name + size) — the browser file picker does not expose a full path.
interface AttachedFile {
  id: string;
  name: string;
  size: number;
}

// localStorage keys. Saved texts are a global library; location + files are
// scoped per post so each draft keeps its own.
const LS_SAVED_TEXTS = "omni:saved-texts";
const lsLocationKey = (postId: string) => `omni:post-location:${postId}`;
const lsFilesKey = (postId: string) => `omni:post-files:${postId}`;

function loadSavedTexts(): SavedText[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_SAVED_TEXTS) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// Soft caption ceiling shown in the editor (matches the longest platform limit).
const CHAR_LIMIT = 3000;

// Identity shown in the live previews. These are an approximation — the real
// account name/handle/avatar come from the connected platform at publish time.
const BRAND = {
  name: "Make Ship Happen",
  handle: "@makeshiphappen",
  avatar: logoUrl,
};

// The identity a preview card shows. When the platform account is connected its
// real name + handle + profile photo are mirrored here; otherwise we fall back
// to the generic brand placeholder.
interface PreviewIdentity {
  name: string;
  handle: string;
  avatar: string;
  connected: boolean;
}

function previewIdentity(platform: string, cloud: CloudCtx | null): PreviewIdentity {
  const acct = cloud?.accounts[platform];
  if (acct) {
    const handle = acct.handle?.trim();
    return {
      name: acct.display_name?.trim() || BRAND.name,
      handle: handle ? (handle.startsWith("@") ? handle : `@${handle}`) : BRAND.handle,
      avatar: acct.avatar_url?.trim() || BRAND.avatar,
      connected: true,
    };
  }
  return { ...BRAND, connected: false };
}

export default function Composer({
  postId,
  onBack,
}: {
  postId: string;
  onBack: () => void;
}) {
  const [bundle, setBundle] = useState<PostBundle | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [caps, setCaps] = useState<PlatformCapability[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [master, setMaster] = useState({ caption: "", link: "", cta: "" });
  const [cloud, setCloud] = useState<CloudCtx | null>(null);
  // The full media library (for the attach picker) + the ordered set of ids
  // attached to THIS post. Selection order = carousel order.
  const [mediaLib, setMediaLib] = useState<MediaAsset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  // Editor chrome
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [editNet, setEditNet] = useState(false);
  // Location tag, attached document references, and the saved-text library.
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [savedTexts, setSavedTexts] = useState<SavedText[]>(loadSavedTexts);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [when, setWhen] = useState(defaultScheduleInput());
  // Privacy for the live upload. Default public (so the post is actually visible
  // on the channel) but always selectable per post in the send bar.
  const [privacy, setPrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Live preview: which network's mockup is showing + phone/desktop frame.
  const [previewPlatform, setPreviewPlatform] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"phone" | "desktop">("phone");

  useEffect(() => {
    if (!cloudConfigured) return;
    (async () => {
      try {
        if (!(await getUser())) return;
        const ws = await ensureWorkspace();
        const conns = await listConnections(ws);
        const live = conns.filter((c) => c.status === "connected");
        const accounts: Record<string, CloudAccount> = {};
        for (const c of live) {
          accounts[c.platform] = {
            display_name: c.display_name,
            avatar_url: c.avatar_url,
            handle: c.external_account_id,
          };
        }
        setCloud({
          workspaceId: ws,
          connected: new Set(live.map((c) => c.platform)),
          accounts,
        });
      } catch {
        /* cloud optional; ignore */
      }
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([api.postGet(postId), api.capabilities()]);
      setBundle(b);
      setCaps(c);
      if (b) {
        setMaster({
          caption: b.post.master_caption ?? "",
          link: b.post.link ?? "",
          cta: b.post.cta ?? "",
        });
        setSelected((b.media_items ?? []).map((m) => m.id));
        if (b.post.link) setLinkOpen(true);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoaded(true);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  // Restore per-post location + attached files whenever the draft changes.
  useEffect(() => {
    const loc = localStorage.getItem(lsLocationKey(postId)) ?? "";
    setLocation(loc);
    if (loc) setLocationOpen(true);
    try {
      const f = JSON.parse(localStorage.getItem(lsFilesKey(postId)) ?? "[]");
      setFiles(Array.isArray(f) ? f : []);
    } catch {
      setFiles([]);
    }
  }, [postId]);

  // ---- Location ----
  function updateLocation(v: string) {
    setLocation(v);
    if (v.trim()) localStorage.setItem(lsLocationKey(postId), v);
    else localStorage.removeItem(lsLocationKey(postId));
  }

  // ---- Files (lightweight document references) ----
  function persistFiles(next: AttachedFile[]) {
    setFiles(next);
    localStorage.setItem(lsFilesKey(postId), JSON.stringify(next));
  }
  function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) {
      persistFiles([
        ...files,
        ...picked.map((f, i) => ({
          id: `f_${Date.now()}_${i}`,
          name: f.name,
          size: f.size,
        })),
      ]);
    }
    e.target.value = "";
  }
  function removeFile(id: string) {
    persistFiles(files.filter((f) => f.id !== id));
  }

  // ---- Saved texts (global reusable caption library) ----
  function persistSaved(next: SavedText[]) {
    setSavedTexts(next);
    localStorage.setItem(LS_SAVED_TEXTS, JSON.stringify(next));
  }
  function saveCurrentText() {
    const text = master.caption.trim();
    if (!text || savedTexts.some((s) => s.text === text)) return;
    persistSaved([{ id: `st_${Date.now()}`, text, savedAt: Date.now() }, ...savedTexts]);
  }
  function deleteSaved(id: string) {
    persistSaved(savedTexts.filter((s) => s.id !== id));
  }
  // Insert a saved snippet — appends below existing text, then persists.
  async function insertSaved(text: string) {
    const cur = master.caption.replace(/\s+$/, "");
    const next = cur ? `${cur}\n\n${text}` : text;
    setMaster((m) => ({ ...m, caption: next }));
    if (!bundle) return;
    try {
      await api.postUpdate(
        postId,
        bundle.post.media_asset_id,
        next || null,
        master.link || null,
        master.cta || null,
        bundle.post.campaign_id,
      );
    } catch (e) {
      setError(String(e));
    }
  }

  const reloadLibrary = useCallback(async () => {
    try {
      setMediaLib(await api.mediaList());
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    reloadLibrary();
  }, [reloadLibrary]);

  // Persist a new media set, then refresh the bundle so the primary/cover asset
  // and media_items stay in sync (the Rust side mirrors item 0 into the post).
  async function persistMedia(next: string[]) {
    setSelected(next);
    try {
      await api.postSetMedia(postId, next);
      const b = await api.postGet(postId);
      if (b) setBundle(b);
    } catch (e) {
      setError(String(e));
    }
  }

  function toggleMedia(id: string) {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    void persistMedia(next);
  }

  async function importMedia() {
    setError(null);
    try {
      const paths = await api.pickMediaFiles();
      if (!paths.length) return;
      setImporting(true);
      const newIds: string[] = [];
      for (const p of paths) {
        const m = await api.mediaImport(p);
        newIds.push(m.id);
      }
      await reloadLibrary();
      // Auto-attach freshly imported media to this post.
      await persistMedia([
        ...selected,
        ...newIds.filter((id) => !selected.includes(id)),
      ]);
      setPickerOpen(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }

  async function saveMaster() {
    if (!bundle) return;
    try {
      await api.postUpdate(
        postId,
        bundle.post.media_asset_id,
        master.caption || null,
        master.link || null,
        master.cta || null,
        bundle.post.campaign_id,
      );
    } catch (e) {
      setError(String(e));
    }
  }

  // Toggle a platform on/off straight from the logo bar. A new target inherits
  // the master caption (override left null), so one box ships to every network.
  async function toggleTarget(platform: string) {
    if (!bundle) return;
    const exists = bundle.targets.some((t) => t.platform === platform);
    try {
      if (exists) {
        await api.targetDelete(postId, platform);
      } else {
        await api.targetUpsert({
          postId,
          platform,
          captionOverride: null,
          titleOverride: null,
          hashtags: [],
          thumbnailMediaId: null,
          privacy: "public",
          options: {},
        });
      }
      await load();
    } catch (e) {
      setError(String(e));
    }
  }

  const enabledTargets = (): PostPlatformTarget[] => bundle?.targets ?? [];

  // Schedule the SAME post to every selected network at the chosen time — for
  // REAL. Connected networks go to the cloud (the worker uploads + publishes);
  // anything not connected is reported honestly instead of silently faked.
  async function scheduleAll() {
    const targets = enabledTargets();
    if (!targets.length) {
      setError("Pick at least one network (tap a logo up top) before scheduling.");
      return;
    }
    if (!when) return;
    if (!cloud) {
      setError(
        "You're not signed in to the cloud, so posts can't actually publish. Sign in (top-left) and connect YouTube in Platforms, then schedule.",
      );
      return;
    }
    // The primary attached video, if any. Media-required networks (YouTube,
    // Instagram, TikTok) need it; text-capable ones (X, Facebook, LinkedIn) post
    // text alone.
    const primaryMediaId = bundle?.post.media_asset_id ?? selected[0] ?? null;
    const TEXT_CAPABLE = new Set(["x", "facebook", "linkedin"]);

    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await saveMaster();
      const whenIso = localInputToUtcIso(when);
      const fallbackTitle = (master.caption.split("\n")[0] || "Untitled").slice(0, 100);

      const live: string[] = [];
      const blocked: string[] = [];

      for (const t of targets) {
        if (!cloud.connected.has(t.platform)) {
          blocked.push(`${t.platform}: not connected — connect it in Platforms first`);
          continue;
        }
        const textOnly = TEXT_CAPABLE.has(t.platform);
        if (!primaryMediaId && !textOnly) {
          blocked.push(`${t.platform}: attach a video first (this network can't post text-only)`);
          continue;
        }
        if (!primaryMediaId && !(t.caption_override?.trim() || master.caption.trim())) {
          blocked.push(`${t.platform}: write some text or attach a video first`);
          continue;
        }
        await scheduleToCloud({
          workspaceId: cloud.workspaceId,
          mediaId: primaryMediaId ?? undefined,
          platform: t.platform,
          title: t.title_override?.trim() || fallbackTitle,
          caption: t.caption_override?.trim() || master.caption,
          hashtags: t.hashtags ?? [],
          privacy,
          scheduledForIso: whenIso,
          timezone: LOCAL_TZ,
        });
        live.push(t.platform);
      }

      if (live.length) {
        setNotice(
          `Scheduled live (${privacy}) to ${live.join(", ")}. The worker uploads it at the set time — it appears on your channel once published.`,
        );
      }
      if (blocked.length) setError(blocked.join(" · "));
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // Publish to every selected network at once (dry_run / mock).
  async function publishAll(mode: string) {
    const targets = enabledTargets();
    if (!targets.length) {
      setError("Pick at least one network (tap a logo up top) first.");
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await saveMaster();
      const fails: string[] = [];
      for (const t of targets) {
        const r = await api.publishNow(t.id, mode);
        if (r.outcome === "failure") fails.push(`${t.platform}: ${r.error_message}`);
      }
      if (fails.length) setError(fails.join(" · "));
      else
        setNotice(
          mode === "dry_run"
            ? `Dry run OK for ${targets.length} network${targets.length > 1 ? "s" : ""}.`
            : `Published (mock) to ${targets.length} network${targets.length > 1 ? "s" : ""}.`,
        );
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!bundle) {
    return (
      <div className="view">
        <button className="ghost sm" onClick={onBack}>
          ← Back
        </button>
        {error ? (
          <div className="banner error">{error}</div>
        ) : loaded ? (
          <div className="banner error">
            This post has no local draft to open — it was scheduled live in the cloud and only
            exists in the cloud DB. Use “View live ↗” on the calendar entry instead.
          </div>
        ) : (
          <p className="sub">Loading…</p>
        )}
      </div>
    );
  }

  const isEnabled = (p: string) => bundle.targets.some((t) => t.platform === p);
  const enabledCount = bundle.targets.length;
  const targetByPlatform = (p: string): PostPlatformTarget | undefined =>
    bundle.targets.find((t) => t.platform === p);
  const enabledCaps = caps.filter((c) => isEnabled(c.platform));
  const enabledPlatforms: string[] = bundle.targets.map((t) => t.platform);
  // Which network's preview to show: the picked one if still enabled, else the
  // first selected network (so the preview always reflects something live).
  const activePreview =
    previewPlatform && enabledPlatforms.includes(previewPlatform)
      ? previewPlatform
      : enabledPlatforms[0] ?? null;

  return (
    <div className="view compose-v2">
      <div className="view-head">
        <div>
          <button className="ghost sm" onClick={onBack}>
            ← Back
          </button>
          <h2>Create post</h2>
          <p className="sub">
            {bundle.media_items.length === 0
              ? "No media attached"
              : `${bundle.media_items.length} media attached`}{" "}
            · {enabledCount} network{enabledCount === 1 ? "" : "s"} selected ·{" "}
            <span className={`status ${statusClass(bundle.post.status)}`}>{bundle.post.status}</span>
          </p>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}

      <div className="compose-layout">
        <div className="compose-main">

      {/* Network selector — tap a logo to add/remove that platform. */}
      <div className="compose-networks">
        {caps.map((cap) => (
          <button
            key={cap.platform}
            className={`net-logo${isEnabled(cap.platform) ? " on" : ""}`}
            onClick={() => toggleTarget(cap.platform)}
            title={`${isEnabled(cap.platform) ? "Remove" : "Post to"} ${cap.label}`}
          >
            <PlatformLogo platform={cap.platform as never} size={30} />
            {isEnabled(cap.platform) && <span className="net-check">✓</span>}
          </button>
        ))}
      </div>

      {/* The post box — write once; attach via the toolbar at its base. */}
      <section className="card compose-editor">
        <textarea
          className="compose-text"
          value={master.caption}
          onChange={(e) => setMaster({ ...master, caption: e.target.value })}
          onBlur={saveMaster}
          placeholder="What do you want to post? Write it once — it ships to every network you picked above."
        />

        {selected.length > 0 && (
          <div className="attach-strip">
            {selected.map((id, i) => {
              const m = mediaLib.find((x) => x.id === id);
              const isImg = m?.mime_type.startsWith("image/") ?? false;
              return (
                <div className="attach-thumb" key={id}>
                  <TrayThumb id={id} isImage={isImg} />
                  <span className="attach-order">{i + 1}</span>
                  <button
                    className="attach-x"
                    title="Remove"
                    onClick={() => toggleMedia(id)}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {linkOpen && (
          <input
            className="compose-link"
            value={master.link}
            onChange={(e) => setMaster({ ...master, link: e.target.value })}
            onBlur={saveMaster}
            placeholder="https://… (link to attach)"
          />
        )}

        {locationOpen && (
          <div className="compose-location">
            <IconLocation />
            <input
              value={location}
              onChange={(e) => updateLocation(e.target.value)}
              placeholder="Add a location… (e.g. Austin, TX)"
              autoFocus
            />
            {location && (
              <button
                className="loc-clear"
                title="Clear location"
                onClick={() => {
                  updateLocation("");
                  setLocationOpen(false);
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {files.length > 0 && (
          <div className="file-strip">
            {files.map((f) => (
              <span className="file-chip" key={f.id} title={f.name}>
                <IconFile />
                <span className="file-name">{f.name}</span>
                <button
                  className="file-x"
                  title="Remove file"
                  onClick={() => removeFile(f.id)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {/* The toolbar (Jake's "red square") — add media / link, char count. */}
        <div className="editor-toolbar">
          <button
            className={`tool-btn${pickerOpen ? " on" : ""}`}
            title="Add media (images / video)"
            onClick={() => setPickerOpen((v) => !v)}
          >
            <IconImage />
          </button>
          <button
            className="tool-btn"
            title="Import from computer"
            disabled={importing}
            onClick={importMedia}
          >
            {importing ? <span className="tool-spin">…</span> : <IconUpload />}
          </button>
          <button
            className={`tool-btn${linkOpen ? " on" : ""}`}
            title="Add a link"
            onClick={() => setLinkOpen((v) => !v)}
          >
            <IconLink />
          </button>
          <button
            className={`tool-btn${files.length ? " on" : ""}`}
            title="Attach a file (PDF, doc…)"
            onClick={() => fileInputRef.current?.click()}
          >
            <IconFile />
          </button>
          <button
            className={`tool-btn${locationOpen || location ? " on" : ""}`}
            title="Add a location"
            onClick={() => setLocationOpen((v) => !v)}
          >
            <IconLocation />
          </button>
          <button
            className={`tool-btn${savedOpen ? " on" : ""}`}
            title="Saved texts"
            onClick={() => setSavedOpen((v) => !v)}
          >
            <IconSaved />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={onFilesPicked}
          />
          <span className="spacer" />
          <span className={`char-count${master.caption.length > CHAR_LIMIT ? " over" : ""}`}>
            {master.caption.length} / {CHAR_LIMIT}
          </span>
        </div>

        {/* Inline media picker — toggled by the toolbar image button. */}
        {pickerOpen && (
          <div className="media-tray picker">
            <button
              className="tray-tile add"
              onClick={importMedia}
              disabled={importing}
              title="Import images or video"
            >
              <span className="tray-add-ico">{importing ? "…" : "+"}</span>
              <span className="sub">{importing ? "Importing" : "Import"}</span>
            </button>
            {mediaLib.map((m) => {
              const idx = selected.indexOf(m.id);
              const on = idx >= 0;
              const isImg = m.mime_type.startsWith("image/");
              return (
                <button
                  key={m.id}
                  className={`tray-tile${on ? " sel" : ""}`}
                  onClick={() => toggleMedia(m.id)}
                  title={m.title || m.filename}
                >
                  <TrayThumb id={m.id} isImage={isImg} />
                  {on && <span className="tray-order">{idx + 1}</span>}
                  <span className="tray-kind">{isImg ? "IMG" : "VID"}</span>
                  <span className="tray-name">{m.title || m.filename}</span>
                </button>
              );
            })}
            {mediaLib.length === 0 && (
              <p className="sub" style={{ alignSelf: "center" }}>
                No media yet — Import to add images or video.
              </p>
            )}
          </div>
        )}

        {/* Saved texts — reuse a caption snippet across posts. */}
        {savedOpen && (
          <div className="saved-panel">
            <div className="saved-head">
              <strong>Saved texts</strong>
              <button
                className="ghost sm"
                disabled={!master.caption.trim()}
                onClick={saveCurrentText}
                title="Save the current post text for reuse"
              >
                + Save current text
              </button>
            </div>
            {savedTexts.length === 0 ? (
              <p className="sub">
                No saved texts yet. Write something above, then “Save current text”.
              </p>
            ) : (
              <ul className="saved-list">
                {savedTexts.map((s) => (
                  <li className="saved-item" key={s.id}>
                    <button
                      className="saved-insert"
                      title="Insert into post"
                      onClick={() => insertSaved(s.text)}
                    >
                      {s.text}
                    </button>
                    <button
                      className="saved-del"
                      title="Delete saved text"
                      onClick={() => deleteSaved(s.id)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Per-network fine-tuning (optional) — like Postiz "Edit by network". */}
      <button
        className={`ghost sm editbynet${editNet ? " on" : ""}`}
        onClick={() => setEditNet((v) => !v)}
        disabled={enabledCount === 0}
        title={enabledCount === 0 ? "Pick a network first" : "Customize each network"}
      >
        ✎ Edit by network {enabledCount > 0 ? `(${enabledCount})` : ""}
      </button>
      {editNet && enabledCaps.length > 0 && (
        <div className="targets editbynet-body">
          {enabledCaps.map((cap) => (
            <PlatformRow
              key={cap.platform}
              cap={cap}
              target={targetByPlatform(cap.platform)}
              masterCaption={master.caption}
              postId={postId}
              mediaId={bundle.post.media_asset_id}
              cloud={cloud}
              onChange={load}
              onError={setError}
            />
          ))}
        </div>
      )}

      {/* Send bar — schedule a REAL live publish to all connected networks. */}
      <div className="compose-actions">
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
        <label className="privacy-pick" title="Visibility of the published video">
          <span>Visibility</span>
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as "public" | "unlisted" | "private")}
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </label>
        <button
          className="ghost sm"
          disabled={busy}
          onClick={() => publishAll("dry_run")}
          title="Validate the post without publishing"
        >
          Dry run
        </button>
        <button
          className="ghost sm"
          disabled={busy}
          onClick={() => publishAll("mock")}
          title="Local test only — does NOT post to any platform"
        >
          Test (mock)
        </button>
        <span className="spacer" />
        <button
          className="primary"
          disabled={busy || !when}
          onClick={scheduleAll}
          title="Schedule a real, live publish to your connected channel"
        >
          {busy ? "Working…" : "Schedule live"}
        </button>
      </div>

        </div>{/* /compose-main */}

        {/* Live preview — mirrors your text per network as you type. */}
        <aside className="compose-preview">
          <div className="preview-shell">
            <div className="preview-bar">
              <div className="preview-switch">
                {enabledPlatforms.length === 0 ? (
                  <span className="sub">Pick a network to preview</span>
                ) : (
                  enabledPlatforms.map((p) => (
                    <button
                      key={p}
                      className={`preview-net${p === activePreview ? " on" : ""}`}
                      onClick={() => setPreviewPlatform(p)}
                      title={p}
                    >
                      <PlatformLogo platform={p as never} size={20} />
                    </button>
                  ))
                )}
              </div>
              <div className="preview-modes">
                <button
                  className={`pm-btn${previewMode === "phone" ? " on" : ""}`}
                  onClick={() => setPreviewMode("phone")}
                  title="Phone view"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="7" y="3" width="10" height="18" rx="2.5" />
                    <path d="M11 18h2" />
                  </svg>
                </button>
                <button
                  className={`pm-btn${previewMode === "desktop" ? " on" : ""}`}
                  onClick={() => setPreviewMode("desktop")}
                  title="Desktop view"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="4" width="18" height="12" rx="2" />
                    <path d="M9 20h6M12 16v4" />
                  </svg>
                </button>
              </div>
            </div>
            <div className={`preview-stage ${previewMode}`}>
              {activePreview ? (
                <PreviewCard
                  platform={activePreview}
                  identity={previewIdentity(activePreview, cloud)}
                  text={master.caption}
                  link={master.link}
                  location={location}
                  media={bundle.media_items}
                />
              ) : (
                <div className="preview-empty">
                  <p className="sub">
                    Select a network above and start typing — your post preview
                    appears here.
                  </p>
                </div>
              )}
            </div>
            <p className="preview-note">
              Previews are an approximation of how your post will look when
              published. The final post may look slightly different.
            </p>
          </div>
        </aside>
      </div>{/* /compose-layout */}
    </div>
  );
}

/* ---------- toolbar icons (monochrome line icons, like the example) ---------- */

function IconImage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9" r="1.6" />
      <path d="M4 17l4.5-4.5 4 4L16 12l4 5" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}
function IconLink() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 13a4 4 0 0 0 5.66 0l2.5-2.5a4 4 0 0 0-5.66-5.66L11 6.34" />
      <path d="M14 11a4 4 0 0 0-5.66 0l-2.5 2.5a4 4 0 1 0 5.66 5.66L13 17.66" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3v5h5" />
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    </svg>
  );
}
function IconLocation() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function IconSaved() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3h9l3 3v15l-6-3.5L6 21z" />
      <path d="M9 7h6M9 11h6" />
    </svg>
  );
}

/* ---------- live preview ---------- */

// One attached asset rendered in a preview card (first item; +N badge for more).
function PreviewMedia({ media }: { media: MediaAsset[] }) {
  const first = media[0];
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api.mediaThumb(first.id).then((s) => live && setSrc(s)).catch(() => {});
    return () => {
      live = false;
    };
  }, [first.id]);
  const isVid = first.mime_type.startsWith("video/");
  return (
    <div className="pv-media">
      {src ? <img src={src} alt="" /> : <div className="pv-media-ph">{isVid ? "▶" : "🖼"}</div>}
      {isVid && src && <span className="pv-play">▶</span>}
      {media.length > 1 && <span className="pv-more">+{media.length - 1}</span>}
    </div>
  );
}

// Mini action-bar icons used in the preview cards.
const PI = {
  comment: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-5.1A8.4 8.4 0 1 1 21 11.5z" /></svg>
  ),
  retweet: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
  ),
  heart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.4l8.8-8.7a5 5 0 0 0 0-7.1z" /></svg>
  ),
  chart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 20V10M10 20V4M16 20v-6M22 20H2" /></svg>
  ),
  share: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" /></svg>
  ),
  thumb: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 10v11" /><path d="M7 10l4-7a2 2 0 0 1 2.7 2.6L12.5 9H19a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 17.7 20H7" /></svg>
  ),
  send: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
  ),
};

function PreviewCard({
  platform,
  identity,
  text,
  location,
  media,
}: {
  platform: string;
  identity: PreviewIdentity;
  text: string;
  link: string;
  location: string;
  media: MediaAsset[];
}) {
  const body = text.trim();
  const hasMedia = media.length > 0;
  const loc = location.trim();
  const ph = <span className="pv-ph">Start typing — your post shows up here…</span>;
  // Profile photo for the active account; falls back to the brand logo if the
  // remote avatar fails to load.
  const avatar = (
    <img
      className="pv-avatar"
      src={identity.avatar}
      alt=""
      onError={(e) => {
        if (e.currentTarget.src !== logoUrl) e.currentTarget.src = logoUrl;
      }}
    />
  );
  const locLine = loc ? (
    <div className="pv-loc">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
      {loc}
    </div>
  ) : null;

  if (platform === "x") {
    return (
      <div className="pv-card pv-x">
        <div className="pv-row">
          {avatar}
          <div className="pv-col">
            <div className="pv-line">
              <strong>{identity.name}</strong>
              <span className="pv-muted">{identity.handle} · 1h</span>
            </div>
            <div className="pv-text">{body || ph}</div>
            {locLine}
            {hasMedia && <PreviewMedia media={media} />}
            <div className="pv-actions pv-x-actions">
              <span><PI.comment /> 0</span>
              <span><PI.retweet /> 0</span>
              <span><PI.heart /> 0</span>
              <span><PI.chart /> 0</span>
              <span><PI.share /></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "facebook") {
    return (
      <div className="pv-card pv-fb">
        <div className="pv-row">
          {avatar}
          <div className="pv-col">
            <strong>{identity.name}{identity.connected ? "" : " Tech"}</strong>
            <span className="pv-muted">Just now · 🌐</span>
          </div>
        </div>
        <div className="pv-text">{body || ph}</div>
        {locLine}
        {hasMedia && <PreviewMedia media={media} />}
        <div className="pv-actions pv-fb-actions">
          <button><PI.thumb /> Like</button>
          <button><PI.comment /> Comment</button>
          <button><PI.share /> Share</button>
        </div>
      </div>
    );
  }

  if (platform === "linkedin") {
    const long = body.length > 140;
    return (
      <div className="pv-card pv-li">
        <div className="pv-row">
          {avatar}
          <div className="pv-col">
            <strong>{identity.name}{identity.connected ? "" : " Tech"}</strong>
            <span className="pv-muted">– followers</span>
            <span className="pv-muted">now · 🌐</span>
          </div>
        </div>
        <div className={`pv-text${long ? " clamp" : ""}`}>
          {body || ph}
          {long && <span className="pv-more-link"> …see more</span>}
        </div>
        {locLine}
        {hasMedia && <PreviewMedia media={media} />}
        <div className="pv-actions pv-li-actions">
          <button><PI.thumb /> Like</button>
          <button><PI.comment /> Comment</button>
          <button><PI.retweet /> Share</button>
          <button><PI.send /> Send</button>
        </div>
      </div>
    );
  }

  // Generic card for YouTube / TikTok / Instagram / Twitch / Rumble.
  return (
    <div className="pv-card pv-generic">
      {hasMedia && <PreviewMedia media={media} />}
      <div className="pv-row">
        {avatar}
        <div className="pv-col">
          <strong>{identity.name}</strong>
          <span className="pv-muted">{platform} · now</span>
        </div>
      </div>
      <div className="pv-text">{body || ph}</div>
      {locLine}
    </div>
  );
}

function Badge({ on, label, kind }: { on: boolean; label: string; kind: string }) {
  if (!on) return null;
  return <span className={`mini-badge ${kind}`}>{label}</span>;
}

// Lazy thumbnail for a tray/attach tile — pulls the base64 thumb from the backend.
function TrayThumb({ id, isImage }: { id: string; isImage: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api.mediaThumb(id).then((s) => live && setSrc(s)).catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  return src ? (
    <img className="tray-img" src={src} alt="" />
  ) : (
    <div className="tray-img tray-ph">{isImage ? "🖼" : "▶"}</div>
  );
}

function PlatformRow({
  cap,
  target,
  masterCaption,
  postId,
  mediaId,
  cloud,
  onChange,
  onError,
}: {
  cap: PlatformCapability;
  target?: PostPlatformTarget;
  masterCaption: string;
  postId: string;
  mediaId: string | null;
  cloud: CloudCtx | null;
  onChange: () => void;
  onError: (e: string) => void;
}) {
  const enabled = !!target;
  // YouTube has a Title + Description (hashtags go inside the description), so it
  // shows a "Description" field instead of the caption + separate hashtags inputs.
  const isYouTube = cap.platform === "youtube";
  const [caption, setCaption] = useState(target?.caption_override ?? "");
  const [title, setTitle] = useState(target?.title_override ?? "");
  const [hashtags, setHashtags] = useState((target?.hashtags ?? []).join(" "));
  const [privacy, setPrivacy] = useState(target?.privacy ?? "public");
  const [when, setWhen] = useState(defaultScheduleInput());
  const [open, setOpen] = useState(true);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);
  const cloudConnected = !!cloud && cloud.connected.has(cap.platform);

  async function scheduleLive() {
    if (!cloud || !when) return;
    if (!mediaId) {
      onError("Attach media before scheduling a live post.");
      return;
    }
    setCloudMsg("Uploading… 0%");
    // Live upload progress emitted by the Rust resumable upload (per 6 MB chunk).
    const unlisten = await listen<{ mediaId: string; pct: number }>("upload-progress", (e) => {
      if (e.payload.mediaId === mediaId) {
        setCloudMsg(e.payload.pct >= 100 ? "Upload complete — scheduling…" : `Uploading… ${e.payload.pct}%`);
      }
    });
    try {
      const jobId = await scheduleToCloud({
        workspaceId: cloud.workspaceId,
        mediaId,
        platform: cap.platform,
        title: title || masterCaption.slice(0, 80),
        caption: caption || masterCaption,
        hashtags: hashtags.split(/\s+/).filter(Boolean),
        privacy,
        scheduledForIso: localInputToUtcIso(when),
        timezone: LOCAL_TZ,
      });
      setCloudMsg(`Scheduled live (cloud job ${jobId.slice(0, 8)}). The worker will publish it.`);
    } catch (e) {
      setCloudMsg(null);
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      unlisten();
    }
  }

  useEffect(() => {
    setCaption(target?.caption_override ?? "");
    setTitle(target?.title_override ?? "");
    setHashtags((target?.hashtags ?? []).join(" "));
    setPrivacy(target?.privacy ?? "public");
  }, [target]);

  async function save() {
    try {
      await api.targetUpsert({
        postId,
        platform: cap.platform,
        captionOverride: caption || null,
        titleOverride: cap.can_upload_video && title ? title : null,
        hashtags: hashtags.split(/\s+/).filter(Boolean),
        thumbnailMediaId: null,
        privacy,
        options: {},
      });
      onChange();
    } catch (e) {
      onError(String(e));
    }
  }

  async function schedule() {
    if (!target || !when) return;
    try {
      await api.scheduleCreate(target.id, localInputToUtcIso(when), LOCAL_TZ);
      onChange();
    } catch (e) {
      onError(String(e));
    }
  }

  async function publish(mode: string) {
    if (!target) return;
    try {
      const r = await api.publishNow(target.id, mode);
      if (r.outcome === "failure") {
        onError(`${cap.label}: ${r.error_message}`);
      }
      onChange();
    } catch (e) {
      onError(String(e));
    }
  }

  return (
    <div className={`target-row ${enabled ? "on" : ""}`}>
      <div className="target-head" onClick={() => setOpen(!open)}>
        <span className="target-name">
          <PlatformLogo platform={cap.platform as never} size={18} />
          <strong>{cap.label}</strong>
        </span>
        <div className="badges">
          <Badge on={!cap.can_upload_video} label="no video upload" kind="bad" />
          <Badge on={cap.requires_app_review} label="app review" kind="warn" />
          <Badge on={cap.requires_paid_tier} label="paid API" kind="warn" />
          <Badge on={cap.requires_business_account} label="business acct" kind="muted" />
          {target && (
            <span className={`status ${statusClass(target.status)}`}>{target.status}</span>
          )}
        </div>
      </div>

      {open && (
        <div className="target-body">
          {cap.can_upload_video && (
            <label className="field">
              <span>Title override</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>{isYouTube ? "Description" : "Caption override"}</span>
            <textarea
              rows={isYouTube ? 4 : 2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={
                isYouTube
                  ? masterCaption || "Video description — add #hashtags here too"
                  : masterCaption || "Inherits your post text"
              }
            />
          </label>
          {cap.supports_hashtags && !isYouTube && (
            <label className="field">
              <span>Hashtags</span>
              <input
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#one #two"
              />
            </label>
          )}
          <label className="field">
            <span>Privacy</span>
            <select value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
              <option value="public">public</option>
              <option value="unlisted">unlisted</option>
              <option value="private">private</option>
            </select>
          </label>

          {target?.external_url && (
            <div className="banner ok">
              Published: <code>{target.external_url}</code>
            </div>
          )}
          {target?.failure_reason && (
            <div className="banner error">{target.failure_reason}</div>
          )}
          {target?.published_at && (
            <p className="sub">Published {fmtTime(target.published_at)}</p>
          )}

          <div className="target-actions">
            <button className="ghost sm" onClick={save}>
              Save
            </button>
            <div className="sched">
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
              <button className="ghost sm" disabled={!when} onClick={schedule}>
                Schedule (local)
              </button>
              {cloudConnected && (
                <button className="ghost sm live" disabled={!when} onClick={scheduleLive}>
                  Schedule live (cloud)
                </button>
              )}
            </div>
            <span className="spacer" />
            <button className="ghost sm" onClick={() => publish("dry_run")}>
              Dry run
            </button>
            <button className="ghost sm" onClick={() => publish("mock")}>
              Publish (mock)
            </button>
          </div>
          {cloudMsg && <p className="sub">{cloudMsg}</p>}
          {cloud && !cloudConnected && (
            <p className="sub">Connect {cap.label} in Platforms to enable live scheduling.</p>
          )}
        </div>
      )}
    </div>
  );
}
