import { Link } from "react-router";
import { ArrowRight, Check, Download, FolderOpen, Layers, MousePointerClick, Undo2, ZoomIn } from "lucide-react";
import { COMPETITORS, STET } from "../data/competitors.ts";
import { FAQ } from "../data/faq.ts";
import { formatDate, POSTS } from "../data/posts.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { EditorWindow } from "./EditorWindow.tsx";
import { Markdown } from "./Markdown.tsx";
import { readingTime } from "./markdown.ts";
import { Mark, Where } from "./Marks.tsx";
import { useMeta } from "./useMeta.ts";
import { AnnotateVisual, BeforeAfter, ExportVisual, FidelityDemo, PrivacyDiagram, SpansVisual } from "./Visuals.tsx";
import "./landing.css";

const TEASER = ["ilovepdf", "smallpdf", "adobe-acrobat-online", "sejda"];
const COVERS = ["Tj", "¶", "ƒ", "Aa", "{ }", "Tc"];

function Showcase({
  eyebrow,
  title,
  body,
  points,
  visual,
  reverse = false,
  link,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  points: string[];
  visual: React.ReactNode;
  reverse?: boolean;
  link?: { to: string; label: string };
}) {
  return (
    <div className={reverse ? "showcase reverse" : "showcase"}>
      <div className="showcase-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="h2">{title}</h3>
        <p className="lede">{body}</p>
        <ul className="checklist">
          {points.map((point) => (
            <li key={point}>
              <Check aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        {link && (
          <p className="actions">
            <Link to={link.to} className="link-arrow">
              {link.label} <ArrowRight aria-hidden="true" />
            </Link>
          </p>
        )}
      </div>
      <div className="showcase-visual">{visual}</div>
    </div>
  );
}

export function Landing() {
  useMeta({
    title: `${PRODUCT.name} — ${PRODUCT.tagline}`,
    titleSuffix: false,
    description: PRODUCT.description,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: PRODUCT.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description: PRODUCT.shortDescription,
      featureList: [
        "Edit the text already on the page in its embedded font",
        "Paragraphs reflow inside their own column",
        "Bold, italic and regular text in one editable block",
        "Edits exported as real text in a subset of the page's font",
        "Pencil, shapes, text boxes, emoji and signatures",
        "No upload, no account, no file size limit",
      ],
    },
  });
  const teaser = TEASER.map((slug) => COMPETITORS.find((tool) => tool.slug === slug)).filter(
    (tool): tool is NonNullable<typeof tool> => Boolean(tool),
  );
  const posts = POSTS.slice(0, 3);
  const questions = FAQ.slice(0, 4);

  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="container hero-copy">
          <p className="eyebrow">Free browser PDF editor</p>
          <h1 className="display display-xl">
            Edit the text in a PDF <em>without disturbing the page.</em>
          </h1>
          <p className="lede">
            Click a line, retype it, download. The edit is set in the page's own font, at its own size and
            spacing, and the rest of the page stands exactly as it was. Your file never leaves your device.
          </p>
          <p className="actions">
            <Link to={ROUTES.app} className="btn btn-primary btn-lg">
              Open the editor <ArrowRight aria-hidden="true" />
            </Link>
            <Link to={ROUTES.howItWorks} className="btn btn-secondary btn-lg">
              See how it works
            </Link>
          </p>
          <ul className="hero-trust">
            <li>
              <Check aria-hidden="true" /> No upload
            </li>
            <li>
              <Check aria-hidden="true" /> No account
            </li>
            <li>
              <Check aria-hidden="true" /> No watermark
            </li>
            <li>
              <Check aria-hidden="true" /> No file size limit
            </li>
          </ul>
        </div>
        <div className="container hero-window">
          <EditorWindow />
          <span className="callout callout-a">
            <Check aria-hidden="true" /> Same font, size and spacing
          </span>
          <span className="callout callout-b">
            <Check aria-hidden="true" /> Paragraph reflows in its column
          </span>
          <span className="callout callout-c">
            <Check aria-hidden="true" /> Nothing uploaded
          </span>
        </div>
      </section>

      <section className="container steps-strip" aria-label="How it works in three steps">
        <div className="step-chip">
          <span className="step-chip-icon">
            <FolderOpen aria-hidden="true" />
          </span>
          <div>
            <strong>Open</strong>
            <span>Drop a PDF. It is read in a worker on your machine.</span>
          </div>
        </div>
        <span className="step-line" aria-hidden="true" />
        <div className="step-chip">
          <span className="step-chip-icon">
            <MousePointerClick aria-hidden="true" />
          </span>
          <div>
            <strong>Click and type</strong>
            <span>Any heading, line or paragraph opens in its own font.</span>
          </div>
        </div>
        <span className="step-line" aria-hidden="true" />
        <div className="step-chip">
          <span className="step-chip-icon">
            <Download aria-hidden="true" />
          </span>
          <div>
            <strong>Download</strong>
            <span>A new PDF with your words as real text.</span>
          </div>
        </div>
      </section>

      <section className="section container" id="features">
        <div className="section-head centered">
          <p className="eyebrow">What it does</p>
          <h2 className="h2">An editor for the page itself, not a layer on top of it.</h2>
          <p className="lede">
            Most "edit PDF" tools put new text over the old. {PRODUCT.name} reads the page's own glyphs, fonts
            and spacing and lets you change them in place.
          </p>
        </div>

        <Showcase
          eyebrow="Edit in place"
          title={
            <>
              Retype a line. <em>The page stands.</em>
            </>
          }
          body="Any heading, line or paragraph opens for editing where it sits, in the font the page embeds, at its size, colour, letter spacing and word spacing."
          points={[
            "A paragraph keeps the page's line breaks, baselines and indents until you edit it.",
            "From the first edit on, the text flows again inside the paragraph's own width.",
            "The original words are hidden under the edit and taken out of the page on download.",
          ]}
          visual={<BeforeAfter />}
          link={{ to: ROUTES.post("exactly-as-the-page-prints-it"), label: "How the fit is done" }}
        />

        <Showcase
          reverse
          eyebrow="Mixed faces"
          title={
            <>
              Bold, italic and regular, <em>one block.</em>
            </>
          }
          body="A paragraph with a bold lead-in or an italic title is one editable block made of styled spans. Typing continues in whatever face the caret is in."
          points={[
            "Spans carry their family, weight, style, size, colour and PDF font name.",
            "Undo moves through spans, not through whatever the browser would do to the DOM.",
            "Each face is embedded separately on export.",
          ]}
          visual={<SpansVisual />}
          link={{ to: ROUTES.post("mixed-face-paragraphs"), label: "How the span editor works" }}
        />

        <Showcase
          eyebrow="Export"
          title={
            <>
              Downloads are <em>real text</em>, not pictures.
            </>
          }
          body="On export the original strings under your edit are removed from the page's content stream and your words are written as text in a subset of the page's own font."
          points={[
            "Each removed string is replaced by an equal advance, so nothing else on the page moves.",
            "Only the glyphs your edit uses are embedded.",
            "The result is searchable, selectable and sharp at any zoom.",
          ]}
          visual={<ExportVisual />}
          link={{ to: ROUTES.post("exporting-real-text"), label: "How export works" }}
        />

        <Showcase
          reverse
          eyebrow="Annotate"
          title={
            <>
              And everything you'd expect <em>on top.</em>
            </>
          }
          body="Draw, mark, sign and comment. Every mark is written into the PDF as vector or image content, positioned exactly where you put it."
          points={[
            "Pencil with seven brush styles, lines and arrows, more than seventy shapes with fill and stroke.",
            "Text boxes in Helvetica, Times or Courier with size, colour, bold, italic and alignment.",
            "Emoji, and a signature drawn by hand or typed in a script face.",
          ]}
          visual={<AnnotateVisual />}
        />

        <div className="mini-grid">
          <div className="mini">
            <Layers aria-hidden="true" />
            <strong>Every document at its own link</strong>
            <span>Keep several open in tabs. A refresh brings each one back with its edits.</span>
          </div>
          <div className="mini">
            <ZoomIn aria-hidden="true" />
            <strong>Zoom, fit and rotate</strong>
            <span>Pinch or scroll to zoom, fit to width or height, rotate the page.</span>
          </div>
          <div className="mini">
            <Undo2 aria-hidden="true" />
            <strong>Undo everything</strong>
            <span>Every edit and every mark is undoable, including text inside the page.</span>
          </div>
        </div>
      </section>

      <section className="section fidelity-section">
        <div className="container fidelity">
          <div>
            <p className="eyebrow">Fidelity</p>
            <h2 className="h2">
              Nothing moves when you click. <em>That took work.</em>
            </h2>
            <p className="lede">
              The fonts a PDF embeds have no space glyph, so a browser draws every space from a fallback font and
              the line comes out narrower than it prints. {PRODUCT.name} measures each run in the page's face and
              fits its spacing to the width the page drew.
            </p>
            <dl className="stats">
              <div>
                <dt>0.02 pt</dt>
                <dd>Largest drift measured on a re-opened export</dd>
              </div>
              <div>
                <dt>11</dt>
                <dd>PDFs from different producers in the fidelity test set</dd>
              </div>
              <div>
                <dt>318–348</dt>
                <dd>Units an embedded space takes; the fallback's is 250</dd>
              </div>
            </dl>
            <p className="actions">
              <Link to={ROUTES.post("exactly-as-the-page-prints-it")} className="link-arrow">
                Read how the fit is done <ArrowRight aria-hidden="true" />
              </Link>
            </p>
          </div>
          <FidelityDemo />
        </div>
      </section>

      <section className="band">
        <div className="container band-inner">
          <div>
            <p className="eyebrow">Privacy</p>
            <h2 className="h2">Your document never leaves your device.</h2>
            <p className="lede">
              There is no server. The PDF is parsed by pdf.js in a web worker in your tab, edited there, and
              rewritten by pdf-lib in the same tab. The only network requests are for the app's own files.
            </p>
            <p className="actions">
              <Link to={ROUTES.privacy} className="link-arrow">
                What is stored, and where <ArrowRight aria-hidden="true" />
              </Link>
            </p>
          </div>
          <PrivacyDiagram />
        </div>
      </section>

      <section className="section container">
        <div className="section-head centered">
          <p className="eyebrow">Compare</p>
          <h2 className="h2">How it stands against the tools you have used.</h2>
          <p className="lede">
            Honest comparisons with sources, checked {PRODUCT.comparisonsCheckedAt}. Where another tool is the
            better choice, the page says so.
          </p>
        </div>
        <div className="table-wrap">
          <table className="cmp-table">
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col">Files processed</th>
                <th scope="col">Edits existing text</th>
                <th scope="col">Keeps original font</th>
                <th scope="col">Free tier</th>
              </tr>
            </thead>
            <tbody>
              <tr className="us">
                <th scope="row">{STET.name}</th>
                <td>
                  <Where where="browser" />
                </td>
                <td>
                  <Mark value="yes" />
                </td>
                <td>
                  <Mark value="yes" />
                </td>
                <td>Everything, no limits</td>
              </tr>
              {teaser.map((tool) => (
                <tr key={tool.slug}>
                  <th scope="row">
                    <Link to={ROUTES.comparison(tool.slug)}>{tool.name}</Link>
                  </th>
                  <td>
                    <Where where={tool.processing.where} />
                  </td>
                  <td>
                    <Mark value={tool.textEditing.existing} />
                  </td>
                  <td>
                    <Mark value={tool.textEditing.keepsFont} />
                  </td>
                  <td>{tool.free.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="actions centered">
          <Link to={ROUTES.compare} className="btn btn-secondary">
            All twelve comparisons <ArrowRight aria-hidden="true" />
          </Link>
        </p>
      </section>

      <section className="section container">
        <div className="section-head centered">
          <p className="eyebrow">From the blog</p>
          <h2 className="h2">Engineering notes, not announcements.</h2>
        </div>
        <div className="card-grid">
          {posts.map((post, index) => (
            <Link key={post.slug} to={ROUTES.post(post.slug)} className="card post-card-cover">
              <span className="post-cover" aria-hidden="true">
                <span>{COVERS[index % COVERS.length]}</span>
              </span>
              <div className="card-meta">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span>{readingTime(post.body)} min read</span>
              </div>
              <h3>{post.title}</h3>
              <p>{post.description}</p>
              <span className="link-arrow">
                Read <ArrowRight aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
        <p className="actions centered">
          <Link to={ROUTES.blog} className="btn btn-secondary">
            All posts <ArrowRight aria-hidden="true" />
          </Link>
        </p>
      </section>

      <section className="section container page-narrow">
        <div className="section-head">
          <p className="eyebrow">Questions</p>
          <h2 className="h2">The short version.</h2>
        </div>
        <div className="faq-list" style={{ marginTop: 0 }}>
          {questions.map((entry) => (
            <details key={entry.question} className="faq-item" name="landing-faq">
              <summary>{entry.question}</summary>
              <Markdown source={entry.answer} className="prose prose-sm" />
            </details>
          ))}
        </div>
        <p className="actions">
          <Link to={ROUTES.faq} className="link-arrow">
            All questions <ArrowRight aria-hidden="true" />
          </Link>
        </p>
      </section>

      <section className="section container">
        <div className="cta">
          <div className="cta-bg" aria-hidden="true" />
          <h2 className="display">Open a PDF and click a line.</h2>
          <p className="lede">Free, in your browser, with nothing to install and nothing to upload.</p>
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
    </>
  );
}
