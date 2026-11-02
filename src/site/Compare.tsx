import { Link } from "react-router";
import { CalendarCheck, CloudUpload, Scale, TextCursorInput, Type, UserX } from "lucide-react";
import { COMPETITORS, OURS } from "../data/competitors.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { CompareCard, ToolMark } from "./CompareCard.tsx";
import { LogoMark } from "./Logo.tsx";
import { Mark, Where } from "./Marks.tsx";
import { Price } from "./Price.tsx";
import { useMeta } from "./useMeta.ts";
import "./compare.css";

// The headline numbers beside the title, counted from the data so they never drift from the table.
function stats() {
  const total = COMPETITORS.length;
  const count = (test: (tool: (typeof COMPETITORS)[number]) => boolean) => COMPETITORS.filter(test).length;
  return [
    {
      icon: CloudUpload,
      figure: count((tool) => tool.processing.where === "server"),
      of: total,
      label: "upload your file to their servers",
    },
    {
      icon: Type,
      figure: count((tool) => tool.textEditing.keepsFont === "yes"),
      of: total,
      label: `keep the page's own font (${count((tool) => tool.textEditing.keepsFont === "partial")} partly)`,
    },
    {
      icon: TextCursorInput,
      figure: count((tool) => tool.free.editsExistingText === "yes"),
      of: total,
      label: "edit existing text on their free tier",
    },
    {
      icon: UserX,
      figure: count((tool) => tool.account.required === "no"),
      of: total,
      label: "need no account at all",
    },
  ];
}

export function Compare() {
  useMeta({
    title: "Compare PDF editors",
    description: `${PRODUCT.name} against iLovePDF, Smallpdf, Adobe Acrobat online, Sejda, PDF24, pdfFiller, Foxit, Canva, Xodo and others: where files are processed, what is free, and whether text edits keep the original font. Checked ${PRODUCT.comparisonsCheckedAt}.`,
  });
  return (
    <>
      <section className="section container">
        <div className="cmp-index-head">
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
          </div>
          <aside className="cmp-stats" aria-label="The comparison in numbers">
            {stats().map((stat) => (
              <div key={stat.label} className="cmp-stat">
                <span className="icon-tile" aria-hidden="true">
                  <stat.icon />
                </span>
                <strong>
                  {stat.figure}
                  <small>of {stat.of}</small>
                </strong>
                <span>{stat.label}</span>
              </div>
            ))}
            <p className="cmp-stats-foot">
              <span>
                <CalendarCheck aria-hidden="true" /> Checked {PRODUCT.comparisonsCheckedAt}
              </span>
              <span>Sources on every page</span>
            </p>
          </aside>
        </div>

        <div className="table-wrap sticky">
          <table className="cmp-table cmp-main">
            <caption className="sr-only">
              Twelve PDF editors and {PRODUCT.name}: where files are processed, whether an account is needed,
              whether existing text can be edited and keeps its font, free limits and the starting price
            </caption>
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col">Files processed</th>
                <th scope="col">Account needed</th>
                <th scope="col">Edits existing text</th>
                <th scope="col">Keeps original font</th>
                <th scope="col">Free file cap and limit</th>
                <th scope="col" className="num">
                  Paid from
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="us">
                <th scope="row">
                  <span className="tool-cell">
                    <LogoMark size={22} />
                    <span>{OURS.name}</span>
                  </span>
                </th>
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
                <td className="num">
                  <Price price={OURS.startingPrice} />
                </td>
              </tr>
              {COMPETITORS.map((tool) => (
                <tr key={tool.slug}>
                  <th scope="row">
                    <Link to={ROUTES.comparison(tool.slug)} className="tool-cell">
                      <ToolMark brand={tool.brand} size={22} />
                      <span>{tool.name}</span>
                    </Link>
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
                  <td className="num">
                    <Price price={tool.startingPrice} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted cmp-footnote">
          "Keeps original font" means the vendor's editor sets retyped text in the PDF's embedded font rather
          than a substitute. Prices are the lowest paid plan in the currency the vendor showed and change
          often; a regional, approximate or third-party figure is marked as such, and each page links to the
          source it was read from.
        </p>
      </section>

      <section className="container cmp-cards-section">
        <div className="section-head">
          <h2 className="h2">One page per tool</h2>
          <p className="lede">
            Each page scores {PRODUCT.name} and the tool on the same facts, says where each is the better
            choice, and lists its sources.
          </p>
        </div>
        <div className="card-grid">
          {COMPETITORS.map((tool) => (
            <CompareCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>
    </>
  );
}
