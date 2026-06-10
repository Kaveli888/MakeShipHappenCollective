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

// ── DB resolution ──
//
// ShipTalk persists transcription history and prefs into the WebView's
// localStorage at ~/Library/WebKit/com.makeshiphappen.shiptalk/.../localstorage.sqlite3.
// The WebKit per-origin folder name is unstable, so we scan and pick the file
// containing the most ShipTalk-shaped keys (e.g. shiptalk-history).

const BUNDLE_ID = "com.makeshiphappen.shiptalk";

function findLocalStorageDb(): string {
    if (process.env.SHIPTALK_LOCALSTORAGE_DB) return process.env.SHIPTALK_LOCALSTORAGE_DB;
    const root = join(homedir(), "Library", "WebKit", BUNDLE_ID);
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
    let best: { path: string; score: number; mtime: number } | null = null;
    for (const c of candidates) {
        try {
            const tmp = new Database(c, { readonly: true, fileMustExist: true });
            const row = tmp
                .prepare(
                    `SELECT count(*) AS c FROM ItemTable
                     WHERE key IN ('shiptalk-history','shiptalk-onboarded','selected-model','selected-theme')
                        OR key LIKE 'enhancement-%'
                        OR key LIKE 'shortcut-%'`,
                )
                .get() as { c: number };
            tmp.close();
            const mtime = statSync(c).mtimeMs;
            if (
                row.c > 0 &&
                (!best ||
                    row.c > best.score ||
                    (row.c === best.score && mtime > best.mtime))
            ) {
                best = { path: c, score: row.c, mtime };
            }
        } catch {
            // skip
        }
    }
    if (!best) {
        throw new Error(
            `no localstorage.sqlite3 under ${root} contained any ShipTalk keys — has ShipTalk ever been launched on this machine?`,
        );
    }
    return best.path;
}

const DB_PATH = findLocalStorageDb();
const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
db.pragma("journal_mode = WAL");

// ── Decoder ──
function decodeValue(buf: Buffer): string {
    return buf.toString("utf16le");
}

