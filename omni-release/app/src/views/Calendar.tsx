import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { api } from "../api.js";
import type { CalendarEntry, PlatformId } from "../types.js";
import { PlatformLogo, platformLabel, PLATFORM_COLOR } from "../components/PlatformLogo.js";
import {
  cloudConfigured,
  deleteCloudJobs,
  ensureWorkspace,
  getUser,
  listCloudCalendar,
} from "../cloud/cloud.js";
import {
  LOCAL_TZ,
  fmtTime,
  localInputToUtcIso,
  utcIsoToLocalInput,
} from "../util.js";

/** A calendar entry tagged with where it came from, so we can badge cloud (live)
 *  posts distinctly and never confuse the two scheduling paths again. */
type CalEntry = CalendarEntry & { _source: "local" | "cloud" };

const PLATFORMS: PlatformId[] = ["youtube", "tiktok", "instagram", "facebook", "x", "linkedin", "twitch", "rumble"];

/** Lifecycle bucket for a calendar entry — what the user actually wants to see:
 *  shipped only means the platform target has real publish proof. */
type EntryState = "shipped" | "mocked" | "publishing" | "needs_attention" | "failed" | "upcoming";

function isMockTarget(e: CalendarEntry): boolean {
  const id = (e.target.external_post_id ?? "").toLowerCase();
  const url = (e.target.external_url ?? "").toLowerCase();
  return id.startsWith("mock-") || url.startsWith("mock://");
}

function entryState(e: CalendarEntry): EntryState {
  const target = (e.target.status || "").toLowerCase();
  const job = (e.job.status || "").toLowerCase();
  if (isMockTarget(e)) return "mocked";
  if (target === "published" || e.target.published_at != null) return "shipped";
  if (target === "needs_attention") return "needs_attention";
  if (target === "failed" || target === "failure") return "failed";
  if (target === "publishing" || target === "awaiting_agent") return "publishing";
  if (job === "failed" || job === "failure") return "failed";
  if (job === "publishing" || job === "running" || job === "claimed") return "publishing";
  if (job === "done") return "publishing";
  return "upcoming";
}

/** The wall-clock time that matters for this entry: when it shipped, else when it's due. */
function entryTime(e: CalendarEntry): string {
  const st = entryState(e);
  if (st === "shipped" || st === "mocked") return e.target.published_at ?? e.job.scheduled_for;
  return e.job.scheduled_for;
}

const hm = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const STATE_ICON: Record<EntryState, string> = {
  shipped: "✓",
  mocked: "M",
  publishing: "•",
  needs_attention: "!",
  failed: "!",
  upcoming: "○",
};
const STATE_LABEL: Record<EntryState, string> = {
  shipped: "Shipped",
  mocked: "Mocked",
  publishing: "Publishing",
  needs_attention: "Needs Human",
  failed: "Failed",
  upcoming: "Upcoming",
};

/** Stable left-to-right ordering of platform logos inside a grouped bar. */
const PLATFORM_ORDER: Record<string, number> = Object.fromEntries(
  PLATFORMS.map((p, i) => [p, i]),
);

/** One scheduled post fans out into one entry per platform target (they share a
 *  post_id + scheduled_for). A CalGroup collapses those back into the single
 *  release the user actually scheduled, so the calendar shows ONE horizontal
 *  bar with a row of platform logos — not one stacked row per platform. */
type CalGroup = {
  key: string;
  post_id: string;
  time: string; // earliest wall-clock in the group — used for day placement + display
  title: string | null;
  entries: CalEntry[];
  state: EntryState; // aggregate, see groupState
};

/** Targets belong to the same bar when they're the same post at the same minute.
 *  (Minute granularity so tiny per-platform publish-time drift still groups.) */
function groupKey(e: CalEntry): string {
  const t = new Date(e.job.scheduled_for);
  t.setSeconds(0, 0);
  return `${e.post_id}__${t.getTime()}`;
}

/** A bar's state surfaces the most action-worthy target it contains. */
const GROUP_STATE_ORDER: EntryState[] = [
  "failed",
  "needs_attention",
  "publishing",
  "upcoming",
  "mocked",
  "shipped",
];
function groupState(entries: CalEntry[]): EntryState {
  const seen = new Set(entries.map(entryState));
  return GROUP_STATE_ORDER.find((s) => seen.has(s)) ?? "shipped";
}

