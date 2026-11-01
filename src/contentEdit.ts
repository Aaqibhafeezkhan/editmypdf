import type { ContentElement } from "./content.ts";
import { wrapText } from "./textLayout.ts";
import type { EditCapture } from "./pageInk.ts";
import { uid, type PatchAnnotation, type PatchTail } from "./types.ts";

type Box = { x: number; y: number; w: number; h: number };

// The area the backdrop has to hide: the original run plus wherever the edited text now sits.
export function editCover(patch: PatchAnnotation): Box {
  const pad = patch.role === "text" ? patch.fontSize * 0.15 : 0;
  const boxes = [
    { ...originBox(patch), h: patch.originH + pad },
    { x: patch.x, y: patch.y, w: Math.max(patch.w, patch.wrap ? patch.originW : 0), h: patch.h + pad },
  ];
  const delta = patch.w - patch.originW;
  if (patch.role === "text" && !patch.wrap && Math.abs(delta) >= 0.4) {
    for (const tail of patch.tails ?? []) boxes.push(tailBox(tail), shiftedTail(tail, delta));
  }
  if (patch.role === "text" && patch.underlineOffset >= 0) {
    boxes.push({
      x: Math.min(patch.originX, patch.x),
      y: patch.y + patch.underlineOffset,
      w: Math.max(patch.originW, patch.w, 1),
      h: 1.6,
    });
  }
  // Glyph ink can start a little before the run's origin, so the backdrop reaches slightly past the box.
  return unionBoxes(boxes, patch.role === "text" ? Math.max(0.6, patch.fontSize * 0.1) : 0.35);
}

function originBox(patch: PatchAnnotation): Box {
  return { x: patch.originX, y: patch.originY, w: patch.originW, h: patch.originH };
}

function tailBox(tail: PatchTail): Box {
  return { x: tail.x, y: tail.y, w: tail.w, h: tail.h + tail.padBottom };
}

function shiftedTail(tail: PatchTail, delta: number): Box {
  return { x: tail.x + delta, y: tail.y, w: tail.w, h: tail.h + tail.padBottom };
}

function unionBoxes(boxes: Box[], pad: number): Box {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const box of boxes) {
    if (box.w <= 0 || box.h <= 0) continue;
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.w);
    bottom = Math.max(bottom, box.y + box.h);
  }
  if (!Number.isFinite(left)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: left - pad, y: top - pad, w: Math.max(1, right - left + pad * 2), h: Math.max(1, bottom - top + pad * 2) };
}

// Re-lays the patch for new text. A wrapped block keeps its width and grows downward when it needs
// more lines; a single run grows with its text. `measuredLines` is what the browser's textarea
// actually produced, which wins when it wrapped more than the measurement predicted.
export function layoutTextPatch(
  patch: PatchAnnotation,
  text: string,
  measuredLines = 0,
): Pick<PatchAnnotation, "text" | "w" | "h"> {
  const lines = wrapText(text, patch);
  const count = Math.max(1, lines.length, measuredLines);
  const h = Math.max(patch.originH, (count - 1) * patch.lineHeight + patch.fontSize);
  const w = patch.wrap ? patch.originW : Math.max(0, ...lines.map((line) => line.width));
  return { text, w, h };
}

export function textPatch(element: ContentElement, color: string, capture: EditCapture): PatchAnnotation {
  const wrap = element.kind === "paragraph";
  const text = element.text;
  const fontSize = element.fontSize || element.h;
  return {
    id: uid(),
    page: element.page,
    kind: "patch",
    sourceId: element.id,
    role: "text",
    originX: element.x,
    originY: element.y,
    originW: element.w,
    originH: element.h,
    originText: text,
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    rotation: 0,
    text,
    fontFamily: element.fontFamily || "sans-serif",
    fontWeight: element.fontWeight || 400,
    fontStyle: element.fontStyle || "normal",
    fontSize,
    color: color || element.color,
    ascent: element.ascent || 0.8,
    lineHeight: element.lineHeight || element.h,
    align: element.align,
    indent: element.indent,
    wrap,
    image: "",
    underlineOffset: wrap ? -1 : capture.underlineOffset,
    underlineColor: capture.underlineColor || element.color || color,
    backdrop: capture.backdrop || "#ffffff",
    tails: wrap ? [] : capture.tails,
  };
}

