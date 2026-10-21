import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  type PDFObject,
} from "pdf-lib";

export type PageFace = {
  resourceName: string;
  baseFont: string;
  family: string;
  fallback: string;
  primary: boolean;
};

type RunFace = {
  fontName: string;
  fallback: string;
  text: string;
  size: number;
  w: number;
};

const cache = new Map<string, Promise<PageFace[]>>();

export function loadPageFaces(bytes: Uint8Array, pageIndex: number): Promise<PageFace[]> {
  const key = cacheKey(bytes, pageIndex);
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = extractPageFaces(bytes, pageIndex).catch(() => [] as PageFace[]);
  cache.set(key, pending);
  return pending;
}

export async function assignFaces(runs: RunFace[], faces: PageFace[]): Promise<void> {
  if (faces.length === 0 || runs.length === 0 || typeof document === "undefined") return;
  const order: string[] = [];
  const seen = new Set<string>();
  for (const run of runs) {
    if (!run.fontName || seen.has(run.fontName)) continue;
    seen.add(run.fontName);
    order.push(run.fontName);
  }
  const chosen = new Map<string, PageFace>();
  const zipped = order.length === faces.length;
  for (let index = 0; index < order.length; index += 1) {
    const name = order[index];
    if (!name) continue;
    const sample = runs.find((run) => run.fontName === name && run.text.trim());
    const ordered = zipped ? faces[index] : undefined;
    const face = await pickFace(sample, ordered, faces);
    if (face) chosen.set(name, face);
  }
  for (const run of runs) {
    const face = chosen.get(run.fontName);
    if (!face) continue;
    run.fontName = face.family;
    run.fallback = face.fallback;
  }
}

function cacheKey(bytes: Uint8Array, pageIndex: number): string {
  let hash = bytes.length ^ (pageIndex * 0x9e3779b1);
  const step = Math.max(1, Math.floor(bytes.length / 24));
  for (let index = 0; index < bytes.length; index += step) {
    hash = Math.imul(hash ^ (bytes[index] ?? 0), 0x01000193);
  }
  return `${pageIndex}:${hash >>> 0}`;
}

async function extractPageFaces(bytes: Uint8Array, pageIndex: number): Promise<PageFace[]> {
  const document = await PDFDocument.load(bytes.slice(0), { updateMetadata: false });
  const page = document.getPages()[pageIndex];
  if (!page) return [];
  const resources = page.node.Resources();
  if (!resources) return [];
  const byName = new Map<string, Prepared>();
  collectFonts(resources, "", byName);
  const order = useOrder(page.node, byName);
  const referenced = order.filter((font) => font.primary);
  const chosen = referenced.length > 0 ? referenced : order;
  const faces: PageFace[] = [];
  for (const prepared of chosen) {
    const face = await install(prepared);
    if (face) faces.push(face);
  }
  return faces;
}

type Prepared = {
  resourceName: string;
  baseFont: string;
  bytes: Uint8Array | null;
  fallback: string;
  systemFamily: string;
  primary: boolean;
};

function collectFonts(resources: PDFDict, prefix: string, into: Map<string, Prepared>) {
  const fonts = resources.lookupMaybe(PDFName.of("Font"), PDFDict);
  if (fonts) {
    for (const [key, value] of fonts.entries()) {
      const name = key.asString();
      const font = fonts.context.lookup(value);
      if (!(font instanceof PDFDict)) continue;
      const id = prefix ? `${prefix}/${name}` : name;
      if (into.has(id)) continue;
      into.set(id, { ...prepareFont(id, font), primary: false });
    }
  }
  const objects = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (!objects) return;
  for (const [key, value] of objects.entries()) {
    const object = objects.context.lookup(value);
    if (!(object instanceof PDFDict) && !(object instanceof PDFRawStream)) continue;
    const dict = object instanceof PDFRawStream ? object.dict : object;
    const subtype = dict.lookupMaybe(PDFName.of("Subtype"), PDFName);
    if (subtype?.asString() !== "Form") continue;
    const nested = dict.lookupMaybe(PDFName.of("Resources"), PDFDict);
    if (nested) collectFonts(nested, key.asString(), into);
  }
}

