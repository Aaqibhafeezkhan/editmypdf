import { isBoxKind } from "./shapes.ts";
import { isBrushId } from "./brushes.ts";
import { EMOJI_GROUPS } from "./emojis.ts";
import type {
  Annotation,
  EmojiAnnotation,
  InkAnnotation,
  PatchAnnotation,
  SignatureAnnotation,
  LineAnnotation,
  ShapeAnnotation,
  TextAnnotation,
  TextSpan,
} from "./types.ts";

const INDEX_KEY = "pdf-editor:sessions";
const MIGRATED_KEY = "pdf-editor:migrated";
const LEGACY_META_KEY = "pdf-editor:meta";
const LEGACY_PDF_KEY = "pdf-editor:pdf";
const LEGACY_ANN_KEY = "pdf-editor:annotations";
const LEGACY_MAP_KEY = "pdf-editor:files";
const DB_NAME = "pdf-editor";
const STORE = "session";
const LEGACY_FILE_KEY = "file";
const LEGACY_ANN_IDB_KEY = "annotations";
const LOCAL_PDF_LIMIT = 1_200_000;
const knownEmoji = new Set(EMOJI_GROUPS.flatMap((group) => group.items.map((item) => item.id)));

type FileRecord = { name: string; bytes: Uint8Array };

export type SessionInfo = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type SavedSession = {
  name: string;
  bytes: Uint8Array;
  annotations: Annotation[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open browser storage"));
  });
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const request = tx.objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result as T | undefined);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

function idbPut(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("Could not write browser storage"));
        };
      }),
  );
}

// Small records that belong to the browser rather than to any document (the saved signatures),
// read and written whole under their own prefix so they never collide with a session's key.
export function readStored<T>(key: string): Promise<T | undefined> {
  return idbGet<T>(`app:${key}`);
}

export function writeStored(key: string, value: unknown): Promise<void> {
  return idbPut(`app:${key}`, value);
}

function idbDelete(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("Could not update browser storage"));
        };
      }),
  );
}

function encode(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    const slice = bytes.subarray(index, Math.min(index + size, bytes.length));
    let part = "";
    for (let offset = 0; offset < slice.length; offset += 1) {
      part += String.fromCharCode(slice[offset] ?? 0);
    }
    binary += part;
  }
  return btoa(binary);
}

function decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

// Styled runs of an older or hand-edited patch; dropped when they do not add up to its text.
function spanList(value: unknown, text: string): TextSpan[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const spans: TextSpan[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const span = item as TextSpan;
    if (typeof span.text !== "string") continue;
    const number = (field: unknown, fallback: number) => (typeof field === "number" && Number.isFinite(field) ? field : fallback);
    spans.push({
      text: span.text,
      fontFamily: typeof span.fontFamily === "string" && span.fontFamily ? span.fontFamily : "sans-serif",
      fontWeight: number(span.fontWeight, 400),
      fontStyle: span.fontStyle === "italic" ? "italic" : "normal",
      fontSize: number(span.fontSize, 12),
      color: typeof span.color === "string" ? span.color : "#111111",
      pdfFont: typeof span.pdfFont === "string" ? span.pdfFont : "",
      ...(typeof span.letterSpacing === "number" && Number.isFinite(span.letterSpacing)
        ? { letterSpacing: span.letterSpacing }
        : {}),
      ...(span.underline === true ? { underline: true } : {}),
      ...(span.strike === true ? { strike: true } : {}),
      ...(span.styled === true ? { styled: true } : {}),
    });
  }
  return spans.map((span) => span.text).join("") === text ? spans : [];
}

function tailList(value: unknown): PatchAnnotation["tails"] {
  if (!Array.isArray(value)) return [];
  const tails: PatchAnnotation["tails"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const tail = item as PatchAnnotation["tails"][number];
    if (typeof tail.image !== "string" || !tail.image.startsWith("data:image/png") || tail.image.length > 800_000) continue;
    const number = (field: number, fallback: number) => (typeof field === "number" && Number.isFinite(field) ? field : fallback);
    tails.push({
      x: number(tail.x, 0),
      y: number(tail.y, 0),
      w: number(tail.w, 1),
      h: number(tail.h, 1),
      padBottom: number(tail.padBottom, 0),
      image: tail.image,
    });
  }
  return tails;
}

