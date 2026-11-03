import type { ReactNode } from "react";
import { Eraser, MousePointer2, Pencil, Signature, Smile, Type } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShapeGlyph } from "./ShapeGlyph.tsx";
import type { ShapeId } from "./shapes.ts";
import type { Tool } from "./types.ts";

function ToolButton({
  label,
  shortcut,
  active,
  expanded,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  active: boolean;
  expanded?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="rail-button"
          aria-pressed={active}
          aria-expanded={expanded}
          aria-label={label}
          aria-keyshortcuts={shortcut}
          onClick={onClick}
        >
          <span className="rail-icon" aria-hidden="true">
            {children}
          </span>
          <span className="rail-label" aria-hidden="true">
            {label}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
        <kbd className="tip-kbd">{shortcut}</kbd>
      </TooltipContent>
    </Tooltip>
  );
}

// The tools down the left edge, in three groups: selecting, inserting, removing. The inserting
// tools with options (pencil, shapes, emoji, signature) open the options panel beside the rail.
export function ToolRail({
  tool,
  shape,
  panelOpen,
  onTool,
}: {
  tool: Tool;
  shape: ShapeId;
  panelOpen: boolean;
  onTool: (tool: Tool) => void;
}) {
  const expanded = (id: Tool) => (tool === id && panelOpen ? true : false);
  return (
    <nav className="tool-rail" aria-label="Tools">
      <div className="rail-group" role="group" aria-label="Select">
        <ToolButton label="Select" shortcut="V" active={tool === "select"} onClick={() => onTool("select")}>
          <MousePointer2 />
        </ToolButton>
      </div>
      <div className="rail-group" role="group" aria-label="Insert">
        <ToolButton label="Text" shortcut="T" active={tool === "text"} onClick={() => onTool("text")}>
          <Type />
        </ToolButton>
        <ToolButton
          label="Pencil"
          shortcut="P"
          active={tool === "pencil"}
          expanded={expanded("pencil")}
          onClick={() => onTool("pencil")}
        >
          <Pencil />
        </ToolButton>
        <ToolButton
          label="Shapes"
          shortcut="S"
          active={tool === "shape"}
          expanded={expanded("shape")}
          onClick={() => onTool("shape")}
        >
          <ShapeGlyph id={shape} className="size-[18px]" />
        </ToolButton>
        <ToolButton
          label="Emoji"
          shortcut="M"
          active={tool === "emoji"}
          expanded={expanded("emoji")}
          onClick={() => onTool("emoji")}
        >
          <Smile />
        </ToolButton>
        <ToolButton
          label="Sign"
          shortcut="G"
          active={tool === "signature"}
          expanded={expanded("signature")}
          onClick={() => onTool("signature")}
        >
          <Signature />
        </ToolButton>
      </div>
      <div className="rail-group" role="group" aria-label="Remove">
        <ToolButton label="Eraser" shortcut="E" active={tool === "eraser"} onClick={() => onTool("eraser")}>
          <Eraser />
        </ToolButton>
      </div>
    </nav>
  );
}
