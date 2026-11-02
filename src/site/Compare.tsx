import { Link } from "react-router";
import { Scale } from "lucide-react";
import { COMPETITORS, OURS } from "../data/competitors.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { Mark, Where } from "./Marks.tsx";
import { useMeta } from "./useMeta.ts";

export function Compare() {
  useMeta({
    title: "Compare PDF editors",
    description: `${PRODUCT.name} against iLovePDF, Smallpdf, Adobe Acrobat online, Sejda, PDF24, pdfFiller, Foxit, Canva, Xodo and others: where files are processed, what is free, and whether text edits keep the original font. Checked ${PRODUCT.comparisonsCheckedAt}.`,
  });
  return (
    <>
      <section className="section container">
        <div className="section-head">
          <p className="eyebrow">
            <Scale aria-hidden="true" /> Compare
          </p>
          <h1 className="display">The same questions, asked of every PDF editor.</h1>
          <p className="lede">
            Where does your file go, what does the free tier really allow, and when you retype a line, does
            it keep the page's font? Facts checked against each vendor's own pages, with sources. Where a
            competitor is better, the page says so.
          </p>
          <p className="as-of" style={{ marginTop: "var(--sp-5)" }}>
            Checked {PRODUCT.comparisonsCheckedAt}
          </p>
        </div>

        <div className="table-wrap">
          <table className="cmp-table">
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col">Files processed</th>
                <th scope="col">Account needed</th>
                <th scope="col">Edits existing text</th>
                <th scope="col">Keeps original font</th>
                <th scope="col">Free file cap and limit</th>
                <th scope="col">Paid from</th>
              </tr>
            </thead>
            <tbody>
              <tr className="us">
                <th scope="row">{OURS.name}</th>
                <td>
                  <Where where={OURS.processing.where} />
                </td>
                <td>
                  <Mark value={OURS.account.required} labels={{ no: "No" }} />
                </td>
                <td>
                  <Mark value={OURS.textEditing.existing} />
                </td>
                <td>
                  <Mark value={OURS.textEditing.keepsFont} />
                </td>
                <td>
                  {OURS.free.fileSizeCap}
                  <span className="cell-note">{OURS.free.taskLimit}</span>
                </td>
                <td>{OURS.priceFrom}</td>
              </tr>
              {COMPETITORS.map((tool) => (
                <tr key={tool.slug}>
                  <th scope="row">
                    <Link to={ROUTES.comparison(tool.slug)}>{tool.name}</Link>
                  </th>
                  <td>
                    <Where where={tool.processing.where} />
                  </td>
                  <td>
                    <Mark value={tool.account.required} labels={{ partial: "For some tasks" }} />
                  </td>
                  <td>
                    <Mark value={tool.textEditing.existing} />
                    {tool.free.editsExistingText !== tool.textEditing.existing && (
                      <span className="cell-note">
                        Free tier: <Mark value={tool.free.editsExistingText} labels={{ partial: "limited" }} />
                      </span>
                    )}
                  </td>
                  <td>
                    <Mark value={tool.textEditing.keepsFont} />
                  </td>
                  <td>
                    {tool.free.fileSizeCap}
                    <span className="cell-note">{tool.free.taskLimit}</span>
                  </td>
                  <td>{tool.priceFrom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: "var(--sp-4)" }}>
          "Keeps original font" means the vendor's editor sets retyped text in the PDF's embedded font rather
          than a substitute. Prices are list prices in the currency the vendor showed and change often; each
          page links to the source it was read from.
        </p>
      </section>

      <section className="container" style={{ paddingBottom: "var(--sp-16)" }}>
        <h2 className="h2" style={{ marginBottom: "var(--sp-6)" }}>
          One page per tool
        </h2>
        <div className="card-grid">
          {COMPETITORS.map((tool) => (
            <Link key={tool.slug} to={ROUTES.comparison(tool.slug)} className="card">
              <div className="card-meta">
                <span className="tag">{tool.vendor}</span>
                <span>{tool.priceFrom === "Free" ? "Free" : `From ${tool.priceFrom}`}</span>
              </div>
              <h3>
                {PRODUCT.name} vs {tool.name}
              </h3>
              <p>{tool.summary}</p>
              <span className="link-arrow">Read the comparison →</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
