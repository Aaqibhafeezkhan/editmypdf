import { FAQ } from "../data/faq.ts";
import { PRODUCT } from "../data/product.ts";
import { Markdown } from "./Markdown.tsx";
import { useMeta } from "./useMeta.ts";

function plain(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "");
}

export function Faq() {
  useMeta({
    title: "Frequently asked questions",
    description: `Answers about ${PRODUCT.name}: whether files are uploaded, what can be edited, what the exported PDF contains, where documents are stored, and what the editor cannot do.`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((entry) => ({
        "@type": "Question",
        name: entry.question,
        acceptedAnswer: { "@type": "Answer", text: plain(entry.answer) },
      })),
    },
  });
  return (
    <section className="section container page-narrow">
      <p className="eyebrow">FAQ</p>
      <h1 className="display">Questions, answered plainly.</h1>
      <p className="lede">
        Every answer below describes what the code does today. If something here stops being true, it is
        a bug in the page, not a marketing choice.
      </p>
      <div className="faq-list">
        {FAQ.map((entry) => (
          <details key={entry.question} className="faq-item" name="faq">
            <summary>{entry.question}</summary>
            <Markdown source={entry.answer} className="prose prose-sm" />
          </details>
        ))}
      </div>
    </section>
  );
}
