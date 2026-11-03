import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { keepFocus } from "./keepFocus.ts";
import { SWATCHES } from "./types.ts";

// A colour button that opens swatches, a picker and a hex field. Opening and closing bracket one
// adjustment (one undo step), and nothing in it takes the focus away from an open editor.
export function ColorControl({
  label,
  color,
  appearance,
  size = "icon",
  onColor,
  onAdjustStart,
  onAdjustEnd,
}: {
  label: string;
  color: string;
  appearance: "text" | "stroke";
  size?: "icon" | "icon-sm";
  onColor: (color: string) => void;
  onAdjustStart: () => void;
  onAdjustEnd: () => void;
}) {
  // The hex field's text while it is typed in; it follows the colour whenever that changes outside.
  const [draft, setDraft] = useState(color);
  const [shown, setShown] = useState(color);
  if (shown !== color) {
    setShown(color);
    setDraft(color);
  }

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
          size={size}
          aria-label={label}
          title={label}
          onMouseDown={keepFocus}
          onPointerDown={keepFocus}
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
      <PopoverContent align="end" className="w-56 gap-3" onOpenAutoFocus={keepFocus}>
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
