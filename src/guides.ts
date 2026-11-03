// Alignment guides for a mark being dragged: the left, centre and right (top, middle and bottom)
// of the page and of the content block the mark sits over, which the mark snaps to while it is
// within a few pixels of one of them.
import type { ContentElement } from "./content.ts";

export type Box = { x: number; y: number; w: number; h: number };

export type GuideScope = "page" | "section";

// A line to draw while a move is snapped, in page units: vertical ("x") at `at`, running from
// `from` to `to` down the page, or horizontal ("y") at `at`, running across it.
export type Guide = {
  axis: "x" | "y";
  scope: GuideScope;
  at: number;
  from: number;
  to: number;
};

export type Snap = { dx: number; dy: number; guides: Guide[] };

// The three stops of a span: its start, its middle and its end.
const stops = (start: number, size: number) => [start, start + size / 2, start + size];

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

// The section a dragged box belongs to: the page's content element (paragraph, heading, table,
// figure) it overlaps the most, or, over none, the bounds of all the page's content, its text
// column. Null on a page with no content. A mark edited out of a content element is not its own
// section, so that element can be left out.
export function parentSection(box: Box, content: ContentElement[], excludeId?: string | null): Box | null {
  let best: ContentElement | null = null;
  let bestArea = 0;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const element of content) {
    x1 = Math.min(x1, element.x);
    y1 = Math.min(y1, element.y);
    x2 = Math.max(x2, element.x + element.w);
    y2 = Math.max(y2, element.y + element.h);
    if (element.id === excludeId) continue;
    const area = overlap(box, element);
    if (area > bestArea) {
      bestArea = area;
      best = element;
    }
  }
  if (best) return { x: best.x, y: best.y, w: best.w, h: best.h };
  if (x1 === Infinity) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// The shift that lands the nearest of `positions` on one of `targets`, when one is within
// `threshold`; null when none is.
function nearestShift(positions: number[], targets: number[], threshold: number): number | null {
  let best: number | null = null;
  for (const target of targets) {
    for (const position of positions) {
      const shift = target - position;
      if (Math.abs(shift) <= threshold && (best === null || Math.abs(shift) < Math.abs(best))) best = shift;
    }
  }
  return best;
}

// Snaps a move of `box` by (dx, dy) to the page's and the section's stops within `threshold`
// page units, each axis on its own, and lists every guide the snapped box lines up with: the
// page's run the page's full length, the section's run across the section and the box.
export function snapMove(
  box: Box,
  dx: number,
  dy: number,
  page: Box,
  section: Box | null,
  threshold: number,
): Snap {
  const scopes: { scope: GuideScope; box: Box }[] = [{ scope: "page", box: page }];
  if (section) scopes.push({ scope: "section", box: section });
  const shiftX = nearestShift(
    stops(box.x + dx, box.w),
    scopes.flatMap((scope) => stops(scope.box.x, scope.box.w)),
    threshold,
  );
  const shiftY = nearestShift(
    stops(box.y + dy, box.h),
    scopes.flatMap((scope) => stops(scope.box.y, scope.box.h)),
    threshold,
  );
  const moved: Box = { x: box.x + dx + (shiftX ?? 0), y: box.y + dy + (shiftY ?? 0), w: box.w, h: box.h };
  const guides: Guide[] = [];
  // A stop the snapped box sits on, give or take a hair.
  const near = 0.25;
  const add = (guide: Guide) => {
    const twin = guides.some(
      (other) => other.axis === guide.axis && other.scope === guide.scope && Math.abs(other.at - guide.at) <= near,
    );
    if (!twin) guides.push(guide);
  };
  if (shiftX !== null) {
    const positions = stops(moved.x, moved.w);
    for (const { scope, box: target } of scopes) {
      for (const at of stops(target.x, target.w)) {
        if (!positions.some((position) => Math.abs(position - at) <= near)) continue;
        add({
          axis: "x",
          scope,
          at,
          from: scope === "page" ? target.y : Math.min(target.y, moved.y),
          to: scope === "page" ? target.y + target.h : Math.max(target.y + target.h, moved.y + moved.h),
        });
      }
    }
  }
  if (shiftY !== null) {
    const positions = stops(moved.y, moved.h);
    for (const { scope, box: target } of scopes) {
      for (const at of stops(target.y, target.h)) {
        if (!positions.some((position) => Math.abs(position - at) <= near)) continue;
        add({
          axis: "y",
          scope,
          at,
          from: scope === "page" ? target.x : Math.min(target.x, moved.x),
          to: scope === "page" ? target.x + target.w : Math.max(target.x + target.w, moved.x + moved.w),
        });
      }
    }
  }
  return { dx: moved.x - box.x, dy: moved.y - box.y, guides };
}

export function sameGuides(a: Guide[], b: Guide[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((guide, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      guide.axis === other.axis &&
      guide.scope === other.scope &&
      Math.abs(guide.at - other.at) < 0.01 &&
      Math.abs(guide.from - other.from) < 0.01 &&
      Math.abs(guide.to - other.to) < 0.01
    );
  });
}
