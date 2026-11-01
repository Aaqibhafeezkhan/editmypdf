import type { PatchAnnotation, Point, TextSpan } from "./types.ts";

export type LaidLine = { text: string; start: number; end: number; width: number; hard: boolean };

type Face = Pick<PatchAnnotation, "fontFamily" | "fontWeight" | "fontStyle" | "fontSize"> & {
  letterSpacing?: number;
  wordSpacing?: number;
};

type SpacedContext = CanvasRenderingContext2D & { letterSpacing?: string; wordSpacing?: string };

// Applies a face's letter and word spacing to a canvas context at the size it is about to draw or
// measure. Browsers without canvas spacing get none; measureWidth adds it by hand instead.
function applySpacing(context: SpacedContext, face: Face, size: number): boolean {
  if (!("letterSpacing" in context) || !("wordSpacing" in context)) return false;
  const factor = size / Math.max(face.fontSize, 0.01);
  context.letterSpacing = `${(face.letterSpacing ?? 0) * factor}px`;
  context.wordSpacing = `${(face.wordSpacing ?? 0) * factor}px`;
  return true;
}

function countOf(text: string, char: string): number {
  let count = 0;
  for (const item of text) if (item === char) count += 1;
  return count;
}

type Layout = Face &
  Pick<PatchAnnotation, "originW" | "wrap" | "indent" | "align" | "lineHeight" | "ascent" | "x" | "y" | "w" | "text"> & {
    spans?: TextSpan[];
    softBreaks?: number[];
    lineGaps?: number[];
  };

// A piece of one span that falls inside a laid-out line.
type Piece = { text: string; face: TextSpan };

// Extra width, in page units, allowed when wrapping so a line that just fits in the PDF is not broken one word early.
export const WRAP_SLACK = 1;

let context: CanvasRenderingContext2D | null = null;

function measurer(): CanvasRenderingContext2D | null {
  if (!context && typeof document !== "undefined") context = document.createElement("canvas").getContext("2d");
  return context;
}

export function fontCss(face: Face, size = face.fontSize): string {
  return `${face.fontStyle} ${face.fontWeight} ${size}px ${face.fontFamily}`;
}

export function measureWidth(text: string, face: Face, size = face.fontSize): number {
  if (!text) return 0;
  const canvas = measurer();
  if (!canvas) return text.length * size * 0.5;
  canvas.font = fontCss(face, size);
  canvas.fontKerning = "none";
  const spaced = applySpacing(canvas, face, size);
  const width = canvas.measureText(text).width;
  if (spaced) return width;
  const factor = size / Math.max(face.fontSize, 0.01);
  return width + (face.letterSpacing ?? 0) * factor * [...text].length + (face.wordSpacing ?? 0) * factor * countOf(text, " ");
}

export function spansText(spans: TextSpan[]): string {
  return spans.map((span) => span.text).join("");
}

// The spans that describe `text`, or none when the patch is single-face or its spans are stale.
function spansFor(text: string, patch: Layout): TextSpan[] {
  const spans = patch.spans ?? [];
  return spans.length > 0 && spansText(spans) === text ? spans : [];
}

// Splits text[from, to) by the span each character is set in.
function pieces(text: string, from: number, to: number, face: Face, spans: TextSpan[]): Piece[] {
  if (to <= from) return [];
  if (spans.length === 0) {
    const whole: TextSpan = {
      text: "",
      fontFamily: face.fontFamily,
      fontWeight: face.fontWeight,
      fontStyle: face.fontStyle,
      fontSize: face.fontSize,
      color: "",
      pdfFont: "",
    };
    return [{ text: text.slice(from, to), face: whole }];
  }
  const result: Piece[] = [];
  let cursor = 0;
  for (const span of spans) {
    const start = cursor;
    const end = cursor + span.text.length;
    cursor = end;
    if (end <= from) continue;
    if (start >= to) break;
    result.push({ text: span.text.slice(Math.max(from, start) - start, Math.min(to, end) - start), face: span });
  }
  return result;
}

// A span's face with the patch's letter and word spacing, which every run of a patch shares.
function spaced(span: TextSpan, patch: Face): Face {
  return { ...span, letterSpacing: patch.letterSpacing ?? 0, wordSpacing: patch.wordSpacing ?? 0 };
}

