export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${u[i]}`;
}

export function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const LOCAL_TZ =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** Convert a <input type="datetime-local"> value (local wall time) to a UTC ISO string. */
export function localInputToUtcIso(local: string): string {
  // `local` like "2026-06-27T18:30"; interpret in the browser's local tz.
  const d = new Date(local);
  return d.toISOString();
}

/** UTC ISO → value for <input type="datetime-local"> in local time. */
export function utcIsoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/** A sensible default for the schedule field: now + `minutes`, in local time,
 * formatted for <input type="datetime-local"> so the field is never empty. */
export function defaultScheduleInput(minutes = 2): string {
  return utcIsoToLocalInput(new Date(Date.now() + minutes * 60000).toISOString());
}

export function statusClass(status: string): string {
  switch (status) {
    case "published":
    case "success":
    case "done":
    case "ready":
      return "ok";
    case "failed":
    case "failure":
      return "bad";
    case "publishing":
    case "running":
    case "claimed":
    case "awaiting_agent":
      return "busy";
    case "scheduled":
    case "pending":
    case "queued":
    case "needs_attention":
      return "warn";
    default:
      return "muted";
  }
}
