import type { ComponentType, ReactNode } from "react";
import { Menu as MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";

// The application menus as data, so the same File / Edit / View / Insert definitions are drawn as
// a menu bar in a wide window and folded into one menu button in a narrow one.

export type MenuEntry =
  | {
      kind: "item";
      label: string;
      icon?: ReactNode;
      shortcut?: string;
      disabled?: boolean;
      destructive?: boolean;
      onSelect: () => void;
    }
  | { kind: "check"; label: string; icon?: ReactNode; shortcut?: string; checked: boolean; onSelect: () => void }
  | {
      kind: "radio";
      value: string;
      options: { value: string; label: string; icon?: ReactNode }[];
      onChange: (value: string) => void;
    }
  | { kind: "sub"; label: string; icon?: ReactNode; entries: MenuEntry[] }
  | { kind: "separator" }
  | { kind: "label"; label: string };

export type MenuDef = { id: string; label: string; entries: MenuEntry[] };

type Kit = {
  Item: ComponentType<{
    onSelect?: (event: Event) => void;
    disabled?: boolean;
    variant?: "default" | "destructive";
    children?: ReactNode;
  }>;
  CheckboxItem: ComponentType<{ checked?: boolean; onSelect?: (event: Event) => void; children?: ReactNode }>;
  RadioGroup: ComponentType<{ value?: string; onValueChange?: (value: string) => void; children?: ReactNode }>;
  RadioItem: ComponentType<{ value: string; children?: ReactNode }>;
  Label: ComponentType<{ children?: ReactNode }>;
  Separator: ComponentType<{ className?: string }>;
  Shortcut: ComponentType<{ children?: ReactNode }>;
  Sub: ComponentType<{ children?: ReactNode }>;
  SubTrigger: ComponentType<{ children?: ReactNode }>;
  SubContent: ComponentType<{ children?: ReactNode }>;
};

const menubarKit: Kit = {
  Item: MenubarItem,
  CheckboxItem: MenubarCheckboxItem,
  RadioGroup: MenubarRadioGroup,
  RadioItem: MenubarRadioItem,
  Label: MenubarLabel,
  Separator: MenubarSeparator,
  Shortcut: MenubarShortcut,
  Sub: MenubarSub,
  SubTrigger: MenubarSubTrigger,
  SubContent: MenubarSubContent,
};

const dropdownKit: Kit = {
  Item: DropdownMenuItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

function renderEntries(kit: Kit, entries: MenuEntry[], prefix: string): ReactNode[] {
  return entries.map((entry, index) => {
    const key = `${prefix}-${index}`;
    switch (entry.kind) {
      case "separator":
        return <kit.Separator key={key} />;
      case "label":
        return <kit.Label key={key}>{entry.label}</kit.Label>;
      case "item":
        return (
          <kit.Item
            key={key}
            disabled={entry.disabled}
            variant={entry.destructive ? "destructive" : "default"}
            onSelect={entry.onSelect}
          >
            {entry.icon}
            {entry.label}
            {entry.shortcut && <kit.Shortcut>{entry.shortcut}</kit.Shortcut>}
          </kit.Item>
        );
      case "check":
        return (
          <kit.CheckboxItem key={key} checked={entry.checked} onSelect={entry.onSelect}>
            {entry.icon}
            {entry.label}
            {entry.shortcut && <kit.Shortcut>{entry.shortcut}</kit.Shortcut>}
          </kit.CheckboxItem>
        );
      case "radio":
        return (
          <kit.RadioGroup key={key} value={entry.value} onValueChange={entry.onChange}>
            {entry.options.map((option) => (
              <kit.RadioItem key={option.value} value={option.value}>
                {option.icon}
                {option.label}
              </kit.RadioItem>
            ))}
          </kit.RadioGroup>
        );
      case "sub":
        return (
          <kit.Sub key={key}>
            <kit.SubTrigger>
              {entry.icon}
              {entry.label}
            </kit.SubTrigger>
            <kit.SubContent>{renderEntries(kit, entry.entries, key)}</kit.SubContent>
          </kit.Sub>
        );
      default:
        return null;
    }
  });
}

// The menus side by side, each opening below its name.
export function MenuBar({ menus }: { menus: MenuDef[] }) {
  return (
    <Menubar className="app-menubar" aria-label="Application menu">
      {menus.map((menu) => (
        <MenubarMenu key={menu.id}>
          <MenubarTrigger>{menu.label}</MenubarTrigger>
          <MenubarContent>{renderEntries(menubarKit, menu.entries, menu.id)}</MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  );
}

// The same menus behind one button, each as a submenu, for windows too narrow for the bar.
export function MenuButton({ menus }: { menus: MenuDef[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Menu">
          <MenuIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52!">
        {menus.map((menu) => (
          <DropdownMenuSub key={menu.id}>
            <DropdownMenuSubTrigger>{menu.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-52">
              {renderEntries(dropdownKit, menu.entries, menu.id)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