function prepareFont(resourceName: string, font: PDFDict): Prepared {
  const baseFont = font.lookupMaybe(PDFName.of("BaseFont"), PDFName)?.asString() ?? resourceName;
  const styled = styleForBase(baseFont);
  const descriptor = descriptorOf(font);
  const file = descriptor ? fontFile(descriptor) : null;
  const decoded = file ? streamBytes(file) : null;
  const usable = decoded && isSfnt(decoded) ? unifyCmap(decoded, font) : null;
  return {
    resourceName,
    baseFont,
    bytes: usable,
    fallback: styled.fallback,
    systemFamily: styled.family,
    primary: false,
  };
}

function descriptorOf(font: PDFDict): PDFDict | undefined {
  const direct = font.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
  if (direct) return direct;
  const descendants = font.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
  const first = descendants?.lookup(0);
  if (!(first instanceof PDFDict)) return undefined;
  return first.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
}

function fontFile(descriptor: PDFDict): PDFRawStream | undefined {
  for (const name of ["FontFile2", "FontFile3", "FontFile"]) {
    const file = descriptor.lookup(PDFName.of(name));
    if (file instanceof PDFRawStream) return file;
  }
  return undefined;
}

function streamBytes(value: PDFObject): Uint8Array | null {
  if (!(value instanceof PDFRawStream)) return null;
  try {
    const decoded = decodePDFRawStream(value).decode();
    if (decoded.length > 0) return decoded;
  } catch {
    // Some files store the bytes without a filter we can decode.
  }
  try {
    const raw = value.getContents();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function useOrder(page: PDFDict, fonts: Map<string, Prepared>): Prepared[] {
  const ordered: Prepared[] = [];
  const seen = new Set<string>();
  const push = (font: Prepared | undefined, primary: boolean) => {
    if (!font || seen.has(font.resourceName)) return;
    seen.add(font.resourceName);
    font.primary = primary;
    ordered.push(font);
  };
  const walk = (bytes: Uint8Array | null, prefix: string) => {
    if (!bytes) return;
    const text = new TextDecoder("latin1").decode(bytes);
    const pattern = /\/([^\s[\]<>(){}/%]+)(?:\s+[-+]?(?:\d+\.?\d*|\.\d+)\s+Tf|\s+Do)/g;
    for (const match of text.matchAll(pattern)) {
      const name = match[1];
      if (!name) continue;
      if (match[0].endsWith("Tf")) {
        push(fonts.get(prefix ? `${prefix}/${name}` : name) ?? fonts.get(name), true);
        continue;
      }
      const nested = streamOf(page, name);
      if (nested) walk(nested, name);
    }
  };
  const contents = page.lookup(PDFName.of("Contents"));
  if (contents instanceof PDFArray) {
    for (let index = 0; index < contents.size(); index += 1) walk(streamBytes(contents.lookup(index) as PDFObject), "");
  } else if (contents) {
    walk(streamBytes(contents), "");
  }
  for (const font of fonts.values()) push(font, false);
  return ordered;
}

function streamOf(page: PDFDict, name: string): Uint8Array | null {
  const resources = page.lookupMaybe(PDFName.of("Resources"), PDFDict);
  const objects = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  const object = objects?.lookup(PDFName.of(name));
  if (object instanceof PDFRawStream) return streamBytes(object);
  return null;
}

async function install(font: Prepared): Promise<PageFace | null> {
  let family = font.systemFamily;
  if (font.bytes && font.bytes.length < 8_000_000) {
    const embedded = familyId(font.bytes, font.baseFont);
    try {
      const copy = font.bytes.slice().buffer;
      const face = new FontFace(embedded, copy);
      await face.load();
      document.fonts.add(face);
      family = embedded;
    } catch {
      family = font.systemFamily;
    }
  }
  return {
    resourceName: font.resourceName,
    baseFont: font.baseFont,
    family,
    fallback: font.fallback,
    primary: font.primary,
  };
}

function styleForBase(baseFont: string): { family: string; fallback: string } {
  const name = baseFont.replace(/^[A-Z]{6}\+/, "").toLowerCase();
  if (/courier|mono|consolas|menlo|inconsolata/.test(name)) {
    return { family: "Courier New", fallback: "Courier, monospace" };
  }
  if (
    /times|roman|georgia|garamond|cambria|palatino|baskerville|minion|caslon|merriweather|charter|antiqua|nimbusrom|serif/.test(
      name,
    ) &&
    !/sans/.test(name)
  ) {
    return { family: "Times New Roman", fallback: 'Times, "Liberation Serif", serif' };
  }
  return { family: "Helvetica", fallback: "Arial, sans-serif" };
}

async function pickFace(
  sample: RunFace | undefined,
  ordered: PageFace | undefined,
  faces: PageFace[],
): Promise<PageFace | undefined> {
  const pool = faces.some((face) => face.primary) ? faces.filter((face) => face.primary) : faces;
  if (!sample) return ordered ?? pool[0];
  let best: PageFace | undefined;
  let bestDelta = Infinity;
  for (const face of pool) {
    const delta = await widthDelta(sample, face);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = face;
    }
  }
  if (ordered) {
    const orderedDelta = await widthDelta(sample, ordered);
    if (orderedDelta <= bestDelta + 0.08) return ordered;
  }
  return best ?? ordered;
}

async function widthDelta(sample: RunFace, face: PageFace): Promise<number> {
  const size = Math.max(sample.size, 1);
  try {
    await document.fonts.load(`${size}px "${face.family}", ${face.fallback}`);
  } catch {
    // Measurement still uses whichever face the browser resolved.
  }
  const measured = measure(sample.text, size, face.family, face.fallback);
  return Math.abs(measured - sample.w) / Math.max(sample.w, 1);
}

let measureContext: CanvasRenderingContext2D | null = null;

function measure(text: string, size: number, family: string, fallback: string): number {
  if (!measureContext) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * size * 0.5;
  measureContext.font = `${size}px "${family}", ${fallback}`;
  return measureContext.measureText(text).width;
}

function familyId(bytes: Uint8Array, baseFont: string): string {
  let hash = 2166136261;
  const limit = Math.min(bytes.length, 4096);
  for (let index = 0; index < limit; index += 1) hash = Math.imul(hash ^ (bytes[index] ?? 0), 16777619);
  for (let index = 0; index < baseFont.length; index += 1) {
    hash = Math.imul(hash ^ baseFont.charCodeAt(index), 16777619);
  }
  return `pdf-editor-${(hash >>> 0).toString(36)}`;
}

function isSfnt(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const tag = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
  return tag === "OTTO" || tag === "true" || tag === "\0\u0001\0\0" || ((bytes[0] ?? 0) === 0 && (bytes[1] ?? 0) === 1);
}

function unifyCmap(bytes: Uint8Array, font: PDFDict): Uint8Array {
  if (latinCoverage(bytes) >= 10) return bytes;
  const unicode = toUnicodeMap(font, bytes);
  if (unicode.size < 8) return bytes;
  const cmap = buildFormat4(unicode);
  return replaceTable(bytes, "cmap", cmap) ?? bytes;
}

function latinCoverage(bytes: Uint8Array): number {
  let count = 0;
  for (let code = 0x41; code <= 0x7a; code += 1) {
    if (code > 0x5a && code < 0x61) continue;
    if (glyphFor(bytes, code, true) > 0) count += 1;
  }
  return count;
}

function toUnicodeMap(font: PDFDict, bytes: Uint8Array): Map<number, number> {
  const map = new Map<number, number>();
  const add = (code: number, unicode: number) => {
    if (unicode <= 0 || unicode >= 0xffff) return;
    const glyph = glyphId(font, bytes, code);
    if (glyph > 0) map.set(unicode, glyph);
  };
  const text = unicodeProgram(font);
  if (!text) return map;
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1]?.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) ?? []) {
      const unicode = pair[2] ?? "";
      if (unicode.length !== 4) continue;
      add(Number.parseInt(pair[1] ?? "", 16), Number.parseInt(unicode, 16));
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const body = block[1] ?? "";
    for (const range of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const start = Number.parseInt(range[1] ?? "", 16);
      const end = Number.parseInt(range[2] ?? "", 16);
      const unicode = Number.parseInt(range[3] ?? "", 16);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end - start > 512) continue;
      for (let offset = 0; offset <= end - start; offset += 1) add(start + offset, unicode + offset);
    }
    for (const range of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g)) {
      const start = Number.parseInt(range[1] ?? "", 16);
      const listed = [...(range[3]?.matchAll(/<([0-9A-Fa-f]+)>/g) ?? [])];
      listed.forEach((item, offset) => {
        const unicode = item[1] ?? "";
        if (unicode.length !== 4) return;
        add(start + offset, Number.parseInt(unicode, 16));
      });
    }
  }
  return map;
}

