import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BASE_PATH } from "./data/product.ts";
import { installStaleChunkReload } from "./reload.ts";
import { Root } from "./root.tsx";
import { applyTheme, readTheme } from "./theme.ts";
import "./index.css";

applyTheme(readTheme());
installStaleChunkReload();

const app = (
  <StrictMode>
    <TooltipProvider>
      <Root />
    </TooltipProvider>
  </StrictMode>
);

// Public pages are prerendered at build time (scripts/prerender.mjs) and arrive with their markup in
// place, stamped with the route it was drawn for; React takes that markup over instead of drawing it
// again. A host that answers every address with one prerendered file (a single-page-app rewrite to
// index.html) hands other routes the landing page's markup, so the stamp is checked first and markup
// for another route is dropped before rendering.
const container = document.getElementById("root")!;
// The address relative to the base path, which is how the stamp and the router name a route.
const pathname = location.pathname.startsWith(BASE_PATH) ? location.pathname.slice(BASE_PATH.length) : location.pathname;
const here = pathname.replace(/\/+$/, "") || "/";
if (container.dataset.prerendered === here) {
  hydrateRoot(container, app);
} else {
  container.replaceChildren();
  createRoot(container).render(app);
}
