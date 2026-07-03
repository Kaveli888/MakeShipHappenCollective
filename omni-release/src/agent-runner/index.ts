import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright-core";

type Outcome = "posted" | "failed" | "needs_attention";

interface MediaItem {
  file: string;
  mime: string;
  filename?: string | null;
}

interface AgentCard {
  job_id: string;
  idempotency_key?: string;
  target_id?: string;
  post_id?: string;
  platform: string;
  scheduled_for?: string;
  timezone?: string;
  caption?: string | null;
  title?: string | null;
  media?: MediaItem[];
  options?: Record<string, unknown>;
  instructions?: string | null;
}

interface RunnerConfig {
  outboxDir: string;
  userDataDir: string;
  sourceUserDataDir: string;
  profileDirectory: string;
  profileName: string;
  profileEmail: string;
  allowIsolatedChrome: boolean;
  chromePath: string;
  once: boolean;
  live: boolean;
  pollMs: number;
  retryMs: number;
  humanRetryMs: number;
  debugPort: number;
}

interface JobEntry {
  dir: string;
  cardPath: string;
  card: AgentCard;
}

interface AttemptResult {
  outcome: Outcome;
  externalUrl?: string | null;
  externalPostId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

interface BrowserHandle {
  browser: Browser;
  context: BrowserContext;
  chromeProcess: ChildProcess | null;
}

const DEFAULT_YOUTUBE_POSTS_URL = "https://www.youtube.com/@MakeShipHappenTech/posts";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function repoRoot(): string {
  return process.cwd();
}

function findChromePath(): string {
  if (process.env.OMNI_CHROME_PATH) return process.env.OMNI_CHROME_PATH;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  return candidates[0]!;
}

function chromeUserDataDir(): string {
  return path.join(process.env.HOME ?? "", "Library/Application Support/Google/Chrome");
}

function runnerUserDataDir(): string {
  return path.join(process.env.HOME ?? "", "Library/Application Support/Omni Release/agent-chrome-makeshiphappen");
}

function resolveChromeProfile(userDataDir: string): {
  profileDirectory: string;
  profileName: string;
  profileEmail: string;
} {
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

function loadConfig(): RunnerConfig {
  const root = repoRoot();
  const once = hasArg("--once") || !hasArg("--loop");
  const sourceUserDataDir = path.resolve(
    argValue("--source-chrome-user-data-dir", process.env.OMNI_SOURCE_CHROME_USER_DATA_DIR ?? chromeUserDataDir()),
  );
  const userDataDir = path.resolve(argValue("--chrome-user-data-dir", process.env.OMNI_CHROME_USER_DATA_DIR ?? runnerUserDataDir()));
  const profile = resolveChromeProfile(sourceUserDataDir);
  return {
    outboxDir: path.resolve(argValue("--outbox", path.join(root, "outbox"))),
    userDataDir,
    sourceUserDataDir,
    profileDirectory: profile.profileDirectory,
    profileName: profile.profileName,
    profileEmail: profile.profileEmail,
    allowIsolatedChrome: hasArg("--allow-isolated-chrome") || process.env.OMNI_ALLOW_ISOLATED_CHROME === "1",
    chromePath: argValue("--chrome-path", findChromePath()),
    once,
    live: hasArg("--live"),
    pollMs: numberArg("--poll-ms", 15_000),
    retryMs: numberArg("--retry-ms", 45_000),
    humanRetryMs: numberArg("--human-retry-ms", 30_000),
    debugPort: numberArg("--debug-port", 9222),
  };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDirIfMissing(src: string, dest: string): Promise<void> {
  if (await pathExists(dest)) return;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(src, dest, {
    recursive: true,
    force: false,
    filter: (p) => {
      const name = path.basename(p);
      return ![
        "Cache",
        "Code Cache",
        "GPUCache",
        "GrShaderCache",
        "GraphiteDawnCache",
        "ShaderCache",
        "Crashpad",
        "BrowserMetrics",
        "LOCK",
        "SingletonLock",
        "SingletonSocket",
        "SingletonCookie",
      ].includes(name);
    },
  });
}

async function prepareRunnerProfile(cfg: RunnerConfig): Promise<void> {
  await fs.mkdir(cfg.userDataDir, { recursive: true });
  const sourceLocalState = path.join(cfg.sourceUserDataDir, "Local State");
  const targetLocalState = path.join(cfg.userDataDir, "Local State");
  if (!(await pathExists(targetLocalState))) {
    await fs.copyFile(sourceLocalState, targetLocalState);
  }
  await copyDirIfMissing(
    path.join(cfg.sourceUserDataDir, cfg.profileDirectory),
    path.join(cfg.userDataDir, cfg.profileDirectory),
  );
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function isDue(card: AgentCard, now = Date.now()): boolean {
  if (!card.scheduled_for) return true;
  const ts = Date.parse(card.scheduled_for);
  return !Number.isFinite(ts) || ts <= now;
}

async function listDueJobs(outboxDir: string): Promise<JobEntry[]> {
  const dueDir = path.join(outboxDir, "due");
  if (!(await pathExists(dueDir))) return [];
  const entries = await fs.readdir(dueDir, { withFileTypes: true });
  const jobs: JobEntry[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(dueDir, entry.name);
    const cardPath = path.join(dir, "card.json");
    const card = await readJson<AgentCard>(cardPath);
    if (!card || !card.job_id || !card.platform) continue;
    if (!isDue(card)) continue;
    jobs.push({ dir, cardPath, card });
  }
  jobs.sort((a, b) => (a.card.scheduled_for ?? "").localeCompare(b.card.scheduled_for ?? ""));
  return jobs;
}

async function acquireJobLock(jobDir: string): Promise<(() => Promise<void>) | null> {
  const lockPath = path.join(jobDir, "runner.lock");
  const payload = JSON.stringify({ pid: process.pid, locked_at: new Date().toISOString() }, null, 2);
  try {
    const handle = await fs.open(lockPath, "wx");
    await handle.writeFile(payload);
    await handle.close();
    return async () => {
      await fs.rm(lockPath, { force: true });
    };
  } catch {
    const stat = await fs.stat(lockPath).catch(() => null);
    const ageMs = stat ? Date.now() - stat.mtimeMs : 0;
    if (ageMs > 10 * 60_000) {
      await fs.rm(lockPath, { force: true });
      return acquireJobLock(jobDir);
    }
    return null;
  }
}

async function writeResult(outboxDir: string, card: AgentCard, result: AttemptResult): Promise<void> {
  const doneDir = path.join(outboxDir, "done");
  await fs.mkdir(doneDir, { recursive: true });
  const body = {
    job_id: card.job_id,
    idempotency_key: card.idempotency_key ?? null,
    target_id: card.target_id ?? null,
    platform: card.platform,
    outcome: result.outcome,
    external_url: result.externalUrl ?? null,
    external_post_id: result.externalPostId ?? null,
    posted_at: result.outcome === "posted" ? new Date().toISOString() : null,
    screenshot: `done/${card.job_id}.png`,
    error_code: result.errorCode ?? null,
    error_message: result.errorMessage ?? null,
  };
  const finalPath = path.join(doneDir, `${card.job_id}.result.json`);
  const tmpPath = `${finalPath}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(body, null, 2)}\n`);
  await fs.rename(tmpPath, finalPath);
}

async function maybeWriteAttention(outboxDir: string, jobDir: string, card: AgentCard, result: AttemptResult): Promise<void> {
  const attentionPath = path.join(jobDir, "attention.json");
  const existing = await readJson<{ error_code?: string; error_message?: string }>(attentionPath);
  if (
    existing?.error_code === result.errorCode &&
    existing?.error_message === result.errorMessage &&
    (await pathExists(path.join(outboxDir, "done", `${card.job_id}.result.json`))) === false
  ) {
    return;
  }
  await writeResult(outboxDir, card, result);
}

async function screenshot(page: Page, outboxDir: string, jobId: string): Promise<void> {
  await fs.mkdir(path.join(outboxDir, "done"), { recursive: true });
  await page.screenshot({ path: path.join(outboxDir, "done", `${jobId}.png`), fullPage: true }).catch(() => {});
}

async function firstUsable(candidates: Locator[], timeoutMs = 2_500): Promise<Locator | null> {
  for (const candidate of candidates) {
    try {
      await candidate.first().waitFor({ state: "visible", timeout: timeoutMs });
      return candidate.first();
    } catch {
      // Try the next selector.
    }
  }
  return null;
}

async function clickFirst(candidates: Locator[], timeoutMs = 2_500): Promise<boolean> {
  const loc = await firstUsable(candidates, timeoutMs);
  if (!loc) return false;
  await loc.click({ timeout: timeoutMs });
  return true;
}

async function fillCommunityText(page: Page, text: string): Promise<boolean> {
  const candidates = [
    page.getByPlaceholder(/give a shoutout/i),
    page.getByText(/give a shoutout/i),
    page.locator('[contenteditable="true"]'),
    page.locator("textarea"),
  ];
  const target = await firstUsable(candidates, 4_000);
  if (!target) return false;
  await target.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await page.keyboard.insertText(text);
  return true;
}

async function attachImage(page: Page, filePath: string): Promise<boolean> {
  const imageButtons = [
    page.getByRole("button", { name: /^Image$/i }),
    page.getByText(/^Image$/i),
  ];
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 8_000 }).catch(() => null);
  const clicked = await clickFirst(imageButtons, 4_000);
  if (!clicked) {
    const input = page.locator('input[type="file"]').first();
    if ((await input.count()) > 0) {
      await input.setInputFiles(filePath);
      return true;
    }
    return false;
  }
  const chooser = await chooserPromise;
  if (chooser) {
    await chooser.setFiles(filePath);
    return true;
  }
  const input = page.locator('input[type="file"]').first();
  if ((await input.count()) > 0) {
    await input.setInputFiles(filePath);
    return true;
  }
  return false;
}

function youtubeSurface(card: AgentCard): string {
  const value = card.options?.publishSurface;
  if (typeof value === "string") return value;
  const firstMime = card.media?.[0]?.mime ?? "";
  return firstMime.startsWith("video/") ? "youtube_video_upload" : "youtube_community_post";
}

function resolveMediaPath(jobDir: string, item: MediaItem): string {
  return path.resolve(jobDir, item.file);
}

async function publishYouTubeCommunityPost(page: Page, job: JobEntry, cfg: RunnerConfig): Promise<AttemptResult> {
  const { card, dir } = job;
  const text = (card.caption ?? "").trim();
  const media = card.media ?? [];
  const image = media.find((m) => m.mime.startsWith("image/"));
  const imagePath = image ? resolveMediaPath(dir, image) : null;

  if (!text && !imagePath) {
    return {
      outcome: "needs_attention",
      errorCode: "no_content",
      errorMessage: "YouTube community post needs text or an image.",
    };
  }
  if (imagePath && !(await pathExists(imagePath))) {
    return {
      outcome: "needs_attention",
      errorCode: "missing_media",
      errorMessage: `Missing staged media file: ${imagePath}`,
    };
  }

  await page.goto(DEFAULT_YOUTUBE_POSTS_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});

