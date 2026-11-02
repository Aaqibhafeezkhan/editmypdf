import { useMemo, type MouseEvent } from "react";
import { BASE_PATH } from "../data/product.ts";
import { navigate, plainClick } from "../router.ts";
import { marked } from "./markdown.ts";

// A plain click on a link to another page of the site goes through the router instead of
// reloading the page; every other click (external links, modifier keys) behaves as usual.
function followInternalLink(event: MouseEvent<HTMLDivElement>) {
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor || anchor.target === "_blank" || !plainClick(event)) return;
  const href = anchor.getAttribute("href") ?? "";
  if (!href.startsWith(`${BASE_PATH}/`) || href.startsWith(`${BASE_PATH}//`)) return;
  event.preventDefault();
  navigate(href.slice(BASE_PATH.length));
}

export function Markdown({ source, className = "prose" }: { source: string; className?: string }) {
  const html = useMemo(() => marked.parse(source, { async: false }), [source]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} onClick={followInternalLink} />;
}
