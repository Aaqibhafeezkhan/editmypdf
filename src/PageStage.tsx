import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { ChevronsLeftRight, GripVertical, RotateCw } from "lucide-react";
import { changedRanges, hasUserStyle, patchChanged, type TextRange } from "./changes.ts";
import { contentAt, contentLabel, faceTraits, isTextContent, readPageContent, type ContentElement } from "./content.ts";
import {
  cropGraphic,
  editCover,
  editSpans,
  graphicPatch,
  layoutTextPatch,
  refreshPatchFace,
  resizeTextPatch,
  sampleColor,
  softenBreaks,
  textPatch,
} from "./contentEdit.ts";
import { FormatBar, type Anchor } from "./FormatBar.tsx";
import { captureEdit } from "./pageInk.ts";
import { SpanEditor } from "./SpanEditor.tsx";
import { domText, placeCaret, selectRange, selectionOffsets } from "./spanDom.ts";
import { faceCandidates, formatAt, formatPatch, sameFormat, type FaceLookup, type FormatApi, type FormatChange, type FormatState } from "./textFormat.ts";
import { blockWidth, caretIndexAt, editorTop, fontCss as faceCss, lineShift, rangeBoxes, wrapSlack, type RangeBox } from "./textLayout.ts";
import { emojiSrc } from "./emojis.ts";
import { boundsOf, dist, hitTest, resizeAnnotation, rotateBy, rotatePoint, shapeFromDrag, translate } from "./geometry.ts";
import { parentSection, sameGuides, snapMove, type Box, type Guide } from "./guides.ts";
import { detailCanvas, startRender } from "./pdf.ts";
import { arrowBarbs, isBoxShape, isLinearShape, isOpenShape, lineHeadFor, outlinePoints, pointsToPath } from "./shapes.ts";
import { measureTextWidth } from "./textMeasure.ts";
import type { PDFPageProxy } from "pdfjs-dist";
import type { BoxShapeKind, LineHead, ShapeId } from "./shapes.ts";
import {
  fontCss,
  uid,
  type Annotation,
  type InkAnnotation,
  type Point,
  type StrokeStyle,
  type TextAnnotation,
  type PatchAnnotation,
  type PatchTail,
  type TextSpan,
  type TextStyle,
  type Tool,
} from "./types.ts";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

// How close, in screen pixels, a dragged mark's edge or centre comes to a guide before it snaps.
const SNAP_PX = 4;

type Drag =
  | { type: "ink"; origin: Annotation[]; annotation: InkAnnotation; last: Point }
  | {
      type: "line";
      origin: Annotation[];
      id: string;
      start: Point;
      color: string;
      strokeWidth: number;
      head: LineHead;
      page: number;
    }
  | {
      type: "shape";
      origin: Annotation[];
      kind: BoxShapeKind;
      id: string;
      start: Point;
      color: string;
      strokeWidth: number;
      fill: string | null;
      fillOpacity: number;
      page: number;
      moved: boolean;
    }
  // `box` is the mark's bounds where the drag found it, measured before its first move.
  | { type: "move"; origin: Annotation[]; id: string; start: Point; moved: boolean; box?: Box }
  // The right edge of a text patch's box being dragged: the width its text wraps in.
  | { type: "width"; origin: Annotation[]; id: string; start: Point; startWidth: number; moved: boolean }
  | {
      type: "resize";
      origin: Annotation[];
      id: string;
      handle: Handle;
      start: Point;
      box: { x: number; y: number; w: number; h: number };
    }
  | {
      type: "text";
      origin: Annotation[];
      id: string;
      start: Point;
      page: number;
      moved: boolean;
    }
  | { type: "erase"; origin: Annotation[]; erased: Set<string> }
  | {
      type: "rotate";
      origin: Annotation[];
      id: string;
      center: Point;
      startAngle: number;
      unwrapped: number;
    };

