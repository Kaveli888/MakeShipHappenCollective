/**
 * Runs layer (t6) — orchestration public surface.
 */

import type { LaneRunResult, OmniConfig, RunAllResult, RunOptions, Logger } from "../core/index.js";
import { loadConfig, nowIso } from "../core/index.js";
import { runLane } from "./runLane.js";

export { runLane, type RunLaneArgs } from "./runLane.js";

export interface RunAllArgs {
  options?: Partial<RunOptions>;
  cfg?: OmniConfig;
  logger?: Logger;
  /** Run every lane regardless of `enabled`. Default false. */
  includeDisabled?: boolean;
}

/** Run every enabled lane in sequence. */
export async function runAll(args: RunAllArgs = {}): Promise<RunAllResult> {
  const cfg = args.cfg ?? loadConfig();
  const startedAt = nowIso();
  const lanes = cfg.lanes.filter((l) => args.includeDisabled || l.enabled);
  const results: LaneRunResult[] = [];
  for (const lane of lanes) {
    results.push(await runLane({ laneId: lane.id, options: args.options, cfg, logger: args.logger }));
  }
  return {
    startedAt,
    finishedAt: nowIso(),
    lanes: results,
    ok: results.every((r) => r.status !== "failed"),
  };
}
