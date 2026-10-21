import type { BoxShapeKind } from "./shapes.ts";
import type { Annotation, Point, TextAnnotation } from "./types.ts";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function translate(annotation: Annotation, dx: number, dy: number): Annotation {
  if (dx === 0 && dy === 0) return annotation;
  switch (annotation.kind) {
    case "ink":
      return {
        ...annotation,
        points: annotation.points.map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        })),
      };
    case "line":
      return {
        ...annotation,
        x1: annotation.x1 + dx,
        y1: annotation.y1 + dy,
        x2: annotation.x2 + dx,
        y2: annotation.y2 + dy,
      };
    default:
      return { ...annotation, x: annotation.x + dx, y: annotation.y + dy };
  }
}

export function shapeFromDrag(
  kind: BoxShapeKind,
  page: number,
  id: string,
  color: string,
  strokeWidth: number,
  fill: string | null,
  fillOpacity: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Annotation {
  return {
    id,
    page,
    kind,
    color,
    strokeWidth,
    fill,
    fillOpacity,
    rotation: 0,
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

export function rotatePoint(x: number, y: number, cx: number, cy: number, degrees: number): Point {
  const rad = (degrees * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

type Box = { x: number; y: number; w: number; h: number };
type Frame = { x1: number; y1: number; x2: number; y2: number };

function draggedFrame(box: Box, handle: string, dx: number, dy: number): Frame {
  return {
    x1: box.x + (handle.includes("w") ? dx : 0),
    y1: box.y + (handle.includes("n") ? dy : 0),
    x2: box.x + box.w + (handle.includes("e") ? dx : 0),
    y2: box.y + box.h + (handle.includes("s") ? dy : 0),
  };
}

function normalized(frame: Frame, min: number): Box {
  let x1 = frame.x1;
  let y1 = frame.y1;
  let x2 = frame.x2;
  let y2 = frame.y2;
  if (Math.abs(x2 - x1) < min) {
    if (x2 >= x1) x2 = x1 + min;
    else x1 = x2 + min;
  }
  if (Math.abs(y2 - y1) < min) {
    if (y2 >= y1) y2 = y1 + min;
    else y1 = y2 + min;
  }
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

function scaleAxis(value: number, start: number, size: number, next: number, nextSize: number) {
  if (size < 0.5) return next + nextSize / 2;
  return next + ((value - start) / size) * nextSize;
}

function resizeLine(
  line: Extract<Annotation, { kind: "line" }>,
  from: Box,
  handle: string,
  frame: Frame,
): Annotation {
  const moveX = handle.includes("e") || handle.includes("w");
  const moveY = handle.includes("n") || handle.includes("s");
  const edgeX = handle.includes("w") ? frame.x1 : frame.x2;
  const edgeY = handle.includes("n") ? frame.y1 : frame.y2;
  const originX = handle.includes("w") ? from.x : handle.includes("e") ? from.x + from.w : from.x + from.w / 2;
  const originY = handle.includes("n") ? from.y : handle.includes("s") ? from.y + from.h : from.y + from.h / 2;
  const dist1 = Math.hypot(line.x1 - originX, line.y1 - originY);
  const dist2 = Math.hypot(line.x2 - originX, line.y2 - originY);
  const tied = Math.abs(dist1 - dist2) <= 1;
  const side = handle.length === 1;

  const nextPoint = (x: number, y: number, index: 1 | 2) => {
    const closer = index === 1 ? dist1 <= dist2 : dist2 < dist1;
    if (tied && side) {
      return {
        x: moveX ? x + (edgeX - originX) : x,
        y: moveY ? y + (edgeY - originY) : y,
      };
    }
    if ((tied && index === 2) || (!tied && closer)) {
      return {
        x: moveX ? edgeX : x,
        y: moveY ? edgeY : y,
      };
    }
    return { x, y };
  };

  const start = nextPoint(line.x1, line.y1, 1);
  const end = nextPoint(line.x2, line.y2, 2);
  return { ...line, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

export function resizeAnnotation(
  annotation: Annotation,
  from: Box,
  handle: string,
  dx: number,
  dy: number,
): Annotation {
  const frame = draggedFrame(from, handle, dx, dy);
  if (annotation.kind === "line") return resizeLine(annotation, from, handle, frame);
  if (annotation.kind === "ink") {
    const next = normalized(frame, 0);
    return {
      ...annotation,
      points: annotation.points.map((point) => ({
        x: scaleAxis(point.x, from.x, from.w, next.x, next.w),
        y: scaleAxis(point.y, from.y, from.h, next.y, next.h),
      })),
    };
  }
  if (annotation.kind === "text") return annotation;
  const next = normalized(frame, 2);
  const rotation = ((annotation.rotation % 360) + 360) % 360;
  if (rotation === 90 || rotation === 270) {
    const cx = next.x + next.w / 2;
    const cy = next.y + next.h / 2;
    return { ...annotation, x: cx - next.h / 2, y: cy - next.w / 2, w: next.h, h: next.w };
  }
  return { ...annotation, x: next.x, y: next.y, w: next.w, h: next.h };
}

function rotatedBounds(x: number, y: number, w: number, h: number, degrees: number): Box {
  const rotation = ((degrees % 360) + 360) % 360;
  if (rotation === 0 || w === 0 || h === 0) return { x, y, w, h };
  const cx = x + w / 2;
  const cy = y + h / 2;
  const corners = [
    rotatePoint(x, y, cx, cy, rotation),
    rotatePoint(x + w, y, cx, cy, rotation),
    rotatePoint(x, y + h, cx, cy, rotation),
    rotatePoint(x + w, y + h, cx, cy, rotation),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

function scaleFromBox(annotation: Annotation, from: Box, to: Box): Annotation {
  const sx = to.w / Math.max(from.w, 0.001);
  const sy = to.h / Math.max(from.h, 0.001);
  const mapPoint = (px: number, py: number) => ({
    x: to.x + (px - from.x) * sx,
    y: to.y + (py - from.y) * sy,
  });
  if (annotation.kind === "line") {
    const start = mapPoint(annotation.x1, annotation.y1);
    const end = mapPoint(annotation.x2, annotation.y2);
    return { ...annotation, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  }
  if (annotation.kind === "ink") {
    return { ...annotation, points: annotation.points.map((point) => mapPoint(point.x, point.y)) };
  }
  if (annotation.kind === "text") {
    const origin = mapPoint(annotation.x, annotation.y);
    return {
      ...annotation,
      x: origin.x,
      y: origin.y,
      width: Math.max(16, annotation.width * sx),
      height: annotation.height == null ? null : Math.max(12, annotation.height * sy),
      fontSize: Math.min(200, Math.max(8, annotation.fontSize * sx)),
      autoWidth: false,
    };
  }
  const center = mapPoint(annotation.x + annotation.w / 2, annotation.y + annotation.h / 2);
  const w = Math.max(2, annotation.w * sx);
  const h = Math.max(2, annotation.h * sy);
  return { ...annotation, x: center.x - w / 2, y: center.y - h / 2, w, h };
}

export function rotateBy(annotation: Annotation, degrees: number): Annotation {
  if (degrees === 0) return annotation;
  if (annotation.kind === "line") {
    const box = boundsOf(annotation);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const start = rotatePoint(annotation.x1, annotation.y1, cx, cy, degrees);
    const end = rotatePoint(annotation.x2, annotation.y2, cx, cy, degrees);
    return { ...annotation, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  }
  if (annotation.kind === "ink") {
    const box = boundsOf(annotation);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    return {
      ...annotation,
      points: annotation.points.map((point) => rotatePoint(point.x, point.y, cx, cy, degrees)),
    };
  }
  const next = annotation.rotation + degrees;
  return { ...annotation, rotation: ((next % 360) + 360) % 360 };
}

export function rotateClockwise(annotation: Annotation): Annotation {
  if (annotation.kind === "line") {
    const box = boundsOf(annotation);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const start = rotatePoint(annotation.x1, annotation.y1, cx, cy, 90);
    const end = rotatePoint(annotation.x2, annotation.y2, cx, cy, 90);
    return { ...annotation, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  }
  if (annotation.kind === "ink") {
    const box = boundsOf(annotation);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    return {
      ...annotation,
      points: annotation.points.map((point) => rotatePoint(point.x, point.y, cx, cy, 90)),
    };
  }
  return { ...annotation, rotation: (((annotation.rotation ?? 0) + 90) % 360) };
}

export function fitAnnotation(
  annotation: Annotation,
  pageWidth: number,
  pageHeight: number,
  axis: "width" | "height",
): Annotation {
  const box = boundsOf(annotation);
  const span = axis === "width" ? box.w : box.h;
  if (span < 0.5 || pageWidth < 1 || pageHeight < 1) return annotation;
  const scale = (axis === "width" ? pageWidth : pageHeight) / span;
  const w = box.w * scale;
  const h = box.h * scale;
  const x = axis === "width" ? 0 : clamp(box.x + box.w / 2 - w / 2, 0, Math.max(0, pageWidth - w));
  const y = axis === "height" ? 0 : clamp(box.y + box.h / 2 - h / 2, 0, Math.max(0, pageHeight - h));
  return scaleFromBox(annotation, box, { x, y, w, h });
}

export function boundsOf(annotation: Annotation): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  switch (annotation.kind) {
    case "ink": {
      const xs = annotation.points.map((point) => point.x);
      const ys = annotation.points.map((point) => point.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return {
        x,
        y,
        w: Math.max(...xs) - x,
        h: Math.max(...ys) - y,
      };
    }
    case "line":
      return {
        x: Math.min(annotation.x1, annotation.x2),
        y: Math.min(annotation.y1, annotation.y2),
        w: Math.abs(annotation.x2 - annotation.x1),
        h: Math.abs(annotation.y2 - annotation.y1),
      };
    case "text":
      return rotatedBounds(
        annotation.x,
        annotation.y,
        annotation.width,
        annotation.height ?? estimateTextHeight(annotation),
        annotation.rotation ?? 0,
      );
    case "patch":
      return { x: annotation.x, y: annotation.y, w: annotation.w, h: annotation.h };
    default:
      return rotatedBounds(annotation.x, annotation.y, annotation.w, annotation.h, annotation.rotation ?? 0);
  }
}

function estimateTextHeight(annotation: TextAnnotation): number {
  const charWidth = annotation.fontSize * (annotation.fontId === "courier" ? 0.6 : 0.52);
  const perLine = Math.max(1, Math.floor(annotation.width / charWidth));
  const lines = annotation.text.split("\n").reduce((count, line) => {
    return count + Math.max(1, Math.ceil(line.length / perLine));
  }, 0);
  return Math.max(annotation.fontSize * 1.2, lines * annotation.fontSize * 1.2);
}

export function hitTest(
  annotations: Annotation[],
  page: number,
  point: Point,
  textBox?: (annotation: TextAnnotation) => { x: number; y: number; w: number; h: number } | null,
): Annotation | null {
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (!annotation || annotation.page !== page) continue;
    if (hits(annotation, point, textBox)) return annotation;
  }
  return null;
}

function hits(
  annotation: Annotation,
  point: Point,
  textBox?: (annotation: TextAnnotation) => { x: number; y: number; w: number; h: number } | null,
): boolean {
  if (annotation.kind === "patch") {
    const pad = 6;
    const x = Math.min(annotation.x, annotation.originX) - pad;
    const y = Math.min(annotation.y, annotation.originY) - pad;
    const right = Math.max(annotation.x + annotation.w, annotation.originX + annotation.originW) + pad;
    const bottom = Math.max(annotation.y + annotation.h, annotation.originY + annotation.originH) + pad;
    return point.x >= x && point.y >= y && point.x <= right && point.y <= bottom;
  }
  const slop =
    annotation.kind === "text" || annotation.kind === "emoji" || annotation.kind === "signature"
      ? 6
      : annotation.strokeWidth / 2 + 6;
  let tested = point;
  if (annotation.kind !== "text" && annotation.kind !== "ink" && annotation.kind !== "line" && annotation.rotation) {
    const cx = annotation.x + annotation.w / 2;
    const cy = annotation.y + annotation.h / 2;
    tested = rotatePoint(point.x, point.y, cx, cy, -annotation.rotation);
  }
  if (annotation.kind === "text") {
    const box = textBox?.(annotation) ?? boundsOf(annotation);
    return (
      point.x >= box.x - slop &&
      point.y >= box.y - slop &&
      point.x <= box.x + box.w + slop &&
      point.y <= box.y + box.h + slop
    );
  }
  if (annotation.kind === "ink") {
    const points = annotation.points;
    if (points.length === 1) {
      const only = points[0];
      return only ? dist(point.x, point.y, only.x, only.y) <= slop : false;
    }
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      if (!previous || !current) continue;
      if (
        distToSegment(point.x, point.y, previous.x, previous.y, current.x, current.y) <=
        slop
      ) {
        return true;
      }
    }
    return false;
  }
  if (annotation.kind === "line") {
    return (
      distToSegment(point.x, point.y, annotation.x1, annotation.y1, annotation.x2, annotation.y2) <=
      slop
    );
  }
  if (annotation.kind === "ellipse") {
    const rx = Math.max(annotation.w / 2, 1);
    const ry = Math.max(annotation.h / 2, 1);
    const cx = annotation.x + annotation.w / 2;
    const cy = annotation.y + annotation.h / 2;
    const nx = (tested.x - cx) / (rx + slop);
    const ny = (tested.y - cy) / (ry + slop);
    return nx * nx + ny * ny <= 1;
  }
  return (
    tested.x >= annotation.x - slop &&
    tested.y >= annotation.y - slop &&
    tested.x <= annotation.x + annotation.w + slop &&
    tested.y <= annotation.y + annotation.h + slop
  );
}
