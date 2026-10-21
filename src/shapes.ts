import type { Annotation, Point, ShapeAnnotation } from "./types.ts";

export const BOX_KINDS = [
  "rect",
  "roundRect",
  "ellipse",
  "triangle",
  "triangleLeft",
  "triangleRight",
  "triangleDown",
  "rightTriangle",
  "diamond",
  "parallelogram",
  "trapezoid",
  "pentagon",
  "hexagon",
  "heptagon",
  "octagon",
  "nonagon",
  "decagon",
  "star",
  "star4",
  "star6",
  "star8",
  "burst",
  "blockArrow",
  "arrowLeft",
  "arrowUp",
  "arrowDown",
  "arrowBothH",
  "arrowBothV",
  "quadArrow",
  "bentArrow",
  "notchedArrow",
  "chevron",
  "chevronLeft",
  "chevronUp",
  "chevronDown",
  "heart",
  "plus",
  "cross",
  "check",
  "pill",
  "cloud",
  "lightning",
  "moon",
  "sun",
  "speech",
  "speechOval",
  "thought",
  "note",
  "callout",
  "bookmark",
  "flag",
  "pin",
  "cylinder",
  "cube",
  "shield",
  "document",
  "delay",
  "display",
  "manualInput",
  "storedData",
  "curve",
  "arc",
  "wave",
  "curvedArrow",
  "elbow",
  "elbowArrow",
  "bracket",
  "brace",
] as const;

const OPEN_KINDS = new Set<string>([
  "curve",
  "arc",
  "wave",
  "curvedArrow",
  "elbow",
  "elbowArrow",
  "bracket",
  "brace",
]);

export function isOpenShape(kind: string): boolean {
  return OPEN_KINDS.has(kind);
}

export type BoxShapeKind = (typeof BOX_KINDS)[number];

export type ShapeId = "line" | "arrow" | "doubleArrow" | BoxShapeKind;

export type LineHead = "none" | "end" | "both";

export const SHAPE_LABEL: Record<ShapeId, string> = {
  line: "Line",
  arrow: "Arrow",
  doubleArrow: "Double arrow",
  rect: "Rectangle",
  roundRect: "Rounded rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  diamond: "Diamond",
  pentagon: "Pentagon",
  hexagon: "Hexagon",
  star: "Star",
  star4: "4-point star",
  star6: "6-point star",
  star8: "8-point star",
  burst: "Burst",
  blockArrow: "Right arrow",
  arrowLeft: "Left arrow",
  arrowUp: "Up arrow",
  arrowDown: "Down arrow",
  arrowBothH: "Left-right arrow",
  arrowBothV: "Up-down arrow",
  quadArrow: "Four-way arrow",
  bentArrow: "Bent arrow",
  notchedArrow: "Notched arrow",
  chevron: "Chevron",
  chevronLeft: "Left chevron",
  chevronUp: "Up chevron",
  chevronDown: "Down chevron",
  heart: "Heart",
  plus: "Plus",
  rightTriangle: "Right triangle",
  triangleLeft: "Left triangle",
  triangleRight: "Right-point triangle",
  triangleDown: "Down triangle",
  parallelogram: "Parallelogram",
  trapezoid: "Trapezoid",
  heptagon: "Heptagon",
  octagon: "Octagon",
  nonagon: "Nonagon",
  decagon: "Decagon",
  pill: "Pill",
  cloud: "Cloud",
  lightning: "Lightning",
  moon: "Moon",
  sun: "Sun",
  speech: "Comment",
  speechOval: "Oval comment",
  thought: "Thought",
  note: "Note",
  callout: "Callout",
  bookmark: "Bookmark",
  flag: "Flag",
  pin: "Pin",
  cross: "Cross",
  check: "Check",
  cylinder: "Cylinder",
  cube: "Cube",
  shield: "Shield",
  document: "Document",
  delay: "Delay",
  display: "Display",
  manualInput: "Manual input",
  storedData: "Stored data",
  curve: "Curve",
  arc: "Arc",
  wave: "Wave",
  curvedArrow: "Curved arrow",
  elbow: "Elbow",
  elbowArrow: "Elbow arrow",
  bracket: "Bracket",
  brace: "Brace",
};

