import type { PatchAnnotation, Point } from "./types.ts";

export type LaidLine = { text: string; start: number; end: number; width: number; hard: boolean };

type Face = Pick<PatchAnnotation, "fontFamily" | "fontWeight" | "fontStyle" | "fontSize">;

type Layout = Face &
  Pick<PatchAnnotation, "originW" | "wrap" | "indent" | "align" | "lineHeight" | "ascent" | "x" | "y" | "w" | "text">;

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
  return canvas.measureText(text).width;
}

export function blockWidth(patch: Pick<PatchAnnotation, "wrap" | "originW" | "w">): number {
  return patch.wrap ? patch.originW + WRAP_SLACK : Math.max(patch.w, 1);
}

function tokens(text: string): string[] {
  return text.match(/\S+?-(?=[^\s\d-])|\S+\s*|\s+/g) ?? [];
}

function laid(text: string, start: number, face: Face, hard: boolean): LaidLine {
  return { text, start, end: start + text.length, width: measureWidth(text.trimEnd(), face), hard };
}

// Breaks text into lines the way the browser lays out a pre-wrap textarea of the block's width:
// at spaces and after hyphens, with trailing spaces hanging past the edge and long words overflowing.
export function wrapText(text: string, patch: Layout): LaidLine[] {
  const limit = patch.wrap ? patch.originW + WRAP_SLACK : Infinity;
  const lines: LaidLine[] = [];
  let cursor = 0;
  for (const paragraph of text.split("\n")) {
    let lineStart = cursor;
    let lineText = "";
    for (const token of tokens(paragraph)) {
      const available = limit - (lines.length === 0 ? patch.indent : 0);
      if (lineText && measureWidth((lineText + token).trimEnd(), patch) > available) {
        lines.push(laid(lineText, lineStart, patch, false));
        lineStart += lineText.length;
        lineText = "";
      }
      lineText += token;
    }
    lines.push(laid(lineText, lineStart, patch, true));
    cursor += paragraph.length + 1;
  }
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
  let best = 0;
  let bestDistance = Infinity;
  let spaces = 0;
  for (let index = 0; index <= text.length; index += 1) {
    const width = measureWidth(text.slice(0, index), patch) + spaces * extra;
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
  try {
    await document.fonts.load(fontCss(patch));
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
  context.font = fontCss(patch, patch.fontSize * zoom);
  context.fontKerning = "none";
  context.fillStyle = patch.color;
  context.textBaseline = "alphabetic";
  const spaceWidth = measureWidth(" ", patch);
  lines.forEach((line, index) => {
    const y = (patch.ascent * patch.fontSize + index * patch.lineHeight) * zoom;
    const { x, extra } = lineX(patch, line, index, lines.length);
    const text = line.text.trimEnd();
    if (extra <= 0) {
      context.fillText(text, x * zoom, y);
      return;
    }
    let cursor = x;
    const words = text.split(" ");
    words.forEach((word, wordIndex) => {
      if (word) context.fillText(word, cursor * zoom, y);
      cursor += measureWidth(word, patch);
      if (wordIndex < words.length - 1) cursor += spaceWidth + extra;
    });
  });
  if (patch.underlineOffset >= 0) {
    context.fillStyle = patch.underlineColor || patch.color;
    context.fillRect(0, patch.underlineOffset * zoom, width * zoom, Math.max(1, 0.7 * zoom));
  }
  return canvas.toDataURL("image/png");
}
