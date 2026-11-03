import { readStored, writeStored } from "./session.ts";
import { uid } from "./types.ts";

// Signatures the user has placed, kept in this browser rather than in any document, so the same
// signature can go on the next document without uploading or typing it again. An uploaded image
// keeps only its picture; a typed one also keeps the name and the font it was drawn in, so the
// same name in the same style is one tile however often it is placed.
export type SavedSignature = {
  id: string;
  // PNG data URL, as `imageFileToPng` or `renderSignature` produced it.
  src: string;
  width: number;
  height: number;
  addedAt: number;
  // Set on a typed signature: the name as typed (trimmed) and the font family it was drawn in.
  text?: string;
  font?: string;
};

// What a typed signature was made from.
export type TypedSignature = { text: string; font: string };

const KEY = "saved-signatures";
// How many are kept; the oldest goes when a newer one arrives.
const LIMIT = 12;
// A PNG larger than this is not worth keeping in the browser's storage.
const SRC_LIMIT = 1_500_000;

function valid(record: unknown): record is SavedSignature {
  if (!record || typeof record !== "object") return false;
  const item = record as Partial<SavedSignature>;
  return (
    typeof item.id === "string" &&
    typeof item.src === "string" &&
    item.src.startsWith("data:image/png;base64,") &&
    item.src.length <= SRC_LIMIT &&
    typeof item.width === "number" &&
    typeof item.height === "number" &&
    typeof item.addedAt === "number" &&
    (item.text === undefined || typeof item.text === "string") &&
    (item.font === undefined || typeof item.font === "string")
  );
}

// Whether a kept signature is the same one as the picture being kept now: the same name in the
// same font for a typed signature, otherwise the same picture.
function same(item: SavedSignature, src: string, typed: TypedSignature | undefined): boolean {
  if (item.src === src) return true;
  return typed !== undefined && item.text === typed.text && item.font === typed.font;
}

// Keeps a signature that was just placed, newest first. Placing the same one again moves it to
// the front rather than keeping it twice.
export async function rememberSignature(
  image: { url: string; width: number; height: number },
  typed?: TypedSignature,
): Promise<SavedSignature[]> {
  if (image.url.length > SRC_LIMIT) return readSavedSignatures();
  const rest = (await readSavedSignatures()).filter((item) => !same(item, image.url, typed));
  const entry: SavedSignature = {
    id: uid(),
    src: image.url,
    width: image.width,
    height: image.height,
    addedAt: Date.now(),
    ...(typed ? { text: typed.text, font: typed.font } : {}),
  };
  const next = [entry, ...rest].slice(0, LIMIT);
  await writeStored(KEY, next);
  return next;
}

export async function readSavedSignatures(): Promise<SavedSignature[]> {
  try {
    const raw = await readStored<unknown>(KEY);
    return Array.isArray(raw) ? raw.filter(valid) : [];
  } catch {
    return [];
  }
}

export async function forgetSignature(id: string): Promise<SavedSignature[]> {
  const next = (await readSavedSignatures()).filter((item) => item.id !== id);
  await writeStored(KEY, next);
  return next;
}
