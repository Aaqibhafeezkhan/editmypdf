import { useEffect, useId, useRef, useState } from "react";
import { Image as ImageIcon, Layers, Pencil, RotateCcw, Signature, TextCursorInput, Trash2, TriangleAlert, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PanelEmpty } from "./PanelChrome.tsx";
import { revealIn } from "./reveal.ts";
import { ShapeGlyph } from "./ShapeGlyph.tsx";
import type { ObjectHover, ObjectIcon, ObjectRow, Removal } from "./objects.ts";

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

// The button that takes a row's mark off the page, which asks first in a small panel anchored
// to it. For an edit of the page's own content it restores the original rather than deleting
// anything, and its icon, tooltip and question say so.
function RemoveButton({
  name,
  removal,
  open,
  onOpenChange,
  onRemove,
}: {
  name: string;
  removal: Removal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
}) {
  const titleId = useId();
  const textId = useId();
  const keepRef = useRef<HTMLButtonElement>(null);
  const Icon = removal.restores ? RotateCcw : Trash2;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={removal.restores ? "object-remove restore" : "object-remove"}
              aria-label={`${removal.confirm} ${name}`}
            >
              <Icon />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          {removal.hint}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="confirm-pop"
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={textId}
        side="left"
        align="center"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepRef.current?.focus({ preventScroll: true });
        }}
      >
        <div className="confirm-pop-body">
          <span className={removal.restores ? "confirm-pop-icon restore" : "confirm-pop-icon"} aria-hidden="true">
            {removal.restores ? <RotateCcw /> : <TriangleAlert />}
          </span>
          <strong id={titleId}>{removal.question}</strong>
        </div>
        <p id={textId} className="confirm-pop-text">
          {removal.hint}. Undo brings it back.
        </p>
        <div className="confirm-pop-actions">
          <Button ref={keepRef} type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Keep
          </Button>
          <Button
            type="button"
            size="sm"
            variant={removal.restores ? "default" : "destructive"}
            className={removal.restores ? "confirm-pop-yes restore" : "confirm-pop-yes"}
            onClick={onRemove}
          >
            <Icon />
            {removal.confirm}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
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
  // The row whose Remove is asking for confirmation; one at a time.
  const [confirming, setConfirming] = useState<string | null>(null);
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
      <PanelEmpty icon={<Layers />} title="Nothing added yet">
        Text, shapes, emoji, signatures and pencil strokes you add appear here, in order.
      </PanelEmpty>
    );
  }

  return (
    <ul ref={listRef} className="object-list" aria-label="Edits, in the order added">
      {objects.map((row) => {
        const selected = row.id === selectedId;
        const hot = row.id === hotId;
        const name = `${row.number}, ${row.title}${row.detail ? `: ${row.detail}` : ""}${row.changed ? ", changed" : ""}, page ${row.page + 1}`;
        return (
          <li
            key={row.id}
            data-object-id={row.id}
            className={`object-row${selected ? " selected" : ""}${hot ? " hot" : ""}${row.changed ? " changed" : ""}${confirming === row.id ? " confirming" : ""}`}
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
                p.{row.page + 1}
              </span>
            </button>
            <RemoveButton
              name={name}
              removal={row.removal}
              open={confirming === row.id}
              onOpenChange={(open) => setConfirming(open ? row.id : null)}
              onRemove={() => {
                setConfirming(null);
                onRemove(row.id);
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