  if (page.url().includes("accounts.google.com")) {
    return {
      outcome: "needs_attention",
      errorCode: "login_required",
      errorMessage: "YouTube redirected to Google sign-in. Sign in inside the runner browser, then the loop will retry.",
    };
  }

  const signIn = await firstUsable([page.getByRole("link", { name: /sign in/i }), page.getByRole("button", { name: /sign in/i })], 2_000);
  if (signIn) {
    return {
      outcome: "needs_attention",
      errorCode: "login_required",
      errorMessage: "YouTube is showing Sign in. Sign in inside the runner browser, then the loop will retry.",
    };
  }

  const turnOnCommunity = await firstUsable([page.getByRole("button", { name: /turn on my community/i })], 2_000);
  if (turnOnCommunity) {
    // The composer can still exist next to this banner; only pause if we cannot fill the post.
    console.log("[agent-runner] YouTube shows a Community banner; continuing if composer is usable.");
  }

  if (text) {
    const filled = await fillCommunityText(page, text);
    if (!filled) {
      return {
        outcome: "needs_attention",
        errorCode: "composer_not_found",
        errorMessage: "Could not find the YouTube channel post text box. The page layout may have changed.",
      };
    }
  }

  if (imagePath) {
    const attached = await attachImage(page, imagePath);
    if (!attached) {
      return {
        outcome: "needs_attention",
        errorCode: "image_attach_failed",
        errorMessage: "Could not find or use the YouTube Image attachment control.",
      };
    }
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await wait(4_000);
  }

