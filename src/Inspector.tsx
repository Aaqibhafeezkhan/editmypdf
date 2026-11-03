import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

const INSPECTOR_KEY = "pdf-editor:inspector";

function readInspectorOpen(): boolean {
  try {
    return localStorage.getItem(INSPECTOR_KEY) !== "closed";
  } catch {
    return true;
  }
}
import { ColorControl } from "./ColorControl.tsx";
import { keepFocus } from "./keepFocus.ts";
import { contentDetail, contentLabel, patchMissingGlyphs, type ContentElement, type ContentKind } from "./content.ts";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Info,
  Italic,
  PanelRightClose,
  PanelRightOpen,
  Strikethrough,
  Trash2,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  clampInspectorWidth,
  clampPaneSplit,
  DEFAULT_LAYOUT,
  HANDLE_KEY_STEP,
  INSPECTOR_MIN_WIDTH,
  maxInspectorWidth,
  PANE_MIN_HEIGHT_FRACTION,
  readInspectorLayout,
  writeInspectorLayout,
  type InspectorLayout,
} from "./inspectorLayout.ts";
import { ObjectList } from "./ObjectList.tsx";
import type { ObjectHover, ObjectRow } from "./objects.ts";
import type { FormatChange, FormatState } from "./textFormat.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { brushById, DASHES } from "./brushes.ts";
import { SHAPE_LABEL, type ShapeId } from "./shapes.ts";
import type { Align, Annotation, FontId, LineCap, PatchAnnotation, StrokeStyle, TextAlign, TextStyle, Tool } from "./types.ts";
import { FONT_OPTIONS, SWATCHES } from "./types.ts";

type StyleKey = "bold" | "italic" | "underline" | "strike";

// The column's width and the panes' split, kept across reloads and clamped to the window.
function useInspectorLayout() {
  const [layout, setLayout] = useState<InspectorLayout>(() =>
    readInspectorLayout(typeof window === "undefined" ? DEFAULT_LAYOUT.width * 4 : window.innerWidth),
  );
  useEffect(() => writeInspectorLayout(layout), [layout]);
  useEffect(() => {
    const onResize = () =>
      setLayout((current) => {
        const width = clampInspectorWidth(current.width, window.innerWidth);
        return width === current.width ? current : { ...current, width };
      });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const setWidth = (width: number) =>
    setLayout((current) => {
      const next = clampInspectorWidth(width, window.innerWidth);
      return next === current.width ? current : { ...current, width: next };
    });
  const setSplit = (split: number) =>
    setLayout((current) => {
      const next = clampPaneSplit(split);
      return Math.abs(next - current.split) < 0.0005 ? current : { ...current, split: next };
    });
  return { layout, setWidth, setSplit };
}

// A drag handle between two areas: pointer drag, arrow keys and a double-click back to the default.
// `onMove` gets the size in px the drag asks for, measured from `size()` at the start.
function SplitHandle({
  className,
  orientation,
  label,
  valueNow,
  valueMin,
  valueMax,
  size,
  onMove,
  onReset,
  onDragging,
}: {
  className: string;
  orientation: "vertical" | "horizontal";
  label: string;
  valueNow: number;
  valueMin: number;
  valueMax: number;
  size: () => number;
  onMove: (px: number) => void;
  onReset: () => void;
  onDragging: (dragging: boolean) => void;
}) {
  const start = useRef<{ x: number; y: number; size: number } | null>(null);
  const [active, setActive] = useState(false);
  const vertical = orientation === "vertical";
  const begin = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A very fast press can release the pointer before capture; the drag still runs.
    }
    start.current = { x: event.clientX, y: event.clientY, size: size() };
    setActive(true);
    onDragging(true);
    document.body.classList.add(vertical ? "resizing-columns" : "resizing-rows");
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current;
    if (!from) return;
    // The column's handle is on its left edge, so dragging left makes it wider.
    const delta = vertical ? from.x - event.clientX : event.clientY - from.y;
    onMove(from.size + delta);
  };
  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    start.current = null;
    setActive(false);
    onDragging(false);
    document.body.classList.remove("resizing-columns", "resizing-rows");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = HANDLE_KEY_STEP * (event.shiftKey ? 4 : 1);
    let direction = 0;
    if (vertical && event.key === "ArrowLeft") direction = 1;
    else if (vertical && event.key === "ArrowRight") direction = -1;
    else if (!vertical && event.key === "ArrowUp") direction = -1;
    else if (!vertical && event.key === "ArrowDown") direction = 1;
    else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onMove(event.key === "Home" ? 0 : Number.POSITIVE_INFINITY);
      return;
    } else if (event.key === "Enter") {
      event.preventDefault();
      onReset();
      return;
    } else return;
    event.preventDefault();
    onMove(size() + direction * step);
  };
  return (
    <div
      className={`${className}${active ? " active" : ""}`}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={valueNow}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      title={`${label}: drag, or use the arrow keys. Double-click to reset.`}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
      onDoubleClick={onReset}
      onKeyDown={onKey}
    />
  );
}

