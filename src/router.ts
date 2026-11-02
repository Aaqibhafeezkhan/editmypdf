import type { createBrowserRouter } from "react-router";

type Router = ReturnType<typeof createBrowserRouter>;

let router: Router | null = null;

// The editor navigates from event handlers and async code, outside any component; the router
// instance created in root.tsx is registered here so those calls go through it.
export function attachRouter(instance: Router): void {
  router = instance;
}

export function navigate(path: string): void {
  if (window.location.pathname === path) return;
  if (router) {
    void router.navigate(path);
    return;
  }
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function plainClick(event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }): boolean {
  return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;
}