function unicodeProgram(font: PDFDict): string | null {
  const own = font.lookup(PDFName.of("ToUnicode"));
  const ownBytes = own ? streamBytes(own) : null;
  if (ownBytes) return new TextDecoder("latin1").decode(ownBytes);
  const descendants = font.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
  const first = descendants?.lookup(0);
  if (!(first instanceof PDFDict)) return null;
  const nested = first.lookup(PDFName.of("ToUnicode"));
  const nestedBytes = nested ? streamBytes(nested) : null;
  return nestedBytes ? new TextDecoder("latin1").decode(nestedBytes) : null;
}

function glyphId(font: PDFDict, bytes: Uint8Array, code: number): number {
  const mapped = cidToGlyph(font, code);
  if (mapped > 0) return mapped;
  return glyphFor(bytes, code, false);
}

function cidToGlyph(font: PDFDict, code: number): number {
  const descendants = font.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
  const first = descendants?.lookup(0);
  if (!(first instanceof PDFDict)) return 0;
  const map = first.lookup(PDFName.of("CIDToGIDMap"));
  if (map instanceof PDFName) return map.asString() === "Identity" ? code : 0;
  const bytes = map ? streamBytes(map) : null;
  if (!bytes) return 0;
  const offset = code * 2;
  if (offset + 1 >= bytes.length) return 0;
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

type Subtable = { platform: number; encoding: number; offset: number };

function cmapSubtables(bytes: Uint8Array): Subtable[] {
  const table = findTable(bytes, "cmap");
  if (!table) return [];
  const count = read16(bytes, table.offset + 2);
  const tables: Subtable[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = table.offset + 4 + index * 8;
    tables.push({
      platform: read16(bytes, offset),
      encoding: read16(bytes, offset + 2),
      offset: table.offset + read32(bytes, offset + 4),
    });
  }
  return tables;
}

function glyphFor(bytes: Uint8Array, code: number, unicodeOnly: boolean): number {
  const tables = cmapSubtables(bytes).filter((table) => {
    if (!unicodeOnly) return true;
    return table.platform === 0 || (table.platform === 3 && (table.encoding === 1 || table.encoding === 10));
  });
  for (const table of tables) {
    const glyph = glyphAt(bytes, table.offset, code);
    if (glyph > 0) return glyph;
  }
  return 0;
}

function glyphAt(bytes: Uint8Array, offset: number, code: number): number {
  const format = read16(bytes, offset);
  if (format === 4) return glyphFormat4(bytes, offset, code);
  if (format === 12) return glyphFormat12(bytes, offset, code);
  if (format === 6) return glyphFormat6(bytes, offset, code);
  if (format === 0 && code < 256) return bytes[offset + 6 + code] ?? 0;
  return 0;
}

function glyphFormat4(bytes: Uint8Array, offset: number, code: number): number {
  const segCount = read16(bytes, offset + 6) / 2;
  const endOffset = offset + 14;
  const startOffset = endOffset + segCount * 2 + 2;
  const deltaOffset = startOffset + segCount * 2;
  const rangeOffset = deltaOffset + segCount * 2;
  for (let index = 0; index < segCount; index += 1) {
    const end = read16(bytes, endOffset + index * 2);
    if (code > end) continue;
    const start = read16(bytes, startOffset + index * 2);
    if (code < start) return 0;
    const delta = read16(bytes, deltaOffset + index * 2);
    const range = read16(bytes, rangeOffset + index * 2);
    if (range === 0) return (code + delta) & 0xffff;
    const glyphOffset = rangeOffset + index * 2 + range + (code - start) * 2;
    const glyph = read16(bytes, glyphOffset);
    if (glyph === 0) return 0;
    return (glyph + delta) & 0xffff;
  }
  return 0;
}

function glyphFormat12(bytes: Uint8Array, offset: number, code: number): number {
  const groups = read32(bytes, offset + 12);
  for (let index = 0; index < groups; index += 1) {
    const group = offset + 16 + index * 12;
    const start = read32(bytes, group);
    const end = read32(bytes, group + 4);
    if (code < start || code > end) continue;
    return (read32(bytes, group + 8) + code - start) & 0xffff;
  }
  return 0;
}

function glyphFormat6(bytes: Uint8Array, offset: number, code: number): number {
  const first = read16(bytes, offset + 6);
  const count = read16(bytes, offset + 8);
  if (code < first || code >= first + count) return 0;
  return read16(bytes, offset + 10 + (code - first) * 2);
}

function buildFormat4(map: Map<number, number>): Uint8Array {
  const codes = [...map.keys()].filter((code) => code > 0 && code < 0xffff).sort((a, b) => a - b);
  const segments: { start: number; end: number; glyph: number }[] = [];
  for (const code of codes) {
    const glyph = map.get(code) ?? 0;
    const last = segments[segments.length - 1];
    if (last && code === last.end + 1 && glyph === ((last.glyph + (code - last.start)) & 0xffff)) {
      last.end = code;
      continue;
    }
    segments.push({ start: code, end: code, glyph });
  }
  segments.push({ start: 0xffff, end: 0xffff, glyph: 0 });
  const segCount = segments.length;
  const length = 16 + segCount * 8;
  const out = new Uint8Array(length);
  write16(out, 0, 4);
  write16(out, 2, length);
  write16(out, 6, segCount * 2);
  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= segCount) {
    searchRange *= 2;
    entrySelector += 1;
  }
  searchRange *= 2;
  write16(out, 8, searchRange);
  write16(out, 10, entrySelector);
  write16(out, 12, segCount * 2 - searchRange);
  const endOffset = 14;
  const startOffset = endOffset + segCount * 2 + 2;
  const deltaOffset = startOffset + segCount * 2;
  segments.forEach((segment, index) => {
    write16(out, endOffset + index * 2, segment.end);
    write16(out, startOffset + index * 2, segment.start);
    const delta = segment.start === 0xffff ? 1 : (segment.glyph - segment.start) & 0xffff;
    write16(out, deltaOffset + index * 2, delta);
    write16(out, deltaOffset + segCount * 2 + index * 2, 0);
  });
  return out;
}