function resizedBox(
  box: { x: number; y: number; w: number; h: number },
  handle: Handle,
  dx: number,
  dy: number,
) {
  let x1 = box.x;
  let y1 = box.y;
  let x2 = box.x + box.w;
  let y2 = box.y + box.h;
  if (handle.includes("e")) x2 += dx;
  if (handle.includes("s")) y2 += dy;
  if (handle.includes("w")) x1 += dx;
  if (handle.includes("n")) y1 += dy;
  if (x2 < x1 + 16) {
    if (handle.includes("w")) x1 = x2 - 16;
    else x2 = x1 + 16;
  }
  if (y2 < y1 + 12) {
    if (handle.includes("n")) y1 = y2 - 12;
    else y2 = y1 + 12;
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function textFieldFromDrag(
  style: TextStyle,
  page: number,
  id: string,
  start: Point,
  point: Point,
): TextAnnotation {
  const line = Math.max(12, style.fontSize * 1.2);
  return {
    ...style,
    id,
    page,
    kind: "text",
    x: Math.min(start.x, point.x),
    y: Math.min(start.y, point.y),
    text: "",
    rotation: 0,
    autoWidth: false,
    width: Math.max(style.fontSize, Math.abs(point.x - start.x)),
    height: Math.max(line, Math.abs(point.y - start.y)),
  };
}

function fitTextarea(element: HTMLTextAreaElement) {
  element.style.height = "0px";
  element.style.height = `${element.scrollHeight}px`;
}

// The width a single line can wrap in once it is broken into lines: out to the table rule or the
// next piece of text on its right, less the padding the line keeps from the rule on its left,
// and never less than the line itself. A line with nothing beside it wraps in its own width.
function wrapWidth(patch: PatchAnnotation, content: ContentElement[]): number {
  const size = patch.fontSize || patch.originH;
  const top = patch.originY;
  const bottom = patch.originY + patch.originH;
  const right = patch.originX + patch.originW;
  const overlaps = (element: ContentElement) =>
    Math.min(bottom, element.y + element.h) - Math.max(top, element.y) > Math.min(patch.originH, element.h) * 0.5;
  const rules = content.filter((element) => element.kind === "line" && element.w <= 2.5 && element.h >= size * 0.8 && overlaps(element));
  const leftRule = rules.filter((rule) => rule.x + rule.w <= patch.originX + 1).sort((a, b) => b.x - a.x)[0];
  const rightRule = rules.filter((rule) => rule.x >= right - 1).sort((a, b) => a.x - b.x)[0];
  const padding = leftRule ? Math.max(0, patch.originX - (leftRule.x + leftRule.w)) : size * 0.6;
  const bounds: number[] = [];
  if (rightRule) bounds.push(rightRule.x - padding);
  const neighbour = content
    .filter((element) => isTextContent(element.kind) && element.x >= right - 1 && overlaps(element))
    .sort((a, b) => a.x - b.x)[0];
  if (neighbour) bounds.push(neighbour.x - size * 0.5);
  if (bounds.length === 0) return patch.originW;
  return Math.max(patch.originW, Math.min(...bounds) - patch.originX);
}

// The boxes of the runs the user changed inside a text patch, laid out once per patch version.
const changeBoxes = new WeakMap<PatchAnnotation, RangeBox[]>();

function changedBoxes(patch: PatchAnnotation): RangeBox[] {
  const cached = changeBoxes.get(patch);
  if (cached) return cached;
  const boxes = changedRanges(patch.originText ?? "", patch.text).flatMap((range) => rangeBoxes(patch, range.start, range.end));
  changeBoxes.set(patch, boxes);
  return boxes;
}

function sameAnchor(a: Anchor | null, b: Anchor | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.right - b.right) < 0.5 && Math.abs(a.bottom - b.bottom) < 0.5;
}

// Where the selection inside a mixed-face editor sits on screen: the left end of its first line
// to the far end of its last. Null when the selection is elsewhere or has no box yet.
function selectionAnchor(editor: HTMLElement): Anchor | null {
  if (editor instanceof HTMLTextAreaElement) return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;
  const rects = [...range.getClientRects()];
  const whole = range.getBoundingClientRect();
  if (rects.length === 0) rects.push(whole);
  if (rects.every((rect) => rect.width === 0 && rect.height === 0)) return null;
  let anchor: Anchor | null = null;
  for (const rect of rects) {
    if (rect.width === 0 && rect.height === 0) continue;
    if (!anchor) anchor = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    else {
      if (rect.top < anchor.top - 0.5) {
        anchor.top = rect.top;
        anchor.left = rect.left;
      }
      anchor.right = Math.max(anchor.right, rect.right);
      anchor.bottom = Math.max(anchor.bottom, rect.bottom);
    }
  }
  return anchor;
}

function toAnchor(rect: DOMRect): Anchor {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

// Tracks the selection inside the selected text patch's editor, shows the floating formatting
// bar over it and hands the rest of the editor (the attributes pane) the same state and actions.
// The range it last saw stays in force while the focus visits a control, so a size typed in the
// bar or the pane still applies to the words that were selected.
function PatchFormat({
  patch,
  scale,
  editorOf,
  traits,
  rangeRef,
  begin,
  apply,
  end,
  onState,
  register,
}: {
  patch: PatchAnnotation;
  scale: number;
  editorOf: (id: string) => HTMLElement | null;
  traits: FaceLookup;
  rangeRef: RefObject<TextRange | null>;
  begin: () => void;
  apply: (change: FormatChange) => void;
  end: () => void;
  onState: (state: FormatState | null) => void;
  register: (api: FormatApi | null) => void;
}) {
  const [range, setRange] = useState<TextRange | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [bounds, setBounds] = useState<Anchor | null>(null);
  const latest = useRef({ begin, apply, end });
  useLayoutEffect(() => {
    latest.current = { begin, apply, end };
  });
  const readRef = useRef<() => void>(() => undefined);
  const id = patch.id;

  useEffect(() => {
    const read = () => {
      const editor = editorOf(id);
      if (!editor) return;
      const focused = document.activeElement === editor;
      let next: TextRange | null = rangeRef.current;
      if (editor instanceof HTMLTextAreaElement) {
        // A textarea keeps its own selection while the focus is elsewhere.
        next = { start: editor.selectionStart ?? 0, end: editor.selectionEnd ?? 0 };
      } else if (focused) {
        next = selectionOffsets(editor);
      } else {
        // Unfocused, the editor's DOM selection is only trusted when it still spans text: a
        // redraw (an undo, a zoom) collapses whatever selection was left in it.
        const offsets = selectionOffsets(editor);
        if (offsets && offsets.end > offsets.start) next = offsets;
      }
      rangeRef.current = next;
      setRange((current) => (current?.start === next?.start && current?.end === next?.end ? current : next));
      const at = (focused ? selectionAnchor(editor) : null) ?? toAnchor(editor.getBoundingClientRect());
      setAnchor((current) => (sameAnchor(current, at) ? current : at));
      const scroller = editor.closest<HTMLElement>(".pages");
      const area = scroller ? toAnchor(scroller.getBoundingClientRect()) : null;
      setBounds((current) => (sameAnchor(current, area) ? current : area));
    };
    readRef.current = read;
    read();
    document.addEventListener("selectionchange", read);
    window.addEventListener("scroll", read, true);
    window.addEventListener("resize", read);
    return () => {
      document.removeEventListener("selectionchange", read);
      window.removeEventListener("scroll", read, true);
      window.removeEventListener("resize", read);
    };
  }, [editorOf, id, rangeRef]);

  // Typing moves the caret and zoom moves the box: read again whenever the patch or the scale changes.
  useEffect(() => {
    readRef.current();
  }, [patch, scale]);

  useEffect(() => {
    register({
      begin: () => latest.current.begin(),
      apply: (change) => latest.current.apply(change),
      end: () => latest.current.end(),
    });
    return () => register(null);
  }, [register]);

  const state = formatAt(patch, range, traits);
  const reported = useRef<FormatState | null>(null);
  useEffect(() => {
    if (sameFormat(reported.current, state)) return;
    reported.current = state;
    onState(state);
  });
  useEffect(() => {
    return () => {
      reported.current = null;
      onState(null);
    };
  }, [onState]);

  return <FormatBar state={state} anchor={anchor} bounds={bounds} onChange={apply} onBegin={begin} onEnd={end} />;
}

export function PageStage({
  page,
  pageIndex,
  scale,
  baseWidth,
  baseHeight,
  rotation,
  spin,
  annotations,
  tool,
  shape,
  stroke,
  textStyle,
  selectedId,
  hoverId,
  objectNumbers,
  onHover,
  focusId,
  getAnnotations,
  getEpoch,
  onReplace,
  onPushBaseline,
  onSelect,
  onRequestFocus,
  onConsumeFocus,
  selectedContent,
  onSelectContent,
  onFormatState,
  registerFormat,
}: {
  page: PDFPageProxy;
  pageIndex: number;
  scale: number;
  baseWidth: number;
  baseHeight: number;
  rotation: number;
  spin: number;
  annotations: Annotation[];
  tool: Tool;
  shape: ShapeId;
  stroke: StrokeStyle;
  textStyle: TextStyle;
  selectedId: string | null;
  // The mark hovered in the object list or on a page, outlined here with its list number.
  hoverId: string | null;
  objectNumbers: ReadonlyMap<string, number>;
  onHover: (id: string | null) => void;
  focusId: string | null;
  getAnnotations: () => Annotation[];
  onReplace: (next: Annotation[]) => void;
  onPushBaseline: (baseline: Annotation[]) => void;
  onSelect: (id: string | null) => void;
  onRequestFocus: (id: string) => void;
  onConsumeFocus: () => void;
  getEpoch: () => number;
  selectedContent: ContentElement | null;
  onSelectContent: (element: ContentElement | null) => void;
  // What the selected text patch's caret or selection is formatted like, for the attributes pane.
  onFormatState: (state: FormatState | null) => void;
  // The formatting actions on the selected text patch, while this page holds it.
  registerFormat: (api: FormatApi | null) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const textBaseline = useRef<Annotation[] | null>(null);
  const draftText = useRef<{ id: string; origin: Annotation[] } | null>(null);
  const epochOnFocus = useRef(0);
  // Every editor on the page: textareas for text annotations and single-face patches, and the
  // contentEditable blocks of patches that mix faces.
  const textareas = useRef(new Map<string, HTMLTextAreaElement | HTMLDivElement>());
  const armFocus = useRef<string | null>(null);
  // Where the caret goes when an editor takes the focus; with `from`, a selection up to `index`.
  const caretRef = useRef<{ id: string; index: number; from?: number } | null>(null);
  // The run of the selected text patch that formatting acts on, as the format tracker last saw it.
  const formatRange = useRef<TextRange | null>(null);
  // An adjustment in progress (a slider drag, an open colour picker): where it started, so the
  // whole of it is one undo step.
  const formatGesture = useRef<Annotation[] | null>(null);
  const formatOpen = useRef(false);
  const [seen, setSeen] = useState(pageIndex === 0);
  const [content, setContent] = useState<ContentElement[]>([]);
  // Editors are placed by measuring their face; a face pdf.js registers after an editor opened
  // (the first click right after a document opens) moves the baseline by a point, so the page
  // lays its editors out again whenever a font finishes loading.
  const [, setFontTick] = useState(0);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onDone = () => setFontTick((tick) => tick + 1);
    document.fonts.addEventListener("loadingdone", onDone);
    return () => document.fonts.removeEventListener("loadingdone", onDone);
  }, []);
  const [hoverContent, setHoverContent] = useState<string | null>(null);
  const contentRef = useRef<ContentElement[]>([]);
  // The alignment guides the mark being moved is snapped to; none once the drag ends.
  const [guides, setGuides] = useState<Guide[]>([]);

  const focusText = (id: string) => {
    const element = textareas.current.get(id);
    if (!element) return;
    element.focus({ preventScroll: true });
    const caret = caretRef.current;
    const length = element instanceof HTMLTextAreaElement ? element.value.length : domText(element).length;
    const index = caret?.id === id ? caret.index : length;
    const clamped = Math.max(0, Math.min(index, length));
    const from = caret?.id === id && caret.from != null ? Math.max(0, Math.min(caret.from, clamped)) : null;
    if (element instanceof HTMLTextAreaElement) element.setSelectionRange(from ?? clamped, clamped);
    else if (from != null) selectRange(element, from, clamped);
    else placeCaret(element, clamped);
  };
  const editorOf = useCallback((id: string): HTMLElement | null => textareas.current.get(id) ?? null, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { rootMargin: "800px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!seen) return;
    let cancel = false;
    readPageContent(page, pageIndex)
      .then((items) => {
        if (cancel) return;
        contentRef.current = items;
        setContent(items);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [page, pageIndex, seen]);

  useEffect(() => {
    if (tool !== "select") setHoverContent(null);
  }, [tool]);

  useEffect(() => {
    if (!seen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let task: ReturnType<typeof startRender> | null = null;
    const delay = canvas.width === 0 || reduce ? 0 : 280;
    const timer = window.setTimeout(() => {
      const next = startRender(page, canvas, scale);
      next.promise.catch(() => undefined);
      task = next;
    }, delay);
    return () => {
      window.clearTimeout(timer);
      task?.cancel();
    };
  }, [page, scale, seen]);

  useEffect(() => {
    if (!focusId) return;
    const id = focusId;
    let second = 0;
    const frame = requestAnimationFrame(() => {
      focusText(id);
      second = requestAnimationFrame(() => {
        focusText(id);
        onConsumeFocus();
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(second);
    };
  }, [focusId, onConsumeFocus]);

  // Drawing tools take the keyboard away from whichever editor had it, a page's own text or a
  // text field alike, so typing never lands in a field the user has moved on from.
  useEffect(() => {
    if (tool === "select" || tool === "text") return;
    for (const element of textareas.current.values()) {
      if (document.activeElement === element) element.blur();
    }
  }, [tool]);

  useEffect(() => {
    if (content.length === 0) return;
    let changed = false;
    const next = getAnnotations().map((annotation) => {
      if (annotation.kind !== "patch" || annotation.role !== "text") return annotation;
      const live = content.find((element) => element.id === annotation.sourceId);
      if (!live?.fontFamily || !isTextContent(live.kind)) return annotation;
      const refreshed = refreshPatchFace(annotation, live, content);
      if (refreshed !== annotation) changed = true;
      return refreshed;
    });
    if (changed) onReplace(next);
  }, [content, getAnnotations, onReplace]);

  useEffect(() => {
    for (const [id, element] of textareas.current) {
      const annotation = annotations.find((item) => item.id === id);
      if (!annotation || annotation.kind !== "text" || annotation.height != null) continue;
      if (element instanceof HTMLTextAreaElement) fitTextarea(element);
    }
  }, [annotations, scale]);

  const settleOpenText = (): Annotation[] => {
    const current = getAnnotations();
    const draft = draftText.current;
    if (draft) {
      const live = current.find((item) => item.id === draft.id);
      if (!live || (live.kind === "text" && live.text.length === 0)) {
        draftText.current = null;
        textBaseline.current = null;
        const restored = draft.origin.filter((item) => item.kind !== "text" || item.text.length > 0);
        if (restored.length !== current.length) onReplace(restored);
        return restored;
      }
      draftText.current = null;
    }
    const baseline = textBaseline.current;
    textBaseline.current = null;
    if (baseline && getEpoch() === epochOnFocus.current) onPushBaseline(baseline);
    const cleaned = getAnnotations().filter((item) => item.kind !== "text" || item.text.length > 0);
    if (cleaned.length !== current.length) {
      onReplace(cleaned);
      return cleaned;
    }
    return getAnnotations();
  };

  const traits: FaceLookup = (pdfFont) => faceTraits(page, pdfFont);

  // Makes a formatting action one undo step. The typing before it (or, for a patch opened by the
  // focus still in it, its opening with that typing) becomes a step of its own first, and the
  // typing after it is measured from here.
  const commitFormat = (id: string, before: Annotation[], changedBefore: boolean) => {
    const draft = draftText.current;
    if (draft?.id === id) {
      draftText.current = null;
      onPushBaseline(draft.origin);
      if (changedBefore) onPushBaseline(before);
    } else {
      const pending = textBaseline.current;
      if (pending && pending !== before && getEpoch() === epochOnFocus.current) onPushBaseline(pending);
      onPushBaseline(before);
    }
    const editor = textareas.current.get(id);
    if (editor && document.activeElement === editor) {
      textBaseline.current = getAnnotations();
      epochOnFocus.current = getEpoch();
    }
  };
  const beginFormat = () => {
    formatOpen.current = true;
  };
  // Applies a change to the selected text patch: to the selected run of its text, or to all of it.
  const applyFormat = (change: FormatChange) => {
    const current = getAnnotations();
    const item = current.find((entry): entry is PatchAnnotation => entry.id === selectedId && entry.kind === "patch");
    if (!item || item.role !== "text") return;
    const next = formatPatch(item, formatRange.current, change, faceCandidates(contentRef.current), traits);
    if (next === item) return;
    const editor = textareas.current.get(item.id);
    // A single run's textarea gives way to the span editor once part of it is styled; the editor
    // that takes over gets the focus and the selection back.
    if (editor instanceof HTMLTextAreaElement && (next.spans.length > 0 || next.wrap) && document.activeElement === editor) {
      const range = formatRange.current;
      caretRef.current = {
        id: item.id,
        index: range?.end ?? next.text.length,
        ...(range && range.end > range.start ? { from: range.start } : {}),
      };
      armFocus.current = item.id;
      onRequestFocus(item.id);
    }
    onReplace(current.map((entry) => (entry.id === item.id ? next : entry)));
    if (formatOpen.current) {
      if (!formatGesture.current) formatGesture.current = current;
      return;
    }
    commitFormat(item.id, current, patchChanged(item));
  };
  const endFormat = () => {
    formatOpen.current = false;
    const origin = formatGesture.current;
    formatGesture.current = null;
    if (!origin || !selectedId) return;
    const before = origin.find((entry) => entry.id === selectedId);
    commitFormat(selectedId, origin, before?.kind === "patch" ? patchChanged(before) : true);
  };

  const toPoint = (event: ReactPointerEvent | PointerEvent): Point => {
    const frame = frameRef.current;
    const rect = frame?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 0, y: 0 };
    if (!rotation) {
      const factor = rect.width / baseWidth;
      return {
        x: Math.min(baseWidth, Math.max(0, (event.clientX - rect.left) / factor)),
        y: Math.min(baseHeight, Math.max(0, (event.clientY - rect.top) / factor)),
      };
    }
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const radians = (-rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const localX = dx * cos - dy * sin + (baseWidth * scale) / 2;
    const localY = dx * sin + dy * cos + (baseHeight * scale) / 2;
    return {
      x: Math.min(baseWidth, Math.max(0, localX / scale)),
      y: Math.min(baseHeight, Math.max(0, localY / scale)),
    };
  };

  const textBox = (annotation: TextAnnotation) => {
    const element = textareas.current.get(annotation.id);
    const frame = frameRef.current;
    if (!element || !frame) return null;
    if (rotation) {
      return {
        x: element.offsetLeft / scale,
        y: element.offsetTop / scale,
        w: element.offsetWidth / scale,
        h: element.offsetHeight / scale,
      };
    }
    const pageRect = frame.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const factor = pageRect.width / baseWidth;
    return {
      x: (box.left - pageRect.left) / factor,
      y: (box.top - pageRect.top) / factor,
      w: box.width / factor,
      h: box.height / factor,
    };
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const frame = frameRef.current;
    requestAnimationFrame(() => frame?.classList.remove("interacting"));
    // An editor armed before the pointer went up gets its focus now. Only that one: a text field
    // this release creates arms itself afterwards and must not lose its focus to the previous
    // field, and an arm already consumed by the editor's own focus handler is left alone.
    const armed = armFocus.current;
    if (armed) {
      requestAnimationFrame(() => {
        if (armFocus.current !== armed || !textareas.current.has(armed)) return;
        focusText(armed);
        armFocus.current = null;
      });
    }
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.type === "ink") {
      if (drag.annotation.points.length === 0) return;
      onReplace([...drag.origin, drag.annotation]);
      onPushBaseline(drag.origin);
      onSelect(drag.annotation.id);
      return;
    }

    if (drag.type === "line") {
      const point = toPoint(event);
      if (dist(drag.start.x, drag.start.y, point.x, point.y) < 2) {
        onReplace(drag.origin);
        return;
      }
      onPushBaseline(drag.origin);
      onSelect(drag.id);
      return;
    }

    if (drag.type === "shape") {
      const point = toPoint(event);
      const width = Math.abs(point.x - drag.start.x);
      const height = Math.abs(point.y - drag.start.y);
      if (!drag.moved || (width < 2 && height < 2)) {
        onReplace(drag.origin);
        return;
      }
      onPushBaseline(drag.origin);
      onSelect(drag.id);
      return;
    }

    if (drag.type === "text") {
      const point = toPoint(event);
      const width = Math.abs(point.x - drag.start.x);
      const height = Math.abs(point.y - drag.start.y);
      const clicked = !drag.moved || (width < 4 && height < 4);
      const created: TextAnnotation = clicked
        ? {
            id: drag.id,
            page: drag.page,
            kind: "text",
            x: drag.start.x,
            y: drag.start.y,
            text: "",
            rotation: 0,
            ...textStyle,
            height: null,
          }
        : textFieldFromDrag(textStyle, drag.page, drag.id, drag.start, point);
      if (created.autoWidth) created.width = measureTextWidth(created);
      draftText.current = { id: drag.id, origin: drag.origin };
      onReplace([...drag.origin, created]);
      onSelect(drag.id);
      armFocus.current = drag.id;
      onRequestFocus(drag.id);
      return;
    }

    if (drag.type === "move" || drag.type === "width") {
      setGuides((current) => (current.length === 0 ? current : []));
      if (drag.moved && draftText.current?.id !== drag.id) onPushBaseline(drag.origin);
      onSelect(drag.id);
      return;
    }

    if (drag.type === "resize" || drag.type === "rotate") {
      if (draftText.current?.id !== drag.id) onPushBaseline(drag.origin);
      onSelect(drag.id);
      return;
    }

    if (drag.erased.size > 0) {
      onPushBaseline(drag.origin);
      onSelect(null);
    }
  };

  const hoverContentAt = (point: Point) => {
    if (tool !== "select") {
      onHover(null);
      return;
    }
    const mark = hitTest(getAnnotations(), pageIndex, point, textBox);
    onHover(mark?.id ?? null);
    const next = mark ? null : (contentAt(contentRef.current, point)?.id ?? null);
    setHoverContent((current) => (current === next ? current : next));
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      hoverContentAt(toPoint(event));
      return;
    }
    frameRef.current?.classList.add("interacting");
    const point = toPoint(event);

    if (drag.type === "ink") {
      if (dist(drag.last.x, drag.last.y, point.x, point.y) < 0.35) return;
      drag.last = point;
      drag.annotation = { ...drag.annotation, points: [...drag.annotation.points, point] };
      onReplace([...drag.origin, drag.annotation]);
      return;
    }

    if (drag.type === "line") {
      const line: Annotation = {
        id: drag.id,
        page: drag.page,
        kind: "line",
        color: drag.color,
        strokeWidth: drag.strokeWidth,
        head: drag.head,
        x1: drag.start.x,
        y1: drag.start.y,
        x2: point.x,
        y2: point.y,
      };
      onReplace([...drag.origin, line]);
      return;
    }

    if (drag.type === "text") {
      if (dist(drag.start.x, drag.start.y, point.x, point.y) < 1) return;
      drag.moved = true;
      onReplace([...drag.origin, textFieldFromDrag(textStyle, drag.page, drag.id, drag.start, point)]);
      onSelect(drag.id);
      return;
    }

    if (drag.type === "shape") {
      drag.moved = true;
      onReplace([
        ...drag.origin,
        shapeFromDrag(
          drag.kind,
          drag.page,
          drag.id,
          drag.color,
          drag.strokeWidth,
          drag.fill,
          drag.fillOpacity,
          drag.start.x,
          drag.start.y,
          point.x,
          point.y,
        ),
      ]);
      return;
    }

    if (drag.type === "move") {
      let dx = point.x - drag.start.x;
      let dy = point.y - drag.start.y;
      if (!drag.moved && Math.hypot(dx, dy) < 1) return;
      const original = drag.origin.find((item) => item.id === drag.id);
      if (!original) return;
      // The mark's box is measured before its first move, while it still sits where the drag
      // found it; a text field's comes from its editor, whose height follows its lines.
      if (!drag.moved) {
        drag.box = (original.kind === "text" ? textBox(original) : null) ?? boundsOf(original);
      }
      drag.moved = true;
      let shown: Guide[] = [];
      // Alt moves the mark freely: no snapping, no guides.
      if (drag.box && !event.altKey) {
        const raw = { ...drag.box, x: drag.box.x + dx, y: drag.box.y + dy };
        const section = parentSection(raw, contentRef.current, original.kind === "patch" ? original.sourceId : null);
        const page = { x: 0, y: 0, w: baseWidth, h: baseHeight };
        const snap = snapMove(drag.box, dx, dy, page, section, SNAP_PX / scale);
        dx = snap.dx;
        dy = snap.dy;
        shown = snap.guides;
      }
      setGuides((current) => (sameGuides(current, shown) ? current : shown));
      onReplace(drag.origin.map((item) => (item.id === drag.id ? translate(original, dx, dy) : item)));
      return;
    }

    if (drag.type === "width") {
      const dx = point.x - drag.start.x;
      if (!drag.moved && Math.abs(dx) < 1) return;
      drag.moved = true;
      const original = drag.origin.find((item) => item.id === drag.id);
      if (!original || original.kind !== "patch") return;
      const resized = resizeTextPatch(original, drag.startWidth + dx);
      // A single line's editor is replaced by the block's as it starts to wrap; the block's
      // editor takes the focus over so typing can go on afterwards.
      if (!original.wrap) {
        caretRef.current = { id: drag.id, index: resized.text.length };
        armFocus.current = drag.id;
        onRequestFocus(drag.id);
      }
      onReplace(drag.origin.map((item) => (item.id === drag.id ? resized : item)));
      return;
    }

    if (drag.type === "rotate") {
      const angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x);
      let delta = angle - drag.unwrapped;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      drag.unwrapped += delta;
      const source = drag.origin.find((item) => item.id === drag.id);
      if (!source) return;
      const turned = rotateBy(source, ((drag.unwrapped - drag.startAngle) * 180) / Math.PI);
      onReplace(drag.origin.map((item) => (item.id === drag.id ? turned : item)));
      return;
    }

    if (drag.type === "resize") {
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      onReplace(
        drag.origin.map((item) => {
          if (item.id !== drag.id) return item;
          if (item.kind === "text") {
            const local = rotatePoint(dx, dy, 0, 0, -(item.rotation ?? 0));
            const box = resizedBox(drag.box, drag.handle, local.x, local.y);
            const changesWidth = drag.handle !== "n" && drag.handle !== "s";
            const changesHeight = drag.handle !== "e" && drag.handle !== "w";
            return {
              ...item,
              x: box.x,
              y: box.y,
              width: changesWidth ? box.w : item.width,
              height: changesHeight ? box.h : item.height,
              autoWidth: changesWidth ? false : item.autoWidth,
            };
          }
          return resizeAnnotation(item, drag.box, drag.handle, dx, dy);
        }),
      );
      return;
    }

    const hit = hitTest(drag.origin, pageIndex, point, textBox);
    if (!hit || drag.erased.has(hit.id)) return;
    drag.erased.add(hit.id);
    onReplace(drag.origin.filter((item) => !drag.erased.has(item.id)));
  };

  const focusContentText = (patch: PatchAnnotation, point: Point, element: ContentElement) => {
    onSelect(patch.id);
    onSelectContent(element.kind && isTextContent(element.kind) ? { ...element, text: patch.text } : element);
    if (patch.role !== "text") return;
    caretRef.current = { id: patch.id, index: caretIndexAt(patch, point, scale) };
    armFocus.current = patch.id;
    onRequestFocus(patch.id);
  };

  const beginContentEdit = async (element: ContentElement, point: Point) => {
    const current = getAnnotations();
    const existing = current.find(
      (item): item is PatchAnnotation => item.kind === "patch" && item.sourceId === element.id && item.page === pageIndex,
    );
    if (existing) {
      focusContentText(existing, point, element);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      onSelectContent(element);
      return;
    }
    if (isTextContent(element.kind)) {
      // Colours and the backdrop are read from a 4x rendering of the page when one is ready.
      // Rendering it waits on pdf.js's worker, which is still reading the neighbouring pages for
      // several seconds after a document opens, so the first click on a heavy page would open
      // nothing for that long. The page's own canvas stands in until the detail is ready.
      // The page's own canvas can stand in only once it has been painted; before that it is a
      // blank bitmap, and the backdrop and the pictures of the neighbours would come out empty.
      const painted = (() => {
        if (canvas.width < 2 || canvas.height < 2) return false;
        try {
          const pixel = canvas.getContext("2d")?.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
          return !!pixel && (pixel[3] ?? 0) > 0;
        } catch {
          return false;
        }
      })();
      let source = canvas;
      try {
        source = painted
          ? await Promise.race([
              detailCanvas(page),
              new Promise<HTMLCanvasElement>((resolve) => window.setTimeout(() => resolve(canvas), 250)),
            ])
          : await detailCanvas(page);
      } catch {
        source = canvas;
      }
      const edited = new Set(
        current
          .filter((item): item is PatchAnnotation => item.kind === "patch" && item.role === "text" && item.page === pageIndex)
          .map((item) => item.sourceId),
      );
      const captured = captureEdit(source, element, contentRef.current, baseWidth, baseHeight, edited);
      try {
        const faces = [faceCss({ ...element, fontSize: element.fontSize || element.h }), ...element.spans.map((span) => faceCss(span))];
        await Promise.all([...new Set(faces)].map((css) => document.fonts.load(css)));
      } catch {
        // The browser falls back to the generic family when the face is missing.
      }
      const latest = getAnnotations();
      const again = latest.find((item) => item.kind === "patch" && item.sourceId === element.id);
      if (again && again.kind === "patch") {
        focusContentText(again, point, element);
        return;
      }
      // Each run's colour comes from the rendered page, like the element's own, because the
      // colours pdf.js reports per run do not line up with its text items.
      const sampled = sampleColor(source, element, baseWidth, baseHeight) ?? element.color;
      const spans = element.spans.map((span) => ({
        ...span,
        color: sampleColor(source, span.box, baseWidth, baseHeight) ?? sampled,
      }));
      const patch = textPatch({ ...element, spans }, sampled, captured);
      draftText.current = { id: patch.id, origin: latest };
      // A line opened for editing shows its own text from now on: another patch whose tails
      // pictured it (and whatever followed it on the row) drops those pictures.
      const meets = (tail: PatchTail) =>
        tail.x < element.x + element.w && tail.x + tail.w > element.x && tail.y < element.y + element.h && tail.y + tail.h > element.y;
      const freed = latest.map((item) => {
        if (item.kind !== "patch" || item.role !== "text" || item.page !== pageIndex) return item;
        const index = item.tails.findIndex(meets);
        return index < 0 ? item : { ...item, tails: item.tails.slice(0, index) };
      });
      onReplace([...freed, patch]);
      focusContentText(patch, point, element);
      return;
    }
    const image = cropGraphic(canvas, element, baseWidth, baseHeight);
    if (!image) {
      onSelectContent(element);
      return;
    }
    // The patch is only a selection until it is moved or resized; an untouched one is dropped
    // again when something else is clicked, and moving it is what enters the history.
    const patch = graphicPatch(element, image);
    onReplace([...current, patch]);
    onSelect(patch.id);
    onSelectContent(element);
  };

  // A graphic patch that still sits exactly where its element was: a selection, nothing more.
  const untouchedGraphic = (annotation: Annotation): annotation is PatchAnnotation =>
    annotation.kind === "patch" &&
    annotation.role === "graphic" &&
    Math.abs(annotation.x - annotation.originX) < 0.01 &&
    Math.abs(annotation.y - annotation.originY) < 0.01 &&
    Math.abs(annotation.w - annotation.originW) < 0.01 &&
    Math.abs(annotation.h - annotation.originH) < 0.01 &&
    !annotation.rotation;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.dataset.kind === "content") active.blur();
    const current = settleOpenText();
    const point = toPoint(event);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A very fast click can release the pointer before capture. The tool still runs.
    }

    if (tool === "select") {
      let hit = hitTest(current, pageIndex, point, textBox);
      // Text under a selected table or shape stays reachable: a click on a label inside an
      // untouched graphic selection opens that label, and the selection itself is let go.
      if (hit && untouchedGraphic(hit)) {
        const element = contentAt(contentRef.current, point);
        if (element && isTextContent(element.kind)) {
          const rest = current.filter((item) => item.id !== hit?.id);
          onReplace(rest);
          onSelect(null);
          void beginContentEdit(element, point);
          return;
        }
      }
      // A graphic selection that was never moved is dropped when the click lands elsewhere.
      const selectedNow = current.find((item) => item.id === selectedId);
      if (selectedNow && untouchedGraphic(selectedNow) && hit?.id !== selectedNow.id) {
        const rest = current.filter((item) => item.id !== selectedNow.id);
        onReplace(rest);
        hit = hitTest(rest, pageIndex, point, textBox);
      }
      if (hit) {
        if (hit.kind === "patch" && hit.role === "text") {
          const source = contentRef.current.find((item) => item.id === hit.sourceId);
          if (source) focusContentText(hit, point, source);
          else {
            onSelect(hit.id);
            caretRef.current = { id: hit.id, index: caretIndexAt(hit, point, scale) };
            armFocus.current = hit.id;
            onRequestFocus(hit.id);
          }
          return;
        }
        onSelectContent(null);
        onSelect(hit.id);
        if (hit.kind === "text") {
          onRequestFocus(hit.id);
          return;
        }
        dragRef.current = { type: "move", origin: current, id: hit.id, start: point, moved: false };
        return;
      }
      onSelect(null);
      const element = contentAt(contentRef.current, point);
      if (!element) {
        onSelectContent(null);
        return;
      }
      void beginContentEdit(element, point);
      return;
    }

    if (tool === "eraser") {
      const hit = hitTest(current, pageIndex, point, textBox);
      const erased = new Set<string>();
      if (hit) {
        erased.add(hit.id);
        onReplace(current.filter((item) => item.id !== hit.id));
      }
      dragRef.current = { type: "erase", origin: current, erased };
      return;
    }

    if (tool === "text") {
      const hit = hitTest(current, pageIndex, point, textBox);
      if (hit?.kind === "text") {
        onSelect(hit.id);
        armFocus.current = hit.id;
        onRequestFocus(hit.id);
        return;
      }
      dragRef.current = {
        type: "text",
        origin: current,
        id: uid(),
        start: point,
        page: pageIndex,
        moved: false,
      };
      return;
    }

    if (tool === "emoji" || tool === "signature") {
      const hit = hitTest(current, pageIndex, point, textBox);
      onSelect(hit?.id ?? null);
      if (!hit) return;
      dragRef.current = { type: "move", origin: current, id: hit.id, start: point, moved: false };
      return;
    }

    const id = uid();
    if (tool === "pencil") {
      const annotation: InkAnnotation = {
        id,
        page: pageIndex,
        kind: "ink",
        color: stroke.color,
        strokeWidth: stroke.strokeWidth,
        opacity: stroke.opacity,
        cap: stroke.cap,
        dash: stroke.dash,
        brush: stroke.brush,
        points: [point],
      };
      dragRef.current = { type: "ink", origin: current, annotation, last: point };
      onReplace([...current, annotation]);
      return;
    }

    if (tool === "shape" && isLinearShape(shape)) {
      dragRef.current = {
        type: "line",
        origin: current,
        id,
        start: point,
        color: stroke.color,
        strokeWidth: stroke.strokeWidth,
        head: lineHeadFor(shape),
        page: pageIndex,
      };
      return;
    }

    if (tool !== "shape" || isLinearShape(shape)) return;

    dragRef.current = {
      type: "shape",
      origin: current,
      kind: shape,
      id,
      start: point,
      color: stroke.color,
      strokeWidth: stroke.strokeWidth,
      fill: stroke.fill,
      fillOpacity: stroke.fillOpacity,
      page: pageIndex,
      moved: false,
    };
  };

  const pageAnnotations = annotations.filter((item) => item.page === pageIndex);
  const sideways = rotation % 180 !== 0;
  const frameWidth = baseWidth * scale;
  const frameHeight = baseHeight * scale;

  return (
    <div className="page-wrap">
      <div
        className="page-turn"
        style={{
          width: sideways ? frameHeight : frameWidth,
          height: sideways ? frameWidth : frameHeight,
        }}
      >
      <div
        ref={frameRef}
        className="page-frame"
        style={{
          width: frameWidth,
          height: frameHeight,
          left: ((sideways ? frameHeight : frameWidth) - frameWidth) / 2,
          top: ((sideways ? frameWidth : frameHeight) - frameHeight) / 2,
          transform: `rotate(${spin}deg)`,
        }}
      >
        <canvas ref={canvasRef} />
        <svg
          className="marks"
          viewBox={`0 0 ${baseWidth} ${baseHeight}`}
          aria-hidden="true"
        >
          {tool === "select" &&
            content.map((element) => {
              const selected = selectedContent?.id === element.id;
              const hot = hoverContent === element.id || selected;
              if (!hot) return null;
              return (
                <rect
                  key={element.id}
                  data-kind={element.kind}
                  data-text={element.text.slice(0, 120)}
                  x={element.x}
                  y={element.y}
                  width={Math.max(element.w, 0.5)}
                  height={Math.max(element.h, 0.5)}
                  fill={selected ? "rgba(29, 78, 216, 0.12)" : "rgba(29, 78, 216, 0.06)"}
                  stroke="#1d4ed8"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={selected ? undefined : "4 3"}
                />
              );
            })}
          {pageAnnotations.map((annotation) => {
            if (annotation.kind === "ink") {
              const ink = {
                stroke: annotation.color,
                strokeWidth: annotation.strokeWidth,
                strokeOpacity: annotation.opacity ?? 1,
                strokeLinecap: annotation.cap ?? "round",
                strokeLinejoin: (annotation.cap ?? "round") === "square" ? "miter" : "round",
                strokeDasharray: annotation.dash ?? undefined,
              } as const;
              if (annotation.points.length === 1) {
                const only = annotation.points[0];
                if (!only) return null;
                return (
                  <circle
                    key={annotation.id}
                    cx={only.x}
                    cy={only.y}
                    r={annotation.strokeWidth / 2}
                    fill={annotation.color}
                    fillOpacity={annotation.opacity ?? 1}
                  />
                );
              }
              return (
                <polyline
                  key={annotation.id}
                  points={annotation.points.map((item) => `${item.x},${item.y}`).join(" ")}
                  fill="none"
                  {...ink}
                />
              );
            }
            if (annotation.kind === "line") {
              const size = Math.max(10, annotation.strokeWidth * 3);
              const tips = [];
              if (annotation.head === "end" || annotation.head === "both") {
                tips.push(arrowBarbs(annotation.x1, annotation.y1, annotation.x2, annotation.y2, size));
              }
              if (annotation.head === "both") {
                tips.push(arrowBarbs(annotation.x2, annotation.y2, annotation.x1, annotation.y1, size));
              }
              return (
                <g key={annotation.id}>
                  <line
                    x1={annotation.x1}
                    y1={annotation.y1}
                    x2={annotation.x2}
                    y2={annotation.y2}
                    stroke={annotation.color}
                    strokeWidth={annotation.strokeWidth}
                    strokeLinecap="round"
                  />
                  {tips.map((barbs, index) => (
                    <polyline
                      key={index}
                      points={`${barbs[0].x},${barbs[0].y} ${index === 0 ? annotation.x2 : annotation.x1},${index === 0 ? annotation.y2 : annotation.y1} ${barbs[1].x},${barbs[1].y}`}
                      fill="none"
                      stroke={annotation.color}
                      strokeWidth={annotation.strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </g>
              );
            }
            if (annotation.kind === "emoji" || annotation.kind === "signature") {
              const cx = annotation.x + annotation.w / 2;
              const cy = annotation.y + annotation.h / 2;
              return (
                <image
                  key={annotation.id}
                  href={annotation.kind === "emoji" ? emojiSrc(annotation.emoji) : annotation.src}
                  x={annotation.x}
                  y={annotation.y}
                  width={annotation.w}
                  height={annotation.h}
                  transform={annotation.rotation ? `rotate(${annotation.rotation} ${cx} ${cy})` : undefined}
                  preserveAspectRatio="xMidYMid meet"
                />
              );
            }
            if (isBoxShape(annotation)) {
              const spin = annotation.rotation
                ? `rotate(${annotation.rotation} ${annotation.x + annotation.w / 2} ${annotation.y + annotation.h / 2})`
                : undefined;
              if (annotation.kind === "ellipse") {
                return (
                  <ellipse
                    key={annotation.id}
                    cx={annotation.x + annotation.w / 2}
                    cy={annotation.y + annotation.h / 2}
                    rx={Math.max(annotation.w / 2, 0.5)}
                    ry={Math.max(annotation.h / 2, 0.5)}
                    transform={spin}
                    fill={annotation.fill ?? "none"}
                    fillOpacity={annotation.fill ? (annotation.fillOpacity ?? 1) : undefined}
                    stroke={annotation.color}
                    strokeWidth={annotation.strokeWidth}
                  />
                );
              }
              if (annotation.kind === "rect" || annotation.kind === "roundRect") {
                const radius = annotation.kind === "roundRect" ? Math.min(annotation.w, annotation.h) * 0.18 : 0;
                return (
                  <rect
                    key={annotation.id}
                    x={annotation.x}
                    y={annotation.y}
                    width={annotation.w}
                    height={annotation.h}
                    rx={radius}
                    ry={radius}
                    transform={spin}
                    fill={annotation.fill ?? "none"}
                    fillOpacity={annotation.fill ? (annotation.fillOpacity ?? 1) : undefined}
                    stroke={annotation.color}
                    strokeWidth={annotation.strokeWidth}
                  />
                );
              }
              const open = isOpenShape(annotation.kind);
              return (
                <path
                  key={annotation.id}
                  d={pointsToPath(
                    outlinePoints(annotation.kind, annotation.x, annotation.y, annotation.w, annotation.h),
                    !open,
                  )}
                  fill={open ? "none" : (annotation.fill ?? "none")}
                  fillOpacity={!open && annotation.fill ? (annotation.fillOpacity ?? 1) : undefined}
                  stroke={annotation.color}
                  strokeWidth={annotation.strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  transform={spin}
                />
              );
            }
            return null;
          })}
          {pageAnnotations.map((annotation) => {
            if (annotation.id !== selectedId || annotation.kind === "text" || annotation.kind === "patch") return null;
            const box = boundsOf(annotation);
            const pad = annotation.kind === "emoji" || annotation.kind === "signature" ? 4 : annotation.strokeWidth / 2 + 4;
            return (
              <rect
                key={`${annotation.id}-selection`}
                x={box.x - pad}
                y={box.y - pad}
                width={box.w + pad * 2}
                height={box.h + pad * 2}
                fill="none"
                stroke="#1d4ed8"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            );
          })}
        </svg>
        {pageAnnotations.map((annotation) => {
          if (annotation.kind !== "text") return null;
          if (annotation.text.length === 0 && annotation.id !== selectedId) return null;
          const selected = annotation.id === selectedId;
          const interactive = tool === "select" || tool === "text";
          const boxWidth = annotation.autoWidth ? measureTextWidth(annotation) : annotation.width;
          return (
            <div
              key={annotation.id}
              className={selected ? "text-box selected" : "text-box"}
              style={{
                left: annotation.x * scale,
                top: annotation.y * scale,
                width: boxWidth * scale,
                color: annotation.color,
                zIndex: selected ? 5 : 4,
                pointerEvents: interactive ? "auto" : "none",
                transform: annotation.rotation ? `rotate(${annotation.rotation}deg)` : undefined,
                transformOrigin: "center center",
              }}
              onPointerEnter={() => onHover(annotation.id)}
              onPointerLeave={() => onHover(null)}
            >
              {selected && interactive &&
                (["n", "e", "s", "w"] as const).map((edge) => (
                  <div
                    key={edge}
                    className={`edge edge-${edge}`}
                    aria-label="Move text"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      try {
                        event.currentTarget.setPointerCapture(event.pointerId);
                      } catch {
                        // A very fast click can release the pointer before capture.
                      }
                      onSelect(annotation.id);
                      dragRef.current = {
                        type: "move",
                        origin: getAnnotations(),
                        id: annotation.id,
                        start: toPoint(event),
                        moved: false,
                      };
                    }}
                    onPointerMove={moveDrag}
                    onPointerUp={finishDrag}
                  />
                ))}
              {selected && interactive &&
                HANDLES.map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    className={`handle ${handle}`}
                    aria-label={`Resize ${handle}`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      try {
                        event.currentTarget.setPointerCapture(event.pointerId);
                      } catch {
                        // A very fast click can release the pointer before capture.
                      }
                      const element = textareas.current.get(annotation.id);
                      const height =
                        annotation.height ??
                        (element ? element.offsetHeight / scale : annotation.fontSize * 1.2);
                      dragRef.current = {
                        type: "resize",
                        origin: getAnnotations(),
                        id: annotation.id,
                        handle,
                        start: toPoint(event),
                        box: { x: annotation.x, y: annotation.y, w: boxWidth, h: height },
                      };
                    }}
                    onPointerMove={moveDrag}
                    onPointerUp={finishDrag}
                  />
                ))}
              <textarea
                ref={(node) => {
                  if (node) {
                    textareas.current.set(annotation.id, node);
                    if (armFocus.current === annotation.id) {
                      node.focus({ preventScroll: true });
                      node.setSelectionRange(node.value.length, node.value.length);
                    }
                  } else textareas.current.delete(annotation.id);
                }}
                value={annotation.text}
                placeholder="Type here"
                rows={1}
                spellCheck={false}
                aria-label="Annotation text"
                style={{
                  fontFamily: fontCss(annotation.fontId),
                  fontSize: annotation.fontSize * scale,
                  color: annotation.color,
                  fontWeight: annotation.bold ? 700 : 400,
                  fontStyle: annotation.italic ? "italic" : "normal",
                  textDecoration:
                    [annotation.underline ? "underline" : "", annotation.strike ? "line-through" : ""].filter(Boolean).join(" ") || "none",
                  textAlign: annotation.align,
                  whiteSpace: annotation.autoWidth ? "pre" : "pre-wrap",
                  overflowWrap: annotation.autoWidth ? "normal" : "anywhere",
                  height: annotation.height == null ? undefined : annotation.height * scale,
                  minHeight: annotation.fontSize * 1.2 * scale,
                  overflow: annotation.height == null ? "hidden" : "auto",
                  caretColor: annotation.color,
                }}
                onFocus={() => {
                  // The arm is spent once the field has focus; left set, the ref callback above
                  // would hand focus back to this field on every later render.
                  if (armFocus.current === annotation.id) armFocus.current = null;
                  textBaseline.current = getAnnotations();
                  epochOnFocus.current = getEpoch();
                  onSelect(annotation.id);
                }}
                onBlur={() => {
                  const latest = getAnnotations().find((item) => item.id === annotation.id);
                  if (!latest || latest.kind !== "text") {
                    if (draftText.current?.id === annotation.id) draftText.current = null;
                    return;
                  }
                  const value = latest.text;
                  if (value.length === 0) {
                    const draft = draftText.current;
                    draftText.current = null;
                    textBaseline.current = null;
                    const restored =
                      draft?.id === annotation.id
                        ? draft.origin
                        : getAnnotations().filter((item) => item.id !== annotation.id);
                    onReplace(restored.filter((item) => item.kind !== "text" || item.text.length > 0));
                    onSelect(null);
                    return;
                  }
                  const baseline = textBaseline.current;
                  textBaseline.current = null;
                  if (baseline && getEpoch() === epochOnFocus.current) onPushBaseline(baseline);
                }}
                onChange={(event) => {
                  const value = event.target.value;
                  const draft = draftText.current;
                  onReplace(
                    getAnnotations().map((item) => {
                      if (item.id !== annotation.id || item.kind !== "text") return item;
                      const next = { ...item, text: value };
                      if (next.autoWidth) next.width = measureTextWidth(next);
                      return next;
                    }),
                  );
                  if (value.length > 0 && draft?.id === annotation.id) {
                    draftText.current = null;
                    onPushBaseline(draft.origin);
                  }
                  if (annotation.height == null) fitTextarea(event.target);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.stopPropagation();
                }}
              />
            </div>
          );
        })}
        <div
          className={`hit-layer tool-${tool}`}
          role="application"
          aria-label="Drawing surface"
          onMouseDown={(event) => event.preventDefault()}
          onPointerDown={onPointerDown}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onPointerLeave={() => {
            setHoverContent(null);
            onHover(null);
          }}
        />
        {pageAnnotations.map((annotation) => {
          if (annotation.kind !== "patch") return null;
          const patch = annotation;
          const selected = patch.id === selectedId && tool === "select";
          const live = content.find((element) => element.id === patch.sourceId);
          // Untouched: the page's own words in the page's own look, still where the page put them.
          const changed = patchChanged(patch);
          const pristine = patch.role === "text" && !changed;
          // While a run is being edited its live text replaces the page's rendering, so what the
          // caret sits in is exactly what will be exported.
          const showLive = patch.role === "text" && (selected || !pristine);
          const delta = patch.w - patch.originW;
          const shiftTails = patch.role === "text" && !patch.wrap && !pristine && Math.abs(delta) >= 0.4;
          const baseCover = showLive
            ? editCover(patch)
            : { x: patch.originX, y: patch.originY, w: patch.originW, h: patch.originH };
          const underlineAt = patch.underlineOffset ?? -1;
          const cover =
            showLive && underlineAt >= 0
              ? { ...baseCover, h: Math.max(baseCover.h, patch.y + underlineAt + 1.4 - baseCover.y) }
              : baseCover;
          const offsets = patch.lineOffsets ?? [];
          const shifted = lineShift(offsets, offsets.length - 1);
          const rows = Math.max(1, Math.round((patch.h - patch.fontSize - shifted) / Math.max(patch.lineHeight, 1)) + 1);
          const editorWidth = patch.wrap
            ? blockWidth(patch)
            : Math.max(patch.w, patch.fontSize * 0.4) + patch.fontSize * 0.6;
          // The wrap slack widens the box to the right; centred and right-aligned lines are set
          // against the page's own width, so the box moves left to keep them in place.
          const slack = wrapSlack(patch);
          const slackShift = !patch.wrap ? 0 : patch.align === "center" ? slack / 2 : patch.align === "right" ? slack : 0;
          const overflowing = patch.role === "text" && patch.h > patch.originH + 1;
          const coverClass = [
            "content-cover",
            selected ? "selected" : "",
            showLive ? "" : "quiet",
            showLive && overflowing ? "overflowing" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const editorLabel = `Edit ${live ? contentLabel(live.kind).toLowerCase() : "text"}`;
          const editorStyle: CSSProperties = {
            left: (patch.x - slackShift) * scale,
            top: editorTop(patch, scale) * scale,
            width: editorWidth * scale,
            height: (rows * patch.lineHeight + shifted + patch.fontSize * 0.3) * scale,
            fontFamily: patch.fontFamily,
            fontWeight: patch.fontWeight,
            fontStyle: patch.fontStyle,
            fontSize: patch.fontSize * scale,
            lineHeight: `${patch.lineHeight * scale}px`,
            textAlign: patch.align,
            textIndent: Math.max(0, patch.indent) * scale,
            fontKerning: "none",
            fontVariantLigatures: "none",
            letterSpacing: `${patch.letterSpacing * scale}px`,
            wordSpacing: `${patch.wordSpacing * scale}px`,
            color: showLive ? patch.color : "transparent",
            caretColor: patch.color,
            whiteSpace: patch.wrap ? "pre-wrap" : "pre",
            overflowWrap: "normal",
            wordBreak: "normal",
            zIndex: selected ? 6 : 2,
            pointerEvents: selected ? "auto" : "none",
          };
          const registerEditor = (node: HTMLTextAreaElement | HTMLDivElement | null) => {
            if (!node) {
              textareas.current.delete(patch.id);
              return;
            }
            textareas.current.set(patch.id, node);
            if (armFocus.current !== patch.id) return;
            node.focus({ preventScroll: true });
            const mark = caretRef.current;
            const length = node instanceof HTMLTextAreaElement ? node.value.length : domText(node).length;
            const index = mark?.id === patch.id ? mark.index : length;
            const clamped = Math.max(0, Math.min(index, length));
            const from = mark?.id === patch.id && mark.from != null ? Math.max(0, Math.min(mark.from, clamped)) : null;
            if (node instanceof HTMLTextAreaElement) node.setSelectionRange(from ?? clamped, clamped);
            else if (from != null) selectRange(node, from, clamped);
            else placeCaret(node, clamped);
          };
          const handleEditorFocus = () => {
            // Content edits arm focus after an async capture, often once the pointer is already
            // up; clearing it here keeps a later click from handing focus back to this editor.
            if (armFocus.current === patch.id) armFocus.current = null;
            if (draftText.current?.id === patch.id) return;
            textBaseline.current = getAnnotations();
            epochOnFocus.current = getEpoch();
            onSelect(patch.id);
          };
          const handleEditorBlur = () => {
            const latest = getAnnotations().find((item) => item.id === patch.id);
            const source = contentRef.current.find((item) => item.id === patch.sourceId);
            const draft = draftText.current;
            const unchanged =
              !latest ||
              latest.kind !== "patch" ||
              (latest.text === (latest.originText || source?.text || "") &&
                !hasUserStyle(latest) &&
                Math.abs(latest.x - latest.originX) < 0.5 &&
                Math.abs(latest.y - latest.originY) < 0.5 &&
                (latest.wrapW == null || Math.abs(latest.wrapW - latest.originW) < 0.5));
            if (draft?.id === patch.id) {
              draftText.current = null;
              textBaseline.current = null;
              if (unchanged) {
                // Only this patch goes; anything else that changed since it was opened stays.
                onReplace(getAnnotations().filter((item) => item.id !== patch.id));
                onSelect(null);
                return;
              }
              onPushBaseline(draft.origin);
              return;
            }
            const baseline = textBaseline.current;
            textBaseline.current = null;
            if (baseline && getEpoch() === epochOnFocus.current) onPushBaseline(baseline);
          };
          // New text (and, for a mixed-face patch, its spans) re-laid inside the patch's box. The
          // first edit of a block turns the page's soft line breaks after it into spaces.
          const applyEdit = (value: string, spans: TextSpan[], measured: number) => {
            const current = getAnnotations();
            let shown = value;
            const next = current.map((item) => {
              if (item.id !== patch.id || item.kind !== "patch") return item;
              const flowed = softenBreaks(item, value, spans);
              shown = flowed.text;
              const styled = {
                ...item,
                spans: flowed.spans,
                softBreaks: flowed.softBreaks,
                lineGaps: flowed.lineGaps,
                lineOffsets: flowed.lineOffsets,
                lineIndents: flowed.lineIndents,
              };
              const rows = flowed.text === value ? measured : 0;
              return { ...styled, ...layoutTextPatch(styled, flowed.text, rows) };
            });
            onReplace(next);
            if (live) onSelectContent({ ...live, text: shown });
          };
          // Return in a single line starts a new line inside it: the line becomes a block that
          // wraps in its cell, or in its own width when nothing bounds it, and the caret moves to
          // the start of the new line once the block's editor has taken over.
          const breakLine = (node: HTMLElement) => {
            const current = getAnnotations();
            const item = current.find((entry): entry is PatchAnnotation => entry.id === patch.id && entry.kind === "patch");
            if (!item) return;
            const caret =
              node instanceof HTMLTextAreaElement
                ? (node.selectionEnd ?? item.text.length)
                : (selectionOffsets(node)?.end ?? item.text.length);
            const at = Math.max(0, Math.min(caret, item.text.length));
            const text = `${item.text.slice(0, at)}\n${item.text.slice(at)}`;
            const spans = item.spans.length > 0 ? editSpans(item.spans, at, at, "\n") : [];
            // A single line's pitch is its own height; the lines it breaks into need leading.
            const lineHeight = item.lineHeight < item.fontSize * 1.1 ? item.fontSize * 1.3 : item.lineHeight;
            const block: PatchAnnotation = {
              ...item,
              wrap: true,
              lineHeight,
              wrapW: wrapWidth(item, contentRef.current),
              spans,
              softBreaks: [],
              lineGaps: [],
              lineOffsets: [],
              lineIndents: [],
            };
            onReplace(current.map((entry) => (entry.id === item.id ? { ...block, ...layoutTextPatch(block, text, 0) } : entry)));
            if (live) onSelectContent({ ...live, text });
            caretRef.current = { id: item.id, index: at + 1 };
            armFocus.current = item.id;
            onRequestFocus(item.id);
          };
          // Sets the width the text wraps in, as one step of history.
          const setWidth = (width: number) => {
            const current = getAnnotations();
            const item = current.find((entry): entry is PatchAnnotation => entry.id === patch.id && entry.kind === "patch");
            if (!item) return;
            const resized = resizeTextPatch(item, width);
            if (Math.abs((resized.wrapW ?? 0) - (item.wrapW ?? item.originW)) < 0.01 && item.wrap) return;
            onReplace(current.map((entry) => (entry.id === item.id ? resized : entry)));
            if (draftText.current?.id !== patch.id) onPushBaseline(current);
          };
          const currentWidth = patch.wrap ? (patch.wrapW ?? patch.originW) : Math.max(patch.w, 1);
          const handleEditorKey = (event: ReactKeyboardEvent<HTMLElement>) => {
            if (event.key === "Enter" && !patch.wrap && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              event.stopPropagation();
              breakLine(event.currentTarget);
              return;
            }
            // Alt+Shift+Left/Right narrows or widens the box from the keyboard, four points a step.
            if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && event.altKey && event.shiftKey) {
              event.preventDefault();
              event.stopPropagation();
              setWidth(currentWidth + (event.key === "ArrowRight" ? 4 : -4));
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.currentTarget.blur();
              return;
            }
            // The usual formatting shortcuts, on the selection or the whole patch like the bar's buttons.
            if ((event.metaKey || event.ctrlKey) && !event.altKey) {
              const key = event.key.toLowerCase();
              const shortcut =
                key === "b" ? "bold" : key === "i" ? "italic" : key === "u" ? "underline" : key === "x" && event.shiftKey ? "strike" : null;
              if (shortcut) {
                event.preventDefault();
                event.stopPropagation();
                const current = formatAt(patch, formatRange.current, traits);
                applyFormat({ [shortcut]: !current[shortcut] });
                return;
              }
            }
            event.stopPropagation();
          };
          // The runs the user changed, lit up under the glyphs; a patch only moved, resized or
          // restyled, or a graphic one, gets a light tint over its whole box instead.
          const marks = changed && patch.role === "text" ? changedBoxes(patch) : [];
          const tint =
            changed && marks.length === 0
              ? patch.role === "text"
                ? { x: patch.x - slackShift, y: patch.y, w: editorWidth, h: Math.max(patch.h, patch.fontSize) }
                : { x: patch.x, y: patch.y, w: Math.max(patch.w, 1), h: Math.max(patch.h, 1) }
              : null;
          // Dragging the grip beside the box moves the text, so an edit that has grown past its
          // cell can be nudged back into it. The editor keeps the focus while the text moves.
          const startMove = (event: ReactPointerEvent<HTMLElement>) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            event.preventDefault();
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // A very fast click can release the pointer before capture.
            }
            frameRef.current?.classList.add("interacting");
            dragRef.current = { type: "move", origin: getAnnotations(), id: patch.id, start: toPoint(event), moved: false };
          };
          // Dragging the handle on the box's right edge changes the width the text wraps in; a
          // single line becomes a block, so it stays on one line while the width allows and wraps
          // when narrowed.
          const startWidth = (event: ReactPointerEvent<HTMLElement>) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            event.preventDefault();
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // A very fast click can release the pointer before capture.
            }
            frameRef.current?.classList.add("interacting");
            dragRef.current = {
              type: "width",
              origin: getAnnotations(),
              id: patch.id,
              start: toPoint(event),
              startWidth: currentWidth,
              moved: false,
            };
          };
          const handleWidthKey = (event: ReactKeyboardEvent<HTMLElement>) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            event.stopPropagation();
            const step = event.shiftKey ? 10 : 1;
            setWidth(currentWidth + (event.key === "ArrowRight" ? step : -step));
          };
          return (
            <div key={patch.id} onPointerEnter={() => onHover(patch.id)} onPointerLeave={() => onHover(null)}>
              <div
                className={coverClass}
                style={{
                  left: cover.x * scale,
                  top: cover.y * scale,
                  width: cover.w * scale,
                  height: cover.h * scale,
                  background: showLive ? patch.backdrop || "#ffffff" : undefined,
                }}
              />
              {shiftTails &&
                (patch.tails ?? []).map((tail, index) => (
                  <img
                    key={`${patch.id}-tail-${index}`}
                    className="content-tail"
                    alt=""
                    src={tail.image}
                    style={{
                      left: (tail.x + delta) * scale,
                      top: tail.y * scale,
                      width: tail.w * scale,
                      height: (tail.h + tail.padBottom) * scale,
                    }}
                  />
                ))}
              {marks.map((box, index) => (
                <div
                  key={`${patch.id}-change-${index}`}
                  className="change-mark"
                  aria-hidden="true"
                  style={{ left: box.x * scale, top: box.y * scale, width: box.w * scale, height: box.h * scale }}
                />
              ))}
              {patch.role === "graphic" && patch.image ? (
                <img
                  className={selected ? "content-graphic selected" : "content-graphic"}
                  alt=""
                  src={patch.image}
                  style={{
                    left: patch.x * scale,
                    top: patch.y * scale,
                    width: Math.max(patch.w, 1) * scale,
                    height: Math.max(patch.h, 1) * scale,
                  }}
                />
              ) : patch.spans.length > 0 || patch.wrap ? (
                <SpanEditor
                  patch={patch}
                  scale={scale}
                  selected={selected}
                  showLive={showLive}
                  label={editorLabel}
                  style={editorStyle}
                  register={(node) => registerEditor(node)}
                  onFocus={handleEditorFocus}
                  onBlur={handleEditorBlur}
                  onKeyDown={handleEditorKey}
                  onEdit={(text, spans, measured) => applyEdit(text, spans, patch.wrap ? measured : 0)}
                />
              ) : (
                <textarea
                  data-kind="content"
                  data-id={patch.id}
                  ref={(node) => registerEditor(node)}
                  className="content-editor"
                  value={patch.text}
                  rows={1}
                  spellCheck={false}
                  readOnly={!selected}
                  aria-label={editorLabel}
                  style={editorStyle}
                  onFocus={handleEditorFocus}
                  onBlur={handleEditorBlur}
                  onChange={(event) => {
                    const node = event.target;
                    const value = node.value;
                    let measured = 0;
                    if (patch.wrap) {
                      // The browser's own wrapping decides how many lines the block really needs.
                      const height = node.style.height;
                      node.style.height = "0px";
                      measured = Math.round(node.scrollHeight / Math.max(patch.lineHeight * scale, 1));
                      node.style.height = height;
                    }
                    applyEdit(value, patch.spans, measured);
                  }}
                  onKeyDown={handleEditorKey}
                />
              )}
              {tint && (
                <div
                  className="change-tint"
                  aria-hidden="true"
                  style={{ left: tint.x * scale, top: tint.y * scale, width: tint.w * scale, height: tint.h * scale }}
                />
              )}
              {selected && patch.role === "text" && (
                <PatchFormat
                  patch={patch}
                  scale={scale}
                  editorOf={editorOf}
                  traits={traits}
                  rangeRef={formatRange}
                  begin={beginFormat}
                  apply={applyFormat}
                  end={endFormat}
                  onState={onFormatState}
                  register={registerFormat}
                />
              )}
              {selected && patch.role === "text" && (
                <div
                  className="content-grip"
                  role="button"
                  aria-label="Move text"
                  title="Drag to move the text"
                  style={{
                    left: (patch.x - slackShift) * scale - 18,
                    top: (patch.y + patch.fontSize * 0.5) * scale - 8,
                  }}
                  onPointerDown={startMove}
                  onPointerMove={moveDrag}
                  onPointerUp={finishDrag}
                  onPointerCancel={finishDrag}
                >
                  <GripVertical size={11} strokeWidth={2.25} aria-hidden="true" />
                </div>
              )}
              {selected && patch.role === "text" && (
                <div
                  className="content-grip resize"
                  role="slider"
                  tabIndex={-1}
                  aria-label="Width of the text box"
                  aria-valuenow={Math.round(currentWidth)}
                  aria-valuemin={Math.round(Math.max(12, patch.fontSize * 3))}
                  title="Drag to change the width the text wraps in"
                  style={{
                    left: (patch.x - slackShift + (patch.wrap ? blockWidth(patch) : Math.max(patch.w, 1))) * scale + 4,
                    top: (patch.y + patch.fontSize * 0.5) * scale - 8,
                  }}
                  onPointerDown={startWidth}
                  onPointerMove={moveDrag}
                  onPointerUp={finishDrag}
                  onPointerCancel={finishDrag}
                  onKeyDown={handleWidthKey}
                >
                  <ChevronsLeftRight size={11} strokeWidth={2.25} aria-hidden="true" />
                </div>
              )}
            </div>
          );
        })}
        {tool === "select" &&
          content
            .filter((element) => {
              if (element.id !== hoverContent && element.id !== selectedContent?.id) return false;
              return !annotations.some(
                (item) => item.kind === "patch" && item.id === selectedId && item.sourceId === element.id,
              );
            })
            .slice(0, 2)
            .map((element) => {
              const beside = baseWidth - (element.x + element.w) > 64;
              return (
                <div
                  key={`${element.id}-tag`}
                  className="content-tag"
                  style={{
                    left: (beside ? element.x + element.w : element.x) * scale + 4,
                    top: element.y * scale,
                  }}
                >
                  {contentLabel(element.kind)}
                </div>
              );
            })}
        {hoverId !== null &&
          pageAnnotations.map((annotation) => {
            if (annotation.id !== hoverId) return null;
            if (annotation.kind === "text" && annotation.text.length === 0 && annotation.id !== selectedId) return null;
            const box = boundsOf(annotation);
            const pad =
              annotation.kind === "text" ||
              annotation.kind === "emoji" ||
              annotation.kind === "signature" ||
              annotation.kind === "patch"
                ? 4
                : annotation.strokeWidth / 2 + 4;
            const number = objectNumbers.get(annotation.id);
            return (
              <div
                key={`${annotation.id}-glow`}
                className="object-glow"
                data-object-id={annotation.id}
                aria-hidden="true"
                style={{
                  left: (box.x - pad) * scale,
                  top: (box.y - pad) * scale,
                  width: Math.max(box.w + pad * 2, 1) * scale,
                  height: Math.max(box.h + pad * 2, 1) * scale,
                }}
              >
                {number !== undefined && <span className="object-badge">{number}</span>}
              </div>
            );
          })}
        {pageAnnotations.map((annotation) => {
          if (annotation.id !== selectedId || annotation.kind === "text") return null;
          if (annotation.kind === "patch" && (annotation.role !== "graphic" || tool !== "select")) return null;
          if (tool !== "select" && tool !== "shape" && tool !== "emoji" && tool !== "signature") return null;
          const box = boundsOf(annotation);
          const pad =
            annotation.kind === "emoji" || annotation.kind === "signature" || annotation.kind === "patch"
              ? 4
              : annotation.strokeWidth / 2 + 4;
          const startResize = (event: ReactPointerEvent<HTMLElement>, handle: Handle) => {
            event.stopPropagation();
            event.preventDefault();
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // A very fast click can release the pointer before capture.
            }
            dragRef.current = {
              type: "resize",
              origin: getAnnotations(),
              id: annotation.id,
              handle,
              start: toPoint(event),
              box,
            };
          };
          return (
            <div
              key={`${annotation.id}-handles`}
              className="shape-box"
              onPointerEnter={() => onHover(annotation.id)}
              onPointerLeave={() => onHover(null)}
              style={{
                left: (box.x - pad) * scale,
                top: (box.y - pad) * scale,
                width: Math.max(box.w + pad * 2, 1) * scale,
                height: Math.max(box.h + pad * 2, 1) * scale,
              }}
            >
              {(["n", "e", "s", "w"] as const).map((edge) => (
                <div
                  key={edge}
                  className={`edge edge-${edge}`}
                  aria-label={`Resize ${edge}`}
                  onPointerDown={(event) => startResize(event, edge)}
                  onPointerMove={moveDrag}
                  onPointerUp={finishDrag}
                />
              ))}
              {HANDLES.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  className={`handle ${handle}`}
                  aria-label={`Resize ${handle}`}
                  onPointerDown={(event) => startResize(event, handle)}
                  onPointerMove={moveDrag}
                  onPointerUp={finishDrag}
                />
              ))}
            </div>
          );
        })}
        {pageAnnotations.map((annotation) => {
          if (annotation.id !== selectedId || tool === "eraser" || tool === "pencil" || annotation.kind === "patch") return null;
          if (annotation.kind === "text" && annotation.text.length === 0) return null;
          const gap = 22 / scale;
          const center = boundsOf(annotation);
          let anchor: Point;
          if (annotation.kind === "line" || annotation.kind === "ink") {
            anchor = { x: center.x + center.w / 2, y: center.y - gap };
          } else if (annotation.kind === "text") {
            const width = annotation.autoWidth ? measureTextWidth(annotation) : annotation.width;
            const height = annotation.height ?? annotation.fontSize * 1.2;
            const cx = annotation.x + width / 2;
            const cy = annotation.y + height / 2;
            const top = rotatePoint(cx, annotation.y, cx, cy, annotation.rotation);
            const dx = top.x - cx;
            const dy = top.y - cy;
            const reach = Math.hypot(dx, dy);
            anchor =
              reach < 1
                ? { x: cx, y: cy - gap }
                : { x: top.x + (dx / reach) * gap, y: top.y + (dy / reach) * gap };
          } else {
            const cx = annotation.x + annotation.w / 2;
            const cy = annotation.y + annotation.h / 2;
            const top = rotatePoint(cx, annotation.y, cx, cy, annotation.rotation);
            const dx = top.x - cx;
            const dy = top.y - cy;
            const reach = Math.hypot(dx, dy);
            anchor =
              reach < 1
                ? { x: cx, y: cy - gap }
                : { x: top.x + (dx / reach) * gap, y: top.y + (dy / reach) * gap };
          }
          const startRotate = (event: ReactPointerEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            event.preventDefault();
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // A very fast click can release the pointer before capture.
            }
            const point = toPoint(event);
            const startAngle = Math.atan2(
              point.y - (center.y + center.h / 2),
              point.x - (center.x + center.w / 2),
            );
            dragRef.current = {
              type: "rotate",
              origin: getAnnotations(),
              id: annotation.id,
              center: { x: center.x + center.w / 2, y: center.y + center.h / 2 },
              startAngle,
              unwrapped: startAngle,
            };
          };
          return (
            <button
              key={`${annotation.id}-rotate`}
              type="button"
              className="rotate-handle"
              aria-label="Rotate"
              style={{ left: anchor.x * scale, top: anchor.y * scale }}
              onPointerDown={startRotate}
              onPointerMove={moveDrag}
              onPointerUp={finishDrag}
            >
              <RotateCw />
            </button>
          );
        })}
        {guides.length > 0 && (
          <div className="align-guides" aria-hidden="true">
            <svg viewBox={`0 0 ${baseWidth} ${baseHeight}`}>
              {guides.map((guide) => (
                <line
                  key={`${guide.axis}-${guide.scope}-${guide.at}`}
                  className={`align-guide ${guide.scope}`}
                  x1={guide.axis === "x" ? guide.at : guide.from}
                  y1={guide.axis === "x" ? guide.from : guide.at}
                  x2={guide.axis === "x" ? guide.at : guide.to}
                  y2={guide.axis === "x" ? guide.to : guide.at}
                  vectorEffect="non-scaling-stroke"
                  shapeRendering="crispEdges"
                />
              ))}
            </svg>
            {guides.map((guide) => {
              // The label sits at the line's top (left) end, inside the page: it swings to the
              // other side of a line along the page's right or bottom edge.
              const vertical = guide.axis === "x";
              const flip = vertical ? guide.at > baseWidth - 56 / scale : guide.at > baseHeight - 24 / scale;
              const along = guide.from * scale + 4;
              const across = guide.at * scale + (flip ? -4 : 4);
              return (
                <span
                  key={`${guide.axis}-${guide.scope}-${guide.at}-tag`}
                  className={`align-guide-tag ${guide.scope}`}
                  style={{
                    left: vertical ? across : along,
                    top: vertical ? along : across,
                    transform: flip ? (vertical ? "translateX(-100%)" : "translateY(-100%)") : undefined,
                  }}
                >
                  {guide.scope === "page" ? "Page" : "Section"}
                </span>
              );
            })}
          </div>
        )}
      </div>
      </div>
      <span className="page-number">Page {pageIndex + 1}</span>
    </div>
  );
}
