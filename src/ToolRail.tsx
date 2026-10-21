import type { ReactNode } from "react";
import { Eraser, MousePointer2, Pencil, Signature, Smile, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShapeGlyph } from "./ShapeGlyph.tsx";
import type { ShapeId } from "./shapes.ts";
import type { Tool } from "./types.ts";

const TOOLS: { id: Exclude<Tool, "shape">; label: string; shortcut: string; icon: typeof Pencil }[] = [
  { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { id: "pencil", label: "Pencil", shortcut: "P", icon: Pencil },
  { id: "text", label: "Text", shortcut: "T", icon: Type },
  { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
];

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
        <Button
          type="button"
          variant={active ? "default" : "ghost"}
          size="icon"
          aria-pressed={active}
          aria-expanded={expanded}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
        <kbd className="rounded bg-background/20 px-1 font-sans text-[10px]">{shortcut}</kbd>
      </TooltipContent>
    </Tooltip>
  );
}

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
  const before = TOOLS.filter((item) => item.id === "select" || item.id === "pencil");
  const after = TOOLS.filter((item) => item.id === "text" || item.id === "eraser");

  return (
    <nav className="tool-rail" aria-label="Tools">
      <div className="flex flex-col items-center gap-1">
        {before.map((item) => {
          const Icon = item.icon;
          return (
            <ToolButton
              key={item.id}
              label={item.label}
              shortcut={item.shortcut}
              active={tool === item.id}
              expanded={item.id === "pencil" ? tool === "pencil" && panelOpen : undefined}
              onClick={() => onTool(item.id)}
            >
              <Icon />
            </ToolButton>
          );
        })}
      </div>
      <Separator className="my-1 w-6" />
      <ToolButton
        label="Shapes"
        shortcut="S"
        active={tool === "shape"}
        expanded={tool === "shape" && panelOpen}
        onClick={() => onTool("shape")}
      >
        <ShapeGlyph id={shape} />
      </ToolButton>
      <ToolButton
        label="Emojis"
        shortcut="M"
        active={tool === "emoji"}
        expanded={tool === "emoji" && panelOpen}
        onClick={() => onTool("emoji")}
      >
        <Smile />
      </ToolButton>
      <ToolButton
        label="Signature"
        shortcut="G"
        active={tool === "signature"}
        expanded={tool === "signature" && panelOpen}
        onClick={() => onTool("signature")}
      >
        <Signature />
      </ToolButton>
      <Separator className="my-1 w-6" />
      <div className="flex flex-col items-center gap-1">
        {after.map((item) => {
          const Icon = item.icon;
          return (
            <ToolButton
              key={item.id}
              label={item.label}
              shortcut={item.shortcut}
              active={tool === item.id}
              onClick={() => onTool(item.id)}
            >
              <Icon />
            </ToolButton>
          );
        })}
      </div>
    </nav>
  );
}
