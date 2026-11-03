import { Link, useParams } from "react-router";
import { ArrowRight, CalendarCheck, Check, ChevronRight, Minus, Scale } from "lucide-react";
import { competitorBySlug, COMPETITORS, FEATURE_LABELS, OURS, triWord, type Competitor, type Tool } from "../data/competitors.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { Accordion } from "./Accordion.tsx";
import { CompareCard, Scorecard, ToolMark } from "./CompareCard.tsx";
import { LogoMark } from "./Logo.tsx";
import { Mark, Where } from "./Marks.tsx";
import { Price } from "./Price.tsx";
import { NotFound } from "./NotFound.tsx";
import { breadcrumbs, useMeta } from "./useMeta.ts";

export function ComparePage() {
  const { slug = "" } = useParams();
  const tool = competitorBySlug(slug);
  if (!tool) return <NotFound />;
  return <Comparison tool={tool} />;
}

type RowProps = { label: string; them: React.ReactNode; us: React.ReactNode; names: [string, string] };

function Row({ label, them, us, names }: RowProps) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td data-col={names[0]}>{them}</td>
      <td className="us" data-col={names[1]}>
        {us}
      </td>
    </tr>
  );
}

function Comparison({ tool }: { tool: Competitor }) {
  const title = `${PRODUCT.name} vs ${tool.name}`;
  useMeta({
    // The name is already in the title, so no " — Edit My PDF" suffix.
    title: `${title}: where files go, what is free, fonts`,
    titleSuffix: false,
    description: `${tool.name} compared with ${PRODUCT.name}: where files are processed, free limits, pricing, and whether editing text keeps the original font. Facts checked ${tool.checkedAt}.`,
    keywords: [`${tool.name} alternative`, `${tool.name} vs ${PRODUCT.name}`, `${tool.name} pricing`, "edit PDF text free", "PDF editor comparison"],
    jsonLd: [
      breadcrumbs([
        { name: "Compare", path: ROUTES.compare },
        { name: title, path: ROUTES.comparison(tool.slug) },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description: tool.verdict,
        dateModified: "2026-11-02",
        author: { "@type": "Organization", name: PRODUCT.name },
      },
    ],
  });
  const others = COMPETITORS.filter((item) => item.slug !== tool.slug).slice(0, 3);
  const features = Object.keys(FEATURE_LABELS) as (keyof Tool["features"])[];
  const names: [string, string] = [tool.name, PRODUCT.name];
  return (
    <>
      <section className="section container">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to={ROUTES.home}>{PRODUCT.name}</Link>
          <ChevronRight aria-hidden="true" />
          <Link to={ROUTES.compare}>Compare</Link>
          <ChevronRight aria-hidden="true" />
          <span aria-current="page">{tool.name}</span>
        </nav>
        <div className="cmp-head">
          <div className="cmp-head-copy">
            <p className="eyebrow">
              <Scale aria-hidden="true" /> Comparison
            </p>
            <p className="cmp-versus" aria-hidden="true">
              <LogoMark size={48} />
              <span>vs</span>
              <ToolMark brand={tool.brand} size={48} />
            </p>
            <h1 className="display">
              {PRODUCT.name} <em>vs</em> {tool.name}
            </h1>
            <p className="lede">{tool.summary}</p>
            <p className="cmp-meta">
              <span className="as-of">
                <CalendarCheck aria-hidden="true" /> Facts checked {tool.checkedAt}
              </span>
            </p>
          </div>
          <aside className="cmp-verdict" aria-labelledby="cmp-in-short">
            <div className="cmp-verdict-copy">
              <h2 id="cmp-in-short">In short</h2>
              <p>{tool.verdict}</p>
            </div>
            <Scorecard tool={tool} />
          </aside>
        </div>
      </section>

      <section className="container">
        <div className="table-wrap sticky">
          <table className="cmp-table glance">
            <thead>
              <tr>
                <th scope="col">At a glance</th>
                <th scope="col">
                  <span className="tool-cell">
                    <ToolMark brand={tool.brand} size={18} />
                    <span>{tool.name}</span>
                  </span>
                </th>
                <th scope="col" className="us">
                  <span className="tool-cell">
                    <LogoMark size={18} />
                    <span>{PRODUCT.name}</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <Row
                names={names}
                label="Where your file is processed"
                them={
                  <>
                    <Where where={tool.processing.where} />
                    <span className="cell-note">{tool.processing.note}</span>
                  </>
                }
                us={
                  <>
                    <Where where={OURS.processing.where} />
                    <span className="cell-note">{OURS.processing.note}</span>
                  </>
                }
              />
              <Row names={names} label="File retention" them={tool.processing.retention} us={OURS.processing.retention} />
              <Row
                names={names}
                label="Account"
                them={
                  <>
                    <Mark value={tool.account.required} labels={{ yes: "Required", no: "Not required", partial: "For some tasks" }} />
                    <span className="cell-note">{tool.account.note}</span>
                  </>
                }
                us={<Mark value="no" labels={{ no: "Not required" }} />}
              />
              <Row
                names={names}
                label="Free tier"
                them={
                  <>
                    {tool.free.summary}
                    <span className="cell-note">
                      File size cap: {tool.free.fileSizeCap}. Limit: {tool.free.taskLimit}. Watermark:{" "}
                      {triWord(tool.free.watermark, { partial: "on some outputs", unknown: "not stated" })}.
                    </span>
                  </>
                }
                us={OURS.free.summary}
              />
              <Row
                names={names}
                label="Paid plans"
                them={
                  tool.paid.length === 0 ? (
                    "None"
                  ) : (
                    <>
                      <Price price={tool.startingPrice} note={false} />
                      {tool.paid.map((plan) => (
                        <span key={plan.name} style={{ display: "block" }}>
                          <strong>{plan.name}</strong>: {plan.price}
                          {plan.note ? <span className="cell-note">{plan.note}</span> : null}
                        </span>
                      ))}
                    </>
                  )
                }
                us="None. Everything is free."
              />
              <Row
                names={names}
                label="Edits the text already on the page"
                them={
                  <>
                    <Mark value={tool.textEditing.existing} />
                    {tool.free.editsExistingText !== tool.textEditing.existing && (
                      <span className="cell-note">
                        On the free tier: <Mark value={tool.free.editsExistingText} />
                      </span>
                    )}
                  </>
                }
                us={<Mark value="yes" />}
              />
              <Row
                names={names}
                label="Keeps the page's original font"
                them={
                  <>
                    <Mark value={tool.textEditing.keepsFont} />
                    <span className="cell-note">{tool.textEditing.note}</span>
                  </>
                }
                us={
                  <>
                    <Mark value="yes" />
                    <span className="cell-note">{OURS.textEditing.note}</span>
                  </>
                }
              />
              {features.map((key) => (
                <Row key={key} names={names} label={FEATURE_LABELS[key]} them={<Mark value={tool.features[key]} />} us={<Mark value={OURS.features[key]} />} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section container">
        <div className="two-col">
          <ul className="pro-list them">
            <h3>Where {tool.name} is better</h3>
            {tool.theyWin.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <ul className="pro-list us">
            <h3>Where {PRODUCT.name} is better</h3>
            {tool.weWin.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        {tool.changes && (
          <p className="small muted" style={{ marginTop: "var(--sp-6)", display: "flex", gap: "var(--sp-2)" }}>
            <Minus aria-hidden="true" style={{ width: 16, height: 16, flex: "none", marginTop: 3 }} />
            <span>{tool.changes}</span>
          </p>
        )}
        <div style={{ marginTop: "var(--sp-8)" }}>
          <Accordion
            heading="h3"
            className="sources-acc"
            items={[
              {
                id: "sources",
                title: "How these facts were checked",
                body: (
                  <div className="prose prose-sm">
                    <p>
                      Read on {tool.checkedAt} from {tool.vendor.split(",")[0]}'s own pages, with independent
                      reviews used only to fill gaps. Prices are as the vendor showed them, in the currency
                      and region seen. Where a vendor publishes nothing, the page says "Not stated".
                    </p>
                    <ol className="sources">
                      {tool.sources.map((source) => (
                        <li key={source.url}>
                          <a href={source.url} rel="noopener noreferrer nofollow" target="_blank">
                            {source.label}
                          </a>
                        </li>
                      ))}
                    </ol>
                    <p>
                      {tool.name} is a product of {tool.vendor}. The name is used only to identify the product
                      being compared.
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </section>

      <section className="container" style={{ paddingBottom: "var(--sp-16)" }}>
        <h2 className="h2" style={{ marginBottom: "var(--sp-6)" }}>
          Other comparisons
        </h2>
        <div className="card-grid">
          {others.map((other) => (
            <CompareCard key={other.slug} tool={other} />
          ))}
        </div>
        <p className="actions">
          <Link to={ROUTES.app} className="btn btn-primary btn-lg">
            Try {PRODUCT.name} on a PDF <ArrowRight className="btn-arrow" aria-hidden="true" />
          </Link>
          <Link to={ROUTES.compare} className="btn btn-secondary btn-lg">
            All comparisons
          </Link>
        </p>
      </section>
    </>
  );
}
