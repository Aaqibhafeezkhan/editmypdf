import { OPS } from "pdfjs-dist";

// How a page actually drew its text: for each pdf.js font, which code in the converted font (its
// "fontChar") was used for each Unicode character, and how often.
export type GlyphUse = Map<string, Map<string, number>>;

type Subtable = { platform: number; encoding: number; offset: number };

const registered = new Map<string, Promise<string | null>>();
const cmaps = new Map<string, Map<number, number>>();
// The code points each page drew with a font, by pdf.js font name: whatever the page shows is
// covered, whichever glyph the converted font's own cmap happens to name for it.
const drawn = new Map<string, Set<number>>();
const bytesByFamily = new Map<string, Uint8Array>();
let serial = 0;

// pdf.js converts every embedded font to OpenType with each glyph at a private-use code, and adds
// Unicode entries only as a courtesy; a ligature glyph can then take the slot of a plain letter.
// Typing needs a face whose Unicode cmap maps every character to the glyph the page used for it,
// so this builds one from the page's own text and registers it as a separate font family.
export function collectGlyphUse(fnArray: number[], argsArray: unknown[]): Map<string, GlyphUse> {
  const fonts = new Map<string, GlyphUse>();
  let current = "";
  for (let index = 0; index < fnArray.length; index += 1) {
    const fn = fnArray[index];
    const args = argsArray[index];
    if (fn === OPS.setFont && Array.isArray(args) && typeof args[0] === "string") {
      current = args[0];
      continue;
    }
    if (fn !== OPS.showText || !current || !Array.isArray(args) || !Array.isArray(args[0])) continue;
    let use = fonts.get(current);
    if (!use) {
      use = new Map();
      fonts.set(current, use);
    }
    for (const glyph of args[0] as unknown[]) {
      if (!glyph || typeof glyph !== "object") continue;
      const { unicode, fontChar, isSpace } = glyph as { unicode?: unknown; fontChar?: unknown; isSpace?: unknown };
      if (isSpace || typeof unicode !== "string" || typeof fontChar !== "string") continue;
      if ([...unicode].length !== 1 || [...fontChar].length !== 1) continue;
      let codes = use.get(unicode);
      if (!codes) {
        codes = new Map();
        use.set(unicode, codes);
      }
      codes.set(fontChar, (codes.get(fontChar) ?? 0) + 1);
    }
  }
  return fonts;
}

// Registers (once per distinct mapping) a copy of the font whose Unicode cmap follows the page,
// and resolves to its family name. Null when the font bytes cannot be rewritten.
export function editableFamily(loadedName: string, data: Uint8Array | null | undefined, use: GlyphUse | undefined): Promise<string | null> {
  const existing = coverageOf(loadedName, data);
  if (use) rememberDrawn(loadedName, use);
  if (!data || !existing || existing.size === 0 || !use || use.size === 0 || typeof document === "undefined") return Promise.resolve(null);
  // Only characters whose Unicode entry points at a different glyph than the page used need fixing,
  // so pages that agree with the font share one registered face.
  const chosen = new Map<number, number>();
  for (const [unicode, codes] of use) {
    let best = "";
    let bestCount = 0;
    for (const [fontChar, count] of codes) {
      if (count > bestCount) {
        best = fontChar;
        bestCount = count;
      }
    }
    const code = unicode.codePointAt(0);
    const fontChar = best.codePointAt(0);
    if (code == null || fontChar == null || code === fontChar) continue;
    const glyph = existing.get(fontChar);
    if (!glyph || existing.get(code) === glyph) continue;
    chosen.set(code, glyph);
  }
  if (chosen.size === 0) return Promise.resolve(null);
  const key = `${loadedName}|${[...chosen].sort((a, b) => a[0] - b[0]).map(([code, fontChar]) => `${code}>${fontChar}`).join(",")}`;
  const cached = registered.get(key);
  if (cached) return cached;
  const pending = install(loadedName, data, existing, chosen).catch(() => null);
  registered.set(key, pending);
  return pending;
}

async function install(
  loadedName: string,
  data: Uint8Array,
  existing: Map<number, number>,
  chosen: Map<number, number>,
): Promise<string | null> {
  const map = new Map(existing);
  for (const [code, glyph] of chosen) map.set(code, glyph);
  const fixed = replaceTable(data, "cmap", buildCmap(map));
  if (!fixed) return null;
  serial += 1;
  const family = `${loadedName}-edit${serial}`;
  const face = new FontFace(family, fixed.buffer as ArrayBuffer);
  await face.load();
  document.fonts.add(face);
  bytesByFamily.set(family, fixed);
  return family;
}

