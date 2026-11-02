// Runs after `vite build` (see the build script in package.json). It bundles src/entry-server.tsx,
// renders every public route of the site with it and writes each one to dist/<route>/index.html
// with its title, meta tags, canonical link and JSON-LD in <head> and its markup in #root. Crawlers
// and link previews then see the finished page without running JavaScript, and in the browser
// src/main.tsx hydrates the markup instead of drawing it again.
//
// The documents screen (/app) ships as the empty shell, as do dist/200.html and dist/404.html, one of
// which a host should serve for every address it has no file for (/edit/<id>, unknown paths).
//
// For AI agents and other readers that want text without the chrome, every page is also written as
// Markdown next to its HTML (dist/<route>.md, the home page at dist/index.md), listed in
// dist/llms.txt and concatenated in dist/llms-full.txt (https://llmstxt.org). Each HTML page links
// its Markdown twin with <link rel="alternate" type="text/markdown">.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import TurndownService from "turndown";
import gfmPlugin from "turndown-plugin-gfm";
import { build, loadEnv } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const serverDir = path.join(dist, ".prerender");
const ROOT_MARK = '<div id="root"></div>';
// Tags the template carries for the landing page, replaced per page in pageHtml. useMeta finds these same
// tags by selector in the browser and updates them in place.
const HEAD_TAGS =
  /[ \t]*(?:<title>[^<]*<\/title>|<meta\s[^>]*?(?:name|property)="(?:description|robots|keywords|og:[^"]*|twitter:[^"]*|article:[^"]*)"[^>]*>|<link\s[^>]*?rel="canonical"[^>]*>)[ \t]*\n?/g;


// Parts of a page that are decoration, navigation or sample content, not the page's text.
const NOISE = [
  "hero-window", // the editor mock and its callouts
  "vis", // illustrations with sample documents
  "preview-frame",
  "pd", // the privacy diagram
  "how-sticky", // the step strip (the steps follow)
  "toc", // the post's contents (the headings follow)
  "post-cover",
  "cmp-thumb",
  "duel",
  "glance-legend",
  "consent",
  "skip-link",
  "trust-strip",
];

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*" });
turndown.use(gfmPlugin.gfm);
turndown.remove(["script", "style", "svg", "img", "button", "nav", "template"]);
turndown.addRule("noise", {
  filter: (node) =>
    node.nodeType === 1 &&
    (node.nodeName === "IMG" ||
      node.nodeName === "SVG" ||
      node.getAttribute("aria-hidden") === "true" ||
      NOISE.some((name) => node.classList.contains(name))),
  replacement: () => "",
});
// The page's own first heading repeats the document title written above the body, and the
// eyebrow above it is a section label, not text.
turndown.addRule("page-title", {
  filter: (node) => node.nodeName === "H1" || (node.nodeType === 1 && node.classList.contains("eyebrow")),
  replacement: () => "",
});
// Small tags (price caveats) read as bracketed words; stacked spans in a cell as separate items.
turndown.addRule("tag", {
  filter: (node) => node.nodeType === 1 && node.classList.contains("tag"),
  replacement: (content) => (content.trim() ? ` [${content.trim()}]` : ""),
});
turndown.addRule("stacked", {
  filter: (node) => node.nodeType === 1 && node.nodeName === "SPAN" && /display:\s*block/.test(node.getAttribute("style") || ""),
  replacement: (content) => (content.trim() ? `${content.trim()} · ` : ""),
});
turndown.addRule("price", {
  filter: (node) => node.nodeType === 1 && node.classList.contains("price"),
  replacement: (content) => (content.trim() ? `${content.trim().replace(/\s+/g, " ")} ` : ""),
});
// A bold title followed by its one-line body in the same item ("**Open**: Drop a PDF…"), and a
// date or reading time followed by the next fact on the line.
turndown.addRule("titled-item", {
  filter: (node) => node.nodeName === "STRONG" && node.nextSibling?.nodeName === "SPAN",
  replacement: (content) => (content.trim() ? `**${content.trim()}**: ` : ""),
});
turndown.addRule("meta-line", {
  filter: (node) => node.nodeName === "TIME",
  replacement: (content) => (content.trim() ? `${content.trim()} · ` : ""),
});
// The feature label above a showcase title stands as a bold line; a post's lede repeats the
// description already written above the body.
turndown.addRule("showcase-label", {
  filter: (node) => node.nodeType === 1 && node.classList.contains("showcase-label"),
  replacement: (content) => (content.trim() ? `\n\n**${content.trim()}**\n\n` : ""),
});
turndown.addRule("post-lede", {
  filter: (node) => node.nodeType === 1 && node.classList.contains("lede") && node.closest(".post-header") !== null,
  replacement: () => "",
});
// Notes under a table cell's value read as a parenthesis instead of running into it.
turndown.addRule("cell-note", {
  filter: (node) => node.nodeType === 1 && node.classList.contains("cell-note"),
  replacement: (content) => (content.trim() ? ` (${content.trim()})` : ""),
});
// Links keep the site's addresses absolute when the origin is known; empty links vanish.
turndown.addRule("links", {
  filter: (node) => node.nodeName === "A" && node.getAttribute("href"),
  replacement: (content, node) => {
    const text = content.trim();
    if (!text) return "";
    const href = node.getAttribute("href");
    return `[${text}](${absolute(href)})`;
  },
});
// Definition lists (stats) as "term: description" lines.
turndown.addRule("dl", {
  filter: ["dt"],
  replacement: (content) => `\n- **${content.trim()}**`,
});
turndown.addRule("dd", {
  filter: ["dd"],
  replacement: (content) => (content.trim() ? `: ${content.trim()}\n` : "\n"),
});

