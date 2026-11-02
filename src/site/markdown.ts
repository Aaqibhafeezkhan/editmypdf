import { Marked, type Tokens } from "marked";
import { routeHref } from "../data/product.ts";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Renders trusted Markdown written in this repository's data files. Raw HTML inside the Markdown
// (figures, small diagrams) passes through unchanged.
export const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth }: Tokens.Heading) {
      const text = this.parser.parseInline(tokens);
      return `<h${depth} id="${slugify(text)}">${text}</h${depth}>\n`;
    },
    link({ href, title, tokens }: Tokens.Link) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:\/\//.test(href);
      // A link to a page of the site is written as its route ("/compare"); the base path is added here,
      // and Markdown.tsx hands clicks on it to the router.
      const internal = href.startsWith("/") && !href.startsWith("//");
      const attrs = [
        `href="${internal ? routeHref(href) : href}"`,
        title ? `title="${title}"` : "",
        external ? 'rel="noopener noreferrer" target="_blank"' : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<a ${attrs}>${text}</a>`;
    },
  },
});

export function wordCount(markdown: string): number {
  return markdown
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function readingTime(markdown: string): number {
  return Math.max(1, Math.round(wordCount(markdown) / 220));
}