// The rewritten font bytes behind a family `editableFamily` registered, so the same face can be
// embedded in a file; null for a family it did not make.
export function familyBytes(family: string): Uint8Array | null {
  return bytesByFamily.get(family) ?? null;
}

// Records what a face built elsewhere (one rebuilt from a Type3 font's outlines) covers, and
// what the page drew with it, so `missingGlyphs` can speak for it too.
export function rememberCoverage(loadedName: string, data: Uint8Array, use: GlyphUse | undefined): void {
  cmaps.set(loadedName, unicodeMap(data));
  if (use) rememberDrawn(loadedName, use);
}

// Every Unicode code point an OpenType font maps to a glyph, with the glyph's index.
export function fontUnicodeMap(bytes: Uint8Array): Map<number, number> {
  return unicodeMap(bytes);
}

// The Unicode cmap of a font pdf.js converted, read once per pdf.js font name; null without bytes.
function coverageOf(loadedName: string, data: Uint8Array | null | undefined): Map<number, number> | null {
  if (!data || data.length < 12) return null;
  let map = cmaps.get(loadedName);
  if (!map) {
    map = unicodeMap(data);
    cmaps.set(loadedName, map);
  }
  return map;
}

function rememberDrawn(loadedName: string, use: GlyphUse): void {
  let codes = drawn.get(loadedName);
  if (!codes) {
    codes = new Set();
    drawn.set(loadedName, codes);
  }
  for (const unicode of use.keys()) {
    const code = unicode.codePointAt(0);
    if (code != null) codes.add(code);
  }
}

// The characters of `text` that the font pdf.js loaded as `loadedName` has no glyph for, each once
// in order of first appearance: the browser draws them in the face's fallback family instead.
// Whitespace never counts (a converted font has no space glyph; spaces always come from the
// fallback), nor does anything the page itself drew with the font. Empty when the font's coverage
// is unknown (a system font, a Type3 font), so nothing is reported on a guess.
export function missingGlyphs(loadedName: string, text: string): string[] {
  const map = cmaps.get(loadedName);
  if (!map || map.size === 0) return [];
  const used = drawn.get(loadedName);
  const missing: string[] = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code == null || /\s/u.test(char) || map.has(code) || used?.has(code) || missing.includes(char)) continue;
    missing.push(char);
  }
  return missing;
}

function unicodeMap(bytes: Uint8Array): Map<number, number> {
  const map = new Map<number, number>();
  const tables = cmapSubtables(bytes).filter(
    (table) => table.platform === 0 || (table.platform === 3 && (table.encoding === 1 || table.encoding === 10)),
  );
  for (const table of tables) {
    for (const [code, glyph] of enumerateSubtable(bytes, table.offset)) {
      if (glyph > 0 && !map.has(code)) map.set(code, glyph);
    }
  }
  return map;
}

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

function enumerateSubtable(bytes: Uint8Array, offset: number): [number, number][] {
  const format = read16(bytes, offset);
  const out: [number, number][] = [];
  if (format === 4) {
    const segCount = read16(bytes, offset + 6) / 2;
    const endOffset = offset + 14;
    const startOffset = endOffset + segCount * 2 + 2;
    const deltaOffset = startOffset + segCount * 2;
    const rangeOffset = deltaOffset + segCount * 2;
    for (let index = 0; index < segCount; index += 1) {
      const end = read16(bytes, endOffset + index * 2);
      const start = read16(bytes, startOffset + index * 2);
      const delta = read16(bytes, deltaOffset + index * 2);
      const range = read16(bytes, rangeOffset + index * 2);
      if (start > end || end - start > 0x4000) continue;
      for (let code = start; code <= end && code !== 0xffff; code += 1) {
        let glyph: number;
        if (range === 0) glyph = (code + delta) & 0xffff;
        else {
          const at = rangeOffset + index * 2 + range + (code - start) * 2;
          if (at + 1 >= bytes.length) continue;
          const raw = read16(bytes, at);
          glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
        }
        if (glyph > 0) out.push([code, glyph]);
      }
    }
    return out;
  }
  if (format === 12) {
    const groups = read32(bytes, offset + 12);
    for (let index = 0; index < Math.min(groups, 20000); index += 1) {
      const group = offset + 16 + index * 12;
      const start = read32(bytes, group);
      const end = read32(bytes, group + 4);
      const first = read32(bytes, group + 8);
      if (start > end || end - start > 0x4000) continue;
      for (let code = start; code <= end; code += 1) out.push([code, first + code - start]);
    }
    return out;
  }
  if (format === 6) {
    const first = read16(bytes, offset + 6);
    const count = read16(bytes, offset + 8);
    for (let index = 0; index < count; index += 1) out.push([first + index, read16(bytes, offset + 10 + index * 2)]);
    return out;
  }
  if (format === 0) {
    for (let code = 0; code < 256; code += 1) out.push([code, bytes[offset + 6 + code] ?? 0]);
  }
  return out;
}

