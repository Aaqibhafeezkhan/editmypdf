import { useState } from "react";
import { BRUSHES, DASHES, type Brush } from "./brushes.ts";
import { EMOJI_GROUPS, emojiSrc } from "./emojis.ts";
import { SignaturePanel } from "./SignaturePanel.tsx";
import { ShapeGlyph } from "./ShapeGlyph.tsx";
import { SHAPE_GROUPS, SHAPE_LABEL, type ShapeId } from "./shapes.ts";
import type { LineCap, StrokeStyle, Tool } from "./types.ts";
import { SWATCHES } from "./types.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

function StrokePreview({ brush, color }: { brush: Brush; color: string }) {
  return (
    <svg viewBox="0 0 148 36" className="h-9 w-full" aria-hidden="true">
      <path
        d="M6 24 C 28 6, 46 30, 74 16 S 118 8, 142 18"
        fill="none"
        stroke={color}
        strokeWidth={Math.min(brush.width, 16)}
        strokeOpacity={brush.opacity}
        strokeLinecap={brush.cap}
        strokeLinejoin={brush.cap === "square" ? "miter" : "round"}
        strokeDasharray={brush.dash ?? undefined}
      />
    </svg>
  );
}

function Swatches({
  label,
  color,
  onColor,
}: {
  label: string;
  color: string;
  onColor: (color: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5" role="group" aria-label={label}>
      {SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type="button"
          aria-label={`${label} ${swatch}`}
          aria-pressed={color.toLowerCase() === swatch}
          className="size-6 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            background: swatch,
            boxShadow:
              color.toLowerCase() === swatch
                ? "0 0 0 2px var(--ring)"
                : "inset 0 0 0 1px var(--swatch-edge)",
          }}
          onClick={() => onColor(swatch)}
        />
      ))}
    </div>
  );
}

