/**
 * Memory layer (t3) — public surface.
 *
 * The append-only post log and the duplicate checker built on top of it.
 */

export * from "./types.js";
export {
  resolveLogPath,
  readPostLog,
  appendPostLog,
  recordFromPost,
  logPost,
  lastCtaForLane,
  type PostLogOptions,
  type RecordExtras,
  type LoggablePost,
} from "./postLog.js";
export {
  checkDuplicate,
  normalizeText,
  hashContent,
  jaccard,
  type DuplicateCheckOptions,
  type DuplicateCheckInput,
} from "./duplicateCheck.js";
