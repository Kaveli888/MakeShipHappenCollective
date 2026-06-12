/**
 * @ship-memory/core — public API.
 *
 * Import surface for every adapter (MCP, REST, ShipSpace UI, connectors).
 * Adapters should depend ONLY on what's exported here, never on internal
 * modules, so the storage backend can change without breaking them.
 */

export { ShipMemory, HubNotFoundError, MemoryNotFoundError } from "./engine.js";
// The FS seam. Node hosts import the ready-made implementation from
// `@ship-memory/core/node`; browser/Tauri hosts implement VaultFs themselves.
export type { VaultFs, FileStat } from "./fs.js";
export { joinPath, dirnamePath, normalizePath } from "./path.js";
export {
  HUB_DIRNAME,
  type Memory,
  type MemoryMeta,
  type Hub,
  type HubStatus,
  type SearchHit,
  type ConnectionSuggestion,
  type CreateMemoryInput,
} from "./types.js";
export type {
  Connector,
  ConnectorNote,
  ConnectorContext,
} from "./connectors/types.js";
export { syncConnector, type SyncReport } from "./sync.js";

// Low-level building blocks, exported for connectors / advanced hosts.
export { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
export { extractLinks } from "./links.js";
export { slugify, normalizeKey } from "./slug.js";
export { tokenize, termSet, scoreOverlap } from "./search.js";
