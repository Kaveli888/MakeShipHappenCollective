/**
 * omni-release · research engine · context resolution
 *
 * Resolves an optional, partial ResearchContext into a fully-populated one with
 * safe standalone defaults. The orchestrator (t6) / app (t1) injects the real
 * shared logger + paths; absent those, the engine runs on its own.
 */

import * as path from 'node:path';
import type { ResearchContext, ResearchLogger } from './types.js';

export interface ResolvedContext {
  logger: ResearchLogger;
  dataDir: string;
  fetchImpl: typeof fetch;
  now: () => number;
}

/** Minimal console logger used when the host injects none. */
export function defaultLogger(): ResearchLogger {
  const fmt = (lvl: string, msg: string) => `[research:${lvl}] ${msg}`;
  return {
    debug: (m) => {
      if (process.env.OMNI_DEBUG) console.debug(fmt('debug', m));
    },
    info: (m) => console.error(fmt('info', m)),
    warn: (m) => console.error(fmt('warn', m)),
    error: (m) => console.error(fmt('error', m)),
  };
}

export function resolveContext(ctx: ResearchContext = {}): ResolvedContext {
  const fetchImpl = ctx.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
  if (!fetchImpl) {
    throw new Error(
      'omni-release research: no global fetch available. Use Node >= 18 or inject ctx.fetchImpl.',
    );
  }
  return {
    logger: ctx.logger ?? defaultLogger(),
    dataDir: ctx.dataDir ?? process.env.OMNI_DATA_DIR ?? path.join(process.cwd(), '.omni'),
    fetchImpl,
    now: ctx.now ?? Date.now,
  };
}
