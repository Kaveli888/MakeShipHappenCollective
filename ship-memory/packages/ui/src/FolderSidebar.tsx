import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { MemoryMeta } from "@ship-memory/core";
import {
  IconChevronsDownUp,
  IconFolderPlus,
  IconSort,
  IconSquarePen,
} from "./icons";

/**
 * Left column — Apple-Notes-style folder tree.
 *
 * Folders are virtual: a note's `folder` frontmatter key holds a
 * `/`-separated path ("Code/API/Prompts"), so the vault on disk stays flat
 * and MCP/agent consumers are untouched. Empty folders the user created (no
 * notes yet) are passed in via `extraFolders` and persisted by the host.
 */

export interface FolderSidebarProps {
  /** ALL metas, unfiltered — counts and tree derive from these. */
  metas: MemoryMeta[];
  /** User-created folders that have no notes yet. */
  extraFolders: string[];
  /** Selected folder path, or null for All Notes. */
  selected: string | null;
  /** Collapsed folder paths (default = everything expanded). */
  collapsed: Set<string>;
  /** Current notes-list ordering — drives the sort button tooltip. */
  sortMode: "modified" | "title";
  onSelect: (folder: string | null) => void;
  onToggleCollapse: (path: string) => void;
  onNewFolder: (name: string) => void;
  onNewNote: () => void;
  onDropNote: (slug: string, folder: string | null) => void;
  onToggleSort: () => void;
  onCollapseAll: () => void;
}

interface FolderNode {
  name: string;
  path: string;
  count: number;
  children: FolderNode[];
}

export function folderOf(m: MemoryMeta): string | null {
  const f = m.frontmatter.folder;
  return typeof f === "string" && f.trim() ? f.trim() : null;
}

