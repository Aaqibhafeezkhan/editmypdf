// The sizes of the inspector column and of the two panes stacked inside it (the object list
// above, the selection's attributes below), with the limits the user can drag them to. Every
// number the layout depends on lives here.

// The column's width when nothing has been dragged yet, in CSS px.
export const INSPECTOR_DEFAULT_WIDTH = 288;

// Narrower than this and the attribute controls no longer fit on their rows.
export const INSPECTOR_MIN_WIDTH = 236;

// The column may grow to about this share of the window's width; the pages keep the rest.
export const INSPECTOR_MAX_WIDTH_FRACTION = 0.3;

// The object list's share of the column's height when nothing has been dragged yet; the
// attributes pane takes what is left.
export const PANE_DEFAULT_SPLIT = 0.5;

// Either pane can be dragged down to about this share of the column's height: enough for its
// header and a row or two, never nothing.
export const PANE_MIN_HEIGHT_FRACTION = 0.1;

// How far one arrow key press moves a handle, in CSS px; Shift makes it four times as far.
export const HANDLE_KEY_STEP = 16;

const STORAGE_KEY = "pdf-editor:inspector-layout";

export type InspectorLayout = {
  // The column's width in CSS px.
  width: number;
  // The object list's share of the column's height, between the pane minimum and one minus it.
  split: number;
};

export const DEFAULT_LAYOUT: InspectorLayout = { width: INSPECTOR_DEFAULT_WIDTH, split: PANE_DEFAULT_SPLIT };

// The widest the column may be in a window `windowWidth` px wide. The minimum wins in a window
// too narrow for the fraction, so the column never collapses below what its controls need.
export function maxInspectorWidth(windowWidth: number): number {
  return Math.max(INSPECTOR_MIN_WIDTH, Math.round(windowWidth * INSPECTOR_MAX_WIDTH_FRACTION));
}

export function clampInspectorWidth(width: number, windowWidth: number): number {
  if (!Number.isFinite(width)) return INSPECTOR_DEFAULT_WIDTH;
  return Math.min(maxInspectorWidth(windowWidth), Math.max(INSPECTOR_MIN_WIDTH, Math.round(width)));
}

export function clampPaneSplit(split: number): number {
  if (!Number.isFinite(split)) return PANE_DEFAULT_SPLIT;
  return Math.min(1 - PANE_MIN_HEIGHT_FRACTION, Math.max(PANE_MIN_HEIGHT_FRACTION, split));
}

// The layout the user last left, clamped to the window it is read in.
export function readInspectorLayout(windowWidth: number): InspectorLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT, width: clampInspectorWidth(DEFAULT_LAYOUT.width, windowWidth) };
    const parsed = JSON.parse(raw) as { width?: unknown; split?: unknown };
    return {
      width: clampInspectorWidth(typeof parsed.width === "number" ? parsed.width : DEFAULT_LAYOUT.width, windowWidth),
      split: clampPaneSplit(typeof parsed.split === "number" ? parsed.split : DEFAULT_LAYOUT.split),
    };
  } catch {
    return { ...DEFAULT_LAYOUT, width: clampInspectorWidth(DEFAULT_LAYOUT.width, windowWidth) };
  }
}

export function writeInspectorLayout(layout: InspectorLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage can be blocked in private browsing.
  }
}
