import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
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

const PLATFORMS: PlatformId[] = ["youtube", "tiktok", "instagram", "facebook", "x", "twitch", "rumble"];

/** Lifecycle bucket for a calendar entry — what the user actually wants to see:
 *  shipped (already sent), publishing (in flight), failed, or upcoming. */
type EntryState = "shipped" | "publishing" | "failed" | "upcoming";

function entryState(e: CalendarEntry): EntryState {
  const s = (e.job.status || "").toLowerCase();
  if (s === "failed" || s === "failure") return "failed";
  if (s === "publishing" || s === "running" || s === "claimed") return "publishing";
  if (
    s === "done" ||
    s === "published" ||
    s === "success" ||
    e.target.published_at != null
  )
    return "shipped";
  return "upcoming";
}

/** The wall-clock time that matters for this entry: when it shipped, else when it's due. */
function entryTime(e: CalendarEntry): string {
  const st = entryState(e);
  if (st === "shipped") return e.target.published_at ?? e.job.scheduled_for;
  return e.job.scheduled_for;
}

const hm = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const STATE_ICON: Record<EntryState, string> = {
  shipped: "✓",
  publishing: "•",
  failed: "!",
  upcoming: "○",
};
const STATE_LABEL: Record<EntryState, string> = {
  shipped: "Shipped",
  publishing: "Publishing",
  failed: "Failed",
  upcoming: "Upcoming",
};

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
  const [sel, setSel] = useState<CalEntry | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [confirmDay, setConfirmDay] = useState<string | null>(null); // day key pending "clear all"

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

  const shown = useMemo(
    () => entries.filter((e) => active.has(e.target.platform)),
    [entries, active],
  );

  // Month rollup — keeps a running scoreboard of history vs. what's coming.
  const counts = useMemo(() => {
    const c = { shipped: 0, publishing: 0, failed: 0, upcoming: 0 };
    for (const e of shown) c[entryState(e)]++;
    return c;
  }, [shown]);

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
          <p className="sub">Scheduled &amp; shipped posts · times in {LOCAL_TZ}</p>
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
        {(["shipped", "upcoming", "publishing", "failed"] as EntryState[]).map((st) => (
          <span className={`cal-legend-item st-${st}`} key={st}>
            <i className="cal-dot" />
            {STATE_LABEL[st]}
            <b>{counts[st]}</b>
          </span>
        ))}
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
                const dayKey = day ? `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}` : "";
                const confirming = confirmDay === dayKey && dayKey !== "";
                return (
                  <div className={`cal-cell ${day ? "" : "blank"} ${isToday ? "today" : ""}`} key={i}>
                    {day && (
                      <div className="cal-date-row">
                        <span className="cal-date">{day.getDate()}</span>
                        {dayEntries.length > 0 && !confirming && (
                          <button
                            className="cal-clear"
                            title={`Clear all ${dayEntries.length} on this day`}
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
                        <span>Delete {dayEntries.length}?</span>
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
                    {dayEntries.map((e) => {
                      const st = entryState(e);
                      return (
                        <button
                          key={e.job.id}
                          className={`cal-chip st-${st}`}
                          onClick={() => setSel(e)}
                          title={`${platformLabel(e.target.platform)} · ${STATE_LABEL[st]} · ${e.media_title ?? "post"}`}
                        >
                          <PlatformLogo platform={e.target.platform} size={15} />
                          <span className="chip-time">{hm(entryTime(e))}</span>
                          <span className="chip-title">{e.media_title ?? "post"}</span>
                          {e._source === "cloud" && (
                            <span className="chip-cloud" title="Live (cloud) post">
                              ☁
                            </span>
                          )}
                          <span className={`chip-state st-${st}`}>{STATE_ICON[st]}</span>
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
                  const dayEntries = entriesOn(d);
                  const isToday = sameDay(d, today);
                  const nowTop = (today.getHours() + today.getMinutes() / 60) * HOUR_PX;
                  return (
                    <div className="cal-week-col" key={i}>
                      {Array.from({ length: 24 }, (_, h) => (
                        <div className="cal-week-slot" style={{ height: HOUR_PX }} key={h} />
                      ))}
                      {isToday && <div className="cal-now" style={{ top: nowTop }} />}
                      {dayEntries.map((e) => {
                        const st = entryState(e);
                        const t = new Date(entryTime(e));
                        const top = (t.getHours() + t.getMinutes() / 60) * HOUR_PX;
                        return (
                          <button
                            key={e.job.id}
                            className={`cal-wchip st-${st}`}
                            style={{ top, "--pc": PLATFORM_COLOR[e.target.platform] } as CSSProperties}
                            onClick={() => setSel(e)}
                            title={`${platformLabel(e.target.platform)} · ${STATE_LABEL[st]} · ${e.media_title ?? "post"}`}
                          >
                            <span className="chip-time">{hm(entryTime(e))}</span>
                            <PlatformLogo platform={e.target.platform} size={13} />
                            <span className="chip-title">{e.media_title ?? "post"}</span>
                            {e._source === "cloud" && <span className="chip-cloud">☁</span>}
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

      {sel && (
        <EntryDetail
          entry={sel}
          onClose={() => setSel(null)}
          onChanged={() => {
            setSel(null);
            refresh();
          }}
          onOpenPost={onOpenPost}
          onDelete={async () => {
            await deleteEntries([sel]);
            setSel(null);
          }}
        />
      )}
    </div>
  );
}

function EntryDetail({
  entry,
  onClose,
  onChanged,
  onOpenPost,
  onDelete,
}: {
  entry: CalEntry;
  onClose: () => void;
  onChanged: () => void;
  onOpenPost: (id: string) => void;
  onDelete: () => void | Promise<void>;
}) {
  const [when, setWhen] = useState(utcIsoToLocalInput(entry.job.scheduled_for));
  const [confirmDel, setConfirmDel] = useState(false);
  const st = entryState(entry);
  const sentAt = entry.target.published_at;
  const url = entry.target.external_url;
  const attempts = entry.job.attempts;
  // Local mutation APIs (reschedule/cancel/retry) only touch the local SQLite DB,
  // so they don't apply to cloud (live) jobs — hide them there to avoid no-ops.
  const isCloud = entry._source === "cloud";
  const canEdit = !isCloud && st !== "shipped";

  // A plain-English line summarizing how it finished — the "what happened" the user wants.
  const outcome =
    st === "shipped"
      ? `Published to ${platformLabel(entry.target.platform)}${attempts > 1 ? ` after ${attempts} attempts` : ""}`
      : st === "failed"
        ? `Failed${attempts ? ` after ${attempts} attempt${attempts === 1 ? "" : "s"}` : ""}`
        : st === "publishing"
          ? "Publishing now…"
          : "Waiting to ship";

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3 className="drawer-title">
            <PlatformLogo platform={entry.target.platform} size={20} />
            {entry.media_title ?? "post"}
          </h3>
          <button className="ghost sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="drawer-status">
          <span className={`status st-${st}`}>{STATE_LABEL[st]}</span>
          <span className={`src-badge ${isCloud ? "cloud" : "local"}`}>
            {isCloud ? "☁ Live (cloud)" : "Local"}
          </span>
          <span className="muted">{outcome}</span>
        </div>

        {/* Lifecycle timeline — scheduled → shipped, with real timestamps. */}
        <ol className="cal-timeline">
          <li className="done">
            <b>Scheduled for</b>
            <span>{fmtTime(entry.job.scheduled_for)}</span>
          </li>
          {st === "shipped" && (
            <li className="done ok">
              <b>Shipped</b>
              <span>{fmtTime(sentAt ?? entry.job.scheduled_for)}</span>
            </li>
          )}
          {st === "failed" && (
            <li className="bad">
              <b>Failed</b>
              <span>{entry.target.failure_reason ?? "see Activity log"}</span>
            </li>
          )}
          {st === "publishing" && (
            <li className="busy">
              <b>Publishing</b>
              <span>in progress…</span>
            </li>
          )}
          {st === "upcoming" && (
            <li className="pending">
              <b>Up next</b>
              <span>not yet sent</span>
            </li>
          )}
        </ol>

        <div className="kv">
          <span>Platform</span>
          <span>{platformLabel(entry.target.platform)}</span>
          <span>Attempts</span>
          <span>
            {entry.job.attempts}/{entry.job.max_attempts}
          </span>
          {entry.target.external_post_id && (
            <>
              <span>Post ID</span>
              <span>
                <code>{entry.target.external_post_id}</code>
              </span>
            </>
          )}
          {url && (
            <>
              <span>Live link</span>
              <span>
                <button className="linkish" onClick={() => api.openUrl(url)}>
                  {url}
                </button>
              </span>
            </>
          )}
        </div>

        {canEdit && (
          <label className="field">
            <span>Reschedule</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
        )}

        {isCloud && st !== "shipped" && (
          <p className="sub">
            This is a live cloud job — the cloud worker publishes it. Edit timing from the cloud
            dashboard; local reschedule/cancel don't apply.
          </p>
        )}

        <div className="drawer-actions">
          {!isCloud && (
            <button className="ghost sm" onClick={() => onOpenPost(entry.post_id)}>
              Open in composer
            </button>
          )}
          {url && (
            <button className="ghost sm" onClick={() => api.openUrl(url)}>
              View live ↗
            </button>
          )}
          {!isCloud && (st === "failed" || st === "shipped") && (
            <button className="ghost sm" onClick={() => api.jobRetry(entry.job.id).then(onChanged)}>
              {st === "shipped" ? "Re-publish" : "Retry now"}
            </button>
          )}
          {canEdit && (
            <button
              className="ghost sm"
              onClick={() =>
                api.scheduleReschedule(entry.job.id, localInputToUtcIso(when), LOCAL_TZ).then(onChanged)
              }
            >
              Save time
            </button>
          )}
          {canEdit && (
            <button
              className="ghost sm danger"
              onClick={() => api.scheduleCancel(entry.job.id).then(onChanged)}
            >
              Cancel
            </button>
          )}
          {!confirmDel ? (
            <button className="ghost sm danger" onClick={() => setConfirmDel(true)}>
              Delete
            </button>
          ) : (
            <>
              <button className="ghost sm danger" onClick={() => onDelete()}>
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
            Removes this entry from the calendar. {st === "shipped" ? "The published video stays live on the platform — delete it there separately." : ""}
          </p>
        )}
      </div>
    </div>
  );
}