function buildTree(metas: MemoryMeta[], extraFolders: string[]): FolderNode[] {
  const paths = new Set<string>();
  const counts = new Map<string, number>();
  const addWithAncestors = (p: string) => {
    const segs = p.split("/").filter(Boolean);
    for (let i = 1; i <= segs.length; i++) paths.add(segs.slice(0, i).join("/"));
  };
  for (const m of metas) {
    const f = folderOf(m);
    if (!f) continue;
    addWithAncestors(f);
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  for (const f of extraFolders) addWithAncestors(f);

  // Lexicographic sort puts every parent before its children ("/" sorts low),
  // so one pass can hang nodes off an already-built parent.
  const roots: FolderNode[] = [];
  const byPath = new Map<string, FolderNode>();
  for (const p of [...paths].sort((a, b) => a.localeCompare(b))) {
    const segs = p.split("/");
    const node: FolderNode = {
      name: segs[segs.length - 1],
      path: p,
      count: counts.get(p) ?? 0,
      children: [],
    };
    byPath.set(p, node);
    const parent = byPath.get(segs.slice(0, -1).join("/"));
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

// Note drags carry the slug both ways: a window global (set by NotesList on
// dragstart — dataTransfer payloads are unreadable during dragover) and the
// dataTransfer itself for the drop. Shared by FolderSidebar and FolderRow.
const draggedNoteSlug = (): string | undefined =>
  (window as unknown as { __shipMemoryDraggedNoteSlug?: string })
    .__shipMemoryDraggedNoteSlug;

function hasNoteDrag(e: DragEvent): boolean {
  if (draggedNoteSlug()) return true;
  const types = Array.from(e.dataTransfer.types);
  return (
    types.includes("application/x-shipmemory-note") ||
    types.includes("text/plain")
  );
}

function noteSlugFromDrag(e: DragEvent): string {
  return (
    draggedNoteSlug() ||
    e.dataTransfer.getData("application/x-shipmemory-note") ||
    e.dataTransfer.getData("text/plain")
  );
}

export function FolderSidebar({
  metas,
  extraFolders,
  selected,
  collapsed,
  sortMode,
  onSelect,
  onToggleCollapse,
  onNewFolder,
  onNewNote,
  onDropNote,
  onToggleSort,
  onCollapseAll,
}: FolderSidebarProps) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(
    undefined,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const tree = useMemo(
    () => buildTree(metas, extraFolders),
    [metas, extraFolders],
  );

  useEffect(() => {
    if (isCreatingFolder) inputRef.current?.focus();
  }, [isCreatingFolder]);

  const submitFolder = () => {
    const name = folderName.trim();
    if (!name) return;
    onNewFolder(name);
    setFolderName("");
    setIsCreatingFolder(false);
  };

  const dropClass = (path: string | null) =>
    dropTarget === path ? " is-drop-target" : "";

  return (
    <nav className="smui-folders">
      <div className="smui-dragpad" data-tauri-drag-region="" />
      <div className="smui-explorer-actions">
        <button
          className="smui-chrome-btn"
          title="New note (⌘N)"
          onClick={onNewNote}
        >
          <IconSquarePen />
        </button>
        <button
          className="smui-chrome-btn"
          title="New folder"
          onClick={() => setIsCreatingFolder(true)}
        >
          <IconFolderPlus />
        </button>
        <button
          className="smui-chrome-btn"
          title={
            sortMode === "modified"
              ? "Sorted by recent edit — click for title A–Z"
              : "Sorted by title A–Z — click for recent edit"
          }
          onClick={onToggleSort}
        >
          <IconSort />
        </button>
        <button
          className="smui-chrome-btn"
          title="Collapse all folders"
          onClick={onCollapseAll}
        >
          <IconChevronsDownUp />
        </button>
      </div>
      {isCreatingFolder && (
        <div className="smui-folder-create">
          <input
            ref={inputRef}
            className="smui-folder-input"
            value={folderName}
            placeholder="Folder name"
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitFolder();
              if (e.key === "Escape") {
                setFolderName("");
                setIsCreatingFolder(false);
              }
            }}
          />
          <button
            className="smui-chrome-btn"
            title="Create folder"
            disabled={!folderName.trim()}
            onClick={submitFolder}
          >
            ✓
          </button>
          <button
            className="smui-chrome-btn"
            title="Cancel"
            onClick={() => {
              setFolderName("");
              setIsCreatingFolder(false);
            }}
          >
            ×
          </button>
        </div>
      )}
      <div className="smui-folders-scroll">
        <h2 className="smui-section-title">ShipMemory</h2>
        <div
          className={`smui-folder-row${selected === null ? " is-selected" : ""}${dropClass(null)}`}
          onDragOver={(e) => {
            if (!hasNoteDrag(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDropTarget(null);
          }}
          onDragLeave={() => setDropTarget(undefined)}
          onDrop={(e) => {
            const slug = noteSlugFromDrag(e);
            if (!slug) return;
            e.preventDefault();
            setDropTarget(undefined);
            onDropNote(slug, null);
          }}
          onClick={() => onSelect(null)}
        >
          <span className="smui-folder-chevron" />
          <span className="smui-folder-icon">🗂</span>
          <span className="smui-folder-name">All Notes</span>
          <span className="smui-folder-count">{metas.length}</span>
        </div>
        {tree.map((node) => (
          <FolderRow
            key={node.path}
            node={node}
            depth={0}
            selected={selected}
            collapsed={collapsed}
            onSelect={onSelect}
            onToggleCollapse={onToggleCollapse}
            onDropNote={onDropNote}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
          />
        ))}
      </div>
    </nav>
  );
}

function FolderRow({
  node,
  depth,
  selected,
  collapsed,
  onSelect,
  onToggleCollapse,
  onDropNote,
  dropTarget,
  setDropTarget,
}: {
  node: FolderNode;
  depth: number;
  selected: string | null;
  collapsed: Set<string>;
  onSelect: (folder: string | null) => void;
  onToggleCollapse: (path: string) => void;
  onDropNote: (slug: string, folder: string | null) => void;
  dropTarget: string | null | undefined;
  setDropTarget: (path: string | null | undefined) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.path);
  return (
    <>
      <div
        className={`smui-folder-row${selected === node.path ? " is-selected" : ""}${dropTarget === node.path ? " is-drop-target" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onDragOver={(e) => {
          if (!hasNoteDrag(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropTarget(node.path);
        }}
        onDragLeave={() => setDropTarget(undefined)}
        onDrop={(e) => {
          const slug = noteSlugFromDrag(e);
          if (!slug) return;
          e.preventDefault();
          setDropTarget(undefined);
          onDropNote(slug, node.path);
        }}
        onClick={() => onSelect(node.path)}
      >
        <span
          className={`smui-folder-chevron${hasChildren ? " has-children" : ""}${isCollapsed ? "" : " is-open"}`}
          onClick={(e) => {
            if (!hasChildren) return;
            e.stopPropagation();
            onToggleCollapse(node.path);
          }}
        >
          {hasChildren ? "›" : ""}
        </span>
        <span className="smui-folder-icon">📁</span>
        <span className="smui-folder-name">{node.name}</span>
        <span className="smui-folder-count">{node.count || ""}</span>
      </div>
      {hasChildren &&
        !isCollapsed &&
        node.children.map((c) => (
          <FolderRow
            key={c.path}
            node={c}
            depth={depth + 1}
            selected={selected}
            collapsed={collapsed}
            onSelect={onSelect}
            onToggleCollapse={onToggleCollapse}
            onDropNote={onDropNote}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
          />
        ))}
    </>
  );
}