export function normalizeAnnotations(raw: unknown): Annotation[] {
  if (!Array.isArray(raw)) return [];
  const annotations: Annotation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || !("kind" in item)) continue;
    const record = item as Annotation;
    if (record.kind === "text") {
      const text = record as TextAnnotation;
      if (typeof text.text !== "string" || text.text.length === 0) continue;
      annotations.push({
        ...text,
        width: typeof text.width === "number" ? text.width : 220,
        autoWidth: text.autoWidth ?? false,
        height: typeof text.height === "number" ? text.height : null,
        rotation: typeof text.rotation === "number" ? text.rotation : 0,
      });
      continue;
    }
    if (record.kind === "line") {
      const line = record as LineAnnotation;
      const head = line.head === "end" || line.head === "both" ? line.head : "none";
      annotations.push({ ...line, head });
      continue;
    }
    if (record.kind === "emoji") {
      const emoji = record as EmojiAnnotation;
      if (typeof emoji.emoji !== "string" || !knownEmoji.has(emoji.emoji)) continue;
      const size = 64;
      annotations.push({
        ...emoji,
        x: typeof emoji.x === "number" ? emoji.x : 0,
        y: typeof emoji.y === "number" ? emoji.y : 0,
        w: typeof emoji.w === "number" ? emoji.w : size,
        h: typeof emoji.h === "number" ? emoji.h : size,
        rotation: typeof emoji.rotation === "number" ? emoji.rotation : 0,
      });
      continue;
    }
    if (record.kind === "signature") {
      const signature = record as SignatureAnnotation;
      if (typeof signature.src !== "string" || !signature.src.startsWith("data:image/png;base64,")) continue;
      if (signature.src.length > 1_500_000) continue;
      annotations.push({
        ...signature,
        x: typeof signature.x === "number" ? signature.x : 0,
        y: typeof signature.y === "number" ? signature.y : 0,
        w: typeof signature.w === "number" ? signature.w : 160,
        h: typeof signature.h === "number" ? signature.h : 56,
        rotation: typeof signature.rotation === "number" ? signature.rotation : 0,
      });
      continue;
    }
    if (record.kind === "patch") {
      const patch = record as PatchAnnotation;
      const role = patch.role === "graphic" ? "graphic" : patch.role === "text" ? "text" : null;
      if (!role || typeof patch.sourceId !== "string") continue;
      const image = typeof patch.image === "string" ? patch.image : "";
      if (role === "graphic") {
        if (!image.startsWith("data:image/png;base64,") || image.length > 2_000_000) continue;
      }
      const number = (value: unknown, fallback: number) =>
        typeof value === "number" && Number.isFinite(value) ? value : fallback;
      const text = typeof patch.text === "string" ? patch.text : "";
      annotations.push({
        ...patch,
        role,
        text,
        originText: typeof patch.originText === "string" ? patch.originText : text,
        fontFamily: typeof patch.fontFamily === "string" && patch.fontFamily ? patch.fontFamily : "sans-serif",
        fontWeight: number(patch.fontWeight, 400),
        fontStyle: patch.fontStyle === "italic" ? "italic" : "normal",
        fontSize: number(patch.fontSize, 12),
        color: typeof patch.color === "string" ? patch.color : "#111111",
        pdfFont: typeof patch.pdfFont === "string" ? patch.pdfFont : "",
        ascent: number(patch.ascent, 0.8),
        lineHeight: number(patch.lineHeight, number(patch.h, 12)),
        align:
          patch.align === "center" || patch.align === "right" || patch.align === "justify" ? patch.align : "left",
        indent: number(patch.indent, 0),
        letterSpacing: number(patch.letterSpacing, 0),
        wordSpacing: number(patch.wordSpacing, 0),
        softBreaks: Array.isArray(patch.softBreaks)
          ? patch.softBreaks.filter(
              (offset): offset is number => typeof offset === "number" && Number.isInteger(offset) && text[offset] === "\n",
            )
          : [],
        lineGaps: Array.isArray(patch.lineGaps)
          ? patch.lineGaps.map((gap) => number(gap, 0))
          : [],
        lineOffsets: Array.isArray(patch.lineOffsets)
          ? patch.lineOffsets.map((offset) => number(offset, 0))
          : [],
        lineIndents: Array.isArray(patch.lineIndents)
          ? patch.lineIndents.map((indent) => number(indent, 0))
          : [],
        wrap: patch.wrap === true,
        ...(typeof patch.wrapW === "number" && Number.isFinite(patch.wrapW) && patch.wrapW > 0 ? { wrapW: patch.wrapW } : {}),
        spans: role === "text" ? spanList(patch.spans, text) : [],
        ...(patch.underline === true ? { underline: true } : {}),
        ...(patch.strike === true ? { strike: true } : {}),
        ...(patch.styled === true ? { styled: true } : {}),
        image: role === "text" ? "" : image,
        rotation: 0,
        x: number(patch.x, 0),
        y: number(patch.y, 0),
        w: number(patch.w, 1),
        h: number(patch.h, 1),
        originX: number(patch.originX, number(patch.x, 0)),
        originY: number(patch.originY, number(patch.y, 0)),
        originW: number(patch.originW, number(patch.w, 1)),
        originH: number(patch.originH, number(patch.h, 1)),
        underlineOffset: number(patch.underlineOffset, -1),
        underlineColor: typeof patch.underlineColor === "string" ? patch.underlineColor : patch.color,
        backdrop: typeof patch.backdrop === "string" ? patch.backdrop : "#ffffff",
        tails: tailList(patch.tails),
      });
      continue;
    }
    if (record.kind === "ink") {
      const ink = record as InkAnnotation;
      annotations.push({
        ...ink,
        opacity: typeof ink.opacity === "number" ? ink.opacity : 1,
        cap: ink.cap === "square" || ink.cap === "butt" ? ink.cap : "round",
        dash: typeof ink.dash === "string" ? ink.dash : null,
        brush: isBrushId(ink.brush) ? ink.brush : "pen",
      });
      continue;
    }
    if (isBoxKind(record.kind)) {
      const shape = record as ShapeAnnotation;
      annotations.push({
        ...shape,
        fill: typeof shape.fill === "string" ? shape.fill : null,
        fillOpacity:
          typeof shape.fillOpacity === "number"
            ? Math.min(1, Math.max(0, shape.fillOpacity))
            : 1,
        rotation: typeof shape.rotation === "number" ? shape.rotation : 0,
      });
    }
  }
  return annotations;
}

