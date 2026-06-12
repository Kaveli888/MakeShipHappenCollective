import type { MemoryMeta } from "@ship-memory/core";
import { formatListDate } from "./dates.js";

export interface NotesListProps {
  metas: MemoryMeta[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onTogglePin: (meta: MemoryMeta) => void;
  onDelete: (meta: MemoryMeta) => void;
}

export function NotesList({
  metas,
  selectedSlug,
  onSelect,
  onTogglePin,
  onDelete,
}: NotesListProps) {
  const pinned = metas.filter((m) => Boolean(m.frontmatter.pinned));
  const rest = metas.filter((m) => !m.frontmatter.pinned);

  if (metas.length === 0) {
    return <div className="smui-list-empty">No notes</div>;
  }

  return (
    <div className="smui-list">
      {pinned.length > 0 && (
        <Section
          title="Pinned"
          metas={pinned}
          selectedSlug={selectedSlug}
          onSelect={onSelect}
          onTogglePin={onTogglePin}
          onDelete={onDelete}
        />
      )}
      <Section
        title={pinned.length > 0 ? "Notes" : null}
        metas={rest}
        selectedSlug={selectedSlug}
        onSelect={onSelect}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
      />
    </div>
  );
}

function Section({
  title,
  metas,
  selectedSlug,
  onSelect,
  onTogglePin,
  onDelete,
}: NotesListProps & { title: string | null }) {
  if (metas.length === 0) return null;
  return (
    <section className="smui-section">
      {title && <h2 className="smui-section-title">{title}</h2>}
      {metas.map((m) => (
        <div
          key={m.slug}
          className={`smui-row${m.slug === selectedSlug ? " is-selected" : ""}`}
          onClick={() => onSelect(m.slug)}
        >
          <div className="smui-row-main">
            <div className="smui-row-title">{m.title}</div>
            <div className="smui-row-sub">
              <span className="smui-row-date">{formatListDate(m.modified)}</span>
              <span className="smui-row-snippet">
                {m.snippet || "No additional text"}
              </span>
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
      ))}
    </section>
  );
}
