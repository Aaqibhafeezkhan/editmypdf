import { useEffect, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router";
import { BarChart3 } from "lucide-react";
import { ANALYTICS, ROUTES } from "../data/product.ts";

// Visit counting with Google Analytics, on the site's pages only and only after the visitor
// agrees. Nothing here runs unless VITE_GA_MEASUREMENT_ID was set at build time (SiteLayout
// renders the component only then), and the script is never loaded on the editor routes, so no
// third-party code runs beside a document. The choice lives in localStorage; clearing the site's
// data asks again.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const KEY = "pdf-editor:analytics";
type Choice = "granted" | "denied" | null;
const listeners = new Set<() => void>();

function readChoice(): Choice {
  try {
    const value = localStorage.getItem(KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function storeChoice(choice: Exclude<Choice, null>): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked: the notice shows again next time, nothing is loaded now.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let loaded = false;
function loadGtag(id: string): void {
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  // Page views are sent by hand below, once per route change.
  window.gtag("config", id, { anonymize_ip: true, send_page_view: false });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(script);
}

// False while the prerendered markup is hydrated, true after, so the notice never appears in
// the prerendered HTML and never mismatches it.
const mounted = () => true;
const notMounted = () => false;
const noop = () => () => {};

export function Analytics() {
  const id = ANALYTICS.id ?? "";
  const choice = useSyncExternalStore(subscribe, readChoice, () => null);
  const ready = useSyncExternalStore(noop, mounted, notMounted);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!id || choice !== "granted") return;
    loadGtag(id);
    window.gtag?.("event", "page_view", { page_path: pathname, page_title: document.title });
  }, [id, choice, pathname]);

  if (!id || !ready || choice !== null) return null;
  return (
    <div className="consent" role="region" aria-label="Visit counting">
      <BarChart3 aria-hidden="true" />
      <p>
        This site counts visits with Google Analytics, which sets a cookie. It runs only on these pages, never
        in the editor. <Link to={ROUTES.privacy}>What is collected</Link>
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => storeChoice("granted")}>
          OK
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => storeChoice("denied")}>
          No thanks
        </button>
      </div>
    </div>
  );
}
