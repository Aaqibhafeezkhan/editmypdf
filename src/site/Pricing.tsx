import { Link } from "react-router";
import { ArrowRight, BadgeCheck, Check, Tag } from "lucide-react";
import { COMPETITORS } from "../data/competitors.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { Accordion } from "./Accordion.tsx";
import { Markdown } from "./Markdown.tsx";
import { Mark } from "./Marks.tsx";
import { faqJsonLd } from "./Faq.tsx";
import { useMeta } from "./useMeta.ts";

const INCLUDED = [
  "Edit the text already on the page, in its embedded font",
  "Paragraphs that reflow inside their own column",
  "Bold, italic and regular text edited as one block",
  "Downloads written as real text in a subset of the page's font",
  "Pencil, shapes, lines and arrows, text boxes, emoji, signatures",
  "Unlimited documents, pages and file size",
  "No account, no upload, no watermark, no trial clock",
];

const QUESTIONS = [
  {
    question: "Why is it free?",
    answer:
      "Because there is nothing to pay for per document. The app is a set of static files; your browser does all the work. The costs that make other editors charge, servers that receive and process every file, do not exist here.",
  },
  {
    question: "Will it stay free?",
    answer:
      "There is no paid plan and nothing in the editor is metered, gated or trialled. We cannot promise the future, but there is no counter or trial clock waiting to be switched on.",
  },
  {
    question: "What are the limits?",
    answer:
      "Only your browser's memory, since everything happens in the tab. Stet does not do OCR, conversion, merging or form filling; the [comparisons](/compare) say which tools do those well.",
  },
  {
    question: "Can I use it for work?",
    answer:
      "Yes. Your document never leaves your device, which is simpler to explain to a security team than any upload policy. The [privacy page](/privacy) lists exactly what is stored and where.",
  },
];

export function Pricing() {
  useMeta({
    title: "Pricing",
    description: `${PRODUCT.name} is free: no tiers, no trial, no watermark and no file size limit. What is included, and what other PDF editors charge for the same editing.`,
    keywords: ["free PDF editor", "PDF editor pricing", "edit PDF text free", "no watermark PDF editor"],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: PRODUCT.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
      },
      faqJsonLd(QUESTIONS),
    ],
  });
  const alternatives = COMPETITORS.filter((tool) => tool.paid.length > 0).slice(0, 6);
  return (
    <>
      <section className="section container">
        <div className="section-head centered">
          <p className="eyebrow">
            <Tag aria-hidden="true" /> Pricing
          </p>
          <h1 className="display">Free. No tiers, no trial, no watermark.</h1>
          <p className="lede">
            Everything {PRODUCT.name} does, it does for everyone. There is no plan to pick and no account to
            make.
          </p>
        </div>
        <div className="price-card" data-reveal>
          <div className="price-head">
            <span className="price-badge">
              <BadgeCheck aria-hidden="true" /> Everything included
            </span>
            <span className="price-amount">
              $0 <small>per document, per month, per anything</small>
            </span>
          </div>
          <ul className="price-list">
            {INCLUDED.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="actions">
            <Link to={ROUTES.app} className="btn btn-primary btn-lg">
              Open the editor <ArrowRight aria-hidden="true" />
            </Link>
            <Link to={ROUTES.howItWorks} className="btn btn-secondary btn-lg">
              How it works
            </Link>
          </p>
        </div>
      </section>

      <section className="section container">
        <div className="section-head centered">
          <h2 className="h2">What the alternatives charge for the same edit.</h2>
          <p className="lede">
            Retyping a line in an existing PDF is a paid feature in most web editors. Prices checked{" "}
            {PRODUCT.comparisonsCheckedAt}; regional pricing applies to several.
          </p>
        </div>
        <div className="card-grid" data-reveal>
          {alternatives.map((tool) => (
            <Link key={tool.slug} to={ROUTES.comparison(tool.slug)} className="card">
              <div className="card-meta">
                <span className="tag">{tool.vendor.split(",")[0]}</span>
              </div>
              <h3>{tool.name}</h3>
              <p>
                <strong>From {tool.priceFrom}</strong>
              </p>
              <p>
                Edits existing text on the free tier: <Mark value={tool.free.editsExistingText} />
              </p>
              <span className="link-arrow">
                Full comparison <ArrowRight aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section container page-narrow">
        <div className="section-head">
          <h2 className="h2">Questions about the price.</h2>
        </div>
        <Accordion
          heading="h3"
          initial={QUESTIONS[0]?.question ?? null}
          items={QUESTIONS.map((entry) => ({
            id: entry.question,
            title: entry.question,
            body: <Markdown source={entry.answer} className="prose prose-sm" />,
          }))}
        />
      </section>
    </>
  );
}
