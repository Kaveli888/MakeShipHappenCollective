import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import {
  agentPacketForCard,
  agentValidationForCard,
  platformUrl,
  postType,
  publishSurface,
  type AgentCardForPacket,
  type AgentPacket,
  type AgentValidationStatus,
  type MediaItem,
} from "./agentPacket.js";

const execFileAsync = promisify(execFile);

interface ScheduledRow {
  job_id: string;
  scheduled_for: string;
  timezone: string;
  job_status: string;
  run_after: string;
  attempts: number;
  max_attempts: number;
  target_id: string;
  platform: string;
  target_status: string;
  caption_override: string | null;
  title_override: string | null;
  hashtags: string | null;
  privacy: string | null;
  options: string | null;
  post_id: string;
  master_caption: string | null;
  link: string | null;
  cta: string | null;
  storage_key: string | null;
  filename: string | null;
  mime_type: string | null;
  duration_sec: number | null;
  aspect_ratio: string | null;
  thumbnail_key: string | null;
}

interface ReportItem {
  source: "scheduled" | "due";
  status: AgentValidationStatus;
  job_id: string;
  target_id?: string | null;
  platform?: string | null;
  scheduled_for?: string | null;
  local_time?: string | null;
  job_status?: string | null;
  target_status?: string | null;
  post_type?: string | null;
  publish_surface?: string | null;
  platform_url?: string | null;
  title?: string | null;
  media_path?: string | null;
  card_path?: string | null;
  packet_path?: string | null;
  blocks: string[];
  warnings: string[];
}

interface PreflightReport {
  generated_at: string;
  window: {
    start: string;
    end: string;
    label: string;
  };
  db_path: string;
  outbox_dir: string;
  heartbeat: {
    path: string;
    present: boolean;
    fresh: boolean;
    age_seconds: number | null;
    message: string | null;
  };
  scheduled: ReportItem[];
  due: ReportItem[];
  status: AgentValidationStatus;
}