// The face for the text's `paragraph`th line between newlines: one of the page's own lines, while
// it is untouched, keeps the word gap the page gave it.
function paragraphFace(patch: Layout, paragraph: number): Face {
  const gap = patch.lineGaps?.[paragraph];
  return gap == null ? patch : { ...patch, wordSpacing: gap };
}

function paragraphOf(text: string, offset: number): number {
  let count = 0;
  for (let index = 0; index < offset && index < text.length; index += 1) if (text[index] === "\n") count += 1;
  return count;
}

// Width of text[from, to) when each character is measured in its own span's face.
function rangeWidth(text: string, from: number, to: number, face: Face, spans: TextSpan[]): number {
  let width = 0;
  for (const piece of pieces(text, from, to, face, spans)) width += measureWidth(piece.text, spaced(piece.face, face));
  return width;
}

export function blockWidth(patch: Pick<PatchAnnotation, "wrap" | "originW" | "w">): number {
  return patch.wrap ? patch.originW + WRAP_SLACK : Math.max(patch.w, 1);
}

function tokens(text: string): string[] {
  return text.match(/\S+?-(?=[^\s\d-])|\S+\s*|\s+/g) ?? [];
}

function laid(whole: string, text: string, start: number, face: Face, spans: TextSpan[], hard: boolean): LaidLine {
  const width = rangeWidth(whole, start, start + text.trimEnd().length, face, spans);
  return { text, start, end: start + text.length, width, hard };
}

// Breaks text into lines the way the browser lays out a pre-wrap editor of the block's width:
// at spaces and after hyphens, with trailing spaces hanging past the edge and long words
// overflowing. Each character is measured in its own span's face. A newline the page only broke
// for room (a soft break) ends a line that still counts as flowing, so it is justified like one.
export function wrapText(text: string, patch: Layout): LaidLine[] {
  const spans = spansFor(text, patch);
  const soft = new Set(patch.softBreaks ?? []);
  const limit = patch.wrap ? patch.originW + WRAP_SLACK : Infinity;
  const lines: LaidLine[] = [];
  let cursor = 0;
  text.split("\n").forEach((paragraph, index) => {
    const face = paragraphFace(patch, index);
    let lineStart = cursor;
    let lineText = "";
    for (const token of tokens(paragraph)) {
      const available = limit - (lines.length === 0 ? patch.indent : 0);
      const candidate = (lineText + token).trimEnd().length;
      if (lineText && rangeWidth(text, lineStart, lineStart + candidate, face, spans) > available) {
        lines.push(laid(text, lineText, lineStart, face, spans, false));
        lineStart += lineText.length;
        lineText = "";
      }
      lineText += token;
    }
    lines.push(laid(text, lineText, lineStart, face, spans, !soft.has(cursor + paragraph.length)));
    cursor += paragraph.length + 1;
  });
  return lines;
}

function countSpaces(text: string): number {
  let count = 0;
  for (const char of text) if (char === " ") count += 1;
  return count;
}

// Where a laid-out line starts inside the block, and how much extra width each space gets when justified.
export function lineX(patch: Layout, line: LaidLine, index: number, total: number): { x: number; extra: number } {
  const indent = index === 0 ? patch.indent : 0;
  const slack = blockWidth(patch) - indent - line.width;
  if (patch.align === "center") return { x: indent + slack / 2, extra: 0 };
  if (patch.align === "right") return { x: indent + slack, extra: 0 };
  if (patch.align === "justify" && !line.hard && index < total - 1) {
    const spaces = countSpaces(line.text.trimEnd());
    return { x: indent, extra: spaces > 0 && slack > 0 ? slack / spaces : 0 };
  }
  return { x: indent, extra: 0 };
}

