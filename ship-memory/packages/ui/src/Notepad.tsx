import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MemoryMeta, ShipMemory } from "@ship-memory/core";
import { FolderSidebar, folderOf } from "./FolderSidebar";
import { NotesList, listOrder, type SortMode } from "./NotesList";
import { NotePane } from "./NotePane";
import type { AttachmentOpener } from "./attachments";
import { GraphView } from "./GraphView";
import {
  IconCalendar,
  IconChevronDown,
  IconFileSearch,
  IconGraph,
  IconPanelLeft,
  IconPanelRight,
  IconPlus,
  IconX,
} from "./icons";
import "./notepad.css";

export interface NotepadProps {
  engine: ShipMemory;
  /**
   * Bump whenever the vault changed on disk (host's fs watcher). The list
   * always refreshes; open notes only reload when their on-disk content
   * actually differs from what the editor already has, so our own autosaves
   * never reset the cursor.
   */
  vaultVersion?: number;
  /**
   * Host viewer for image/video attachments (e.g. a separate Tauri window).
   * Return true if handled; false/absent falls back to the in-page lightbox.
   */
  onOpenAttachment?: AttachmentOpener;
  /** Optional host app mark shown in the static window chrome. */
  appLogoSrc?: string;
}

/** One open view — a note (with its own back/forward history) or the graph. */
interface Tab {
  id: string;
  kind: "note" | "graph";
  /** Slug history for back/forward; empty = blank "New tab". */
  history: string[];
  hIndex: number;
}

/** A tab group = one Obsidian-style pane column with its own tab strip. */
interface TabGroup {
  id: string;
  tabs: Tab[];
  activeId: string | null;
}

