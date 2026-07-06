import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

interface ChromeProfile {
  profileDirectory: string;
  profileName: string;
  profileEmail: string;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function argValue(name: string, fallback: string): string {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function numberArg(name: string, fallback: number): number {
  const raw = argValue(name, String(fallback));
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function chromeUserDataDir(): string {
  return path.join(process.env.HOME ?? "", "Library/Application Support/Google/Chrome");
}

function resolveChromeProfile(userDataDir: string): ChromeProfile {
  const wantedEmail = argValue("--chrome-profile-email", process.env.OMNI_CHROME_PROFILE_EMAIL ?? "makeshiphappentech@gmail.com");
  const wantedName = argValue("--chrome-profile-name", process.env.OMNI_CHROME_PROFILE_NAME ?? "Jacob");
  const explicitDir = argValue("--chrome-profile-directory", process.env.OMNI_CHROME_PROFILE_DIRECTORY ?? "");
  const localStatePath = path.join(userDataDir, "Local State");

  try {
    const localState = JSON.parse(readFileSync(localStatePath, "utf8")) as {
      profile?: { info_cache?: Record<string, { name?: string; user_name?: string; gaia_name?: string }> };
    };
    const cache = localState.profile?.info_cache ?? {};
    if (explicitDir && cache[explicitDir]) {
      const info = cache[explicitDir]!;
      return {
        profileDirectory: explicitDir,
        profileName: info.name ?? explicitDir,
        profileEmail: info.user_name ?? "",
      };
    }
    for (const [dir, info] of Object.entries(cache)) {
      if (info.user_name?.toLowerCase() === wantedEmail.toLowerCase()) {
        return {
          profileDirectory: dir,
          profileName: info.name ?? dir,
          profileEmail: info.user_name ?? "",
        };
      }
    }
    for (const [dir, info] of Object.entries(cache)) {
      if (info.name === wantedName) {
        return {
          profileDirectory: dir,
          profileName: info.name ?? dir,
          profileEmail: info.user_name ?? "",
        };
      }
    }
  } catch {
    // Fall through to explicit/default below.
  }

  return {
    profileDirectory: explicitDir || "Profile 16",
    profileName: wantedName,
    profileEmail: wantedEmail,
  };
}

async function cdpAlive(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForCdp(port: number, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await cdpAlive(port)) return true;
    await wait(250);
  }
  return false;
}

async function main(): Promise<void> {
  const port = numberArg("--debug-port", Number(process.env.OMNI_CHROME_DEBUG_PORT ?? 9222));
  const userDataDir = path.resolve(argValue("--source-chrome-user-data-dir", process.env.OMNI_SOURCE_CHROME_USER_DATA_DIR ?? chromeUserDataDir()));
  const profile = resolveChromeProfile(userDataDir);
  const url = argValue("--url", "about:blank");

  if (await cdpAlive(port)) {
    console.log(`[agent-chrome] active Chrome is already attachable on http://127.0.0.1:${port}`);
    console.log(`[agent-chrome] expected profile: ${profile.profileName} (${profile.profileEmail || profile.profileDirectory})`);
    return;
  }

  console.log(`[agent-chrome] opening Google Chrome profile ${profile.profileName} (${profile.profileEmail || profile.profileDirectory})`);
  console.log(`[agent-chrome] remote debugging: http://127.0.0.1:${port}`);
  spawn(
    "open",
    [
      "-a",
      "Google Chrome",
      "--args",
      `--remote-debugging-port=${port}`,
      `--profile-directory=${profile.profileDirectory}`,
      "--no-first-run",
      "--no-default-browser-check",
      url,
    ],
    { detached: true, stdio: "ignore" },
  ).unref();

  if (await waitForCdp(port, 10_000)) {
    console.log("[agent-chrome] ready. Leave this Chrome window open, then run npm run agent:loop:live.");
    return;
  }

  throw new Error(
    "Chrome did not expose the debugging port. If Chrome was already open, quit Chrome completely, run `npm run agent:chrome`, then leave that Chrome window open.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
