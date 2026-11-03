import { readStored, writeStored } from "./session.ts";
import { uid } from "./types.ts";

// Signature images the user uploaded, kept in this browser rather than in any document, so the
// same signature can be placed on the next document without uploading it again.
export type SavedSignature = {
  id: string;
  // PNG data URL, as `imageFileToPng` produced it.
  src: string;
  width: number;
  height: number;
  addedAt: number;
};

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
    typeof item.addedAt === "number"
  );
}

export async function readSavedSignatures(): Promise<SavedSignature[]> {
  try {
    const raw = await readStored<unknown>(KEY);
    return Array.isArray(raw) ? raw.filter(valid) : [];
  } catch {
    return [];
  }
}

// Keeps an uploaded image, newest first. Uploading the same picture again moves it to the front
// rather than keeping it twice.
export async function rememberSignature(image: { url: string; width: number; height: number }): Promise<SavedSignature[]> {
  if (image.url.length > SRC_LIMIT) return readSavedSignatures();
  const rest = (await readSavedSignatures()).filter((item) => item.src !== image.url);
  const next = [{ id: uid(), src: image.url, width: image.width, height: image.height, addedAt: Date.now() }, ...rest].slice(
    0,
    LIMIT,
  );
  await writeStored(KEY, next);
  return next;
}

export async function forgetSignature(id: string): Promise<SavedSignature[]> {
  const next = (await readSavedSignatures()).filter((item) => item.id !== id);
  await writeStored(KEY, next);
  return next;
}
