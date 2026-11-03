import { useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { ChevronDown, ChevronUp, Maximize, Minus, PanelLeft, Plus, RotateCw, UnfoldHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { shortcut } from "./shortcuts.ts";

export type FitMode = "page" | "width" | "height";

function StatusButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="status-button"
          aria-label={label}
          aria-pressed={pressed}
          aria-disabled={disabled}
          onClick={() => {
            if (!disabled) onClick();
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// The strip along the bottom of the viewer: the pages panel toggle, the page number (editable),
// the fit and rotate actions and the zoom.
export function StatusBar({
  pageNumber,
  pageTotal,
  onGoToPage,
  scale,
  minZoom,
  maxZoom,
  presets,
  onScale,
  onFit,
  onRotate,
  pagesPanelOpen,
  onTogglePagesPanel,
}: {
  pageNumber: number;
  pageTotal: number;
  onGoToPage: (page: number) => void;
  scale: number;
  minZoom: number;
  maxZoom: number;
  presets: number[];
  onScale: (scale: number) => void;
  onFit: (mode: FitMode) => void;
  onRotate: () => void;
  pagesPanelOpen: boolean;
  onTogglePagesPanel: () => void;
}) {
  // What the page field shows while it is typed in; the current page otherwise.
  const [draft, setDraft] = useState<string | null>(null);
  const percent = Math.round(scale * 100);
  const matchedPreset = presets.find((preset) => Math.abs(preset - scale) < 0.008);
  const digits = Math.max(2, String(pageTotal).length);

  const commit = () => {
    if (draft === null) return;
    const next = Number.parseInt(draft, 10);
    setDraft(null);
    if (Number.isFinite(next)) onGoToPage(Math.min(pageTotal, Math.max(1, next)));
  };
  const onKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(null);
      event.currentTarget.blur();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onGoToPage(Math.max(1, pageNumber - 1));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      onGoToPage(Math.min(pageTotal, pageNumber + 1));
    }
  };

  return (
    <footer className="status-bar" aria-label="Pages and zoom">
      <div className="status-group status-pages">
        <StatusButton label={pagesPanelOpen ? "Hide page thumbnails" : "Show page thumbnails"} pressed={pagesPanelOpen} onClick={onTogglePagesPanel}>
          <PanelLeft />
        </StatusButton>
        <span className="status-sep" />
        <StatusButton label="Previous page" disabled={pageNumber <= 1} onClick={() => onGoToPage(pageNumber - 1)}>
          <ChevronUp />
        </StatusButton>
        <label className="page-field">
          <span className="sr-only">Page</span>
          <input
            className="page-field-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            style={{ width: `${digits + 1}ch` }}
            value={draft ?? String(pageNumber)}
            aria-label={`Page ${pageNumber} of ${pageTotal}`}
            onFocus={(event) => {
              setDraft(String(pageNumber));
              event.currentTarget.select();
            }}
            onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ""))}
            onBlur={commit}
            onKeyDown={onKey}
          />
          <span className="page-field-total" aria-hidden="true">
            / {pageTotal}
          </span>
        </label>
        <StatusButton label="Next page" disabled={pageNumber >= pageTotal} onClick={() => onGoToPage(pageNumber + 1)}>
          <ChevronDown />
        </StatusButton>
      </div>

      <div className="status-spacer" />

      <div className="status-group status-view">
        <StatusButton label="Fit to width" onClick={() => onFit("width")}>
          <UnfoldHorizontal />
        </StatusButton>
        <StatusButton label="Fit page" onClick={() => onFit("page")}>
          <Maximize />
        </StatusButton>
        <span className="status-sep" />
        <StatusButton label="Rotate pages" onClick={onRotate}>
          <RotateCw />
        </StatusButton>
      </div>

      <div className="status-group status-zoom">
        <StatusButton label="Zoom out" disabled={scale <= minZoom} onClick={() => onScale(scale / 1.1)}>
          <Minus />
        </StatusButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="zoom-value" aria-label={`Zoom ${percent}%, choose a zoom level`}>
              {percent}%
              <ChevronDown aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-48!">
            <DropdownMenuItem onSelect={() => onScale(1)}>
              Actual size
              <DropdownMenuShortcut>{shortcut("mod", "0")}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onFit("page")}>Fit page</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onFit("width")}>Fit width</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onFit("height")}>Fit height</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={matchedPreset === undefined ? "" : String(matchedPreset)}
              onValueChange={(value) => onScale(Number(value))}
            >
              {presets.map((preset) => (
                <DropdownMenuRadioItem key={preset} value={String(preset)}>
                  {Math.round(preset * 100)}%
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <StatusButton label="Zoom in" disabled={scale >= maxZoom} onClick={() => onScale(scale * 1.1)}>
          <Plus />
        </StatusButton>
        <Slider
          className="zoom-slider"
          aria-label="Zoom"
          min={minZoom}
          max={maxZoom}
          step={0.05}
          value={[scale]}
          onValueChange={(next) => onScale(next[0] ?? scale)}
        />
      </div>
    </footer>
  );
}