function argValue(name: string, fallback: string): string {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasArg(name: string): boolean {
  return process.argv.includes(name);
}

function numberArg(name: string, fallback: number): number {
  const raw = argValue(name, String(fallback));
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function defaultDbPath(): string {
  return path.join(os.homedir(), "Library/Application Support/tech.makeshiphappen.omnirelease/omni.db");
}

function appRootFromDb(dbPath: string): string {
  return path.dirname(dbPath);
}

function parseDateArg(raw: string, name: string): Date {
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) throw new Error(`Invalid ${name}: ${raw}`);
  return new Date(ts);
}

function windowFromArgs(now = new Date()): { start: Date; end: Date; label: string } {
  const at = argValue("--at", "");
  if (at) {
    const center = parseDateArg(at, "--at");
    const toleranceMs = numberArg("--tolerance-min", 45) * 60_000;
    return {
      start: new Date(center.getTime() - toleranceMs),
      end: new Date(center.getTime() + toleranceMs),
      label: `${formatLocal(center)} +/- ${Math.round(toleranceMs / 60_000)} min`,
    };
  }

  const lookbackMs = numberArg("--lookback-min", 5) * 60_000;
  const windowMs = numberArg("--window-min", 90) * 60_000;
  return {
    start: new Date(now.getTime() - lookbackMs),
    end: new Date(now.getTime() + windowMs),
    label: `next ${Math.round(windowMs / 60_000)} min`,
  };
}

function formatLocal(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function statusFrom(blocks: string[], warnings: string[]): AgentValidationStatus {
  if (blocks.length > 0) return "block";
  if (warnings.length > 0) return "warn";
  return "pass";
}

function worstStatus(statuses: AgentValidationStatus[]): AgentValidationStatus {
  if (statuses.includes("block")) return "block";
  if (statuses.includes("warn")) return "warn";
  return "pass";
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function jsonObject(raw: string | null | undefined): Record<string, unknown> {
  const parsed = parseJson<unknown>(raw, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

function hashtagValue(raw: string | null | undefined): string[] | string | null {
  const parsed = parseJson<unknown>(raw, []);
  if (Array.isArray(parsed)) return parsed.filter((tag): tag is string => typeof tag === "string");
  if (typeof parsed === "string") return parsed;
  return [];
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8")) as T;
  } catch {
    return null;
  }
}

async function sqliteJson<T>(dbPath: string, sql: string): Promise<T[]> {
  const { stdout } = await execFileAsync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const trimmed = String(stdout).trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed) as T[];
}

function scheduledQuery(): string {
  return `
SELECT
  j.id AS job_id,
  j.scheduled_for,
  j.timezone,
  j.status AS job_status,
  j.run_after,
  j.attempts,
  j.max_attempts,
  t.id AS target_id,
  t.platform,
  t.status AS target_status,
  t.caption_override,
  t.title_override,
  t.hashtags,
  t.privacy,
  t.options,
  p.id AS post_id,
  p.master_caption,
  p.link,
  p.cta,
  m.storage_key,
  m.filename,
  m.mime_type,
  m.duration_sec,
  m.aspect_ratio,
  m.thumbnail_key
FROM scheduled_jobs j
JOIN post_platform_targets t ON t.id = j.post_platform_target_id
JOIN posts p ON p.id = t.post_id
LEFT JOIN post_media pm ON pm.post_id = p.id AND pm.position = 0
LEFT JOIN media_assets m ON m.id = COALESCE(pm.media_asset_id, p.media_asset_id)
WHERE j.status != 'canceled'
ORDER BY j.scheduled_for
LIMIT 500;
`;
}

function rowToCard(row: ScheduledRow): AgentCardForPacket {
  const media: MediaItem[] = row.storage_key
    ? [
        {
          file: `media/${row.storage_key}`,
          filename: row.filename,
          mime: row.mime_type ?? "application/octet-stream",
          duration_sec: row.duration_sec,
          aspect_ratio: row.aspect_ratio,
          thumbnail: row.thumbnail_key ? `media/${row.thumbnail_key}` : null,
        },
      ]
    : [];

  return {
    job_id: row.job_id,
    target_id: row.target_id,
    post_id: row.post_id,
    platform: row.platform,
    scheduled_for: row.scheduled_for,
    timezone: row.timezone,
    caption: row.caption_override ?? row.master_caption,
    title: row.title_override,
    hashtags: hashtagValue(row.hashtags),
    privacy: row.privacy,
    link: row.link,
    cta: row.cta,
    media,
    options: jsonObject(row.options),
  };
}

function inWindow(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) && ts >= start.getTime() && ts <= end.getTime();
}

function scheduledMediaPath(row: ScheduledRow, appRoot: string): string | null {
  return row.storage_key ? path.join(appRoot, "media", row.storage_key) : null;
}

function dueMediaPath(jobDir: string, item: MediaItem): string {
  return path.isAbsolute(item.file) ? item.file : path.join(jobDir, item.file);
}

function applyExtraChecks(validation: { blocks: string[]; warnings: string[] }, warnings: string[], blocks: string[]): AgentValidationStatus {
  blocks.push(...validation.blocks);
  warnings.push(...validation.warnings);
  return statusFrom(blocks, warnings);
}

async function scheduledItems(dbPath: string, start: Date, end: Date): Promise<ReportItem[]> {
  if (!existsSync(dbPath)) return [];
  const appRoot = appRootFromDb(dbPath);
  const rows = await sqliteJson<ScheduledRow>(dbPath, scheduledQuery());
  return rows
    .filter((row) => inWindow(row.scheduled_for, start, end))
    .map((row) => {
      const card = rowToCard(row);
      const packet = agentPacketForCard(card);
      const mediaPath = scheduledMediaPath(row, appRoot);
      const validation = agentValidationForCard(card, {
        mediaExists: () => (mediaPath ? existsSync(mediaPath) : undefined),
      });
      const warnings: string[] = [];
      const blocks: string[] = [];
      if (row.job_status === "done" || row.target_status === "published") {
        warnings.push(`Schedule is already ${row.job_status}; target is ${row.target_status}.`);
      }
      if (row.job_status === "failed" || row.target_status === "failed") {
        blocks.push(`Schedule status is ${row.job_status}; target status is ${row.target_status}.`);
      }
      const status = applyExtraChecks(validation, warnings, blocks);
      return {
        source: "scheduled",
        status,
        job_id: row.job_id,
        target_id: row.target_id,
        platform: row.platform,
        scheduled_for: row.scheduled_for,
        local_time: formatLocal(new Date(row.scheduled_for)),
        job_status: row.job_status,
        target_status: row.target_status,
        post_type: packet.post_type ?? postType(card),
        publish_surface: packet.publish_surface ?? publishSurface(card),
        platform_url: packet.platform_url ?? platformUrl(card),
        title: typeof packet.content?.title === "string" ? packet.content.title : null,
        media_path: mediaPath,
        blocks,
        warnings,
      } satisfies ReportItem;
    });
}

async function dueItems(outboxDir: string, start: Date, end: Date): Promise<ReportItem[]> {
  const dueDir = path.join(outboxDir, "due");
  if (!existsSync(dueDir)) return [];
  const entries = await fs.readdir(dueDir, { withFileTypes: true });
  const items: ReportItem[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const jobDir = path.join(dueDir, entry.name);
    const cardPath = path.join(jobDir, "card.json");
    const packetPath = path.join(jobDir, "agent.json");
    const card = await readJson<AgentCardForPacket>(cardPath);
    const packet = await readJson<AgentPacket>(packetPath);
    if (!card) {
      items.push({
        source: "due",
        status: "block",
        job_id: entry.name,
        card_path: cardPath,
        packet_path: packetPath,
        blocks: ["Due handoff is missing a readable card.json."],
        warnings: [],
      });
      continue;
    }

    const cardWithPacket: AgentCardForPacket = {
      ...card,
      agent: card.agent ?? packet ?? null,
    };
    const validation = agentValidationForCard(cardWithPacket, {
      mediaExists: (item) => existsSync(dueMediaPath(jobDir, item)),
    });
    const warnings: string[] = [];
    const blocks: string[] = [];
    if (!packet) warnings.push("agent.json is missing; run npm run agent:packets to refresh the due handoff.");
    if (packet && !packet.platform) warnings.push("agent.json is missing platform; run npm run agent:packets to refresh old packets.");
    if (!card.agent) warnings.push("card.json does not embed card.agent; run npm run agent:packets for the UI/agent queue.");
    if (card.scheduled_for && !inWindow(card.scheduled_for, start, end)) {
      warnings.push("Due handoff is outside this selected window; a plain runner processes older due cards first. Use the filtered command below for this window.");
    }
    const status = applyExtraChecks(validation, warnings, blocks);
    const packetForDisplay = packet ?? agentPacketForCard(cardWithPacket, jobDir);
    const primaryMedia = (card.media ?? [])[0];
    items.push({
      source: "due",
      status,
      job_id: card.job_id,
      target_id: card.target_id ?? null,
      platform: card.platform,
      scheduled_for: card.scheduled_for ?? null,
      local_time: card.scheduled_for ? formatLocal(new Date(card.scheduled_for)) : null,
      post_type: packetForDisplay.post_type ?? postType(cardWithPacket),
      publish_surface: packetForDisplay.publish_surface ?? publishSurface(cardWithPacket),
      platform_url: packetForDisplay.platform_url ?? platformUrl(cardWithPacket),
      title: typeof packetForDisplay.content?.title === "string" ? packetForDisplay.content.title : null,
      media_path: primaryMedia ? dueMediaPath(jobDir, primaryMedia) : null,
      card_path: cardPath,
      packet_path: packetPath,
      blocks,
      warnings,
    });
  }

  return items.sort((a, b) => (a.scheduled_for ?? "").localeCompare(b.scheduled_for ?? ""));
}

async function heartbeat(outboxDir: string, staleSeconds: number): Promise<PreflightReport["heartbeat"]> {
  const hbPath = path.join(outboxDir, "agent-heartbeat.json");
  const hb = await readJson<{ last_seen_at?: string; message?: string | null }>(hbPath);
  if (!hb?.last_seen_at) {
    return {
      path: hbPath,
      present: false,
      fresh: false,
      age_seconds: null,
      message: null,
    };
  }
  const ageSeconds = Math.round((Date.now() - Date.parse(hb.last_seen_at)) / 1000);
  return {
    path: hbPath,
    present: true,
    fresh: Number.isFinite(ageSeconds) && ageSeconds <= staleSeconds,
    age_seconds: Number.isFinite(ageSeconds) ? ageSeconds : null,
    message: hb.message ?? null,
  };
}

function withHeartbeatWarnings(report: PreflightReport): PreflightReport {
  const activeCount =
    report.due.length +
    report.scheduled.filter((item) => item.job_status !== "done" && item.target_status !== "published").length;
  if (activeCount === 0 || report.heartbeat.fresh) return report;

  const warning = report.heartbeat.present
    ? `Browser agent heartbeat is stale (${report.heartbeat.age_seconds}s old). Start npm run agent:chrome and npm run agent:loop:live before the due time.`
    : "No browser agent heartbeat found. Start npm run agent:chrome and npm run agent:loop:live before the due time.";
  const scheduled = report.scheduled.map((item) => ({ ...item, warnings: [...item.warnings, warning], status: statusFrom(item.blocks, [...item.warnings, warning]) }));
  const due = report.due.map((item) => ({ ...item, warnings: [...item.warnings, warning], status: statusFrom(item.blocks, [...item.warnings, warning]) }));
  return {
    ...report,
    scheduled,
    due,
    status: worstStatus([...scheduled, ...due].map((item) => item.status)),
  };
}

function statusLabel(status: AgentValidationStatus): string {
  return status.toUpperCase().padEnd(5, " ");
}

function printItem(item: ReportItem): void {
  const when = item.local_time ? ` ${item.local_time}` : "";
  const target = item.platform ? ` ${item.platform}` : "";
  const shape = [item.post_type, item.publish_surface].filter(Boolean).join(" / ");
  console.log(`${statusLabel(item.status)}${when}${target} ${shape} ${item.job_id}`.trimEnd());
  if (item.title) console.log(`      title: ${item.title}`);
  if (item.media_path) console.log(`      media: ${item.media_path}`);
  if (item.platform_url) console.log(`      url: ${item.platform_url}`);
  for (const block of item.blocks) console.log(`      BLOCK: ${block}`);
  for (const warning of item.warnings) console.log(`      WARN: ${warning}`);
}

function printReport(report: PreflightReport): void {
  console.log("Omni Release agent preflight");
  console.log(`Window: ${report.window.label}`);
  console.log(`Range: ${formatLocal(new Date(report.window.start))} -> ${formatLocal(new Date(report.window.end))}`);
  console.log(`DB: ${report.db_path}`);
  console.log(`Outbox: ${report.outbox_dir}`);
  console.log(
    `Heartbeat: ${report.heartbeat.fresh ? "fresh" : report.heartbeat.present ? "stale" : "missing"}${
      report.heartbeat.age_seconds == null ? "" : ` (${report.heartbeat.age_seconds}s)`
    }`,
  );
  console.log(`Overall: ${report.status.toUpperCase()}`);

  console.log("");
  console.log(`Scheduled window (${report.scheduled.length})`);
  if (report.scheduled.length === 0) console.log("  none");
  for (const item of report.scheduled) printItem(item);

  console.log("");
  console.log(`Due handoffs (${report.due.length})`);
  if (report.due.length === 0) console.log("  none");
  for (const item of report.due) printItem(item);

  console.log("");
  console.log("Useful commands");
  console.log("  npm run agent:packets");
  console.log("  npm run agent:chrome");
  console.log(`  npm run agent:tabs -- --scheduled-after=${report.window.start} --scheduled-before=${report.window.end}`);
  console.log(`  npm run agent:loop:live -- --scheduled-after=${report.window.start} --scheduled-before=${report.window.end}`);
  console.log("  npm run agent:loop:live");
}

async function main(): Promise<void> {
  const dbPath = path.resolve(argValue("--db", process.env.OMNI_DB_PATH ?? defaultDbPath()));
  const outboxDir = path.resolve(argValue("--outbox", path.join(process.cwd(), "outbox")));
  const staleSeconds = numberArg("--heartbeat-stale-sec", 90);
  const window = windowFromArgs();
  const scheduled = await scheduledItems(dbPath, window.start, window.end);
  const due = await dueItems(outboxDir, window.start, window.end);
  const hb = await heartbeat(outboxDir, staleSeconds);
  const report = withHeartbeatWarnings({
    generated_at: new Date().toISOString(),
    window: {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      label: window.label,
    },
    db_path: dbPath,
    outbox_dir: outboxDir,
    heartbeat: hb,
    scheduled,
    due,
    status: worstStatus([...scheduled, ...due].map((item) => item.status)),
  });

  if (hasArg("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  process.exitCode = report.status === "block" ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
