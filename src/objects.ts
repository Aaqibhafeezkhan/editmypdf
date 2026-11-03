import { brushById } from "./brushes.ts";
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
};

const EMOJI_NAMES = new Map(EMOJI_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.name] as const)));

function firstWords(text: string, limit = 40): string | null {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return null;
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${space > limit / 2 ? cut.slice(0, space) : cut}…`;
}

function describe(annotation: Annotation): Omit<ObjectRow, "id" | "number" | "page"> {
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
    ...describe(annotation),
  }));
}
