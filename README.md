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

`npm run build` type-checks and builds to `dist/`; `npm run lint` runs oxlint.

The dev server serves `index.html` for every route. A production host must do the same (a
single-page-app rewrite of every path to `/index.html`), or deep links such as `/blog/<slug>` will
404. Set `VITE_SITE_URL` to the site's origin at build time so `sitemap.xml` and canonical links are
absolute.

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
- `src/App.tsx`, `src/App.css`, `src/AppHome.tsx`: the editor shell and the documents screen.
- `src/content.ts`, `src/textLayout.ts`, `src/SpanEditor.tsx`, `src/contentEdit.ts`,
  `src/PageStage.tsx`, `src/exportPdf.ts`, `src/fontFix.ts`: reading, editing and exporting the
  page's own content. The blog posts describe what these do.

## Updating the comparisons

Edit `src/data/competitors.ts`. Each entry carries `checkedAt` and a `sources` list; update both when
a price or a limit changes. The roundup table, the per-tool pages, the landing teaser and the
sitemap all read from that file.
