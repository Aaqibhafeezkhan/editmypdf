import { Marked, type Tokens } from "marked";

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
      const attrs = [
        `href="${href}"`,
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
