import { isTextContent, type ContentElement } from "./content.ts";
import type { PatchAnnotation, PatchGlyph, PatchTail } from "./types.ts";

const TAIL_PAD = 1.6;

export type GlyphPiece = {
  char: string;
  x: number;
  advance: number;
  glyph: PatchGlyph | null;
};

export type EditCapture = {
  glyphs: PatchGlyph[];
  spaceAdvance: number;
  underlineOffset: number;
  underlineColor: string;
  backdrop: string;
  tails: PatchTail[];
};

type PixelBox = { x: number; y: number; w: number; h: number; scaleX: number; scaleY: number };

let measureContext: CanvasRenderingContext2D | null = null;
const stamped = new Map<string, string>();

export function stampChar(
  char: string,
  fontName: string,
  fontSize: number,
  color: string,
  height: number,
  ascent: number,
): string {
  if (!char.trim() || !fontName) return "";
  const key = [fontName, fontSize.toFixed(2), color, height.toFixed(2), ascent.toFixed(3), char].join("|");
  const cached = stamped.get(key);
  if (cached) return cached;
  const width = Math.max(measureChar(char, fontName, fontSize), 1);
  const zoom = 4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * zoom));
  canvas.height = Math.max(1, Math.ceil(height * zoom));
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.font = `${fontSize * zoom}px "${fontName}"`;
  context.fillStyle = color;
  context.textBaseline = "alphabetic";
  context.fillText(char, 0, Math.min(ascent * fontSize, height) * zoom);
  const src = canvas.toDataURL("image/png");
  stamped.set(key, src);
  return src;
}

function measureChar(char: string, fontName: string, fontSize: number): number {
  if (!measureContext) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext || !fontName) return fontSize * 0.5;
  measureContext.font = `${fontSize}px "${fontName}"`;
  return measureContext.measureText(char).width;
}

function pixelBox(
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; w: number; h: number },
  pageWidth: number,
  pageHeight: number,
  extraBottom = 0,
): PixelBox | null {
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

type RGB = { r: number; g: number; b: number };

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
  return Math.abs((data[index] ?? 0) - color.r) + Math.abs((data[index + 1] ?? 0) - color.g) + Math.abs((data[index + 2] ?? 0) - color.b);
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

function findUnderline(data: Uint8ClampedArray, width: number, height: number, background: RGB): { top: number; color: string } | null {
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
  const hex = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return { top: chosen, color: `#${hex(red / samples)}${hex(green / samples)}${hex(blue / samples)}` };
}

function inkColumns(data: Uint8ClampedArray, width: number, height: number, background: RGB, skipFrom: number): Uint8Array {
  const columns = new Uint8Array(width);
  const limit = skipFrom >= 0 ? skipFrom : height;
  for (let y = 0; y < limit; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isInk(data, (y * width + x) * 4, background)) columns[x] = 1;
    }
  }
  return columns;
}

function blobsFrom(columns: Uint8Array): { x0: number; x1: number }[] {
  const found: { x0: number; x1: number }[] = [];
  let start = -1;
  let last = -1;
  for (let x = 0; x <= columns.length; x += 1) {
    if (x < columns.length && columns[x]) {
      if (start < 0) start = x;
      last = x;
      continue;
    }
    if (start >= 0) {
      found.push({ x0: start, x1: last + 1 });
      start = -1;
      last = -1;
    }
  }
  return found;
}

