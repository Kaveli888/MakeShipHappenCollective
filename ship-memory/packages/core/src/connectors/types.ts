/**
 * Connector seam — how third-party sources flow INTO Ship Memory.
 *
 * This is the differentiator from a plain note app: Ship Memory is a hub that
 * any source can feed. The core never learns what a "Notion page" or a "Gmail
 * thread" is — a connector translates the foreign thing into a `ConnectorNote`
 * (markdown + links + metadata) and hands it over. That keeps connectors as
 * pluggable satellites and the engine forever source-agnostic.
 *
 * Nothing here is implemented yet — it's the contract the first connector
 * (Obsidian-vault import is the cheapest) will fulfill.
 */

/** A normalized note produced by a connector, ready for the engine to store. */
export interface ConnectorNote {
  title: string;
  body: string;
  /** Extra frontmatter the connector wants persisted (source, url, ids…). */
  frontmatter?: Record<string, unknown>;
  /** Stable id in the SOURCE system, used for idempotent re-sync. */
  sourceId: string;
}

export interface ConnectorContext {
  /** Only pull items changed since this epoch-ms watermark, when supported. */
  since?: number;
  /** Connector-specific config (tokens, vault paths, query filters…). */
  config?: Record<string, unknown>;
}

export interface Connector {
  /** Stable id, e.g. "obsidian", "notion", "gmail". */
  id: string;
  /** Human label for UIs. */
  label: string;
  /**
   * Pull notes from the source. Inbound only for now; two-way sync is a later
   * concern and should be modeled as a separate capability, not bolted here.
   */
  pull(ctx: ConnectorContext): Promise<ConnectorNote[]>;
}
