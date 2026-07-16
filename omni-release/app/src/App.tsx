import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "./api.js";
import Library from "./views/Library.js";
import Composer from "./views/Composer.js";
import Calendar from "./views/Calendar.js";
import Activity from "./views/Activity.js";
import Platforms from "./views/Platforms.js";
import AccountPanel from "./cloud/AccountPanel.js";
import logoUrl from "./assets/logo.png";

type Nav = "library" | "calendar" | "platforms" | "activity";

// Persist the current view so a restart reopens exactly where you left off.
// Stored in the SQLite backend (via state_get/state_set) because the webview's
// localStorage does not reliably survive app restarts here.
const NAV_KEY = "ui.nav";
const COMPOSE_KEY = "ui.composePost";
const VALID_NAV: Nav[] = ["library", "calendar", "platforms", "activity"];

export default function App() {
  const [nav, setNav] = useState<Nav>("library");
  const [composePost, setComposePost] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore the last view from the DB on launch.
  useEffect(() => {
    (async () => {
      try {
        const [savedNav, savedCompose] = await Promise.all([
          invoke<string | null>("state_get", { key: NAV_KEY }),
          invoke<string | null>("state_get", { key: COMPOSE_KEY }),
        ]);
        if (savedNav && VALID_NAV.includes(savedNav as Nav)) setNav(savedNav as Nav);
        if (savedCompose) setComposePost(savedCompose);
      } catch {
        /* first run / no saved state — fine */
      }
      setRestored(true);
    })();
  }, []);

  // Persist changes — but only after the initial restore, so we don't overwrite
  // the saved state with the defaults during startup.
  useEffect(() => {
    if (restored) void invoke("state_set", { key: NAV_KEY, value: nav });
  }, [nav, restored]);
  useEffect(() => {
    if (restored) void invoke("state_set", { key: COMPOSE_KEY, value: composePost ?? "" });
  }, [composePost, restored]);

  function openComposer(postId: string) {
    setComposePost(postId);
  }
  // Start a brand-new post with no media preselected, then drop straight into the
  // composer where its media tray lets you attach images/video and ship.
  async function createPost() {
    try {
      const id = await api.postCreate(null);
      setComposePost(id);
    } catch {
      /* surfaced inside the composer on next load */
    }
  }
  function closeComposer() {
    setComposePost(null);
  }
  function go(n: Nav) {
    setNav(n);
    closeComposer();
  }

  // Start a window drag on every mousedown over the title strip. Calling
  // startDragging() manually (instead of relying solely on data-tauri-drag-region)
  // avoids the macOS quirk where the attribute only initiates a drag once per
  // focus — so the window moves no matter how many times you grab it. Double-click
  // toggles maximize, matching native title-bar behavior.
  function onTitlebarMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return; // left button only
    if (e.detail === 2) {
      void getCurrentWindow().toggleMaximize();
      return;
    }
    void getCurrentWindow().startDragging();
  }

  // Avoid a flash of the wrong view before the saved state loads.
  if (!restored) return <div className="app" />;

  return (
    <div className="app">
      {/* Draggable strip across the top frame so the window can be moved from
          the title-bar area at any time (macOS Overlay title bar). */}
      <div className="titlebar-drag" onMouseDown={onTitlebarMouseDown} />
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src={logoUrl} alt="Omni Release" />
          <div>
            <h1>Omni Release</h1>
            <p className="tagline">publishing command center</p>
          </div>
        </div>
        <nav className="navlist">
          <button className="nav-item nav-create" onClick={createPost}>
            <span className="nav-ico">✎</span> Create Post
          </button>
          <button
            className={`nav-item c-rose${nav === "library" && !composePost ? " on" : ""}`}
            onClick={() => go("library")}
          >
            <span className="nav-ico">🎬</span> Media Library
          </button>
          <button
            className={`nav-item c-coral${nav === "calendar" && !composePost ? " on" : ""}`}
            onClick={() => go("calendar")}
          >
            <span className="nav-ico">🗓</span> Calendar
          </button>
          <button
            className={`nav-item c-amber${nav === "platforms" && !composePost ? " on" : ""}`}
            onClick={() => go("platforms")}
          >
            <span className="nav-ico">🔌</span> Platforms
          </button>
          <button
            className={`nav-item c-gold${nav === "activity" && !composePost ? " on" : ""}`}
            onClick={() => go("activity")}
          >
            <span className="nav-ico">📜</span> Activity
          </button>
        </nav>
        <div className="side-foot">
          <AccountPanel />
          <span className="pill warn">local-first · mock mode</span>
        </div>
      </aside>

      <main className="main">
        {composePost ? (
          <Composer postId={composePost} onBack={closeComposer} />
        ) : nav === "library" ? (
          <Library onCompose={openComposer} />
        ) : nav === "calendar" ? (
          <Calendar onOpenPost={openComposer} />
        ) : nav === "platforms" ? (
          <Platforms />
        ) : (
          <Activity />
        )}
      </main>
    </div>
  );
}
