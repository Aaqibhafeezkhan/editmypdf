import { useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { editSpans } from "./contentEdit.ts";
import { domText, offsetAt, placeCaret, selectionOffsets } from "./spanDom.ts";
import { lineIndent, lineShift, spansText } from "./textLayout.ts";
import type { PatchAnnotation, TextSpan } from "./types.ts";

// Editor for a text patch: a contentEditable block with one <div> per line and one <span> per
// styled run. The DOM is owned here, not by React: every edit is intercepted before the browser
// applies it, mapped into the span under the caret, and the lines are drawn again from the model.
// A block opens with the page's own line breaks; the ones it only broke for room are flagged soft
// and, in a justified block, stretched to the column like the page did.

type Model = { text: string; spans: TextSpan[] };

type Snapshot = Model & { caret: number };

type View = {
  face: TextSpan;
  align: PatchAnnotation["align"];
  indent: number;
  softBreaks: number[];
  lineGaps: number[];
  lineOffsets: number[];
  lineIndents: number[];
  scale: number;
  showLive: boolean;
};

type Props = {
  patch: PatchAnnotation;
  scale: number;
  selected: boolean;
  showLive: boolean;
  label: string;
  style: CSSProperties;
  register: (node: HTMLDivElement | null) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onEdit: (text: string, spans: TextSpan[], measured: number) => void;
};

const HISTORY_LIMIT = 200;

type LineView = { pieces: { text: string; span: TextSpan }[]; soft: boolean };

// Everything that decides how the editor is drawn.
function viewKey(model: Model, view: View): string {
  const face = view.face;
  const spans = model.spans
    .map(
      (span) =>
        `${span.text}\u0000${span.fontFamily}|${span.fontWeight}|${span.fontStyle}|${span.fontSize}|${span.color}|${span.letterSpacing ?? ""}`,
    )
    .join("\u0001");
  return [
    model.text,
    spans,
    `${face.fontFamily}|${face.fontWeight}|${face.fontStyle}|${face.fontSize}|${face.color}`,
    view.align,
    view.indent,
    view.softBreaks.join(","),
    view.lineGaps.join(","),
    view.lineOffsets.join(","),
    view.lineIndents.join(","),
    view.scale,
    view.showLive,
  ].join("\u0002");
}

// The lines of the model: spans cut at every newline, each line knowing whether its break is soft.
function splitLines(model: Model, face: TextSpan, softBreaks: number[]): LineView[] {
  const spans = model.spans.length > 0 ? model.spans : [{ ...face, text: model.text }];
  const soft = new Set(softBreaks);
  const lines: LineView[] = [{ pieces: [], soft: false }];
  let offset = 0;
  for (const span of spans) {
    span.text.split("\n").forEach((part, index) => {
      if (index > 0) {
        const current = lines[lines.length - 1];
        if (current) current.soft = soft.has(offset);
        offset += 1;
        lines.push({ pieces: [], soft: false });
      }
      if (part) lines[lines.length - 1]?.pieces.push({ text: part, span });
      offset += part.length;
    });
  }
  return lines;
}

function render(root: HTMLElement, model: Model, view: View): void {
  root.replaceChildren();
  splitLines(model, view.face, view.softBreaks).forEach((line, index) => {
    const block = document.createElement("div");
    const indent = lineIndent(view, index);
    if (indent) block.style[index === 0 ? "textIndent" : "paddingLeft"] = `${indent * view.scale}px`;
    // Each of the page's own lines sits where the page put it, not at an even pitch.
    const shift = index === 0 ? 0 : lineShift(view.lineOffsets, index) - lineShift(view.lineOffsets, index - 1);
    if (shift) block.style.marginTop = `${shift * view.scale}px`;
    // A line the page gave a word gap is already exactly as wide as printed; only a line that
    // flows again after an edit is stretched to the column.
    const gap = view.lineGaps[index];
    if (view.align === "justify" && line.soft && gap == null) block.style.textAlignLast = "justify";
    if (gap != null) block.style.wordSpacing = `${gap * view.scale}px`;
    for (const piece of line.pieces) {
      const node = document.createElement("span");
      node.style.fontFamily = piece.span.fontFamily;
      node.style.fontWeight = String(piece.span.fontWeight);
      node.style.fontStyle = piece.span.fontStyle;
      node.style.fontSize = `${piece.span.fontSize * view.scale}px`;
      // A run in another face or size has its own ascent and descent, rounded to pixels by the
      // browser, so its inline box would sit a little above or below the line's own and stretch
      // the line past the page's pitch. With no line height of its own the run adds nothing to the
      // line box: every line is exactly as tall as the block's line height, whatever runs it holds.
      node.style.lineHeight = "0";
      if (piece.span.letterSpacing != null) node.style.letterSpacing = `${piece.span.letterSpacing * view.scale}px`;
      node.style.color = view.showLive ? piece.span.color : "transparent";
      node.textContent = piece.text;
      block.append(node);
    }
    // An empty line needs a <br> to have any height.
    if (line.pieces.length === 0) block.append(document.createElement("br"));
    root.append(block);
  });
}

// Length of the character before or after an offset, so a surrogate pair is deleted whole.
function charBefore(text: string, index: number): number {
  if (index <= 0) return 0;
  const low = text.charCodeAt(index - 1);
  const high = index >= 2 ? text.charCodeAt(index - 2) : 0;
  return low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff ? 2 : 1;
}

function charAfter(text: string, index: number): number {
  if (index >= text.length) return 0;
  const high = text.charCodeAt(index);
  const low = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
  return high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff ? 2 : 1;
}

function measureRows(root: HTMLElement, lineHeight: number, shifted: number): number {
  const height = root.style.height;
  root.style.height = "0px";
  const rows = Math.round((root.scrollHeight - shifted) / Math.max(lineHeight, 1));
  root.style.height = height;
  return rows;
}

export function SpanEditor({
  patch,
  scale,
  selected,
  showLive,
  label,
  style,
  register,
  onFocus,
  onBlur,
  onKeyDown,
  onEdit,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  // What the editor currently shows, which runs ahead of the props while an edit is on its way back.
  const model = useRef<Model>({ text: patch.text, spans: patch.spans });
  const drawn = useRef<string | null>(null);
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const lineHeight = patch.lineHeight * scale;
  const wrap = patch.wrap;
  const view: View = {
    face: {
      text: "",
      fontFamily: patch.fontFamily,
      fontWeight: patch.fontWeight,
      fontStyle: patch.fontStyle,
      fontSize: patch.fontSize,
      color: patch.color,
      pdfFont: "",
    },
    align: patch.align,
    indent: patch.indent,
    // Patches made before these fields existed may still be in memory without them.
    softBreaks: patch.softBreaks ?? [],
    lineGaps: patch.lineGaps ?? [],
    lineOffsets: patch.lineOffsets ?? [],
    lineIndents: patch.lineIndents ?? [],
    scale,
    showLive,
  };

  const latest = useRef({ onEdit, lineHeight, wrap, view });
  latest.current = { onEdit, lineHeight, wrap, view };
  // Moves an edit the browser applied on its own into the model; set once the handlers exist.
  const reconcileRef = useRef<() => void>(() => undefined);

  const draw = (next: Model, caret: number | null) => {
    const root = ref.current;
    if (!root) return;
    render(root, next, latest.current.view);
    drawn.current = viewKey(next, latest.current.view);
    if (caret != null && document.activeElement === root) placeCaret(root, caret);
  };

  const commit = (next: Model, caret: number) => {
    const root = ref.current;
    if (!root) return;
    model.current = next;
    draw(next, caret);
    const offsets = latest.current.view.lineOffsets;
    const shifted = lineShift(offsets, offsets.length - 1) * latest.current.view.scale;
    latest.current.onEdit(next.text, next.spans, measureRows(root, latest.current.lineHeight, shifted));
  };

  const apply = (start: number, end: number, insert: string, caretBefore: number) => {
    const current = model.current;
    past.current.push({ ...current, caret: caretBefore });
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    future.current = [];
    if (current.spans.length === 0) {
      const text = current.text.slice(0, start) + insert + current.text.slice(end);
      commit({ text, spans: [] }, start + insert.length);
      return;
    }
    const spans = editSpans(current.spans, start, end, insert);
    commit({ text: spansText(spans), spans }, start + insert.length);
  };

  const step = (direction: -1 | 1) => {
    const root = ref.current;
    const from = direction < 0 ? past.current : future.current;
    const to = direction < 0 ? future.current : past.current;
    const entry = from.pop();
    if (!entry || !root) return;
    const caret = selectionOffsets(root)?.end ?? model.current.text.length;
    to.push({ ...model.current, caret });
    commit({ text: entry.text, spans: entry.spans }, entry.caret);
  };

  // Something outside the editor changed what it shows (undo, a face refresh, zoom, a soft break
  // turning into a space): draw it again, keeping the caret where it was.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const next = { text: patch.text, spans: patch.spans };
    if (drawn.current === viewKey(next, view)) return;
    const caret = document.activeElement === root ? (selectionOffsets(root)?.end ?? null) : null;
    model.current = next;
    draw(next, caret == null ? null : Math.min(caret, patch.text.length));
  });

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onBeforeInput = (event: InputEvent) => {
      const type = event.inputType;
      if (event.isComposing || type.startsWith("insertComposition") || type === "deleteCompositionText") return;
      if (type.startsWith("format")) {
        event.preventDefault();
        return;
      }
      if (type === "historyUndo" || type === "historyRedo") {
        event.preventDefault();
        step(type === "historyUndo" ? -1 : 1);
        return;
      }
      const target = typeof event.getTargetRanges === "function" ? event.getTargetRanges()[0] : undefined;
      const range =
        target && root.contains(target.startContainer) && root.contains(target.endContainer)
          ? {
              start: Math.min(
                offsetAt(root, target.startContainer, target.startOffset),
                offsetAt(root, target.endContainer, target.endOffset),
              ),
              end: Math.max(
                offsetAt(root, target.startContainer, target.startOffset),
                offsetAt(root, target.endContainer, target.endOffset),
              ),
            }
          : selectionOffsets(root);
      if (!range) return;
      const text = model.current.text;
      let { start, end } = range;
      let insert = "";
      if (type === "insertText" || type === "insertReplacementText" || type === "insertTranspose" || type === "insertFromYank") {
        insert = event.data ?? "";
      } else if (type === "insertFromPaste" || type === "insertFromDrop") {
        insert = event.dataTransfer?.getData("text/plain") ?? event.data ?? "";
      } else if (type === "insertParagraph" || type === "insertLineBreak") {
        insert = "\n";
      } else if (type.startsWith("delete")) {
        if (start === end) {
          const forward = type.endsWith("Forward");
          if (forward) end = Math.min(text.length, end + charAfter(text, end));
          else start = Math.max(0, start - charBefore(text, start));
        }
      } else {
        event.preventDefault();
        return;
      }
      insert = insert.replace(/\r\n?/g, "\n");
      if (!latest.current.wrap) insert = insert.replace(/\n/g, " ");
      event.preventDefault();
      apply(start, end, insert, selectionOffsets(root)?.end ?? start);
    };
    // An edit the browser applied itself (IME composition, or an input type not handled above):
    // find what changed and move it into the model, which redraws the lines.
    const reconcile = () => {
      const text = domText(root);
      const before = model.current.text;
      if (text === before) return;
      let prefix = 0;
      while (prefix < text.length && prefix < before.length && text[prefix] === before[prefix]) prefix += 1;
      let suffix = 0;
      while (
        suffix < text.length - prefix &&
        suffix < before.length - prefix &&
        text[text.length - 1 - suffix] === before[before.length - 1 - suffix]
      ) {
        suffix += 1;
      }
      apply(prefix, before.length - suffix, text.slice(prefix, text.length - suffix), prefix);
    };
    reconcileRef.current = reconcile;
    const onInput = (event: Event) => {
      if ((event as InputEvent).isComposing) return;
      reconcile();
    };
    root.addEventListener("beforeinput", onBeforeInput);
    root.addEventListener("input", onInput);
    root.addEventListener("compositionend", reconcile);
    return () => {
      root.removeEventListener("beforeinput", onBeforeInput);
      root.removeEventListener("input", onInput);
      root.removeEventListener("compositionend", reconcile);
    };
    // The handlers read everything live through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      data-kind="content"
      data-id={patch.id}
      ref={(node) => {
        ref.current = node;
        register(node);
      }}
      className="content-editor content-editor-rich"
      role="textbox"
      aria-multiline={wrap}
      aria-label={label}
      contentEditable={selected}
      suppressContentEditableWarning
      spellCheck={false}
      style={{ ...style, textIndent: 0 }}
      onFocus={onFocus}
      onBlur={() => {
        // Whatever the editor shows when it is left is what stays: an edit the browser applied
        // itself and has not reported yet (a composition cut short) goes into the model first.
        reconcileRef.current();
        onBlur();
      }}
      onKeyDown={(event) => {
        const meta = event.metaKey || event.ctrlKey;
        if (meta && event.key.toLowerCase() === "z") {
          event.preventDefault();
          event.stopPropagation();
          step(event.shiftKey ? 1 : -1);
          return;
        }
        onKeyDown(event);
      }}
    />
  );
}
