import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import type { PlatformCapability, PlatformId } from "../types.js";
import { PlatformLogo, platformLabel } from "../components/PlatformLogo.js";

type BrowserStatus = "ready" | "login_needed" | "human_gate" | "off";
type ReadinessMap = Record<string, BrowserStatus>;

const READINESS_KEY = "agent.browserReadiness";

const STATUS_META: Record<BrowserStatus, { label: string; className: string }> = {
  ready: { label: "Ready", className: "ok" },
  login_needed: { label: "Login needed", className: "warn" },
  human_gate: { label: "Human gate", className: "warn" },
  off: { label: "Off", className: "muted" },
};

const STATUS_ORDER: BrowserStatus[] = ["ready", "login_needed", "human_gate", "off"];
const STATUS_ACTION_LABEL: Record<BrowserStatus, string> = {
  ready: "Mark ready",
  login_needed: "Open login",
  human_gate: "Needs Jake",
  off: "Turn off",
};

const PLATFORM_URLS: Record<string, string> = {
  youtube: "https://www.youtube.com/@MakeShipHappenTech/posts",
  tiktok: "https://www.tiktok.com/upload",
  instagram: "https://www.instagram.com",
  facebook: "https://www.facebook.com",
  x: "https://x.com/compose/post",
  linkedin: "https://www.linkedin.com/feed",
  twitch: "https://dashboard.twitch.tv",
  rumble: "https://rumble.com/upload.php",
};

const PLAYBOOK_NOTES: Record<string, string> = {
  youtube: "Image/text cards use channel Posts. Video cards use Studio upload.",
  tiktok: "Video-first. Checkpoints are common; mark human gate and resume after Jake clears it.",
  instagram: "Best for reels/media posts. Browser flow may require a one-time account checkpoint.",
  facebook: "Works for profile or Page posting when the browser session has page access.",
  x: "Fastest pilot path. Text, link, image, and video posts are browser-friendly.",
  linkedin: "Good second pilot. Use personal profile or company page from the signed-in session.",
  twitch: "Keep off unless a specific browser workflow is added.",
  rumble: "Browser-only upload path. Good candidate after X/LinkedIn/YouTube are stable.",
};

function readStatus(map: ReadinessMap, platform: string): BrowserStatus {
  return map[platform] ?? "login_needed";
}

function asPlatformId(platform: string): PlatformId {
  return platform as PlatformId;
}

export default function Platforms() {
  const [caps, setCaps] = useState<PlatformCapability[]>([]);
  const [readiness, setReadiness] = useState<ReadinessMap>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.capabilities().then(setCaps).catch((e) => setError(String(e)));
    api
      .stateGet(READINESS_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as ReadinessMap;
        setReadiness(parsed);
      })
      .catch(() => {
        /* first run / invalid saved state is harmless */
      });
  }, []);

  const counts = useMemo(() => {
    const out: Record<BrowserStatus, number> = {
      ready: 0,
      login_needed: 0,
      human_gate: 0,
      off: 0,
    };
    for (const c of caps) out[readStatus(readiness, c.platform)]++;
    return out;
  }, [caps, readiness]);

  function updateStatus(platform: string, status: BrowserStatus) {
    setReadiness((prev) => {
      const next = { ...prev, [platform]: status };
      api.stateSet(READINESS_KEY, JSON.stringify(next)).catch((e) => setError(String(e)));
      return next;
    });
  }

  async function openPlatform(platform: string) {
    const url = PLATFORM_URLS[platform];
    if (!url) return;
    setError(null);
    try {
      await api.openUrl(url);
    } catch (e) {
      setError(String(e));
    }
  }

  function chooseStatus(platform: string, status: BrowserStatus) {
    updateStatus(platform, status);
    if (status === "login_needed") void openPlatform(platform);
  }

  async function syncResults() {
    setError(null);
    setNotice(null);
    try {
      const count = await api.ingestAgentResults();
      setNotice(
        count === 0
          ? "No new agent results."
          : `Synced ${count} agent result${count === 1 ? "" : "s"}.`,
      );
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>Browser Accounts</h2>
          <p className="sub">
            A dedicated signed-in browser profile is the publishing connection.
          </p>
        </div>
        <button className="ghost sm" onClick={syncResults}>
          Sync agent results
        </button>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}

      <div className="browser-summary">
        <div>
          <strong>{counts.ready}</strong>
          <span>Ready</span>
        </div>
        <div>
          <strong>{counts.login_needed + counts.human_gate}</strong>
          <span>Needs Jake</span>
        </div>
        <div>
          <strong>{counts.off}</strong>
          <span>Off</span>
        </div>
      </div>

      <div className="release-flow">
        <div>
          <strong>Release Card</strong>
          <span>Caption, media, platform targets, and schedule.</span>
        </div>
        <div>
          <strong>Agent Queue</strong>
          <span>Due cards are staged into the outbox with exact files.</span>
        </div>
        <div>
          <strong>Browser Runner</strong>
          <span>Posts through your signed-in browser and writes results back.</span>
        </div>
      </div>

      <div className="conn-cards browser-cards">
        {caps.map((c) => {
          const status = readStatus(readiness, c.platform);
          const meta = STATUS_META[status];
          return (
            <div className="conn-card browser-card" key={c.platform}>
              <div className="conn-head">
                <div className="target-name">
                  <PlatformLogo platform={asPlatformId(c.platform)} size={22} />
                  <strong>{platformLabel(asPlatformId(c.platform))}</strong>
                </div>
                <span className={`status ${meta.className}`}>{meta.label}</span>
              </div>

              <p className="sub">{PLAYBOOK_NOTES[c.platform] ?? c.notes}</p>

              <div className="browser-cap-row">
                <span className="chip">{c.can_upload_video ? "video" : "text/media"}</span>
                <span className="chip">{c.supports_hashtags ? "hashtags" : "no hashtags"}</span>
                <span className="chip">{c.supports_thumbnail ? "thumbnail" : "no thumbnail"}</span>
              </div>

              <div className="readiness-buttons">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    className={`ready-btn ${status === s ? "on" : ""}`}
                    onClick={() => chooseStatus(c.platform, s)}
                    title={
                      s === "login_needed"
                        ? `Open ${platformLabel(asPlatformId(c.platform))} so you can sign in`
                        : `${STATUS_ACTION_LABEL[s]} for ${platformLabel(asPlatformId(c.platform))}`
                    }
                  >
                    {STATUS_ACTION_LABEL[s]}
                  </button>
                ))}
              </div>

              <div className="browser-card-actions">
                <button className="ghost sm" onClick={() => openPlatform(c.platform)}>
                  Open
                </button>
                <span className="sub">
                  {c.can_direct_publish ? "API fallback possible" : "browser route only"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
