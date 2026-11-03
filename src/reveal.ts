// Scrolls a container just enough to show an element, in the spirit of scrollIntoView but only on
// this container: nothing above it (the window, the app shell) moves. A visible element is left
// alone, so hovering an object that is already on screen never nudges the view.

const PAD = 16;

export function revealIn(
  scroller: HTMLElement,
  target: Element,
  block: "center" | "nearest",
  smooth: boolean,
): boolean {
  const outer = scroller.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const fitsV = rect.height <= outer.height - PAD * 2;
  const fitsH = rect.width <= outer.width - PAD * 2;
  const visibleV = fitsV
    ? rect.top >= outer.top + PAD && rect.bottom <= outer.bottom - PAD
    : rect.top <= outer.top + PAD && rect.bottom >= outer.bottom - PAD;
  const visibleH = fitsH
    ? rect.left >= outer.left + PAD && rect.right <= outer.right - PAD
    : rect.left <= outer.left + PAD && rect.right >= outer.right - PAD;
  if (visibleV && visibleH) return false;

  let top = scroller.scrollTop;
  let left = scroller.scrollLeft;
  if (!visibleV) {
    if (block === "center" || !fitsV) top += rect.top - outer.top - (outer.height - rect.height) / 2;
    else if (rect.top < outer.top + PAD) top += rect.top - outer.top - PAD;
    else top += rect.bottom - outer.bottom + PAD;
  }
  if (!visibleH) {
    if (block === "center" || !fitsH) left += rect.left - outer.left - (outer.width - rect.width) / 2;
    else if (rect.left < outer.left + PAD) left += rect.left - outer.left - PAD;
    else left += rect.right - outer.right + PAD;
  }
  scroller.scrollTo({ top, left, behavior: smooth ? "smooth" : "auto" });
  return true;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
