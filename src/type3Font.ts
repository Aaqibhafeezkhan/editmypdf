import { OPS } from "pdfjs-dist";

// A page printed from a browser carries its web fonts as Type3 fonts: every glyph is a little
// drawing (a filled path) and there is no font file, so pdf.js paints the outlines itself and
// the editor had nothing to set its text in but a substitute face. This rebuilds a real font from
// those outlines, one per Type3 font, with the page's own advances and a Unicode cmap, and
// registers it with the document, so the editor's text is drawn with the page's own letters and
// the export can embed them.

type Proc = { fnArray: number[]; argsArray: unknown[] };

export type Type3FontObject = {
  isType3Font?: boolean;
  fontMatrix?: number[] | null;
  bbox?: number[] | null;
  name?: string;
  charProcOperatorList?: Map<string, Proc> | Record<string, Proc> | null;
};

// One glyph a page drew with a Type3 font: its character, its advance in glyph space and the
// name of the procedure that draws it.
export type Type3Glyph = { unicode: string; width: number; operatorListId: string };

export type Type3Face = { family: string; data: Uint8Array };

// A Type3 font of the page with the glyphs it draws.
export type Type3Member = { name: string; font: Type3FontObject; glyphs: Map<string, Type3Glyph> };

type Opentype = typeof import("opentype.js");

const pending = new Map<string, Promise<Type3Face | null>>();
const settled = new Map<string, Type3Face>();
let serial = 0;

// Groups a page's Type3 fonts that are the same typeface: a browser prints one Type3 font per
// run of text, so a heading and a tag set in the same bold face come as two fonts, each with
// only its own letters. Fonts with the same base name and matrix whose shared glyphs have the
// same advances are one face, and a face built from their union covers more of what is typed.
export function groupType3Fonts(members: Type3Member[]): Type3Member[][] {
  const groups: Type3Member[][] = [];
  const baseName = (font: Type3FontObject) => (font.name ?? "").replace(/^[A-Z]{6}\+/, "");
  const matrixKey = (font: Type3FontObject) => (font.fontMatrix ?? []).map((n) => Math.round(n * 1e6)).join(",");
  const alike = (a: Type3Member, b: Type3Member): boolean => {
    if (baseName(a.font) !== baseName(b.font) || matrixKey(a.font) !== matrixKey(b.font)) return false;
    let shared = 0;
    for (const [unicode, glyph] of a.glyphs) {
      const other = b.glyphs.get(unicode);
      if (!other) continue;
      if (Math.abs(other.width - glyph.width) > 1) return false;
      shared += 1;
    }
    return shared > 0;
  };
  for (const member of members) {
    const group = groups.find((candidates) => candidates.some((candidate) => alike(candidate, member)));
    if (group) group.push(member);
    else groups.push([member]);
  }
  return groups;
}

// The glyphs each Type3 font draws on a page, by pdf.js font name and character, read from the
// page's own text operators (the main thread's font object cannot map characters itself).
export function collectType3Glyphs(fnArray: number[], argsArray: unknown[]): Map<string, Map<string, Type3Glyph>> {
  const fonts = new Map<string, Map<string, Type3Glyph>>();
  let current = "";
  for (let index = 0; index < fnArray.length; index += 1) {
    const fn = fnArray[index];
    const args = argsArray[index];
    if (fn === OPS.setFont && Array.isArray(args) && typeof args[0] === "string") {
      current = args[0];
      continue;
    }
    if (fn !== OPS.showText || !current || !Array.isArray(args) || !Array.isArray(args[0])) continue;
    for (const glyph of args[0] as unknown[]) {
      if (!glyph || typeof glyph !== "object") continue;
      const { unicode, width, operatorListId, isSpace } = glyph as {
        unicode?: unknown;
        width?: unknown;
        operatorListId?: unknown;
        isSpace?: unknown;
      };
      if (typeof operatorListId !== "string" || typeof width !== "number" || !Number.isFinite(width)) continue;
      const text = isSpace ? " " : typeof unicode === "string" ? unicode : "";
      if ([...text].length !== 1) continue;
      let glyphs = fonts.get(current);
      if (!glyphs) {
        glyphs = new Map();
        fonts.set(current, glyphs);
      }
      if (!glyphs.has(text)) glyphs.set(text, { unicode: text, width, operatorListId });
    }
  }
  return fonts;
}

