import type { RouteObject } from "react-router";
import { SiteLayout } from "./SiteLayout.tsx";
import { Landing } from "./Landing.tsx";
import { Blog } from "./Blog.tsx";
import { BlogPost } from "./BlogPost.tsx";
import { Compare } from "./Compare.tsx";
import { ComparePage } from "./ComparePage.tsx";
import { HowItWorks } from "./HowItWorks.tsx";
import { Pricing } from "./Pricing.tsx";
import { Privacy } from "./Privacy.tsx";
import { Terms } from "./Terms.tsx";
import { Faq } from "./Faq.tsx";
import { NotFound } from "./NotFound.tsx";

// The marketing site: one layout with a page per child. root.tsx adds the editor routes next to it
// in the browser; entry-server.tsx renders this tree alone at build time, so the PDF libraries never
// enter the prerender.
export const siteRoutes: RouteObject[] = [
  {
    path: "/",
    Component: SiteLayout,
    children: [
      { index: true, Component: Landing },
      { path: "blog", Component: Blog },
      { path: "blog/:slug", Component: BlogPost },
      { path: "compare", Component: Compare },
      { path: "compare/:slug", Component: ComparePage },
      { path: "how-it-works", Component: HowItWorks },
      { path: "pricing", Component: Pricing },
      { path: "privacy", Component: Privacy },
      { path: "terms", Component: Terms },
      { path: "faq", Component: Faq },
      { path: "*", Component: NotFound },
    ],
  },
];
