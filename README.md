# PDF Edit

A PDF editor that runs entirely in the browser. It edits the text a page already has, in the page's
own embedded font, and writes the result back as real text. It also annotates: pencil, shapes,
text boxes, emoji and signatures. Nothing is uploaded; pdf.js reads the file in a web worker and
pdf-lib writes the new one in the same tab.

## Run it

```bash
npm install
npm run dev
```

`npm run build` type-checks, builds to `dist/` and prerenders the site (below); `npm run preview`
serves that build the way a static host would; `npm run lint` runs oxlint.

Two build-time variables describe where the site will live:

- `VITE_SITE_URL`: the full address the site is served at, such as
  `https://example.com` or `https://owner.github.io/pdf-editor`. It makes canonical links,
  `og:url`, `sitemap.xml`, `feed.xml` and `robots.txt` absolute; without it they are root-relative.
- `VITE_BASE`: the path the site is served under, `/` by default. Set it to `/<repo>/` when the
  site lives in a sub-path, as a GitHub Pages project site does; every script, stylesheet, image,
  route and public file is then addressed under that path.

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

`/app` (the documents screen), `dist/200.html` and `dist/404.html` are the empty shell. A host
must serve one of them for every address it has no file for, which is `/edit/<id>` and unknown
paths: GitHub Pages picks up `404.html` by itself, Cloudflare Pages and similar hosts use
`200.html`. A host that answers those addresses with `/index.html` instead also works, with a flash
of the landing page before the app takes over. The build also writes an empty `.nojekyll` so GitHub
Pages serves files whose names begin with an underscore.

## Publishing on GitHub Pages

The workflow in `.github/workflows/pages.yml` builds the site and deploys `dist/` on every push to
`main`, and can also be run by hand from the Actions tab. To publish for the first time:

1. Get the code onto `main`: merge the open pull requests, or push the branch to `main`.
2. In the repository on GitHub, open **Settings → Pages** and under **Build and deployment** set
   **Source** to **GitHub Actions**. Nothing else needs choosing there; the workflow is already in
   the repository.
3. Open the **Actions** tab. The "Publish to GitHub Pages" run that the push started (or one you
   start with **Run workflow**) builds the site and deploys it; the first run takes two or three
   minutes.
4. The site is at `https://<owner>.github.io/<repo>/`, in lowercase, for example
   `https://vr-patel.github.io/pdf-editor/`. The address is also shown on the workflow run and under
   Settings → Pages.

The workflow reads the site's address from the Pages configuration (`actions/configure-pages`), so
`VITE_BASE` becomes `/<repo>/` and `VITE_SITE_URL` becomes the project site's address without
editing anything. The editor's documents live in the browser's IndexedDB under that origin.

### A custom domain

1. Add the domain under Settings → Pages → **Custom domain** and point its DNS at GitHub Pages as
   the instructions there describe.
2. Add a `public/CNAME` file containing just the domain, so every deployment keeps it.
3. Nothing else changes: with a custom domain `actions/configure-pages` reports an empty base path
   and the domain as the address, so the workflow builds with `VITE_BASE=/` and
   `VITE_SITE_URL=https://<domain>`.

### Checking the Pages build locally

```bash
VITE_BASE=/pdf-editor/ VITE_SITE_URL=http://localhost:5180/pdf-editor npm run build
npx vite preview --base /pdf-editor/ --port 5180
```

Then open `http://localhost:5180/pdf-editor/`. The preview serves the prerendered pages under the
prefix the way GitHub Pages does; unknown addresses fall back to the landing page here rather than
to `404.html`.

## Routes

| Path                | What it is                                                  |
| ------------------- | ----------------------------------------------------------- |
| `/`                 | Landing page                                                |
| `/app`              | Documents: open a PDF, start blank, continue a saved one    |
| `/edit/:id`         | The editor for one document (lives only in this browser)    |
| `/blog`, `/blog/:slug` | Engineering posts                                        |
| `/compare`, `/compare/:slug` | Comparison roundup and one page per competitor     |
| `/how-it-works`, `/pricing`, `/privacy`, `/faq` | Supporting pages                |

## Where things live

- `src/index.css`: design tokens (palette, type scale, spacing, radii, shadows) and the editor's
  surface aliases. Both the site and the editor are built from these.
- `src/site/`: the marketing site (layout, pages, `site.css`, Markdown renderer, page meta).
- `src/data/posts.ts`: blog posts as Markdown, with dates and tags.
- `src/data/competitors.ts`: every comparison fact, with sources and the date it was checked.
- `src/data/faq.ts`, `src/data/product.ts`: FAQ entries; product name, description, routes and
  the base-path helpers (`publicUrl`, `routeHref`, `siteOrigin`).
- `src/site/Logo.tsx`, `public/favicon.svg`, `public/og.svg`: the mark, a document with a folded
  corner and "PDF" inside it. `public/og.png` and `public/apple-touch-icon.png` are rendered from
  the SVGs (with sharp, outside the project).
- `.github/workflows/pages.yml`: the GitHub Pages deployment (below).
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

## Contributing and licence

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to run, test and change the editor and the site.
PDF Edit is released under the MIT licence; see [LICENSE](LICENSE).