  await screenshot(page, cfg.outboxDir, card.job_id);

  const postButton = await firstUsable(
    [
      page.getByRole("button", { name: /^Post$/i }),
      page.locator('button:has-text("Post")'),
      page.getByText(/^Post$/i),
    ],
    5_000,
  );
  if (!postButton) {
    return {
      outcome: "needs_attention",
      errorCode: "post_button_not_found",
      errorMessage: "Could not find the final YouTube Post button.",
    };
  }

  if (!cfg.live) {
    console.log(`[agent-runner] DRY RUN ready: ${card.job_id} would click Post now.`);
    return {
      outcome: "needs_attention",
      errorCode: "dry_run_ready",
      errorMessage: "Dry run reached the YouTube Post button. Relaunch with --live to publish.",
    };
  }

  const disabled = await postButton.getAttribute("disabled").catch(() => null);
  const ariaDisabled = await postButton.getAttribute("aria-disabled").catch(() => null);
  if (disabled !== null || ariaDisabled === "true") {
    return {
      outcome: "needs_attention",
      errorCode: "post_button_disabled",
      errorMessage: "YouTube Post button is still disabled. Check media upload/text validation in the browser.",
    };
  }

  await postButton.click({ timeout: 10_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await wait(5_000);
  await screenshot(page, cfg.outboxDir, card.job_id);

  return {
    outcome: "posted",
    externalUrl: DEFAULT_YOUTUBE_POSTS_URL,
    externalPostId: card.job_id,
  };
}

async function processJob(page: Page, job: JobEntry, cfg: RunnerConfig): Promise<AttemptResult> {
  if (job.card.platform !== "youtube") {
    return {
      outcome: "needs_attention",
      errorCode: "platform_not_implemented",
      errorMessage: `Browser runner does not have a ${job.card.platform} posting recipe yet.`,
    };
  }

  const surface = youtubeSurface(job.card);
  if (surface === "youtube_community_post") {
    return publishYouTubeCommunityPost(page, job, cfg);
  }

  return {
    outcome: "needs_attention",
    errorCode: "youtube_video_runner_pending",
    errorMessage: "YouTube video upload runner is not wired yet. This card is safe in the queue until that recipe is added.",
  };
}

async function waitForCdp(port: number, timeoutMs = 15_000): Promise<string> {
  const started = Date.now();
  const endpoint = `http://127.0.0.1:${port}`;
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${endpoint}/json/version`);
      if (res.ok) return endpoint;
    } catch {
      // Chrome is still starting.
    }
    await wait(250);
  }
  throw new Error(`Chrome remote debugging did not start on ${endpoint}`);
}

async function launchBrowser(cfg: RunnerConfig): Promise<BrowserHandle> {
  if (!(await pathExists(cfg.chromePath))) {
    throw new Error(`Chrome not found at ${cfg.chromePath}. Set OMNI_CHROME_PATH or pass --chrome-path=/path/to/browser.`);
  }
  if (!cfg.allowIsolatedChrome) {
    throw new Error(
      "The Playwright runner uses an isolated Chrome user-data-dir and is disabled by default so it cannot open a blank or wrong Google account. " +
        "Run `npm run agent:tabs` to open due cards in your active signed-in Chrome profile, or set OMNI_ALLOW_ISOLATED_CHROME=1 after signing into the isolated runner profile.",
    );
  }
  await prepareRunnerProfile(cfg);
  if (!(await pathExists(path.join(cfg.userDataDir, cfg.profileDirectory)))) {
    throw new Error(
      `Chrome profile not found: ${path.join(cfg.userDataDir, cfg.profileDirectory)}. ` +
        "Pass --chrome-profile-email, --chrome-profile-name, or --chrome-profile-directory.",
    );
  }
  const args = [
    `--remote-debugging-port=${cfg.debugPort}`,
    `--user-data-dir=${cfg.userDataDir}`,
    `--profile-directory=${cfg.profileDirectory}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled",
    "about:blank",
  ];
  const chromeProcess = spawn(cfg.chromePath, args, {
    stdio: "ignore",
    detached: false,
  });
  chromeProcess.once("exit", (code) => {
    if (code !== null && code !== 0) {
      console.log(`[agent-runner] Chrome exited with code ${code}`);
    }
  });

  try {
    const endpoint = await waitForCdp(cfg.debugPort);
    const browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    if (!context) throw new Error("Chrome started but exposed no browser context.");
    return { browser, context, chromeProcess };
  } catch (err) {
    chromeProcess.kill("SIGTERM");
    const message = err instanceof Error ? err.message : String(err);
    if (/remote debugging did not start/i.test(message)) {
      throw new Error(
        `Could not attach to Chrome profile ${cfg.profileName} (${cfg.profileEmail || cfg.profileDirectory}). ` +
          "Make sure normal Chrome is fully quit, then start the runner again.",
      );
    }
    throw err;
  }
}

function isBrowserClosedError(message: string): boolean {
  return /target (page|context|browser).*closed|browser has been closed|page has been closed/i.test(message);
}

async function firstOpenPage(context: BrowserContext): Promise<Page> {
  const existing = context.pages().find((p) => !p.isClosed());
  return existing ?? context.newPage();
}

async function closeBrowser(handle: BrowserHandle | null): Promise<void> {
  if (!handle) return;
  await handle.browser.close().catch(() => {});
  if (handle.chromeProcess && !handle.chromeProcess.killed) {
    handle.chromeProcess.kill("SIGTERM");
  }
}

async function runPass(page: Page, cfg: RunnerConfig, nextAttemptAt: Map<string, number>): Promise<number> {
  const jobs = await listDueJobs(cfg.outboxDir);
  let handled = 0;
  const now = Date.now();

  for (const job of jobs) {
    const retryAt = nextAttemptAt.get(job.card.job_id) ?? 0;
    if (retryAt > now) continue;

    const release = await acquireJobLock(job.dir);
    if (!release) continue;

    try {
      console.log(`[agent-runner] attempting ${job.card.platform} ${job.card.job_id}`);
      const result = await processJob(page, job, cfg);

      if (!cfg.live) {
        nextAttemptAt.set(job.card.job_id, Date.now() + cfg.retryMs);
        console.log(
          `[agent-runner] dry-run result ${job.card.job_id}: ${result.outcome} ${result.errorCode ?? ""} ${result.errorMessage ?? ""}`.trim(),
        );
        handled++;
        continue;
      }

      if (result.outcome === "posted") {
        await writeResult(cfg.outboxDir, job.card, result);
        nextAttemptAt.delete(job.card.job_id);
        console.log(`[agent-runner] posted ${job.card.job_id}`);
      } else if (result.outcome === "needs_attention") {
        await maybeWriteAttention(cfg.outboxDir, job.dir, job.card, result);
        nextAttemptAt.set(job.card.job_id, Date.now() + cfg.humanRetryMs);
        console.log(`[agent-runner] needs human ${job.card.job_id}: ${result.errorCode} - ${result.errorMessage}`);
      } else {
        await writeResult(cfg.outboxDir, job.card, result);
        nextAttemptAt.delete(job.card.job_id);
        console.log(`[agent-runner] failed ${job.card.job_id}: ${result.errorMessage}`);
      }

      handled++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isBrowserClosedError(message)) {
        throw err;
      }
      const result: AttemptResult = {
        outcome: "needs_attention",
        errorCode: "runner_error",
        errorMessage: message,
      };
      await maybeWriteAttention(cfg.outboxDir, job.dir, job.card, result);
      nextAttemptAt.set(job.card.job_id, Date.now() + cfg.retryMs);
      console.error(`[agent-runner] runner_error ${job.card.job_id}: ${message}`);
      handled++;
    } finally {
      await release();
    }
  }

