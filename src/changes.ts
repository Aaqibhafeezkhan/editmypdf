import type { Annotation, PatchAnnotation } from "./types.ts";

// What the user changed about the page's own content: whether a patch differs from what the
// page had, and which runs of an edited text are new. Both are cheap enough to run on render.

export type TextRange = { start: number; end: number };

// Positions closer than this, in page units, count as the same place.
const EPSILON = 0.01;

// Whether the user styled any of the patch's text: a face, size, colour or alignment of their
// own, or a line under or through a run.
export function hasUserStyle(patch: Pick<PatchAnnotation, "styled" | "underline" | "strike" | "spans">): boolean {
  if (patch.styled || patch.underline || patch.strike) return true;
  return (patch.spans ?? []).some((span) => span.styled || span.underline || span.strike);
}

export function patchMoved(patch: PatchAnnotation): boolean {
  return (
    Math.abs(patch.x - patch.originX) >= EPSILON || Math.abs(patch.y - patch.originY) >= EPSILON || !!patch.rotation
  );
}

export function patchResized(patch: PatchAnnotation): boolean {
  if (patch.role === "graphic") {
    return Math.abs(patch.w - patch.originW) >= EPSILON || Math.abs(patch.h - patch.originH) >= EPSILON;
  }
  return patch.wrapW != null && Math.abs(patch.wrapW - patch.originW) >= EPSILON;
}

// Whether the patch differs from what the page had: its words, its look, its place or its
// width. A graphic patch still sitting exactly where its element was is a selection, not a change.
export function patchChanged(patch: PatchAnnotation): boolean {
  if (patchMoved(patch) || patchResized(patch)) return true;
  if (patch.role === "graphic") return false;
  return patch.text !== (patch.originText ?? "") || hasUserStyle(patch);
}

export function isChangedMark(annotation: Annotation): boolean {
  return annotation.kind === "patch" && patchChanged(annotation);
}

type Token = { text: string; start: number; space: boolean };

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const pattern = /\S+|\s+/g;
  let match = pattern.exec(text);
  while (match) {
    out.push({ text: match[0], start: match.index, space: /^\s/.test(match[0]) });
    match = pattern.exec(text);
  }
  return out;
}

// The largest word-by-word comparison worth doing; past it, everything between the unchanged
// head and tail is marked as changed instead.
const COMPARE_LIMIT = 250_000;

const cache = new Map<string, TextRange[]>();
const CACHE_LIMIT = 64;

// The runs of `text` that are not in `origin`: the words the user typed or replaced, with the
// spaces between two such words, as ranges of `text`. Words only taken away leave nothing to
// mark. The unchanged head and tail are skipped first, so an edit in a long paragraph only
// compares the words around it.
export function changedRanges(origin: string, text: string): TextRange[] {
  if (origin === text) return [];
  const key = `${origin}\u0000${text}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const before = tokenize(origin);
  const after = tokenize(text);
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix]?.text === after[prefix]?.text) prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix]?.text === after[after.length - 1 - suffix]?.text
  ) {
    suffix += 1;
  }
  const oldMiddle = before.slice(prefix, before.length - suffix);
  const newMiddle = after.slice(prefix, after.length - suffix);
  const changed = newMiddle.map(() => true);
  if (oldMiddle.length > 0 && newMiddle.length > 0 && oldMiddle.length * newMiddle.length <= COMPARE_LIMIT) {
    // Longest common subsequence of the words in the middle; the words of the new text that
    // are not part of it are the changed ones.
    const rows = oldMiddle.length;
    const cols = newMiddle.length;
    const stride = cols + 1;
    const table = new Uint16Array((rows + 1) * stride);
    for (let row = rows - 1; row >= 0; row -= 1) {
      for (let col = cols - 1; col >= 0; col -= 1) {
        table[row * stride + col] =
          oldMiddle[row]?.text === newMiddle[col]?.text
            ? (table[(row + 1) * stride + col + 1] ?? 0) + 1
            : Math.max(table[(row + 1) * stride + col] ?? 0, table[row * stride + col + 1] ?? 0);
      }
    }
    let row = 0;
    let col = 0;
    while (row < rows && col < cols) {
      if (oldMiddle[row]?.text === newMiddle[col]?.text) {
        changed[col] = false;
        row += 1;
        col += 1;
      } else if ((table[(row + 1) * stride + col] ?? 0) >= (table[row * stride + col + 1] ?? 0)) {
        row += 1;
      } else {
        col += 1;
      }
    }
  }
  // A space only counts as changed between two changed words, so a replaced phrase is one run
  // and a word typed next to an old one does not drag the old one's space along.
  const ranges: TextRange[] = [];
  newMiddle.forEach((token, index) => {
    let hot = changed[index] ?? false;
    if (hot && token.space) {
      hot = index > 0 && index < newMiddle.length - 1 && !!changed[index - 1] && !!changed[index + 1];
    }
    if (!hot) return;
    const last = ranges[ranges.length - 1];
    if (last && last.end === token.start) last.end = token.start + token.text.length;
    else ranges.push({ start: token.start, end: token.start + token.text.length });
  });
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, ranges);
  return ranges;
}
