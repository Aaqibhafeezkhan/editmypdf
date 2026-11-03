import { BOLD_NAME, ITALIC_NAME, stemOf, traitKey, traitsOfName } from "./fontNames.ts";
import type { FontOffer } from "./supplementFonts.ts";
import { keepUserFont, type UserFont } from "./userFonts.ts";

// The fonts installed on the user's machine, through the Local Font Access API (Chromium only):
// the third source of the characters an embedded subset lacks, between the bundled open fonts and
// a file the user picks. A page font is most often one the document's author had installed, and
// the reader of the same document often has it too; one click finds it, and its bytes serve the
// display and the export exactly like an added file, so the characters come from the font itself
// rather than from the nearest open design (Tinos for Times New Roman, Noto for the rest). The
// API needs a user gesture and the `local-fonts` permission, so it is only ever called from a
// button, and a browser without it (Safari, Firefox) never shows the button.

type FontData = {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob(): Promise<Blob>;
};

type QueryLocalFonts = (options?: { postscriptNames?: string[] }) => Promise<FontData[]>;

function query(): QueryLocalFonts | null {
  if (typeof window === "undefined") return null;
  const fn = (window as { queryLocalFonts?: unknown }).queryLocalFonts;
  return typeof fn === "function" ? (fn as QueryLocalFonts).bind(window) : null;
}

// Whether this browser can read the installed fonts at all.
export function localFontsSupported(): boolean {
  return query() !== null;
}

// Finds the page font among the installed fonts and keeps it as a user font under the offer's key.
// Must be called from a click handler. Throws, with a sentence for the user, when the browser was
// not allowed to read the fonts or none of them matches.
export async function adoptLocalFont(offer: FontOffer): Promise<UserFont> {
  const queryLocalFonts = query();
  if (!queryLocalFonts) throw new Error("This browser cannot read the fonts installed on this computer.");
  const label = offer.name || "the page's font";
  let match: FontData | undefined;
  try {
    match = await findLocalFont(queryLocalFonts, offer);
  } catch (failure) {
    if (failure instanceof DOMException && (failure.name === "NotAllowedError" || failure.name === "SecurityError")) {
      throw new Error("The browser was not allowed to read the fonts installed on this computer.");
    }
    throw new Error("The fonts installed on this computer could not be read.");
  }
  if (!match) throw new Error(`No font installed on this computer matches ${label}.`);
  const bytes = new Uint8Array(await (await match.blob()).arrayBuffer());
  return keepUserFont(faceOf(bytes, match.postscriptName), offer.key, match.fullName || match.postscriptName, "local");
}

// The installed font that is the page's font: the one with its PostScript name, else the first
// whose names say it is the same typeface and cut (the installed "Trebuchet MS" in style "Bold" for
// a page font named "TrebuchetMS-Bold" under some other PostScript name).
async function findLocalFont(queryLocalFonts: QueryLocalFonts, offer: FontOffer): Promise<FontData | undefined> {
  const names = [...(offer.name ? [offer.name] : []), ...appleAliases(offer)];
  if (names.length > 0) {
    const exact = await queryLocalFonts({ postscriptNames: names });
    const found = names.map((name) => exact.find((font) => font.postscriptName === name)).find(Boolean) ?? exact[0];
    if (found) return found;
  }
  const all = await queryLocalFonts();
  return all.find((font) => keysOf(font).includes(offer.key));
}

// macOS embeds its system font under hidden names (".SFNS-Regular", ".SFNSText-Bold", the older
// ".SFUIText-Regular") that the browser does not list among the installed fonts; the same design
// is installed as SF Pro, under these PostScript names, on a machine with Apple's download.
function appleAliases(offer: FontOffer): string[] {
  if (!/^\.?sf(?:ns|ui)/i.test(offer.name)) return [];
  const cut = offer.key.endsWith("-bi") ? "BoldItalic" : offer.key.endsWith("-b") ? "Bold" : offer.key.endsWith("-i") ? "RegularItalic" : "Regular";
  return ["SFPro", "SFProText", "SFProDisplay"].map((family) => `${family}-${cut}`);
}