/** Completed = terminal "done" states (real publish proof, or mock proof). */
function isDone(e: CalendarEntry): boolean {
  const st = entryState(e);
  return st === "shipped" || st === "mocked";
}

/** Targets we can actually reschedule from this app: local SQLite jobs that
 *  haven't shipped. Cloud jobs are owned by the cloud worker; shipped targets
 *  are history. Same rule the detail drawer uses for "Save time". */
function draggableEntries(g: CalGroup): CalEntry[] {
  return g.entries.filter((e) => e._source === "local" && entryState(e) !== "shipped");
}

/** Collapse a flat list of per-platform entries into grouped release bars. */
function buildGroups(list: CalEntry[]): CalGroup[] {
  const map = new Map<string, CalEntry[]>();
  for (const e of list) {
    const arr = map.get(groupKey(e));
    if (arr) arr.push(e);
    else map.set(groupKey(e), [e]);
  }
  const groups: CalGroup[] = [];
  for (const [key, entries] of map) {
    entries.sort(
      (a, b) =>
        (PLATFORM_ORDER[a.target.platform] ?? 99) - (PLATFORM_ORDER[b.target.platform] ?? 99),
    );
    const time = entries.map(entryTime).sort((a, b) => +new Date(a) - +new Date(b))[0];
    groups.push({
      key,
      post_id: entries[0].post_id,
      time,
      title: entries[0].media_title,
      entries,
      state: groupState(entries),
    });
  }
  return groups.sort((a, b) => +new Date(a.time) - +new Date(b.time));
}

/** Row height (px) of a single hour in the Week time-grid. */
const HOUR_PX = 44;
/** Sunday (00:00) of the week containing d. */
const startOfWeek = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
};
const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const hourLabel = (h: number): string =>
  new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" });

