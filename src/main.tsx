import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BASE_PATH } from "./data/product.ts";
import { Root } from "./root.tsx";
import { applyTheme, readTheme } from "./theme.ts";
import "./index.css";

applyTheme(readTheme());

// A deploy replaces every content-hashed chunk, so a tab opened before it fails the next route it
// lazily imports (the old chunk name is gone). Vite reports that as vite:preloadError; reloading
// once brings the tab up to the current build instead of an error screen. A chunk still missing
// after the reload is a real fault, so a second failure within a minute is left to surface, and so
// is the first when storage is blocked and nothing could stop a loop.
const RELOAD_KEY = "pdf-editor:chunk-reload";
window.addEventListener("vite:preloadError", (event) => {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  location.reload();
});

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