export function graphicPatch(element: ContentElement, image: string): PatchAnnotation {
  return {
    id: uid(),
    page: element.page,
    kind: "patch",
    sourceId: element.id,
    role: "graphic",
    originX: element.x,
    originY: element.y,
    originW: element.w,
    originH: element.h,
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    rotation: 0,
    text: element.text,
    fontFamily: "sans-serif",
    fontWeight: 400,
    fontStyle: "normal",
    fontSize: 0,
    color: "#111111",
    ascent: 0.8,
    lineHeight: element.h,
    align: "left",
    indent: 0,
    wrap: false,
    image,
    originText: "",
    underlineOffset: -1,
    underlineColor: "",
    backdrop: "#ffffff",
    tails: [],
  };
}

function pixelBox(canvas: HTMLCanvasElement, box: Box, pageWidth: number, pageHeight: number) {
  const sx = canvas.width / pageWidth;
  const sy = canvas.height / pageHeight;
  const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(box.x * sx)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(box.y * sy)));
  const w = Math.max(1, Math.min(canvas.width - x, Math.ceil(box.w * sx)));
  const h = Math.max(1, Math.min(canvas.height - y, Math.ceil(box.h * sy)));
  return { x, y, w, h };
}

// The ink colour of the text under a box, read from the rendered page: the average of its darkest
// ink pixels. Null when the region has too little ink to tell.
export function sampleColor(canvas: HTMLCanvasElement, box: Box, pageWidth: number, pageHeight: number): string | null {
  if (canvas.width < 2 || pageWidth < 1 || pageHeight < 1) return null;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const region = pixelBox(canvas, box, pageWidth, pageHeight);
  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(region.x, region.y, region.w, region.h).data;
  } catch {
    return null;
  }
  const backgroundR = pixels[0] ?? 255;
  const backgroundG = pixels[1] ?? 255;
  const backgroundB = pixels[2] ?? 255;
  const ink: { r: number; g: number; b: number; lum: number }[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index] ?? 0;
    const g = pixels[index + 1] ?? 0;
    const b = pixels[index + 2] ?? 0;
    const a = pixels[index + 3] ?? 0;
    if (a < 200) continue;
    if (Math.abs(r - backgroundR) + Math.abs(g - backgroundG) + Math.abs(b - backgroundB) < 48) continue;
    ink.push({ r, g, b, lum: r * 0.299 + g * 0.587 + b * 0.114 });
  }
  if (ink.length < 4) return null;
  ink.sort((a, b) => a.lum - b.lum);
  const darkest = ink.slice(0, Math.max(2, Math.ceil(ink.length * 0.15)));
  const channel = (pick: (pixel: { r: number; g: number; b: number }) => number) =>
    Math.round(darkest.reduce((sum, pixel) => sum + pick(pixel), 0) / darkest.length)
      .toString(16)
      .padStart(2, "0");
  return `#${channel((pixel) => pixel.r)}${channel((pixel) => pixel.g)}${channel((pixel) => pixel.b)}`;
}

export function cropGraphic(canvas: HTMLCanvasElement, box: Box, pageWidth: number, pageHeight: number): string {
  if (canvas.width < 2 || pageWidth < 1 || pageHeight < 1) return "";
  const region = pixelBox(canvas, box, pageWidth, pageHeight);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(region.w, region.h));
  const width = Math.max(1, Math.round(region.w * scale));
  const height = Math.max(1, Math.round(region.h * scale));
  const copy = document.createElement("canvas");
  copy.width = width;
  copy.height = height;
  const context = copy.getContext("2d");
  if (!context) return "";
  context.drawImage(canvas, region.x, region.y, region.w, region.h, 0, 0, width, height);
  return copy.toDataURL("image/png");
}
