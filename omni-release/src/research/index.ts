/**
 * omni-release · research engine · public surface
 *
 * Import from here:
 *   import { researchLane, SOURCE_REGISTRY, type ResearchResult } from 'omni-release/research';
 */

export * from './types.js';
export {
  SOURCE_REGISTRY,
  getSource,
  listCategories,
  selectSources,
  summarizeRegistry,
  type SourceQuery,
} from './sourceRegistry.js';
export {
  fetchSource,
  fetchSources,
  normalizeWeight,
  canonicalUrl,
  hashId,
  toIso,
  type FetchOutcome,
  type FetchOptions,
} from './fetchSources.js';
export { SourceHealthStore } from './sourceHealth.js';
export { researchLane, scoreItem } from './researchLane.js';
export { resolveContext, defaultLogger, type ResolvedContext } from './context.js';
