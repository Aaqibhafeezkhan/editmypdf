import { useEffect } from "react";
import { useLocation } from "react-router";
import { PRODUCT, siteOrigin } from "../data/product.ts";

export type PageMeta = {
  // The full <title>; pass `titleSuffix: false` to use it verbatim.
  title: string;
  titleSuffix?: boolean;
  description: string;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function setTag(selector: string, create: () => HTMLElement, apply: (node: HTMLElement) => void) {
  let node = document.head.querySelector<HTMLElement>(selector);
  if (!node) {
    node = create();
    document.head.append(node);
  }
  apply(node);
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  setTag(
    `meta[${attribute}="${key}"]`,
    () => {
      const meta = document.createElement("meta");
      meta.setAttribute(attribute, key);
      return meta;
    },
    (node) => node.setAttribute("content", content),
  );
}

// Sets the document title, description, Open Graph tags, canonical link and JSON-LD for a page.
export function useMeta(meta: PageMeta): void {
  const { pathname } = useLocation();
  const title = meta.titleSuffix === false ? meta.title : `${meta.title} — ${PRODUCT.name}`;
  const { description, type = "website", noindex = false } = meta;
  const jsonLd = meta.jsonLd ? JSON.stringify(meta.jsonLd) : "";
  useEffect(() => {
    const url = `${siteOrigin()}${pathname === "/" ? "/" : pathname.replace(/\/$/, "")}`;
    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", url);
    setTag(
      'link[rel="canonical"]',
      () => {
        const link = document.createElement("link");
        link.rel = "canonical";
        return link;
      },
      (node) => node.setAttribute("href", url),
    );
    const existing = document.head.querySelector('script[data-page-ld="true"]');
    if (jsonLd) {
      const script = existing ?? document.createElement("script");
      script.setAttribute("type", "application/ld+json");
      script.setAttribute("data-page-ld", "true");
      script.textContent = jsonLd;
      if (!existing) document.head.append(script);
    } else {
      existing?.remove();
    }
  }, [pathname, title, description, type, noindex, jsonLd]);
}
