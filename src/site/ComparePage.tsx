import { Link, useParams } from "react-router";
import { ArrowRight, Check, ChevronRight, Minus, Scale } from "lucide-react";
import { competitorBySlug, COMPETITORS, FEATURE_LABELS, OURS, triWord, type Competitor, type Tool } from "../data/competitors.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { Accordion } from "./Accordion.tsx";
import { Mark, Where } from "./Marks.tsx";
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
    title,
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
          <div>
            <p className="eyebrow">
              <Scale aria-hidden="true" /> Comparison
            </p>
            <h1 className="display">
              {PRODUCT.name} <em>vs</em> {tool.name}
            </h1>
            <p className="lede">{tool.summary}</p>
            <p className="as-of" style={{ marginTop: "var(--sp-5)" }}>
              Facts checked {tool.checkedAt}
            </p>
          </div>
          <aside className="cmp-verdict">
            <h2>In short</h2>
            <p>{tool.verdict}</p>
          </aside>
        </div>
      </section>

      <section className="container">
        <div className="table-wrap" data-reveal>
          <table className="cmp-table glance">
            <thead>
              <tr>
                <th scope="col">At a glance</th>
                <th scope="col">{tool.name}</th>
                <th scope="col">{PRODUCT.name}</th>
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
        <div className="two-col" data-reveal>
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
        <div className="card-grid" data-reveal>
          {others.map((other) => (
            <Link key={other.slug} to={ROUTES.comparison(other.slug)} className="card">
              <div className="card-meta">
                <span className="tag">{other.vendor}</span>
              </div>
              <h3>
                {PRODUCT.name} vs {other.name}
              </h3>
              <p>{other.summary}</p>
              <span className="link-arrow">
                Read the comparison <ArrowRight aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
        <p className="actions">
          <Link to={ROUTES.app} className="btn btn-primary btn-lg">
            Try {PRODUCT.name} on a PDF <ArrowRight aria-hidden="true" />
          </Link>
          <Link to={ROUTES.compare} className="btn btn-secondary btn-lg">
            All comparisons
          </Link>
        </p>
      </section>
    </>
  );
}