// Builds and registers (once per set of pdf.js font names) a font from the glyph procedures of
// one Type3 font, or of several that are the same typeface, and resolves to its family name and
// bytes. Null when a glyph is not a plain filled outline (a bitmap glyph, say) or the font cannot
// be written.
export function type3Face(members: Type3Member[]): Promise<Type3Face | null> {
  const key = members.map((member) => member.name).sort().join("+");
  const cached = pending.get(key);
  if (cached) return cached;
  const first = members[0];
  if (!first || typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve(null);
  if (members.every((member) => member.glyphs.size === 0)) return Promise.resolve(null);
  const promise = build(first.name, members)
    .then((face) => {
      if (face) settled.set(face.family, face);
      return face;
    })
    .catch(() => null);
  pending.set(key, promise);
  return promise;
}

// The bytes behind a family `type3Face` registered; null for any other family.
export function type3FaceBytes(family: string): Uint8Array | null {
  return settled.get(family)?.data ?? null;
}

type Matrix = [number, number, number, number, number, number];

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function asMatrix(value: unknown): Matrix | null {
  if (!Array.isArray(value) && !(value instanceof Float32Array) && !(value instanceof Float64Array)) return null;
  const list = Array.from(value as ArrayLike<unknown>);
  if (list.length !== 6 || !list.every((entry) => typeof entry === "number" && Number.isFinite(entry))) return null;
  return list as Matrix;
}

async function build(loadedName: string, members: Type3Member[]): Promise<Type3Face | null> {
  const font = members[0]?.font;
  if (!font) return null;
  // Every member's glyphs, each with the procedures of the font that drew it; the first font to
  // draw a character keeps it.
  const glyphs = new Map<string, { glyph: Type3Glyph; lookup: (id: string) => Proc | undefined }>();
  for (const member of members) {
    const procs = member.font.charProcOperatorList;
    if (!procs) continue;
    const lookup = (id: string): Proc | undefined => (procs instanceof Map ? procs.get(id) : (procs as Record<string, Proc>)[id]);
    for (const [unicode, glyph] of member.glyphs) if (!glyphs.has(unicode)) glyphs.set(unicode, { glyph, lookup });
  }
  if (glyphs.size === 0) return null;
  const fontMatrix = asMatrix(font.fontMatrix) ?? [0.001, 0, 0, 0.001, 0, 0];
  // One em is the matrix's scale; the font's units are chosen so the glyph coordinates stay
  // whole numbers where the matrix is a plain 1/n.
  const scale = Math.hypot(fontMatrix[0], fontMatrix[1]) || 0.001;
  const unitsPerEm = Math.max(16, Math.min(16384, Math.round(1 / scale)));
  const toUnits = (matrix: Matrix, x: number, y: number): [number, number] => {
    const m = multiply(fontMatrix, matrix);
    return [
      Math.round((m[0] * x + m[2] * y + m[4]) * unitsPerEm * 10) / 10,
      Math.round((m[1] * x + m[3] * y + m[5]) * unitsPerEm * 10) / 10,
    ];
  };
  const opentype = await import("opentype.js");
  const list: InstanceType<Opentype["Glyph"]>[] = [
    new opentype.Glyph({ name: ".notdef", unicode: 0, advanceWidth: Math.round(unitsPerEm * 0.5), path: new opentype.Path() }),
  ];
  let top = -Infinity;
  let bottom = Infinity;
  const seen = new Set<number>();
  for (const { glyph, lookup } of glyphs.values()) {
    const code = glyph.unicode.codePointAt(0);
    if (code == null || seen.has(code)) continue;
    const proc = lookup(glyph.operatorListId);
    if (!proc) continue;
    const path = outline(opentype, proc, toUnits);
    if (!path) return null;
    seen.add(code);
    const advance = Math.round(glyph.width * fontMatrix[0] * unitsPerEm);
    list.push(
      new opentype.Glyph({
        name: `uni${code.toString(16).toUpperCase().padStart(4, "0")}`,
        unicode: code,
        advanceWidth: Math.max(0, advance),
        path,
      }),
    );
    if (path.commands.length > 0) {
      const box = path.getBoundingBox();
      top = Math.max(top, box.y2);
      bottom = Math.min(bottom, box.y1);
    }
  }
  if (list.length < 2) return null;
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
    top = unitsPerEm * 0.8;
    bottom = -unitsPerEm * 0.2;
  }
  serial += 1;
  const family = `${loadedName}-type3-${serial}`;
  const built = new opentype.Font({
    familyName: family,
    styleName: "Regular",
    unitsPerEm,
    ascender: Math.max(Math.round(top), 1),
    descender: Math.min(Math.round(bottom), -1),
    glyphs: list,
  });
  const data = new Uint8Array(built.toArrayBuffer());
  const face = new FontFace(family, data.buffer as ArrayBuffer);
  await face.load();
  document.fonts.add(face);
  return { family, data };
}

