import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { platformUrl, publishSurface, type AgentPacket, type MediaItem } from "./agentPacket.js";

const run = promisify(execFile);

interface AgentCard {
  job_id: string;
  platform: string;
  scheduled_for?: string;
  media?: MediaItem[];
  options?: Record<string, unknown>;
  agent?: AgentPacket | null;
}

interface TabFilters {
  jobIds: string[];
  scheduledAfterMs: number | null;
  scheduledBeforeMs: number | null;
}

function argValue(name: string, fallback: string): string {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function listArg(name: string, fallback = ""): string[] {
  return argValue(name, fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function dateArg(name: string): number | null {
  const raw = argValue(name, "");
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${name}: ${raw}`);
  return parsed;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function isDue(card: AgentCard): boolean {
  if (!card.scheduled_for) return true;
  const due = Date.parse(card.scheduled_for);
  return !Number.isFinite(due) || due <= Date.now();
}

function scheduledTime(card: AgentCard): number | null {
  if (!card.scheduled_for) return null;
  const due = Date.parse(card.scheduled_for);
  return Number.isFinite(due) ? due : null;
}

function matchesFilters(card: AgentCard, filters: TabFilters): boolean {
  if (filters.jobIds.length > 0 && !filters.jobIds.includes(card.job_id)) return false;
  const ts = scheduledTime(card);
  if (filters.scheduledAfterMs !== null && (ts === null || ts < filters.scheduledAfterMs)) return false;
  if (filters.scheduledBeforeMs !== null && (ts === null || ts > filters.scheduledBeforeMs)) return false;
  return true;
}

async function listDueCards(outboxDir: string, filters: TabFilters): Promise<Array<{ dir: string; card: AgentCard }>> {
  const dueDir = path.join(outboxDir, "due");
  if (!(await pathExists(dueDir))) return [];
  const entries = await fs.readdir(dueDir, { withFileTypes: true });
  const cards: Array<{ dir: string; card: AgentCard }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(dueDir, entry.name);
    const card = await readJson<AgentCard>(path.join(dir, "card.json"));
    if (card && isDue(card) && matchesFilters(card, filters)) cards.push({ dir, card });
  }
  return cards;
}

async function openChromeUrl(url: string): Promise<void> {
  // Intentionally do not pass --profile-directory here. This opens in the
  // user's active, already-signed-in Chrome session instead of creating a new
  // automation profile that can land on the wrong Google account.
  await run("open", ["-a", "Google Chrome", url]);
}

async function revealMedia(dir: string, card: AgentCard): Promise<void> {
  for (const item of card.media ?? []) {
    const file = path.resolve(dir, item.file);
    if (await pathExists(file)) {
      await run("open", ["-R", file]).catch(() => {});
    }
  }
}

async function main(): Promise<void> {
  const outboxDir = path.resolve(argValue("--outbox", path.join(process.cwd(), "outbox")));
  const filters: TabFilters = {
    jobIds: listArg("--job-id", process.env.OMNI_AGENT_JOB_IDS ?? ""),
    scheduledAfterMs: dateArg("--scheduled-after"),
    scheduledBeforeMs: dateArg("--scheduled-before"),
  };
  const cards = await listDueCards(outboxDir, filters);
  if (cards.length === 0) {
    console.log("[agent-tabs] no due cards");
    return;
  }

  for (const job of cards) {
    const surface = publishSurface(job.card);
    const url = platformUrl(job.card);
    if (!url) {
      console.log(`[agent-tabs] no tab recipe for ${job.card.platform} (${job.card.job_id})`);
      continue;
    }
    console.log(`[agent-tabs] opening ${surface}: ${url}`);
    await openChromeUrl(url);
    await revealMedia(job.dir, job.card);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
