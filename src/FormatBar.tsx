import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Minus,
  Plus,
  Strikethrough,
  Underline,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorControl } from "./ColorControl.tsx";
import { keepFocus } from "./keepFocus.ts";
import type { FormatChange, FormatState } from "./textFormat.ts";

// A rectangle in viewport px.
export type Anchor = { left: number; top: number; right: number; bottom: number };

// The floating toolbar over the page's own text while it is being edited: bold, italic,
// underline, strikethrough, size, colour and (for a block) alignment. It is rendered at the
// document's root, fixed, so it sits above every page overlay, and nothing in it takes the focus
// from the editor except the size field.

type Props = {
  state: FormatState;
  // Where the selection or caret sits; the bar floats just above it (below, when there is no room).
  anchor: Anchor | null;
  // The area the bar stays inside: the page scroller.
  bounds: Anchor | null;
  onChange: (change: FormatChange) => void;
  onBegin: () => void;
  onEnd: () => void;
};

const GAP = 8;
const EDGE = 4;
const MIN_SIZE = 4;
const MAX_SIZE = 200;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function shownSize(size: number): string {
  return String(Math.round(size * 10) / 10);
}

export function FormatBar({ state, anchor, bounds, onChange, onBegin, onEnd }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // What the size field shows while it is being typed in; the state's size otherwise.
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);

  useLayoutEffect(() => {
    const bar = ref.current;
    if (!bar || !anchor) return;
    const size = bar.getBoundingClientRect();
    const area = bounds ?? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const left = clamp(anchor.left, area.left + EDGE, Math.max(area.left + EDGE, area.right - EDGE - size.width));
    let top = anchor.top - GAP - size.height;
    if (top < area.top + EDGE) top = anchor.bottom + GAP;
    if (top + size.height > area.bottom - EDGE) top = Math.max(area.top + EDGE, area.bottom - EDGE - size.height);
    bar.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    bar.style.visibility = "visible";
  });

  if (typeof document === "undefined" || !anchor) return null;

  const commitSize = () => {
    if (sizeDraft == null) return;
    const next = Number(sizeDraft);
    setSizeDraft(null);
    if (Number.isFinite(next) && next > 0) onChange({ fontSize: clamp(next, MIN_SIZE, MAX_SIZE) });
  };
  const stepSize = (delta: number) => {
    onChange({ fontSize: clamp(Math.round(state.fontSize + delta), MIN_SIZE, MAX_SIZE) });
  };
  const onSizeKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commitSize();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSizeDraft(null);
      event.currentTarget.blur();
    }
  };
  // Clicks on the bar's chrome leave the focus (and the selection) in the editor; the size field
  // is the one control that needs it.
  const holdFocus = (event: ReactMouseEvent<HTMLElement>) => {
    if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
  };
  const toggle = (key: "bold" | "italic" | "underline" | "strike", label: string, icon: React.ReactNode) => (
    <Toggle
      size="sm"
      aria-label={label}
      title={label}
      pressed={state[key]}
      onMouseDown={keepFocus}
      onPointerDown={keepFocus}
      onPressedChange={() => onChange({ [key]: !state[key] })}
    >
      {icon}
    </Toggle>
  );

  return createPortal(
    <div ref={ref} className="format-bar" role="toolbar" aria-label="Text formatting" onMouseDown={holdFocus}>
      {toggle("bold", "Bold", <Bold />)}
      {toggle("italic", "Italic", <Italic />)}
      {toggle("underline", "Underline", <Underline />)}
      {toggle("strike", "Strikethrough", <Strikethrough />)}
      <span className="format-bar-gap" />
      <button
        type="button"
        className="format-bar-step"
        aria-label="Smaller text"
        title="Smaller"
        onMouseDown={keepFocus}
        onPointerDown={keepFocus}
        onClick={() => stepSize(-1)}
      >
        <Minus />
      </button>
      <input
        type="number"
        className="format-bar-size"
        aria-label="Text size"
        min={MIN_SIZE}
        max={MAX_SIZE}
        step={0.5}
        value={sizeDraft ?? shownSize(state.fontSize)}
        onFocus={() => setSizeDraft(shownSize(state.fontSize))}
        onChange={(event) => setSizeDraft(event.target.value)}
        onBlur={commitSize}
        onKeyDown={onSizeKey}
      />
      <button
        type="button"
        className="format-bar-step"
        aria-label="Larger text"
        title="Larger"
        onMouseDown={keepFocus}
        onPointerDown={keepFocus}
        onClick={() => stepSize(1)}
      >
        <Plus />
      </button>
      <span className="format-bar-gap" />
      <ColorControl
        label="Text color"
        appearance="text"
        size="icon-sm"
        color={state.color}
        onColor={(color) => onChange({ color })}
        onAdjustStart={onBegin}
        onAdjustEnd={onEnd}
      />
      {state.wrap && (
        <>
          <span className="format-bar-gap" />
          <ToggleGroup
            type="single"
            size="sm"
            spacing={0}
            value={state.align}
            onValueChange={(value) => {
              if (value === "left" || value === "center" || value === "right" || value === "justify") onChange({ align: value });
            }}
            aria-label="Alignment"
          >
            <ToggleGroupItem value="left" aria-label="Align left" title="Align left" onMouseDown={keepFocus} onPointerDown={keepFocus}>
              <AlignLeft />
            </ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Align center" title="Align center" onMouseDown={keepFocus} onPointerDown={keepFocus}>
              <AlignCenter />
            </ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Align right" title="Align right" onMouseDown={keepFocus} onPointerDown={keepFocus}>
              <AlignRight />
            </ToggleGroupItem>
            <ToggleGroupItem value="justify" aria-label="Justify" title="Justify" onMouseDown={keepFocus} onPointerDown={keepFocus}>
              <AlignJustify />
            </ToggleGroupItem>
          </ToggleGroup>
        </>
      )}
    </div>,
    document.body,
  );
}
