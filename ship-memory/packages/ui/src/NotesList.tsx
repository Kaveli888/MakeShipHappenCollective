import { useRef } from "react";
import type { MemoryMeta } from "@ship-memory/core";
import { folderOf } from "./FolderSidebar.js";
import { formatListDate, sectionFor } from "./dates.js";

export type SortMode = "modified" | "title";

export interface NotesListProps {
  metas: MemoryMeta[];
  /** Highlighted rows — one slug normally, many during mass selection. */
  selectedSlugs: ReadonlySet<string>;
  sort?: SortMode;
  /** newTab = ⌘/middle-click — open in a new tab instead of navigating. */
  onSelect: (slug: string, newTab: boolean) => void;
  /** ⇧-click — extend the selection from the anchor to this row. */
  onShiftSelect: (slug: string) => void;
  /** ↑/↓ with the list focused; extend = ⇧ held. */
  onArrowNav: (dir: 1 | -1, extend: boolean) => void;
  /** Delete/Backspace with the list focused — delete the selection. */
  onDeleteSelection: () => void;
  /** ⌘A with the list focused. */
  onSelectAll: () => void;
  onTogglePin: (meta: MemoryMeta) => void;
  onMove: (meta: MemoryMeta) => void;
  onDelete: (meta: MemoryMeta) => void;
}

interface Group {
  title: string;
  metas: MemoryMeta[];
}

/** Section grouping as rendered: Pinned first, then date buckets or A–Z. */
function buildGroups(metas: MemoryMeta[], sort: SortMode): Group[] {
  const pinned = metas.filter((m) => Boolean(m.frontmatter.pinned));
  const rest = metas.filter((m) => !m.frontmatter.pinned);

  const groups: Group[] = [];
  if (sort === "title") {
    groups.push({
      title: "All Notes",
      metas: [...rest].sort((a, b) => a.title.localeCompare(b.title)),
    });
  } else {
    // metas arrive newest-first, so equal buckets are contiguous — one pass.
    for (const m of rest) {
      const title = sectionFor(m.modified);
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.metas.push(m);
      else groups.push({ title, metas: [m] });
    }
  }
  if (pinned.length > 0) groups.unshift({ title: "Pinned", metas: pinned });
  return groups;
}

/**
 * Flat top-to-bottom visual order of the list — the coordinate system for
 * range selection (⇧-click, ⇧↑/⇧↓). Must match buildGroups exactly.
 */
export function listOrder(metas: MemoryMeta[], sort: SortMode): MemoryMeta[] {
  return buildGroups(metas, sort).flatMap((g) => g.metas);
}

export function NotesList({
  metas,
  selectedSlugs,
  sort = "modified",
  onSelect,
  onShiftSelect,
  onArrowNav,
  onDeleteSelection,
  onSelectAll,
  onTogglePin,
  onMove,
  onDelete,
}: NotesListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  if (metas.length === 0) {
    return <div className="smui-list-empty">No notes</div>;
  }

  const groups = buildGroups(metas, sort);

  // Clicks land focus on the list so ⇧↑/⇧↓ keep extending from here.
  const clickRow = (slug: string, e: React.MouseEvent) => {
    listRef.current?.focus();
    if (e.shiftKey) onShiftSelect(slug);
    else onSelect(slug, e.metaKey || e.ctrlKey);
  };

  return (
    <div
      ref={listRef}
      className="smui-list"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          onArrowNav(e.key === "ArrowDown" ? 1 : -1, e.shiftKey);
        } else if (
          (e.key === "Backspace" || e.key === "Delete") &&
          !e.metaKey &&
          !e.ctrlKey
        ) {
          e.preventDefault();
          onDeleteSelection();
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
          e.preventDefault();
          onSelectAll();
        }
      }}
    >
      {groups.map((g) => (
        <section className="smui-section" key={g.title}>
          <h2 className="smui-section-title">{g.title}</h2>
          {g.metas.map((m) => (
            <Row
              key={m.slug}
              meta={m}
              selected={selectedSlugs.has(m.slug)}
              onClickRow={clickRow}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
              onMove={onMove}
              onDelete={onDelete}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function Row({
  meta: m,
  selected,
  onClickRow,
  onSelect,
  onTogglePin,
  onMove,
  onDelete,
}: {
  meta: MemoryMeta;
  selected: boolean;
  onClickRow: (slug: string, e: React.MouseEvent) => void;
  onSelect: (slug: string, newTab: boolean) => void;
  onTogglePin: (meta: MemoryMeta) => void;
  onMove: (meta: MemoryMeta) => void;
  onDelete: (meta: MemoryMeta) => void;
}) {
  const folder = folderOf(m);
  return (
    <div
      className={`smui-row${selected ? " is-selected" : ""}`}
      draggable
      onDragStart={(e) => {
        (window as unknown as { __shipMemoryDraggedNoteSlug?: string })
          .__shipMemoryDraggedNoteSlug = m.slug;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-shipmemory-note", m.slug);
        e.dataTransfer.setData("text/plain", m.slug);
      }}
      onDragEnd={() => {
        delete (window as unknown as { __shipMemoryDraggedNoteSlug?: string })
          .__shipMemoryDraggedNoteSlug;
      }}
      onClick={(e) => onClickRow(m.slug, e)}
      onAuxClick={(e) => {
        if (e.button === 1) onSelect(m.slug, true);
      }}
    >
      <div className="smui-row-main">
        <div className="smui-row-title">{m.title}</div>
        <div className="smui-row-sub">
          <span className="smui-row-date">{formatListDate(m.modified)}</span>
          <span className="smui-row-snippet">
            {m.snippet || "No additional text"}
          </span>
        </div>
        <div className="smui-row-folder">
          <span className="smui-row-folder-icon">📁</span>
          {folder ? folder.split("/").pop() : "Notes"}
        </div>
      </div>
      <div className="smui-row-actions">
        <button
          className={`smui-icon-btn${m.frontmatter.pinned ? " is-on" : ""}`}
          title={m.frontmatter.pinned ? "Unpin" : "Pin"}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(m);
          }}
        >
          {m.frontmatter.pinned ? "📌" : "📍"}
        </button>
        <button
          className="smui-icon-btn"
          title="Move to folder…"
          onClick={(e) => {
            e.stopPropagation();
            onMove(m);
          }}
        >
          📁
        </button>
        <button
          className="smui-icon-btn"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(m);
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}
