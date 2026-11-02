# SEO plan for PDF Edit

What the site already has, what this pull request adds, and what only the owner can do. Written
2 November 2026 for https://vr-patel.github.io/pdf-editor/.

## Where it stands

Already in place (from earlier work): one `<title>` and description per page, canonical links,
Open Graph and Twitter cards with a rendered `og.png`, JSON-LD (Organization, WebSite,
WebApplication with a free Offer, FAQPage, HowTo, BlogPosting, BreadcrumbList, Article),
`sitemap.xml` with `lastmod` for posts, `feed.xml`, `robots.txt` that allows everything except
`/edit/`, build-time prerendering of all 26 public pages (crawlers get the full HTML without
running JavaScript), self-hosted fonts, no third-party scripts, one `<h1>` per page, a 404 page,
and `.nojekyll`.

## Added in this pull request

- `site.webmanifest` (name, 192 and 512 px icons, theme colour), emitted by the Vite plugin under
  the base path, and a `<link rel="manifest">`, so the app is installable and Lighthouse's PWA
  checks pass.
- `og:image:width`, `og:image:height`, `og:image:alt` and `og:locale` on every page;
  `article:published_time`, `article:modified_time` and `article:tag` on posts.
- `lastmod` for every route in the sitemap, not only posts: `PAGES_UPDATED` and
  `COMPARISONS_UPDATED` in `src/data/routes.ts` (bump them when content changes), the post date
  for posts.
- A `<meta name="google-site-verification">` tag on every page, rendered only when the build has
  `VITE_GOOGLE_SITE_VERIFICATION` (a repository variable the Pages workflow now passes; see below).
- Google Analytics 4, loaded only when the build has `VITE_GA_MEASUREMENT_ID` **and** the
  visitor has agreed in the small notice the site then shows. The privacy page, FAQ and terms
  describe it only in that configuration; without the variable the site stays script-free and the
  pages keep saying so.
