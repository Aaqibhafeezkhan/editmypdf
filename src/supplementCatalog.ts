// The bundled supplement fonts: every file of the Fontsource packages below that the editor may
// need, as the address it is served from. Loaded only once a document asks for a supplement, so
// the list of addresses stays out of the first bundle; each font file is fetched only when a
// character it holds is needed, since every face is declared with the file's Unicode range.
//
// The weights stop at the ones a page font's name can ask for (`weightOfName`), and the subsets
// at the scripts a Latin, Greek or Cyrillic document mixes; a Devanagari or Hebrew page keeps its
// own embedded font's coverage.

const FILES = import.meta.glob(
  "/node_modules/@fontsource/{tinos,arimo,cousine,carlito,caladea,gelasio,roboto,open-sans,lato,noto-serif,noto-sans,noto-sans-mono}/files/*-{latin,latin-ext,cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-{300,400,500,600,700,900}-{normal,italic}.woff",
  { query: "?url", import: "default", eager: true },
) as Record<string, string>;

const RANGES = import.meta.glob(
  "/node_modules/@fontsource/{tinos,arimo,cousine,carlito,caladea,gelasio,roboto,open-sans,lato,noto-serif,noto-sans,noto-sans-mono}/unicode.json",
  { import: "default", eager: true },
) as Record<string, Record<string, string>>;

export type CatalogFile = { id: string; subset: string; weight: number; style: "normal" | "italic"; url: string };

export type Catalog = {
  files: CatalogFile[];
  // The code points each subset of a family covers, by `${id}/${subset}`, as Fontsource states them.
  ranges: Map<string, [number, number][]>;
};

const FILE_PATH = /@fontsource\/([^/]+)\/files\/.*-(latin|latin-ext|cyrillic|cyrillic-ext|greek|greek-ext|vietnamese)-(\d+)-(normal|italic)\.woff$/;
const PACKAGE_PATH = /@fontsource\/([^/]+)\/unicode\.json$/;

// "U+0000-00FF,U+0131,U+0152-0153" as inclusive code point ranges.
export function parseRanges(value: string): [number, number][] {
  const out: [number, number][] = [];
  for (const part of value.split(",")) {
    const match = /^\s*U\+([0-9a-f?]+)(?:-([0-9a-f]+))?\s*$/i.exec(part);
    if (!match?.[1]) continue;
    const start = Number.parseInt(match[1].replace(/\?/g, "0"), 16);
    const end = match[2] ? Number.parseInt(match[2], 16) : Number.parseInt(match[1].replace(/\?/g, "f"), 16);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) out.push([start, end]);
  }
  return out;
}

export function catalog(): Catalog {
  const files: CatalogFile[] = [];
  for (const [path, url] of Object.entries(FILES)) {
    const match = FILE_PATH.exec(path);
    if (!match?.[1] || !match[2] || !match[3] || !match[4]) continue;
    files.push({ id: match[1], subset: match[2], weight: Number(match[3]), style: match[4] === "italic" ? "italic" : "normal", url });
  }
  const ranges = new Map<string, [number, number][]>();
  for (const [path, table] of Object.entries(RANGES)) {
    const match = PACKAGE_PATH.exec(path);
    if (!match?.[1] || !table || typeof table !== "object") continue;
    for (const [subset, value] of Object.entries(table)) {
      if (typeof value === "string") ranges.set(`${match[1]}/${subset}`, parseRanges(value));
    }
  }
  return { files, ranges };
}