  return handled;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  console.log(`[agent-runner] outbox: ${cfg.outboxDir}`);
  console.log(`[agent-runner] chrome profile: ${cfg.profileName} (${cfg.profileEmail || cfg.profileDirectory}) -> ${cfg.profileDirectory}`);
  console.log(`[agent-runner] runner profile dir: ${cfg.userDataDir}`);
  console.log(`[agent-runner] isolated Chrome enabled: ${cfg.allowIsolatedChrome ? "yes" : "no - use npm run agent:tabs for active Chrome"}`);
  console.log(`[agent-runner] mode: ${cfg.live ? "LIVE - will click final Post buttons" : "DRY RUN - will stop before final Post"}`);

  let browser: BrowserHandle | null = null;
  let page: Page | null = null;
  const nextAttemptAt = new Map<string, number>();

  async function ensurePage(): Promise<Page> {
    if (!browser || !page || page.isClosed()) {
      await closeBrowser(browser);
      browser = await launchBrowser(cfg);
      page = await firstOpenPage(browser.context);
    }
    return page;
  }

  try {
    do {
      let handled = 0;
      try {
        handled = await runPass(await ensurePage(), cfg, nextAttemptAt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!isBrowserClosedError(message)) throw err;
        console.log("[agent-runner] browser closed; reopening runner Chrome on the next pass.");
        await closeBrowser(browser);
        browser = null;
        page = null;
      }
      if (cfg.once) {
        console.log(`[agent-runner] once pass complete (${handled} handled).`);
        return;
      }
      await wait(cfg.pollMs);
    } while (true);
  } finally {
    if (cfg.once) await closeBrowser(browser);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
