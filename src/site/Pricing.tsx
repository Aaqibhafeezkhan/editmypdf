import { Link } from "react-router";
import { ArrowRight, BadgeCheck, CalendarCheck, Check, CircleHelp, CirclePlay, Tag } from "lucide-react";
import { COMPETITORS, OURS, type Competitor, type Tri } from "../data/competitors.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { Accordion } from "./Accordion.tsx";
import { Monogram } from "./CompareCard.tsx";
import { faqJsonLd } from "./Faq.tsx";
import { LogoMark } from "./Logo.tsx";
import { Markdown } from "./Markdown.tsx";
import { Mark } from "./Marks.tsx";
import { Price } from "./Price.tsx";
import { useMeta } from "./useMeta.ts";
import "./pricing.css";

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
      "Only your browser's memory, since everything happens in the tab. PDF Edit does not do OCR, conversion, merging or form filling; the [comparisons](/compare) say which tools do those well.",
  },
  {
    question: "Can I use it for work?",
    answer:
      "Yes. Your document never leaves your device, which is simpler to explain to a security team than any upload policy. The [privacy page](/privacy) lists exactly what is stored and where.",
  },
];

// What retyping a line in an existing PDF takes with a given tool, from its free-tier and
// editing facts.
function needs(tool: Competitor): { value: Tri; label: string } {
  if (tool.free.editsExistingText === "yes") return { value: "yes", label: "Free tier" };
  if (tool.free.editsExistingText === "partial") return { value: "partial", label: "Free tier, limited" };
  if (tool.textEditing.existing === "yes") return { value: "partial", label: "A paid plan" };
  if (tool.textEditing.existing === "partial") return { value: "partial", label: "A paid plan, partly" };
  if (tool.textEditing.existing === "unknown" || tool.free.editsExistingText === "unknown") return { value: "unknown", label: "Not stated" };
  return { value: "no", label: "Not offered" };
}

const ACCOUNT_WORDS: Partial<Record<Tri, string>> = { yes: "Required", no: "None", partial: "For some tasks", unknown: "Not stated" };

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
  const checkedAt = COMPETITORS[0]?.checkedAt ?? PRODUCT.comparisonsCheckedAt;
  return (
    <>
      <section className="section container tone-teal">
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
        <div className="price-hero" data-reveal>
          <div className="price-hero-main">
            <span className="price-badge">
              <BadgeCheck aria-hidden="true" /> Everything included
            </span>
            <p className="price-amount">
              $0 <small>per document, per month, per anything</small>
            </p>
            <p className="price-hero-note">
              One editor, one price. The file never leaves your device, so there is no server to pay for and
              nothing to meter.
            </p>
            <p className="actions">
              <Link to={ROUTES.app} className="btn btn-primary btn-lg">
                Open the editor <ArrowRight className="btn-arrow" aria-hidden="true" />
              </Link>
              <Link to={ROUTES.howItWorks} className="btn btn-secondary btn-lg">
                <CirclePlay className="btn-lead" aria-hidden="true" /> How it works
              </Link>
            </p>
          </div>
          <ul className="price-list" aria-label="What is included">
            {INCLUDED.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section container tone-coral" aria-labelledby="elsewhere-heading">
        <div className="section-head">
          <p className="eyebrow">
            <Tag aria-hidden="true" /> Elsewhere
          </p>
          <h2 className="h2" id="elsewhere-heading">
            What the same edit costs elsewhere.
          </h2>
          <p className="lede">
            Retyping a line in an existing PDF is a paid feature in most web editors. Each row is the lowest
            paid plan as the vendor showed it, with its caveats beside the figure.
          </p>
        </div>
        <div className="price-table-wrap" data-reveal>
          <table className="price-table">
            <caption className="sr-only">
              Starting prices of twelve PDF editors next to {PRODUCT.name}, what retyping a line requires with
              each, and whether an account is needed
            </caption>
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col" className="num">
                  From
                </th>
                <th scope="col">Plan</th>
                <th scope="col">To retype a line</th>
                <th scope="col">Account</th>
              </tr>
            </thead>
            <tbody>
              <tr className="us">
                <th scope="row">
                  <span className="price-tool">
                    <LogoMark size={28} />
                    <span>{OURS.name}</span>
                  </span>
                </th>
                <td className="num" data-col="From">
                  <Price price={OURS.startingPrice} note={false} />
                </td>
                <td data-col="Plan">Everything, with no plan to choose</td>
                <td data-col="To retype a line">
                  <Mark value="yes" labels={{ yes: "Free, in the page's font" }} />
                </td>
                <td data-col="Account">
                  <Mark value="no" labels={{ no: "None" }} />
                </td>
              </tr>
              {COMPETITORS.map((tool) => {
                const need = needs(tool);
                return (
                  <tr key={tool.slug}>
                    <th scope="row">
                      <Link to={ROUTES.comparison(tool.slug)} className="price-tool">
                        <Monogram brand={tool.brand} size={28} />
                        <span>{tool.name}</span>
                      </Link>
                    </th>
                    <td className="num" data-col="From">
                      <Price price={tool.startingPrice} note={false} />
                    </td>
                    <td data-col="Plan">{tool.startingPrice.note}</td>
                    <td data-col="To retype a line">
                      <Mark value={need.value} labels={{ [need.value]: need.label }} />
                    </td>
                    <td data-col="Account">
                      <Mark value={tool.account.required} labels={ACCOUNT_WORDS} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="price-foot">
          <p className="as-of">
            <CalendarCheck aria-hidden="true" /> Prices checked {checkedAt}
          </p>
          <p>
            <span className="tag warn">regional</span> the vendor prices by region and the figure is one
            region's · <span className="tag warn">approx.</span> rounded or converted ·{" "}
            <span className="tag warn">third-party</span> from listings, not the vendor's page ·{" "}
            <span className="tag warn">at checkout</span> the vendor shows the price only at checkout. Each
            tool's <Link to={ROUTES.compare}>comparison page</Link> lists the source it was read from.
          </p>
        </div>
      </section>

      <section className="section container page-narrow tone-teal">
        <div className="section-head">
          <p className="eyebrow">
            <CircleHelp aria-hidden="true" /> Questions
          </p>
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