export const SHAPE_GROUPS: { title: string; ids: ShapeId[] }[] = [
  {
    title: "Lines",
    ids: ["line", "arrow", "doubleArrow", "curve", "arc", "wave", "curvedArrow", "elbow", "elbowArrow", "bracket", "brace"],
  },
  {
    title: "Arrows",
    ids: [
      "blockArrow",
      "arrowLeft",
      "arrowUp",
      "arrowDown",
      "arrowBothH",
      "arrowBothV",
      "quadArrow",
      "bentArrow",
      "notchedArrow",
      "chevron",
      "chevronLeft",
      "chevronUp",
      "chevronDown",
    ],
  },
  {
    title: "Comments",
    ids: ["speech", "speechOval", "thought", "note", "callout"],
  },
  {
    title: "Basic",
    ids: [
      "rect",
      "roundRect",
      "ellipse",
      "triangle",
      "triangleLeft",
      "triangleRight",
      "triangleDown",
      "rightTriangle",
      "diamond",
      "parallelogram",
      "trapezoid",
      "pill",
    ],
  },
  { title: "Polygons", ids: ["pentagon", "hexagon", "heptagon", "octagon", "nonagon", "decagon"] },
  { title: "Stars", ids: ["star", "star4", "star6", "star8", "burst"] },
  {
    title: "Flowchart",
    ids: ["document", "delay", "display", "manualInput", "storedData", "cube"],
  },
  {
    title: "Symbols",
    ids: ["heart", "plus", "cross", "check", "lightning", "cloud", "moon", "sun", "bookmark", "flag", "pin", "cylinder", "shield"],
  },
];

const BOX_KIND_SET = new Set<string>(BOX_KINDS);

export function isBoxKind(kind: string): kind is BoxShapeKind {
  return BOX_KIND_SET.has(kind);
}

export function isBoxShape(annotation: Annotation): annotation is ShapeAnnotation {
  return isBoxKind(annotation.kind);
}

export function isLinearShape(id: ShapeId): id is "line" | "arrow" | "doubleArrow" {
  return id === "line" || id === "arrow" || id === "doubleArrow";
}

export function lineHeadFor(id: ShapeId): LineHead {
  if (id === "arrow") return "end";
  if (id === "doubleArrow") return "both";
  return "none";
}

export function shapeFromLine(head: LineHead | undefined): ShapeId {
  if (head === "both") return "doubleArrow";
  if (head === "end") return "arrow";
  return "line";
}

