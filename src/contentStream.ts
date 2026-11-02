import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFStream,
  type PDFDocument,
  type PDFObject,
  type PDFPageLeaf,
} from "pdf-lib";
import type { PageViewport } from "pdfjs-dist";

type Box = { x: number; y: number; w: number; h: number };

type Matrix = [number, number, number, number, number, number];

// What became of the text under one box: how many strings were taken out of the page's content
// stream, and whether some of its text may still be there (drawn by a form XObject, or in a
// stream that could not be read), in which case the caller has to paint over it.
export type StripResult = { removed: number; uncertain: boolean };

// The glyph widths of one font resource in thousandths of text space, as /Widths and /W hold
// them, with the number of bytes one character code takes. `known` is false when the encoding or
// the widths could not be read; the advance of a string in that font is then unknown.
type FontInfo = { bytes: 1 | 2; widths: Map<number, number>; defaultWidth: number; known: boolean };

type Form = { bbox: [number, number, number, number] | null; matrix: Matrix };

type Operand =
  | { kind: "number"; value: number; start: number; end: number }
  | { kind: "name"; value: string; start: number; end: number }
  | { kind: "string"; bytes: Uint8Array; start: number; end: number }
  | { kind: "array"; items: Operand[]; start: number; end: number }
  | { kind: "other"; start: number; end: number };

type Operation = { op: string; operands: Operand[]; start: number; end: number };

type TextState = {
  font: FontInfo | null;
  size: number;
  charSpacing: number;
  wordSpacing: number;
  hscale: number;
  leading: number;
  rise: number;
};

type Edit = { start: number; end: number; chunks: (Uint8Array | string)[] };

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

// How far outside a box a string may start and still count as the box's text, in page units.
const MARGIN = 1.5;

const WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIMITERS = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

