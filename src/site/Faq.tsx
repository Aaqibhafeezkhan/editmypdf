import { CircleHelp } from "lucide-react";
import { FAQ } from "../data/faq.ts";
import { PRODUCT } from "../data/product.ts";
import { Accordion } from "./Accordion.tsx";
import { Markdown } from "./Markdown.tsx";
import { useMeta } from "./useMeta.ts";

export function plainText(markdown: string): string {
  return markdown.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "");
}

export function faqJsonLd(entries: typeof FAQ): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: plainText(entry.answer) },
    })),
  };
}

export function Faq() {
  useMeta({
    title: "Frequently asked questions",
    description: `Answers about ${PRODUCT.name}: whether files are uploaded, what can be edited, what the exported PDF contains, where documents are stored, and what the editor cannot do.`,
    keywords: ["PDF editor FAQ", "edit PDF text", "is it free", "does it upload my PDF"],
    jsonLd: faqJsonLd(FAQ),
  });
  return (
    <section className="section container page-narrow">
      <p className="eyebrow">
        <CircleHelp aria-hidden="true" /> FAQ
      </p>
      <h1 className="display">Questions, answered plainly.</h1>
      <p className="lede">
        Every answer below describes what the code does today. If something here stops being true, it is
        a bug in the page, not a marketing choice.
      </p>
      <Accordion
        className="faq-acc"
        heading="h2"
        initial={FAQ[0]?.question ?? null}
        items={FAQ.map((entry) => ({
          id: entry.question,
          title: entry.question,
          body: <Markdown source={entry.answer} className="prose prose-sm" />,
        }))}
      />
    </section>
  );
}