class PaneErrorBoundary extends Component<
  { children: ReactNode; title: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`ShipMemory pane failed: ${this.props.title}`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="smui-empty">
          <p>{this.props.title} is unavailable</p>
          <p className="smui-empty-hint">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

let uidSeq = 0;
const uid = () => `t${Date.now().toString(36)}-${++uidSeq}`;

const tabSlug = (t: Tab): string | null =>
  t.kind === "note" ? (t.history[t.hIndex] ?? null) : null;

function readStored(key: string): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function uniqueFolderPath(path: string, folders: string[]): string {
  const taken = new Set(folders);
  if (!taken.has(path)) return path;
  let n = 2;
  while (taken.has(`${path} ${n}`)) n++;
  return `${path} ${n}`;
}

/** Rehydrate the tab layout, dropping slugs that no longer exist on disk. */
function restoreGroups(
  validSlugs: Set<string>,
): { groups: TabGroup[]; focusedId: string } | null {
  try {
    const raw = window.localStorage.getItem("smui-tabs");
    if (!raw) return null;
    const v = JSON.parse(raw) as {
      focused?: number;
      groups?: { active?: number; tabs?: { kind?: string; history?: unknown; hIndex?: number }[] }[];
    };
    if (!Array.isArray(v?.groups)) return null;
    const groups: TabGroup[] = [];
    for (const g of v.groups) {
      if (!Array.isArray(g?.tabs)) continue;
      const tabs: Tab[] = [];
      for (const t of g.tabs) {
        if (t?.kind === "graph") {
          tabs.push({ id: uid(), kind: "graph", history: [], hIndex: 0 });
          continue;
        }
        if (t?.kind !== "note" || !Array.isArray(t.history)) continue;
        const history = t.history.filter(
          (s): s is string => typeof s === "string" && validSlugs.has(s),
        );
        tabs.push({
          id: uid(),
          kind: "note",
          history,
          hIndex: Math.max(0, Math.min(history.length - 1, t.hIndex ?? 0)),
        });
      }
      if (tabs.length) {
        const active = Math.max(0, Math.min(tabs.length - 1, g.active ?? 0));
        groups.push({ id: uid(), tabs, activeId: tabs[active].id });
      }
    }
    if (!groups.length) return null;
    const focused = Math.max(0, Math.min(groups.length - 1, v.focused ?? 0));
    return { groups, focusedId: groups[focused].id };
  } catch {
    return null;
  }
}

export function Notepad({
  engine,
  vaultVersion = 0,
  onOpenAttachment,
  appLogoSrc,
}: NotepadProps) {
  const [metas, setMetas] = useState<MemoryMeta[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemoryMeta[] | null>(null);
  // Folder column state. null folder = All Notes. Empty (note-less) folders
  // and collapse state have nowhere to live on disk, so they persist locally.
  const [folder, setFolder] = useState<string | null>(null);
  const [extraFolders, setExtraFolders] = useState<string[]>(() =>
    readStored("smui-folders"),
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(readStored("smui-collapsed")),
  );
  const [sortMode, setSortMode] = useState<SortMode>(() =>
    window.localStorage.getItem("smui-sort") === "title" ? "title" : "modified",
  );
  // Each left column collapses on its own. Legacy "smui-sidebar=hidden" (one
  // toggle that hid both) seeds both columns so existing installs don't jump.
  const [foldersHidden, setFoldersHidden] = useState(
    () =>
      window.localStorage.getItem("smui-folders-hidden") === "1" ||
      window.localStorage.getItem("smui-sidebar") === "hidden",
  );
  const [listHidden, setListHidden] = useState(
    () =>
      window.localStorage.getItem("smui-list-hidden") === "1" ||
      window.localStorage.getItem("smui-sidebar") === "hidden",
  );
  // Obsidian-style workspace: 1–2 tab groups, each with its own tab strip.
  const [groups, setGroups] = useState<TabGroup[]>(() => [
    { id: "g-init", tabs: [], activeId: null },
  ]);
  const [focusedGroupId, setFocusedGroupId] = useState("g-init");
  // Bumped to force every open pane to flush pending edits to disk.
  const [saveSignal, setSaveSignal] = useState(0);

  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const focusedRef = useRef(focusedGroupId);
  focusedRef.current = focusedGroupId;
  const metasRef = useRef(metas);
  metasRef.current = metas;
  const readyRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(async () => {
    setMetas(await engine.list());
  }, [engine]);

  // ── list multi-selection (Apple-Notes mass select) ───────────────────────
  // The set of highlighted rows; ⇧-click and ⇧↑/⇧↓ grow it as a contiguous
  // range between an anchor (where selection started) and a cursor (the
  // moving end). Refs keep the handlers stable across renders.
  const [listSel, setListSel] = useState<ReadonlySet<string>>(new Set());
  // Only this slug's editor grabs focus on load (⌘N / daily note) — plain
  // list navigation keeps focus in the list so ⇧↓ keeps extending.
  const [autoFocusSlug, setAutoFocusSlug] = useState<string | null>(null);
  const listSelRef = useRef(listSel);
  listSelRef.current = listSel;
  const selAnchorRef = useRef<string | null>(null);
  const selCursorRef = useRef<string | null>(null);
  const orderedRef = useRef<string[]>([]);
  const selectedSlugRef = useRef<string | null>(null);

  // ── tab orchestration ────────────────────────────────────────────────────

  const openNoteInGroup = useCallback(
    (groupId: string, slug: string, newTab: boolean) => {
      setGroups((gs) => {
        const gi = gs.findIndex((g) => g.id === groupId);
        const g = gs[gi];
        if (!g) return gs;
        const active = g.tabs.find((t) => t.id === g.activeId);
        let tabs: Tab[];
        let activeId: string;
        if (!newTab && active && active.kind === "note") {
          if (tabSlug(active) === slug) return gs;
          // Navigate in place: truncate forward history, push the new slug.
          const history = [...active.history.slice(0, active.hIndex + 1), slug];
          tabs = g.tabs.map((t) =>
            t.id === active.id
              ? { ...t, history, hIndex: history.length - 1 }
              : t,
          );
          activeId = active.id;
        } else {
          const t: Tab = { id: uid(), kind: "note", history: [slug], hIndex: 0 };
          tabs = [...g.tabs, t];
          activeId = t.id;
        }
        return gs.map((x, i) => (i === gi ? { ...x, tabs, activeId } : x));
      });
      setFocusedGroupId(groupId);
    },
    [],
  );

  const openNote = useCallback(
    (slug: string, newTab: boolean) => {
      const gs = groupsRef.current;
      const gid = gs.some((g) => g.id === focusedRef.current)
        ? focusedRef.current
        : gs[0]?.id;
      if (gid) openNoteInGroup(gid, slug, newTab);
    },
    [openNoteInGroup],
  );

  // Ribbon graph button: focus an existing graph tab, else open one in a
  // right-hand split (the Obsidian default layout from the reference shot).
  const openGraph = useCallback(() => {
    const gs = groupsRef.current;
    for (const g of gs) {
      const t = g.tabs.find((x) => x.kind === "graph");
      if (t) {
        setGroups((cur) =>
          cur.map((x) => (x.id === g.id ? { ...x, activeId: t.id } : x)),
        );
        setFocusedGroupId(g.id);
        return;
      }
    }
    const t: Tab = { id: uid(), kind: "graph", history: [], hIndex: 0 };
    if (gs.length === 1) {
      const g: TabGroup = { id: uid(), tabs: [t], activeId: t.id };
      setGroups((cur) => [...cur, g]);
      setFocusedGroupId(g.id);
    } else {
      const last = gs[gs.length - 1];
      setGroups((cur) =>
        cur.map((x) =>
          x.id === last.id ? { ...x, tabs: [...x.tabs, t], activeId: t.id } : x,
        ),
      );
      setFocusedGroupId(last.id);
    }
  }, []);

  // Clicking a graph node opens the note in a note-bearing group (so the
  // graph stays visible in its split), like Obsidian's "open in active leaf".
  const openNoteFromGraph = useCallback(
    (slug: string) => {
      const gs = groupsRef.current;
      const ordered = [...gs].sort((a, b) =>
        a.id === focusedRef.current ? -1 : b.id === focusedRef.current ? 1 : 0,
      );
      const target =
        ordered.find(
          (g) => g.tabs.find((t) => t.id === g.activeId)?.kind === "note",
        ) ?? ordered.find((g) => g.tabs.some((t) => t.kind === "note"));
      if (target) openNoteInGroup(target.id, slug, false);
      else if (gs[0]) openNoteInGroup(gs[0].id, slug, true);
    },
    [openNoteInGroup],
  );

  const activateTab = useCallback((groupId: string, tabId: string) => {
    setGroups((gs) =>
      gs.map((g) => (g.id === groupId ? { ...g, activeId: tabId } : g)),
    );
    setFocusedGroupId(groupId);
  }, []);

  const closeTab = useCallback((groupId: string, tabId: string) => {
    setGroups((gs) => {
      let next = gs.map((g) => {
        if (g.id !== groupId) return g;
        const idx = g.tabs.findIndex((t) => t.id === tabId);
        if (idx === -1) return g;
        const tabs = g.tabs.filter((t) => t.id !== tabId);
        const activeId =
          g.activeId === tabId
            ? ((tabs[idx] ?? tabs[idx - 1])?.id ?? null)
            : g.activeId;
        return { ...g, tabs, activeId };
      });
      // An emptied split collapses away; the last group stays as a blank pane.
      if (next.length > 1) next = next.filter((g) => g.tabs.length > 0);
      if (!next.length) next = [{ id: uid(), tabs: [], activeId: null }];
      return next;
    });
  }, []);

  const newTabIn = useCallback((groupId: string) => {
    const t: Tab = { id: uid(), kind: "note", history: [], hIndex: 0 };
    setGroups((gs) =>
      gs.map((g) =>
        g.id === groupId ? { ...g, tabs: [...g.tabs, t], activeId: t.id } : g,
      ),
    );
    setFocusedGroupId(groupId);
  }, []);

  const navigateHistory = useCallback(
    (groupId: string, tabId: string, delta: number) => {
      setGroups((gs) =>
        gs.map((g) =>
          g.id !== groupId
            ? g
            : {
                ...g,
                tabs: g.tabs.map((t) =>
                  t.id !== tabId
                    ? t
                    : {
                        ...t,
                        hIndex: Math.max(
                          0,
                          Math.min(t.history.length - 1, t.hIndex + delta),
                        ),
                      },
                ),
              },
        ),
      );
    },
    [],
  );

  // Keep focus on a group that still exists.
  useEffect(() => {
    if (!groups.some((g) => g.id === focusedGroupId) && groups[0]) {
      setFocusedGroupId(groups[0].id);
    }
  }, [groups, focusedGroupId]);

  // Drop deleted notes out of every tab history (agent/Obsidian deletes too).
  useEffect(() => {
    if (!readyRef.current) return;
    const valid = new Set(metas.map((m) => m.slug));
    setGroups((gs) => {
      let changed = false;
      const next = gs.map((g) => {
        let gChanged = false;
        const tabs = g.tabs.map((t) => {
          if (t.kind !== "note") return t;
          const history = t.history.filter((s) => valid.has(s));
          if (history.length === t.history.length) return t;
          gChanged = true;
          const before = t.history
            .slice(0, t.hIndex + 1)
            .filter((s) => valid.has(s)).length;
          return {
            ...t,
            history,
            hIndex: Math.max(0, Math.min(history.length - 1, before - 1)),
          };
        });
        if (!gChanged) return g;
        changed = true;
        return { ...g, tabs };
      });
      return changed ? next : gs;
    });
  }, [metas]);

  // Persist the workspace layout.
  useEffect(() => {
    if (!readyRef.current) return;
    const payload = {
      focused: Math.max(0, groups.findIndex((g) => g.id === focusedGroupId)),
      groups: groups.map((g) => ({
        active: Math.max(0, g.tabs.findIndex((t) => t.id === g.activeId)),
        tabs: g.tabs.map((t) => ({
          kind: t.kind,
          history: t.history,
          hIndex: t.hIndex,
        })),
      })),
    };
    window.localStorage.setItem("smui-tabs", JSON.stringify(payload));
  }, [groups, focusedGroupId]);

  // ── note + folder operations ─────────────────────────────────────────────

  const createNote = useCallback(async () => {
    // Born in the folder you're looking at, like Apple Notes.
    const m = await engine.create({
      title: "New Note",
      body: "",
      frontmatter: folder ? { folder } : undefined,
    });
    await refreshList();
    setQuery("");
    setAutoFocusSlug(m.slug); // new note: start typing immediately
    openNote(m.slug, false);
  }, [engine, refreshList, folder, openNote]);

  // Ribbon calendar button — Obsidian's "open today's daily note".
  const openDailyNote = useCallback(async () => {
    const d = new Date();
    const title = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const existing = metasRef.current.find((m) => m.title === title);
    if (existing) {
      setAutoFocusSlug(existing.slug);
      openNote(existing.slug, false);
      return;
    }
    const m = await engine.create({
      title,
      body: "",
      frontmatter: { folder: "Daily" },
    });
    await refreshList();
    setAutoFocusSlug(m.slug);
    openNote(m.slug, false);
  }, [engine, refreshList, openNote]);

  const moveNote = useCallback(
    async (meta: MemoryMeta) => {
      const current = folderOf(meta) ?? "";
      const next = window.prompt(
        "Move to folder (use / to nest, empty for Notes):",
        current,
      );
      if (next === null) return;
      const value = next.trim().replace(/^\/+|\/+$/g, "");
      await engine.setFrontmatter(meta.slug, {
        folder: value || undefined,
      });
      void refreshList();
    },
    [engine, refreshList],
  );

  const moveNoteToFolder = useCallback(
    async (slug: string, nextFolder: string | null) => {
      const value = nextFolder?.trim().replace(/^\/+|\/+$/g, "") ?? "";
      await engine.setFrontmatter(slug, {
        folder: value || undefined,
      });
      setFolder(value || null);
      setQuery("");
      void refreshList();
    },
    [engine, refreshList],
  );

  const newFolder = useCallback((name: string) => {
    const path = name.trim().replace(/^\/+|\/+$/g, "");
    if (!path) return;
    setExtraFolders((prev) => {
      const nextPath = uniqueFolderPath(path, prev);
      const next = [...prev, nextPath];
      window.localStorage.setItem("smui-folders", JSON.stringify(next));
      setFolder(nextPath);
      return next;
    });
    setQuery("");
  }, []);

  const toggleCollapse = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      window.localStorage.setItem("smui-collapsed", JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Explorer header button: collapse every folder (or expand if already so).
  const collapseAllFolders = useCallback(() => {
    const paths = new Set<string>();
    const add = (p: string) => {
      const segs = p.split("/").filter(Boolean);
      for (let i = 1; i <= segs.length; i++) paths.add(segs.slice(0, i).join("/"));
    };
    for (const m of metasRef.current) {
      const f = folderOf(m);
      if (f) add(f);
    }
    for (const f of extraFolders) add(f);
    setCollapsed((prev) => {
      const next =
        paths.size > 0 && prev.size >= paths.size
          ? new Set<string>()
          : new Set(paths);
      window.localStorage.setItem("smui-collapsed", JSON.stringify([...next]));
      return next;
    });
  }, [extraFolders]);

  const toggleSort = useCallback(() => {
    setSortMode((prev) => {
      const next = prev === "modified" ? "title" : "modified";
      window.localStorage.setItem("smui-sort", next);
      return next;
    });
  }, []);

  const toggleFolders = useCallback(() => {
    setFoldersHidden((prev) => {
      const next = !prev;
      window.localStorage.setItem("smui-folders-hidden", next ? "1" : "0");
      return next;
    });
  }, []);

  const toggleList = useCallback(() => {
    setListHidden((prev) => {
      const next = !prev;
      window.localStorage.setItem("smui-list-hidden", next ? "1" : "0");
      return next;
    });
  }, []);

  const focusSearch = useCallback(() => {
    // Search lives in the notes-list column — reveal it first if hidden.
    if (listHidden) {
      setListHidden(false);
      window.localStorage.setItem("smui-list-hidden", "0");
      window.setTimeout(() => searchRef.current?.focus(), 60);
    } else {
      searchRef.current?.focus();
    }
  }, [listHidden]);

  const selectFolder = useCallback((f: string | null) => {
    setFolder(f);
    setQuery("");
  }, []);

  const togglePin = useCallback(
    async (meta: MemoryMeta) => {
      await engine.setFrontmatter(meta.slug, {
        pinned: meta.frontmatter.pinned ? undefined : true,
      });
      void refreshList();
    },
    [engine, refreshList],
  );

  const deleteNote = useCallback(
    async (meta: MemoryMeta) => {
      if (!window.confirm(`Delete “${meta.title}”?`)) return;
      await engine.delete(meta.slug);
      void refreshList(); // tab histories prune off the fresh list
    },
    [engine, refreshList],
  );

  // ── mass-selection handlers ──────────────────────────────────────────────

  /** Contiguous slice of the visible list between two slugs (inclusive). */
  const rangeBetween = (a: string, b: string): Set<string> => {
    const order = orderedRef.current;
    let ia = order.indexOf(a);
    let ib = order.indexOf(b);
    if (ia === -1) ia = ib;
    if (ib === -1) ib = ia;
    if (ia === -1) return new Set();
    const [lo, hi] = ia <= ib ? [ia, ib] : [ib, ia];
    return new Set(order.slice(lo, hi + 1));
  };

  const selectRow = useCallback(
    (slug: string, newTab: boolean) => {
      selAnchorRef.current = slug;
      selCursorRef.current = slug;
      setListSel(new Set([slug]));
      setAutoFocusSlug(null);
      openNote(slug, newTab);
    },
    [openNote],
  );

  const shiftSelectTo = useCallback((slug: string) => {
    const anchor = selAnchorRef.current ?? selectedSlugRef.current ?? slug;
    selAnchorRef.current = anchor;
    selCursorRef.current = slug;
    setListSel(rangeBetween(anchor, slug));
  }, []);

  const arrowNav = useCallback(
    (dir: 1 | -1, extend: boolean) => {
      const order = orderedRef.current;
      if (!order.length) return;
      const base = selCursorRef.current ?? selectedSlugRef.current;
      const idx = base ? order.indexOf(base) : -1;
      const next =
        idx === -1
          ? dir === 1
            ? order[0]
            : order[order.length - 1]
          : order[Math.min(order.length - 1, Math.max(0, idx + dir))];
      if (!next || (idx !== -1 && next === base)) return;
      if (extend) {
        const anchor = selAnchorRef.current ?? base ?? next;
        selAnchorRef.current = anchor;
        selCursorRef.current = next;
        setListSel(rangeBetween(anchor, next));
      } else {
        selAnchorRef.current = next;
        selCursorRef.current = next;
        setListSel(new Set([next]));
        setAutoFocusSlug(null);
        openNote(next, false);
      }
    },
    [openNote],
  );

  const selectAllRows = useCallback(() => {
    const order = orderedRef.current;
    if (!order.length) return;
    selAnchorRef.current = order[0];
    selCursorRef.current = order[order.length - 1];
    setListSel(new Set(order));
  }, []);

  const deleteSelection = useCallback(async () => {
    const sel = listSelRef.current.size
      ? [...listSelRef.current]
      : selectedSlugRef.current
        ? [selectedSlugRef.current]
        : [];
    const visible = new Set(orderedRef.current);
    const slugs = sel.filter((s) => visible.has(s));
    if (!slugs.length) return;
    if (slugs.length === 1) {
      const meta = metasRef.current.find((m) => m.slug === slugs[0]);
      if (meta) await deleteNote(meta);
    } else {
      if (!window.confirm(`Delete ${slugs.length} notes?`)) return;
      for (const s of slugs) await engine.delete(s);
      void refreshList();
    }
    selAnchorRef.current = null;
    selCursorRef.current = null;
    setListSel(new Set());
  }, [engine, refreshList, deleteNote]);

  /** Dropping a multi-selected row on a folder moves the whole selection. */
  const dropNoteOnFolder = useCallback(
    (slug: string, targetFolder: string | null) => {
      const sel = listSelRef.current;
      if (!(sel.has(slug) && sel.size > 1)) {
        void moveNoteToFolder(slug, targetFolder);
        return;
      }
      void (async () => {
        const value = targetFolder?.trim().replace(/^\/+|\/+$/g, "") ?? "";
        for (const s of sel) {
          await engine.setFrontmatter(s, { folder: value || undefined });
        }
        setFolder(value || null);
        setQuery("");
        void refreshList();
      })();
    },
    [engine, refreshList, moveNoteToFolder],
  );

  // ── effects ──────────────────────────────────────────────────────────────

  // Initial load: restore the saved workspace, else newest note open.
  useEffect(() => {
    void (async () => {
      const list = await engine.list();
      setMetas(list);
      const restored = restoreGroups(new Set(list.map((m) => m.slug)));
      if (restored) {
        setGroups(restored.groups);
        setFocusedGroupId(restored.focusedId);
      } else if (list.length) {
        const t: Tab = {
          id: uid(),
          kind: "note",
          history: [list[0].slug],
          hIndex: 0,
        };
        const g: TabGroup = { id: uid(), tabs: [t], activeId: t.id };
        setGroups([g]);
        setFocusedGroupId(g.id);
      }
      readyRef.current = true;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // External changes (ShipSpace, agents, Obsidian) → refresh the list;
  // each open pane reloads itself off the same vaultVersion bump.
  useEffect(() => {
    if (!vaultVersion) return;
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultVersion]);

  // Search-as-you-type over titles AND bodies (engine.search reads bodies).
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    const t = window.setTimeout(async () => {
      const hits = await engine.search(q, 50);
      setResults(hits.map((h) => h.memory));
    }, 150);
    return () => window.clearTimeout(t);
  }, [query, engine, vaultVersion]);

  // Manual save: ⌘S in-window, plus the host app's native File ▸ Save
  // Session menu item (it dispatches this event into the webview). Saves
  // are idempotent — a clean pane's flush is a no-op.
  const saveSession = useCallback(() => setSaveSignal((s) => s + 1), []);
  useEffect(() => {
    const onSave = () => saveSession();
    window.addEventListener("ship-memory:save-session", onSave);
    return () => window.removeEventListener("ship-memory:save-session", onSave);
  }, [saveSession]);

  // ⌘N new note · ⌘T new tab · ⌘W close tab · ⌘S save session.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === "n") {
        e.preventDefault();
        void createNote();
      } else if (k === "s") {
        e.preventDefault();
        saveSession();
      } else if (k === "t") {
        e.preventDefault();
        const gid = focusedRef.current;
        if (groupsRef.current.some((g) => g.id === gid)) newTabIn(gid);
      } else if (k === "w") {
        e.preventDefault();
        const g = groupsRef.current.find((x) => x.id === focusedRef.current);
        if (g?.activeId) closeTab(g.id, g.activeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createNote, newTabIn, closeTab, saveSession]);

  // ── derived ──────────────────────────────────────────────────────────────

  // Search covers the whole vault; otherwise the list shows the open folder.
  const folderFiltered = useMemo(
    () => (folder === null ? metas : metas.filter((m) => folderOf(m) === folder)),
    [metas, folder],
  );
  const shown = results ?? folderFiltered;
  const metaBySlug = useMemo(
    () => new Map(metas.map((m) => [m.slug, m])),
    [metas],
  );
  const focusedGroup = groups.find((g) => g.id === focusedGroupId) ?? groups[0];
  const focusedTab =
    focusedGroup?.tabs.find((t) => t.id === focusedGroup.activeId) ?? null;
  const selectedSlug = focusedTab ? tabSlug(focusedTab) : null;
  selectedSlugRef.current = selectedSlug;

  // Flat visual order of the list — the coordinate system for range selects.
  const orderedSlugs = useMemo(
    () => listOrder(shown, sortMode).map((m) => m.slug),
    [shown, sortMode],
  );
  orderedRef.current = orderedSlugs;

  // Folder/search/deletes changed what's visible → drop stale selections.
  useEffect(() => {
    setListSel((prev) => {
      if (!prev.size) return prev;
      const valid = new Set(orderedSlugs);
      const next = new Set([...prev].filter((s) => valid.has(s)));
      return next.size === prev.size ? prev : next;
    });
  }, [orderedSlugs]);

  // Rows to highlight: the mass selection, else just the open note.
  const selectedSlugs = useMemo<ReadonlySet<string>>(() => {
    if (listSel.size) return listSel;
    return selectedSlug ? new Set([selectedSlug]) : new Set<string>();
  }, [listSel, selectedSlug]);

  const tabTitle = useCallback(
    (t: Tab) => {
      if (t.kind === "graph") return "Galaxy";
      const slug = tabSlug(t);
      if (!slug) return "New tab";
      return metaBySlug.get(slug)?.title ?? slug;
    },
    [metaBySlug],
  );

  return (
    <div
      className="smui-root"
      // With the window's native dragDropEnabled off, an unhandled file drop
      // would navigate the webview to the file — swallow strays here. Note
      // drags (x-shipmemory-note) bypass this and keep their own handlers.
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
      }}
    >
      <div className="smui-frame">
        <header className="smui-appbar" data-tauri-drag-region="">
          <div className="smui-appbar-traffic-spacer" data-tauri-drag-region="" />
          <div className="smui-appbar-brand" data-tauri-drag-region="">
            <span className="smui-appbar-logo" aria-hidden="true">
              {appLogoSrc ? <img src={appLogoSrc} alt="" /> : <span>SM</span>}
            </span>
            <span className="smui-appbar-title">ShipMemory</span>
          </div>
          <div className="smui-appbar-fill" data-tauri-drag-region="" />
        </header>
        <div className="smui-shell">
          <nav className="smui-ribbon">
            <div className="smui-dragpad" data-tauri-drag-region="" />
            <button
              className={`smui-chrome-btn smui-ribbon-btn${foldersHidden ? "" : " is-on"}`}
              title={foldersHidden ? "Show folders" : "Hide folders"}
              onClick={toggleFolders}
            >
              <IconPanelLeft />
            </button>
            <button
              className={`smui-chrome-btn smui-ribbon-btn${listHidden ? "" : " is-on"}`}
              title={listHidden ? "Show notes list" : "Hide notes list"}
              onClick={toggleList}
            >
              <IconPanelRight />
            </button>
            <div className="smui-ribbon-sep" />
            <button
              className="smui-chrome-btn smui-ribbon-btn"
              title="Search notes"
              onClick={focusSearch}
            >
              <IconFileSearch />
            </button>
            <button
              className="smui-chrome-btn smui-ribbon-btn"
              title="Open galaxy view"
              onClick={openGraph}
            >
              <IconGraph />
            </button>
            <button
              className="smui-chrome-btn smui-ribbon-btn"
              title="Open today's daily note"
              onClick={() => void openDailyNote()}
            >
              <IconCalendar />
            </button>
          </nav>
          {!foldersHidden && (
            <FolderSidebar
              metas={metas}
              extraFolders={extraFolders}
              selected={folder}
              collapsed={collapsed}
              sortMode={sortMode}
              onSelect={selectFolder}
              onToggleCollapse={toggleCollapse}
              onNewFolder={newFolder}
              onNewNote={() => void createNote()}
              onDropNote={dropNoteOnFolder}
              onToggleSort={toggleSort}
              onCollapseAll={collapseAllFolders}
            />
          )}
          {!listHidden && (
            <aside className="smui-sidebar">
              <div className="smui-dragpad" data-tauri-drag-region="" />
              <div className="smui-sidebar-header">
                <input
                  ref={searchRef}
                  className="smui-search"
                  type="search"
                  placeholder="Search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <NotesList
                metas={shown}
                selectedSlugs={selectedSlugs}
                sort={sortMode}
                onSelect={selectRow}
                onShiftSelect={shiftSelectTo}
                onArrowNav={arrowNav}
                onDeleteSelection={() => void deleteSelection()}
                onSelectAll={selectAllRows}
                onTogglePin={(m) => void togglePin(m)}
                onMove={(m) => void moveNote(m)}
                onDelete={(m) => void deleteNote(m)}
              />
            </aside>
          )}
          <main
            className={`smui-main${foldersHidden && listHidden ? " is-shifted" : ""}`}
          >
            {groups.map((g) => (
              <section
                key={g.id}
                className={`smui-group${g.id === focusedGroupId ? " is-focused" : ""}`}
                onMouseDownCapture={() => setFocusedGroupId(g.id)}
              >
                <TabStrip
                  group={g}
                  titleFor={tabTitle}
                  onActivate={(tid) => activateTab(g.id, tid)}
                  onClose={(tid) => closeTab(g.id, tid)}
                  onNewTab={() => newTabIn(g.id)}
                />
                {g.tabs.map((t) => {
                  const active = t.id === g.activeId;
                  if (t.kind === "graph") {
                    return (
                      <div
                        key={t.id}
                        className="smui-pane"
                        style={active ? undefined : { display: "none" }}
                      >
                        <div className="smui-pane-header">
                          <div className="smui-pane-nav" />
                          <div className="smui-breadcrumb">
                            <span className="smui-crumb">Galaxy</span>
                          </div>
                          <div className="smui-pane-aux" />
                        </div>
                        <PaneErrorBoundary title="Galaxy">
                          <GraphView
                            metas={metas}
                            visible={active}
                            onOpenNote={openNoteFromGraph}
                          />
                        </PaneErrorBoundary>
                      </div>
                    );
                  }
                  const slug = tabSlug(t);
                  return (
                    <PaneErrorBoundary key={t.id} title="Note pane">
                      <NotePane
                        engine={engine}
                        slug={slug}
                        meta={slug ? (metaBySlug.get(slug) ?? null) : null}
                        vaultVersion={vaultVersion}
                        visible={active}
                        canBack={t.hIndex > 0}
                        canForward={t.hIndex < t.history.length - 1}
                        onBack={() => navigateHistory(g.id, t.id, -1)}
                        onForward={() => navigateHistory(g.id, t.id, 1)}
                        onSaved={() => void refreshList()}
                        saveSignal={saveSignal}
                        onOpenAttachment={onOpenAttachment}
                        autoFocusSlug={autoFocusSlug}
                      />
                    </PaneErrorBoundary>
                  );
                })}
                {g.tabs.length === 0 && (
                  <div className="smui-empty">
                    <p>No file is open</p>
                    <p className="smui-empty-hint">⌘N new note · ⌘T new tab</p>
                  </div>
                )}
              </section>
            ))}
          </main>
        </div>
      </div>
    </div>
  );
}

// ── tab strip ────────────────────────────────────────────────────────────────

function TabStrip({
  group,
  titleFor,
  onActivate,
  onClose,
  onNewTab,
}: {
  group: TabGroup;
  titleFor: (t: Tab) => string;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onNewTab: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  return (
    <div className="smui-tabstrip" data-tauri-drag-region="">
      {group.tabs.map((t) => (
        <div
          key={t.id}
          className={`smui-tab${t.id === group.activeId ? " is-active" : ""}`}
          title={titleFor(t)}
          onClick={() => onActivate(t.id)}
          onAuxClick={(e) => {
            if (e.button === 1) onClose(t.id);
          }}
        >
          <span className="smui-tab-title">{titleFor(t)}</span>
          <button
            className="smui-tab-close"
            title="Close tab (⌘W)"
            onClick={(e) => {
              e.stopPropagation();
              onClose(t.id);
            }}
          >
            <IconX width={12} height={12} />
          </button>
        </div>
      ))}
      <button
        className="smui-chrome-btn smui-tab-new"
        title="New tab (⌘T)"
        onClick={onNewTab}
      >
        <IconPlus />
      </button>
      <div className="smui-tabstrip-fill" data-tauri-drag-region="" />
      <div className="smui-tabmenu-anchor" ref={menuRef}>
        <button
          className="smui-chrome-btn"
          title="Open tabs"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <IconChevronDown />
        </button>
        {menuOpen && (
          <div className="smui-tabmenu">
            {group.tabs.length === 0 && (
              <div className="smui-tabmenu-empty">No open tabs</div>
            )}
            {group.tabs.map((t) => (
              <button
                key={t.id}
                className={`smui-tabmenu-item${t.id === group.activeId ? " is-active" : ""}`}
                onClick={() => {
                  onActivate(t.id);
                  setMenuOpen(false);
                }}
              >
                {titleFor(t)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