export function ToolDock({
  tool,
  shape,
  stroke,
  onShape,
  onBrush,
  onStrokeColor,
  onStrokeWidth,
  onOpacity,
  onCap,
  onDash,
  onEmoji,
  onSignature,
  onAdjustStart,
  onAdjustEnd,
}: {
  tool: Tool;
  shape: ShapeId;
  stroke: StrokeStyle;
  onShape: (shape: ShapeId) => void;
  onEmoji: (emoji: string) => void;
  onSignature: (src: string, width: number, height: number) => void;
  onBrush: (brush: Brush) => void;
  onStrokeColor: (color: string) => void;
  onStrokeWidth: (width: number) => void;
  onOpacity: (opacity: number) => void;
  onCap: (cap: LineCap) => void;
  onDash: (dash: string | null) => void;
  onAdjustStart: () => void;
  onAdjustEnd: () => void;
}) {
  const drawing = tool === "pencil";
  const emojis = tool === "emoji";
  const [shapeQuery, setShapeQuery] = useState("");
  const [emojiQuery, setEmojiQuery] = useState("");
  if (tool === "signature") return <SignaturePanel onPlace={onSignature} />;
  const opacity = Math.round(stroke.opacity * 100);
  const dashValue = DASHES.find((item) => item.dash === stroke.dash)?.id ?? "solid";
  const shapeNeedle = shapeQuery.trim().toLowerCase();
  const emojiNeedle = emojiQuery.trim().toLowerCase();
  const shapeGroups = SHAPE_GROUPS.map((group) => ({
    ...group,
    ids: group.ids.filter((id) => SHAPE_LABEL[id].toLowerCase().includes(shapeNeedle)),
  })).filter((group) => group.ids.length > 0);
  const emojiGroups = EMOJI_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.name.toLowerCase().includes(emojiNeedle)),
  })).filter((group) => group.items.length > 0);
  const heading = drawing ? "Drawing" : emojis ? "Emojis" : "Shapes";
  const detail = drawing
    ? "Pen style, color, and stroke"
    : emojis
      ? "Choose an emoji to place it on the page"
      : "Choose a line or shape";

  return (
    <aside className="tool-dock" aria-label={drawing ? "Drawing options" : emojis ? "Emoji options" : "Shape options"}>
      <div className="px-4 pt-3.5 pb-2">
        <h2 className="text-sm font-semibold tracking-tight">{heading}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        {drawing ? null : (
          <Input
            value={emojis ? emojiQuery : shapeQuery}
            onChange={(event) => (emojis ? setEmojiQuery(event.target.value) : setShapeQuery(event.target.value))}
            placeholder={emojis ? "Search emojis" : "Search shapes"}
            aria-label={emojis ? "Search emojis" : "Search shapes"}
            className="mt-3 h-8"
          />
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-5 px-3 pt-1 pb-4">
          {drawing ? (
            <>
              <div className="grid gap-1.5" role="listbox" aria-label="Pen styles">
                {BRUSHES.map((brush) => {
                  const selected = stroke.brush === brush.id;
                  return (
                    <button
                      key={brush.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={
                        selected
                          ? "grid gap-1 rounded-lg border border-primary bg-accent px-2.5 py-2 text-left"
                          : "grid gap-1 rounded-lg border border-transparent px-2.5 py-2 text-left hover:bg-muted"
                      }
                      onClick={() => onBrush(brush)}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{brush.label}</span>
                        <span className="text-[11px] text-muted-foreground">{brush.detail}</span>
                      </span>
                      <StrokePreview brush={brush} color={stroke.color} />
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-2">
                <Label className="px-1 text-xs text-muted-foreground">Color</Label>
                <Swatches label="Stroke color" color={stroke.color} onColor={onStrokeColor} />
                <div className="flex items-center gap-2 px-1">
                  <Input
                    type="color"
                    aria-label="Stroke color"
                    value={stroke.color}
                    className="h-8 w-10 shrink-0 cursor-pointer p-1"
                    onPointerDown={onAdjustStart}
                    onChange={(event) => onStrokeColor(event.target.value)}
                    onBlur={onAdjustEnd}
                  />
                  <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                    {stroke.color}
                  </span>
                </div>
              </div>
              <div className="grid gap-2 px-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Stroke width</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{Math.round(stroke.strokeWidth)}</span>
                </div>
                <Slider
                  aria-label="Stroke width"
                  min={1}
                  max={48}
                  step={1}
                  value={[stroke.strokeWidth]}
                  onPointerDown={onAdjustStart}
                  onValueChange={(next) => onStrokeWidth(next[0] ?? stroke.strokeWidth)}
                  onValueCommit={onAdjustEnd}
                />
              </div>
              <div className="grid gap-2 px-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Opacity</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{opacity}%</span>
                </div>
                <Slider
                  aria-label="Opacity"
                  min={5}
                  max={100}
                  step={1}
                  value={[opacity]}
                  onPointerDown={onAdjustStart}
                  onValueChange={(next) => onOpacity((next[0] ?? opacity) / 100)}
                  onValueCommit={onAdjustEnd}
                />
              </div>
              <div className="grid gap-2 px-1">
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
                  <ToggleGroupItem value="round">Round</ToggleGroupItem>
                  <ToggleGroupItem value="square">Square</ToggleGroupItem>
                  <ToggleGroupItem value="butt">Flat</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="grid gap-2 px-1">
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
                    <ToggleGroupItem key={item.id} value={item.id}>
                      {item.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </>
          ) : emojis ? (
            emojiGroups.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">No emojis match.</p>
            ) : (
              emojiGroups.map((group) => (
                <div key={group.title} className="grid gap-2">
                  <p className="px-1 text-xs font-medium text-muted-foreground">{group.title}</p>
                  <div className="grid grid-cols-6 gap-1">
                    {group.items.map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label={item.name}
                        title={item.name}
                        onClick={() => onEmoji(item.id)}
                      >
                        <img src={emojiSrc(item.id)} alt="" className="size-6 object-contain" />
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )
          ) : shapeGroups.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">No shapes match.</p>
          ) : (
            shapeGroups.map((group) => (
              <div key={group.title} className="grid gap-2">
                <p className="px-1 text-xs font-medium text-muted-foreground">{group.title}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {group.ids.map((id) => (
                    <Button
                      key={id}
                      type="button"
                      variant={shape === id ? "secondary" : "ghost"}
                      aria-pressed={shape === id}
                      className="h-auto flex-col gap-1.5 px-1 py-2.5"
                      onClick={() => onShape(id)}
                    >
                      <ShapeGlyph id={id} className="size-7" />
                      <span className="text-[11px] leading-tight font-normal">{SHAPE_LABEL[id]}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
