import { useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { editSpans } from "./contentEdit.ts";
import { domText, offsetAt, placeCaret, selectionOffsets } from "./spanDom.ts";
import { spansText } from "./textLayout.ts";
import type { PatchAnnotation, TextSpan } from "./types.ts";

// Editor for a text patch that mixes faces: a contentEditable block whose children are one <span>
// per styled run. The DOM is owned here, not by React: every edit is intercepted before the browser
// applies it, mapped into the span under the caret, and the spans are drawn again from the model.

type Model = { text: string; spans: TextSpan[] };

type Snapshot = Model & { caret: number };

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

// Everything about the spans that decides how they are drawn.
function spanKey(spans: TextSpan[]): string {
  return spans
    .map((span) => `${span.text}\u0000${span.fontFamily}|${span.fontWeight}|${span.fontStyle}|${span.fontSize}|${span.color}`)
    .join("\u0001");
}

function render(root: HTMLElement, model: Model, scale: number, showLive: boolean): void {
  root.replaceChildren();
  for (const span of model.spans) {
    const node = document.createElement("span");
    node.style.fontFamily = span.fontFamily;
    node.style.fontWeight = String(span.fontWeight);
    node.style.fontStyle = span.fontStyle;
    node.style.fontSize = `${span.fontSize * scale}px`;
    node.style.color = showLive ? span.color : "transparent";
    node.textContent = span.text;
    root.append(node);
  }
  if (model.spans.length === 0 && model.text) root.append(document.createTextNode(model.text));
  // A block that ends in a newline needs a <br> for its empty last line to exist.
  if (model.text.endsWith("\n")) root.append(document.createElement("br"));
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

function measureRows(root: HTMLElement, lineHeight: number): number {
  const height = root.style.height;
  root.style.height = "0px";
  const rows = Math.round(root.scrollHeight / Math.max(lineHeight, 1));
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
  const drawn = useRef<{ model: Model; scale: number; showLive: boolean } | null>(null);
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const lineHeight = patch.lineHeight * scale;
  const wrap = patch.wrap;

  const latest = useRef({ onEdit, lineHeight, wrap, scale, showLive });
  latest.current = { onEdit, lineHeight, wrap, scale, showLive };

  const draw = (next: Model, caret: number | null) => {
    const root = ref.current;
    if (!root) return;
    const { scale: currentScale, showLive: live } = latest.current;
    render(root, next, currentScale, live);
    drawn.current = { model: next, scale: currentScale, showLive: live };
    if (caret != null && document.activeElement === root) placeCaret(root, caret);
  };

  const commit = (next: Model, caret: number) => {
    const root = ref.current;
    if (!root) return;
    model.current = next;
    draw(next, caret);
    latest.current.onEdit(next.text, next.spans, measureRows(root, latest.current.lineHeight));
  };

  const apply = (start: number, end: number, insert: string, caretBefore: number) => {
    const current = model.current;
    past.current.push({ ...current, caret: caretBefore });
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    future.current = [];
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

  // Something outside the editor changed the text (undo, a face refresh, zoom): draw it again.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const shown = drawn.current;
    const same =
      shown &&
      shown.scale === scale &&
      shown.showLive === showLive &&
      shown.model.text === patch.text &&
      (shown.model.spans === patch.spans || spanKey(shown.model.spans) === spanKey(patch.spans));
    if (same) return;
    const caret = document.activeElement === root ? selectionOffsets(root)?.end ?? null : null;
    model.current = { text: patch.text, spans: patch.spans };
    draw(model.current, caret == null ? null : Math.min(caret, patch.text.length));
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
    // find what changed and move it into the model, which redraws the spans.
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
      style={style}
      onFocus={onFocus}
      onBlur={onBlur}
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