export default function Calendar({ onOpenPost }: { onOpenPost: (id: string) => void }) {
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [entries, setEntries] = useState<CalEntry[]>([]);
  const [active, setActive] = useState<Set<PlatformId>>(() => new Set(PLATFORMS));
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<CalGroup | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [confirmDay, setConfirmDay] = useState<string | null>(null); // day key pending "clear all"
  // History toggle: ON shows shipped/mocked cards on the calendar, OFF hides
  // them so only active work is visible. Persisted so it survives restarts.
  const [showCompleted, setShowCompleted] = useState(true);

  useEffect(() => {
    api
      .stateGet("calendar.show_completed")
      .then((v) => {
        if (v === "off") setShowCompleted(false);
      })
      .catch(() => {});
  }, []);
  const toggleCompleted = () =>
    setShowCompleted((v) => {
      const next = !v;
      api.stateSet("calendar.show_completed", next ? "on" : "off").catch(() => {});
      return next;
    });
  // Drag-to-reschedule. Tauri's native drag layer (needed by the Composer's
  // Finder file drops) eats HTML5 dragstart/drop inside the webview on macOS,
  // so this is a pointer-event drag: capture the pointer on the bar, float a
  // ghost, hit-test day cells via elementFromPoint, reschedule on release.
  // The dragged group lives in a ref (the 6s poll can replace `entries`
  // mid-drag); the key/target/ghost states just drive the visuals.
  const dragGroup = useRef<CalGroup | null>(null);
  const didDrag = useRef(false); // swallow the click that follows a completed drag
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);

  // Resolve the cloud workspace once so we can also pull live-scheduled jobs.
  useEffect(() => {
    if (!cloudConfigured) return;
    (async () => {
      try {
        if (!(await getUser())) return;
        setWorkspaceId(await ensureWorkspace());
      } catch {
        /* cloud optional; calendar still works local-only */
      }
    })();
  }, []);

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);

  const range = useMemo(() => {
    if (view === "week") {
      return { from: weekStart.toISOString(), to: addDays(weekStart, 7).toISOString() };
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [view, cursor, weekStart]);

  const refresh = useCallback(async () => {
    // Local SQLite jobs + cloud (live) jobs, merged. Either source failing alone
    // shouldn't blank the calendar, so settle both and surface only real errors.
    const [localR, cloudR] = await Promise.allSettled([
      api.calendarList(range.from, range.to),
      workspaceId ? listCloudCalendar(workspaceId, range.from, range.to) : Promise.resolve([]),
    ]);
    const merged: CalEntry[] = [];
    if (localR.status === "fulfilled")
      merged.push(...localR.value.map((e) => ({ ...e, _source: "local" as const })));
    if (cloudR.status === "fulfilled")
      merged.push(...cloudR.value.map((e) => ({ ...e, _source: "cloud" as const })));
    setEntries(merged);

    const errs = [localR, cloudR].filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    setError(errs.length && merged.length === 0 ? String(errs[0].reason) : null);
  }, [range, workspaceId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 6000); // reflect scheduler progress live
    return () => clearInterval(t);
  }, [refresh]);

  // Delete calendar entries, routing each to its source (cloud vs local SQLite).
  // Removes the schedule record only — never the published video on the platform.
  const deleteEntries = useCallback(
    async (list: CalEntry[]) => {
      try {
        const cloudIds = list.filter((e) => e._source === "cloud").map((e) => e.job.id);
        const localIds = list.filter((e) => e._source === "local").map((e) => e.job.id);
        if (cloudIds.length) await deleteCloudJobs(cloudIds);
        for (const id of localIds) await api.jobDelete(id);
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  // Drop a dragged release card onto a new day (optionally a new hour, from the
  // week grid). Keeps the original minutes so "5:45 PM" stays "5:45 PM" when you
  // only change the day. Only local, not-yet-shipped targets move.
  const moveGroup = useCallback(
    async (g: CalGroup, day: Date, hour?: number) => {
      const movable = draggableEntries(g);
      if (!movable.length) return;
      const from = new Date(movable[0].job.scheduled_for);
      const to = new Date(day);
      to.setHours(hour ?? from.getHours(), from.getMinutes(), 0, 0);
      if (to.getTime() === from.getTime()) return;
      try {
        await Promise.all(
          movable.map((e) => api.scheduleReschedule(e.job.id, to.toISOString(), LOCAL_TZ)),
        );
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  const endDrag = () => {
    dragGroup.current = null;
    setDragKey(null);
    setDropTarget(null);
    setGhost(null);
  };

  /** Find the droppable day under the cursor. Cells carry data-dropkey
   *  ("cell:<index into days>" or "wk:<index into weekDays>"); the ghost is
   *  pointer-events:none so elementFromPoint sees through it. */
  const hitTest = (x: number, y: number): HTMLElement | null =>
    (document.elementFromPoint(x, y)?.closest("[data-dropkey]") as HTMLElement | null) ?? null;

  const onBarPointerDown = (ev: ReactPointerEvent<HTMLButtonElement>, g: CalGroup) => {
    if (ev.button !== 0 || draggableEntries(g).length === 0) return;
    const el = ev.currentTarget;
    const pointerId = ev.pointerId;
    const startX = ev.clientX;
    const startY = ev.clientY;
    const label = `${hm(g.time)} · ${g.title ?? "release card"}`;
    let dragging = false;

    const move = (me: PointerEvent) => {
      if (!dragging) {
        // 5px threshold so plain clicks still open the detail drawer
        if (Math.hypot(me.clientX - startX, me.clientY - startY) < 5) return;
        dragging = true;
        dragGroup.current = g;
        setDragKey(g.key);
      }
      me.preventDefault();
      setGhost({ x: me.clientX, y: me.clientY, label });
      const hit = hitTest(me.clientX, me.clientY);
      setDropTarget(hit?.dataset.dropkey ?? null);
    };
    const finish = (ue: PointerEvent, commit: boolean) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      try {
        el.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
      if (dragging) {
        didDrag.current = true;
        if (commit) {
          const hit = hitTest(ue.clientX, ue.clientY);
          const key = hit?.dataset.dropkey;
          if (hit && key?.startsWith("cell:")) {
            const day = days[Number(key.slice(5))];
            if (day) moveGroup(g, day);
          } else if (hit && key?.startsWith("wk:")) {
            const day = weekDays[Number(key.slice(3))];
            const rect = hit.getBoundingClientRect();
            const hour = Math.max(0, Math.min(23, Math.floor((ue.clientY - rect.top) / HOUR_PX)));
            if (day) moveGroup(g, day, hour);
          }
        }
      }
      endDrag();
    };
    const up = (ue: PointerEvent) => finish(ue, true);
    const cancel = (ue: PointerEvent) => finish(ue, false);

    el.setPointerCapture(pointerId);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
  };

  /** Bar onClick guard: a completed drag ends with a click we must ignore. */
  const clickUnlessDragged = (g: CalGroup) => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setSel(g);
  };

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startPad = first.getDay();
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const platformShown = useMemo(
    () => entries.filter((e) => active.has(e.target.platform)),
    [entries, active],
  );
  // What the grid renders: with Completed off, shipped/mocked history is hidden
  // so only active work stays on the calendar.
  const shown = useMemo(
    () => (showCompleted ? platformShown : platformShown.filter((e) => !isDone(e))),
    [platformShown, showCompleted],
  );
  const doneCount = useMemo(() => platformShown.filter(isDone).length, [platformShown]);

  // Month rollup — keeps a running scoreboard of history vs. what's coming.
  // Counted before the Completed filter so the scoreboard stays honest even
  // while completed cards are hidden from the grid.
  const counts = useMemo(() => {
    const c: Record<EntryState, number> = {
      shipped: 0,
      mocked: 0,
      publishing: 0,
      needs_attention: 0,
      failed: 0,
      upcoming: 0,
    };
    for (const e of platformShown) c[entryState(e)]++;
    return c;
  }, [platformShown]);

  function entriesOn(day: Date): CalEntry[] {
    return shown
      .filter((e) => {
        const d = new Date(entryTime(e));
        return (
          d.getFullYear() === day.getFullYear() &&
          d.getMonth() === day.getMonth() &&
          d.getDate() === day.getDate()
        );
      })
      .sort((a, b) => +new Date(entryTime(a)) - +new Date(entryTime(b)));
  }

  const today = new Date();
  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = addDays(weekStart, 6);
  const weekLabel =
    weekStart.getMonth() === weekEnd.getMonth()
      ? `${weekStart.toLocaleString(undefined, { month: "short" })} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
      : `${weekStart.toLocaleString(undefined, { month: "short" })} ${weekStart.getDate()} – ${weekEnd.toLocaleString(undefined, { month: "short" })} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  const tzAbbrev =
    new Date().toLocaleTimeString(undefined, { timeZoneName: "short" }).split(" ").pop() ?? "";

  const goPrev = () =>
    setCursor(view === "week" ? addDays(cursor, -7) : new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () =>
    setCursor(view === "week" ? addDays(cursor, 7) : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const togglePlatform = (p: PlatformId) =>
    setActive((prev) => {
      const n = new Set(prev);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });

  return (
    <div className="view cal-view">
      <div className="view-head">
        <div>
          <h2>Calendar</h2>
          <p className="sub">Scheduled &amp; shipped release cards · times in {LOCAL_TZ}</p>
        </div>
        <div className="cal-controls">
          <button className="ghost sm" onClick={goPrev} title="Previous">
            ←
          </button>
          <strong className="month-label">{view === "week" ? weekLabel : monthLabel}</strong>
          <button className="ghost sm" onClick={goNext} title="Next">
            →
          </button>
          <button className="ghost sm" onClick={() => setCursor(new Date())}>
            Today
          </button>
          <div className="cal-viewswitch">
            <button
              className={`cal-vbtn ${view === "month" ? "on" : ""}`}
              onClick={() => setView("month")}
            >
              Month
            </button>
            <button
              className={`cal-vbtn ${view === "week" ? "on" : ""}`}
              onClick={() => setView("week")}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      <div className="cal-legend">
        {(["shipped", "mocked", "upcoming", "publishing", "needs_attention", "failed"] as EntryState[]).map((st) => (
          <span
            className={`cal-legend-item st-${st}${
              !showCompleted && (st === "shipped" || st === "mocked") ? " hushed" : ""
            }`}
            key={st}
          >
            <i className="cal-dot" />
            {STATE_LABEL[st]}
            <b>{counts[st]}</b>
          </span>
        ))}
        <button
          className={`cal-done-toggle${showCompleted ? " on" : ""}`}
          onClick={toggleCompleted}
          title={
            showCompleted
              ? "Hide completed cards — keep the calendar to active work only"
              : `Show completed history on the calendar (${doneCount} card${doneCount === 1 ? "" : "s"})`
          }
        >
          ✓ Completed{showCompleted ? "" : doneCount > 0 ? ` (${doneCount} hidden)` : ""}
        </button>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="cal-layout">
        {/* Left rail: mini-month navigator + platform layer toggles (Outlook-style). */}
        <aside className="cal-rail">
          <div className="mini-cal">
            <div className="mini-head">
              <button
                className="mini-nav"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <span>{monthLabel}</span>
              <button
                className="mini-nav"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              >
                ›
              </button>
            </div>
            <div className="mini-grid">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span className="mini-dow" key={i}>
                  {d}
                </span>
              ))}
              {days.map((day, i) =>
                day ? (
                  <button
                    key={i}
                    className={`mini-day${sameDay(day, today) ? " today" : ""}${
                      view === "week" && day >= weekStart && day < addDays(weekStart, 7) ? " inweek" : ""
                    }${sameDay(day, cursor) ? " sel" : ""}`}
                    onClick={() => setCursor(new Date(day))}
                  >
                    {day.getDate()}
                  </button>
                ) : (
                  <span className="mini-day blank" key={i} />
                ),
              )}
            </div>
          </div>

          <div className="cal-sources">
            <div className="cal-sources-head">Platforms</div>
            {PLATFORMS.map((p) => (
              <button
                key={p}
                className={`cal-source${active.has(p) ? " on" : ""}`}
                style={{ "--pc": PLATFORM_COLOR[p] } as CSSProperties}
                onClick={() => togglePlatform(p)}
              >
                <span className="cal-source-box" />
                <PlatformLogo platform={p} size={15} />
                <span className="cal-source-label">{platformLabel(p)}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="cal-main">
          {view === "month" ? (
            <div className="cal-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div className="cal-dow" key={d}>
                  {d}
                </div>
              ))}
              {days.map((day, i) => {
                const isToday = day && sameDay(day, today);
                const dayEntries = day ? entriesOn(day) : [];
                const dayGroups = buildGroups(dayEntries);
                const dayKey = day ? `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}` : "";
                const confirming = confirmDay === dayKey && dayKey !== "";
                return (
                  <div
                    className={`cal-cell ${day ? "" : "blank"} ${isToday ? "today" : ""}${
                      day && dropTarget === `cell:${i}` ? " dropok" : ""
                    }`}
                    key={i}
                    data-dropkey={day ? `cell:${i}` : undefined}
                  >
                    {day && (
                      <div className="cal-date-row">
                        <span className="cal-date">{day.getDate()}</span>
                        {dayGroups.length > 0 && !confirming && (
                          <button
                            className="cal-clear"
                            title={`Clear all ${dayGroups.length} on this day`}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setConfirmDay(dayKey);
                            }}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    )}
                    {confirming && (
                      <div className="cal-confirm">
                        <span>Delete {dayGroups.length}?</span>
                        <button
                          className="cal-confirm-yes"
                          onClick={() => {
                            setConfirmDay(null);
                            deleteEntries(dayEntries);
                          }}
                        >
                          Delete
                        </button>
                        <button className="cal-confirm-no" onClick={() => setConfirmDay(null)}>
                          Keep
                        </button>
                      </div>
                    )}
                    {dayGroups.map((g) => {
                      const canDrag = draggableEntries(g).length > 0;
                      return (
                      <button
                        key={g.key}
                        className={`cal-bar st-${g.state}${dragKey === g.key ? " dragging" : ""}${canDrag ? " grabbable" : ""}`}
                        onPointerDown={canDrag ? (ev) => onBarPointerDown(ev, g) : undefined}
                        onClick={() => clickUnlessDragged(g)}
                        title={`${g.entries.map((e) => platformLabel(e.target.platform)).join(", ")} · ${STATE_LABEL[g.state]} · ${g.title ?? "release card"}${canDrag ? " · drag to another day to reschedule" : ""}`}
                      >
                        <span className="bar-logos">
                          {g.entries.map((e) => (
                            <PlatformLogo key={e.job.id} platform={e.target.platform} size={14} />
                          ))}
                        </span>
                        <span className="chip-time">{hm(g.time)}</span>
                        <span className="chip-title">{g.title ?? "release card"}</span>
                        {g.entries.some((e) => e._source === "cloud") && (
                          <span className="chip-cloud" title="Cloud scheduled card">
                            ☁
                          </span>
                        )}
                        <span className={`chip-state st-${g.state}`}>{STATE_ICON[g.state]}</span>
                      </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="cal-week">
              <div className="cal-week-head">
                <div className="cal-week-tzcol">{tzAbbrev}</div>
                {weekDays.map((d, i) => (
                  <div className={`cal-week-dh${sameDay(d, today) ? " today" : ""}`} key={i}>
                    <span className="cal-week-dow">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]}
                    </span>
                    <span className="cal-week-dnum">{d.getDate()}</span>
                  </div>
                ))}
              </div>
              <div className="cal-week-body" style={{ height: 24 * HOUR_PX }}>
                <div className="cal-week-gutter">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div className="cal-week-hour" style={{ height: HOUR_PX }} key={h}>
                      <span>{hourLabel(h)}</span>
                    </div>
                  ))}
                </div>
                {weekDays.map((d, i) => {
                  const dayGroups = buildGroups(entriesOn(d));
                  const isToday = sameDay(d, today);
                  const nowTop = (today.getHours() + today.getMinutes() / 60) * HOUR_PX;
                  return (
                    <div
                      className={`cal-week-col${dropTarget === `wk:${i}` ? " dropok" : ""}`}
                      key={i}
                      data-dropkey={`wk:${i}`}
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <div className="cal-week-slot" style={{ height: HOUR_PX }} key={h} />
                      ))}
                      {isToday && <div className="cal-now" style={{ top: nowTop }} />}
                      {dayGroups.map((g) => {
                        const t = new Date(g.time);
                        const top = (t.getHours() + t.getMinutes() / 60) * HOUR_PX;
                        const lead = g.entries[0].target.platform;
                        const canDrag = draggableEntries(g).length > 0;
                        return (
                          <button
                            key={g.key}
                            className={`cal-wchip st-${g.state}${dragKey === g.key ? " dragging" : ""}${canDrag ? " grabbable" : ""}`}
                            style={{ top, "--pc": PLATFORM_COLOR[lead] } as CSSProperties}
                            onPointerDown={canDrag ? (ev) => onBarPointerDown(ev, g) : undefined}
                            onClick={() => clickUnlessDragged(g)}
                            title={`${g.entries.map((e) => platformLabel(e.target.platform)).join(", ")} · ${STATE_LABEL[g.state]} · ${g.title ?? "release card"}${canDrag ? " · drag to reschedule" : ""}`}
                          >
                            <span className="chip-time">{hm(g.time)}</span>
                            <span className="bar-logos">
                              {g.entries.map((e) => (
                                <PlatformLogo key={e.job.id} platform={e.target.platform} size={13} />
                              ))}
                            </span>
                            <span className="chip-title">{g.title ?? "release card"}</span>
                            {g.entries.some((e) => e._source === "cloud") && (
                              <span className="chip-cloud">☁</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {ghost && (
        <div className="cal-drag-ghost" style={{ left: ghost.x + 12, top: ghost.y + 10 }}>
          {ghost.label}
        </div>
      )}

      {sel && (
        <EntryDetail
          group={sel}
          onClose={() => setSel(null)}
          onChanged={() => {
            setSel(null);
            refresh();
          }}
          onOpenPost={onOpenPost}
          onDelete={async (list) => {
            await deleteEntries(list);
            setSel(null);
          }}
        />
      )}
    </div>
  );
}

function EntryDetail({
  group,
  onClose,
  onChanged,
  onOpenPost,
  onDelete,
}: {
  group: CalGroup;
  onClose: () => void;
  onChanged: () => void;
  onOpenPost: (id: string) => void;
  onDelete: (list: CalEntry[]) => void | Promise<void>;
}) {
  const entries = group.entries;
  const [when, setWhen] = useState(utcIsoToLocalInput(entries[0].job.scheduled_for));
  const [confirmDel, setConfirmDel] = useState(false);

  const anyCloud = entries.some((e) => e._source === "cloud");
  const allCloud = entries.every((e) => e._source === "cloud");
  const localEntry = entries.find((e) => e._source === "local");
  // Local mutation APIs (reschedule/cancel) only touch the local SQLite DB, so they
  // apply to the local, not-yet-shipped targets in this release — never cloud jobs.
  const editable = entries.filter((e) => e._source === "local" && entryState(e) !== "shipped");
  const shippedCount = entries.filter((e) => entryState(e) === "shipped").length;
  // Targets the user can hand-mark as published ("I posted this myself").
  const markable = entries.filter((e) => {
    const st = entryState(e);
    return e._source === "local" && st !== "shipped" && st !== "mocked";
  });
  const markAllPublished = () =>
    Promise.all(markable.map((e) => api.jobMarkPublished(e.job.id))).then(onChanged);

  const rescheduleAll = () =>
    Promise.all(
      editable.map((e) => api.scheduleReschedule(e.job.id, localInputToUtcIso(when), LOCAL_TZ)),
    ).then(onChanged);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3 className="drawer-title">
            <span className="bar-logos">
              {entries.map((e) => (
                <PlatformLogo key={e.job.id} platform={e.target.platform} size={18} />
              ))}
            </span>
            {group.title ?? "release card"}
          </h3>
          <button className="ghost sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="drawer-status">
          <span className={`status st-${group.state}`}>{STATE_LABEL[group.state]}</span>
          <span className={`src-badge ${allCloud ? "cloud" : "local"}`}>
            {allCloud ? "☁ Live (cloud)" : anyCloud ? "☁ Mixed" : "Local"}
          </span>
          <span className="muted">
            {entries.length} platform{entries.length === 1 ? "" : "s"} · {shippedCount}/
            {entries.length} shipped
          </span>
        </div>

        <ol className="cal-timeline">
          <li className="done">
            <b>Scheduled for</b>
            <span>{fmtTime(entries[0].job.scheduled_for)}</span>
          </li>
        </ol>

        {/* Per-platform breakdown of the one scheduled release. */}
        <div className="grp-targets">
          {entries.map((e) => {
            const est = entryState(e);
            const mocked = isMockTarget(e);
            const url = mocked ? null : e.target.external_url;
            return (
              <div className={`grp-target st-${est}`} key={e.job.id}>
                <PlatformLogo platform={e.target.platform} size={16} />
                <span className="grp-target-name">{platformLabel(e.target.platform)}</span>
                <span className={`status sm st-${est}`}>{STATE_LABEL[est]}</span>
                {url && (
                  <button className="linkish sm" onClick={() => api.openUrl(url)} title={url}>
                    View live ↗
                  </button>
                )}
                {e._source === "local" && (est === "failed" || est === "shipped" || est === "mocked") && (
                  <button className="ghost xs" onClick={() => api.jobRetry(e.job.id).then(onChanged)}>
                    {est === "shipped" || est === "mocked" ? "Re-publish" : "Retry"}
                  </button>
                )}
                {e._source === "local" && est !== "shipped" && est !== "mocked" && (
                  <button
                    className="ghost xs markpub"
                    title="I posted this on the platform myself — mark it published"
                    onClick={() => api.jobMarkPublished(e.job.id).then(onChanged)}
                  >
                    ✓ Mark published
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {editable.length > 0 && (
          <label className="field">
            <span>Reschedule {editable.length === entries.length ? "all" : editable.length}</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
        )}

        {anyCloud && (
          <p className="sub">
            {allCloud ? "This is a live cloud release" : "Some targets are live cloud jobs"} — the
            cloud worker publishes {allCloud ? "it" : "them"}. Edit timing from the cloud dashboard;
            local reschedule/cancel don't apply.
          </p>
        )}

        <div className="drawer-actions">
          {localEntry && (
            <button className="ghost sm" onClick={() => onOpenPost(localEntry.post_id)}>
              Open in composer
            </button>
          )}
          {markable.length > 1 && (
            <button
              className="ghost sm markpub"
              title="I posted these on the platforms myself — mark them all published"
              onClick={markAllPublished}
            >
              ✓ Mark all published ({markable.length})
            </button>
          )}
          {editable.length > 0 && (
            <button className="ghost sm" onClick={rescheduleAll}>
              Save time
            </button>
          )}
          {editable.length > 0 && (
            <button
              className="ghost sm danger"
              onClick={() =>
                Promise.all(editable.map((e) => api.scheduleCancel(e.job.id))).then(onChanged)
              }
            >
              Cancel {editable.length === entries.length ? "all" : editable.length}
            </button>
          )}
          {!confirmDel ? (
            <button className="ghost sm danger" onClick={() => setConfirmDel(true)}>
              Delete{entries.length > 1 ? ` all (${entries.length})` : ""}
            </button>
          ) : (
            <>
              <button className="ghost sm danger" onClick={() => onDelete(entries)}>
                Confirm delete
              </button>
              <button className="ghost sm" onClick={() => setConfirmDel(false)}>
                Keep
              </button>
            </>
          )}
        </div>
        {confirmDel && (
          <p className="sub del-note">
            Removes {entries.length > 1 ? `all ${entries.length} targets` : "this entry"} from the
            calendar.
            {shippedCount > 0
              ? " Published videos stay live on their platforms — delete them there separately."
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}
