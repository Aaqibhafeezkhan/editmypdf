import { useEffect, useState } from "react";

const INSPECTOR_KEY = "pdf-editor:inspector";

function readInspectorOpen(): boolean {
  try {
    return localStorage.getItem(INSPECTOR_KEY) !== "closed";
  } catch {
    return true;
  }
}
import { contentDetail, contentLabel, type ContentElement } from "./content.ts";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  PanelRightClose,
  PanelRightOpen,
  Trash2,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import type { Align, Annotation, FontId, LineCap, StrokeStyle, TextStyle, Tool } from "./types.ts";
import { FONT_OPTIONS, SWATCHES } from "./types.ts";

function keepFocus(event: { preventDefault: () => void }) {
  event.preventDefault();
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

function ColorControl({
  label,
  color,
  appearance,
  onColor,
  onAdjustStart,
  onAdjustEnd,
}: {
  label: string;
  color: string;
  appearance: "text" | "stroke";
  onColor: (color: string) => void;
  onAdjustStart: () => void;
  onAdjustEnd: () => void;
}) {
  const [draft, setDraft] = useState(color);
  useEffect(() => setDraft(color), [color]);

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) onAdjustStart();
        else onAdjustEnd();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={label}
          title={label}
          onMouseDown={keepFocus}
        >
          {appearance === "text" ? (
            <span className="flex flex-col items-center gap-0.5">
              <span className="text-[13px] leading-none font-semibold">A</span>
              <span className="h-0.5 w-3.5 rounded-full" style={{ background: color }} />
            </span>
          ) : (
            <span
              className="size-3.5 rounded-full"
              style={{ background: color, boxShadow: "inset 0 0 0 1px var(--swatch-edge)" }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 gap-3">
        <div className="grid grid-cols-8 gap-1.5" role="group" aria-label={`${label} swatches`}>
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`${label} ${swatch}`}
              className="size-5 rounded-full ring-offset-2 ring-offset-popover outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                background: swatch,
                boxShadow: color.toLowerCase() === swatch ? "0 0 0 2px var(--ring)" : "inset 0 0 0 1px var(--swatch-edge)",
              }}
              onMouseDown={keepFocus}
              onClick={() => onColor(swatch)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            aria-label={label}
            value={color}
            className="h-8 w-10 shrink-0 cursor-pointer p-1"
            onPointerDown={onAdjustStart}
            onChange={(event) => onColor(event.target.value)}
            onBlur={onAdjustEnd}
          />
          <Input
            aria-label={`${label} hex`}
            value={draft}
            spellCheck={false}
            className="font-mono uppercase"
            onFocus={onAdjustStart}
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              if (/^#[0-9a-fA-F]{6}$/.test(next)) onColor(next);
            }}
            onBlur={onAdjustEnd}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
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
  onToggle: (key: "bold" | "italic" | "underline") => void;
  onAlign: (align: Align) => void;
  onWidth: (width: number) => void;
  onAutoWidth: (autoWidth: boolean) => void;
  onAdjustStart: () => void;
  onAdjustEnd: () => void;
  canDelete: boolean;
  onDelete: () => void;
  content: ContentElement | null;
}) {
  const view = panelFor(tool, selectedKind, shape, selectedShape, content);
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

  return (
    <aside className={open ? "inspector" : "inspector collapsed"} aria-label="Properties">
      <div className="inspector-body">
      <div className="flex items-start gap-2 px-2.5 py-2.5">
        <div className="min-w-0 flex-1 px-1.5 pt-0.5" aria-hidden={!open}>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{view.detail}</p>
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
                    <Toggle
                      variant="outline"
                      size="sm"
                      aria-label="Bold"
                      pressed={text.bold}
                      onMouseDown={keepFocus}
                      onPressedChange={() => onToggle("bold")}
                    >
                      <Bold />
                    </Toggle>
                    <Toggle
                      variant="outline"
                      size="sm"
                      aria-label="Italic"
                      pressed={text.italic}
                      onMouseDown={keepFocus}
                      onPressedChange={() => onToggle("italic")}
                    >
                      <Italic />
                    </Toggle>
                    <Toggle
                      variant="outline"
                      size="sm"
                      aria-label="Underline"
                      pressed={text.underline}
                      onMouseDown={keepFocus}
                      onPressedChange={() => onToggle("underline")}
                    >
                      <Underline />
                    </Toggle>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      size="sm"
                      spacing={1}
                      value={text.align}
                      onValueChange={(value) => {
                        if (value === "left" || value === "center" || value === "right") onAlign(value);
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
                    </ToggleGroup>
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

            {view.panel === "content" && content?.text && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content.text}</p>
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
      </div>
    </aside>
  );
}