function StyleToggles({ state, onToggle }: { state: Record<StyleKey, boolean>; onToggle: (key: StyleKey) => void }) {
  const items: [StyleKey, string, React.ReactNode][] = [
    ["bold", "Bold", <Bold key="b" />],
    ["italic", "Italic", <Italic key="i" />],
    ["underline", "Underline", <Underline key="u" />],
    ["strike", "Strikethrough", <Strikethrough key="s" />],
  ];
  return (
    <>
      {items.map(([key, label, icon]) => (
        <Toggle
          key={key}
          variant="outline"
          size="sm"
          aria-label={label}
          title={label}
          pressed={state[key]}
          onMouseDown={keepFocus}
          onPressedChange={() => onToggle(key)}
        >
          {icon}
        </Toggle>
      ))}
    </>
  );
}

function AlignToggles({ value, justify, onAlign }: { value: TextAlign; justify: boolean; onAlign: (align: TextAlign) => void }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={1}
      value={value}
      onValueChange={(next) => {
        if (next === "left" || next === "center" || next === "right" || (justify && next === "justify")) onAlign(next);
      }}
      aria-label="Alignment"
    >
      <ToggleGroupItem value="left" aria-label="Align left" onMouseDown={keepFocus}>
        <AlignLeft />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Align center" onMouseDown={keepFocus}>
        <AlignCenter />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Align right" onMouseDown={keepFocus}>
        <AlignRight />
      </ToggleGroupItem>
      {justify && (
        <ToggleGroupItem value="justify" aria-label="Justify" onMouseDown={keepFocus}>
          <AlignJustify />
        </ToggleGroupItem>
      )}
    </ToggleGroup>
  );
}

// Tells the user that typed characters the page's font lacks are shown in a substitute face and
// make the edit an image on download.
function missingGlyphNote(missing: string[], kind: ContentKind | undefined): string {
  const shown = missing.slice(0, 6).map((char) => `\u201c${char}\u201d`);
  const rest = missing.length - shown.length;
  const list =
    rest > 0
      ? `${shown.join(", ")} and ${rest} more`
      : shown.length === 1
        ? shown[0]
        : `${shown.slice(0, -1).join(", ")} or ${shown[shown.length - 1]}`;
  const noun = kind === "paragraph" || kind === "heading" ? kind : "line";
  return `The page's font has no ${list}. ${missing.length === 1 ? "It is" : "They are"} shown in a substitute face, and on download this ${noun} is written as an image instead of text.`;
}

function strokePanel(id: ShapeId, selected: boolean) {
  const label = SHAPE_LABEL[id];
  return {
    panel: "stroke" as const,
    title: label,
    detail: selected ? `Selected ${label.toLowerCase()}` : `Next ${label.toLowerCase()}`,
  };
}

