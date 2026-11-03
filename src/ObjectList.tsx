import { useEffect, useRef } from "react";
import { Image as ImageIcon, Pencil, Signature, TextCursorInput, Trash2, Type } from "lucide-react";
import { revealIn } from "./reveal.ts";
import { ShapeGlyph } from "./ShapeGlyph.tsx";
import type { ObjectHover, ObjectIcon, ObjectRow } from "./objects.ts";

function RowIcon({ icon }: { icon: ObjectIcon }) {
  switch (icon.kind) {
    case "shape":
      return <ShapeGlyph id={icon.id} />;
    case "picture":
      return <img src={icon.src} alt="" className={icon.wide ? "wide" : undefined} draggable={false} />;
    case "text":
      return <Type />;
    case "pencil":
      return <Pencil />;
    case "signature":
      return <Signature />;
    case "patch":
      return <TextCursorInput />;
    default:
      return <ImageIcon />;
  }
}

function revealRow(list: HTMLElement | null, id: string) {
  if (!list) return;
  const viewport = list.closest<HTMLElement>("[data-slot='scroll-area-viewport']");
  const row = list.querySelector<HTMLElement>(`[data-object-id="${CSS.escape(id)}"]`);
  if (viewport && row) revealIn(viewport, row, "nearest", false);
}

export function ObjectList({
  objects,
  selectedId,
  hover,
  onHover,
  onSelect,
  onRemove,
}: {
  objects: ObjectRow[];
  selectedId: string | null;
  hover: ObjectHover | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const hotId = hover?.id ?? null;
  const hotFrom = hover?.from ?? null;

  // A mark hovered on the page brings its row into view; so does selecting one there.
  useEffect(() => {
    if (hotId && hotFrom === "page") revealRow(listRef.current, hotId);
  }, [hotId, hotFrom]);
  useEffect(() => {
    if (selectedId) revealRow(listRef.current, selectedId);
  }, [selectedId]);

  if (objects.length === 0) {
    return (
      <p className="object-empty">
        Nothing inserted yet. Text, shapes, emojis, signatures and pencil strokes you add to the pages are
        listed here.
      </p>
    );
  }

  return (
    <ul ref={listRef} className="object-list" aria-label="Inserted objects">
      {objects.map((row) => {
        const selected = row.id === selectedId;
        const hot = row.id === hotId;
        const name = `${row.number}, ${row.title}${row.detail ? `: ${row.detail}` : ""}${row.changed ? ", changed" : ""}, page ${row.page + 1}`;
        return (
          <li
            key={row.id}
            data-object-id={row.id}
            className={`object-row${selected ? " selected" : ""}${hot ? " hot" : ""}${row.changed ? " changed" : ""}`}
            onMouseEnter={() => onHover(row.id)}
            onMouseLeave={() => onHover(null)}
          >
            <button
              type="button"
              className="object-row-main"
              aria-label={name}
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelect(row.id)}
              onFocus={() => onHover(row.id)}
              onBlur={() => onHover(null)}
            >
              <span className="object-number" aria-hidden="true">
                {row.number}
              </span>
              <span className="object-icon" aria-hidden="true">
                <RowIcon icon={row.icon} />
              </span>
              <span className="object-text" aria-hidden="true">
                <span className="object-title">
                  {row.changed && <span className="object-change" title="Changed" />}
                  {row.title}
                </span>
                {row.detail && <span className="object-detail">{row.detail}</span>}
              </span>
              <span className="object-page" aria-hidden="true">
                p. {row.page + 1}
              </span>
            </button>
            <button
              type="button"
              className="object-remove"
              aria-label={`Remove ${name}`}
              title="Remove"
              onClick={() => onRemove(row.id)}
            >
              <Trash2 />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
