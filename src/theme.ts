export type ThemeChoice = "system" | "light" | "dark";

const THEME_KEY = "pdf-editor:theme";

export function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

export function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isThemeChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function systemIsDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: ThemeChoice): void {
  const dark = theme === "dark" || (theme === "system" && systemIsDark());
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.appearance = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
}

export function storeTheme(theme: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // The choice still applies for this visit.
  }
  applyTheme(theme);
}