function panelFor(
  tool: Tool,
  selectedKind: Annotation["kind"] | null,
  shape: ShapeId,
  selectedShape: ShapeId | null,
  content: ContentElement | null,
) {
  if (selectedKind === "text") {
    return { panel: "text" as const, title: "Text", detail: "Selected text" };
  }
  if (selectedKind === "emoji") {
    return { panel: "empty" as const, title: "Emoji", detail: "Drag to move it, or use the handles to resize" };
  }
  if (selectedKind === "signature") {
    return { panel: "empty" as const, title: "Signature", detail: "Drag to move it, or use the handles to resize" };
  }
  if (selectedShape) return strokePanel(selectedShape, true);
  if (selectedKind === "ink") {
    return { panel: "stroke" as const, title: "Pencil", detail: "Selected stroke" };
  }
  if (tool === "select" && content) {
    return {
      panel: "content" as const,
      title: contentLabel(content.kind),
      detail: contentDetail(content.kind),
    };
  }
  if (tool === "text") {
    return { panel: "text" as const, title: "Text", detail: "Next text box" };
  }
  if (tool === "shape") return strokePanel(shape, false);
  if (tool === "emoji") {
    return { panel: "empty" as const, title: "Emoji", detail: "Pick an emoji to place it on the page" };
  }
  if (tool === "signature") {
    return { panel: "empty" as const, title: "Signature", detail: "Type a name or upload a signature" };
  }
  if (tool === "pencil") {
    return { panel: "stroke" as const, title: "Pencil", detail: "Next stroke" };
  }
  if (tool === "eraser") {
    return { panel: "empty" as const, title: "Eraser", detail: "Click a mark to remove it" };
  }
  return { panel: "empty" as const, title: "Properties", detail: "Select a mark to edit it" };
}

function NumberSlider({
  label,
  value,
  min,
  max,
  onChange,
  onAdjustStart,
  onAdjustEnd,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onAdjustStart: () => void;
  onAdjustEnd: () => void;
}) {
  const clampValue = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Input
          type="number"
          min={min}
          max={max}
          aria-label={`${label} value`}
          value={Math.round(value)}
          className="h-7 w-16 px-2 text-center"
          onFocus={onAdjustStart}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(clampValue(next));
          }}
          onBlur={onAdjustEnd}
        />
      </div>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={1}
        value={[value]}
        onPointerDown={onAdjustStart}
        onValueChange={(next) => onChange(clampValue(next[0] ?? value))}
        onValueCommit={onAdjustEnd}
        onBlur={onAdjustEnd}
      />
    </div>
  );
}

