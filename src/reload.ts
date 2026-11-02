// A deploy replaces every content-hashed chunk, and GitHub Pages serves index.html with a
// ten-minute cache, so a tab holding the previous HTML fails the next route it lazily imports (the
// old chunk name is gone). Vite reports that as vite:preloadError; reloading once brings the tab up
// to the current build instead of an error screen. A chunk still missing after the reload is a real
// fault, so a second failure within a minute is left to surface, and so is the first when storage
// is blocked and nothing could stop a loop.
const RELOAD_KEY = "pdf-editor:chunk-reload";

let pending = false;

// True from the moment a reload has been requested until the page goes away: the route error
// element shows the loading screen instead of an error during that moment.
export function reloadPending(): boolean {
  return pending;
}

export function installStaleChunkReload(): void {
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
    pending = true;
    location.reload();
  });
}
