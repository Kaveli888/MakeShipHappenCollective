/**
 * omni-release · research engine · source health
 *
 * Persists a rolling health record per source so the lane (and operators) can
 * see which feeds are reliable, degraded, or down. State lives at
 * `<dataDir>/research/source-health.json`. Reads/writes are best-effort: a
 * missing or corrupt file is treated as empty, and write failures are logged
 * but never throw out of the lane.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SourceHealthRecord, SourceHealthStatus } from './types.js';
import type { ResolvedContext } from './context.js';
import type { FetchOutcome } from './fetchSources.js';

const FILE_VERSION = 1;
const DEGRADE_AFTER = 2; // consecutive failures → degraded
const DOWN_AFTER = 5; //    consecutive failures → down
const LATENCY_ALPHA = 0.3; // EWMA smoothing for avgLatencyMs

interface HealthFile {
  version: number;
  updatedAt: string | null;
  records: Record<string, SourceHealthRecord>;
}

export class SourceHealthStore {
  private file: string;
  private data: HealthFile = { version: FILE_VERSION, updatedAt: null, records: {} };
  private loaded = false;

  constructor(private ctx: ResolvedContext) {
    this.file = path.join(ctx.dataDir, 'research', 'source-health.json');
  }

  get filePath(): string {
    return this.file;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as HealthFile;
      if (parsed && typeof parsed === 'object' && parsed.records) {
        this.data = { version: FILE_VERSION, updatedAt: parsed.updatedAt ?? null, records: parsed.records };
      }
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        this.ctx.logger.warn(`health store unreadable (${err?.message}); starting fresh`);
      }
    }
    this.loaded = true;
  }

  get(sourceId: string): SourceHealthRecord {
    return this.data.records[sourceId] ?? blankRecord(sourceId);
  }

  all(): SourceHealthRecord[] {
    return Object.values(this.data.records).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  }

  /** Fold a fetch outcome into the stored record (in-memory; call save() after). */
  record(outcome: FetchOutcome): SourceHealthRecord {
    const id = outcome.source.id;
    const prev = this.data.records[id] ?? blankRecord(id);
    const nowIso = new Date(this.ctx.now()).toISOString();
    const next: SourceHealthRecord = { ...prev, lastCheckedAt: nowIso };

    if (outcome.skipped) {
      // Skips don't count as failures; status is informational only.
      next.status = prev.status === 'unknown' ? 'unknown' : prev.status;
      this.data.records[id] = next;
      return next;
    }

    if (outcome.ok) {
      next.lastSuccessAt = nowIso;
      next.lastError = null;
      next.consecutiveFailures = 0;
      next.totalSuccess = prev.totalSuccess + 1;
      next.lastItemCount = outcome.items.length;
      next.avgLatencyMs = ewma(prev.avgLatencyMs, outcome.latencyMs, prev.totalSuccess === 0);
      next.status = outcome.items.length === 0 ? 'degraded' : 'healthy';
    } else {
      next.lastError = outcome.error ?? 'unknown error';
      next.consecutiveFailures = prev.consecutiveFailures + 1;
      next.totalFailure = prev.totalFailure + 1;
      next.status = statusForFailures(next.consecutiveFailures);
    }

    this.data.records[id] = next;
    return next;
  }

  /** Persist current state. Failures are logged, not thrown. */
  async save(): Promise<void> {
    this.data.version = FILE_VERSION;
    this.data.updatedAt = new Date(this.ctx.now()).toISOString();
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
      this.ctx.logger.debug(`health store saved → ${this.file}`);
    } catch (err: any) {
      this.ctx.logger.warn(`failed to persist health store: ${err?.message}`);
    }
  }

  /** Operator-facing summary grouped by status. */
  summary(): {
    counts: Record<SourceHealthStatus, number>;
    down: string[];
    degraded: string[];
    updatedAt: string | null;
  } {
    const counts: Record<SourceHealthStatus, number> = {
      healthy: 0,
      degraded: 0,
      down: 0,
      unknown: 0,
    };
    const down: string[] = [];
    const degraded: string[] = [];
    for (const r of this.all()) {
      counts[r.status] += 1;
      if (r.status === 'down') down.push(r.sourceId);
      if (r.status === 'degraded') degraded.push(r.sourceId);
    }
    return { counts, down, degraded, updatedAt: this.data.updatedAt };
  }
}

function blankRecord(sourceId: string): SourceHealthRecord {
  return {
    sourceId,
    status: 'unknown',
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastError: null,
    consecutiveFailures: 0,
    totalSuccess: 0,
    totalFailure: 0,
    avgLatencyMs: 0,
    lastItemCount: 0,
  };
}

function statusForFailures(consecutive: number): SourceHealthStatus {
  if (consecutive >= DOWN_AFTER) return 'down';
  if (consecutive >= DEGRADE_AFTER) return 'degraded';
  return 'healthy'; // a single blip stays healthy
}

function ewma(prev: number, sample: number, first: boolean): number {
  if (first || prev === 0) return Math.round(sample);
  return Math.round(prev * (1 - LATENCY_ALPHA) + sample * LATENCY_ALPHA);
}