- Comparison page titles no longer repeat the name ("PDF Edit vs iLovePDF: where files go, what
  is free, fonts" instead of "PDF Edit vs iLovePDF — PDF Edit").
- `README.md`: a "Search and analytics" section with the variables; `.github/workflows/pages.yml`
  passes both variables to the build.

## What only you can do (in order)

1. **Google Search Console.** Add the property `https://vr-patel.github.io/pdf-editor/` as a
   *URL-prefix* property (a domain property needs DNS, which github.io does not give you). Choose
   the *HTML tag* method, copy the `content` value, and set it as the repository variable
   `VITE_GOOGLE_SITE_VERIFICATION` (Settings → Secrets and variables → Actions → Variables). The
   Pages workflow passes it to the build; re-run the workflow or push to `main`, wait for the
   deployment, then press Verify. Then submit `https://vr-patel.github.io/pdf-editor/sitemap.xml`
   under Sitemaps. Search Console is free, has no script and no privacy cost, and it is the only
   place that shows the queries you actually rank for: do it before anything else.
2. **Bing Webmaster Tools.** Import the Search Console property with one click; Bing and
   DuckDuckGo use that index.
3. **Analytics.** Decide between:
   - *Google Analytics 4* (what you asked for). Create a GA4 property, copy the `G-…` id, set it
     as the repository variable `VITE_GA_MEASUREMENT_ID`. The site will show a one-line notice
     ("This site counts visits with Google Analytics. OK / No thanks") and load the script only
     after OK; the choice is kept in localStorage. This is the opt-in the EU and UK rules expect
     for a cookie-setting analytics script; it also means you count only the visitors who agree,
     typically a half to two thirds of them.
   - *A cookieless counter* (recommended for this product): Cloudflare Web Analytics (free, no
     cookies, no consent banner needed in most jurisdictions), GoatCounter (free for personal
     sites, open source), Plausible or Umami (paid or self-hosted). They give page views,
     referrers and countries, which is what "overall traffic" means, without a notice and with a
     one-word change to the privacy page ("a cookieless page-view counter from X"). If you choose
     one, tell me which and I will wire it the same way (env variable, documented on the privacy
     page).
   - *GitHub Pages has no site analytics.* The repository's Insights → Traffic counts visits to
     the repository page on github.com and clones, not visits to the published site.
4. **Repository metadata** (helps the GitHub page rank and get clicked): set the repository
   description to the one-line pitch ("Free browser PDF editor that edits the page's own text in
   its own font. No upload, no account."), the website field to the live URL, and topics such as
   `pdf`, `pdf-editor`, `pdfjs`, `pdf-lib`, `browser`, `privacy`, `react`, `typescript`,
   `open-source`. Keep the README's first paragraph keyword-rich (it is indexed).
5. **A custom domain** (optional, the biggest single lever): a short domain such as
   `pdfedit.app` lets you add a DNS-verified Search Console property, gives cleaner URLs without
   `/pdf-editor/`, and makes the site look like a product rather than a repository. The README
   already documents the custom-domain steps for Pages.
6. **Links.** List the project on the places that index open-source tools (GitHub topics, Product
   Hunt, Hacker News "Show HN", AlternativeTo as an alternative to the twelve tools compared,
   awesome-lists for PDF tools and privacy tools, the pdf.js and pdf-lib "built with" sections if
   they have one). Every comparison page is a natural answer to "X alternative" searches, but only
   links get them crawled early.

## Keywords to rank for

Search volumes were not available to me (the keyword tools behind the numbers are paid, and the
public pages I could reach only quote neighbours such as "editable pdf", about 90 k monthly
searches in the US, and "pdf editable free", about 60 k). Treat the list as a map of intent, and
replace it with Search Console's own query report after a month: that report is the only
reliable source for this site.

**Head terms** (high volume, very competitive; the home page targets them in the title, H1, lede
and the two SEO paragraphs):
- edit pdf, pdf editor, free pdf editor, online pdf editor, edit pdf online free
- edit pdf text, change text in pdf, edit text in pdf, pdf text editor

**Long-tail terms where the product's facts are the differentiator** (lower volume, realistic to
win; the privacy band, FAQ and the "nothing leaves your browser" post target them):
- edit pdf without uploading, pdf editor no upload, edit pdf locally in browser,
  offline pdf editor in browser, private pdf editor, pdf editor that does not upload files
- free pdf editor no watermark, pdf editor no sign up, pdf editor without account,
  edit pdf no file size limit
- edit pdf keep original font, pdf editor same font, pdf editor that keeps formatting,
  edit pdf text without changing font
- edit pdf in browser open source, open source pdf editor web, pdf.js editor

**Task terms** (the use-case cards target them; each could become its own landing page or
post, see below):
- fix typo in pdf, change date on pdf, edit invoice pdf, change name on pdf, edit a pdf
  contract, correct a number in a pdf, type on a pdf, sign a pdf for free, fill pdf form free

**Comparison terms** (the twelve comparison pages target them already):
- ilovepdf alternative, smallpdf alternative, sejda alternative, adobe acrobat online free
  alternative, pdfescape alternative, dochub alternative, free alternative to adobe acrobat
- pdf edit vs ilovepdf, smallpdf vs ilovepdf (a "X vs Y" roundup post would catch these)

**Engineering terms** (the blog targets them; small volume, high trust, they bring links):
- pdf content stream TJ operator, pdf embedded font subset, edit pdf text pdf.js,
  pdf-lib edit existing text, why is editing pdf text hard

## Content that would widen the net (not done; each is a page or a post)

- One page per task term above (`/edit-pdf-text`, `/fix-typo-in-pdf`, `/sign-pdf`, …), each
  with a short how-to, the HowTo schema, and a screenshot of that edit in the editor. The
  landing page's use-case cards already have the copy; the pages would give each a URL.
- A "best free PDF editors in 2026" roundup post that ranks the twelve compared tools honestly
  (the data is in `competitors.ts`); roundups earn links that comparison pages do not.
- An "ilovepdf vs smallpdf" style post for the two or three most-searched pairs.
- A changelog page: it is crawled often and signals a maintained product.

## Things to keep doing

- Keep every page's title under about 60 characters and its description under about 155.
- Keep `comparisonsCheckedAt` and the sitemap's `lastmod` honest: freshness is a ranking signal
  only when it is real.
- Watch Search Console's Core Web Vitals report; the editor's JavaScript is loaded lazily, so the
  public pages are light, but the hero mock and illustrations should stay CSS, not images.
