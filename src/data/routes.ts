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

// Every public route of the site, in sitemap order. Editor documents (/edit/<id>) exist only in one
// browser and are left out. The sitemap, the RSS feed and scripts/prerender.mjs all read this list,
// so a new page or post appears everywhere at once.
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/" },
  { path: "/app", shell: true },
  { path: "/how-it-works" },
  { path: "/pricing" },
  { path: "/privacy" },
  { path: "/terms" },
  { path: "/faq" },
  { path: "/blog" },
  ...POSTS.map((post) => ({ path: `/blog/${post.slug}`, lastmod: post.date })),
  { path: "/compare" },
  ...COMPETITORS.map((tool) => ({ path: `/compare/${tool.slug}` })),
];
