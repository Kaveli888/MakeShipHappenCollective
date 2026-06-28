#!/usr/bin/env node
/**
 * Ship Memory MCP server.
 *
 * A THIN adapter: every tool here just resolves a hub and calls a method on
 * @ship-memory/core. No memory logic lives in this file — that's the whole
 * point of the headless-core split. The same engine is reused verbatim by the
 * (future) REST adapter and the ShipSpace UI panel.
 *
 * Hub resolution: a tool's optional `cwd` arg > $SHIP_MEMORY_HUB > process.cwd,
 * then walk up for a `.shipmemory/` directory.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { ShipMemory } from "@ship-memory/core";
import { nodeFs } from "@ship-memory/core/node";

function hubCwd(args: Record<string, unknown> | undefined): string {
  const cwd = args?.cwd;
  if (typeof cwd === "string" && cwd) return cwd;
  return process.env.SHIP_MEMORY_HUB || process.cwd();
}

const CWD_PROP = {
  cwd: {
    type: "string",
    description:
      "Optional absolute path to resolve the hub from. Defaults to $SHIP_MEMORY_HUB or the server's working directory.",
  },
} as const;

const TOOLS: Tool[] = [
  {
    name: "hub_status",
    description:
      "Check whether a Ship Memory hub exists at/above a directory, and how many notes it holds. Cheap first call.",
    inputSchema: { type: "object", properties: { ...CWD_PROP } },
  },
  {
    name: "init_hub",
    description:
      "Create a `.shipmemory/` hub in a directory. Only call when the user explicitly asks to set up memory here.",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string", description: "Directory to create the hub in." },
      },
      required: ["dir"],
    },
  },
  {
    name: "list_memories",
    description:
      "List all memories (metadata only, no bodies), newest first. Call before creating to avoid duplicates.",
    inputSchema: { type: "object", properties: { ...CWD_PROP } },
  },
  {
    name: "read_memory",
    description:
      "Read a full memory by slug, title, path, or wikilink target.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "Slug, title, or path." },
        ...CWD_PROP,
      },
      required: ["identifier"],
    },
  },
  {
    name: "search_memories",
    description:
      "Term-overlap + substring search across titles and bodies. Use when you don't know the exact title.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", description: "Max hits (default 20)." },
        ...CWD_PROP,
      },
      required: ["query"],
    },
  },
  {
    name: "find_backlinks",
    description:
      "List memories whose `[[wikilinks]]` point at a target. Call before deleting or renaming.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Slug or title to find links to." },
        ...CWD_PROP,
      },
      required: ["target"],
    },
  },
  {
    name: "create_memory",
    description:
      "Create a NEW memory. Search first to avoid duplicates. Use `[[wikilinks]]` in the body to connect related notes.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Stable title; becomes the H1 and slug." },
        body: { type: "string", description: "Markdown body." },
        frontmatter: { type: "object", description: "Optional metadata (type, tags, source…)." },
        ...CWD_PROP,
      },
      required: ["title", "body"],
    },
  },
  {
    name: "append_to_memory",
    description:
      "Append a paragraph to an existing memory. Preferred over update_memory for incremental edits.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string" },
        text: { type: "string", description: "Markdown to append." },
        ...CWD_PROP,
      },
      required: ["identifier", "text"],
    },
  },
  {
    name: "update_memory",
    description:
      "Replace a memory's body wholesale. Use rarely — append_to_memory is safer.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string" },
        body: { type: "string", description: "New full markdown body." },
        ...CWD_PROP,
      },
      required: ["identifier", "body"],
    },
  },
  {
    name: "delete_memory",
    description:
      "Permanently delete a memory. Returns any backlinks that will dangle. Only when explicitly asked to forget.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string" },
        ...CWD_PROP,
      },
      required: ["identifier"],
    },
  },
  {
    name: "suggest_connections",
    description:
      "After writing, find existing notes sharing keywords that might be worth `[[linking]]`.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string" },
        limit: { type: "number", description: "Max suggestions (default 10)." },
        ...CWD_PROP,
      },
      required: ["identifier"],
    },
  },
  {
    name: "list_orphans",
    description:
      "List notes with no incoming or outgoing links — candidates for cleanup or new wikilinks.",
    inputSchema: { type: "object", properties: { ...CWD_PROP } },
  },
];

// Read-only mode (SHIP_MEMORY_READONLY=1) enforces the boundary AT THE SERVER,
// not via the client's --allowedTools. That matters: a client launched with
// `--permission-mode bypassPermissions` overrides --allowedTools entirely, so
// the allowlist is NOT a security boundary. Here the write tools are neither
// advertised nor executed, regardless of how the client is configured. Used by
// ShipSpace's orchestrator to give autonomous workers read-only memory.
const READONLY = /^(1|true|yes|on)$/i.test(
  process.env.SHIP_MEMORY_READONLY ?? "",
);
const READ_TOOLS = new Set([
  "hub_status",
  "list_memories",
  "read_memory",
  "search_memories",
  "find_backlinks",
  "suggest_connections",
  "list_orphans",
]);
const VISIBLE_TOOLS = READONLY
  ? TOOLS.filter((t) => READ_TOOLS.has(t.name))
  : TOOLS;

const server = new Server(
  { name: "ship-memory-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: VISIBLE_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name } = req.params;
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;

  try {
    const result = await dispatch(name, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function dispatch(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  // Defense in depth: even if a client somehow calls a hidden write tool, the
  // server refuses it in read-only mode. This, not --allowedTools, is the gate.
  if (READONLY && !READ_TOOLS.has(name)) {
    throw new Error(
      `ship-memory is in read-only mode (SHIP_MEMORY_READONLY); '${name}' is a write tool and is disabled.`,
    );
  }

  // init_hub and hub_status don't require an existing hub.
  if (name === "hub_status") return ShipMemory.status(hubCwd(args), nodeFs);
  if (name === "init_hub") {
    const mem = await ShipMemory.create(String(args.dir), nodeFs);
    return { hub: mem.root, created: true };
  }

  const mem = await ShipMemory.open(hubCwd(args), nodeFs);
  switch (name) {
    case "list_memories":
      return mem.list();
    case "read_memory":
      return mem.read(String(args.identifier));
    case "search_memories":
      return mem.search(String(args.query), numberArg(args.limit, 20));
    case "find_backlinks":
      return mem.backlinks(String(args.target));
    case "create_memory":
      return mem.create({
        title: String(args.title),
        body: String(args.body),
        frontmatter: args.frontmatter as Record<string, unknown> | undefined,
      });
    case "append_to_memory":
      return mem.append(String(args.identifier), String(args.text));
    case "update_memory":
      return mem.update(String(args.identifier), String(args.body));
    case "delete_memory":
      return mem.delete(String(args.identifier));
    case "suggest_connections":
      return mem.suggestConnections(
        String(args.identifier),
        numberArg(args.limit, 10),
      );
    case "list_orphans":
      return mem.orphans();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function numberArg(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP channel.
  console.error("ship-memory-mcp running on stdio");
}

main().catch((err) => {
  console.error("ship-memory-mcp fatal:", err);
  process.exit(1);
});