export function Inspector({
  tool,
  shape,
  selectedShape,
  selectedKind,
  stroke,
  text,
  showFill,
  showInk,
  onStrokeColor,
  onStrokeWidth,
  onFill,
  onFillOpacity,
  onOpacity,
  onCap,
  onDash,
  onFont,
  onFontSize,
  onTextColor,
  onToggle,
  onAlign,
  onWidth,
  onAutoWidth,
  onAdjustStart,
  onAdjustEnd,
  canDelete,
  onDelete,
  content,
  patch,
  objects,
  selectedId,
  hover,
  onHoverObject,
  onSelectObject,
  onRemoveObject,
  format,
  onFormat,
  onFormatBegin,
  onFormatEnd,
}: {
  tool: Tool;
  shape: ShapeId;
  selectedShape: ShapeId | null;
  selectedKind: Annotation["kind"] | null;
  stroke: StrokeStyle;
  text: TextStyle;
  showFill: boolean;
  showInk: boolean;
  onStrokeColor: (color: string) => void;
  onStrokeWidth: (width: number) => void;
  onFill: (fill: string | null) => void;
  onFillOpacity: (opacity: number) => void;
  onOpacity: (opacity: number) => void;
  onCap: (cap: LineCap) => void;
  onDash: (dash: string | null) => void;
  onFont: (fontId: FontId) => void;
  onFontSize: (size: number) => void;
  onTextColor: (color: string) => void;
  onToggle: (key: StyleKey) => void;
  onAlign: (align: Align) => void;
  onWidth: (width: number) => void;
  onAutoWidth: (autoWidth: boolean) => void;
  onAdjustStart: () => void;
  onAdjustEnd: () => void;
  canDelete: boolean;
  onDelete: () => void;
  content: ContentElement | null;
  // The selected text patch, whose text may already differ from the page's.
  patch: PatchAnnotation | null;
  // Every inserted mark in insertion order, for the numbered list above the attributes.
  objects: ObjectRow[];
  selectedId: string | null;
  hover: ObjectHover | null;
  onHoverObject: (id: string | null) => void;
  onSelectObject: (id: string) => void;
  onRemoveObject: (id: string) => void;
  // How the selected text patch's caret or selection is formatted, and the actions on it; the
  // same ones the floating bar over the page offers.
  format: FormatState | null;
  onFormat: (change: FormatChange) => void;
  onFormatBegin: () => void;
  onFormatEnd: () => void;
}) {
  const view = panelFor(tool, selectedKind, shape, selectedShape, content);
  const { layout, setWidth, setSplit } = useInspectorLayout();
  const [dragging, setDragging] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyHeight = () => bodyRef.current?.clientHeight ?? 0;
  const windowWidth = typeof window === "undefined" ? DEFAULT_LAYOUT.width * 4 : window.innerWidth;
  const missing = view.panel === "content" && patch?.role === "text" ? patchMissingGlyphs(patch) : [];
  const [open, setOpen] = useState(readInspectorOpen);
  useEffect(() => {
    try {
      localStorage.setItem(INSPECTOR_KEY, open ? "open" : "closed");
    } catch {
      // Storage can be blocked in private browsing.
    }
  }, [open]);
  const title = showInk && view.panel === "stroke" ? brushById(stroke.brush).label : view.title;
  const dashValue = DASHES.find((item) => item.dash === stroke.dash)?.id ?? "solid";
  const opacity = Math.round(stroke.opacity * 100);
  const pageCount = new Set(objects.map((row) => row.page)).size;
  const objectsDetail =
    objects.length === 0
      ? "Nothing inserted yet"
      : `${objects.length} ${objects.length === 1 ? "object" : "objects"} on ${pageCount} ${pageCount === 1 ? "page" : "pages"}`;

  const className = ["inspector", open ? "" : "collapsed", dragging ? "resizing" : ""].filter(Boolean).join(" ");

  return (
    <aside className={className} style={{ "--inspector-width": `${layout.width}px` } as React.CSSProperties} aria-label="Properties">
      {open && (
        <SplitHandle
          className="inspector-handle"
          orientation="vertical"
          label="Width of the properties column"
          valueNow={Math.round(layout.width)}
          valueMin={INSPECTOR_MIN_WIDTH}
          valueMax={maxInspectorWidth(windowWidth)}
          size={() => layout.width}
          onMove={setWidth}
          onReset={() => setWidth(DEFAULT_LAYOUT.width)}
          onDragging={setDragging}
        />
      )}
      <div className="inspector-body" ref={bodyRef}>
      <section className="inspector-pane objects" style={{ flexBasis: `${layout.split * 100}%` }} aria-label="Objects">
      <div className="flex items-start gap-2 px-2.5 py-2.5">
        <div className="min-w-0 flex-1 px-1.5 pt-0.5" aria-hidden={!open}>
          <h2 className="text-sm font-semibold tracking-tight">Objects</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{objectsDetail}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-expanded={open}
          aria-label={open ? "Collapse properties" : "Expand properties"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <PanelRightClose /> : <PanelRightOpen />}
        </Button>
      </div>

      <div className="inspector-scroll" inert={!open}>
        <ScrollArea className="min-h-0 flex-1">
          <ObjectList
            objects={objects}
            selectedId={selectedId}
            hover={hover}
            onHover={onHoverObject}
            onSelect={onSelectObject}
            onRemove={onRemoveObject}
          />
        </ScrollArea>
      </div>
      </section>

      <SplitHandle
        className="inspector-splitter"
        orientation="horizontal"
        label="Height of the object list"
        valueNow={Math.round(layout.split * 100)}
        valueMin={Math.round(PANE_MIN_HEIGHT_FRACTION * 100)}
        valueMax={Math.round((1 - PANE_MIN_HEIGHT_FRACTION) * 100)}
        size={() => layout.split * bodyHeight()}
        onMove={(px) => {
          const height = bodyHeight();
          if (height > 0) setSplit(px / height);
        }}
        onReset={() => setSplit(DEFAULT_LAYOUT.split)}
        onDragging={setDragging}
      />

      <section className="inspector-pane attributes" aria-label="Attributes" inert={!open}>
      <div className="flex items-start gap-2 px-2.5 py-2.5">
        <div className="min-w-0 flex-1 px-1.5 pt-0.5">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{view.detail}</p>
        </div>
      </div>

      <div className="inspector-scroll">
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-5 px-4 pt-1 pb-4">
            {view.panel === "text" && (
              <>
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">Font</Label>
                  <Select value={text.fontId} onValueChange={(value) => onFont(value as FontId)}>
                    <SelectTrigger className="w-full" aria-label="Font">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((font) => (
                        <SelectItem key={font.id} value={font.id}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <NumberSlider
                  label="Size"
                  value={text.fontSize}
                  min={8}
                  max={96}
                  onChange={onFontSize}
                  onAdjustStart={onAdjustStart}
                  onAdjustEnd={onAdjustEnd}
                />
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">Style</Label>
                  <div className="flex flex-wrap items-center gap-1">
                    <StyleToggles
                      state={{ bold: text.bold, italic: text.italic, underline: text.underline, strike: !!text.strike }}
                      onToggle={onToggle}
                    />
                    <AlignToggles
                      value={text.align}
                      justify={false}
                      onAlign={(align) => {
                        if (align !== "justify") onAlign(align);
                      }}
                    />
                    <ColorControl
                      label="Text color"
                      appearance="text"
                      color={text.color}
                      onColor={onTextColor}
                      onAdjustStart={onAdjustStart}
                      onAdjustEnd={onAdjustEnd}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="auto-width" className="text-sm font-normal">
                    Auto width
                  </Label>
                  <Switch
                    id="auto-width"
                    checked={text.autoWidth}
                    onCheckedChange={(checked) => onAutoWidth(checked)}
                  />
                </div>
                {!text.autoWidth && (
                  <NumberSlider
                    label="Width"
                    value={text.width}
                    min={16}
                    max={1600}
                    onChange={onWidth}
                    onAdjustStart={onAdjustStart}
                    onAdjustEnd={onAdjustEnd}
                  />
                )}
              </>
            )}

            {view.panel === "stroke" && (
              <>
                {showFill && (
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">Fill</Label>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      size="sm"
                      className="justify-start"
                      value={stroke.fill === null ? "none" : "solid"}
                      onValueChange={(value) => {
                        if (value === "none") onFill(null);
                        if (value === "solid") onFill(stroke.fill ?? "#dbeafe");
                      }}
                      aria-label="Fill"
                    >
                      <ToggleGroupItem value="none" onMouseDown={keepFocus}>
                        No fill
                      </ToggleGroupItem>
                      <ToggleGroupItem value="solid" onMouseDown={keepFocus}>
                        Solid fill
                      </ToggleGroupItem>
                    </ToggleGroup>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Fill swatches">
                      <button
                        type="button"
                        aria-label="Transparent fill"
                        aria-pressed={stroke.fill === null}
                        title="Transparent"
                        className="size-5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{
                          background:
                            "linear-gradient(45deg, transparent 46%, #b91c1c 46%, #b91c1c 54%, transparent 54%), repeating-conic-gradient(#e4e4e7 0% 25%, #fff 0% 50%) 0 0 / 8px 8px",
                          boxShadow:
                            stroke.fill === null
                              ? "0 0 0 2px var(--ring)"
                              : "inset 0 0 0 1px var(--swatch-edge)",
                        }}
                        onMouseDown={keepFocus}
                        onClick={() => onFill(null)}
                      />
                      {SWATCHES.map((swatch) => (
                        <button
                          key={swatch}
                          type="button"
                          aria-label={`Fill ${swatch}`}
                          aria-pressed={stroke.fill?.toLowerCase() === swatch}
                          className="size-5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{
                            background: swatch,
                            boxShadow:
                              stroke.fill?.toLowerCase() === swatch
                                ? "0 0 0 2px var(--ring)"
                                : "inset 0 0 0 1px var(--swatch-edge)",
                          }}
                          onMouseDown={keepFocus}
                          onClick={() => onFill(swatch)}
                        />
                      ))}
                    </div>
                    {stroke.fill && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          aria-label="Fill color"
                          value={stroke.fill}
                          className="h-8 w-10 shrink-0 cursor-pointer p-1"
                          onPointerDown={onAdjustStart}
                          onChange={(event) => onFill(event.target.value)}
                          onBlur={onAdjustEnd}
                        />
                        <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                          {stroke.fill}
                        </span>
                      </div>
                    )}
                    {stroke.fill && (
                      <NumberSlider
                        label="Opacity"
                        value={Math.round((stroke.fillOpacity ?? 1) * 100)}
                        min={0}
                        max={100}
                        onChange={(value) => onFillOpacity(value / 100)}
                        onAdjustStart={onAdjustStart}
                        onAdjustEnd={onAdjustEnd}
                      />
                    )}
                  </div>
                )}
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">Stroke</Label>
                  <div className="flex items-center gap-2">
                    <ColorControl
                      label="Stroke color"
                      appearance="stroke"
                      color={stroke.color}
                      onColor={onStrokeColor}
                      onAdjustStart={onAdjustStart}
                      onAdjustEnd={onAdjustEnd}
                    />
                    <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                      {stroke.color}
                    </span>
                  </div>
                </div>
                <NumberSlider
                  label="Stroke width"
                  value={stroke.strokeWidth}
                  min={1}
                  max={48}
                  onChange={onStrokeWidth}
                  onAdjustStart={onAdjustStart}
                  onAdjustEnd={onAdjustEnd}
                />
                {showInk && (
                  <>
                    <NumberSlider
                      label="Opacity"
                      value={opacity}
                      min={5}
                      max={100}
                      onChange={(value) => onOpacity(value / 100)}
                      onAdjustStart={onAdjustStart}
                      onAdjustEnd={onAdjustEnd}
                    />
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Tip</Label>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        value={stroke.cap}
                        onValueChange={(value) => {
                          if (value === "round" || value === "square" || value === "butt") onCap(value);
                        }}
                        aria-label="Stroke tip"
                      >
                        <ToggleGroupItem value="round" onMouseDown={keepFocus}>
                          Round
                        </ToggleGroupItem>
                        <ToggleGroupItem value="square" onMouseDown={keepFocus}>
                          Square
                        </ToggleGroupItem>
                        <ToggleGroupItem value="butt" onMouseDown={keepFocus}>
                          Flat
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Stroke</Label>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        value={dashValue}
                        onValueChange={(value) => {
                          const preset = DASHES.find((item) => item.id === value);
                          if (preset) onDash(preset.dash);
                        }}
                        aria-label="Stroke pattern"
                      >
                        {DASHES.map((item) => (
                          <ToggleGroupItem key={item.id} value={item.id} onMouseDown={keepFocus}>
                            {item.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  </>
                )}
              </>
            )}

            {view.panel === "content" && patch?.role === "text" && format && (
              <>
                <NumberSlider
                  label={format.selection ? "Size of the selection" : "Size"}
                  value={format.fontSize}
                  min={4}
                  max={120}
                  onChange={(fontSize) => onFormat({ fontSize })}
                  onAdjustStart={onFormatBegin}
                  onAdjustEnd={onFormatEnd}
                />
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">{format.selection ? "Style of the selection" : "Style"}</Label>
                  <div className="flex flex-wrap items-center gap-1">
                    <StyleToggles
                      state={{ bold: format.bold, italic: format.italic, underline: format.underline, strike: format.strike }}
                      onToggle={(key) => onFormat({ [key]: !format[key] })}
                    />
                    {format.wrap && <AlignToggles value={format.align} justify onAlign={(align) => onFormat({ align })} />}
                    <ColorControl
                      label="Text color"
                      appearance="text"
                      color={format.color}
                      onColor={(color) => onFormat({ color })}
                      onAdjustStart={onFormatBegin}
                      onAdjustEnd={onFormatEnd}
                    />
                  </div>
                </div>
              </>
            )}

            {view.panel === "content" && content?.text && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content.text}</p>
            )}

            {missing.length > 0 && (
              <p role="status" className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>{missingGlyphNote(missing, content?.kind)}</span>
              </p>
            )}

            {view.panel === "empty" && (
              <p className="text-sm leading-relaxed text-muted-foreground">{view.detail}</p>
            )}

            {canDelete && (
              <Button type="button" variant="outline" className="w-full text-destructive" onClick={onDelete}>
                <Trash2 />
                Delete selection
              </Button>
            )}
          </div>
        </ScrollArea>
      </div>
      </section>
      </div>
    </aside>
  );
}
