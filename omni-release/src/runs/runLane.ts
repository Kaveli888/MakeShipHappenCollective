/**
 * runLane — the orchestrator (t6).
 *
 * Threads one lane end-to-end:
 *
 *   research → write → proof image → (per platform) fact-check →
 *   duplicate-check → quality gate → publish/queue → log
 *
 * Each stage produces a `StageResult`; the whole run returns a `LaneRunResult`.
 * The orchestrator owns the seams between the producer modules (it adapts their
 * payloads to the shared core contracts) and is the ONLY place that decides what
 * gets queued vs. blocked vs. published.
 *
 * SAFE BY DEFAULT: mode is `queue` (nothing posts live) unless `mode: "live"` is
 * requested AND a publisher can publish live. A post is never dropped — every
 * accepted caption lands in a ready-to-post package on disk.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Caption,
  LaneConfig,
  LaneRunResult,
  OmniConfig,
  Logger,
  Platform,
  PublishResult,
  QueueItem,
  RunOptions,
  StageResult,
  StageStatus,
} from "../core/index.js";
import {
  contentHash,
  createLogger,
  DEFAULT_RUN_OPTIONS,
  ensureDir,
  getLane,
  loadConfig,
  makeRunId,
  nowIso,
  paths,
} from "../core/index.js";
import { researchLane, type ResearchResult } from "../research/index.js";
import { writeCaptions, tryGetLanePrompt } from "../content/index.js";
import { factCheck } from "../quality/index.js";
import { runQualityGate } from "../quality/index.js";
import { checkDuplicate, logPost, type LoggablePost } from "../memory/index.js";
import { saveProofAsset, type ProofClaim, type ProofType } from "../proof/index.js";
import {
  getPublisher,
  writeReadyToPostPackage,
  type PackagePost,
  type PackageSource,
  type ReadyToPostPackage,
} from "../publish/index.js";

export interface RunLaneArgs {
  laneId: string;
  options?: Partial<RunOptions>;
  cfg?: OmniConfig;
  logger?: Logger;
}

/** Per-lane proof card style. */
const PROOF_TYPE: Record<string, ProofType> = {
  "ai-daily-shift": "news-card",
  "model-watch": "comparison-card",
  "evening-battle-card": "battle-card",
};

function todayStamp(): string {
  return nowIso().slice(0, 10);
}

