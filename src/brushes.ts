import type { LineCap } from "./types.ts";

export type BrushId =
  | "pen"
  | "pencil"
  | "fountain"
  | "marker"
  | "highlighter"
  | "brush"
  | "crayon";

export type Brush = {
  id: BrushId;
  label: string;
  detail: string;
  width: number;
  opacity: number;
  cap: LineCap;
  dash: string | null;
};

export const BRUSHES: Brush[] = [
  {
    id: "pen",
    label: "Pen",
    detail: "Clean solid line",
    width: 2,
    opacity: 1,
    cap: "round",
    dash: null,
  },
  {
    id: "pencil",
    label: "Pencil",
    detail: "Light graphite stroke",
    width: 1,
    opacity: 0.72,
    cap: "round",
    dash: null,
  },
  {
    id: "fountain",
    label: "Fountain pen",
    detail: "Smooth writing nib",
    width: 3,
    opacity: 0.92,
    cap: "round",
    dash: null,
  },
  {
    id: "marker",
    label: "Marker",
    detail: "Broad flat stroke",
    width: 14,
    opacity: 0.88,
    cap: "square",
    dash: null,
  },
  {
    id: "highlighter",
    label: "Highlighter",
    detail: "Translucent wide stroke",
    width: 24,
    opacity: 0.35,
    cap: "square",
    dash: null,
  },
  {
    id: "brush",
    label: "Brush",
    detail: "Soft painted stroke",
    width: 8,
    opacity: 0.75,
    cap: "round",
    dash: null,
  },
  {
    id: "crayon",
    label: "Crayon",
    detail: "Textured wax stroke",
    width: 10,
    opacity: 0.7,
    cap: "round",
    dash: "1 3.5",
  },
];

export const DASHES: { id: string; label: string; dash: string | null }[] = [
  { id: "solid", label: "Solid", dash: null },
  { id: "dashed", label: "Dashed", dash: "10 8" },
  { id: "dotted", label: "Dotted", dash: "1.5 6" },
];

const BRUSH_IDS = new Set<string>(BRUSHES.map((brush) => brush.id));

export function isBrushId(value: unknown): value is BrushId {
  return typeof value === "string" && BRUSH_IDS.has(value);
}

export function brushById(id: BrushId): Brush {
  return BRUSHES.find((brush) => brush.id === id) ?? BRUSHES[0]!;
}