function lettersOf(text: string): string[] {
  return [...text].filter((char) => char !== " " && char !== "\n");
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function hexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function hexColor(color: RGB): string {
  return `#${hexByte(color.r)}${hexByte(color.g)}${hexByte(color.b)}`;
}

function cropGlyph(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  x1: number,
  background: RGB,
  skipFrom: number,
): string {
  const cropWidth = Math.max(1, x1 - x0);
  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = Math.max(1, height);
  const context = canvas.getContext("2d");
  if (!context) return "";
  const image = context.createImageData(cropWidth, canvas.height);
  let inkRed = 0;
  let inkGreen = 0;
  let inkBlue = 0;
  let inkCount = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < cropWidth; x += 1) {
      const index = (y * width + x0 + x) * 4;
      if (!isInk(data, index, background) || (skipFrom >= 0 && y >= skipFrom)) continue;
      inkRed += data[index] ?? 0;
      inkGreen += data[index + 1] ?? 0;
      inkBlue += data[index + 2] ?? 0;
      inkCount += 1;
    }
  }
  const ink = inkCount > 0 ? { r: inkRed / inkCount, g: inkGreen / inkCount, b: inkBlue / inkCount } : { r: 0, g: 0, b: 0 };
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < cropWidth; x += 1) {
      const index = (y * width + x0 + x) * 4;
      const out = (y * cropWidth + x) * 4;
      if (skipFrom >= 0 && y >= skipFrom) continue;
      const distance = colorDistance(data, index, background);
      if (distance < 28) continue;
      const alpha = Math.max(0, Math.min(255, Math.round((distance / (distance + colorDistance(data, index, ink) + 1)) * 320)));
      image.data[out] = Math.round(ink.r);
      image.data[out + 1] = Math.round(ink.g);
      image.data[out + 2] = Math.round(ink.b);
      image.data[out + 3] = alpha;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function glyphsFromRun(
  canvas: HTMLCanvasElement,
  element: ContentElement,
  pageWidth: number,
  pageHeight: number,
): { glyphs: PatchGlyph[]; spaceAdvance: number; underlineOffset: number; underlineColor: string; backdrop: string } | null {
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
  const background = sampleBackground(pixels, region.w, region.h);
  const underline = findUnderline(pixels, region.w, region.h, background);
  const letters = lettersOf(element.text);
  if (letters.length === 0) return null;
  let blobs = blobsFrom(inkColumns(pixels, region.w, region.h, background, underline?.top ?? -1));
  const speck = Math.max(1, element.fontSize * region.scaleX * 0.12);
  if (blobs.length > letters.length) {
    const extras = blobs.length - letters.length;
    const narrow = blobs
      .map((blob, index) => ({ index, width: blob.x1 - blob.x0 }))
      .filter((blob) => blob.width < speck)
      .sort((a, b) => a.width - b.width)
      .slice(0, extras);
    const drop = new Set(narrow.map((blob) => blob.index));
    blobs = blobs.filter((_, index) => !drop.has(index));
  }
  if (blobs.length !== letters.length) {
    return {
      glyphs: [],
      spaceAdvance: Math.max(element.fontSize || element.h, 1) * 0.33,
      underlineOffset: underline ? underline.top / region.scaleY : -1,
      underlineColor: underline?.color ?? element.color,
      backdrop: hexColor(background),
    };
  }
  const gaps: number[] = [];
  for (let index = 0; index < blobs.length - 1; index += 1) {
    const current = blobs[index];
    const next = blobs[index + 1];
    if (current && next) gaps.push(next.x0 - current.x1);
  }
  const typical = median(gaps.filter((gap) => gap >= 0)) || Math.max(1, element.fontSize * region.scaleX * 0.14);
  const wordGaps = gaps.filter((gap) => gap > Math.max(typical * 1.8, typical + 2));
  const spacePx = wordGaps.length > 0 ? median(wordGaps) - typical : typical * 2.4;
  const glyphs: PatchGlyph[] = [];
  letters.forEach((char, index) => {
    const blob = blobs[index];
    if (!blob) return;
    const inkWidth = Math.max(1, blob.x1 - blob.x0);
    const src = cropGlyph(pixels, region.w, region.h, blob.x0, blob.x1, background, underline?.top ?? -1);
    if (!src) return;
    glyphs.push({
      char,
      src,
      w: inkWidth / region.scaleX,
      advance: (inkWidth + typical) / region.scaleX,
    });
  });
  const unique = new Map<string, PatchGlyph>();
  for (const glyph of glyphs) unique.set(glyph.char, glyph);
  const spaceAdvance = Math.max(spacePx, typical) / region.scaleX;
  const fitted = fitAdvances([...unique.values()], spaceAdvance, element);
  return {
    glyphs: fitted.glyphs,
    spaceAdvance: fitted.spaceAdvance,
    underlineOffset: underline ? underline.top / region.scaleY : -1,
    underlineColor: underline?.color ?? element.color,
    backdrop: hexColor(background),
  };
}

function textWidth(text: string, glyphs: Map<string, PatchGlyph>, spaceAdvance: number, fontName: string, fontSize: number): number {
  let width = 0;
  let pending = 0;
  for (const char of text) {
    if (char === "\n") continue;
    if (char === " ") {
      pending += 1;
      continue;
    }
    if (pending > 0) {
      width += spaceAdvance * pending;
      pending = 0;
    }
    width += glyphs.get(char)?.advance ?? measureChar(char, fontName, fontSize);
  }
  return width;
}

function fitAdvances(
  glyphs: PatchGlyph[],
  spaceAdvance: number,
  element: ContentElement,
): { glyphs: PatchGlyph[]; spaceAdvance: number } {
  const map = new Map(glyphs.map((glyph) => [glyph.char, glyph]));
  const raw = textWidth(element.text, map, spaceAdvance, element.fontName, element.fontSize || element.h);
  if (raw < 1 || element.w < 1) return { glyphs, spaceAdvance };
  const scale = element.w / raw;
  if (scale < 0.82 || scale > 1.22) return { glyphs, spaceAdvance };
  return {
    glyphs: glyphs.map((glyph) => ({ ...glyph, advance: glyph.advance * scale })),
    spaceAdvance: spaceAdvance * scale,
  };
}

function sameFace(element: ContentElement, other: ContentElement): boolean {
  const font = element.pdfFont || element.fontName;
  const otherFont = other.pdfFont || other.fontName;
  const size = element.fontSize || element.h || 1;
  const otherSize = other.fontSize || other.h || 1;
  const ratio = otherSize / size;
  return font !== "" && font === otherFont && ratio > 0.35 && ratio < 2.8;
}

function followingRuns(element: ContentElement, elements: ContentElement[]): ContentElement[] {
  const size = Math.max(element.fontSize || element.h, 1);
  const row = elements
    .filter(
      (item) =>
        item.id !== element.id &&
        item.page === element.page &&
        isTextContent(item.kind) &&
        item.kind !== "paragraph" &&
        Math.abs(item.baseline - element.baseline) < size * 0.45 &&
        item.x >= element.x + element.w - 1.5,
    )
    .sort((a, b) => a.x - b.x);
  const kept: ContentElement[] = [];
  let edge = element.x + element.w;
  for (const item of row) {
    if (item.x - edge > size * 1.75) break;
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
): EditCapture {
  const gathered = new Map<string, { glyph: PatchGlyph; distance: number }>();
  const size = element.fontSize || element.h || 1;
  let spaceAdvance = size * 0.33;
  let underlineOffset = -1;
  let underlineColor = element.color || "#111111";
  let backdrop = "#ffffff";
  const donors = elements.filter(
    (item) =>
      item.page === element.page &&
      item.kind !== "paragraph" &&
      isTextContent(item.kind) &&
      item.id !== element.id &&
      sameFace(element, item),
  );
  for (const donor of [...donors, element]) {
    const found = glyphsFromRun(canvas, donor, pageWidth, pageHeight);
    if (!found) continue;
    const donorSize = donor.fontSize || donor.h || size;
    const distance = Math.abs(donorSize - size);
    const ratio = size / donorSize;
    for (const glyph of found.glyphs) {
      const known = gathered.get(glyph.char);
      const fromEdit = donor.id === element.id;
      if (known && !fromEdit && known.distance <= distance) continue;
      const scaled =
        fromEdit || Math.abs(ratio - 1) < 0.04
          ? glyph
          : { ...glyph, w: glyph.w * ratio, advance: glyph.advance * ratio };
      gathered.set(glyph.char, { glyph: scaled, distance: fromEdit ? -1 : distance });
    }
    if (donor.id === element.id) {
      spaceAdvance = found.spaceAdvance;
      underlineOffset = found.underlineOffset;
      underlineColor = found.underlineColor || underlineColor;
      backdrop = found.backdrop || backdrop;
    }
  }
  const tails: PatchTail[] = [];
  for (const tail of followingRuns(element, elements)) {
    const region = pixelBox(canvas, tail, pageWidth, pageHeight, TAIL_PAD);
    if (!region) continue;
    const image = snap(canvas, region);
    if (!image) continue;
    tails.push({ x: tail.x, y: tail.y, w: tail.w, h: tail.h, padBottom: TAIL_PAD, image });
  }
  return {
    glyphs: [...gathered.values()].map((item) => item.glyph),
    spaceAdvance,
    underlineOffset,
    underlineColor,
    backdrop,
    tails,
  };
}

export function layoutPieces(patch: PatchAnnotation, text: string): GlyphPiece[] {
  const map = new Map((patch.glyphs ?? []).map((glyph) => [glyph.char, glyph]));
  const pieces: GlyphPiece[] = [];
  let x = 0;
  let pending = 0;
  const flushSpaces = () => {
    if (pending < 1) return;
    const advance = (patch.spaceAdvance || 0) * pending;
    pieces.push({ char: " ".repeat(pending), x, advance, glyph: null });
    x += advance;
    pending = 0;
  };
  for (const char of text) {
    if (char === "\n") continue;
    if (char === " ") {
      pending += 1;
      continue;
    }
    flushSpaces();
    const glyph = map.get(char) ?? null;
    const advance = glyph?.advance ?? measureChar(char, patch.fontName, patch.fontSize);
    pieces.push({ char, x, advance, glyph });
    x += advance;
  }
  flushSpaces();
  return pieces;
}

export function runWidth(patch: PatchAnnotation, text: string): number {
  if (!text) return 0;
  if (text.includes("\n") || (patch.glyphs ?? []).length === 0) {
    let width = 0;
    for (const line of text.split("\n")) {
      width = Math.max(width, measureLine(line, patch));
    }
    return width;
  }
  const pieces = layoutPieces(patch, text);
  const last = pieces[pieces.length - 1];
  return last ? last.x + last.advance : 0;
}

function measureLine(text: string, patch: PatchAnnotation): number {
  if (!measureContext) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * patch.fontSize * 0.5;
  measureContext.font = `${patch.fontSize}px "${patch.fontName}"`;
  return measureContext.measureText(text || " ").width;
}

export function indexAt(pieces: GlyphPiece[], localX: number): number {
  let index = 0;
  for (const piece of pieces) {
    if (localX < piece.x + piece.advance / 2) return index;
    index += piece.char.length;
  }
  return index;
}

export function offsetAt(pieces: GlyphPiece[], index: number): number {
  let cursor = 0;
  for (const piece of pieces) {
    if (index <= cursor) return piece.x;
    cursor += piece.char.length;
    if (index < cursor) {
      const into = index - (cursor - piece.char.length);
      return piece.x + piece.advance * (into / piece.char.length);
    }
  }
  const last = pieces[pieces.length - 1];
  return last ? last.x + last.advance : 0;
}

export async function paintRun(patch: PatchAnnotation): Promise<string> {
  if (!patch.text) return "";
  const width = Math.max(patch.w, 1);
  const height = Math.max(patch.h, patch.fontSize, 1);
  const zoom = 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * zoom));
  canvas.height = Math.max(1, Math.ceil(height * zoom));
  const context = canvas.getContext("2d");
  if (!context) return "";
  const pieces = (patch.glyphs ?? []).length > 0 && !patch.text.includes("\n") ? layoutPieces(patch, patch.text) : [];
  if (pieces.length > 0) {
    for (const piece of pieces) {
      if (piece.glyph) {
        try {
          const image = await loadImage(piece.glyph.src);
          context.drawImage(image, piece.x * zoom, 0, piece.glyph.w * zoom, height * zoom);
        } catch {
          fillPiece(context, piece, patch, zoom, height);
        }
        continue;
      }
      if (piece.char.trim()) fillPiece(context, piece, patch, zoom, height);
    }
  } else {
    try {
      await document.fonts.load(`${patch.fontSize}px "${patch.fontName}"`);
    } catch {
      // The face is already registered when extraction succeeded.
    }
    context.font = `${patch.fontSize * zoom}px "${patch.fontName}"`;
    context.fillStyle = patch.color;
    context.textBaseline = "alphabetic";
    patch.text.split("\n").forEach((line, index) => {
      context.fillText(line, 0, (patch.ascent * patch.fontSize + index * patch.lineHeight) * zoom);
    });
  }
  if (patch.underlineOffset >= 0) {
    context.fillStyle = patch.underlineColor || patch.color;
    context.fillRect(0, patch.underlineOffset * zoom, width * zoom, Math.max(1, 0.7 * zoom));
  }
  return canvas.toDataURL("image/png");
}

function fillPiece(
  context: CanvasRenderingContext2D,
  piece: GlyphPiece,
  patch: PatchAnnotation,
  zoom: number,
  height: number,
) {
  context.font = `${patch.fontSize * zoom}px "${patch.fontName}"`;
  context.fillStyle = patch.color;
  context.textBaseline = "alphabetic";
  context.fillText(piece.char, piece.x * zoom, Math.min(patch.ascent * patch.fontSize, height) * zoom);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("glyph"));
    image.src = src;
  });
}
