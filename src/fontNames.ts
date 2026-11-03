// What a PDF font's name says about the face: the typeface it belongs to and its weight and slant.
// A PDF names an embedded font by its PostScript name behind a six-letter subset prefix
// ("ABCDEF+TimesNewRomanPS-BoldMT"), so the name is the one thing every generator agrees on.

export type FaceKind = "serif" | "sans" | "mono";
export type FaceStyle = "normal" | "italic";

// What a font's name says about it: the typeface it belongs to (the name without its subset
// prefix and its weight, slant and foundry words) and whether it is a bold or an italic cut.
export type FaceTraits = { stem: string; bold: boolean; italic: boolean };

const STYLE_WORDS = /bold|black|heavy|italic|oblique|slanted|kursiv|regular|roman|book|medium|light|semi|demi|normal/gi;

// Words in a font's name that say it is bold or italic. pdf.js sets its own bold and italic flags
// only for fonts it had to substitute; an embedded face says so in its name alone.
export const BOLD_NAME = /bold|black|heavy|cm(?:bx|b|ssbx|bxti|bxsl)\d|sfbx\d/i;
export const ITALIC_NAME = /italic|oblique|slanted|kursiv|cm(?:ti|bxti|sl|bxsl|mi)\d|sfti\d/i;

// The name without the subset prefix a PDF puts in front of an embedded font's name.
export function bareName(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, "");
}

export function stemOf(name: string): string {
  return bareName(name)
    .replace(STYLE_WORDS, "")
    .replace(/[^a-z0-9]/gi, "")
    .replace(/(psmt|mt|ps)$/i, "")
    .toLowerCase();
}

export function traitsOfName(name: string): FaceTraits {
  const bare = bareName(name);
  return { stem: stemOf(bare), bold: BOLD_NAME.test(bare), italic: ITALIC_NAME.test(bare) };
}

// One short token for a typeface and cut, the same for every name of the same face, usable in a
// CSS family name: "timesnewroman-b" for the bold of Times New Roman.
export function traitKey(traits: FaceTraits): string {
  return `${traits.stem || "font"}-${traits.bold ? "b" : ""}${traits.italic ? "i" : ""}`;
}

// The CSS weight a font's name asks for, finer than bold or not: a heading set in a Medium or a
// Light cut should get the same cut of its supplement. Nimbus names its bold "Medi".
export function weightOfName(name: string, bold: boolean): number {
  const bare = bareName(name);
  if (/black|heavy/i.test(bare)) return 900;
  if (/extra\s*bold|ultra\s*bold|xbold/i.test(bare)) return 800;
  if (/semi\s*bold|demi\s*bold|semibd|demibd|\bdemi\b/i.test(bare)) return 600;
  if (bold || /nimbus.*medi/i.test(bare)) return 700;
  if (/medium|\bmedi\b/i.test(bare)) return 500;
  if (/light|thin|hairline/i.test(bare)) return 300;
  return 400;
}

const WEIGHT_WORDS: Record<number, string> = {
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
};

// "Tinos Bold", "Noto Sans Medium Italic", "Arimo": how a cut of a family is named to the user.
export function cutLabel(family: string, weight: number, style: FaceStyle): string {
  return [family, WEIGHT_WORDS[weight] ?? "", style === "italic" ? "Italic" : ""].filter(Boolean).join(" ");
}

// The CSS family a font the user adds for the face with trait key `key` is registered under. It is
// listed for every embedded font, so a font added later takes effect without the page being read
// again; an unknown family in the list costs nothing.
export function userFamilyName(key: string): string {
  return `stet-user-${key}`;
}