function keysOf(font: FontData): string[] {
  const style = font.style || "";
  return [
    ...(font.postscriptName ? [traitKey(traitsOfName(font.postscriptName))] : []),
    ...(font.fullName ? [traitKey(traitsOfName(font.fullName))] : []),
    ...(font.family ? [traitKey({ stem: stemOf(font.family), bold: BOLD_NAME.test(style), italic: ITALIC_NAME.test(style) })] : []),
  ];
}

// The bytes of one face: the file itself for a TrueType or CFF font, and for a collection (.ttc,
// which the API hands over whole) a standalone font built from the face with the wanted PostScript
// name, else the first face.
function faceOf(bytes: Uint8Array, postscriptName: string): Uint8Array {
  if (bytes.length < 12 || tagAt(bytes, 0) !== "ttcf") return bytes;
  const count = read32(bytes, 8);
  let first: Uint8Array | null = null;
  for (let index = 0; index < count; index += 1) {
    const offset = read32(bytes, 12 + index * 4);
    const face = standalone(bytes, offset);
    if (!face) continue;
    first ??= face;
    if (postscriptName && postScriptNameOf(face) === postscriptName) return face;
  }
  return first ?? bytes;
}

// One face of a collection as a font file of its own: its table directory, with the tables it
// points at copied behind it.
function standalone(bytes: Uint8Array, offset: number): Uint8Array | null {
  if (offset + 12 > bytes.length) return null;
  const count = read16(bytes, offset + 4);
  const tables: { tag: string; checksum: number; data: Uint8Array }[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = offset + 12 + index * 16;
    if (at + 16 > bytes.length) return null;
    const start = read32(bytes, at + 8);
    const length = read32(bytes, at + 12);
    if (start + length > bytes.length) return null;
    tables.push({ tag: tagAt(bytes, at), checksum: read32(bytes, at + 4), data: bytes.subarray(start, start + length) });
  }
  let cursor = 12 + count * 16;
  const placed = tables.map((table) => {
    const start = cursor;
    cursor = (cursor + table.data.length + 3) & ~3;
    return { ...table, start };
  });
  const out = new Uint8Array(cursor);
  out.set(bytes.subarray(offset, offset + 12), 0);
  placed.forEach((table, index) => {
    const at = 12 + index * 16;
    for (let char = 0; char < 4; char += 1) out[at + char] = table.tag.charCodeAt(char);
    write32(out, at + 4, table.checksum);
    write32(out, at + 8, table.start);
    write32(out, at + 12, table.data.length);
    out.set(table.data, table.start);
  });
  return out;
}

// The PostScript name (name ID 6) from a font's name table: the Windows Unicode record, else the
// Macintosh Roman one; "" when the table has neither.
function postScriptNameOf(font: Uint8Array): string {
  const count = read16(font, 4);
  for (let index = 0; index < count; index += 1) {
    const at = 12 + index * 16;
    if (tagAt(font, at) !== "name") continue;
    const table = read32(font, at + 8);
    if (table + 6 > font.length) return "";
    const records = read16(font, table + 2);
    const strings = table + read16(font, table + 4);
    let mac = "";
    for (let record = 0; record < records; record += 1) {
      const entry = table + 6 + record * 12;
      if (entry + 12 > font.length) break;
      const platform = read16(font, entry);
      const encoding = read16(font, entry + 2);
      const nameId = read16(font, entry + 6);
      if (nameId !== 6) continue;
      const length = read16(font, entry + 8);
      const start = strings + read16(font, entry + 10);
      if (start + length > font.length) continue;
      const slice = font.subarray(start, start + length);
      if (platform === 3 && (encoding === 1 || encoding === 10)) {
        let text = "";
        for (let char = 0; char + 1 < slice.length; char += 2) text += String.fromCharCode(((slice[char] ?? 0) << 8) | (slice[char + 1] ?? 0));
        return text;
      }
      if (platform === 1 && !mac) mac = String.fromCharCode(...slice);
    }
    return mac;
  }
  return "";
}

function tagAt(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0);
}

function read16(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function read32(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)) >>> 0
  );
}

function write32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 255;
  bytes[offset + 1] = (value >>> 16) & 255;
  bytes[offset + 2] = (value >>> 8) & 255;
  bytes[offset + 3] = value & 255;
}
