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

// The runs of `text` that are not in `origin`, as ranges of `text`: the characters the user
// typed into or in place of the page's words. The unchanged head and tail are skipped first, so
// an edit in a long paragraph only compares the words around it; each word left between two
// matches is then set against the old word it resembles and only the characters that differ
// count, so a letter typed into a word marks that letter, not the word. Words only taken away
// leave nothing to mark.
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
  // The words of the middle that both texts share, as pairs of indexes into it; none when the
  // middle is too big to compare, so it is one gap.
  const matches: Array<[number, number]> = [];
  if (oldMiddle.length > 0 && newMiddle.length > 0 && oldMiddle.length * newMiddle.length <= COMPARE_LIMIT) {
    // Longest common subsequence of the words in the middle.
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
        matches.push([row, col]);
        row += 1;
        col += 1;
      } else if ((table[(row + 1) * stride + col] ?? 0) >= (table[row * stride + col + 1] ?? 0)) {
        row += 1;
      } else {
        col += 1;
      }
    }
  }
  const ranges: TextRange[] = [];
  let oldAt = 0;
  let newAt = 0;
  for (const [row, col] of [...matches, [oldMiddle.length, newMiddle.length] as [number, number]]) {
    gapRanges(oldMiddle.slice(oldAt, row), newMiddle.slice(newAt, col), origin, text, ranges);
    oldAt = row + 1;
    newAt = col + 1;
  }
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, ranges);
  return ranges;
}

function tokenEnd(token: Token): number {
  return token.start + token.text.length;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

// How many characters `a[aStart, aEnd)` and `b[bStart, bEnd)` share at the start and at the
// end, never more than the shorter has in all, and never splitting a surrogate pair.
function shared(a: string, aStart: number, aEnd: number, b: string, bStart: number, bEnd: number): { head: number; tail: number } {
  const most = Math.min(aEnd - aStart, bEnd - bStart);
  let head = 0;
  while (head < most && a[aStart + head] === b[bStart + head]) head += 1;
  if (head > 0 && isHighSurrogate(b.charCodeAt(bStart + head - 1))) head -= 1;
  let tail = 0;
  while (tail < most - head && a[aEnd - 1 - tail] === b[bEnd - 1 - tail]) tail += 1;
  if (tail > 0 && isLowSurrogate(b.charCodeAt(bEnd - tail))) tail -= 1;
  return { head, tail };
}

// Whether a new word grew out of an old one: at least half of the old word, and at least two
// of its characters, are still there at the start and end of the new one.
function resembles(origin: string, was: Token, text: string, now: Token): boolean {
  const { head, tail } = shared(origin, was.start, tokenEnd(was), text, now.start, tokenEnd(now));
  const kept = head + tail;
  return kept >= 2 && kept * 2 >= was.text.length;
}

// For each new word of a gap, the old word it grew out of, or null for a word typed in: the
// longest run of resembling pairs in order. Past the comparison limit the words are paired by
// position.
function pairWords(oldWords: Token[], newWords: Token[], origin: string, text: string): Array<Token | null> {
  const partners: Array<Token | null> = newWords.map(() => null);
  const rows = oldWords.length;
  const cols = newWords.length;
  if (rows === 0) return partners;
  if (rows * cols > COMPARE_LIMIT) {
    newWords.forEach((_, index) => {
      partners[index] = oldWords[index] ?? null;
    });
    return partners;
  }
  const alike = (row: number, col: number) => resembles(origin, oldWords[row] as Token, text, newWords[col] as Token);
  const stride = cols + 1;
  const table = new Uint16Array((rows + 1) * stride);
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let col = cols - 1; col >= 0; col -= 1) {
      table[row * stride + col] = alike(row, col)
        ? (table[(row + 1) * stride + col + 1] ?? 0) + 1
        : Math.max(table[(row + 1) * stride + col] ?? 0, table[row * stride + col + 1] ?? 0);
    }
  }
  let row = 0;
  let col = 0;
  while (row < rows && col < cols) {
    if (alike(row, col)) {
      partners[col] = oldWords[row] ?? null;
      row += 1;
      col += 1;
    } else if ((table[(row + 1) * stride + col] ?? 0) >= (table[row * stride + col + 1] ?? 0)) {
      row += 1;
    } else {
      col += 1;
    }
  }
  return partners;
}

// The changed characters of one gap between two shared words, added to `out` in text order.
// Characters only typed in at one place, or only taken out, are told from the gap's text as a
// whole, so a space typed into a word or taken from between two marks just that. Otherwise a
// new word that grew out of an old one counts only where the two differ, and a word with no
// old one behind it is new throughout. A space counts only between two words changed whole, so
// a replaced phrase is one run and a word typed next to an old one does not drag the old one's
// space along.
function gapRanges(oldTokens: Token[], newTokens: Token[], origin: string, text: string, out: TextRange[]): void {
  if (newTokens.length === 0) return;
  const push = (start: number, end: number) => {
    if (end <= start) return;
    const last = out[out.length - 1];
    if (last && last.end === start) last.end = end;
    else out.push({ start, end });
  };
  const oldFirst = oldTokens[0];
  const oldLast = oldTokens[oldTokens.length - 1];
  const newFirst = newTokens[0] as Token;
  const newLast = newTokens[newTokens.length - 1] as Token;
  if (oldFirst && oldLast) {
    const oldStart = oldFirst.start;
    const oldEnd = tokenEnd(oldLast);
    const newStart = newFirst.start;
    const newEnd = tokenEnd(newLast);
    const { head, tail } = shared(origin, oldStart, oldEnd, text, newStart, newEnd);
    if (head + tail === newEnd - newStart) return;
    if (head + tail === oldEnd - oldStart) {
      push(newStart + head, newEnd - tail);
      return;
    }
  }
  const oldWords = oldTokens.filter((token) => !token.space);
  const newWords = newTokens.filter((token) => !token.space);
  const partners = pairWords(oldWords, newWords, origin, text);
  const marks: Array<TextRange | null> = [];
  let wordIndex = 0;
  for (const token of newTokens) {
    if (token.space) {
      marks.push(null);
      continue;
    }
    const was = partners[wordIndex];
    wordIndex += 1;
    const end = tokenEnd(token);
    if (!was) {
      marks.push({ start: token.start, end });
      continue;
    }
    const { head, tail } = shared(origin, was.start, tokenEnd(was), text, token.start, end);
    marks.push({ start: token.start + head, end: end - tail });
  }
  const whole = (index: number) => {
    const token = newTokens[index];
    const mark = marks[index];
    return !!token && !token.space && !!mark && mark.start === token.start && mark.end === tokenEnd(token);
  };
  newTokens.forEach((token, index) => {
    if (token.space) {
      if (index > 0 && index < newTokens.length - 1 && whole(index - 1) && whole(index + 1)) push(token.start, tokenEnd(token));
      return;
    }
    const mark = marks[index];
    if (mark) push(mark.start, mark.end);
  });
}