function replaceTable(bytes: Uint8Array, tag: string, data: Uint8Array): Uint8Array | null {
  if (bytes.length < 12 || !findTable(bytes, tag)) return null;
  const count = read16(bytes, 4);
  const tables: { tag: string; data: Uint8Array }[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 12 + index * 16;
    const name = String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0);
    const start = read32(bytes, offset + 8);
    const length = read32(bytes, offset + 12);
    tables.push({
      tag: name,
      data: name === tag ? data : bytes.slice(start, start + length),
    });
  }
  let cursor = 12 + tables.length * 16;
  const placed = tables.map((table) => {
    const start = cursor;
    cursor += table.data.length;
    cursor = (cursor + 3) & ~3;
    return { ...table, start };
  });
  const out = new Uint8Array(cursor);
  out.set(bytes.subarray(0, 4), 0);
  write16(out, 4, tables.length);
  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= tables.length) {
    searchRange *= 2;
    entrySelector += 1;
  }
  searchRange *= 16;
  write16(out, 6, searchRange);
  write16(out, 8, entrySelector);
  write16(out, 10, tables.length * 16 - searchRange);
  placed.forEach((table, index) => {
    const offset = 12 + index * 16;
    for (let char = 0; char < 4; char += 1) out[offset + char] = table.tag.charCodeAt(char);
    write32(out, offset + 4, checksum(table.data, 0, table.data.length));
    write32(out, offset + 8, table.start);
    write32(out, offset + 12, table.data.length);
    out.set(table.data, table.start);
  });
  const head = placed.find((table) => table.tag === "head");
  if (!head) return out;
  write32(out, head.start + 8, 0);
  const headIndex = placed.indexOf(head);
  write32(out, 12 + headIndex * 16 + 4, checksum(out, head.start, head.data.length));
  const sum = checksum(out, 0, out.length);
  write32(out, head.start + 8, (0xb1b0afba - sum) >>> 0);
  write32(out, 12 + headIndex * 16 + 4, checksum(out, head.start, head.data.length));
  return out;
}

function findTable(bytes: Uint8Array, tag: string): { offset: number; length: number } | null {
  if (bytes.length < 12) return null;
  const count = read16(bytes, 4);
  for (let index = 0; index < count; index += 1) {
    const offset = 12 + index * 16;
    const name = String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0);
    if (name !== tag) continue;
    return { offset: read32(bytes, offset + 8), length: read32(bytes, offset + 12) };
  }
  return null;
}

function checksum(bytes: Uint8Array, offset: number, length: number): number {
  let sum = 0;
  const padded = Math.ceil(length / 4) * 4;
  for (let index = 0; index < padded; index += 4) {
    const at = offset + index;
    const byte = (shift: number) => (index + shift < length ? (bytes[at + shift] ?? 0) : 0);
    sum = (sum + ((byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3))) >>> 0;
  }
  return sum;
}

function read16(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function read32(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function write16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >> 8) & 255;
  bytes[offset + 1] = value & 255;
}

function write32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 255;
  bytes[offset + 1] = (value >>> 16) & 255;
  bytes[offset + 2] = (value >>> 8) & 255;
  bytes[offset + 3] = value & 255;
}
