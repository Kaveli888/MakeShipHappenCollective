#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Channel + WebKit localStorage location ──
//
// ShipSpace persists every zustand store into the WebView's localStorage. On
// macOS that lives inside WebKit's per-app sandbox at
// ~/Library/WebKit/<bundle-id>/WebsiteData/Default/<origin-hash>/<origin-hash>/LocalStorage/localstorage.sqlite3
// One bundle id can contain multiple per-origin folders; we pick the one that
// actually contains keys with the `shipspace-` prefix (and the most of them
// when there is more than one candidate).

function bundleIdForChannel(channel: string): string {
    if (channel === "dev") return "com.shipspace.ade.dev";
    if (channel === "beta") return "com.shipspace.ade.beta";
    return "com.shipspace.ade";
}

function findLocalStorageDb(channel: string): string {
    if (process.env.SHIPSPACE_LOCALSTORAGE_DB) return process.env.SHIPSPACE_LOCALSTORAGE_DB;
    const root = join(homedir(), "Library", "WebKit", bundleIdForChannel(channel));
    if (!existsSync(root)) {
        throw new Error(`WebKit data dir not found: ${root}`);
    }
    const candidates: string[] = [];
    const stack = [root];
    while (stack.length) {
        const dir = stack.pop()!;
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            continue;
        }
        for (const e of entries) {
            const p = join(dir, e);
            let s;
            try {
                s = statSync(p);
            } catch {
                continue;
            }
            if (s.isDirectory()) stack.push(p);
            else if (e === "localstorage.sqlite3") candidates.push(p);
        }
    }
    if (candidates.length === 0) {
        throw new Error(`no localstorage.sqlite3 under ${root}`);
    }
    let best: { path: string; count: number; mtime: number } | null = null;
    for (const c of candidates) {
        try {
            const tmp = new Database(c, { readonly: true, fileMustExist: true });
            const row = tmp
                .prepare(
                    "SELECT count(*) AS c FROM ItemTable WHERE key LIKE 'shipspace-%'",
                )
                .get() as { c: number };
            tmp.close();
            const mtime = statSync(c).mtimeMs;
            if (
                row.c > 0 &&
                (!best ||
                    row.c > best.count ||
                    (row.c === best.count && mtime > best.mtime))
            ) {
                best = { path: c, count: row.c, mtime };
            }
        } catch {
            // skip files we can't read
        }
    }
    if (!best) {
        throw new Error(
            `no localstorage.sqlite3 under ${root} contained any shipspace-* keys — has ShipSpace ever been launched on this channel?`,
        );
    }
    return best.path;
}

const CHANNEL = process.env.SHIPSPACE_CHANNEL ?? "stable";
const DB_PATH = findLocalStorageDb(CHANNEL);
const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
db.pragma("journal_mode = WAL");

// ── Decoder ──
//
// WebKit stores localStorage values as raw UTF-16 LE bytes (no BOM, no
// length prefix). For pure-ASCII strings the high byte of each codepoint is
// zero, so the buffer is twice the visible length. We just decode utf16le.
function decodeValue(buf: Buffer): string {
    return buf.toString("utf16le");
}

interface PersistEnvelope {
    state?: unknown;
    version?: number;
}

function readKey(key: string): unknown {
    const row = db
        .prepare("SELECT value FROM ItemTable WHERE key = ?")
        .get(key) as { value: Buffer } | undefined;
    if (!row) return null;
    const text = decodeValue(row.value);
    try {
        const parsed = JSON.parse(text);
        // zustand persist wraps state in { state, version }; unwrap when present
        if (parsed && typeof parsed === "object" && "state" in (parsed as PersistEnvelope)) {
            return (parsed as PersistEnvelope).state ?? parsed;
        }
        return parsed;
    } catch {
        return text;
    }
}

function readState<T = any>(key: string): T {
    const v = readKey(key) as T;
    return (v ?? ({} as T)) as T;
}

// ── Security: state-key access control ──
//
// get_state_raw is an escape hatch the LLM can point at any localStorage key.
// Restrict it to known, non-sensitive state stores. ShipSpace also persists
// 'shipspace-api-keys' (plaintext provider keys) — that, and anything that
// looks like a credential, must never be exposed.
const ALLOWED_KEYS = new Set<string>([
    "shipspace-open-workspaces",
    "shipspace-workspace-sessions",
    "shipspace-agent-chat",
    "shipspace-gang-runs",
    "shipspace-shipgang-runs",
    "shipspace-orchestrations",
    "shipspace-prompt-library",
    "shipspace-settings",
    "shipspace-browser",
]);