function readKey(key: string): unknown {
    const row = db
        .prepare("SELECT value FROM ItemTable WHERE key = ?")
        .get(key) as { value: Buffer } | undefined;
    if (!row) return null;
    const text = decodeValue(row.value);
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

interface Transcript {
    id: string;
    text: string;
    wordCount: number;
    durationSeconds: number;
    timestamp: string;
}

function loadHistory(): Transcript[] {
    const v = readKey("shiptalk-history");
    return Array.isArray(v) ? (v as Transcript[]) : [];
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
function preview(text: string, max = 160): string {
    const oneLine = text.replace(/\s+/g, " ").trim();
    return oneLine.length <= max ? oneLine : oneLine.slice(0, max) + "…";
}

// ── Server ──
const server = new Server(
    { name: "shiptalk", version: "0.1.0" },
    { capabilities: { tools: {} } },
);

const TOOLS = [
    {
        name: "stats",
        description:
            "Summarize ShipTalk transcription history: total count, total words and minutes spoken, and the date range.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "list_transcripts",
        description:
            "List ShipTalk transcripts (most recent first) with id, timestamp, wordCount, durationSeconds, and a short preview. Use limit and offset for paging.",
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "number",
                    description: "Max rows (default 50, max 500).",
                },
                offset: { type: "number", description: "Skip this many. Default 0." },
            },
            additionalProperties: false,
        },
    },
    {
        name: "recent_transcripts",
        description:
            "Return the N most recent transcripts with full text. Defaults to 10, max 100.",
        inputSchema: {
            type: "object",
            properties: { limit: { type: "number" } },
            additionalProperties: false,
        },
    },
    {
        name: "get_transcript",
        description: "Get a single transcript by id, including full text.",
        inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
        },
    },
    {
        name: "search_transcripts",
        description:
            "Case-insensitive substring search across all transcript text. Returns matches with a snippet around each hit.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string" },
                limit: { type: "number", description: "Max hits (default 30, max 200)." },
            },
            required: ["query"],
            additionalProperties: false,
        },
    },
    {
        name: "transcripts_in_range",
        description:
            "Return transcripts whose timestamp falls between two ISO-8601 instants (inclusive). Either bound may be omitted to leave it open.",
        inputSchema: {
            type: "object",
            properties: {
                from: { type: "string", description: "ISO timestamp lower bound" },
                to: { type: "string", description: "ISO timestamp upper bound" },
                limit: { type: "number" },
            },
            additionalProperties: false,
        },
    },
    {
        name: "get_settings",
        description:
            "Return current ShipTalk preferences: selected model, theme, audio device, enhancement mode/prompt, polish toggle, and shortcuts.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "list_state_keys",
        description: "List every key present in ShipTalk's localStorage.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
        name: "get_state_raw",
        description:
            "Read any localStorage key directly. Use list_state_keys to discover what's available.",
        inputSchema: {
            type: "object",
            properties: { key: { type: "string" } },
            required: ["key"],
            additionalProperties: false,
        },
    },
    {
        name: "info",
        description: "Return the localstorage.sqlite3 path the server is reading.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;

    switch (req.params.name) {
        case "stats": {
            const history = loadHistory();
            const totalWords = history.reduce(
                (a, t) => a + (typeof t.wordCount === "number" ? t.wordCount : 0),
                0,
            );
            const totalSeconds = history.reduce(
                (a, t) => a + (typeof t.durationSeconds === "number" ? t.durationSeconds : 0),
                0,
            );
            const sorted = [...history].sort((a, b) =>
                String(a.timestamp).localeCompare(String(b.timestamp)),
            );
            return jsonResult({
                count: history.length,
                totalWords,
                totalSeconds,
                totalMinutes: Math.round(totalSeconds / 60),
                earliest: sorted[0]?.timestamp ?? null,
                latest: sorted[sorted.length - 1]?.timestamp ?? null,
            });
        }

        case "list_transcripts": {
            const limit = Math.min(asNum(args.limit) ?? 50, 500);
            const offset = Math.max(asNum(args.offset) ?? 0, 0);
            const history = loadHistory().slice().sort((a, b) =>
                String(b.timestamp).localeCompare(String(a.timestamp)),
            );
            const page = history.slice(offset, offset + limit);
            return jsonResult({
                total: history.length,
                offset,
                limit,
                transcripts: page.map((t) => ({
                    id: t.id,
                    timestamp: t.timestamp,
                    wordCount: t.wordCount,
                    durationSeconds: t.durationSeconds,
                    preview: preview(t.text ?? ""),
                })),
            });
        }

        case "recent_transcripts": {
            const limit = Math.min(asNum(args.limit) ?? 10, 100);
            const history = loadHistory().slice().sort((a, b) =>
                String(b.timestamp).localeCompare(String(a.timestamp)),
            );
            return jsonResult(history.slice(0, limit));
        }

        case "get_transcript": {
            const id = asStr(args.id);
            if (!id) return textResult("error: id is required");
            const t = loadHistory().find((x) => x.id === id);
            if (!t) return textResult(`error: no transcript with id ${id}`);
            return jsonResult(t);
        }

        case "search_transcripts": {
            const query = asStr(args.query);
            if (!query) return textResult("error: query is required");
            const limit = Math.min(asNum(args.limit) ?? 30, 200);
            const needle = query.toLowerCase();
            const hits: any[] = [];
            const history = loadHistory();
            for (const t of history) {
                const text = String(t.text ?? "");
                const idx = text.toLowerCase().indexOf(needle);
                if (idx < 0) continue;
                hits.push({
                    id: t.id,
                    timestamp: t.timestamp,
                    wordCount: t.wordCount,
                    snippet: preview(
                        text.slice(Math.max(0, idx - 80), idx + needle.length + 160),
                        300,
                    ),
                });
                if (hits.length >= limit) break;
            }
            return jsonResult({ query, hits });
        }

        case "transcripts_in_range": {
            const from = asStr(args.from);
            const to = asStr(args.to);
            const limit = Math.min(asNum(args.limit) ?? 100, 1000);
            const history = loadHistory().filter((t) => {
                const ts = String(t.timestamp);
                if (from && ts < from) return false;
                if (to && ts > to) return false;
                return true;
            });
            history.sort((a, b) =>
                String(b.timestamp).localeCompare(String(a.timestamp)),
            );
            return jsonResult({
                from: from ?? null,
                to: to ?? null,
                count: history.length,
                transcripts: history.slice(0, limit),
            });
        }

        case "get_settings": {
            const keys = [
                "selected-model",
                "selected-theme",
                "audio-input-device",
                "enhancement-mode",
                "enhancement-custom-prompt",
                "polish-enabled",
                "cloud-features-enabled",
                "shortcut-ptt",
                "shortcut-toggle",
                "type-to-app",
                "widget-appearance",
                "shiptalk-onboarded",
            ];
            const out: Record<string, unknown> = {};
            for (const k of keys) out[k] = readKey(k);
            return jsonResult(out);
        }

        case "list_state_keys": {
            const rows = db
                .prepare("SELECT key FROM ItemTable ORDER BY key ASC")
                .all() as Array<{ key: string }>;
            return jsonResult(rows.map((r) => r.key));
        }

        case "get_state_raw": {
            const key = asStr(args.key);
            if (!key) return textResult("error: key is required");
            const v = readKey(key);
            if (v === null) return textResult(`error: no value for key ${key}`);
            return jsonResult({ key, value: v });
        }

        case "info": {
            return jsonResult({ bundleId: BUNDLE_ID, dbPath: DB_PATH });
        }

        default:
            return textResult(`error: unknown tool ${req.params.name}`);
    }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[shiptalk-mcp] connected (db=${DB_PATH})`);
