import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BASE_PATH, PRODUCT } from "./data/product.ts";
import { PUBLIC_ROUTES } from "./data/routes.ts";
import { siteRoutes } from "./site/routes.tsx";
import { takeRenderedMeta, type ResolvedMeta } from "./site/useMeta.ts";

// The build-time entry. scripts/prerender.mjs bundles this file after `vite build`, then calls
// render() for every route in PUBLIC_ROUTES and writes the result into dist/.
export { PUBLIC_ROUTES, PRODUCT };

export type Prerendered = {
  // The markup for <div id="root">.
  html: string;
  // The head tags the page asked for through useMeta, or null when it set none.
  meta: ResolvedMeta | null;
  // True when the address fell through to the not-found page.
  notFound: boolean;
};

// Renders one route of the site to HTML. The component tree around the router is the same one
// main.tsx renders, so the browser can hydrate the markup instead of drawing it again.
export async function render(path: string): Promise<Prerendered> {
  // The same basename as the browser router in root.tsx, so the links in the prerendered markup
  // carry the base path; `path` is the route, without it.
  const { query, dataRoutes } = createStaticHandler(siteRoutes, { basename: BASE_PATH });
  const context = await query(new Request(new URL(`${BASE_PATH}${path}`, "http://localhost")));
  if (context instanceof Response) {
    throw new Error(`${path} redirected to ${context.headers.get("Location") ?? "another address"}`);
  }
  const router = createStaticRouter(dataRoutes, context);
  const html = renderToString(
    <StrictMode>
      <TooltipProvider>
        <StaticRouterProvider router={router} context={context} hydrate={false} />
      </TooltipProvider>
    </StrictMode>,
  );
  const meta = takeRenderedMeta();
  const matched = context.matches.at(-1)?.route.path;
  return { html, meta, notFound: matched === "*" || meta?.robots.startsWith("noindex") === true };
}
