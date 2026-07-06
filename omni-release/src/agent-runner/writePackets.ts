import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { agentPacketForCard, type AgentCardForPacket } from "./agentPacket.js";

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

async function writeJsonAtomic(file: string, payload: unknown): Promise<void> {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tmp, file);
}

async function main(): Promise<void> {
  const outboxDir = path.resolve(argValue("--outbox", path.join(process.cwd(), "outbox")));
  const dueDir = path.join(outboxDir, "due");
  if (!(await pathExists(dueDir))) {
    console.log("[agent-packets] no due directory");
    return;
  }

  const entries = await fs.readdir(dueDir, { withFileTypes: true });
  let written = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(dueDir, entry.name);
    const cardPath = path.join(dir, "card.json");
    const card = await readJson<AgentCardForPacket>(cardPath);
    if (!card?.job_id || !card.platform) {
      skipped++;
      continue;
    }

    const packet = agentPacketForCard(card, dir);
    await writeJsonAtomic(path.join(dir, "agent.json"), packet);
    await writeJsonAtomic(cardPath, { ...card, agent: packet });
    written++;
  }

  console.log(`[agent-packets] wrote ${written} packet${written === 1 ? "" : "s"} (${skipped} skipped)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