// The client build's index.html is the template: it has the hashed script and stylesheet tags. Once
// this script has run, that file holds the landing page, and the untouched copy at 200.html serves.
const template = await readTemplate();

const { render, PUBLIC_ROUTES, PRODUCT } = await bundleServerEntry();
// The site's address for absolute links in the Markdown files: VITE_SITE_URL when the build has
// it, otherwise the base path alone (root-relative), the same rule as siteOrigin() in product.ts.
const env = loadEnv("production", root, "VITE_");
const origin = (env.VITE_SITE_URL ?? "").replace(/\/$/, "") || `/${(env.VITE_BASE ?? "").replace(/^\/+|\/+$/g, "")}`.replace(/^\/$/, "");

let count = 0;
const pages = [];
for (const route of PUBLIC_ROUTES) {
  const file = outputFile(route.path);
  if (route.shell) {
    await write(file, template);
    continue;
  }
  const page = await render(route.path);
  if (page.notFound) throw new Error(`${route.path} is in PUBLIC_ROUTES but rendered the not-found page.`);
  if (!page.meta) throw new Error(`${route.path} set no page meta (useMeta).`);
  await write(file, pageHtml(route.path, page));
  const markdown = pageMarkdown(route.path, page);
  await write(markdownFile(route.path), markdown);
  pages.push({ path: route.path, meta: page.meta, markdown });
  count += 1;
}
await write(path.join(dist, "llms.txt"), llmsIndex(pages));
await write(path.join(dist, "llms-full.txt"), pages.map((page) => page.markdown).join("\n\n---\n\n"));
await write(path.join(dist, "200.html"), template);
// GitHub Pages answers every address it has no file for with 404.html, so the shell goes there too;
// .nojekyll stops it from skipping files whose names begin with an underscore.
await write(path.join(dist, "404.html"), template);
await write(path.join(dist, ".nojekyll"), "");
await rm(serverDir, { recursive: true, force: true });
console.log(`prerendered ${count} pages into dist/ (plus the app shell at /app, 200.html and 404.html), each with a Markdown twin, llms.txt and llms-full.txt`);
if (!env.VITE_SITE_URL) {
  console.log("VITE_SITE_URL is not set, so canonical links, og:url and the sitemap are root-relative; set it to the address the site is served at for absolute ones.");
}

async function readTemplate() {
  for (const name of ["index.html", "200.html"]) {
    const html = await readFile(path.join(dist, name), "utf8").catch(() => "");
    if (html.includes(ROOT_MARK)) return html;
  }
  throw new Error("dist/ has no built index.html with an empty #root to fill; run `vite build` first.");
}

// Builds the server bundle into dist/.prerender and imports it. Dependencies stay external, so the
// bundle is small and runs against node_modules like any other script.
async function bundleServerEntry() {
  const result = await build({
    root,
    configFile: path.join(root, "vite.config.ts"),
    logLevel: "warn",
    build: {
      ssr: "src/entry-server.tsx",
      outDir: serverDir,
      emptyOutDir: true,
      copyPublicDir: false,
    },
  });
  const bundles = Array.isArray(result) ? result : [result];
  const entry = bundles.flatMap((bundle) => bundle.output ?? []).find((chunk) => chunk.type === "chunk" && chunk.isEntry);
  if (!entry) throw new Error("The server build produced no entry chunk.");
  return import(pathToFileURL(path.join(serverDir, entry.fileName)).href);
}

function outputFile(route) {
  return route === "/" ? path.join(dist, "index.html") : path.join(dist, ...route.split("/").filter(Boolean), "index.html");
}

// The Markdown twin sits at the page's address with ".md" appended; the home page at /index.md.
function markdownPath(route) {
  return route === "/" ? "/index.md" : `${route}.md`;
}

function markdownFile(route) {
  return path.join(dist, ...markdownPath(route).split("/").filter(Boolean));
}

// An absolute address when the build knows the site's origin, the base-relative one otherwise.
function absolute(href) {
  return /^[a-z]+:/i.test(href) ? href : `${origin}${href.startsWith("/") ? href : `/${href}`}`;
}

