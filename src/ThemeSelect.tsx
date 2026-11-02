import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { applyTheme, isThemeChoice, readTheme, storeTheme, subscribeTheme, type ThemeChoice } from "./theme.ts";

const OPTIONS: { id: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

const serverTheme = (): ThemeChoice => "system";

export function ThemeSelect() {
  // The choice lives in localStorage, which prerendered HTML cannot know: while that markup is
  // hydrated the server's "system" is used, and React re-renders with the stored choice right after.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
  const Current = OPTIONS.find((option) => option.id === theme)?.icon ?? Monitor;

  // main.tsx applies the stored theme on load and storeTheme applies a new choice; this only follows
  // the operating system while the choice is "system".
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(theme);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Theme: ${theme}`}>
              <Current />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          Theme
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-40!">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            if (!isThemeChoice(value)) return;
            storeTheme(value);
          }}
        >
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              <option.icon />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