// Takes the text under each box out of a page's content stream, so an edit written over it is the
// only copy of those words in the file. A string is the box's when the point its first glyph is
// drawn at lies inside the box; it is replaced by an equal advance (a number in a TJ array), so
// the text that follows it in the same text object stays where it was. Text inside form XObjects
// is left alone and reported as uncertain. Boxes are in the viewport's page coordinates.
export function stripPageText(
  document: PDFDocument,
  pageIndex: number,
  boxes: Box[],
  viewport: PageViewport | undefined,
): StripResult[] {
  const results: StripResult[] = boxes.map(() => ({ removed: 0, uncertain: false }));
  const uncertain = () => {
    for (const result of results) result.uncertain = true;
    return results;
  };
  if (!viewport || boxes.length === 0) return uncertain();
  const leaf = document.getPage(pageIndex).node;
  let source: Uint8Array | null;
  try {
    source = contentBytes(document, leaf);
  } catch {
    return uncertain();
  }
  if (!source) return results;
  const fonts = readFonts(document, leaf);
  const forms = readForms(document, leaf);
  const toPage = viewport.transform as Matrix;
  const edits: Edit[] = [];

  let ctm: Matrix = IDENTITY;
  let text: TextState = { font: null, size: 0, charSpacing: 0, wordSpacing: 0, hscale: 1, leading: 0, rise: 0 };
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  const stack: { ctm: Matrix; text: TextState }[] = [];

  const number = (operand: Operand | undefined, fallback = 0) =>
    operand?.kind === "number" && Number.isFinite(operand.value) ? operand.value : fallback;
  const matrix = (operands: Operand[]): Matrix | null => {
    if (operands.length < 6) return null;
    const values = operands.slice(-6).map((operand) => number(operand, Number.NaN));
    if (values.some((value) => !Number.isFinite(value))) return null;
    return values as Matrix;
  };
  const nextLine = (ty: number) => {
    tlm = multiply([1, 0, 0, 1, 0, ty], tlm);
    tm = tlm;
  };
  // Where the next glyph starts, in page coordinates.
  const start = (): [number, number] => apply(apply(apply([0, text.rise], tm), ctm), toPage);
  const boxAt = (point: [number, number]) =>
    boxes.findIndex(
      (box) =>
        point[0] >= box.x - MARGIN &&
        point[0] <= box.x + box.w + MARGIN &&
        point[1] >= box.y - MARGIN &&
        point[1] <= box.y + box.h + MARGIN,
    );
  // The advance of a string in unscaled text space, or null when the font's widths are unknown.
  const advance = (bytes: Uint8Array): number | null => {
    const font = text.font;
    if (!font?.known) return null;
    let total = 0;
    if (font.bytes === 1) {
      for (const code of bytes) {
        total += ((font.widths.get(code) ?? font.defaultWidth) / 1000) * text.size + text.charSpacing;
        if (code === 32) total += text.wordSpacing;
      }
      return total;
    }
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      const code = ((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0);
      total += ((font.widths.get(code) ?? font.defaultWidth) / 1000) * text.size + text.charSpacing;
    }
    return total;
  };
  const verbatim = (operand: Operand) => source.subarray(operand.start, operand.end);
  // Walks the strings and adjustments of one text-showing operator, replacing every string that
  // starts inside a box by its own advance. `prefix` restores the side effects of ' and ".
  const show = (operation: Operation, items: Operand[], prefix: (Uint8Array | string)[]) => {
    const out: (Uint8Array | string)[] = [];
    let changed = false;
    for (const item of items) {
      if (item.kind === "number") {
        tm = multiply([1, 0, 0, 1, (-item.value / 1000) * text.size * text.hscale, 0], tm);
        out.push(verbatim(item));
        continue;
      }
      if (item.kind !== "string") {
        out.push(verbatim(item));
        continue;
      }
      const index = boxAt(start());
      const width = advance(item.bytes);
      if (index >= 0) {
        const result = results[index];
        if (result) result.removed += 1;
        changed = true;
        if (width != null && text.size !== 0) out.push(formatNumber((-width * 1000) / text.size));
      } else {
        out.push(verbatim(item));
      }
      if (width != null) tm = multiply([1, 0, 0, 1, width * text.hscale, 0], tm);
    }
    if (!changed) return;
    const chunks: (Uint8Array | string)[] = [...prefix];
    if (out.length > 0) {
      chunks.push("[");
      out.forEach((chunk, index) => {
        if (index > 0) chunks.push(" ");
        chunks.push(chunk);
      });
      chunks.push("] TJ");
    }
    edits.push({ start: operation.start, end: operation.end, chunks });
  };

  for (const operation of operations(source)) {
    const { op, operands } = operation;
    switch (op) {
      case "q":
        stack.push({ ctm, text: { ...text } });
        break;
      case "Q": {
        const saved = stack.pop();
        if (saved) ({ ctm, text } = saved);
        break;
      }
      case "cm": {
        const next = matrix(operands);
        if (next) ctm = multiply(next, ctm);
        break;
      }
      case "BT":
        tm = IDENTITY;
        tlm = IDENTITY;
        break;
      case "Tf": {
        const name = operands[0];
        text.font = name?.kind === "name" ? (fonts.get(name.value) ?? null) : null;
        text.size = number(operands[1]);
        break;
      }
      case "Tc":
        text.charSpacing = number(operands[0]);
        break;
      case "Tw":
        text.wordSpacing = number(operands[0]);
        break;
      case "Tz":
        text.hscale = number(operands[0], 100) / 100;
        break;
      case "TL":
        text.leading = number(operands[0]);
        break;
      case "Ts":
        text.rise = number(operands[0]);
        break;
      case "Td":
        tlm = multiply([1, 0, 0, 1, number(operands[0]), number(operands[1])], tlm);
        tm = tlm;
        break;
      case "TD":
        text.leading = -number(operands[1]);
        tlm = multiply([1, 0, 0, 1, number(operands[0]), number(operands[1])], tlm);
        tm = tlm;
        break;
      case "T*":
        nextLine(-text.leading);
        break;
      case "Tm": {
        const next = matrix(operands);
        if (next) {
          tm = next;
          tlm = next;
        }
        break;
      }
      case "Tj": {
        const string = operands[0];
        if (string?.kind === "string") show(operation, [string], []);
        break;
      }
      case "'": {
        nextLine(-text.leading);
        const string = operands[0];
        if (string?.kind === "string") show(operation, [string], ["T* "]);
        break;
      }
      case '"': {
        text.wordSpacing = number(operands[0]);
        text.charSpacing = number(operands[1]);
        nextLine(-text.leading);
        const string = operands[2];
        const [aw, ac] = operands;
        if (string?.kind === "string" && aw && ac) {
          show(operation, [string], [verbatim(aw), " Tw ", verbatim(ac), " Tc T* "]);
        }
        break;
      }
      case "TJ": {
        const array = operands[0];
        if (array?.kind === "array") show(operation, array.items, []);
        break;
      }
      case "Do": {
        const name = operands[0];
        const form = name?.kind === "name" ? forms.get(name.value) : undefined;
        if (!form) break;
        const box = formBox(form, ctm, toPage);
        boxes.forEach((target, index) => {
          const result = results[index];
          if (!result) return;
          if (!box || intersects(box, target)) result.uncertain = true;
        });
        break;
      }
      default:
        break;
    }
  }

  if (edits.length === 0) return results;
  const stream = document.context.flateStream(applyEdits(source, edits));
  leaf.set(PDFName.of("Contents"), document.context.register(stream));
  return results;
}

