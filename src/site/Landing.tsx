import { Link } from "react-router";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CircleHelp,
  ClipboardPen,
  Code,
  Cpu,
  Download,
  EyeOff,
  FileDown,
  FolderOpen,
  Globe,
  HardDrive,
  Highlighter,
  Layers,
  ListChecks,
  MousePointerClick,
  PenLine,
  Receipt,
  Ruler,
  Scale,
  ShieldCheck,
  Signature,
  Sparkles,
  SpellCheck,
  TrendingUp,
  Type,
  Undo2,
  ZoomIn,
} from "lucide-react";
import { COMPETITORS, STET } from "../data/competitors.ts";
import { FAQ } from "../data/faq.ts";
import { formatDate, POSTS } from "../data/posts.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { Accordion } from "./Accordion.tsx";
import { EditorWindow } from "./EditorWindow.tsx";
import { faqJsonLd } from "./Faq.tsx";
import { Markdown } from "./Markdown.tsx";
import { readingTime } from "./markdown.ts";
import { Mark, Where } from "./Marks.tsx";
import { useMeta } from "./useMeta.ts";
import { AnnotateVisual, BeforeAfter, ExportVisual, FidelityDemo, PrivacyDiagram, SpansVisual } from "./Visuals.tsx";
import "./landing.css";

const TEASER = ["ilovepdf", "smallpdf", "adobe-acrobat-online", "sejda"];
const COVERS = ["Tj", "¶", "ƒ", "Aa", "{ }", "Tc"];

const USE_CASES = [
  {
    icon: SpellCheck,
    title: "Fix a typo in a PDF",
    body: "Click the word, retype it, download. The line keeps its font and spacing and nothing else on the page moves.",
  },
  {
    icon: CalendarDays,
    title: "Change a date or a name on a contract",
    body: "Edit the line where it sits. The original words are removed from the file, not covered up.",
  },
  {
    icon: Receipt,
    title: "Update a price in a quote or invoice",
    body: "Figures in a table cell are reachable as text, so a number changes without redrawing the table.",
  },
  {
    icon: TrendingUp,
    title: "Correct a figure in a report",
    body: "Retype one number in a paragraph and the paragraph reflows inside its own column.",
  },
  {
    icon: ClipboardPen,
    title: "Fill in a form by typing on the page",
    body: "Place a text box in Helvetica, Times or Courier anywhere, or type straight into a printed line.",
  },
  {
    icon: Signature,
    title: "Sign and send it back",
    body: "Draw a signature or type one in a script face, then download a PDF with nothing uploaded.",
  },
];

