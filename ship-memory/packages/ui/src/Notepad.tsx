import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MemoryMeta, ShipMemory } from "@ship-memory/core";
import { MarkdownEditor } from "./MarkdownEditor.js";
import { NotesList } from "./NotesList.js";
import { formatFullDate } from "./dates.js";
import "./notepad.css";

export interface NotepadProps {
  engine: ShipMemory;
  /**
   * Bump whenever the vault changed on disk (host's fs watcher). The list
   * always refreshes; the open note only reloads when its on-disk content
   * actually differs from what the editor already has, so our own autosaves
   * never reset the cursor.
   */
  vaultVersion?: number;
}

interface Loaded {
  slug: string;
  body: string;
  /** Editor remount stamp — bumped only when disk content must replace the editor. */
  stamp: number;
}

export function Notepad({ engine, vaultVersion = 0 }: NotepadProps) {
  const [metas, setMetas] = useState<MemoryMeta[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemoryMeta[] | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const dirtyRef = useRef(false);
  const editorTextRef = useRef(""); // live editor content
  const diskBodyRef = useRef(""); // what we believe the file holds
  const saveTimerRef = useRef<number | undefined>(undefined);
  const loadedRef = useRef<Loaded | null>(null);
  loadedRef.current = loaded;

  const refreshList = useCallback(async () => {
    setMetas(await engine.list());
  }, [engine]);

  const save = useCallback(
    async (slug: string, text: string) => {
      setSaveState("saving");
      try {
        const updated = await engine.update(slug, text);
        diskBodyRef.current = updated.body;
        // First H1 is the note's name (iOS Notes' first-line-is-title rule) —
        // keep frontmatter.title in sync so lists and wikilinks agree.
        const h1 = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
        if (h1 && h1 !== updated.title) {
          const after = await engine.setFrontmatter(slug, { title: h1 });
          diskBodyRef.current = after.body;
        }
        if (editorTextRef.current === text) dirtyRef.current = false;
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
      void refreshList();
    },
    [engine, refreshList],
  );

  const flushPendingSave = useCallback(async () => {
    window.clearTimeout(saveTimerRef.current);
    const current = loadedRef.current;
    if (current && dirtyRef.current) {
      await save(current.slug, editorTextRef.current);
    }
  }, [save]);

  const select = useCallback(
    async (slug: string) => {
      await flushPendingSave();
      const m = await engine.read(slug);
      dirtyRef.current = false;
      editorTextRef.current = m.body;
      diskBodyRef.current = m.body;
      setLoaded({ slug, body: m.body, stamp: Date.now() });
    },
    [engine, flushPendingSave],
  );

  const onEditorChange = useCallback(
    (text: string) => {
      editorTextRef.current = text;
      dirtyRef.current = true;
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        const current = loadedRef.current;
        if (current) void save(current.slug, editorTextRef.current);
      }, 500);
    },
    [save],
  );

  const createNote = useCallback(async () => {
    await flushPendingSave();
    const m = await engine.create({ title: "New Note", body: "" });
    await refreshList();
    setQuery("");
    dirtyRef.current = false;
    editorTextRef.current = m.body;
    diskBodyRef.current = m.body;
    setLoaded({ slug: m.slug, body: m.body, stamp: Date.now() });
  }, [engine, flushPendingSave, refreshList]);

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
      if (loadedRef.current?.slug === meta.slug) {
        window.clearTimeout(saveTimerRef.current);
        dirtyRef.current = false;
        setLoaded(null);
      }
      void refreshList();
    },
    [engine, refreshList],
  );

  // Initial load: newest note open, like reopening iOS Notes.
  useEffect(() => {
    void (async () => {
      const list = await engine.list();
      setMetas(list);
      if (list.length) await select(list[0].slug);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // External changes (ShipSpace, agents, Obsidian) → refresh.
  useEffect(() => {
    if (!vaultVersion) return;
    void (async () => {
      await refreshList();
      const current = loadedRef.current;
      if (!current || dirtyRef.current) return;
      try {
        const m = await engine.read(current.slug);
        if (m.body !== diskBodyRef.current) {
          editorTextRef.current = m.body;
          diskBodyRef.current = m.body;
          setLoaded({ slug: current.slug, body: m.body, stamp: Date.now() });
        }
      } catch {
        setLoaded(null); // note deleted externally
      }
    })();
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

  // Cmd+N anywhere → new note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void createNote();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createNote]);

  // Flush unsaved edits if the window closes mid-debounce.
  useEffect(() => {
    const onBlurOrClose = () => void flushPendingSave();
    window.addEventListener("blur", onBlurOrClose);
    window.addEventListener("beforeunload", onBlurOrClose);
    return () => {
      window.removeEventListener("blur", onBlurOrClose);
      window.removeEventListener("beforeunload", onBlurOrClose);
    };
  }, [flushPendingSave]);

  const shown = results ?? metas;
  const currentMeta = useMemo(
    () => metas.find((m) => m.slug === loaded?.slug) ?? null,
    [metas, loaded],
  );

  return (
    <div className="smui-root">
      <div className="smui-titlebar" data-tauri-drag-region="">
        <span className="smui-savestate">
          {saveState === "saving" ? "Saving…" : ""}
        </span>
      </div>
      <aside className="smui-sidebar">
        <div className="smui-sidebar-header">
          <input
            className="smui-search"
            type="search"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="smui-new-btn"
            title="New note (⌘N)"
            onClick={() => void createNote()}
          >
            ✏️
          </button>
        </div>
        <NotesList
          metas={shown}
          selectedSlug={loaded?.slug ?? null}
          onSelect={(slug) => void select(slug)}
          onTogglePin={(m) => void togglePin(m)}
          onDelete={(m) => void deleteNote(m)}
        />
      </aside>
      <main className="smui-main">
        {loaded ? (
          <>
            {currentMeta && (
              <div className="smui-note-date">
                {formatFullDate(currentMeta.modified)}
              </div>
            )}
            <MarkdownEditor
              key={`${loaded.slug}:${loaded.stamp}`}
              initialDoc={loaded.body}
              onChange={onEditorChange}
              autoFocus
            />
          </>
        ) : (
          <div className="smui-empty">
            <p>No note selected</p>
            <p className="smui-empty-hint">⌘N to start a new one</p>
          </div>
        )}
      </main>
    </div>
  );
}
