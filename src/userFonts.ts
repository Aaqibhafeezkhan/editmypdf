import { fontUnicodeMap } from "./fontFix.ts";
import { BOLD_NAME, ITALIC_NAME, stemOf, traitKey, traitsOfName, userFamilyName } from "./fontNames.ts";
import { readStored, writeStored } from "./session.ts";
import { uid } from "./types.ts";

// Font files the user has added for page fonts nothing bundled matches, kept in this browser
// rather than in any document (like the saved signatures), so a font added once supplies the
// characters an embedded subset of the same face lacks in every later document. A file is kept
// under the trait key of the page font it was added for and under the keys of its own names, so
// the same face found under another name is served too. A font comes from a file the user picked
// or from the fonts installed on their machine (`localFonts.ts`); both serve the same way.
export type UserFontSource = "file" | "local";

export type UserFont = {
  id: string;
  // The font's full name, as its name table gives it: "Garamond Premier Pro Bold".
  label: string;
  source: UserFontSource;
  // Trait keys (`traitKey`) of the page fonts the file stands in for.
  keys: string[];
  // The file as picked: TrueType or CFF, so it can be read for its cmap and embedded in a PDF.
  bytes: Uint8Array;
  addedAt: number;
  // The code points the file has glyphs for; read from the bytes, not stored.
  cmap: Map<number, number>;
};

// Fonts kept before there were two sources have none recorded; they were files.
type StoredFont = Omit<UserFont, "cmap" | "source"> & { source?: UserFontSource };

const KEY = "user-fonts";
// How many are kept; the oldest goes when a newer one arrives.
const LIMIT = 16;
// A font file larger than this is not worth keeping in the browser's storage.
const BYTES_LIMIT = 12_000_000;

let fonts: UserFont[] = [];
let loading: Promise<UserFont[]> | null = null;
let version = 0;
const listeners = new Set<() => void>();
const registered = new Map<string, FontFace>();

function valid(record: unknown): record is StoredFont {
  if (!record || typeof record !== "object") return false;
  const item = record as Partial<StoredFont>;
  return (
    typeof item.id === "string" &&
    typeof item.label === "string" &&
    Array.isArray(item.keys) &&
    item.keys.every((key) => typeof key === "string") &&
    item.bytes instanceof Uint8Array &&
    item.bytes.length >= 12 &&
    item.bytes.length <= BYTES_LIMIT &&
    typeof item.addedAt === "number"
  );
}

function withCmap(stored: StoredFont): UserFont {
  return { ...stored, source: stored.source === "local" ? "local" : "file", cmap: fontUnicodeMap(stored.bytes) };
}

function stored(font: UserFont): StoredFont {
  return { id: font.id, label: font.label, source: font.source, keys: font.keys, bytes: font.bytes, addedAt: font.addedAt };
}

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

// Reads the kept fonts once and registers their faces; resolves to the list.
export function loadUserFonts(): Promise<UserFont[]> {
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await readStored<unknown>(KEY);
        fonts = Array.isArray(raw) ? raw.filter(valid).map(withCmap).filter((font) => font.cmap.size > 0) : [];
      } catch {
        fonts = [];
      }
      await Promise.all(fonts.map((font) => register(font)));
      notify();
      return fonts;
    })();
  }
  return loading;
}

// The kept font that stands in for the face with the given trait key, once loaded.
export function userFontFor(key: string): UserFont | null {
  return fonts.find((font) => font.keys.includes(key)) ?? null;
}

export function subscribeUserFonts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Changes whenever a font is added or the list is read, for views that show what is kept.
export function userFontsVersion(): number {
  return version;
}

// Keeps a TrueType or OpenType file the user picked for the page font with trait key `key`,
// registers its face, and resolves to the record. Throws, with a sentence for the user, when the
// file cannot be used.
export function addUserFont(file: File, key: string): Promise<UserFont> {
  return keepUserFont(file, key, file.name.replace(/\.[^.]+$/, ""), "file");
}

// Keeps the bytes of a TrueType or OpenType font (a file the user picked, or an installed font the
// browser handed over) for the page font with trait key `key`, named by its own name table or by
// `fallbackLabel`, registers its face, and resolves to the record. Throws, with a sentence for the
// user, when the bytes cannot be used.
export async function keepUserFont(data: Blob | Uint8Array, key: string, fallbackLabel: string, source: UserFontSource): Promise<UserFont> {
  const size = data instanceof Blob ? data.size : data.length;
  if (size > BYTES_LIMIT) throw new Error("That font is too large to keep in the browser.");
  const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
  const names = await fontNames(bytes);
  const cmap = fontUnicodeMap(bytes);
  if (cmap.size === 0) throw new Error("That is not a TrueType or OpenType font with a Unicode character map.");
  const keys = [...new Set([key, ...names.keys])];
  const font: UserFont = {
    id: uid(),
    label: names.label || fallbackLabel,
    source,
    keys,
    bytes,
    addedAt: Date.now(),
    cmap,
  };
  await loadUserFonts();
  // A font added for the same face again replaces the earlier one.
  fonts = [font, ...fonts.filter((item) => !item.keys.includes(key))].slice(0, LIMIT);
  await register(font);
  try {
    await writeStored(KEY, fonts.map(stored));
  } catch {
    // The face still serves this session; it is just not kept for the next one.
  }
  notify();
  return font;
}

// The font's names and cut, read from its name and OS/2 tables; throws when the bytes are not a font.
async function fontNames(bytes: Uint8Array): Promise<{ label: string; keys: string[] }> {
  const opentype = await import("opentype.js");
  let font: ReturnType<typeof opentype.parse>;
  try {
    font = opentype.parse(bytes.slice().buffer);
  } catch {
    throw new Error("That is not a TrueType or OpenType font.");
  }
  const english = (name: Record<string, string> | undefined) => name?.en ?? Object.values(name ?? {})[0] ?? "";
  const family = english(font.names.fontFamily);
  const subfamily = english(font.names.fontSubfamily);
  const full = english(font.names.fullName);
  const postScript = english(font.names.postScriptName);
  const os2 = font.tables.os2 as { usWeightClass?: number; fsSelection?: number } | undefined;
  const head = font.tables.head as { macStyle?: number } | undefined;
  const bold = (os2?.usWeightClass ?? 400) >= 600 || !!((os2?.fsSelection ?? 0) & 32) || !!((head?.macStyle ?? 0) & 1) || BOLD_NAME.test(subfamily);
  const italic = !!((os2?.fsSelection ?? 0) & 1) || !!((head?.macStyle ?? 0) & 2) || ITALIC_NAME.test(subfamily);
  const keys = [
    ...(postScript ? [traitKey(traitsOfName(postScript))] : []),
    ...(full ? [traitKey(traitsOfName(full))] : []),
    ...(family ? [traitKey({ stem: stemOf(family), bold, italic })] : []),
  ];
  const label = full || [family, subfamily].filter(Boolean).join(" ") || postScript;
  return { label, keys };
}

// Registers the font under the family of each of its keys, declared regular, replacing a face an
// earlier font registered under the same family.
async function register(font: UserFont): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return;
  await Promise.all(
    font.keys.map(async (key) => {
      const family = userFamilyName(key);
      const previous = registered.get(family);
      if (previous) document.fonts.delete(previous);
      try {
        const face = new FontFace(family, font.bytes.slice().buffer);
        await face.load();
        document.fonts.add(face);
        registered.set(family, face);
      } catch {
        registered.delete(family);
      }
    }),
  );
}