type Segment = { start: number; end: number; glyph: number };

function segmentsOf(codes: number[], map: Map<number, number>): Segment[] {
  const segments: Segment[] = [];
  for (const code of codes) {
    const glyph = map.get(code) ?? 0;
    const last = segments[segments.length - 1];
    if (last && code === last.end + 1 && glyph === last.glyph + (code - last.start)) {
      last.end = code;
      continue;
    }
    segments.push({ start: code, end: code, glyph });
  }
  return segments;
}

function buildFormat4(map: Map<number, number>): Uint8Array {
  const codes = [...map.keys()].filter((code) => code > 0 && code < 0xffff).sort((a, b) => a - b);
  const segments = segmentsOf(codes, map);
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
  const rangeOffset = deltaOffset + segCount * 2;
  segments.forEach((segment, index) => {
    write16(out, endOffset + index * 2, segment.end);
    write16(out, startOffset + index * 2, segment.start);
    const delta = segment.start === 0xffff ? 1 : (segment.glyph - segment.start) & 0xffff;
    write16(out, deltaOffset + index * 2, delta);
    write16(out, rangeOffset + index * 2, 0);
  });
  return out;
}

function buildFormat12(map: Map<number, number>): Uint8Array {
  const codes = [...map.keys()].filter((code) => code > 0 && code <= 0x10ffff).sort((a, b) => a - b);
  const segments = segmentsOf(codes, map);
  const length = 16 + segments.length * 12;
  const out = new Uint8Array(length);
  write16(out, 0, 12);
  write32(out, 4, length);
  write32(out, 12, segments.length);
  segments.forEach((segment, index) => {
    const at = 16 + index * 12;
    write32(out, at, segment.start);
    write32(out, at + 4, segment.end);
    write32(out, at + 8, segment.glyph);
  });
  return out;
}

function buildCmap(map: Map<number, number>): Uint8Array {
  const format4 = buildFormat4(map);
  const format12 = buildFormat12(map);
  const records = 3;
  const header = 4 + records * 8;
  const offset4 = header;
  const offset12 = (offset4 + format4.length + 3) & ~3;
  const out = new Uint8Array(offset12 + format12.length);
  write16(out, 0, 0);
  write16(out, 2, records);
  const record = (index: number, platform: number, encoding: number, offset: number) => {
    write16(out, 4 + index * 8, platform);
    write16(out, 6 + index * 8, encoding);
    write32(out, 8 + index * 8, offset);
  };
  record(0, 0, 4, offset12);
  record(1, 3, 1, offset4);
  record(2, 3, 10, offset12);
  out.set(format4, offset4);
  out.set(format12, offset12);
  return out;
}

function replaceTable(bytes: Uint8Array, tag: string, data: Uint8Array): Uint8Array | null {
  if (bytes.length < 12 || !findTable(bytes, tag)) return null;
  const count = read16(bytes, 4);
  const tables: { tag: string; data: Uint8Array }[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 12 + index * 16;
    const name = tagAt(bytes, offset);
    const start = read32(bytes, offset + 8);
    const length = read32(bytes, offset + 12);
    if (start + length > bytes.length) return null;
    tables.push({ tag: name, data: name === tag ? data : bytes.slice(start, start + length) });
  }
  let cursor = 12 + tables.length * 16;
  const placed = tables.map((table) => {
    const start = cursor;
    cursor = (cursor + table.data.length + 3) & ~3;
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
    write32(out, offset + 4, checksum(table.data));
    write32(out, offset + 8, table.start);
    write32(out, offset + 12, table.data.length);
    out.set(table.data, table.start);
  });
  const head = placed.find((table) => table.tag === "head");
  if (head) write32(out, head.start + 8, 0);
  return out;
}

function findTable(bytes: Uint8Array, tag: string): { offset: number; length: number } | null {
  if (bytes.length < 12) return null;
  const count = read16(bytes, 4);
  for (let index = 0; index < count; index += 1) {
    const offset = 12 + index * 16;
    if (tagAt(bytes, offset) !== tag) continue;
    return { offset: read32(bytes, offset + 8), length: read32(bytes, offset + 12) };
  }
  return null;
}

function tagAt(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0);
}

function checksum(bytes: Uint8Array): number {
  let sum = 0;
  const padded = Math.ceil(bytes.length / 4) * 4;
  for (let index = 0; index < padded; index += 4) {
    const byte = (shift: number) => (index + shift < bytes.length ? (bytes[index + shift] ?? 0) : 0);
    sum = (sum + ((byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3))) >>> 0;
  }
  return sum;
}

function read16(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function read32(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)) >>> 0
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
