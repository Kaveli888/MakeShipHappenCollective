import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

interface MediaItem {
  file: string;
  mime: string;
}

interface AgentCard {
  job_id: string;
  platform: string;
  scheduled_for?: string;
  media?: MediaItem[];
  options?: Record<string, unknown>;
}

const PLATFORM_URLS: Record<string, string> = {
  youtube_community_post: "https://www.youtube.com/@MakeShipHappenTech/posts",
  youtube_video_upload: "https://studio.youtube.com",
  x: "https://x.com/compose/post",
  linkedin: "https://www.linkedin.com/feed/",
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/upload",
  rumble: "https://rumble.com/upload.php",
};

function argValue(name: string, fallback: string): string {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
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

function surfaceFor(card: AgentCard): string {
  if (card.platform === "youtube") {
    const surface = card.options?.publishSurface;
    if (typeof surface === "string") return surface;
    const mime = card.media?.[0]?.mime ?? "";
    return mime.startsWith("video/") ? "youtube_video_upload" : "youtube_community_post";
  }
  return card.platform;
}

async function listDueCards(outboxDir: string): Promise<Array<{ dir: string; card: AgentCard }>> {
  const dueDir = path.join(outboxDir, "due");
  if (!(await pathExists(dueDir))) return [];
  const entries = await fs.readdir(dueDir, { withFileTypes: true });
  const cards: Array<{ dir: string; card: AgentCard }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(dueDir, entry.name);
    const card = await readJson<AgentCard>(path.join(dir, "card.json"));
    if (card && isDue(card)) cards.push({ dir, card });
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
  const cards = await listDueCards(outboxDir);
  if (cards.length === 0) {
    console.log("[agent-tabs] no due cards");
    return;
  }

  for (const job of cards) {
    const surface = surfaceFor(job.card);
    const url = PLATFORM_URLS[surface];
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
