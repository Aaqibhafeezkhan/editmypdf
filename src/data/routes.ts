import { COMPETITORS } from "./competitors.ts";
import { POSTS } from "./posts.ts";

export type PublicRoute = {
  path: string;
  // Date of the last change, for the sitemap.
  lastmod?: string;
  // The documents screen reads IndexedDB and is drawn in the browser only: it ships as the empty
  // app shell instead of prerendered HTML.
  shell?: boolean;
};

// The day the site's pages last changed in substance (ISO date), for the sitemap. Bump it when a
// page's content changes; the comparisons take the day their facts were checked.
export const PAGES_UPDATED = "2026-11-02";
export const COMPARISONS_UPDATED = "2026-11-02";

// The address the site advertises for a page: its route with a trailing slash. Each page is
// prerendered to <route>/index.html, and GitHub Pages answers the address without the slash with a
// 301 to the one with it, so canonical links, og:url, JSON-LD, the sitemap and the feed use the
// slashed form to point at the page itself rather than at a redirect. Files (an extension in the
// last segment), hashes and queries are left alone.
export function canonicalPath(path: string): string {
  if (/[?#]/.test(path) || path.endsWith("/")) return path;
  const last = path.slice(path.lastIndexOf("/") + 1);
  return last.includes(".") ? path : `${path}/`;
}

// Every public route of the site, in sitemap order. Editor documents (/edit/<id>) exist only in one
// browser and are left out. The sitemap, the RSS feed and scripts/prerender.mjs all read this list,
// so a new page or post appears everywhere at once.
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", lastmod: PAGES_UPDATED },
  { path: "/app", shell: true, lastmod: PAGES_UPDATED },
  { path: "/how-it-works", lastmod: PAGES_UPDATED },
  { path: "/pricing", lastmod: COMPARISONS_UPDATED },
  { path: "/privacy", lastmod: PAGES_UPDATED },
  { path: "/terms", lastmod: PAGES_UPDATED },
  { path: "/faq", lastmod: PAGES_UPDATED },
  { path: "/blog", lastmod: POSTS[0]?.date ?? PAGES_UPDATED },
  ...POSTS.map((post) => ({ path: `/blog/${post.slug}`, lastmod: post.date })),
  { path: "/compare", lastmod: COMPARISONS_UPDATED },
  ...COMPETITORS.map((tool) => ({ path: `/compare/${tool.slug}`, lastmod: COMPARISONS_UPDATED })),
];