function pdfKey(id: string): string {
  return `pdf-editor:pdf:${id}`;
}

function annKey(id: string): string {
  return `pdf-editor:ann:${id}`;
}

function fileIdbKey(id: string): string {
  return `file:${id}`;
}

function annIdbKey(id: string): string {
  return `ann:${id}`;
}

function readIndex(): SessionInfo[] {
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as SessionInfo;
      if (typeof record.id !== "string" || typeof record.name !== "string") return [];
      return [
        {
          id: record.id,
          name: record.name,
          createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
          updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : Date.now(),
        },
      ];
    });
  } catch {
    return [];
  }
}

function writeIndex(items: SessionInfo[]): void {
  const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt);
  localStorage.setItem(INDEX_KEY, JSON.stringify(sorted));
}

export function listSessions(): SessionInfo[] {
  return readIndex();
}

function touchSession(id: string, name?: string): void {
  const now = Date.now();
  writeIndex(
    readIndex().map((item) =>
      item.id === id ? { ...item, name: name ?? item.name, updatedAt: now } : item,
    ),
  );
}

function readAnnotationBlob(raw: string | null): Annotation[] | null {
  if (raw == null) return null;
  try {
    return normalizeAnnotations(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function persistAnnotations(id: string, annotations: Annotation[]): void {
  const json = JSON.stringify(annotations);
  try {
    localStorage.setItem(annKey(id), json);
    touchSession(id);
  } catch {
    touchSession(id);
  }
  void idbPut(annIdbKey(id), annotations).catch(() => undefined);
}

export async function persistFile(id: string, name: string, bytes: Uint8Array): Promise<void> {
  const copy = bytes.slice();
  touchSession(id, name);
  try {
    if (copy.byteLength <= LOCAL_PDF_LIMIT) localStorage.setItem(pdfKey(id), encode(copy));
    else localStorage.removeItem(pdfKey(id));
  } catch {
    localStorage.removeItem(pdfKey(id));
  }
  try {
    await idbPut(fileIdbKey(id), { name, bytes: copy });
  } catch {
    // A smaller file may already be in localStorage.
  }
}

export async function createSession(
  name: string,
  bytes: Uint8Array,
  annotations: Annotation[] = [],
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  writeIndex([{ id, name, createdAt: now, updatedAt: now }, ...readIndex()]);
  persistAnnotations(id, annotations);
  await persistFile(id, name, bytes);
  return id;
}

export async function readSession(id: string): Promise<SavedSession | null> {
  const info = readIndex().find((item) => item.id === id);
  if (!info) return null;
  const localAnnotations = readAnnotationBlob(localStorage.getItem(annKey(id)));
  const localPdf = localStorage.getItem(pdfKey(id));
  if (localPdf) {
    try {
      return {
        name: info.name,
        bytes: decode(localPdf),
        annotations: localAnnotations ?? [],
      };
    } catch {
      localStorage.removeItem(pdfKey(id));
    }
  }
  try {
    const file = await idbGet<FileRecord>(fileIdbKey(id));
    if (!file?.bytes || file.bytes.byteLength === 0) return null;
    const stored =
      localAnnotations ?? normalizeAnnotations(await idbGet(annIdbKey(id)));
    return {
      name: file.name || info.name,
      bytes: new Uint8Array(file.bytes),
      annotations: stored,
    };
  } catch {
    return null;
  }
}

export function removeSession(id: string): void {
  writeIndex(readIndex().filter((item) => item.id !== id));
  localStorage.removeItem(pdfKey(id));
  localStorage.removeItem(annKey(id));
  void idbDelete(fileIdbKey(id)).catch(() => undefined);
  void idbDelete(annIdbKey(id)).catch(() => undefined);
}

async function readLegacy(): Promise<SavedSession | null> {
  const metaRaw = localStorage.getItem(LEGACY_META_KEY);
  let name = "Untitled.pdf";
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw) as { name?: string };
      if (meta.name) name = meta.name;
    } catch {
      name = "Untitled.pdf";
    }
  }
  const annotations = readAnnotationBlob(localStorage.getItem(LEGACY_ANN_KEY)) ?? [];
  const localPdf = localStorage.getItem(LEGACY_PDF_KEY);
  if (localPdf) {
    try {
      return { name, bytes: decode(localPdf), annotations };
    } catch {
      localStorage.removeItem(LEGACY_PDF_KEY);
    }
  }
  try {
    const file = await idbGet<FileRecord>(LEGACY_FILE_KEY);
    if (!file?.bytes || file.bytes.byteLength === 0) return null;
    return { name: file.name || name, bytes: new Uint8Array(file.bytes), annotations };
  } catch {
    return null;
  }
}

function clearLegacy(): void {
  localStorage.removeItem(LEGACY_META_KEY);
  localStorage.removeItem(LEGACY_PDF_KEY);
  localStorage.removeItem(LEGACY_ANN_KEY);
  localStorage.removeItem(LEGACY_MAP_KEY);
  void idbDelete(LEGACY_FILE_KEY).catch(() => undefined);
  void idbDelete(LEGACY_ANN_IDB_KEY).catch(() => undefined);
}

let migration: Promise<void> | null = null;

export function readySessions(): Promise<void> {
  migration ??= (async () => {
    if (localStorage.getItem(MIGRATED_KEY) === "1") return;
    const legacy = await readLegacy();
    localStorage.setItem(MIGRATED_KEY, "1");
    if (!legacy || readIndex().length > 0) {
      clearLegacy();
      return;
    }
    await createSession(legacy.name, legacy.bytes, legacy.annotations);
    clearLegacy();
  })();
  return migration;
}
