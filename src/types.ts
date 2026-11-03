export type FontId = "helvetica" | "times" | "courier";

export type Align = "left" | "center" | "right";

export type TextAlign = Align | "justify";

export type Tool = "select" | "pencil" | "shape" | "emoji" | "signature" | "text" | "eraser";

export type Point = { x: number; y: number };

export type LineCap = "round" | "square" | "butt";

export type StrokeStyle = {
  color: string;
  strokeWidth: number;
  fill: string | null;
  fillOpacity: number;
  opacity: number;
  cap: LineCap;
  dash: string | null;
  brush: "pen" | "pencil" | "fountain" | "marker" | "highlighter" | "brush" | "crayon";
};

export type TextStyle = {
  fontId: FontId;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  // Optional so fields saved before it existed still load.
  strike?: boolean;
  align: Align;
  width: number;
  autoWidth: boolean;
  height: number | null;
};

type Base = { id: string; page: number };

export type InkAnnotation = Base & {
  kind: "ink";
  color: string;
  strokeWidth: number;
  opacity: number;
  cap: LineCap;
  dash: string | null;
  brush: StrokeStyle["brush"];
  points: Point[];
};

export type LineAnnotation = Base & {
  kind: "line";
  color: string;
  strokeWidth: number;
  head: "none" | "end" | "both";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type ShapeAnnotation = Base & {
  kind:
    | "rect"
    | "roundRect"
    | "ellipse"
    | "triangle"
    | "triangleLeft"
    | "triangleRight"
    | "triangleDown"
    | "rightTriangle"
    | "diamond"
    | "parallelogram"
    | "trapezoid"
    | "pentagon"
    | "hexagon"
    | "heptagon"
    | "octagon"
    | "nonagon"
    | "decagon"
    | "star"
    | "star4"
    | "star6"
    | "star8"
    | "burst"
    | "blockArrow"
    | "arrowLeft"
    | "arrowUp"
    | "arrowDown"
    | "arrowBothH"
    | "arrowBothV"
    | "quadArrow"
    | "bentArrow"
    | "notchedArrow"
    | "chevron"
    | "chevronLeft"
    | "chevronUp"
    | "chevronDown"
    | "heart"
    | "plus"
    | "cross"
    | "check"
    | "pill"
    | "cloud"
    | "lightning"
    | "moon"
    | "sun"
    | "speech"
    | "speechOval"
    | "thought"
    | "note"
    | "callout"
    | "bookmark"
    | "flag"
    | "pin"
    | "cylinder"
    | "cube"
    | "shield"
    | "document"
    | "delay"
    | "display"
    | "manualInput"
    | "storedData"
    | "curve"
    | "arc"
    | "wave"
    | "curvedArrow"
    | "elbow"
    | "elbowArrow"
    | "bracket"
    | "brace";
  color: string;
  strokeWidth: number;
  fill: string | null;
  fillOpacity: number;
  rotation: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TextAnnotation = Base & {
  kind: "text";
  x: number;
  y: number;
  text: string;
  rotation: number;
} & TextStyle;

export type EmojiAnnotation = Base & {
  kind: "emoji";
  emoji: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
};

export type SignatureAnnotation = Base & {
  kind: "signature";
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
};

// One run of a text patch set in its own face. A patch's spans, in order, concatenate to its text.
export type TextSpan = {
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontSize: number;
  color: string;
  // pdf.js name of the font the run was set in; identifies the face when the page is read again.
  pdfFont: string;
  // The run's own extra advance after every character, in page units, when it differs from the
  // patch's (a tracked word inside a line); absent means the patch's applies.
  letterSpacing?: number;
  // Lines the user drew under or through the run; the page's own text never carries either.
  underline?: boolean;
  strike?: boolean;
  // The run's weight, slant, size or colour was chosen by the user rather than read from the
  // page, so a refresh of the page's faces keeps them (the face itself is still refreshed).
  styled?: boolean;
};

export type PatchTail = {
  x: number;
  y: number;
  w: number;
  h: number;
  padBottom: number;
  image: string;
};

export type PatchAnnotation = Base & {
  kind: "patch";
  sourceId: string;
  role: "text" | "graphic";
  originX: number;
  originY: number;
  originW: number;
  originH: number;
  originText: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontSize: number;
  color: string;
  // pdf.js name of the font a single-face patch is set in (a mixed-face patch names them per
  // span); it finds the face's bytes when the edit is written back as text. Empty for graphics
  // and for patches saved before it existed.
  pdfFont: string;
  ascent: number;
  lineHeight: number;
  align: TextAlign;
  indent: number;
  // Extra advance after every character, in page units, as the PDF set the run (character
  // spacing, or glyph advances wider than the converted font's own).
  letterSpacing: number;
  // Extra advance after every space, in page units (the PDF's word spacing).
  wordSpacing: number;
  // Offsets of newlines in `text` that only exist because the page's column ran out of room. They
  // keep the page's own line breaks until the text is edited, when they become spaces and the text
  // flows again. Empty once edited.
  softBreaks: number[];
  // Extra advance after every space on each of the page's own lines, in page units, for as long
  // as that line is untouched: a generator may stretch a line only part of the way to the column.
  lineGaps: number[];
  // How far each of the page's own lines sits below where an even line pitch would put it, in
  // page units, for as long as that line is untouched: pages rarely space their lines evenly to
  // the point.
  lineOffsets: number[];
  // How far in from the block's left edge each of the page's own lines starts, in page units, for
  // as long as that line is untouched: a list or a table of contents indents its lines unevenly.
  lineIndents: number[];
  wrap: boolean;
  // The width a wrapped block's text flows in once the user has changed it (by dragging the
  // box's edge, or by breaking a single line into a cell's width), in page units; absent while the
  // block keeps the width the page gave it (`originW`).
  wrapW?: number;
  // Styled runs when the text mixes faces (a bold or italic word inside a paragraph); empty for a
  // single-face patch, whose face is the fields above.
  spans: TextSpan[];
  image: string;
  underlineOffset: number;
  underlineColor: string;
  backdrop: string;
  tails: PatchTail[];
  // Lines the user drew under or through a single-face patch's text (a mixed-face patch carries
  // them on its spans).
  underline?: boolean;
  strike?: boolean;
  // The patch's face, size, colour or alignment was chosen by the user rather than read from the
  // page: the edit counts as a change even while its words are the page's own.
  styled?: boolean;
};

export type Annotation =
  | InkAnnotation
  | LineAnnotation
  | ShapeAnnotation
  | TextAnnotation
  | EmojiAnnotation
  | SignatureAnnotation
  | PatchAnnotation;

export type PdfPointMapper = (
  page: number,
  x: number,
  y: number,
) => { x: number; y: number };

export const FONT_OPTIONS: { id: FontId; label: string; css: string }[] = [
  { id: "helvetica", label: "Helvetica", css: "Helvetica, Arial, sans-serif" },
  { id: "times", label: "Times", css: '"Times New Roman", Times, serif' },
  {
    id: "courier",
    label: "Courier",
    css: '"Courier New", Courier, monospace',
  },
];

export const SWATCHES = [
  "#111111",
  "#b91c1c",
  "#c2410c",
  "#a16207",
  "#15803d",
  "#1d4ed8",
  "#7e22ce",
  "#ffffff",
];

export function fontCss(id: FontId): string {
  return FONT_OPTIONS.find((font) => font.id === id)?.css ?? "sans-serif";
}

export function isStrokeAnnotation(
  annotation: Annotation,
): annotation is InkAnnotation | LineAnnotation | ShapeAnnotation {
  return (
    annotation.kind !== "text" &&
    annotation.kind !== "emoji" &&
    annotation.kind !== "signature" &&
    annotation.kind !== "patch"
  );
}

export function uid(): string {
  return crypto.randomUUID();
}
