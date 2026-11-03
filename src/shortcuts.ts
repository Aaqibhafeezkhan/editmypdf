// Keyboard shortcut labels for menus and tooltips: the Mac's modifier symbols on a Mac, "Ctrl+…"
// everywhere else. Callers name the modifiers ("mod" is ⌘ or Ctrl) and the key; the platform's
// conventional order is applied here.

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const MODIFIERS = ["ctrl", "alt", "shift", "mod"] as const;

type Modifier = (typeof MODIFIERS)[number];

const MAC_SYMBOLS: Record<string, string> = {
  ctrl: "⌃",
  alt: "⌥",
  shift: "⇧",
  mod: "⌘",
  backspace: "⌫",
  delete: "⌦",
  enter: "↩",
  escape: "⎋",
  plus: "+",
  minus: "−",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

const OTHER_NAMES: Record<string, string> = {
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  mod: "Ctrl",
  backspace: "Backspace",
  delete: "Del",
  enter: "Enter",
  escape: "Esc",
  plus: "+",
  minus: "-",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
};

function isModifier(key: string): key is Modifier {
  return (MODIFIERS as readonly string[]).includes(key);
}

// shortcut("shift", "mod", "z") → "⇧⌘Z" on a Mac, "Ctrl+Shift+Z" elsewhere.
export function shortcut(...keys: string[]): string {
  const modifiers = keys.filter(isModifier);
  const rest = keys.filter((key) => !isModifier(key));
  if (isMac) {
    const ordered = MODIFIERS.filter((modifier) => modifiers.includes(modifier));
    return [...ordered, ...rest].map((key) => MAC_SYMBOLS[key] ?? key.toUpperCase()).join("");
  }
  const order: string[] = ["mod", "ctrl", "alt", "shift"];
  const ordered = order.filter((modifier) => modifiers.includes(modifier as Modifier));
  return [...ordered, ...rest].map((key) => OTHER_NAMES[key] ?? key.toUpperCase()).join("+");
}
