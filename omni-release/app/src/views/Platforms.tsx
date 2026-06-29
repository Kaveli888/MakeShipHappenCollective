import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import type { PlatformCapability } from "../types.js";
import {
  backfillProfiles,
  cloudConfigured,
  connectPlatform,
  ensureWorkspace,
  getUser,
  listConnections,
  onAuthChange,
  type Connection,
  type CloudUser,
} from "../cloud/cloud.js";

function Cell({ on }: { on: boolean }) {
  return <td className={on ? "yes" : "no"}>{on ? "✓" : "—"}</td>;
}

// Platforms with a real OAuth provider on the backend (server/src/core/providers.ts).
// Others (e.g. Rumble) are display-only — no public API — so we don't offer a
// Connect button that would fail.
const CONNECTABLE = new Set(["youtube", "tiktok", "instagram", "facebook", "x", "linkedin", "twitch"]);

export default function Platforms() {
  const [caps, setCaps] = useState<PlatformCapability[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.capabilities().then(setCaps).catch((e) => setError(String(e)));
  }, []);

  // Track auth and bootstrap the workspace + connections when signed in.
  useEffect(() => {
    if (!cloudConfigured) return;
    getUser().then(setUser).catch(() => {});
    return onAuthChange(setUser);
  }, []);

  const loadConnections = useCallback(async () => {
    if (!user) {
      setWorkspaceId(null);
      setConnections([]);
      return;
    }
    try {
      const ws = await ensureWorkspace();
      setWorkspaceId(ws);
      setConnections(await listConnections(ws));
    } catch (e) {
      setError(String(e));
    }
  }, [user]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  async function connect(platform: string) {
    if (!workspaceId) return;
    setConnecting(platform);
    setError(null);
    try {
      await connectPlatform(platform, workspaceId);
      // The user finishes OAuth in the browser; poll for the new connection.
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const list = await listConnections(workspaceId);
        setConnections(list);
        if (list.some((c) => c.platform === platform && c.status === "connected")) break;
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(null);
    }
  }

  async function syncPhotos() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await backfillProfiles();
      if (workspaceId) setConnections(await listConnections(workspaceId));
      setNotice(
        res.updated > 0
          ? `Synced ${res.updated} account${res.updated === 1 ? "" : "s"}.`
          : "No account photos to update.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  }

  const connOf = (p: string) => connections.find((c) => c.platform === p);
  const hasConnected = connections.some((c) => c.status === "connected");

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>Platform Connections</h2>
          <p className="sub">
            Connect accounts via OAuth (handled by the backend; secrets never touch this app).
          </p>
        </div>
        {user && hasConnected && (
          <button
            className="ghost sm"
            disabled={syncing}
            title="Fetch the latest name + profile photo for connected accounts"
            onClick={syncPhotos}
          >
            {syncing ? "Syncing…" : "Sync account photos"}
          </button>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}

      {!cloudConfigured ? (
        <div className="banner info">
          Cloud is off. Set <code>VITE_SUPABASE_URL</code> + <code>VITE_SUPABASE_ANON_KEY</code> in{" "}
          <code>app/.env</code> and sign in to connect accounts. Until then the app is local-first
          (use <strong>mock</strong> publishing).
        </div>
      ) : !user ? (
        <div className="banner info">Sign in (sidebar) to connect platform accounts.</div>
      ) : (
        <div className="banner ok">
          Signed in. Only platforms whose OAuth client is configured on the backend can connect.
        </div>
      )}

      <div className="conn-cards">
        {caps.map((c) => {
          const conn = connOf(c.platform);
          return (
            <div className="conn-card" key={c.platform}>
              <div className="conn-head">
                <strong>{c.label}</strong>
                {conn ? (
                  <span className={`status ${conn.status === "connected" ? "ok" : "warn"}`}>
                    {conn.status}
                  </span>
                ) : (
                  <span className="status muted">{c.implementation_status.replace("_", " ")}</span>
                )}
              </div>
              <p className="sub">{c.notes}</p>
              <div className="scopes">
                {c.oauth_scopes.map((s) => (
                  <span className="chip" key={s}>
                    {s}
                  </span>
                ))}
              </div>
              {conn?.status === "connected" ? (
                <span className="sub">
                  Connected{conn.display_name ? ` as ${conn.display_name}` : ""} · stays signed in (auto-renews)
                </span>
              ) : !CONNECTABLE.has(c.platform) ? (
                <span className="sub">No public API — not connectable.</span>
              ) : (
                <button
                  className="ghost sm"
                  disabled={!user || !!connecting}
                  title={!user ? "Sign in first" : `Connect ${c.label}`}
                  onClick={() => connect(c.platform)}
                >
                  {connecting === c.platform ? "Waiting for browser…" : user ? "Connect" : "Connect (sign in)"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mt">Capability matrix</h3>
      <table className="data matrix">
        <thead>
          <tr>
            <th>Platform</th>
            <th>Upload video</th>
            <th>Direct publish</th>
            <th>Native schedule</th>
            <th>Business acct</th>
            <th>App review</th>
            <th>Paid tier</th>
            <th>Links</th>
            <th>Hashtags</th>
            <th>Thumbnail</th>
            <th>Analytics</th>
          </tr>
        </thead>
        <tbody>
          {caps.map((c) => (
            <tr key={c.platform}>
              <td>
                <strong>{c.label}</strong>
              </td>
              <Cell on={c.can_upload_video} />
              <Cell on={c.can_direct_publish} />
              <Cell on={c.can_schedule_native} />
              <Cell on={c.requires_business_account} />
              <Cell on={c.requires_app_review} />
              <Cell on={c.requires_paid_tier} />
              <Cell on={c.supports_link} />
              <Cell on={c.supports_hashtags} />
              <Cell on={c.supports_thumbnail} />
              <Cell on={c.supports_analytics} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
