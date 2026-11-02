// Runs after `vite build` (see the build script in package.json). It bundles src/entry-server.tsx,
// renders every public route of the site with it and writes each one to dist/<route>/index.html
// with its title, meta tags, canonical link and JSON-LD in <head> and its markup in #root. Crawlers
// and link previews then see the finished page without running JavaScript, and in the browser
// src/main.tsx hydrates the markup instead of drawing it again.
//
// The documents screen (/app) ships as the empty shell, as do dist/200.html and dist/404.html, one of
// which a host should serve for every address it has no file for (/edit/<id>, unknown paths).
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, loadEnv } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const serverDir = path.join(dist, ".prerender");
const ROOT_MARK = '<div id="root"></div>';
// Tags the template carries for the landing page, replaced per page in pageHtml. useMeta finds these same
// tags by selector in the browser and updates them in place.
const HEAD_TAGS =
  /[ \t]*(?:<title>[^<]*<\/title>|<meta\s[^>]*?(?:name|property)="(?:description|robots|keywords|og:[^"]*|twitter:[^"]*)"[^>]*>|<link\s[^>]*?rel="canonical"[^>]*>)[ \t]*\n?/g;


// The client build's index.html is the template: it has the hashed script and stylesheet tags. Once
// this script has run, that file holds the landing page, and the untouched copy at 200.html serves.
const template = await readTemplate();

const { render, PUBLIC_ROUTES } = await bundleServerEntry();

let count = 0;
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
  count += 1;
}
await write(path.join(dist, "200.html"), template);
// GitHub Pages answers every address it has no file for with 404.html, so the shell goes there too;
// .nojekyll stops it from skipping files whose names begin with an underscore.
await write(path.join(dist, "404.html"), template);
await write(path.join(dist, ".nojekyll"), "");
await rm(serverDir, { recursive: true, force: true });
console.log(`prerendered ${count} pages into dist/ (plus the app shell at /app, 200.html and 404.html)`);
if (!loadEnv("production", root, "VITE_").VITE_SITE_URL) {
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
    tag("name", "twitter:card", "summary_large_image"),
    tag("name", "twitter:title", meta.title),
    tag("name", "twitter:description", meta.description),
    tag("name", "twitter:image", meta.image),
    `<link rel="canonical" href="${attr(meta.url)}" />`,
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