// The filled outline a glyph procedure draws, in font units; null when the procedure paints
// anything other than filled paths. pdf.js packs a path as a flat list: 0 moveTo x y, 1 lineTo
// x y, 2 curveTo x1 y1 x2 y2 x y, 3 quadraticCurveTo x1 y1 x y, 4 closePath.
function outline(
  opentype: Opentype,
  proc: Proc,
  toUnits: (matrix: Matrix, x: number, y: number) => [number, number],
): InstanceType<Opentype["Path"]> | null {
  const path = new opentype.Path();
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  let open = false;
  const close = () => {
    if (open) path.close();
    open = false;
  };
  for (let index = 0; index < proc.fnArray.length; index += 1) {
    const fn = proc.fnArray[index];
    const args = proc.argsArray[index];
    if (fn === OPS.save) {
      stack.push(ctm);
      continue;
    }
    if (fn === OPS.restore) {
      ctm = stack.pop() ?? ctm;
      continue;
    }
    if (fn === OPS.transform) {
      const matrix = asMatrix(args);
      if (matrix) ctm = multiply(ctm, matrix);
      continue;
    }
    if (
      fn === OPS.paintImageMaskXObject ||
      fn === OPS.paintImageMaskXObjectGroup ||
      fn === OPS.paintImageMaskXObjectRepeat ||
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.shadingFill
    ) {
      return null;
    }
    if (fn !== OPS.constructPath || !Array.isArray(args)) continue;
    const paint = args[0];
    const data = Array.isArray(args[1]) ? (args[1][0] as ArrayLike<number> | undefined) : undefined;
    if (!data) continue;
    const filled =
      paint === OPS.fill ||
      paint === OPS.eoFill ||
      paint === OPS.fillStroke ||
      paint === OPS.eoFillStroke ||
      paint === OPS.closeFillStroke ||
      paint === OPS.closeEOFillStroke;
    if (!filled) {
      if (paint === OPS.endPath || paint === OPS.clip || paint === OPS.eoClip) continue;
      // A stroked glyph has no outline to keep.
      return null;
    }
    const at = (x: number, y: number) => toUnits(ctm, x, y);
    for (let cursor = 0; cursor < data.length; ) {
      const op = data[cursor];
      if (op === 0 || op === 1) {
        const [x, y] = at(data[cursor + 1] ?? 0, data[cursor + 2] ?? 0);
        if (op === 0) {
          close();
          path.moveTo(x, y);
          open = true;
        } else path.lineTo(x, y);
        cursor += 3;
      } else if (op === 2) {
        const [x1, y1] = at(data[cursor + 1] ?? 0, data[cursor + 2] ?? 0);
        const [x2, y2] = at(data[cursor + 3] ?? 0, data[cursor + 4] ?? 0);
        const [x, y] = at(data[cursor + 5] ?? 0, data[cursor + 6] ?? 0);
        path.curveTo(x1, y1, x2, y2, x, y);
        cursor += 7;
      } else if (op === 3) {
        const [x1, y1] = at(data[cursor + 1] ?? 0, data[cursor + 2] ?? 0);
        const [x, y] = at(data[cursor + 3] ?? 0, data[cursor + 4] ?? 0);
        path.quadTo(x1, y1, x, y);
        cursor += 5;
      } else if (op === 4) {
        close();
        cursor += 1;
      } else {
        return null;
      }
    }
    close();
  }
  return path;
}