function regularPolygon(sides: number, x: number, y: number, w: number, h: number): Point[] {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / sides;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

function star(x: number, y: number, w: number, h: number, points = 5, inner = 0.42): Point[] {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  return Array.from({ length: points * 2 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    const radius = index % 2 === 0 ? 1 : inner;
    return { x: cx + Math.cos(angle) * rx * radius, y: cy + Math.sin(angle) * ry * radius };
  });
}

function roundedRect(x: number, y: number, w: number, h: number, radiusRatio = 0.18): Point[] {
  const radius = Math.min(w, h) * radiusRatio;
  if (radius < 1) {
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  const steps = 5;
  const corners = [
    { cx: x + w - radius, cy: y + radius, start: -Math.PI / 2, end: 0 },
    { cx: x + w - radius, cy: y + h - radius, start: 0, end: Math.PI / 2 },
    { cx: x + radius, cy: y + h - radius, start: Math.PI / 2, end: Math.PI },
    { cx: x + radius, cy: y + radius, start: Math.PI, end: Math.PI * 1.5 },
  ];
  const points: Point[] = [];
  for (const corner of corners) {
    for (let step = 0; step <= steps; step += 1) {
      const angle = corner.start + ((corner.end - corner.start) * step) / steps;
      points.push({
        x: corner.cx + Math.cos(angle) * radius,
        y: corner.cy + Math.sin(angle) * radius,
      });
    }
  }
  return points;
}

function ellipse(x: number, y: number, w: number, h: number): Point[] {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = Math.max(w / 2, 0.5);
  const ry = Math.max(h / 2, 0.5);
  return Array.from({ length: 40 }, (_, index) => {
    const angle = (index / 40) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

function heart(x: number, y: number, w: number, h: number): Point[] {
  const raw: Point[] = [];
  for (let index = 0; index <= 48; index += 1) {
    const t = (index / 48) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    raw.push({ x: hx, y: hy });
  }
  const xs = raw.map((point) => point.x);
  const ys = raw.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return raw.map((point) => ({
    x: x + ((point.x - minX) / (maxX - minX)) * w,
    y: y + ((point.y - minY) / (maxY - minY)) * h,
  }));
}

function plus(x: number, y: number, w: number, h: number): Point[] {
  const insetX = w * 0.32;
  const insetY = h * 0.32;
  const nx = [
    insetX,
    w - insetX,
    w - insetX,
    w,
    w,
    w - insetX,
    w - insetX,
    insetX,
    insetX,
    0,
    0,
    insetX,
  ];
  const ny = [0, 0, insetY, insetY, h - insetY, h - insetY, h, h, h - insetY, h - insetY, insetY, insetY];
  return nx.map((px, index) => ({ x: x + px, y: y + (ny[index] ?? 0) }));
}

function scaled(nx: number[], ny: number[], x: number, y: number, w: number, h: number): Point[] {
  return nx.map((px, index) => ({ x: x + px * w, y: y + (ny[index] ?? 0) * h }));
}

function blockArrow(x: number, y: number, w: number, h: number): Point[] {
  return scaled([0, 0.62, 0.62, 1, 0.62, 0.62, 0], [0.28, 0.28, 0.08, 0.5, 0.92, 0.72, 0.72], x, y, w, h);
}

function sample(count: number, at: (t: number) => [number, number], x: number, y: number, w: number, h: number): Point[] {
  return Array.from({ length: count + 1 }, (_, index) => {
    const [px, py] = at(index / count);
    return { x: x + px * w, y: y + py * h };
  });
}

function withArrow(points: Point[], length: number): Point[] {
  const end = points.at(-1);
  const prev = points.at(-2);
  if (!end || !prev) return points;
  const [left, right] = arrowBarbs(prev.x, prev.y, end.x, end.y, length);
  return [...points, left, end, right];
}

function moon(x: number, y: number, w: number, h: number): Point[] {
  const points: Point[] = [];
  const outer = 18;
  for (let index = 0; index <= outer; index += 1) {
    const angle = -Math.PI * 0.7 + (index / outer) * Math.PI * 1.4;
    points.push({ x: 0.5 + Math.cos(angle) * 0.46, y: 0.5 + Math.sin(angle) * 0.46 });
  }
  const inner = 14;
  for (let index = inner; index >= 0; index -= 1) {
    const angle = -Math.PI * 0.55 + (index / inner) * Math.PI * 1.1;
    points.push({ x: 0.72 + Math.cos(angle) * 0.36, y: 0.5 + Math.sin(angle) * 0.46 });
  }
  return scaled(
    points.map((point) => point.x),
    points.map((point) => point.y),
    x,
    y,
    w,
    h,
  );
}

function cylinder(x: number, y: number, w: number, h: number): Point[] {
  const ry = 0.16;
  const top = ry;
  const bottom = 1 - ry;
  const points: Point[] = [];
  for (let index = 0; index <= 10; index += 1) {
    const angle = Math.PI - (index / 10) * Math.PI;
    points.push({ x: 0.5 + Math.cos(angle) * 0.5, y: bottom + Math.sin(angle) * ry });
  }
  for (let index = 0; index <= 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2;
    points.push({ x: 0.5 + Math.cos(angle) * 0.5, y: top + Math.sin(angle) * ry });
  }
  points.push({ x: 0, y: top });
  return scaled(
    points.map((point) => point.x),
    points.map((point) => point.y),
    x,
    y,
    w,
    h,
  );
}

export function outlinePoints(kind: BoxShapeKind, x: number, y: number, w: number, h: number): Point[] {
  if (w < 0.5 || h < 0.5) return [];
  switch (kind) {
    case "rect":
      return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
    case "roundRect":
      return roundedRect(x, y, w, h);
    case "ellipse":
      return ellipse(x, y, w, h);
    case "triangle":
      return regularPolygon(3, x, y, w, h);
    case "diamond":
      return regularPolygon(4, x, y, w, h);
    case "pentagon":
      return regularPolygon(5, x, y, w, h);
    case "hexagon":
      return regularPolygon(6, x, y, w, h);
    case "heptagon":
      return regularPolygon(7, x, y, w, h);
    case "octagon":
      return regularPolygon(8, x, y, w, h);
    case "star":
      return star(x, y, w, h);
    case "star4":
      return star(x, y, w, h, 4, 0.38);
    case "star6":
      return star(x, y, w, h, 6, 0.54);
    case "blockArrow":
      return blockArrow(x, y, w, h);
    case "arrowLeft":
      return scaled([1, 0.38, 0.38, 0, 0.38, 0.38, 1], [0.28, 0.28, 0.08, 0.5, 0.92, 0.72, 0.72], x, y, w, h);
    case "arrowUp":
      return scaled([0.28, 0.28, 0.08, 0.5, 0.92, 0.72, 0.72], [1, 0.38, 0.38, 0, 0.38, 0.38, 1], x, y, w, h);
    case "arrowDown":
      return scaled([0.28, 0.28, 0.08, 0.5, 0.92, 0.72, 0.72], [0, 0.62, 0.62, 1, 0.62, 0.62, 0], x, y, w, h);
    case "chevron":
      return scaled([0, 0.72, 1, 0.72, 0, 0.28], [0, 0, 0.5, 1, 1, 0.5], x, y, w, h);
    case "heart":
      return heart(x, y, w, h);
    case "plus":
      return plus(x, y, w, h);
    case "rightTriangle":
      return scaled([0, 1, 0], [0, 1, 1], x, y, w, h);
    case "parallelogram":
      return scaled([0.22, 1, 0.78, 0], [0, 0, 1, 1], x, y, w, h);
    case "trapezoid":
      return scaled([0.2, 0.8, 1, 0], [0, 0, 1, 1], x, y, w, h);
    case "pill":
      return roundedRect(x, y, w, h, 0.5);
    case "cloud":
      return scaled(
        [0.16, 0.28, 0.4, 0.52, 0.7, 0.86, 0.96, 0.9, 0.12],
        [0.62, 0.4, 0.46, 0.26, 0.34, 0.22, 0.5, 0.78, 0.78],
        x,
        y,
        w,
        h,
      );
    case "lightning":
      return scaled([0.46, 0.16, 0.42, 0.3, 0.84, 0.54], [0, 0.48, 0.48, 1, 0.36, 0.36], x, y, w, h);
    case "moon":
      return moon(x, y, w, h);
    case "speech":
      return scaled([0.08, 0.92, 0.92, 0.42, 0.22, 0.3, 0.08], [0.08, 0.08, 0.68, 0.68, 0.94, 0.68, 0.68], x, y, w, h);
    case "bookmark":
      return scaled([0.16, 0.84, 0.84, 0.5, 0.16], [0, 0, 1, 0.7, 1], x, y, w, h);
    case "cross":
      return scaled(
        [0.2, 0.5, 0.8, 1, 0.7, 1, 0.8, 0.5, 0.2, 0, 0.3, 0],
        [0, 0.3, 0, 0.2, 0.5, 0.8, 1, 0.7, 1, 0.8, 0.5, 0.2],
        x,
        y,
        w,
        h,
      );
    case "cylinder":
      return cylinder(x, y, w, h);
    case "shield":
      return scaled([0.5, 0.92, 0.88, 0.5, 0.12, 0.08], [0.02, 0.14, 0.48, 0.98, 0.48, 0.14], x, y, w, h);
    case "triangleLeft":
      return scaled([1, 1, 0], [0, 1, 0.5], x, y, w, h);
    case "triangleRight":
      return scaled([0, 0, 1], [0, 1, 0.5], x, y, w, h);
    case "triangleDown":
      return scaled([0, 1, 0.5], [0, 0, 1], x, y, w, h);
    case "nonagon":
      return regularPolygon(9, x, y, w, h);
    case "decagon":
      return regularPolygon(10, x, y, w, h);
    case "star8":
      return star(x, y, w, h, 8, 0.46);
    case "burst":
      return star(x, y, w, h, 12, 0.42);
    case "arrowBothH":
      return scaled(
        [0, 0.22, 0.22, 0.78, 0.78, 1, 0.78, 0.78, 0.22, 0.22],
        [0.5, 0.28, 0.4, 0.4, 0.28, 0.5, 0.72, 0.6, 0.6, 0.72],
        x,
        y,
        w,
        h,
      );
    case "arrowBothV":
      return scaled(
        [0.5, 0.72, 0.6, 0.6, 0.72, 0.5, 0.28, 0.4, 0.4, 0.28],
        [0, 0.22, 0.22, 0.78, 0.78, 1, 0.78, 0.78, 0.22, 0.22],
        x,
        y,
        w,
        h,
      );
    case "quadArrow":
      return scaled(
        [0.5, 0.32, 0.4, 0.4, 0.22, 0, 0.22, 0.4, 0.4, 0.32, 0.5, 0.68, 0.6, 0.6, 0.78, 1, 0.78, 0.6, 0.6, 0.68],
        [0, 0.22, 0.22, 0.4, 0.4, 0.5, 0.6, 0.6, 0.78, 0.78, 1, 0.78, 0.78, 0.6, 0.6, 0.5, 0.4, 0.4, 0.22, 0.22],
        x,
        y,
        w,
        h,
      );
    case "bentArrow":
      return scaled(
        [0.18, 0.18, 0.55, 0.55, 1, 0.55, 0.55, 0.05, 0.05],
        [0.06, 0.58, 0.58, 0.42, 0.7, 0.98, 0.82, 0.82, 0.06],
        x,
        y,
        w,
        h,
      );
    case "notchedArrow":
      return scaled(
        [0.16, 0.62, 0.62, 1, 0.62, 0.62, 0.16, 0.34],
        [0.25, 0.25, 0.08, 0.5, 0.92, 0.75, 0.75, 0.5],
        x,
        y,
        w,
        h,
      );
    case "chevronLeft":
      return scaled([1, 0.28, 0, 0.28, 1, 0.72], [0, 0, 0.5, 1, 1, 0.5], x, y, w, h);
    case "chevronUp":
      return scaled([0, 0, 0.5, 1, 1, 0.5], [1, 0.28, 0, 0.28, 1, 0.72], x, y, w, h);
    case "chevronDown":
      return scaled([0, 0, 0.5, 1, 1, 0.5], [0, 0.72, 1, 0.72, 0, 0.28], x, y, w, h);
    case "check":
      return scaled([0.08, 0.38, 0.92, 0.78, 0.38, 0.22], [0.52, 0.84, 0.16, 0.04, 0.58, 0.4], x, y, w, h);
    case "sun":
      return star(x, y, w, h, 12, 0.62);
    case "speechOval":
      return [
        ...sample(24, (t) => {
          const angle = Math.PI * 0.15 + t * Math.PI * 1.7;
          return [0.5 + Math.cos(angle) * 0.42, 0.4 + Math.sin(angle) * 0.3];
        }, x, y, w, h),
        { x: x + 0.28 * w, y: y + 0.96 * h },
        { x: x + 0.4 * w, y: y + 0.62 * h },
      ];
    case "thought":
      return scaled(
        [0.18, 0.3, 0.46, 0.62, 0.8, 0.94, 0.9, 0.72, 0.34, 0.22, 0.14, 0.2, 0.1, 0.16],
        [0.58, 0.32, 0.22, 0.3, 0.18, 0.42, 0.68, 0.74, 0.74, 0.86, 0.8, 0.92, 0.98, 0.84],
        x,
        y,
        w,
        h,
      );
    case "note":
      return scaled(
        [0.06, 0.68, 0.68, 1, 0.68, 0.68, 1, 1, 0.06],
        [0.06, 0.06, 0.06, 0.34, 0.34, 0.06, 0.34, 0.94, 0.94],
        x,
        y,
        w,
        h,
      );
    case "callout":
      return scaled([0.02, 0.98, 0.98, 0.34, 0, 0.22, 0.02], [0.04, 0.04, 0.68, 0.68, 0.98, 0.68, 0.68], x, y, w, h);
    case "flag":
      return scaled([0.16, 0.16, 0.3, 0.3, 0.86, 0.3, 0.3], [0.06, 0.96, 0.96, 0.62, 0.4, 0.2, 0.06], x, y, w, h);
    case "pin":
      return [
        ...sample(20, (t) => {
          const angle = Math.PI + t * Math.PI;
          return [0.5 + Math.cos(angle) * 0.34, 0.36 + Math.sin(angle) * 0.28];
        }, x, y, w, h),
        { x: x + 0.5 * w, y: y + 0.96 * h },
      ];
    case "cube":
      return scaled(
        [0.08, 0.5, 0.92, 0.92, 0.5, 0.08, 0.08, 0.5, 0.92, 0.5, 0.5, 0.5, 0.08],
        [0.32, 0.08, 0.32, 0.76, 0.96, 0.76, 0.32, 0.52, 0.32, 0.52, 0.96, 0.52, 0.32],
        x,
        y,
        w,
        h,
      );
    case "document":
      return scaled(
        [0.06, 0.94, 0.94, 0.78, 0.58, 0.38, 0.18, 0.06],
        [0.06, 0.06, 0.78, 0.7, 0.9, 0.7, 0.9, 0.74],
        x,
        y,
        w,
        h,
      );
    case "delay":
      return [
        { x: x + 0.08 * w, y: y + 0.12 * h },
        ...sample(18, (t) => {
          const angle = -Math.PI / 2 + t * Math.PI;
          return [0.4 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.38];
        }, x, y, w, h),
        { x: x + 0.08 * w, y: y + 0.88 * h },
      ];
    case "display":
      return scaled([0.18, 0.82, 1, 0.82, 0.18, 0], [0.08, 0.08, 0.5, 0.92, 0.92, 0.5], x, y, w, h);
    case "manualInput":
      return scaled([0, 1, 1, 0], [0.28, 0.06, 0.94, 0.94], x, y, w, h);
    case "storedData":
      return [
        { x: x + 0.2 * w, y: y + 0.16 * h },
        { x: x + w, y: y + 0.16 * h },
        { x: x + w, y: y + 0.84 * h },
        { x: x + 0.2 * w, y: y + 0.84 * h },
        ...sample(16, (t) => {
          const angle = Math.PI / 2 + t * Math.PI;
          return [0.2 + Math.cos(angle) * 0.16, 0.5 + Math.sin(angle) * 0.34];
        }, x, y, w, h),
      ];
    case "curve":
      return sample(24, (t) => {
        const u = 1 - t;
        return [u * u * 0.06 + 2 * u * t * 0.5 + t * t * 0.94, u * u * 0.75 + 2 * u * t * 0.08 + t * t * 0.75];
      }, x, y, w, h);
    case "arc":
      return sample(24, (t) => {
        const angle = Math.PI - t * Math.PI;
        return [0.5 + Math.cos(angle) * 0.44, 0.84 - Math.sin(angle) * 0.7];
      }, x, y, w, h);
    case "wave":
      return sample(32, (t) => [0.04 + t * 0.92, 0.5 + Math.sin(t * Math.PI * 2) * 0.32], x, y, w, h);
    case "curvedArrow":
      return withArrow(
        sample(24, (t) => {
          const u = 1 - t;
          return [u * u * 0.06 + 2 * u * t * 0.5 + t * t * 0.94, u * u * 0.78 + 2 * u * t * 0.08 + t * t * 0.42];
        }, x, y, w, h),
        Math.min(w, h) * 0.28,
      );
    case "elbow":
      return scaled([0.08, 0.08, 0.92], [0.12, 0.78, 0.78], x, y, w, h);
    case "elbowArrow":
      return withArrow(scaled([0.08, 0.08, 0.92], [0.14, 0.72, 0.72], x, y, w, h), Math.min(w, h) * 0.28);
    case "bracket":
      return scaled([0.72, 0.28, 0.28, 0.72], [0.06, 0.06, 0.94, 0.94], x, y, w, h);
    case "brace":
      return scaled(
        [0.68, 0.46, 0.46, 0.28, 0.46, 0.46, 0.68],
        [0.04, 0.14, 0.4, 0.5, 0.6, 0.86, 0.96],
        x,
        y,
        w,
        h,
      );
  }
}

export function pointsToPath(points: Point[], closed: boolean): string {
  const first = points[0];
  if (!first) return "";
  const commands = [`M ${first.x} ${first.y}`];
  for (const point of points.slice(1)) commands.push(`L ${point.x} ${point.y}`);
  if (closed) commands.push("Z");
  return commands.join(" ");
}

export function arrowBarbs(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  length: number,
): [Point, Point] {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const spread = Math.PI / 7;
  return [
    {
      x: x2 - Math.cos(angle - spread) * length,
      y: y2 - Math.sin(angle - spread) * length,
    },
    {
      x: x2 - Math.cos(angle + spread) * length,
      y: y2 - Math.sin(angle + spread) * length,
    },
  ];
}