const SENSITIVE_KEY_RE = /key|secret|token|password/i;

function isSensitiveKey(key: string): boolean {
    return key === "shipspace-api-keys" || SENSITIVE_KEY_RE.test(key);
}

// ── Helpers ──
function jsonResult(data: unknown) {
    return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
}

function textResult(text: string) {
    return { content: [{ type: "text" as const, text }] };
}

function asNum(v: unknown): number | undefined {
    return typeof v === "number" ? v : undefined;
}
function asStr(v: unknown): string | undefined {
    return typeof v === "string" ? v : undefined;
}

// ── Server ──
const server = new Server(
    { name: "shipspace", version: "0.1.0" },
    { capabilities: { tools: {} } },
);

const TOOLS = [
    {
        name: "list_workspaces",
        description:
            "List currently-open workspace tabs (the rows in the left sidebar). Returns id, name, color, directory, layout/layoutMode, agent count, and active pane id.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "list_saved_workspaces",
        description:
            "List saved workspace sessions (the cards in the Saved Workspaces panel on the home view). Includes id, name, directory, layout, agent map, and timestamps.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "get_workspace",
        description:
            "Fetch a single workspace by id. Searches both open tabs and saved sessions and returns the full record (panes, agentMap, scrollback metadata).",
        inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
        },
    },
    {
        name: "list_gangs",
        description:
            "List ShipGang sessions (legacy multi-agent gangs in the sidebar Gangs section).",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "list_shipgang_runs",
        description:
            "List ShipGang runs with status, progress, last verdict, and parent session name.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "list_chats",
        description:
            "List saved agent-chat conversations across all workspaces. Returns id, title, message count, and the workspace they belong to.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "get_chat",
        description: "Get a single chat conversation by id, including all messages.",
        inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
        },
    },
    {
        name: "list_orchestrations",
        description: "List saved orchestrator sessions (titles, plan rationale, completed-step counts).",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "list_prompts",
        description: "List entries from the user's ShipSpace prompt library.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "get_settings",
        description: "Return user settings (theme, providers, keyboard shortcuts, etc.).",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "list_state_keys",
        description:
            "List every persisted zustand store key in ShipSpace's localStorage. Useful for discovery before calling get_state_raw.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "get_state_raw",
        description:
            "Escape-hatch: read any persisted localStorage key directly. Pass key (e.g. 'shipspace-browser') to get the parsed JSON. Use list_state_keys to discover what's available.",
        inputSchema: {
            type: "object",
            properties: { key: { type: "string" } },
            required: ["key"],
            additionalProperties: false,
        },
    },
    {
        name: "info",
        description: "Return which localstorage.sqlite3 the server is reading and the channel it resolved.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

function summarizeWorkspace(ws: any) {
    const agentMap = (ws?.agentMap ?? {}) as Record<string, string>;
    return {
        id: ws?.id,
        name: ws?.name,
        color: ws?.color,
        directory: ws?.directory,
        layout: ws?.layout,
        layoutMode: ws?.layoutMode,
        activePaneId: ws?.activePaneId,
        activeTab: ws?.activeTab,
        paneCount: Object.keys(agentMap).length,
        agents: agentMap,
    };
}

function summarizeSession(s: any) {
    const agentMap = (s?.agentMap ?? {}) as Record<string, string>;
    return {
        id: s?.id,
        name: s?.name,
        color: s?.color,
        directory: s?.directory,
        layout: s?.layout,
        layoutMode: s?.layoutMode,
        paneCount: Object.keys(agentMap).length,
        agents: agentMap,
        createdAt: s?.createdAt,
        updatedAt: s?.updatedAt,
    };
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;

    switch (req.params.name) {
        case "list_workspaces": {
            const state = readState<any>("shipspace-open-workspaces");
            const workspaces = (state?.workspaces ?? []) as any[];
            return jsonResult({
                activeWorkspaceId: state?.activeWorkspaceId ?? null,
                count: workspaces.length,
                workspaces: workspaces.map(summarizeWorkspace),
            });
        }

        case "list_saved_workspaces": {
            const state = readState<any>("shipspace-workspace-sessions");
            const sessions = (state?.sessions ?? []) as any[];
            return jsonResult({
                count: sessions.length,
                sessions: sessions.map(summarizeSession),
            });
        }

        case "get_workspace": {
            const id = asStr(args.id);
            if (!id) return textResult("error: id is required");
            const open = readState<any>("shipspace-open-workspaces");
            const ws = (open?.workspaces ?? []).find((w: any) => w?.id === id);
            if (ws) return jsonResult({ source: "open", workspace: ws });
            const saved = readState<any>("shipspace-workspace-sessions");
            const sess = (saved?.sessions ?? []).find(
                (s: any) => s?.id === id || s?.id === `ws-session-${id}`,
            );
            if (sess) return jsonResult({ source: "saved", session: sess });
            return textResult(`error: no workspace or session with id ${id}`);
        }

        case "list_gangs": {
            const state = readState<any>("shipspace-gang-runs");
            const gangs = (state?.gangs ?? []) as any[];
            return jsonResult({
                activeGangId: state?.activeGangId ?? null,
                count: gangs.length,
                gangs: gangs.map((g) => ({
                    id: g?.id,
                    name: g?.name,
                    agents: (g?.agents ?? []).map((a: any) => ({
                        id: a?.id,
                        name: a?.name,
                        status: a?.status,
                    })),
                })),
            });
        }

        case "list_shipgang_runs": {
            const state = readState<any>("shipspace-shipgang-runs");
            const runs = (state?.runs ?? []) as any[];
            const sessions = (state?.sessions ?? []) as any[];
            const sessionById = new Map(sessions.map((s: any) => [s?.id, s]));
            const enriched = runs.map((r) => {
                const parent = sessions.find((s: any) =>
                    (s?.runIds ?? []).includes(r?.id),
                );
                return {
                    id: r?.id,
                    sessionId: parent?.id ?? null,
                    sessionName: parent?.name ?? null,
                    status: r?.status,
                    progress: r?.progress,
                    lastVerdict: r?.lastVerdict ?? parent?.lastVerdict ?? null,
                    startedAt: r?.startedAt,
                };
            });
            return jsonResult({
                activeRunId: state?.activeRunId ?? null,
                runs: enriched,
                sessionCount: sessionById.size,
            });
        }

        case "list_chats": {
            const state = readState<any>("shipspace-agent-chat");
            const conversations = (state?.conversations ?? []) as any[];
            return jsonResult({
                count: conversations.length,
                conversations: conversations.map((c) => ({
                    id: c?.id,
                    title: c?.title,
                    workspaceId: c?.workspaceId ?? null,
                    paneId: c?.paneId ?? null,
                    messageCount: (c?.messages ?? []).length,
                    updatedAt: c?.updatedAt,
                })),
            });
        }

        case "get_chat": {
            const id = asStr(args.id);
            if (!id) return textResult("error: id is required");
            const state = readState<any>("shipspace-agent-chat");
            const conv = (state?.conversations ?? []).find((c: any) => c?.id === id);
            if (!conv) return textResult(`error: no conversation with id ${id}`);
            return jsonResult(conv);
        }

        case "list_orchestrations": {
            const state = readState<any>("shipspace-orchestrations");
            const sessions = (state?.sessions ?? []) as any[];
            return jsonResult({
                activeSessionId: state?.activeSessionId ?? null,
                count: sessions.length,
                sessions: sessions.map((s) => {
                    const history = (s?.snapshot?.history ?? {}) as Record<string, any>;
                    const done = Object.values(history).filter(
                        (h: any) => h?.status === "done",
                    ).length;
                    return {
                        id: s?.id,
                        title: s?.title,
                        rationale: s?.snapshot?.rationale ?? null,
                        steps: Object.keys(history).length,
                        doneSteps: done,
                        updatedAt: s?.updatedAt,
                    };
                }),
            });
        }

        case "list_prompts": {
            const state = readState<any>("shipspace-prompt-library");
            return jsonResult(state);
        }

        case "get_settings": {
            const state = readState<any>("shipspace-settings");
            return jsonResult(state);
        }

        case "list_state_keys": {
            const rows = db
                .prepare("SELECT key FROM ItemTable ORDER BY key ASC")
                .all() as Array<{ key: string }>;
            return jsonResult(
                rows.map((r) => r.key).filter((k) => !isSensitiveKey(k)),
            );
        }

        case "get_state_raw": {
            const key = asStr(args.key);
            if (!key) return textResult("error: key is required");
            if (isSensitiveKey(key) || !ALLOWED_KEYS.has(key)) {
                return textResult(`error: key not permitted: ${key}`);
            }
            const v = readKey(key);
            if (v === null) return textResult(`error: no value for key ${key}`);
            return jsonResult({ key, value: v });
        }

        case "info": {
            return jsonResult({
                channel: CHANNEL,
                bundleId: bundleIdForChannel(CHANNEL),
                dbPath: DB_PATH,
            });
        }

        default:
            return textResult(`error: unknown tool ${req.params.name}`);
    }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[shipspace-mcp] connected (channel=${CHANNEL}, db=${DB_PATH})`);
