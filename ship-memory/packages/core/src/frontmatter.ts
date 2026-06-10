/**
 * Minimal, dependency-free frontmatter parse/serialize.
 *
 * We support a pragmatic YAML *subset* — scalars, quoted strings, inline
 * `[a, b]` arrays, and booleans/numbers. That covers the metadata Ship Memory
 * actually writes (type, tags, source, dates) without pulling a YAML dep into
 * the portable core. Anything fancier round-trips as a raw string.
 */

export interface ParsedDoc {
  frontmatter: Record<string, unknown>;
  body: string;
}

const DELIM = "---";

export function parseFrontmatter(raw: string): ParsedDoc {
  const text = raw.startsWith("﻿") ? raw.slice(1) : raw;
  if (!text.startsWith(DELIM)) return { frontmatter: {}, body: text };

  // Find the closing delimiter on its own line.
  const lines = text.split("\n");
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === DELIM) {
      end = i;
      break;
    }
  }
  if (end === -1) return { frontmatter: {}, body: text };

  const fmLines = lines.slice(1, end);
  const body = lines.slice(end + 1).join("\n").replace(/^\n/, "");

  const frontmatter: Record<string, unknown> = {};
  for (const line of fmLines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawVal = line.slice(idx + 1).trim();
    frontmatter[key] = coerce(rawVal);
  }
  return { frontmatter, body };
}

export function serializeFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const keys = Object.keys(frontmatter);
  if (keys.length === 0) return body.endsWith("\n") ? body : body + "\n";

  const out: string[] = [DELIM];
  for (const key of keys) {
    // A newline, carriage return, or ':' in a key would inject extra YAML
    // lines or a premature delimiter — reject rather than corrupt the doc.
    if (/[\n\r:]/.test(key)) {
      throw new Error(`Invalid frontmatter key: ${JSON.stringify(key)}`);
    }
    out.push(`${key}: ${encode(frontmatter[key])}`);
  }
  out.push(DELIM, "");
  const head = out.join("\n");
  return head + "\n" + (body.endsWith("\n") ? body : body + "\n");
}

function coerce(v: string): unknown {
  if (v === "") return "";
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((s) => coerce(s.trim()));
  }
  return v;
}

function encode(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return `[${v.map(encode).join(", ")}]`;
  const s = String(v);
  // Quote when the value could be misread as something structured, or when it
  // contains a newline/carriage return that would inject YAML lines or a
  // premature '---' delimiter.
  if (/[\n\r]/.test(s) || /^[\s]|[\s]$|:|#|^[-?[]|^(true|false|null|~)$|^-?\d/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}
