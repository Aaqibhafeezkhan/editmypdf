import type { PatchAnnotation, Point, TextSpan } from "./types.ts";

export type LaidLine = { text: string; start: number; end: number; width: number; hard: boolean };

export type Face = Pick<PatchAnnotation, "fontFamily" | "fontWeight" | "fontStyle" | "fontSize"> & {
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
    wrapW?: number;
    spans?: TextSpan[];
    softBreaks?: number[];
    lineGaps?: number[];
    lineOffsets?: number[];
    lineIndents?: number[];
  };

// A piece of one span that falls inside a laid-out line.
type Piece = { text: string; face: TextSpan };

// Extra width, in page units, allowed when wrapping so a line that just fits in the PDF is not
// broken one word early. A ragged block gets a quarter em: a face standing in for the page's
// (one the page only has as outlines) measures its lines a hair differently from the page, and
// without the slack a word at the end of a line drops to the next one the moment the block is
// edited. A justified block keeps the slack at a point, since its lines are stretched to the
// block's width and must stay flush with the column.
export function wrapSlack(patch: Pick<PatchAnnotation, "align" | "fontSize">): number {
  return patch.align === "justify" ? 1 : Math.max(1, patch.fontSize * 0.25);
}

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

// A span's face with its spacing: its own letter spacing when the page tracked it apart from the
// rest, else the patch's, and the patch's word spacing, which every run of a patch shares.
function spaced(span: TextSpan, patch: Face): Face {
  return { ...span, letterSpacing: span.letterSpacing ?? patch.letterSpacing ?? 0, wordSpacing: patch.wordSpacing ?? 0 };
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

// The width a wrapped block's lines flow in: the one the user chose, else the page's own.
export function flowWidth(patch: Pick<PatchAnnotation, "originW" | "wrapW">): number {
  return patch.wrapW ?? patch.originW;
}

export function blockWidth(patch: Pick<PatchAnnotation, "wrap" | "originW" | "wrapW" | "w" | "align" | "fontSize">): number {
  return patch.wrap ? flowWidth(patch) + wrapSlack(patch) : Math.max(patch.w, 1);
}

// How far the `index`th line starts in from the block's edge: where the page put it while the
// line is its own, else the first-line indent, or for a hanging indent (a negative `indent`) the
// amount every later line is set in by.
export function lineIndent(patch: Pick<Layout, "indent" | "lineIndents">, index: number): number {
  const own = patch.lineIndents?.[index];
  if (own != null) return own;
  return index === 0 ? Math.max(0, patch.indent) : Math.max(0, -patch.indent);
}

// How far below an even line pitch the `index`th line sits. Lines the page positioned carry
// their own offset; a line flowing after them keeps the last one's, so it follows at an even pitch.
export function lineShift(offsets: number[] | undefined, index: number): number {
  if (!offsets || offsets.length === 0 || index < 0) return 0;
  return offsets[Math.min(index, offsets.length - 1)] ?? 0;
}

// The width centred and right-aligned lines are set against: the page's own, since the wrap
// slack would move them; lines flowing left use the slack.
function alignWidth(patch: Layout): number {
  if (patch.align === "center" || patch.align === "right") return patch.wrap ? flowWidth(patch) : Math.max(patch.w, 1);
  return blockWidth(patch);
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
  const limit = patch.wrap ? flowWidth(patch) + wrapSlack(patch) : Infinity;
  const lines: LaidLine[] = [];
  let cursor = 0;
  text.split("\n").forEach((paragraph, index) => {
    const face = paragraphFace(patch, index);
    let lineStart = cursor;
    let lineText = "";
    for (const token of tokens(paragraph)) {
      const available = limit - lineIndent(patch, lines.length);
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
  const indent = lineIndent(patch, index);
  const slack = alignWidth(patch) - indent - line.width;
  if (patch.align === "center") return { x: indent + slack / 2, extra: 0 };
  if (patch.align === "right") return { x: indent + slack, extra: 0 };
  // A line the page gave a word gap is set exactly as printed and is not stretched.
  const gapped = patch.lineGaps?.[paragraphOf(patch.text, line.start)] != null;
  if (patch.align === "justify" && !line.hard && index < total - 1 && !gapped) {
    const spaces = countSpaces(line.text.trimEnd());
    return { x: indent, extra: spaces > 0 && slack > 0 ? slack / spaces : 0 };
  }
  return { x: indent, extra: 0 };
}

const baselineCache = new Map<string, number>();
let baselineProbe: { root: HTMLDivElement; marker: HTMLSpanElement } | null = null;

// Distance from the top of a CSS line box to the alphabetic baseline for this face and line
// height, in page units. The browser rounds a font's ascent and descent to whole pixels when it
// builds a line box, so the offset is measured on a hidden line set exactly like the editor's
// rather than computed from the font's metrics.
export function lineBaselineOffset(patch: Layout, scale: number): number {
  const size = patch.fontSize * scale;
  const lineHeight = patch.lineHeight * scale;
  const css = fontCss(patch, size);
  if (typeof document === "undefined" || !document.body) return metricBaselineOffset(patch, scale);
  const key = `${css}|${lineHeight}`;
  const cached = baselineCache.get(key);
  if (cached != null) return cached / scale;
  if (!baselineProbe) {
    const root = document.createElement("div");
    root.setAttribute("aria-hidden", "true");
    root.style.cssText =
      "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;white-space:pre;font-kerning:none;font-variant-ligatures:none;padding:0;border:0;margin:0";
    const marker = document.createElement("span");
    marker.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    root.append(document.createTextNode("Hg"), marker);
    baselineProbe = { root, marker };
  }
  const { root, marker } = baselineProbe;
  root.style.font = css;
  root.style.lineHeight = `${lineHeight}px`;
  document.body.append(root);
  const offset = marker.getBoundingClientRect().top - root.getBoundingClientRect().top;
  root.remove();
  if (!Number.isFinite(offset) || offset <= 0) return metricBaselineOffset(patch, scale);
  // A face still loading measures with its fallback; only a settled face is worth remembering.
  // pdf.js registers a page's fonts as it draws them, so right after a document opens the face
  // may not exist yet: `check` then says "settled" because there is nothing to wait for, while
  // the probe measured the fallback. Such a face is measured again on the next render instead.
  let settled = true;
  try {
    settled = document.fonts.check(css) && faceRegistered(patch.fontFamily);
  } catch {
    settled = true;
  }
  if (settled) baselineCache.set(key, offset);
  return offset / scale;
}

// Whether the first family of a font list is available: a face pdf.js (or the editor) registered
// must be in the document's font set; a system family is taken as present.
function faceRegistered(fontFamily: string): boolean {
  const first = (fontFamily.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
  if (!/^g_d\d+_f\d+/.test(first) && !/-edit\d*$/.test(first)) return true;
  let found = false;
  document.fonts.forEach((face) => {
    if (face.family.replace(/^["']|["']$/g, "") === first) found = true;
  });
  return found;
}

function metricBaselineOffset(patch: Layout, scale: number): number {
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
  // The row whose box holds the point, the rows sitting where the page put them.
  let row = lines.length - 1;
  for (let index = 0; index < lines.length; index += 1) {
    const rowTop = top + index * patch.lineHeight + lineShift(patch.lineOffsets, index);
    if (point.y < rowTop + patch.lineHeight) {
      row = index;
      break;
    }
  }
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

export type RangeBox = { x: number; y: number; w: number; h: number };

// Where text[from, to) sits on the page, in page units: one box per line the range touches, laid
// out exactly as the editor draws the text. A wrapped block's boxes are as tall as its line pitch
// (capped near the glyph box, so the bands of two lines just meet); a single run's are its height.
export function rangeBoxes(patch: PatchAnnotation, from: number, to: number): RangeBox[] {
  const text = patch.text;
  const start = Math.max(0, Math.min(from, text.length));
  const end = Math.max(0, Math.min(to, text.length));
  if (end <= start) return [];
  const spans = spansFor(text, patch);
  const lines = wrapText(text, patch);
  const boxes: RangeBox[] = [];
  const height = patch.wrap ? Math.min(patch.lineHeight, patch.fontSize * 1.25) : Math.max(patch.fontSize, patch.h);
  lines.forEach((line, index) => {
    const lineEnd = line.start + line.text.length;
    const first = Math.max(start, line.start);
    const last = Math.min(end, lineEnd);
    if (last <= first) return;
    const { x, extra } = lineX(patch, line, index, lines.length);
    const face = paragraphFace(patch, paragraphOf(text, line.start));
    const left = x + rangeWidth(text, line.start, first, face, spans) + countSpaces(text.slice(line.start, first)) * extra;
    const right = x + rangeWidth(text, line.start, last, face, spans) + countSpaces(text.slice(line.start, last)) * extra;
    const top = index * patch.lineHeight + lineShift(patch.lineOffsets, index);
    boxes.push({ x: patch.x + left, y: patch.y + top, w: Math.max(0.5, right - left), h: height });
  });
  return boxes;
}

// Whether a run is underlined or struck through: its own flags, else the patch's.
export function runDecoration(
  span: Pick<TextSpan, "underline" | "strike"> | null,
  patch: Pick<PatchAnnotation, "underline" | "strike">,
): { underline: boolean; strike: boolean } {
  return { underline: !!(span ? span.underline : patch.underline), strike: !!(span ? span.strike : patch.strike) };
}

// Where a line under or through text of `fontSize` sits, measured from the baseline (positive
// is below), and how thick it is; the same on the page, in the painted fallback and in the PDF.
export function decorationLine(fontSize: number, kind: "underline" | "strike"): { offset: number; thickness: number } {
  return { offset: kind === "underline" ? fontSize * 0.11 : -fontSize * 0.3, thickness: Math.max(0.5, fontSize * 0.06) };
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
    const y = (patch.ascent * patch.fontSize + index * patch.lineHeight + lineShift(patch.lineOffsets, index)) * zoom;
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

// One span piece of a laid-out line, ready to be written as text: its words with the left edge of
// each in page units, the baseline they sit on measured from the top of the page, and the face
// (spacing resolved) and colour they are set in. `span` is the patch span the piece came from,
// null for a single-face patch.
export type PlacedRun = {
  words: { text: string; x: number }[];
  baseline: number;
  face: Face;
  color: string;
  span: TextSpan | null;
};

// Places the patch's text word by word exactly where paintRun paints it.
export function placeRuns(patch: PatchAnnotation): PlacedRun[] {
  if (!patch.text.trim()) return [];
  const spans = spansFor(patch.text, patch);
  const lines = wrapText(patch.text, patch);
  const runs: PlacedRun[] = [];
  lines.forEach((line, index) => {
    const baseline = patch.y + patch.ascent * patch.fontSize + index * patch.lineHeight + lineShift(patch.lineOffsets, index);
    const { x, extra } = lineX(patch, line, index, lines.length);
    const end = line.start + line.text.trimEnd().length;
    const lineFace = paragraphFace(patch, paragraphOf(patch.text, line.start));
    let cursor = patch.x + x;
    for (const piece of pieces(patch.text, line.start, end, patch, spans)) {
      const face = spans.length > 0 ? spaced(piece.face, lineFace) : lineFace;
      const gap = measureWidth(" ", face) + extra;
      const words: { text: string; x: number }[] = [];
      const parts = piece.text.split(" ");
      parts.forEach((word, wordIndex) => {
        if (word) words.push({ text: word, x: cursor });
        cursor += measureWidth(word, face);
        if (wordIndex < parts.length - 1) cursor += gap;
      });
      if (words.length === 0) continue;
      runs.push({
        words,
        baseline,
        face,
        color: spans.length > 0 ? piece.face.color || patch.color : patch.color,
        span: spans.length > 0 ? piece.face : null,
      });
    }
  });
  return runs;
}
