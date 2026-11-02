import { isTextContent, type ContentElement } from "./content.ts";
import type { PatchTail } from "./types.ts";

const TAIL_PAD = 1.6;

export type EditCapture = {
  underlineOffset: number;
  underlineColor: string;
  backdrop: string;
  tails: PatchTail[];
};

type Box = { x: number; y: number; w: number; h: number };

type PixelBox = Box & { scaleX: number; scaleY: number };

type RGB = { r: number; g: number; b: number };

function pixelBox(canvas: HTMLCanvasElement, box: Box, pageWidth: number, pageHeight: number, extraBottom = 0): PixelBox | null {
  if (canvas.width < 2 || pageWidth < 1 || pageHeight < 1 || box.w < 0.4 || box.h < 0.4) return null;
  const scaleX = canvas.width / pageWidth;
  const scaleY = canvas.height / pageHeight;
  const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(box.x * scaleX)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(box.y * scaleY)));
  const w = Math.max(1, Math.min(canvas.width - x, Math.ceil(box.w * scaleX)));
  const h = Math.max(1, Math.min(canvas.height - y, Math.ceil((box.h + extraBottom) * scaleY)));
  return { x, y, w, h, scaleX, scaleY };
}

function snap(canvas: HTMLCanvasElement, region: PixelBox): string {
  const copy = document.createElement("canvas");
  copy.width = region.w;
  copy.height = region.h;
  const context = copy.getContext("2d");
  if (!context) return "";
  context.drawImage(canvas, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
  return copy.toDataURL("image/png");
}

function channel(values: number[]): number {
  if (values.length === 0) return 255;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 255;
}

function sampleBackground(data: Uint8ClampedArray, width: number, height: number): RGB {
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  const take = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = (y * width + x) * 4;
    red.push(data[index] ?? 255);
    green.push(data[index + 1] ?? 255);
    blue.push(data[index + 2] ?? 255);
  };
  const steps = Math.max(2, Math.min(8, Math.floor(width / 8)));
  for (let step = 0; step < steps; step += 1) {
    const x = Math.min(width - 1, Math.round((width - 1) * (step / (steps - 1 || 1))));
    take(x, 0);
    take(x, 1);
  }
  take(0, Math.min(height - 1, 2));
  take(width - 1, Math.min(height - 1, 2));
  return { r: channel(red), g: channel(green), b: channel(blue) };
}

function colorDistance(data: Uint8ClampedArray, index: number, color: RGB): number {
  return (
    Math.abs((data[index] ?? 0) - color.r) +
    Math.abs((data[index + 1] ?? 0) - color.g) +
    Math.abs((data[index + 2] ?? 0) - color.b)
  );
}

function isInk(data: Uint8ClampedArray, index: number, background: RGB): boolean {
  const alpha = data[index + 3] ?? 0;
  return alpha > 128 && colorDistance(data, index, background) > 72;
}

function rowInk(data: Uint8ClampedArray, width: number, y: number, background: RGB): number {
  let count = 0;
  for (let x = 0; x < width; x += 1) {
    if (isInk(data, (y * width + x) * 4, background)) count += 1;
  }
  return count;
}

function findUnderline(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  background: RGB,
): { top: number; color: string } | null {
  const start = Math.floor(height * 0.62);
  const lineRow = (y: number) => {
    const count = rowInk(data, width, y, background);
    const above = y > 0 ? rowInk(data, width, y - 1, background) : count;
    return count > width * 0.45 && above < width * 0.22;
  };
  let runStart = -1;
  let chosen = -1;
  const close = (end: number) => {
    if (runStart < 0) return;
    const thickness = end - runStart;
    if (thickness >= 1 && thickness <= 3) chosen = runStart;
    runStart = -1;
  };
  for (let y = start; y <= height; y += 1) {
    if (y < height && lineRow(y)) {
      if (runStart < 0) runStart = y;
    } else close(y);
  }
  if (chosen < 0) return null;
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;
  for (let x = 0; x < width; x += 3) {
    const index = (chosen * width + x) * 4;
    if (!isInk(data, index, background)) continue;
    red += data[index] ?? 0;
    green += data[index + 1] ?? 0;
    blue += data[index + 2] ?? 0;
    samples += 1;
  }
  if (samples < 1) return null;
  return { top: chosen, color: hexColor({ r: red / samples, g: green / samples, b: blue / samples }) };
}

function hexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function hexColor(color: RGB): string {
  return `#${hexByte(color.r)}${hexByte(color.g)}${hexByte(color.b)}`;
}

// Looks at the rendered pixels under a run for its background colour and a single-line underline.
function inspectRun(
  canvas: HTMLCanvasElement,
  element: ContentElement,
  pageWidth: number,
  pageHeight: number,
): { underlineOffset: number; underlineColor: string; backdrop: string } | null {
  const region = pixelBox(canvas, element, pageWidth, pageHeight, 2);
  if (!region) return null;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(region.x, region.y, region.w, region.h).data;
  } catch {
    return null;
  }
  // A canvas nothing has been painted on yet is transparent, which would read as black paper.
  let painted = false;
  for (let index = 3; index < pixels.length; index += 4) {
    if ((pixels[index] ?? 0) > 0) {
      painted = true;
      break;
    }
  }
  if (!painted) return null;
  const background = sampleBackground(pixels, region.w, region.h);
  const underline = element.kind === "paragraph" ? null : findUnderline(pixels, region.w, region.h, background);
  return {
    underlineOffset: underline ? underline.top / region.scaleY : -1,
    underlineColor: underline?.color ?? element.color,
    backdrop: hexColor(background),
  };
}

// Runs on the same baseline immediately to the right of the edited one; they shift when its width changes.
// What sits to the right of a line and moves along when it grows: the next runs of text on the
// same baseline, and the small shapes and images between and around them (an icon before a
// date, the rounded box behind a tag), as long as nothing leaves a gap wider than a few letters.
function followingRuns(element: ContentElement, elements: ContentElement[], edited: Set<string>): ContentElement[] {
  const size = Math.max(element.fontSize || element.h, 1);
  const row = elements
    .filter((item) => {
      if (item.id === element.id || item.page !== element.page || item.x < element.x + element.w - 1.5) return false;
      if (isTextContent(item.kind)) {
        return item.kind !== "paragraph" && Math.abs(item.baseline - element.baseline) < size * 0.45;
      }
      if (item.kind !== "shape" && item.kind !== "image") return false;
      const overlap = Math.min(item.y + item.h, element.y + element.h) - Math.max(item.y, element.y);
      return item.h <= size * 3 && item.w <= size * 24 && overlap > Math.min(item.h, element.h) * 0.5;
    })
    .sort((a, b) => a.x - b.x);
  const kept: ContentElement[] = [];
  let edge = element.x + element.w;
  for (const item of row) {
    if (item.x - edge > size * 1.75) break;
    // A neighbour that is being edited itself shows its own text; a picture of the page there
    // would show the old words over it, so the row stops at it.
    if (edited.has(item.id)) break;
    kept.push(item);
    edge = Math.max(edge, item.x + item.w);
  }
  return kept;
}

export function captureEdit(
  canvas: HTMLCanvasElement,
  element: ContentElement,
  elements: ContentElement[],
  pageWidth: number,
  pageHeight: number,
  edited: Set<string> = new Set(),
): EditCapture {
  const found = inspectRun(canvas, element, pageWidth, pageHeight);
  const tails: PatchTail[] = [];
  if (element.kind !== "paragraph") {
    for (const tail of followingRuns(element, elements, edited)) {
      const region = pixelBox(canvas, tail, pageWidth, pageHeight, TAIL_PAD);
      if (!region) continue;
      const image = snap(canvas, region);
      if (!image) continue;
      tails.push({ x: tail.x, y: tail.y, w: tail.w, h: tail.h, padBottom: TAIL_PAD, image });
    }
  }
  return {
    underlineOffset: found?.underlineOffset ?? -1,
    underlineColor: found?.underlineColor || element.color || "#111111",
    backdrop: found?.backdrop || "#ffffff",
    tails,
  };
}
