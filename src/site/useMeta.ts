import { useEffect } from "react";
import { useLocation } from "react-router";
import { PRODUCT, siteOrigin } from "../data/product.ts";

export type PageMeta = {
  // The full <title>; pass `titleSuffix: false` to use it verbatim.
  title: string;
  titleSuffix?: boolean;
  description: string;
  type?: "website" | "article";
  // Absolute or root-relative image for link previews; defaults to the site card.
  image?: string;
  keywords?: string[];
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

// Sets the document title, description, Open Graph and Twitter tags, canonical link and JSON-LD.
export function useMeta(meta: PageMeta): void {
  const { pathname } = useLocation();
  const title = meta.titleSuffix === false ? meta.title : `${meta.title} — ${PRODUCT.name}`;
  const { description, type = "website", noindex = false } = meta;
  const image = meta.image ?? "/og.png";
  const keywords = meta.keywords?.join(", ") ?? "";
  const jsonLd = meta.jsonLd ? JSON.stringify(meta.jsonLd) : "";
  useEffect(() => {
    const origin = siteOrigin();
    const url = `${origin}${pathname === "/" ? "/" : pathname.replace(/\/$/, "")}`;
    const imageUrl = image.startsWith("http") ? image : `${origin}${image}`;
    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    if (keywords) setMeta("name", "keywords", keywords);
    setMeta("property", "og:site_name", PRODUCT.name);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", imageUrl);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", imageUrl);
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
  }, [pathname, title, description, type, image, keywords, noindex, jsonLd]);
}

// A BreadcrumbList for a page two or three levels deep.
export function breadcrumbs(items: { name: string; path: string }[]): Record<string, unknown> {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: PRODUCT.name, path: "/" }, ...items].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${origin}${item.path}`,
    })),
  };
}
