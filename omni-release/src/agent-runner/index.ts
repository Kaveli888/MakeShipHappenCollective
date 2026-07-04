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
  hashtags?: string[] | string | null;
  privacy?: string | null;
  link?: string | null;
  cta?: string | null;
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
  heartbeatMs: number;
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
const DEFAULT_YOUTUBE_STUDIO_URL = "https://studio.youtube.com";
const FACEBOOK_PAGE_URL = "https://www.facebook.com/profile.php?id=61589607458265";
const INSTAGRAM_HOME_URL = "https://www.instagram.com/";
const LINKEDIN_FEED_URL = "https://www.linkedin.com/feed/";
const RUMBLE_UPLOAD_URL = "https://rumble.com/upload.php";
const TIKTOK_UPLOAD_URL = "https://www.tiktok.com/upload";
const X_HOME_URL = "https://x.com/home";

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
    heartbeatMs: numberArg("--heartbeat-ms", 15_000),
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

async function writeHeartbeat(
  cfg: RunnerConfig,
  extra: Partial<{
    status: string;
    currentJobId: string | null;
    currentPlatform: string | null;
    message: string | null;
  }> = {},
): Promise<void> {
  const heartbeatPath = path.join(cfg.outboxDir, "agent-heartbeat.json");
  const payload = {
    pid: process.pid,
    status: extra.status ?? "running",
    mode: cfg.live ? "live" : "dry",
    loop: !cfg.once,
    current_job_id: extra.currentJobId ?? null,
    current_platform: extra.currentPlatform ?? null,
    message: extra.message ?? null,
    last_seen_at: new Date().toISOString(),
  };
  await fs.mkdir(cfg.outboxDir, { recursive: true });
  await fs.writeFile(`${heartbeatPath}.tmp`, `${JSON.stringify(payload, null, 2)}\n`);
  await fs.rename(`${heartbeatPath}.tmp`, heartbeatPath);
}

