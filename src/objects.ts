import { brushById } from "./brushes.ts";
import { patchChanged } from "./changes.ts";
import { EMOJI_GROUPS, emojiSrc } from "./emojis.ts";
import { isBoxShape, SHAPE_LABEL, shapeFromLine, type ShapeId } from "./shapes.ts";
import type { Annotation } from "./types.ts";

export type HoverSource = "list" | "page";

export type ObjectHover = { id: string; from: HoverSource };

export type ObjectIcon =
  | { kind: "shape"; id: ShapeId }
  | { kind: "picture"; src: string; wide: boolean }
  | { kind: "text" | "pencil" | "signature" | "patch" | "graphic" };

// One row of the object list: an inserted mark, numbered in insertion order.
export type ObjectRow = {
  id: string;
  number: number;
  page: number;
  title: string;
  detail: string | null;
  icon: ObjectIcon;
  // Whether the mark changes the page's own content: an edited run whose words, look, place or
  // width differ from the page's. Marks the user added are never "changes".
  changed: boolean;
  // What taking the mark off the page does: see `Removal`.
  removal: Removal;
};

// What taking a mark off the page does. An object the user added is deleted. An edit of the
// page's own content is not: letting it go brings the page's original text or graphic back, so
// every button, menu item and confirm panel that does it says "restore", never "delete".
export type Removal = {
  restores: boolean;
  // The action's name on a button or menu item.
  label: string;
  // What it does, for the tooltip and the confirm panel.
  hint: string;
  // The question the confirm panel asks, and the button that agrees.
  question: string;
  confirm: string;
};

export function removalFor(mark: { kind: Annotation["kind"]; role?: "text" | "graphic" } | null): Removal {
  if (mark?.kind === "patch") {
    const graphic = mark.role === "graphic";
    return {
      restores: true,
      label: "Restore original",
      hint: graphic
        ? "Removes your change and puts the page's own graphic back where it was"
        : "Removes your edit and brings back the page's own text",
      question: graphic ? "Restore the original graphic?" : "Restore the original text?",
      confirm: "Restore",
    };
  }
  return {
    restores: false,
    label: "Delete selection",
    hint: "Removes this object from the page",
    question: "Remove this object?",
    confirm: "Remove",
  };
}

const EMOJI_NAMES = new Map(EMOJI_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.name] as const)));

function firstWords(text: string, limit = 40): string | null {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return null;
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${space > limit / 2 ? cut.slice(0, space) : cut}…`;
}

function describe(annotation: Annotation): Omit<ObjectRow, "id" | "number" | "page" | "changed" | "removal"> {
  switch (annotation.kind) {
    case "text":
      return { title: "Text", detail: firstWords(annotation.text) ?? "Empty", icon: { kind: "text" } };
    case "ink":
      return { title: `${brushById(annotation.brush ?? "pen").label} stroke`, detail: null, icon: { kind: "pencil" } };
    case "line": {
      const id = shapeFromLine(annotation.head);
      return { title: SHAPE_LABEL[id], detail: null, icon: { kind: "shape", id } };
    }
    case "emoji":
      return {
        title: "Emoji",
        detail: EMOJI_NAMES.get(annotation.emoji) ?? null,
        icon: { kind: "picture", src: emojiSrc(annotation.emoji), wide: false },
      };
    case "signature":
      return { title: "Signature", detail: null, icon: { kind: "picture", src: annotation.src, wide: true } };
    case "patch":
      return annotation.role === "text"
        ? { title: "Edited text", detail: firstWords(annotation.text), icon: { kind: "patch" } }
        : { title: "Edited graphic", detail: null, icon: { kind: "graphic" } };
    default:
      if (isBoxShape(annotation)) {
        return { title: SHAPE_LABEL[annotation.kind], detail: null, icon: { kind: "shape", id: annotation.kind } };
      }
      return { title: "Mark", detail: null, icon: { kind: "graphic" } };
  }
}

// Numbers follow insertion order (the order marks are kept in), so a mark keeps its number while
// it is edited and moved; removing one renumbers those after it.
export function describeObjects(annotations: Annotation[]): ObjectRow[] {
  return annotations.map((annotation, index) => ({
    id: annotation.id,
    number: index + 1,
    page: annotation.page,
    changed: annotation.kind === "patch" && patchChanged(annotation),
    removal: removalFor(annotation),
    ...describe(annotation),
  }));
}