function clampLen(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

function confidenceForScore(score: number): ProofClaim["confidence"] {
  if (score >= 66) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/** The published footprint of a caption (body + hashtags). */
function publishedText(c: Caption): string {
  return c.hashtags.length ? `${c.body}\n\n${c.hashtags.join(" ")}` : c.body;
}

/** Map cited research item ids → unique {name,url} sources for attribution. */
function sourcesFor(research: ResearchResult, itemIds: string[]): PackageSource[] {
  const byId = new Map(research.items.map((it) => [it.id, it]));
  const seen = new Set<string>();
  const out: PackageSource[] = [];
  for (const id of itemIds) {
    const it = byId.get(id);
    if (!it || !it.url || seen.has(it.url)) continue;
    seen.add(it.url);
    out.push({ name: it.sourceName, url: it.url });
  }
  return out;
}

function timed(stage: StageResult["stage"], start: number, patch: Partial<StageResult>): StageResult {
  return {
    stage,
    status: patch.status ?? "ok",
    durationMs: Date.now() - start,
    ...patch,
  };
}

/** Run a single lane end-to-end. Never throws for expected failures. */
export async function runLane(args: RunLaneArgs): Promise<LaneRunResult> {
  const cfg = args.cfg ?? loadConfig();
  const options: RunOptions = { ...DEFAULT_RUN_OPTIONS, mode: cfg.defaultMode, ...args.options };
  const lane: LaneConfig | undefined = getLane(args.laneId, cfg);

  const startedAt = nowIso();
  const runId = makeRunId(args.laneId);
  const logger = (args.logger ?? createLogger()).child(args.laneId);
  const stages: StageResult[] = [];

  if (!lane) {
    return {
      runId,
      laneId: args.laneId,
      startedAt,
      finishedAt: nowIso(),
      status: "failed",
      stages,
      queued: [],
      summary: `Unknown lane "${args.laneId}". Known lanes: ${cfg.lanes.map((l) => l.id).join(", ")}.`,
    };
  }

  const platforms: Platform[] = options.platforms?.length ? options.platforms : lane.platforms;
  logger.info(`run start`, { runId, mode: options.mode, dryRun: options.dryRun, platforms });

  // ── 1. Research ──────────────────────────────────────────────────────────
  let research: ResearchResult;
  {
    const start = Date.now();
    try {
      research = await researchLane(
        lane.id,
        {
          categories: lane.sourceCategories,
          keywords: lane.keywords,
          maxTotalItems: cfg.maxResearchItems,
          timeoutMs: cfg.fetchTimeoutMs,
        },
        {
          dataDir: paths.data,
          logger: {
            debug: (m) => logger.debug(m),
            info: (m) => logger.info(m),
            warn: (m) => logger.warn(m),
            error: (m) => logger.error(m),
          },
        },
      );
      const ok = research.items.length > 0;
      stages.push(
        timed("research", start, {
          status: ok ? "ok" : "failed",
          output: { items: research.items.length, sources: research.stats },
          notes: research.notes,
        }),
      );
      if (!ok) {
        return finish(runId, lane.id, startedAt, stages, [], "failed", "No research items found — nothing to write.");
      }
    } catch (e) {
      stages.push(timed("research", start, { status: "failed", error: errMsg(e) }));
      return finish(runId, lane.id, startedAt, stages, [], "failed", `Research failed: ${errMsg(e)}`);
    }
  }

  // ── 2. Write captions ────────────────────────────────────────────────────
  let captions: Caption[];
  {
    const start = Date.now();
    try {
      const set = await writeCaptions(research, { platforms, configDir: paths.root });
      captions = set.captions;
      stages.push(timed("write", start, { status: "ok", output: { captions: captions.length } }));
    } catch (e) {
      stages.push(timed("write", start, { status: "failed", error: errMsg(e) }));
      return finish(runId, lane.id, startedAt, stages, [], "failed", `Writing failed: ${errMsg(e)}`);
    }
  }

  const topic = research.items[0]?.title ?? lane.name;
  const laneCta = tryGetLanePrompt(lane.id)?.cta ?? "See body for CTA";

  // ── 3. Proof image ───────────────────────────────────────────────────────
  let proofRelPath: string | undefined;
  {
    const start = Date.now();
    const wantProof = lane.proofImage && !options.skipProofImage;
    if (!wantProof) {
      stages.push(timed("proof-image", start, { status: "skipped" }));
    } else {
      try {
        const claims: ProofClaim[] = research.items.slice(0, 3).map((it) => ({
          text: clampLen(it.title, 120),
          sourceLabel: it.sourceName,
          sourceUrl: it.url || undefined,
          confidence: confidenceForScore(it.score),
          checkedAt: research.generatedAt,
        }));
        const saved = await saveProofAsset(
          {
            title: clampLen(topic, 92),
            subtitle: lane.description,
            lane: lane.name,
            proofType: PROOF_TYPE[lane.id] ?? "news-card",
            publicationDate: todayStamp(),
            claims,
            footerNote: "MakeShipHappen · Omni Release",
          },
          { rootDir: paths.root, runId },
        );
        proofRelPath = saved.relativeImagePath;
        stages.push(timed("proof-image", start, { status: "ok", output: { path: proofRelPath } }));
        logger.info("proof image saved", { path: proofRelPath });
      } catch (e) {
        // A failed proof image is a warning, not fatal — quality gate enforces.
        stages.push(timed("proof-image", start, { status: "failed", error: errMsg(e) }));
        logger.warn("proof image failed", { error: errMsg(e) });
      }
    }
  }

  // ── 4. Per-platform checks (fact-check → dup → quality) ───────────────────
  const packagePath = join(paths.root, "ready-to-post", `${runId}.md`);
  const accepted: { caption: Caption; result?: PublishResult }[] = [];
  const queued: QueueItem[] = [];
  const rejections: string[] = [];

  const fcStart = Date.now();
  let anyFactIssue = false;
  let anyBlocked = false;
  for (const caption of captions) {
    const fc = factCheck(caption, research, { lane: lane.id });
    if (!fc.passed) anyFactIssue = true;

    const dup = await checkDuplicate(
      { text: publishedText(caption), platform: caption.platform, lane: lane.id },
      { threshold: cfg.duplicateThreshold, sameLaneOnly: true },
    );

    const gate = await runQualityGate(caption, {
      laneId: lane.id,
      limits: cfg.platformLimits[caption.platform],
      factCheck: fc,
      duplicate: { isDuplicate: dup.isDuplicate, similarity: dup.similarity, similarTo: dup.similarTo },
      minScore: cfg.minQualityScore,
      minFactCheckConfidence: cfg.minFactCheckConfidence,
      requireProofImage: lane.proofImage && !options.skipProofImage,
      hasProofImage: Boolean(proofRelPath),
      strict: options.strict,
      configDir: paths.root,
    });

    if (gate.passed) {
      accepted.push({ caption });
      const now = nowIso();
      queued.push({
        id: `${runId}-${caption.platform}`,
        laneId: lane.id,
        platform: caption.platform,
        status: "ready",
        caption,
        imagePath: proofRelPath,
        markdownPath: packagePath,
        createdAt: now,
        updatedAt: now,
        contentHash: contentHash(publishedText(caption)),
      });
    } else {
      anyBlocked = true;
      const blocks = gate.issues.filter((i) => i.severity === "block").map((i) => i.rule);
      rejections.push(`${caption.platform}: blocked [${blocks.join(", ")}] (score ${gate.score.toFixed(2)})`);
      logger.warn("caption blocked", { platform: caption.platform, issues: gate.issues });
    }
  }
  stages.push(
    timed("fact-check", fcStart, {
      status: anyFactIssue ? "ok" : "ok",
      notes: anyFactIssue ? ["one or more captions had unsupported claims"] : undefined,
    }),
  );
  stages.push(timed("duplicate-check", fcStart, { status: "ok" }));
  stages.push(
    timed("quality-gate", fcStart, {
      status: accepted.length === 0 ? "blocked" : "ok",
      output: { accepted: accepted.length, blocked: captions.length - accepted.length },
      notes: rejections.length ? rejections : undefined,
    }),
  );

  if (accepted.length === 0) {
    return finish(runId, lane.id, startedAt, stages, [], "blocked", `All ${captions.length} captions blocked: ${rejections.join("; ")}`);
  }

  // ── 5. Publish / queue (never drop) ──────────────────────────────────────
  const pubStart = Date.now();
  const failures: string[] = [];
  if (options.mode === "live" && !options.dryRun) {
    for (let i = 0; i < accepted.length; i++) {
      const item = queued[i]!;
      const publisher = getPublisher(item.platform);
      const res = await publisher.publish(item, "live");
      accepted[i]!.result = res;
      item.status = res.status;
      item.updatedAt = nowIso();
      if (res.status !== "posted" && res.status !== "ready") {
        failures.push(`${item.platform}: ${res.error ?? "failed"}`);
      }
    }
  }

  // ── 6. Ready-to-post package (always written) ────────────────────────────
  const allSources = dedupeSources(accepted.flatMap((a) => sourcesFor(research, a.caption.citedItemIds)));
  const posts: PackagePost[] = accepted.map((a) => {
    const post: PackagePost = {
      platform: a.caption.platform,
      body: a.caption.body,
      hashtags: a.caption.hashtags,
      charCount: a.caption.charCount,
      cta: laneCta,
      imageAltText: a.caption.imageAltText,
    };
    if (a.result) post.result = a.result;
    return post;
  });

  const failureReason =
    options.mode === "live"
      ? failures.length
        ? `Live publishing failed for: ${failures.join("; ")}. Post manually using the captions below.`
        : "Live publishing attempted (see per-post status)."
      : "Queue mode — automated publishing was not attempted. Post manually using the captions below.";

  const pkg: ReadyToPostPackage = {
    runId,
    laneId: lane.id,
    laneName: lane.name,
    topic,
    createdAt: nowIso(),
    mode: options.mode,
    dryRun: options.dryRun,
    sources: allSources,
    proofImagePath: proofRelPath,
    posts,
    failureReason,
  };
  let writtenPath = packagePath;
  try {
    writtenPath = await writeReadyToPostPackage(pkg, { rootDir: paths.root });
    stages.push(timed("publish", pubStart, { status: "ok", output: { package: writtenPath, mode: options.mode } }));
  } catch (e) {
    stages.push(timed("publish", pubStart, { status: "failed", error: errMsg(e) }));
  }

  // ── 7. Durable log (social-post-log.jsonl) ───────────────────────────────
  for (const a of accepted) {
    const loggable: LoggablePost = {
      lane: lane.id,
      platform: a.caption.platform,
      text: publishedText(a.caption),
      hashtags: a.caption.hashtags,
      sources: sourcesFor(research, a.caption.citedItemIds).map((s) => s.url),
      sourceItemIds: a.caption.citedItemIds,
    };
    const status = a.result
      ? a.result.status === "posted"
        ? "posted"
        : a.result.status === "ready"
          ? "queued"
          : "failed"
      : "queued";
    await logPost(loggable, {
      status,
      cta: laneCta,
      topic,
      reusable: false,
      dryRun: options.dryRun,
      url: a.result?.externalId,
    });
  }

  // Run-level log artifact under logs/.
  await writeRunLog(runId, { pkg, stages, queued });

  const status: StageStatus = anyBlocked && accepted.length < captions.length ? "ok" : "ok";
  const summary = `${accepted.length}/${captions.length} captions queued → ${writtenPath}${
    failures.length ? ` (${failures.length} live failures, saved to ready-to-post)` : ""
  }`;
  logger.info("run done", { summary });
  return finish(runId, lane.id, startedAt, stages, queued, status, summary);
}

function dedupeSources(sources: PackageSource[]): PackageSource[] {
  const seen = new Set<string>();
  const out: PackageSource[] = [];
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}

async function writeRunLog(runId: string, payload: unknown): Promise<void> {
  const dir = ensureDir(paths.logs);
  await writeFile(join(dir, `run-${runId}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function finish(
  runId: string,
  laneId: string,
  startedAt: string,
  stages: StageResult[],
  queued: QueueItem[],
  status: StageStatus,
  summary: string,
): LaneRunResult {
  return { runId, laneId, startedAt, finishedAt: nowIso(), status, stages, queued, summary };
}
