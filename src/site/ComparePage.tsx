import { Link, useParams } from "react-router";
import { Check, Minus } from "lucide-react";
import { competitorBySlug, COMPETITORS, FEATURE_LABELS, STET, triWord, type Competitor, type Tool } from "../data/competitors.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { Mark, Where } from "./Marks.tsx";
import { NotFound } from "./NotFound.tsx";
import { useMeta } from "./useMeta.ts";

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
    description: `${tool.name} compared with ${PRODUCT.name}: where files are processed, free limits, pricing, and whether editing text keeps the original font. Facts checked ${tool.checkedAt}, with sources.`,
  });
  const others = COMPETITORS.filter((item) => item.slug !== tool.slug).slice(0, 3);
  const features = Object.keys(FEATURE_LABELS) as (keyof Tool["features"])[];
  const names: [string, string] = [tool.name, PRODUCT.name];
  return (
    <>
      <section className="section container">
        <div className="cmp-head">
          <div>
            <p className="eyebrow">
              <Link to={ROUTES.compare} style={{ color: "inherit", textDecoration: "none" }}>
                Compare
              </Link>
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
        <div className="table-wrap">
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
                    <Where where={STET.processing.where} />
                    <span className="cell-note">{STET.processing.note}</span>
                  </>
                }
              />
              <Row
                names={names}
                label="File retention"
                them={tool.processing.retention}
                us={STET.processing.retention}
              />
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
                us={STET.free.summary}
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
                    <span className="cell-note">{STET.textEditing.note}</span>
                  </>
                }
              />
              {features.map((key) => (
                <Row key={key} names={names} label={FEATURE_LABELS[key]} them={<Mark value={tool.features[key]} />} us={<Mark value={STET.features[key]} />} />
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
      </section>

      <section className="container page-narrow" style={{ paddingBottom: "var(--sp-12)" }}>
        <h2 className="h3" style={{ marginBottom: "var(--sp-3)" }}>
          Sources
        </h2>
        <ol className="sources">
          {tool.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} rel="noopener noreferrer nofollow" target="_blank">
                {source.label}
              </a>{" "}
              (accessed {source.accessed})
            </li>
          ))}
        </ol>
        <p className="small muted" style={{ marginTop: "var(--sp-4)" }}>
          {tool.name} is a product of {tool.vendor}. The name is used only to identify the product being
          compared. If a fact here is out of date, the source links show where it was read.
        </p>
      </section>

      <section className="container" style={{ paddingBottom: "var(--sp-16)" }}>
        <h2 className="h2" style={{ marginBottom: "var(--sp-6)" }}>
          Other comparisons
        </h2>
        <div className="card-grid">
          {others.map((other) => (
            <Link key={other.slug} to={ROUTES.comparison(other.slug)} className="card">
              <div className="card-meta">
                <span className="tag">{other.vendor}</span>
              </div>
              <h3>
                {PRODUCT.name} vs {other.name}
              </h3>
              <p>{other.summary}</p>
              <span className="link-arrow">Read the comparison →</span>
            </Link>
          ))}
        </div>
        <p className="actions">
          <Link to={ROUTES.app} className="btn btn-primary btn-lg">
            Try {PRODUCT.name} on a PDF
          </Link>
          <Link to={ROUTES.compare} className="btn btn-secondary btn-lg">
            All comparisons
          </Link>
        </p>
      </section>
    </>
  );
}