async function waitWithHeartbeat(
  cfg: RunnerConfig,
  ms: number,
  extra: Parameters<typeof writeHeartbeat>[1] = {},
): Promise<void> {
  const end = Date.now() + ms;
  do {
    await writeHeartbeat(cfg, extra).catch(() => {});
    await wait(Math.min(cfg.heartbeatMs, Math.max(250, end - Date.now())));
  } while (Date.now() < end);
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

function normalizeText(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function hashtagText(card: AgentCard): string {
  const raw = card.hashtags;
  if (Array.isArray(raw)) return raw.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
  if (typeof raw === "string") return raw.trim();
  return "";
}

function postText(card: AgentCard): string {
  const tags = hashtagText(card);
  const caption = card.caption ?? "";
  return caption.includes(tags) ? caption.trim() : normalizeText([caption, tags]);
}

function titleText(card: AgentCard): string {
  const explicit = (card.title ?? "").trim();
  if (explicit) return explicit;
  const firstLine = (card.caption ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return (firstLine ?? card.media?.[0]?.filename ?? card.job_id).slice(0, 95);
}

function mediaPath(job: JobEntry, predicate: (item: MediaItem) => boolean): string | null {
  const item = job.card.media?.find(predicate);
  return item ? resolveMediaPath(job.dir, item) : null;
}

async function ensureExistingMedia(pathname: string | null, code: string): Promise<AttemptResult | null> {
  if (!pathname) {
    return {
      outcome: "needs_attention",
      errorCode: code,
      errorMessage: "This platform card needs staged media, but no matching file is attached.",
    };
  }
  if (!(await pathExists(pathname))) {
    return {
      outcome: "needs_attention",
      errorCode: code,
      errorMessage: `Missing staged media file: ${pathname}`,
    };
  }
  return null;
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

async function fillTextTarget(page: Page, candidates: Locator[], text: string, timeoutMs = 4_000): Promise<boolean> {
  const target = await firstUsable(candidates, timeoutMs);
  if (!target) return false;
  await target.click({ timeout: timeoutMs });
  await target.fill(text, { timeout: timeoutMs }).catch(async () => {
    await target.click({ timeout: timeoutMs });
    await target.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
    await target.press("Backspace").catch(() => {});
    await page.keyboard.insertText(text);
  });
  return true;
}

async function clickFirst(candidates: Locator[], timeoutMs = 2_500): Promise<boolean> {
  const loc = await firstUsable(candidates, timeoutMs);
  if (!loc) return false;
  await loc.click({ timeout: timeoutMs });
  return true;
}

async function attachFile(page: Page, clickTargets: Locator[], filePath: string, timeoutMs = 8_000): Promise<boolean> {
  const inputs = page.locator('input[type="file"]');
  if ((await inputs.count()) > 0) {
    await inputs.first().setInputFiles(filePath);
    return true;
  }

  for (const target of clickTargets) {
    try {
      await target.first().waitFor({ state: "visible", timeout: timeoutMs });
      const chooserPromise = page.waitForEvent("filechooser", { timeout: timeoutMs }).catch(() => null);
      await target.first().click({ timeout: timeoutMs });
      const chooser = await chooserPromise;
      if (chooser) {
        await chooser.setFiles(filePath);
        return true;
      }
      if ((await inputs.count()) > 0) {
        await inputs.first().setInputFiles(filePath);
        return true;
      }
    } catch {
      // Try the next upload control.
    }
  }

  return false;
}

async function enabledButton(candidates: Locator[], timeoutMs = 5_000): Promise<Locator | null> {
  const loc = await firstUsable(candidates, timeoutMs);
  if (!loc) return null;
  const disabled = await loc.getAttribute("disabled").catch(() => null);
  const ariaDisabled = await loc.getAttribute("aria-disabled").catch(() => null);
  return disabled === null && ariaDisabled !== "true" ? loc : null;
}

async function pageShowsAny(page: Page, patterns: RegExp[], timeoutMs = 1_000): Promise<boolean> {
  for (const pattern of patterns) {
    const found = await firstUsable([page.getByText(pattern)], timeoutMs);
    if (found) return true;
  }
  return false;
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

function needsAttention(errorCode: string, errorMessage: string): AttemptResult {
  return { outcome: "needs_attention", errorCode, errorMessage };
}

function dryRunReady(platform: string): AttemptResult {
  return needsAttention("dry_run_ready", `Dry run reached the final ${platform} publish step. Relaunch with --live to publish.`);
}

async function postClickOrDryRun(button: Locator, cfg: RunnerConfig, platform: string): Promise<AttemptResult | null> {
  if (!cfg.live) return dryRunReady(platform);
  await button.click({ timeout: 10_000 });
  return null;
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

async function publishXPost(page: Page, job: JobEntry, cfg: RunnerConfig): Promise<AttemptResult> {
  const text = postText(job.card);
  const media = mediaPath(job, (item) => item.mime.startsWith("image/") || item.mime.startsWith("video/"));
  if (!text && !media) return needsAttention("no_content", "X post needs text or media.");
  const missing = await ensureExistingMedia(media, "missing_media");
  if (media && missing) return missing;

  await page.goto(X_HOME_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  if (page.url().includes("/login") || (await pageShowsAny(page, [/sign in to x/i, /^log in$/i]))) {
    return needsAttention("logged_out", "X is showing a login screen. Sign in to @1MakeShipHappen, then retry.");
  }

  if (text) {
    const filled = await fillTextTarget(
      page,
      [
        page.locator('[data-testid="tweetTextarea_0"]'),
        page.getByLabel(/post text/i),
        page.getByRole("textbox", { name: /what.*happening/i }),
        page.locator('[contenteditable="true"]'),
      ],
      text,
      8_000,
    );
    if (!filled) return needsAttention("composer_not_found", "Could not find the X Home composer.");
  }

  if (media) {
    const attached = await attachFile(page, [page.locator('[data-testid="fileInput"]'), page.getByLabel(/media/i)], media);
    if (!attached) return needsAttention("media_attach_failed", "Could not attach media in the X composer.");
    await waitWithHeartbeat(cfg, 8_000, {
      currentJobId: job.card.job_id,
      currentPlatform: "x",
      message: "waiting for X media upload",
    });
    if (await pageShowsAny(page, [/uploading/i, /processing/i], 1_000)) {
      await waitWithHeartbeat(cfg, 20_000, {
        currentJobId: job.card.job_id,
        currentPlatform: "x",
        message: "waiting for X media upload",
      });
    }
  }

  await screenshot(page, cfg.outboxDir, job.card.job_id);
  const postButton = await enabledButton(
    [
      page.locator('[data-testid="tweetButtonInline"]'),
      page.locator('[data-testid="tweetButton"]'),
      page.getByRole("button", { name: /^Post$/i }).last(),
    ],
    6_000,
  );
  if (!postButton) return needsAttention("post_button_disabled", "X Post button was missing or disabled.");
  const dry = await postClickOrDryRun(postButton, cfg, "X");
  if (dry) return dry;

  await waitWithHeartbeat(cfg, 6_000, { currentJobId: job.card.job_id, currentPlatform: "x", message: "confirming X post" });
  await screenshot(page, cfg.outboxDir, job.card.job_id);
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (firstLine && !(await pageShowsAny(page, [new RegExp(firstLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 48), "i")], 3_000))) {
    return needsAttention("success_missing", "Clicked X Post, but the fresh post was not visible in the feed.");
  }
  return { outcome: "posted", externalUrl: "https://x.com/1MakeShipHappen", externalPostId: job.card.job_id };
}

async function publishFacebookPagePost(page: Page, job: JobEntry, cfg: RunnerConfig): Promise<AttemptResult> {
  const text = postText(job.card);
  const media = mediaPath(job, (item) => item.mime.startsWith("image/") || item.mime.startsWith("video/"));
  if (!text && !media) return needsAttention("no_content", "Facebook Page post needs text or media.");
  const missing = await ensureExistingMedia(media, "missing_media");
  if (media && missing) return missing;

  await page.goto(FACEBOOK_PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  if (page.url().includes("/login") || (await pageShowsAny(page, [/log into facebook/i, /^email or phone/i, /^password$/i]))) {
    return needsAttention("logged_out", "Facebook is logged out or blocked at a login screen.");
  }
  if (!(await pageShowsAny(page, [/Make Ship Happen Tech/i], 5_000))) {
    return needsAttention("wrong_identity", "Could not confirm the Make Ship Happen Tech Facebook Page identity.");
  }

  const opened = await clickFirst(
    [
      page.getByText(/what.*on your mind/i),
      page.getByRole("button", { name: /what.*on your mind/i }),
      page.locator('[aria-label*="What"][aria-label*="mind"]'),
    ],
    8_000,
  );
  if (!opened) return needsAttention("composer_not_found", "Could not open the Facebook Page composer.");

  if (text) {
    const filled = await fillTextTarget(
      page,
      [page.getByRole("textbox", { name: /what.*on your mind/i }), page.locator('[contenteditable="true"]')],
      text,
      8_000,
    );
    if (!filled) return needsAttention("composer_not_found", "Could not find the Facebook Create post text box.");
  }

  if (media) {
    const attached = await attachFile(
      page,
      [page.getByText(/photo\/video/i), page.getByRole("button", { name: /photo\/video/i })],
      media,
      10_000,
    );
    if (!attached) return needsAttention("media_attach_failed", "Could not attach media to the Facebook post.");
    await waitWithHeartbeat(cfg, 8_000, {
      currentJobId: job.card.job_id,
      currentPlatform: "facebook",
      message: "waiting for Facebook media preview",
    });
  }

  const nextButton = await enabledButton([page.getByRole("button", { name: /^Next$/i }).last()], 4_000);
  if (nextButton) await nextButton.click({ timeout: 8_000 });
  await screenshot(page, cfg.outboxDir, job.card.job_id);
  const postButton = await enabledButton([page.getByRole("button", { name: /^Post$/i }).last()], 8_000);
  if (!postButton) return needsAttention("post_button_disabled", "Facebook Post button was missing or disabled.");
  const dry = await postClickOrDryRun(postButton, cfg, "Facebook");
  if (dry) return dry;

  await waitWithHeartbeat(cfg, 4_000, { currentJobId: job.card.job_id, currentPlatform: "facebook", message: "handling Facebook post confirmation" });
  const notNow = await firstUsable([page.getByRole("button", { name: /not now/i }), page.getByText(/^Not now$/i)], 3_000);
  if (notNow) await notNow.click({ timeout: 5_000 }).catch(() => {});
  await waitWithHeartbeat(cfg, 6_000, { currentJobId: job.card.job_id, currentPlatform: "facebook", message: "confirming Facebook post" });
  await screenshot(page, cfg.outboxDir, job.card.job_id);
  if (!(await pageShowsAny(page, [/Just now/i, /Make Ship Happen Tech/i], 3_000))) {
    return needsAttention("success_missing", "Clicked Facebook Post, but the fresh Page post was not visible.");
  }
  return { outcome: "posted", externalUrl: FACEBOOK_PAGE_URL, externalPostId: job.card.job_id };
}

async function publishLinkedInPost(page: Page, job: JobEntry, cfg: RunnerConfig): Promise<AttemptResult> {
  const text = postText(job.card);
  const media = mediaPath(job, (item) => item.mime.startsWith("image/") || item.mime.startsWith("video/"));
  if (!text && !media) return needsAttention("no_content", "LinkedIn post needs text or media.");
  const missing = await ensureExistingMedia(media, "missing_media");
  if (media && missing) return missing;

  await page.goto(LINKEDIN_FEED_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  if (page.url().includes("/login") || (await pageShowsAny(page, [/sign in/i, /join linkedin/i]))) {
    return needsAttention("logged_out", "LinkedIn is showing a login screen.");
  }
  if (!(await pageShowsAny(page, [/Jacob Felton/i], 6_000))) {
    return needsAttention("wrong_identity", "Could not confirm the Jacob Felton LinkedIn profile identity.");
  }

  const opened = await clickFirst(
    [page.getByText(/^Start a post$/i), page.getByRole("button", { name: /start a post/i })],
    8_000,
  );
  if (!opened) return needsAttention("composer_not_found", "Could not open the LinkedIn composer.");

  if (text) {
    const filled = await fillTextTarget(
      page,
      [
        page.getByRole("textbox", { name: /share your thoughts/i }),
        page.getByText(/share your thoughts/i),
        page.locator('[contenteditable="true"]'),
      ],
      text,
      8_000,
    );
    if (!filled) return needsAttention("composer_not_found", "Could not find the LinkedIn post text field.");
  }

  if (media) {
    const attached = await attachFile(
      page,
      [
        page.getByRole("button", { name: /add media|photo|video/i }),
        page.getByLabel(/media|photo|video/i),
        page.getByText(/^Photo$/i),
        page.getByText(/^Video$/i),
      ],
      media,
      10_000,
    );
    if (!attached) return needsAttention("media_attach_failed", "Could not attach media to the LinkedIn composer.");
    await waitWithHeartbeat(cfg, 5_000, { currentJobId: job.card.job_id, currentPlatform: "linkedin", message: "waiting for LinkedIn media editor" });
    const next = await enabledButton([page.getByRole("button", { name: /^Next$/i }).last()], 5_000);
    if (next) await next.click({ timeout: 8_000 });
    await waitWithHeartbeat(cfg, 4_000, { currentJobId: job.card.job_id, currentPlatform: "linkedin", message: "waiting for LinkedIn media preview" });
  }

  await screenshot(page, cfg.outboxDir, job.card.job_id);
  const postButton = await enabledButton([page.getByRole("button", { name: /^Post$/i }).last()], 8_000);
  if (!postButton) return needsAttention("post_button_disabled", "LinkedIn Post button was missing or disabled.");
  const dry = await postClickOrDryRun(postButton, cfg, "LinkedIn");
  if (dry) return dry;

  await waitWithHeartbeat(cfg, 12_000, { currentJobId: job.card.job_id, currentPlatform: "linkedin", message: "waiting for LinkedIn upload" });
  if (await pageShowsAny(page, [/Uploading/i, /Processing/i], 1_000)) {
    await waitWithHeartbeat(cfg, 45_000, { currentJobId: job.card.job_id, currentPlatform: "linkedin", message: "waiting for LinkedIn processing" });
  }
  await screenshot(page, cfg.outboxDir, job.card.job_id);
  if (!(await pageShowsAny(page, [/Jacob Felton/i, /\bnow\b/i], 4_000))) {
    return needsAttention("success_missing", "Clicked LinkedIn Post, but the fresh feed post was not visible.");
  }
  return { outcome: "posted", externalUrl: LINKEDIN_FEED_URL, externalPostId: job.card.job_id };
}

async function publishInstagramPost(page: Page, job: JobEntry, cfg: RunnerConfig): Promise<AttemptResult> {
  const text = postText(job.card);
  const media = mediaPath(job, (item) => item.mime.startsWith("image/") || item.mime.startsWith("video/"));
  const missing = await ensureExistingMedia(media, "missing_media");
  if (missing) return missing;

  await page.goto(INSTAGRAM_HOME_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  if (page.url().includes("/accounts/login") || (await pageShowsAny(page, [/log in/i, /sign up/i]))) {
    return needsAttention("logged_out", "Instagram is showing a login screen.");
  }

  const createOpened = await clickFirst(
    [
      page.getByRole("link", { name: /create/i }),
      page.getByRole("button", { name: /create/i }),
      page.getByText(/^Create$/i),
      page.locator('svg[aria-label="New post"]').locator("xpath=ancestor::*[self::a or self::button][1]"),
    ],
    8_000,
  );
  if (!createOpened) return needsAttention("composer_not_found", "Could not open Instagram Create.");

  await clickFirst([page.getByText(/^Post$/i), page.getByRole("button", { name: /^Post$/i })], 4_000).catch(() => false);
  const attached = await attachFile(
    page,
    [page.getByRole("button", { name: /select from computer/i }), page.getByText(/select from computer/i)],
    media!,
    12_000,
  );
  if (!attached) return needsAttention("media_attach_failed", "Could not upload the media file to Instagram.");

  await waitWithHeartbeat(cfg, 4_000, { currentJobId: job.card.job_id, currentPlatform: "instagram", message: "waiting for Instagram crop step" });
  for (let i = 0; i < 2; i += 1) {
    const next = await enabledButton([page.getByRole("button", { name: /^Next$/i }).last(), page.getByText(/^Next$/i).last()], 12_000);
    if (!next) return needsAttention(i === 0 ? "crop_required" : "editor_required", "Instagram Next button was not available in the trained upload flow.");
    await next.click({ timeout: 8_000 });
    await waitWithHeartbeat(cfg, 2_500, { currentJobId: job.card.job_id, currentPlatform: "instagram", message: "advancing Instagram composer" });
  }

  if (text) {
    const filled = await fillTextTarget(
      page,
      [page.getByRole("textbox"), page.locator("textarea"), page.locator('[contenteditable="true"]')],
      text,
      8_000,
    );
    if (!filled) return needsAttention("caption_box_missing", "Could not find the Instagram caption box.");
  }

  await screenshot(page, cfg.outboxDir, job.card.job_id);
  const share = await enabledButton([page.getByRole("button", { name: /^Share$/i }).last(), page.getByText(/^Share$/i).last()], 8_000);
  if (!share) return needsAttention("share_button_disabled", "Instagram Share button was missing or disabled.");
  const dry = await postClickOrDryRun(share, cfg, "Instagram");
  if (dry) return dry;

  await waitWithHeartbeat(cfg, 15_000, { currentJobId: job.card.job_id, currentPlatform: "instagram", message: "waiting for Instagram Post shared" });
  await screenshot(page, cfg.outboxDir, job.card.job_id);
  if (!(await pageShowsAny(page, [/Post shared/i, /Your post has been shared/i], 4_000))) {
    return needsAttention("success_missing", "Instagram did not show the Post shared confirmation.");
  }
  await clickFirst([page.getByRole("button", { name: /^Done$/i }), page.getByText(/^Done$/i)], 2_000).catch(() => false);
  return { outcome: "posted", externalUrl: "https://www.instagram.com/makeshiphappentech2026/", externalPostId: job.card.job_id };
}

async function publishTikTokUpload(page: Page, job: JobEntry, cfg: RunnerConfig): Promise<AttemptResult> {
  const text = postText(job.card);
  const video = mediaPath(job, (item) => item.mime.startsWith("video/"));
  const missing = await ensureExistingMedia(video, "missing_video");
  if (missing) return missing;

  await page.goto(TIKTOK_UPLOAD_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  if (page.url().includes("/login") || (await pageShowsAny(page, [/log in/i, /sign up/i], 2_000))) {
    return needsAttention("logged_out", "TikTok is showing a login screen.");
  }

  const attached = await attachFile(
    page,
    [page.getByRole("button", { name: /select video/i }), page.getByText(/select video/i)],
    video!,
    12_000,
  );
  if (!attached) return needsAttention("video_attach_failed", "Could not attach the TikTok video file.");

  const turnOn = await firstUsable([page.getByRole("button", { name: /turn on/i }), page.getByText(/^Turn on$/i)], 5_000);
  if (turnOn) await turnOn.click({ timeout: 5_000 }).catch(() => {});
  const gotIt = await firstUsable([page.getByRole("button", { name: /got it/i }), page.getByText(/^Got it$/i)], 5_000);
  if (gotIt) await gotIt.click({ timeout: 5_000 }).catch(() => {});

  let uploaded = false;
  for (let i = 0; i < 24; i += 1) {
    if (await pageShowsAny(page, [/Uploaded/i, /100%/i], 1_000)) {
      uploaded = true;
      break;
    }
    await waitWithHeartbeat(cfg, 15_000, { currentJobId: job.card.job_id, currentPlatform: "tiktok", message: "waiting for TikTok upload" });
  }
  if (!uploaded) return needsAttention("upload_stalled", "TikTok upload did not reach 100% / Uploaded.");

  if (text) {
    const filled = await fillTextTarget(
      page,
      [
        page.getByLabel(/description/i),
        page.getByRole("textbox", { name: /description/i }),
        page.locator("textarea").first(),
        page.locator('[contenteditable="true"]').first(),
      ],
      text,
      8_000,
    );
    if (!filled) return needsAttention("description_box_missing", "Could not find the TikTok Description box.");
  }

  for (let i = 0; i < 20; i += 1) {
    if (await pageShowsAny(page, [/No issues found/i, /Checks? complete/i], 1_000)) break;
    if (await pageShowsAny(page, [/issue found/i, /violation/i, /muted/i], 1_000)) {
      return needsAttention("content_check_failed", "TikTok reported an issue during music/content checks.");
    }
    await waitWithHeartbeat(cfg, 10_000, { currentJobId: job.card.job_id, currentPlatform: "tiktok", message: "waiting for TikTok checks" });
  }

  await screenshot(page, cfg.outboxDir, job.card.job_id);
  const postButton = await enabledButton([page.getByRole("button", { name: /^Post$/i }).last(), page.getByText(/^Post$/i).last()], 8_000);
  if (!postButton) return needsAttention("post_disabled", "TikTok Post button was missing or disabled.");
  const dry = await postClickOrDryRun(postButton, cfg, "TikTok");
  if (dry) return dry;

  await waitWithHeartbeat(cfg, 15_000, { currentJobId: job.card.job_id, currentPlatform: "tiktok", message: "confirming TikTok post row" });
  await screenshot(page, cfg.outboxDir, job.card.job_id);
  if (!(await pageShowsAny(page, [/Content under review/i, /Posts \(Created on\)/i], 6_000))) {
    return needsAttention("success_missing", "TikTok did not show the Content under review completion row.");
  }
  return { outcome: "posted", externalUrl: "https://www.tiktok.com/@makeshiphappen.tech", externalPostId: job.card.job_id };
}

async function publishRumbleVideo(page: Page, job: JobEntry, cfg: RunnerConfig): Promise<AttemptResult> {
  const video = mediaPath(job, (item) => item.mime.startsWith("video/"));
  const missing = await ensureExistingMedia(video, "missing_video");
  if (missing) return missing;

  await page.goto(RUMBLE_UPLOAD_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  if (page.url().includes("/login") || (await pageShowsAny(page, [/login/i, /sign in/i], 2_000))) {
    return needsAttention("logged_out", "Rumble is showing a login screen.");
  }

  const attached = await attachFile(
    page,
    [page.getByText(/select video to upload/i), page.getByRole("button", { name: /select video/i })],
    video!,
    12_000,
  );
  if (!attached) return needsAttention("video_attach_failed", "Could not attach the Rumble video file.");

  const titleFilled = await fillTextTarget(
    page,
    [page.getByPlaceholder(/video title/i), page.getByLabel(/video title/i), page.locator('input[name*="title" i]').first()],
    titleText(job.card),
    8_000,
  );
  if (!titleFilled) return needsAttention("required_fields", "Could not fill the Rumble Video Title field.");
  const description = postText(job.card);
  if (description) {
    await fillTextTarget(
      page,
      [page.getByPlaceholder(/video description/i), page.getByLabel(/video description/i), page.locator("textarea").first()],
      description,
      8_000,
    ).catch(() => false);
  }

  const primary = page.locator("select").nth(0);
  if ((await primary.count()) > 0) {
    await primary.selectOption({ label: "Technology" }).catch(async () => {
      await primary.selectOption({ index: 1 }).catch(() => {});
    });
  }
  const secondary = page.locator("select").nth(1);
  if ((await secondary.count()) > 0) {
    await secondary.selectOption({ index: 1 }).catch(() => {});
  }

  let uploaded = false;
  for (let i = 0; i < 40; i += 1) {
    if (await pageShowsAny(page, [/100%/i], 1_000)) {
      uploaded = true;
      break;
    }
    await waitWithHeartbeat(cfg, 15_000, { currentJobId: job.card.job_id, currentPlatform: "rumble", message: "waiting for Rumble upload" });
  }
  if (!uploaded) return needsAttention("upload_stalled", "Rumble upload did not reach 100%.");

  await screenshot(page, cfg.outboxDir, job.card.job_id);
  const uploadButton = await enabledButton([page.getByRole("button", { name: /^Upload$/i }).last(), page.getByText(/^Upload$/i).last()], 8_000);
  if (!uploadButton) return needsAttention("upload_button_disabled", "Rumble Upload button was missing or disabled.");
  const dry = await postClickOrDryRun(uploadButton, cfg, "Rumble upload");
  if (dry) return dry;

  await waitWithHeartbeat(cfg, 4_000, { currentJobId: job.card.job_id, currentPlatform: "rumble", message: "waiting for Rumble licensing" });
  await clickFirst([page.getByText(/Rumble Only/i)], 4_000).catch(() => false);
  const checkboxes = page.locator('input[type="checkbox"]');
  const boxCount = await checkboxes.count();
  for (let i = 0; i < Math.min(boxCount, 2); i += 1) {
    await checkboxes.nth(i).check({ force: true }).catch(() => {});
  }
  await screenshot(page, cfg.outboxDir, job.card.job_id);
  const submit = await enabledButton([page.getByRole("button", { name: /^Submit$/i }).last(), page.getByText(/^Submit$/i).last()], 8_000);
  if (!submit) return needsAttention("terms_required", "Rumble Submit button was missing or disabled on the licensing page.");
  await submit.click({ timeout: 10_000 });

  await waitWithHeartbeat(cfg, 8_000, { currentJobId: job.card.job_id, currentPlatform: "rumble", message: "confirming Rumble completion" });
  await screenshot(page, cfg.outboxDir, job.card.job_id);
  if (!(await pageShowsAny(page, [/VIDEO UPLOAD COMPLETE/i, /Direct Link/i], 5_000))) {
    return needsAttention("success_missing", "Rumble did not show VIDEO UPLOAD COMPLETE.");
  }
  const directLink = await page.locator('input[value*="rumble.com"]').first().inputValue().catch(() => null);
  return { outcome: "posted", externalUrl: directLink ?? "https://rumble.com/", externalPostId: job.card.job_id };
}

async function publishYouTubeVideoUpload(page: Page, job: JobEntry, cfg: RunnerConfig): Promise<AttemptResult> {
  const video = mediaPath(job, (item) => item.mime.startsWith("video/"));
  const missing = await ensureExistingMedia(video, "missing_video");
  if (missing) return missing;

  await page.goto(DEFAULT_YOUTUBE_STUDIO_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  if (page.url().includes("accounts.google.com") || (await pageShowsAny(page, [/sign in/i], 2_000))) {
    return needsAttention("logged_out", "YouTube Studio is showing a Google sign-in screen.");
  }

  const attached = await attachFile(
    page,
    [
      page.getByRole("button", { name: /create/i }),
      page.getByRole("button", { name: /upload videos/i }),
      page.getByText(/select files/i),
    ],
    video!,
    12_000,
  );
  if (!attached) {
    await clickFirst([page.getByRole("button", { name: /create/i }), page.getByLabel(/create/i)], 5_000).catch(() => false);
    await clickFirst([page.getByText(/upload videos/i), page.getByRole("menuitem", { name: /upload videos/i })], 5_000).catch(() => false);
    const attachedAfterMenu = await attachFile(page, [page.getByText(/select files/i), page.getByRole("button", { name: /select files/i })], video!, 12_000);
    if (!attachedAfterMenu) return needsAttention("video_attach_failed", "Could not attach the video file in YouTube Studio.");
  }

  await waitWithHeartbeat(cfg, 8_000, { currentJobId: job.card.job_id, currentPlatform: "youtube", message: "waiting for YouTube Studio details" });
  const title = titleText(job.card);
  await fillTextTarget(
    page,
    [
      page.getByLabel(/^Title/i),
      page.locator('ytcp-social-suggestions-textbox[aria-label*="Title"] div[contenteditable="true"]').first(),
      page.locator('[aria-label*="Title"]').locator('[contenteditable="true"]').first(),
      page.locator('[contenteditable="true"]').first(),
    ],
    title,
    8_000,
  ).catch(() => false);
  const description = postText(job.card);
  if (description) {
    await fillTextTarget(
      page,
      [
        page.getByLabel(/Description/i),
        page.locator('ytcp-social-suggestions-textbox[aria-label*="Description"] div[contenteditable="true"]').first(),
        page.locator('[aria-label*="Description"]').locator('[contenteditable="true"]').first(),
      ],
      description,
      8_000,
    ).catch(() => false);
  }

  await clickFirst([page.getByText(/No, it's not made for kids/i), page.getByRole("radio", { name: /No, it's not made for kids/i })], 4_000).catch(() => false);
  await screenshot(page, cfg.outboxDir, job.card.job_id);

  for (let i = 0; i < 3; i += 1) {
    const next = await enabledButton([page.getByRole("button", { name: /^Next$/i }).last(), page.getByText(/^Next$/i).last()], 12_000);
    if (!next) break;
    await next.click({ timeout: 10_000 });
    await waitWithHeartbeat(cfg, 4_000, { currentJobId: job.card.job_id, currentPlatform: "youtube", message: "advancing YouTube Studio upload" });
  }

  const visibility = (job.card.privacy ?? "public").toLowerCase();
  if (visibility === "public") {
    await clickFirst([page.getByText(/^Public$/i), page.getByRole("radio", { name: /^Public$/i })], 4_000).catch(() => false);
  } else if (visibility === "unlisted") {
    await clickFirst([page.getByText(/^Unlisted$/i), page.getByRole("radio", { name: /^Unlisted$/i })], 4_000).catch(() => false);
  } else if (visibility === "private") {
    await clickFirst([page.getByText(/^Private$/i), page.getByRole("radio", { name: /^Private$/i })], 4_000).catch(() => false);
  }

  let uploadReady = false;
  for (let i = 0; i < 24; i += 1) {
    if (await pageShowsAny(page, [/Checks complete/i, /Finished processing/i, /Upload complete/i, /Video processed/i], 1_000)) {
      uploadReady = true;
      break;
    }
    if (await pageShowsAny(page, [/Processing will begin shortly/i, /Processing/i, /Uploading/i], 1_000)) {
      await waitWithHeartbeat(cfg, 15_000, { currentJobId: job.card.job_id, currentPlatform: "youtube", message: "waiting for YouTube processing" });
      continue;
    }
    await waitWithHeartbeat(cfg, 5_000, { currentJobId: job.card.job_id, currentPlatform: "youtube", message: "waiting for YouTube upload readiness" });
  }
  if (!uploadReady && (await pageShowsAny(page, [/Uploading/i, /Processing/i], 1_000))) {
    return needsAttention("upload_processing_stalled", "YouTube Studio did not finish upload/processing before the publish step.");
  }

  const publish = await enabledButton(
    [
      page.getByRole("button", { name: /^Publish$/i }).last(),
      page.getByRole("button", { name: /^Save$/i }).last(),
      page.getByText(/^Publish$/i).last(),
      page.getByText(/^Save$/i).last(),
    ],
    8_000,
  );
  if (!publish) return needsAttention("publish_button_disabled", "YouTube Studio Publish/Save button was missing or disabled.");
  const dry = await postClickOrDryRun(publish, cfg, "YouTube video");
  if (dry) return dry;

  await waitWithHeartbeat(cfg, 10_000, { currentJobId: job.card.job_id, currentPlatform: "youtube", message: "confirming YouTube video publish" });
  await screenshot(page, cfg.outboxDir, job.card.job_id);
  if (!(await pageShowsAny(page, [/Video published/i, /Upload complete/i, /Checks complete/i], 5_000))) {
    return needsAttention("success_missing", "YouTube Studio publish was clicked, but no completion signal was visible.");
  }
  const link = await page.locator('input[value*="youtu"]').first().inputValue().catch(() => null);
  return { outcome: "posted", externalUrl: link ?? DEFAULT_YOUTUBE_STUDIO_URL, externalPostId: job.card.job_id };
}

async function processJob(page: Page, job: JobEntry, cfg: RunnerConfig): Promise<AttemptResult> {
  switch (job.card.platform) {
    case "youtube": {
      const surface = youtubeSurface(job.card);
      if (surface === "youtube_community_post") return publishYouTubeCommunityPost(page, job, cfg);
      return publishYouTubeVideoUpload(page, job, cfg);
    }
    case "facebook":
      return publishFacebookPagePost(page, job, cfg);
    case "instagram":
      return publishInstagramPost(page, job, cfg);
    case "linkedin":
      return publishLinkedInPost(page, job, cfg);
    case "rumble":
      return publishRumbleVideo(page, job, cfg);
    case "tiktok":
      return publishTikTokUpload(page, job, cfg);
    case "x":
      return publishXPost(page, job, cfg);
    default:
      return {
        outcome: "needs_attention",
        errorCode: "platform_not_implemented",
        errorMessage: `Browser runner does not have a ${job.card.platform} posting recipe yet.`,
      };
  }
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
  await writeHeartbeat(cfg, { status: "scanning", message: "checking outbox/due" }).catch(() => {});
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
      await writeHeartbeat(cfg, {
        status: "attempting",
        currentJobId: job.card.job_id,
        currentPlatform: job.card.platform,
        message: "processing due card",
      }).catch(() => {});
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
      await writeHeartbeat(cfg, {
        status: "idle",
        currentJobId: null,
        currentPlatform: null,
        message: "job pass complete",
      }).catch(() => {});
      await release();
    }
  }

  await writeHeartbeat(cfg, { status: "idle", message: handled === 0 ? "no due card handled" : "pass complete" }).catch(() => {});
  return handled;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  console.log(`[agent-runner] outbox: ${cfg.outboxDir}`);
  console.log(`[agent-runner] chrome profile: ${cfg.profileName} (${cfg.profileEmail || cfg.profileDirectory}) -> ${cfg.profileDirectory}`);
  console.log(`[agent-runner] runner profile dir: ${cfg.userDataDir}`);
  console.log(`[agent-runner] isolated Chrome enabled: ${cfg.allowIsolatedChrome ? "yes" : "no - use npm run agent:tabs for active Chrome"}`);
  console.log(`[agent-runner] mode: ${cfg.live ? "LIVE - will click final Post buttons" : "DRY RUN - will stop before final Post"}`);
  await writeHeartbeat(cfg, { status: "starting", message: "agent runner starting" }).catch(() => {});

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
    await writeHeartbeat(cfg, { status: "stopped", message: "agent runner stopped" }).catch(() => {});
    if (cfg.once) await closeBrowser(browser);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
