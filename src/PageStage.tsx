import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { RotateCw } from "lucide-react";
import { contentAt, contentLabel, isTextContent, readPageContent, type ContentElement } from "./content.ts";
import { caretAt, cropGraphic, editCover, graphicPatch, layoutTextPatch, sampleColor, textPatch } from "./contentEdit.ts";
import { captureEdit, indexAt, layoutPieces, offsetAt, stampChar } from "./glyphs.ts";
import { emojiSrc } from "./emojis.ts";
import { boundsOf, dist, hitTest, resizeAnnotation, rotateBy, rotatePoint, shapeFromDrag, translate } from "./geometry.ts";
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
  type TextStyle,
  type Tool,
} from "./types.ts";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

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
  | { type: "move"; origin: Annotation[]; id: string; start: Point; moved: boolean }
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

export function PageStage({
  page,
  pageIndex,
  pdfBytes,
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
}: {
  page: PDFPageProxy;
  pageIndex: number;
  pdfBytes: Uint8Array;
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
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const textBaseline = useRef<Annotation[] | null>(null);
  const draftText = useRef<{ id: string; origin: Annotation[] } | null>(null);
  const epochOnFocus = useRef(0);
  const textareas = useRef(new Map<string, HTMLTextAreaElement>());
  const armFocus = useRef<string | null>(null);
  const caretRef = useRef<{ id: string; index: number } | null>(null);
  const [seen, setSeen] = useState(pageIndex === 0);
  const [textCaret, setTextCaret] = useState<{ id: string; start: number; end: number } | null>(null);
  const [content, setContent] = useState<ContentElement[]>([]);
  const [hoverContent, setHoverContent] = useState<string | null>(null);
  const contentRef = useRef<ContentElement[]>([]);

  const focusText = (id: string) => {
    const element = textareas.current.get(id);
    if (!element) return;
    element.focus({ preventScroll: true });
    const caret = caretRef.current;
    const index = caret?.id === id ? caret.index : element.value.length;
    const clamped = Math.max(0, Math.min(index, element.value.length));
    element.setSelectionRange(clamped, clamped);
  };

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
    readPageContent(page, pageIndex, pdfBytes)
      .then((items) => {
        if (cancel) return;
        contentRef.current = items;
        setContent(items);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [page, pageIndex, pdfBytes, seen]);

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

  useEffect(() => {
    if (tool === "select" || tool === "text") return;
    for (const element of textareas.current.values()) {
      if (document.activeElement === element && element.dataset.kind === "content") element.blur();
    }
  }, [tool]);

  useEffect(() => {
    if (content.length === 0) return;
    let changed = false;
    const next = getAnnotations().map((annotation) => {
      if (annotation.kind !== "patch" || annotation.role !== "text") return annotation;
      const live = content.find((element) => element.id === annotation.sourceId);
      if (!live?.fontName || live.fontName === annotation.fontName) return annotation;
      changed = true;
      return { ...annotation, fontName: live.fontName, fallback: live.fallback || annotation.fallback };
    });
    if (changed) onReplace(next);
  }, [content, getAnnotations, onReplace]);

  useEffect(() => {
    for (const [id, element] of textareas.current) {
      const annotation = annotations.find((item) => item.id === id);
      if (!annotation || annotation.kind !== "text" || annotation.height != null) continue;
      fitTextarea(element);
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
    const armed = armFocus.current;
    if (armed) {
      requestAnimationFrame(() => {
        if (!textareas.current.has(armed)) return;
        focusText(armed);
        if (armFocus.current === armed) armFocus.current = null;
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

    if (drag.type === "move") {
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
    if (tool !== "select") return;
    const mark = hitTest(getAnnotations(), pageIndex, point, textBox);
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
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      if (!drag.moved && Math.hypot(dx, dy) < 1) return;
      drag.moved = true;
      const original = drag.origin.find((item) => item.id === drag.id);
      if (!original) return;
      onReplace(drag.origin.map((item) => (item.id === drag.id ? translate(original, dx, dy) : item)));
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
    caretRef.current = { id: patch.id, index: caretAt(patch.text, patch, point) };
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
    if (element.kind === "paragraph") {
      onSelectContent(element);
      return;
    }
    if (isTextContent(element.kind)) {
      let source = canvas;
      try {
        source = await detailCanvas(page);
      } catch {
        source = canvas;
      }
      const captured = captureEdit(source, element, contentRef.current, baseWidth, baseHeight);
      if (element.fontName) {
        try {
          await document.fonts.load(`${element.fontSize || element.h}px "${element.fontName}"`);
        } catch {
          // Glyph copies from the page still draw when the face cannot be parsed.
        }
      }
      const latest = getAnnotations();
      const again = latest.find((item) => item.kind === "patch" && item.sourceId === element.id);
      if (again && again.kind === "patch") {
        focusContentText(again, point, element);
        return;
      }
      const patch = textPatch(element, sampleColor(canvas, element, baseWidth, baseHeight), captured);
      draftText.current = { id: patch.id, origin: latest };
      onReplace([...latest, patch]);
      focusContentText(patch, point, element);
      return;
    }
    const image = cropGraphic(canvas, element, baseWidth, baseHeight);
    if (!image) {
      onSelectContent(element);
      return;
    }
    const patch = graphicPatch(element, image);
    onReplace([...current, patch]);
    onPushBaseline(current);
    onSelect(patch.id);
    onSelectContent(element);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement && active.dataset.kind === "content") active.blur();
    const current = settleOpenText();
    const point = toPoint(event);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A very fast click can release the pointer before capture. The tool still runs.
    }

    if (tool === "select") {
      const hit = hitTest(current, pageIndex, point, textBox);
      if (hit) {
        if (hit.kind === "patch" && hit.role === "text") {
          const source = contentRef.current.find((item) => item.id === hit.sourceId);
          if (source) focusContentText(hit, point, source);
          else {
            onSelect(hit.id);
            caretRef.current = { id: hit.id, index: caretAt(hit.text, hit, point) };
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
                  textDecoration: annotation.underline ? "underline" : "none",
                  textAlign: annotation.align,
                  whiteSpace: annotation.autoWidth ? "pre" : "pre-wrap",
                  overflowWrap: annotation.autoWidth ? "normal" : "anywhere",
                  height: annotation.height == null ? undefined : annotation.height * scale,
                  minHeight: annotation.fontSize * 1.2 * scale,
                  overflow: annotation.height == null ? "hidden" : "auto",
                  caretColor: annotation.color,
                }}
                onFocus={() => {
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
          onPointerLeave={() => setHoverContent(null)}
        />
        {pageAnnotations.map((annotation) => {
          if (annotation.kind !== "patch") return null;
          const patch = annotation;
          const selected = patch.id === selectedId && tool === "select";
          const live = content.find((element) => element.id === patch.sourceId);
          const fontName = live?.fontName || patch.fontName;
          const multiline = patch.text.includes("\n");
          const pristine = patch.role === "text" && patch.text === (patch.originText ?? "");
          const useGlyphs = patch.role === "text" && !pristine && !multiline && (patch.glyphs ?? []).length > 0;
          const pieces = useGlyphs ? layoutPieces(patch, patch.text) : [];
          const delta = patch.w - patch.originW;
          const shiftTails = patch.role === "text" && !pristine && Math.abs(delta) >= 0.4;
          const baseCover = pristine
            ? { x: patch.originX, y: patch.originY, w: patch.originW, h: patch.originH }
            : editCover(patch);
          const underlineAt = patch.underlineOffset ?? -1;
          const cover =
            !pristine && underlineAt >= 0
              ? { ...baseCover, h: Math.max(baseCover.h, patch.y + underlineAt + 1.4 - baseCover.y) }
              : baseCover;
          const caret = textCaret?.id === patch.id ? textCaret : null;
          const rememberCaret = (node: HTMLTextAreaElement) => {
            setTextCaret({ id: patch.id, start: node.selectionStart ?? 0, end: node.selectionEnd ?? 0 });
          };
          return (
            <div key={patch.id}>
              <div
                className={selected ? `content-cover selected${pristine ? " quiet" : ""}` : `content-cover${pristine ? " quiet" : ""}`}
                style={{
                  left: cover.x * scale,
                  top: cover.y * scale,
                  width: cover.w * scale,
                  height: cover.h * scale,
                  background: pristine ? undefined : patch.backdrop || "#ffffff",
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
              ) : (
                <>
                  {useGlyphs && (
                    <div
                      className="content-glyphs"
                      style={{ left: patch.x * scale, top: patch.y * scale, width: Math.max(patch.w, 1) * scale, height: patch.h * scale }}
                    >
                      {pieces.map((piece, index) =>
                        piece.glyph ? (
                          <img
                            key={`${piece.char}-${index}`}
                            alt=""
                            src={piece.glyph.src}
                            style={{
                              left: piece.x * scale,
                              width: piece.glyph.w * scale,
                              height: patch.h * scale,
                            }}
                          />
                        ) : piece.char.trim() ? (
                          <img
                            key={`${piece.char}-${index}`}
                            alt=""
                            src={stampChar(piece.char, fontName, patch.fontSize, patch.color, patch.h, patch.ascent)}
                            style={{
                              left: piece.x * scale,
                              width: piece.advance * scale,
                              height: patch.h * scale,
                            }}
                          />
                        ) : null,
                      )}
                      {patch.underlineOffset >= 0 && (
                        <div
                          className="content-underline"
                          style={{
                            top: patch.underlineOffset * scale,
                            width: Math.max(patch.w, 1) * scale,
                            height: Math.max(1, 0.7 * scale),
                            background: patch.underlineColor || patch.color,
                          }}
                        />
                      )}
                    </div>
                  )}
                  {selected && useGlyphs && caret && (
                    <>
                      {caret.start !== caret.end && (
                        <div
                          className="content-selection"
                          style={{
                            left: (patch.x + offsetAt(pieces, Math.min(caret.start, caret.end))) * scale,
                            top: patch.y * scale,
                            width: Math.abs(offsetAt(pieces, caret.end) - offsetAt(pieces, caret.start)) * scale,
                            height: patch.h * scale,
                          }}
                        />
                      )}
                      <div
                        className="content-caret"
                        style={{
                          left: (patch.x + offsetAt(pieces, caret.end)) * scale,
                          top: patch.y * scale,
                          height: patch.h * scale,
                          background: patch.color,
                        }}
                      />
                    </>
                  )}
                  <textarea
                    data-kind="content"
                    data-id={patch.id}
                    ref={(node) => {
                      if (node) {
                        textareas.current.set(patch.id, node);
                        if (armFocus.current === patch.id) {
                          node.focus({ preventScroll: true });
                          const mark = caretRef.current;
                          const index = mark?.id === patch.id ? mark.index : node.value.length;
                          const clamped = Math.max(0, Math.min(index, node.value.length));
                          node.setSelectionRange(clamped, clamped);
                        }
                      } else textareas.current.delete(patch.id);
                    }}
                    className="content-editor"
                    value={patch.text}
                    rows={1}
                    spellCheck={false}
                    readOnly={!selected}
                    aria-label={`Edit ${live ? contentLabel(live.kind).toLowerCase() : "text"}`}
                    style={{
                      left: patch.x * scale,
                      top: patch.y * scale,
                      width: Math.max(pristine ? patch.originW : patch.w, patch.fontSize * 0.4) * scale,
                      height: Math.max(patch.h, patch.fontSize) * scale,
                      fontFamily: `"${fontName}"`,
                      fontWeight: 400,
                      fontStyle: "normal",
                      fontSynthesis: "none",
                      fontSize: patch.fontSize * scale,
                      lineHeight: `${patch.lineHeight * scale}px`,
                      color: pristine || useGlyphs ? "transparent" : patch.color,
                      caretColor: useGlyphs ? "transparent" : patch.color,
                      whiteSpace: multiline ? "pre-wrap" : "pre",
                      zIndex: selected ? 6 : 2,
                      pointerEvents: selected ? "auto" : "none",
                    }}
                    onFocus={() => {
                      if (draftText.current?.id === patch.id) return;
                      textBaseline.current = getAnnotations();
                      epochOnFocus.current = getEpoch();
                      onSelect(patch.id);
                    }}
                    onBlur={() => {
                      const latest = getAnnotations().find((item) => item.id === patch.id);
                      const source = contentRef.current.find((item) => item.id === patch.sourceId);
                      const draft = draftText.current;
                      const unchanged =
                        !latest ||
                        latest.kind !== "patch" ||
                        (latest.text === (latest.originText || source?.text || "") &&
                          Math.abs(latest.x - latest.originX) < 0.5 &&
                          Math.abs(latest.y - latest.originY) < 0.5);
                      if (draft?.id === patch.id) {
                        draftText.current = null;
                        textBaseline.current = null;
                        if (unchanged) {
                          onReplace(draft.origin);
                          onSelect(null);
                          return;
                        }
                        onPushBaseline(draft.origin);
                        return;
                      }
                      const baseline = textBaseline.current;
                      textBaseline.current = null;
                      if (baseline && getEpoch() === epochOnFocus.current) onPushBaseline(baseline);
                    }}
                    onSelect={(event) => rememberCaret(event.currentTarget)}
                    onPointerDown={(event) => {
                      if (!useGlyphs) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      const local = (event.clientX - rect.left) / scale;
                      const index = indexAt(pieces, local);
                      const node = event.currentTarget;
                      requestAnimationFrame(() => node.setSelectionRange(index, index));
                    }}
                    onChange={(event) => {
                      const value = event.target.value;
                      const current = getAnnotations();
                      const next = current.map((item) => {
                        if (item.id !== patch.id || item.kind !== "patch") return item;
                        const laid = layoutTextPatch({ ...item, fontName }, value);
                        return { ...item, ...laid, fontName };
                      });
                      onReplace(next);
                      rememberCaret(event.currentTarget);
                      if (live) onSelectContent({ ...live, text: value });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !multiline) {
                        event.preventDefault();
                        event.currentTarget.blur();
                        return;
                      }
                      event.stopPropagation();
                    }}
                    onKeyUp={(event) => rememberCaret(event.currentTarget)}
                  />
                </>
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
      </div>
      </div>
      <span className="page-number">Page {pageIndex + 1}</span>
    </div>
  );
}