function Showcase({
  icon: Icon,
  eyebrow,
  title,
  body,
  points,
  visual,
  reverse = false,
  link,
}: {
  icon: typeof PenLine;
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  points: string[];
  visual: React.ReactNode;
  reverse?: boolean;
  link?: { to: string; label: string };
}) {
  return (
    <div className={reverse ? "showcase reverse" : "showcase"} data-reveal>
      <div className="showcase-copy">
        <span className="showcase-icon" aria-hidden="true">
          <Icon />
        </span>
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
  const questions = FAQ.slice(0, 4);
  useMeta({
    title: `${PRODUCT.name} — ${PRODUCT.tagline}`,
    titleSuffix: false,
    description: PRODUCT.description,
    keywords: [
      "edit PDF text",
      "free PDF editor",
      "online PDF editor no upload",
      "edit PDF in browser",
      "change text in PDF",
      "PDF editor keeps original font",
    ],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: PRODUCT.name,
        url: "/",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript. Current Chrome, Edge, Firefox or Safari.",
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
      faqJsonLd(questions),
    ],
  });
  const teaser = TEASER.map((slug) => COMPETITORS.find((tool) => tool.slug === slug)).filter(
    (tool): tool is NonNullable<typeof tool> => Boolean(tool),
  );
  const posts = POSTS.slice(0, 3);

  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="container hero-copy">
          <p className="eyebrow">
            <Sparkles aria-hidden="true" /> Free browser PDF editor
          </p>
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

      <section className="container" aria-label="How it works in three steps">
        <div className="steps-strip" data-reveal>
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
        </div>
        <ul className="trust-strip">
          <li>
            <Cpu aria-hidden="true" /> Reads with pdf.js
          </li>
          <li>
            <HardDrive aria-hidden="true" /> Writes with pdf-lib
          </li>
          <li>
            <Code aria-hidden="true" /> Open source
          </li>
          <li>
            <EyeOff aria-hidden="true" /> No analytics, no tracking
          </li>
          <li>
            <Globe aria-hidden="true" /> Chrome, Edge, Firefox, Safari
          </li>
        </ul>
      </section>

      <section className="section container" id="features">
        <div className="section-head centered">
          <p className="eyebrow">
            <Sparkles aria-hidden="true" /> What it does
          </p>
          <h2 className="h2">An editor for the page itself, not a layer on top of it.</h2>
          <p className="lede">
            Most "edit PDF" tools put new text over the old. {PRODUCT.name} reads the page's own glyphs, fonts
            and spacing and lets you change them in place.
          </p>
        </div>

        <Showcase
          icon={PenLine}
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
          icon={Type}
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
          icon={FileDown}
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
          icon={Highlighter}
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

        <div className="mini-grid" data-reveal>
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

      <section className="section container">
        <div className="section-head centered">
          <p className="eyebrow">
            <ListChecks aria-hidden="true" /> Use cases
          </p>
          <h2 className="h2">Made for the small fixes that used to mean re-exporting the document.</h2>
          <p className="lede">
            When the source file is gone, or was never yours, the PDF is the document. {PRODUCT.name} lets you
            change it without rebuilding it.
          </p>
        </div>
        <div className="usecases" data-reveal>
          {USE_CASES.map((item) => (
            <Link key={item.title} to={ROUTES.app} className="usecase">
              <span className="usecase-icon" aria-hidden="true">
                <item.icon />
              </span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <span className="link-arrow">
                Open the editor <ArrowRight aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
        <div className="seo-copy" data-reveal>
          <div>
            <h3>Edit PDF text online, free, without uploading</h3>
            <p>
              {PRODUCT.name} is a free online PDF editor that runs entirely in your browser. You can edit the
              text already in a PDF, change words, numbers and dates in place, and download a new PDF, with no
              upload, no account and no watermark. Because nothing is sent to a server, there is no file size
              limit beyond your browser's memory and no daily task counter.
            </p>
          </div>
          <div>
            <h3>The PDF's own font, not a look-alike</h3>
            <p>
              Most PDF editors replace the text you retype with a standard typeface or the closest match from
              a font library. {PRODUCT.name} edits in the font the PDF embeds, keeps its letter and word
              spacing, and writes the result back as real text in a subset of that font, so the edited PDF
              stays searchable and prints exactly as it looks on screen.
            </p>
          </div>
        </div>
      </section>

      <section className="section fidelity-section">
        <div className="container fidelity" data-reveal>
          <div>
            <p className="eyebrow">
              <Ruler aria-hidden="true" /> Fidelity
            </p>
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
        <div className="container band-inner" data-reveal>
          <div>
            <p className="eyebrow">
              <ShieldCheck aria-hidden="true" /> Privacy
            </p>
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
          <p className="eyebrow">
            <Scale aria-hidden="true" /> Compare
          </p>
          <h2 className="h2">How it stands against the tools you have used.</h2>
          <p className="lede">
            Honest comparisons, checked {PRODUCT.comparisonsCheckedAt}. Where another tool is the better choice,
            the page says so.
          </p>
        </div>
        <div className="table-wrap" data-reveal>
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
          <p className="eyebrow">
            <BookOpen aria-hidden="true" /> From the blog
          </p>
          <h2 className="h2">Engineering notes, not announcements.</h2>
        </div>
        <div className="card-grid" data-reveal>
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
          <p className="eyebrow">
            <CircleHelp aria-hidden="true" /> Questions
          </p>
          <h2 className="h2">The short version.</h2>
        </div>
        <Accordion
          heading="h3"
          initial={questions[0]?.question ?? null}
          items={questions.map((entry) => ({
            id: entry.question,
            title: entry.question,
            body: <Markdown source={entry.answer} className="prose prose-sm" />,
          }))}
        />
        <p className="actions">
          <Link to={ROUTES.faq} className="link-arrow">
            All questions <ArrowRight aria-hidden="true" />
          </Link>
        </p>
      </section>

      <section className="section container">
        <div className="cta" data-reveal>
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