// ---- Markdown -------------------------------------------------------------------------------

// The page's main content as Markdown, with the title, description and canonical address on top.
function pageMarkdown(route, page) {
  const start = page.html.indexOf("<main");
  const end = page.html.lastIndexOf("</main>");
  const main = start >= 0 && end > start ? page.html.slice(start, end + "</main>".length) : page.html;
  const body = turndown
    .turndown(main)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const { meta } = page;
  const lines = [
    `# ${meta.title}`,
    "",
    `> ${meta.description}`,
    "",
    `Canonical: ${meta.url}`,
    meta.articlePublished ? `Published: ${meta.articlePublished}` : "",
    "",
    body,
    "",
    "---",
    "",
    `Markdown version of ${meta.url}. Every page of ${PRODUCT.name} has one at the same address with .md appended; the index is ${absolute("/llms.txt")}.`,
    "",
  ].filter((line, index, all) => !(line === "" && all[index - 1] === ""));
  return lines.join("\n");
}

// /llms.txt: the site in one Markdown file, with a link and a line per page (https://llmstxt.org).
function llmsIndex(pages) {
  const entry = (page) => `- [${page.meta.title}](${absolute(markdownPath(page.path))}): ${page.meta.description}`;
  const posts = pages.filter((page) => page.path.startsWith("/blog/"));
  const comparisons = pages.filter((page) => page.path.startsWith("/compare/"));
  const product = pages.filter((page) => !posts.includes(page) && !comparisons.includes(page));
  return [
    `# ${PRODUCT.name}`,
    "",
    `> ${PRODUCT.shortDescription}`,
    "",
    PRODUCT.description,
    "",
    `The editor runs entirely in the browser: pdf.js reads and renders the PDF in a web worker, pdf-lib writes the new file, and nothing is uploaded. Every page below has a Markdown version at its address with \`.md\` appended (the home page at \`/index.md\`); \`llms-full.txt\` next to this file holds all of them in one document. Facts about other PDF editors were checked on the dates each page states and link to their sources.`,
    "",
    "## Product",
    "",
    ...product.map(entry),
    "",
    "## Comparisons with other PDF editors",
    "",
    ...comparisons.map(entry),
    "",
    "## Engineering blog",
    "",
    ...posts.map(entry),
    "",
    "## Optional",
    "",
    `- [All pages in one file](${absolute("/llms-full.txt")}): the Markdown of every page above, concatenated`,
    `- [Sitemap](${absolute("/sitemap.xml")})`,
    `- [RSS feed](${absolute("/feed.xml")})`,
    `- [Source code](${PRODUCT.repository}): MIT licence`,
    "",
  ].join("\n");
}

async function write(file, contents) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents);
}

function pageHtml(route, page) {
  const { meta } = page;
  const tag = (attribute, key, content) => (content ? `<meta ${attribute}="${key}" content="${attr(content)}" />` : "");
  const head = [
    `<title>${text(meta.title)}</title>`,
    tag("name", "description", meta.description),
    tag("name", "robots", meta.robots),
    tag("name", "keywords", meta.keywords),
    tag("property", "og:site_name", meta.siteName),
    tag("property", "og:title", meta.title),
    tag("property", "og:description", meta.description),
    tag("property", "og:type", meta.type),
    tag("property", "og:url", meta.url),
    tag("property", "og:image", meta.image),
    tag("property", "og:image:width", meta.imageWidth),
    tag("property", "og:image:height", meta.imageHeight),
    tag("property", "og:image:alt", meta.imageAlt),
    tag("property", "og:locale", meta.locale),
    tag("property", "article:published_time", meta.articlePublished),
    tag("property", "article:modified_time", meta.articleModified),
    ...meta.articleTags.map((value) => tag("property", "article:tag", value)),
    tag("name", "twitter:card", "summary_large_image"),
    tag("name", "twitter:title", meta.title),
    tag("name", "twitter:description", meta.description),
    tag("name", "twitter:image", meta.image),
    `<link rel="canonical" href="${attr(meta.url)}" />`,
    `<link rel="alternate" type="text/markdown" href="${attr(absolute(markdownPath(route)))}" title="This page as Markdown" />`,
    // "<" inside the JSON is escaped so a string can never close the script element.
    meta.jsonLd ? `<script type="application/ld+json" data-page-ld="true">${meta.jsonLd.replace(/</g, "\\u003c")}</script>` : "",
  ]
    .filter(Boolean)
    .map((line) => `    ${line}`)
    .join("\n");
  return template
    .replace(HEAD_TAGS, "")
    .replace(/[ \t]*<\/head>/, `${head}\n  </head>`)
    .replace(ROOT_MARK, `<div id="root" data-prerendered="${attr(route)}">${page.html}</div>`);
}

function text(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function attr(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
