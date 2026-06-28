/**
 * Markdown formatting commands for the notepad editor.
 *
 * Notes are stored as plain markdown, so every Apple-Notes-style control maps
 * to a text transform: B/I/U/S wrap the selection in markers, paragraph styles
 * rewrite line prefixes, lists toggle per-line prefixes. The editor shows the
 * raw markdown — what you see is what's on disk.
 */

import { EditorSelection, type ChangeSpec } from "@codemirror/state";
import { EditorView, type KeyBinding } from "@codemirror/view";

/** Wrap/unwrap each selection range in inline markers (e.g. `**` for bold). */
export function toggleInline(
  view: EditorView,
  open: string,
  close = open,
): boolean {
  const tr = view.state.changeByRange((range) => {
    const { from, to } = range;
    const doc = view.state.doc;
    const before = doc.sliceString(Math.max(0, from - open.length), from);
    const after = doc.sliceString(to, Math.min(doc.length, to + close.length));
    const inner = doc.sliceString(from, to);

    // Markers just outside the selection → remove them.
    if (before === open && after === close) {
      return {
        changes: [
          { from: from - open.length, to: from },
          { from: to, to: to + close.length },
        ],
        range: EditorSelection.range(from - open.length, to - open.length),
      };
    }
    // Markers inside the selection → remove them.
    if (
      inner.length >= open.length + close.length &&
      inner.startsWith(open) &&
      inner.endsWith(close)
    ) {
      return {
        changes: [
          { from, to: from + open.length },
          { from: to - close.length, to },
        ],
        range: EditorSelection.range(from, to - open.length - close.length),
      };
    }
    // Otherwise wrap. An empty selection gets the pair with the cursor inside.
    return {
      changes: [
        { from, insert: open },
        { from: to, insert: close },
      ],
      range: EditorSelection.range(from + open.length, to + open.length),
    };
  });
  view.dispatch(tr, { scrollIntoView: true, userEvent: "input" });
  view.focus();
  return true;
}

export const toggleBold = (v: EditorView) => toggleInline(v, "**");
export const toggleItalic = (v: EditorView) => toggleInline(v, "*");
export const toggleUnderline = (v: EditorView) => toggleInline(v, "<u>", "</u>");
export const toggleStrike = (v: EditorView) => toggleInline(v, "~~");
export const toggleHighlight = (v: EditorView) => toggleInline(v, "==");

/** Run `fn` over every line touched by the selection; apply changed lines. */
function changeLines(
  view: EditorView,
  fn: (text: string, index: number) => string,
): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const seen = new Set<number>();
  let index = 0;
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) {
      if (seen.has(n)) continue;
      seen.add(n);
      const line = state.doc.line(n);
      const next = fn(line.text, index++);
      if (next !== line.text) {
        changes.push({ from: line.from, to: line.to, insert: next });
      }
    }
  }
  if (changes.length) view.dispatch({ changes, userEvent: "input" });
  view.focus();
  return true;
}

/** Any list/quote prefix Apple Notes-style controls can produce. */
const LIST_PREFIX_RE = /^(\s*)(?:[-*+]\s\[[ xX]\]\s|[-*+]\s|–\s|\d+[.)]\s|>\s)/;
const HEADING_PREFIX_RE = /^\s*#{1,6}\s+/;

export type BlockStyle = "title" | "heading" | "subheading" | "body" | "mono";

const HEADING_FOR: Record<Exclude<BlockStyle, "mono">, string> = {
  title: "# ",
  heading: "## ",
  subheading: "### ",
  body: "",
};

/** Paragraph style à la the Aa menu. `mono` fences the selected lines. */
export function setBlockStyle(view: EditorView, style: BlockStyle): boolean {
  if (style === "mono") return toggleCodeFence(view);
  const prefix = HEADING_FOR[style];
  return changeLines(view, (text) =>
    text.trim() === "" ? text : prefix + text.replace(HEADING_PREFIX_RE, ""),
  );
}

/** Style of the line under the main cursor — drives the menu checkmark. */
export function blockStyleAt(view: EditorView): BlockStyle {
  const line = view.state.doc.lineAt(view.state.selection.main.head).text;
  const m = line.match(/^\s*(#{1,6})\s/);
  if (!m) return "body";
  return m[1].length === 1 ? "title" : m[1].length === 2 ? "heading" : "subheading";
}

function toggleCodeFence(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  const first = state.doc.lineAt(range.from);
  const last = state.doc.lineAt(range.to);
  view.dispatch({
    changes: [
      { from: first.from, insert: "```\n" },
      { from: last.to, insert: "\n```" },
    ],
    userEvent: "input",
  });
  view.focus();
  return true;
}

export type ListStyle = "bullet" | "dash" | "number" | "check" | "quote";

const LIST_FOR: Record<ListStyle, (i: number) => string> = {
  bullet: () => "- ",
  // Apple's dashed list: a literal dash, plain text in the raw markdown.
  dash: () => "– ",
  number: (i) => `${i + 1}. `,
  check: () => "- [ ] ",
  quote: () => "> ",
};

/** Toggle a list/quote prefix: if every selected line has it, strip it. */
export function setListStyle(view: EditorView, style: ListStyle): boolean {
  const { state } = view;
  const range = state.selection.main;
  const first = state.doc.lineAt(range.from).number;
  const last = state.doc.lineAt(range.to).number;
  let allHave = true;
  for (let n = first; n <= last; n++) {
    const text = state.doc.line(n).text;
    if (text.trim() === "") continue;
    const m = text.match(LIST_PREFIX_RE);
    if (!m || !prefixMatches(m[0].trimStart(), style)) {
      allHave = false;
      break;
    }
  }
  return changeLines(view, (text, i) => {
    if (text.trim() === "") return text;
    const stripped = text.replace(LIST_PREFIX_RE, "$1");
    if (allHave) return stripped;
    const indent = stripped.match(/^\s*/)![0];
    return indent + LIST_FOR[style](i) + stripped.slice(indent.length);
  });
}

function prefixMatches(prefix: string, style: ListStyle): boolean {
  switch (style) {
    case "check":
      return /^[-*+]\s\[/.test(prefix);
    case "bullet":
      return /^[-*+]\s(?!\[)/.test(prefix);
    case "dash":
      return prefix.startsWith("–");
    case "number":
      return /^\d/.test(prefix);
    case "quote":
      return prefix.startsWith(">");
  }
}

/** Insert a 2×2 markdown table skeleton on its own lines at the cursor. */
export function insertTable(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const table = "| Column | Column |\n| --- | --- |\n|  |  |";
  const insert = (line.text ? "\n" : "") + table + "\n";
  view.dispatch({
    changes: { from: line.to, insert },
    selection: { anchor: line.to + insert.indexOf("Column") + 1 },
    userEvent: "input",
  });
  view.focus();
  return true;
}

/** Insert text at the cursor (used for attachment links). */
export function insertAtCursor(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    userEvent: "input",
  });
  view.focus();
}

/** ⌘B / ⌘I / ⌘U / ⇧⌘X (strikethrough) / ⇧⌘H (highlight). */
export const formatKeymap: KeyBinding[] = [
  { key: "Mod-b", run: toggleBold },
  { key: "Mod-i", run: toggleItalic },
  { key: "Mod-u", run: toggleUnderline },
  { key: "Mod-Shift-x", run: toggleStrike },
  { key: "Mod-Shift-h", run: toggleHighlight },
];