// The page's content as one buffer, decoded. Null when the page has no content; throws when a
// stream is not a raw stream of the loaded file (one pdf-lib added) or cannot be decoded.
function contentBytes(document: PDFDocument, leaf: PDFPageLeaf): Uint8Array | null {
  const contents = leaf.Contents();
  if (!contents) return null;
  const streams: PDFObject[] = [];
  if (contents instanceof PDFArray) {
    for (let index = 0; index < contents.size(); index += 1) streams.push(document.context.lookup(contents.get(index)) ?? contents.get(index));
  } else {
    streams.push(contents);
  }
  const parts: Uint8Array[] = [];
  let total = 0;
  for (const stream of streams) {
    if (!(stream instanceof PDFRawStream)) throw new Error("content stream is not a raw stream");
    const decoded = decodePDFRawStream(stream).decode();
    parts.push(decoded);
    total += decoded.length + 1;
  }
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
    out[cursor] = 0x0a;
    cursor += 1;
  }
  return out;
}

function applyEdits(source: Uint8Array, edits: Edit[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let cursor = 0;
  for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
    if (edit.start < cursor) continue;
    chunks.push(source.subarray(cursor, edit.start));
    for (const chunk of edit.chunks) chunks.push(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
    cursor = edit.end;
  }
  chunks.push(source.subarray(cursor));
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Math.abs(rounded) < 0.005 ? "0" : rounded.toFixed(2).replace(/\.?0+$/, "");
}

// Row-vector matrix product: `multiply(a, b)` applies `a`, then `b`.
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

function apply(point: [number, number], m: Matrix): [number, number] {
  return [m[0] * point[0] + m[2] * point[1] + m[4], m[1] * point[0] + m[3] * point[1] + m[5]];
}

function intersects(a: Box, b: Box): boolean {
  return a.x <= b.x + b.w + MARGIN && a.x + a.w >= b.x - MARGIN && a.y <= b.y + b.h + MARGIN && a.y + a.h >= b.y - MARGIN;
}

// The page box a form XObject is painted into, or null when its bounding box is unknown.
function formBox(form: Form, ctm: Matrix, toPage: Matrix): Box | null {
  if (!form.bbox) return null;
  const [x0, y0, x1, y1] = form.bbox;
  const transform = multiply(multiply(form.matrix, ctm), toPage);
  const corners = [apply([x0, y0], transform), apply([x1, y0], transform), apply([x0, y1], transform), apply([x1, y1], transform)];
  const xs = corners.map((corner) => corner[0]);
  const ys = corners.map((corner) => corner[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { x: left, y: top, w: Math.max(...xs) - left, h: Math.max(...ys) - top };
}

function nameOf(dict: PDFDict, key: string): string | null {
  const value = dict.lookupMaybe(PDFName.of(key), PDFName);
  return value ? value.decodeText() : null;
}

function numberOf(dict: PDFDict, key: string): number | null {
  const value = dict.lookupMaybe(PDFName.of(key), PDFNumber);
  return value ? value.asNumber() : null;
}

function numberAt(document: PDFDocument, array: PDFArray, index: number): number | null {
  const value = document.context.lookup(array.get(index));
  return value instanceof PDFNumber ? value.asNumber() : null;
}

function readFonts(document: PDFDocument, leaf: PDFPageLeaf): Map<string, FontInfo> {
  const fonts = new Map<string, FontInfo>();
  const dict = leaf.Resources()?.lookupMaybe(PDFName.of("Font"), PDFDict);
  if (!dict) return fonts;
  for (const [key, value] of dict.entries()) {
    const font = document.context.lookupMaybe(value, PDFDict);
    if (font) fonts.set(key.decodeText(), fontInfo(document, font));
  }
  return fonts;
}

function fontInfo(document: PDFDocument, dict: PDFDict): FontInfo {
  const subtype = nameOf(dict, "Subtype");
  const widths = new Map<number, number>();
  if (subtype === "Type0") {
    const encoding = nameOf(dict, "Encoding");
    const identity = encoding === "Identity-H" || encoding === "Identity-V";
    const descendants = dict.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
    const cid = descendants && descendants.size() > 0 ? document.context.lookupMaybe(descendants.get(0), PDFDict) : undefined;
    let defaultWidth = 1000;
    if (cid) {
      defaultWidth = numberOf(cid, "DW") ?? 1000;
      const w = cid.lookupMaybe(PDFName.of("W"), PDFArray);
      if (w) readW(document, w, widths);
    }
    return { bytes: 2, widths, defaultWidth, known: identity && cid != null };
  }
  // Type3 glyph widths are in glyph space; the font matrix takes them to text space.
  let scale = 1;
  if (subtype === "Type3") {
    const fontMatrix = dict.lookupMaybe(PDFName.of("FontMatrix"), PDFArray);
    scale = (fontMatrix ? (numberAt(document, fontMatrix, 0) ?? 0.001) : 0.001) * 1000;
  }
  const firstChar = numberOf(dict, "FirstChar") ?? 0;
  const list = dict.lookupMaybe(PDFName.of("Widths"), PDFArray);
  if (list) {
    for (let index = 0; index < list.size(); index += 1) {
      const width = numberAt(document, list, index);
      if (width != null) widths.set(firstChar + index, width * scale);
    }
  }
  const descriptor = dict.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
  const missing = (descriptor ? (numberOf(descriptor, "MissingWidth") ?? 0) : 0) * scale;
  return { bytes: 1, widths, defaultWidth: missing, known: list != null && list.size() > 0 };
}

// A CIDFont's W array: runs of `c [w1 w2 ...]` and `cFirst cLast w`.
function readW(document: PDFDocument, w: PDFArray, widths: Map<number, number>) {
  let index = 0;
  while (index < w.size()) {
    const first = numberAt(document, w, index);
    if (first == null) break;
    const second = document.context.lookup(w.get(index + 1));
    if (second instanceof PDFArray) {
      for (let offset = 0; offset < second.size(); offset += 1) {
        const width = numberAt(document, second, offset);
        if (width != null) widths.set(first + offset, width);
      }
      index += 2;
      continue;
    }
    const last = numberAt(document, w, index + 1);
    const width = numberAt(document, w, index + 2);
    if (last == null || width == null) break;
    for (let code = first; code <= Math.min(last, first + 65535); code += 1) widths.set(code, width);
    index += 3;
  }
}

function readForms(document: PDFDocument, leaf: PDFPageLeaf): Map<string, Form> {
  const forms = new Map<string, Form>();
  const dict = leaf.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (!dict) return forms;
  for (const [key, value] of dict.entries()) {
    const stream = document.context.lookupMaybe(value, PDFStream);
    if (!stream || nameOf(stream.dict, "Subtype") !== "Form") continue;
    const bboxArray = stream.dict.lookupMaybe(PDFName.of("BBox"), PDFArray);
    const matrixArray = stream.dict.lookupMaybe(PDFName.of("Matrix"), PDFArray);
    const bboxValues = bboxArray ? [0, 1, 2, 3].map((index) => numberAt(document, bboxArray, index)) : [];
    const matrixValues = matrixArray ? [0, 1, 2, 3, 4, 5].map((index) => numberAt(document, matrixArray, index)) : [];
    const [x0, y0, x1, y1] = bboxValues;
    const bbox: Form["bbox"] =
      x0 != null && y0 != null && x1 != null && y1 != null
        ? [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]
        : null;
    const matrix: Matrix =
      matrixValues.length === 6 && matrixValues.every((value): value is number => value != null) ? (matrixValues as Matrix) : IDENTITY;
    forms.set(key.decodeText(), { bbox, matrix });
  }
  return forms;
}

type Token =
  | { kind: "number"; value: number; start: number; end: number }
  | { kind: "name"; value: string; start: number; end: number }
  | { kind: "string"; bytes: Uint8Array; start: number; end: number }
  | { kind: "keyword"; value: string; start: number; end: number }
  | { kind: "open" | "close" | "dictOpen" | "dictClose" | "other"; start: number; end: number };

class Lexer {
  pos = 0;
  readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  skipSpace() {
    while (this.pos < this.bytes.length) {
      const byte = this.bytes[this.pos] ?? 0;
      if (WHITESPACE.has(byte)) this.pos += 1;
      else if (byte === 0x25) {
        while (this.pos < this.bytes.length && this.bytes[this.pos] !== 0x0a && this.bytes[this.pos] !== 0x0d) this.pos += 1;
      } else break;
    }
  }

  next(): Token | null {
    this.skipSpace();
    const { bytes } = this;
    if (this.pos >= bytes.length) return null;
    const start = this.pos;
    const byte = bytes[start] ?? 0;
    if (byte === 0x5b) return { kind: "open", start, end: (this.pos += 1) };
    if (byte === 0x5d) return { kind: "close", start, end: (this.pos += 1) };
    if (byte === 0x3c) {
      if (bytes[start + 1] === 0x3c) return { kind: "dictOpen", start, end: (this.pos += 2) };
      return this.hexString(start);
    }
    if (byte === 0x3e) {
      if (bytes[start + 1] === 0x3e) return { kind: "dictClose", start, end: (this.pos += 2) };
      return { kind: "other", start, end: (this.pos += 1) };
    }
    if (byte === 0x28) return this.literalString(start);
    if (byte === 0x2f) return this.name(start);
    if (byte === 0x29 || byte === 0x7b || byte === 0x7d) return { kind: "other", start, end: (this.pos += 1) };
    if ((byte >= 0x30 && byte <= 0x39) || byte === 0x2b || byte === 0x2d || byte === 0x2e) return this.number(start);
    while (this.pos < bytes.length && !WHITESPACE.has(bytes[this.pos] ?? 0) && !DELIMITERS.has(bytes[this.pos] ?? 0)) this.pos += 1;
    if (this.pos === start) this.pos += 1;
    return { kind: "keyword", value: ascii(bytes, start, this.pos), start, end: this.pos };
  }

  private number(start: number): Token {
    const { bytes } = this;
    while (this.pos < bytes.length) {
      const byte = bytes[this.pos] ?? 0;
      if ((byte >= 0x30 && byte <= 0x39) || byte === 0x2b || byte === 0x2d || byte === 0x2e || byte === 0x45 || byte === 0x65) this.pos += 1;
      else break;
    }
    const raw = ascii(bytes, start, this.pos).replace(/^([+-])[+-]+/, "$1");
    const value = Number.parseFloat(raw);
    return { kind: "number", value: Number.isFinite(value) ? value : 0, start, end: this.pos };
  }

  private name(start: number): Token {
    const { bytes } = this;
    this.pos += 1;
    let value = "";
    while (this.pos < bytes.length) {
      const byte = bytes[this.pos] ?? 0;
      if (WHITESPACE.has(byte) || DELIMITERS.has(byte)) break;
      if (byte === 0x23 && this.pos + 2 < bytes.length) {
        const code = Number.parseInt(ascii(bytes, this.pos + 1, this.pos + 3), 16);
        if (Number.isFinite(code)) {
          value += String.fromCharCode(code);
          this.pos += 3;
          continue;
        }
      }
      value += String.fromCharCode(byte);
      this.pos += 1;
    }
    return { kind: "name", value, start, end: this.pos };
  }

  private literalString(start: number): Token {
    const { bytes } = this;
    this.pos += 1;
    const out: number[] = [];
    let depth = 1;
    while (this.pos < bytes.length) {
      const byte = bytes[this.pos] ?? 0;
      this.pos += 1;
      if (byte === 0x5c) {
        const escaped = bytes[this.pos] ?? 0;
        this.pos += 1;
        if (escaped === 0x6e) out.push(0x0a);
        else if (escaped === 0x72) out.push(0x0d);
        else if (escaped === 0x74) out.push(0x09);
        else if (escaped === 0x62) out.push(0x08);
        else if (escaped === 0x66) out.push(0x0c);
        else if (escaped >= 0x30 && escaped <= 0x37) {
          let code = escaped - 0x30;
          for (let digits = 1; digits < 3; digits += 1) {
            const digit = bytes[this.pos] ?? 0;
            if (digit < 0x30 || digit > 0x37) break;
            code = code * 8 + (digit - 0x30);
            this.pos += 1;
          }
          out.push(code & 0xff);
        } else if (escaped === 0x0d) {
          if (bytes[this.pos] === 0x0a) this.pos += 1;
        } else if (escaped !== 0x0a) out.push(escaped);
        continue;
      }
      if (byte === 0x28) depth += 1;
      else if (byte === 0x29) {
        depth -= 1;
        if (depth === 0) break;
      }
      out.push(byte);
    }
    return { kind: "string", bytes: Uint8Array.from(out), start, end: this.pos };
  }

  private hexString(start: number): Token {
    const { bytes } = this;
    this.pos += 1;
    const out: number[] = [];
    let pending = -1;
    while (this.pos < bytes.length) {
      const byte = bytes[this.pos] ?? 0;
      this.pos += 1;
      if (byte === 0x3e) break;
      const digit = hexDigit(byte);
      if (digit < 0) continue;
      if (pending < 0) pending = digit;
      else {
        out.push(pending * 16 + digit);
        pending = -1;
      }
    }
    if (pending >= 0) out.push(pending * 16);
    return { kind: "string", bytes: Uint8Array.from(out), start, end: this.pos };
  }
}

function hexDigit(byte: number): number {
  if (byte >= 0x30 && byte <= 0x39) return byte - 0x30;
  if (byte >= 0x41 && byte <= 0x46) return byte - 0x41 + 10;
  if (byte >= 0x61 && byte <= 0x66) return byte - 0x61 + 10;
  return -1;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let out = "";
  for (let index = start; index < end; index += 1) out += String.fromCharCode(bytes[index] ?? 0);
  return out;
}

// The operators of a content stream with their operands and the byte range each one occupies
// (operands included), so an operator can be rewritten in place and everything else copied as is.
function operations(bytes: Uint8Array): Operation[] {
  const lexer = new Lexer(bytes);
  const out: Operation[] = [];
  let operands: Operand[] = [];
  // Arrays and dictionaries nest; only a keyword at the top level is an operator.
  const stack: { items: Operand[]; start: number }[] = [];
  const push = (operand: Operand) => {
    const top = stack[stack.length - 1];
    (top ? top.items : operands).push(operand);
  };
  for (;;) {
    const token = lexer.next();
    if (!token) break;
    switch (token.kind) {
      case "number":
        push({ kind: "number", value: token.value, start: token.start, end: token.end });
        break;
      case "name":
        push({ kind: "name", value: token.value, start: token.start, end: token.end });
        break;
      case "string":
        push({ kind: "string", bytes: token.bytes, start: token.start, end: token.end });
        break;
      case "open":
      case "dictOpen":
        stack.push({ items: [], start: token.start });
        break;
      case "close":
      case "dictClose": {
        const group = stack.pop();
        if (!group) break;
        push(
          token.kind === "close"
            ? { kind: "array", items: group.items, start: group.start, end: token.end }
            : { kind: "other", start: group.start, end: token.end },
        );
        break;
      }
      case "other":
        push({ kind: "other", start: token.start, end: token.end });
        break;
      case "keyword": {
        if (stack.length > 0) {
          push({ kind: "other", start: token.start, end: token.end });
          break;
        }
        const start = operands[0]?.start ?? token.start;
        if (token.value === "BI") {
          const end = skipInlineImage(lexer, operands);
          out.push({ op: "EI", operands: [], start, end });
          operands = [];
          break;
        }
        out.push({ op: token.value, operands, start, end: token.end });
        operands = [];
        break;
      }
      default:
        break;
    }
  }
  return out;
}

// Reads an inline image's dictionary and skips its binary data; returns the offset just past EI.
// The data length follows from the image's size when it is not filtered; otherwise the data ends
// at the first EI that stands on its own.
function skipInlineImage(lexer: Lexer, operands: Operand[]): number {
  const { bytes } = lexer;
  const entries = new Map<string, Operand>();
  let key: string | null = null;
  for (;;) {
    const token = lexer.next();
    if (!token) return bytes.length;
    if (token.kind === "keyword" && token.value === "ID") break;
    if (token.kind === "name" && key == null) {
      key = token.value;
      continue;
    }
    if (key != null) {
      if (token.kind === "number") entries.set(key, { kind: "number", value: token.value, start: token.start, end: token.end });
      else if (token.kind === "name") entries.set(key, { kind: "name", value: token.value, start: token.start, end: token.end });
      else if (token.kind === "keyword") entries.set(key, { kind: "other", start: token.start, end: token.end });
      else entries.set(key, { kind: "other", start: token.start, end: token.end });
      key = null;
    }
  }
  operands.length = 0;
  let dataStart = lexer.pos;
  if (WHITESPACE.has(bytes[dataStart] ?? 0)) dataStart += 1;
  const length = inlineImageLength(entries, bytes);
  if (length != null) {
    const probe = new Lexer(bytes);
    probe.pos = dataStart + length;
    const token = probe.next();
    if (token?.kind === "keyword" && token.value === "EI") {
      lexer.pos = token.end;
      return token.end;
    }
  }
  for (let index = dataStart; index + 1 < bytes.length; index += 1) {
    if (bytes[index] !== 0x45 || bytes[index + 1] !== 0x49) continue;
    const before = index === 0 ? 0x20 : (bytes[index - 1] ?? 0);
    const after = index + 2 >= bytes.length ? 0x20 : (bytes[index + 2] ?? 0);
    if (WHITESPACE.has(before) && (WHITESPACE.has(after) || DELIMITERS.has(after))) {
      lexer.pos = index + 2;
      return index + 2;
    }
  }
  lexer.pos = bytes.length;
  return bytes.length;
}

function inlineImageLength(entries: Map<string, Operand>, bytes: Uint8Array): number | null {
  if (entries.has("F") || entries.has("Filter")) return null;
  const number = (...keys: string[]) => {
    for (const key of keys) {
      const value = entries.get(key);
      if (value?.kind === "number") return value.value;
    }
    return null;
  };
  const width = number("W", "Width");
  const height = number("H", "Height");
  if (width == null || height == null) return null;
  const mask = entries.get("IM") ?? entries.get("ImageMask");
  const isMask = mask?.kind === "other" && ascii(bytes, mask.start, mask.end) === "true";
  const bits = isMask ? 1 : (number("BPC", "BitsPerComponent") ?? 8);
  let components = 1;
  if (!isMask) {
    const space = entries.get("CS") ?? entries.get("ColorSpace");
    if (space?.kind === "name") {
      if (space.value === "RGB" || space.value === "DeviceRGB" || space.value === "CalRGB") components = 3;
      else if (space.value === "CMYK" || space.value === "DeviceCMYK") components = 4;
      else if (space.value === "G" || space.value === "DeviceGray" || space.value === "CalGray" || space.value === "I" || space.value === "Indexed") components = 1;
      else return null;
    } else if (space) return null;
  }
  return Math.ceil((width * bits * components) / 8) * height;
}
