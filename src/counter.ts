import { useEffect } from "react";
import { ANALYTICS } from "./data/product.ts";

// Cloudflare Web Analytics: one small script that reports the page's address, the referrer, the
// browser family and load timing, with no cookies, no storage and no identifier of any kind. It
// is loaded only when the build has VITE_CF_BEACON_TOKEN, once per full page load with its
// single-page mode off, so client-side navigation is not reported and an editor address
// (/edit/<id>) is never sent: the screens that call this are the site's pages and the documents
// screen, and the editor itself never loads it.
export function useVisitCounter(): void {
  useEffect(() => {
    const token = ANALYTICS.cloudflareToken;
    if (!token || document.querySelector("script[data-cf-beacon]")) return;
    const script = document.createElement("script");
    script.defer = true;
    script.src = "https://static.cloudflareinsights.com/beacon.min.js";
    script.setAttribute("data-cf-beacon", JSON.stringify({ token, spa: false }));
    document.head.append(script);
  }, []);
}