// Distance from the top of a CSS line box to the alphabetic baseline for this face and line height.
export function lineBaselineOffset(patch: Layout, scale: number): number {
  const size = patch.fontSize * scale;
  let ascent = patch.ascent * size;
  let descent = Math.max(0, size - ascent);
  const canvas = measurer();
  if (canvas) {
    canvas.font = fontCss(patch, size);
    const metrics = canvas.measureText("Hg");
    if (typeof metrics.fontBoundingBoxAscent === "number" && typeof metrics.fontBoundingBoxDescent === "number") {
      ascent = metrics.fontBoundingBoxAscent;
      descent = metrics.fontBoundingBoxDescent;
    }
  }
  const lineHeight = patch.lineHeight * scale;
  return ((lineHeight - (ascent + descent)) / 2 + ascent) / scale;
}

// Top of the textarea so its first baseline lands on the PDF baseline.
export function editorTop(patch: Layout, scale: number): number {
  return patch.y + patch.ascent * patch.fontSize - lineBaselineOffset(patch, scale);
}

export function caretIndexAt(patch: PatchAnnotation, point: Point, scale: number): number {
  const lines = wrapText(patch.text, patch);
  const top = editorTop(patch, scale);
  const row = Math.max(0, Math.min(lines.length - 1, Math.floor((point.y - top) / Math.max(patch.lineHeight, 1))));
  const line = lines[row];
  if (!line) return patch.text.length;
  const { x, extra } = lineX(patch, line, row, lines.length);
  const local = point.x - patch.x - x;
  const text = line.text;
  const spans = spansFor(patch.text, patch);
  const face = paragraphFace(patch, paragraphOf(patch.text, line.start));
  let best = 0;
  let bestDistance = Infinity;
  let spaces = 0;
  for (let index = 0; index <= text.length; index += 1) {
    const width = rangeWidth(patch.text, line.start, line.start + index, face, spans) + spaces * extra;
    const distance = Math.abs(width - local);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
    if (text[index] === " ") spaces += 1;
  }
  const limit = line.hard ? text.length : text.trimEnd().length;
  return line.start + Math.min(best, limit);
}

// Paints the edited text at 3x for the exported PDF, laid out exactly like the on-page editor.
export async function paintRun(patch: PatchAnnotation): Promise<string> {
  if (!patch.text.trim()) return "";
  const spans = spansFor(patch.text, patch);
  const faces = new Set([fontCss(patch), ...spans.map((span) => fontCss(span))]);
  try {
    await Promise.all([...faces].map((css) => document.fonts.load(css)));
  } catch {
    // The face is registered by pdf.js when the page rendered; a failure here only affects fallbacks.
  }
  const lines = wrapText(patch.text, patch);
  const width = Math.max(blockWidth(patch), 1);
  const height = Math.max(patch.h, patch.fontSize, 1);
  const zoom = 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * zoom));
  canvas.height = Math.max(1, Math.ceil(height * zoom));
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.fontKerning = "none";
  context.textBaseline = "alphabetic";
  lines.forEach((line, index) => {
    const y = (patch.ascent * patch.fontSize + index * patch.lineHeight) * zoom;
    const { x, extra } = lineX(patch, line, index, lines.length);
    const end = line.start + line.text.trimEnd().length;
    const lineFace = paragraphFace(patch, paragraphOf(patch.text, line.start));
    let cursor = x;
    for (const piece of pieces(patch.text, line.start, end, patch, spans)) {
      const face = spans.length > 0 ? spaced(piece.face, lineFace) : lineFace;
      context.font = fontCss(face, face.fontSize * zoom);
      applySpacing(context, face, face.fontSize * zoom);
      context.fillStyle = spans.length > 0 ? piece.face.color || patch.color : patch.color;
      if (extra <= 0) {
        context.fillText(piece.text, cursor * zoom, y);
        cursor += measureWidth(piece.text, face);
        continue;
      }
      // Justified: every space in the line widens by the same amount, as the editor's text-align does.
      const spaceWidth = measureWidth(" ", face);
      const words = piece.text.split(" ");
      words.forEach((word, wordIndex) => {
        if (word) context.fillText(word, cursor * zoom, y);
        cursor += measureWidth(word, face);
        if (wordIndex < words.length - 1) cursor += spaceWidth + extra;
      });
    }
  });
  if (patch.underlineOffset >= 0) {
    context.fillStyle = patch.underlineColor || patch.color;
    context.fillRect(0, patch.underlineOffset * zoom, width * zoom, Math.max(1, 0.7 * zoom));
  }
  return canvas.toDataURL("image/png");
}
