# Stet

A PDF editor that runs entirely in the browser. It edits the text a page already has, in the page's
own embedded font, and writes the result back as real text. It also annotates: pencil, shapes,
text boxes, emoji and signatures. Nothing is uploaded; pdf.js reads the file in a web worker and
pdf-lib writes the new one in the same tab.

"Stet" is a working name. The package and repository are still called `pdf-editor`.

## Run it

```bash
npm install
npm run dev
```

`npm run build` type-checks, builds to `dist/` and prerenders the site (below); `npm run preview`
serves that build the way a static host would; `npm run lint` runs oxlint.

Set `VITE_SITE_URL` to the site's origin at build time so canonical links, `og:url`, `sitemap.xml`
and `feed.xml` are absolute.

## Prerendering

Every public page ships as its own HTML file, so crawlers and link previews get the title, meta
tags, JSON-LD and text without running JavaScript. `npm run build` runs `tsc -b`, `vite build` and
then `node scripts/prerender.mjs`:

1. The script bundles `src/entry-server.tsx` with Vite's server build (into `dist/.prerender`,
   removed afterwards).
2. For every route in `src/data/routes.ts` (the list the sitemap uses) it renders the site with
   react-router's static router and `renderToString`.
3. `useMeta` records each page's meta during that render instead of setting it in an effect; the
   script writes those tags into `<head>` of the built `index.html` and the markup into `#root`,
   stamped `data-prerendered="<route>"`, and saves the file as `dist/<route>/index.html` (the
   landing page is `dist/index.html`).

In the browser `src/main.tsx` hydrates the markup when the stamp matches the address, and renders
from scratch otherwise, so a file served for another address still works. Everything a page draws
on first render must be the same at build time and in the browser: read `localStorage`,
`matchMedia` and the like in effects, or through `useSyncExternalStore` with a server snapshot.

`/app` (the documents screen) and `dist/200.html` are the empty shell. A host must serve
`200.html` for every address it has no file for, which is `/edit/<id>` and unknown paths; a host
that answers those with `/index.html` instead also works, with a flash of the landing page before
the app takes over.

## Routes

| Path                | What it is                                                  |
| ------------------- | ----------------------------------------------------------- |
| `/`                 | Landing page                                                |
| `/app`              | Documents: open a PDF, start blank, continue a saved one    |
| `/edit/:id`         | The editor for one document (lives only in this browser)    |
| `/blog`, `/blog/:slug` | Engineering posts                                        |
| `/compare`, `/compare/:slug` | Comparison roundup and one page per competitor     |
| `/how-it-works`, `/privacy`, `/faq` | Supporting pages                            |

## Where things live

- `src/index.css`: design tokens (palette, type scale, spacing, radii, shadows) and the editor's
  surface aliases. Both the site and the editor are built from these.
- `src/site/`: the marketing site (layout, pages, `site.css`, Markdown renderer, page meta).
- `src/data/posts.ts`: blog posts as Markdown, with dates and tags.
- `src/data/competitors.ts`: every comparison fact, with sources and the date it was checked.
- `src/data/faq.ts`, `src/data/product.ts`: FAQ entries; product name, description and routes.
- `src/data/routes.ts`: every public route, for the sitemap and the prerender.
- `src/entry-server.tsx`, `scripts/prerender.mjs`: build-time rendering of the site (above).
- `src/App.tsx`, `src/App.css`, `src/AppHome.tsx`: the editor shell and the documents screen.
- `src/content.ts`, `src/textLayout.ts`, `src/SpanEditor.tsx`, `src/contentEdit.ts`,
  `src/PageStage.tsx`, `src/exportPdf.ts`, `src/fontFix.ts`: reading, editing and exporting the
  page's own content. The blog posts describe what these do.

## Updating the comparisons

Edit `src/data/competitors.ts`. Each entry carries `checkedAt` and a `sources` list; update both when
a price or a limit changes. The roundup table, the per-tool pages, the landing teaser and the
sitemap all read from that file.
