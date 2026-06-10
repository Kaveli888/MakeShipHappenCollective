/**
 * Connector sync runner — connector-agnostic.
 *
 * Pulls notes from any {@link Connector} and ingests them idempotently. The
 * connector only knows how to READ its source; the engine owns WRITING. This
 * split is what keeps connectors dumb satellites and the core the single owner
 * of the vault.
 */

import type { ShipMemory } from "./engine.js";
import type { Connector, ConnectorContext } from "./connectors/types.js";

export interface SyncReport {
  connector: string;
  /** Notes the connector returned (after any `since` filtering). */
  pulled: number;
  created: number;
  updated: number;
}

export async function syncConnector(
  mem: ShipMemory,
  connector: Connector,
  ctx: ConnectorContext = {},
): Promise<SyncReport> {
  const notes = await connector.pull(ctx);
  const { created, updated } = mem.ingestMany(
    connector.id,
    notes.map((n) => ({
      title: n.title,
      body: n.body,
      frontmatter: n.frontmatter ?? {},
      sourceId: n.sourceId,
    })),
  );
  return { connector: connector.id, pulled: notes.length, created, updated };
}
