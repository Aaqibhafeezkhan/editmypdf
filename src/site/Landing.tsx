import { Link } from "react-router";
import {
  Check,
  Download,
  FileText,
  Lock,
  MousePointerClick,
  PenTool,
  Type,
  WrapText,
} from "lucide-react";
import { COMPETITORS, STET } from "../data/competitors.ts";
import { FAQ } from "../data/faq.ts";
import { formatDate, POSTS } from "../data/posts.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { HeroDemo } from "./HeroDemo.tsx";
import { Markdown } from "./Markdown.tsx";
import { readingTime } from "./markdown.ts";
import { Mark, Where } from "./Marks.tsx";
import { useMeta } from "./useMeta.ts";

const FEATURES = [
  {
    icon: MousePointerClick,
    title: "Click the text that is already there",
    body: "Any heading, line or paragraph opens for editing where it sits, in the font the page embeds, at its size, colour, letter spacing and word spacing.",
  },
  {
    icon: WrapText,
    title: "Paragraphs wrap in their own column",
    body: "A paragraph keeps the page's line breaks, baselines and indents until you edit it. From that point on the text flows again inside the paragraph's width.",
  },
  {
    icon: Type,
    title: "Bold, italic and regular in one block",
    body: "A paragraph with a bold lead-in or an italic title edits as one piece of text. Typing continues in whatever face the caret is in.",
  },
  {
    icon: Download,
    title: "Downloads are real text, not pictures",
    body: "Edited words are written back as text in a subset of the page's own font, with the original strings removed, so the result is searchable and sharp at any zoom.",
  },
  {
    icon: PenTool,
    title: "Annotate on top",
    body: "Pencil with seven brush styles, lines and arrows, more than seventy shapes, text boxes, emoji, and a signature drawn or typed. Move, resize, rotate, undo.",
  },
  {
    icon: Lock,
    title: "Nothing is uploaded",
    body: "The file is parsed, edited and rewritten in your tab. Each document gets its own link in this browser, so a refresh brings it back.",
  },
];

const TEASER = ["ilovepdf", "smallpdf", "adobe-acrobat-online", "sejda"];

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
      featureList: FEATURES.map((feature) => feature.title),
    },
  });
  const teaser = TEASER.map((slug) => COMPETITORS.find((tool) => tool.slug === slug)).filter(
    (tool): tool is NonNullable<typeof tool> => Boolean(tool),
  );
  const posts = POSTS.slice(0, 3);
  const questions = FAQ.slice(0, 4);

  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <p className="eyebrow">Free browser PDF editor</p>
          <h1 className="display display-xl">
            Edit the text in a PDF <em>without disturbing the page.</em>
          </h1>
          <p className="lede">
            Click a line, retype it, download. The edit is set in the page's own font, at its own size
            and spacing, and the rest of the page stands exactly as it was. Your file never leaves your
            device.
          </p>
          <p className="actions">
            <Link to={ROUTES.app} className="btn btn-primary btn-lg">
              Open the editor
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
        <HeroDemo />
      </section>

      <section className="section container" id="features">
        <div className="section-head">
          <p className="eyebrow">What it does</p>
          <h2 className="h2">An editor for the page itself, not a layer on top of it.</h2>
          <p className="lede">
            Most "edit PDF" tools put new text over the old. {PRODUCT.name} reads the page's own glyphs,
            fonts and spacing and lets you change them in place.
          </p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="feature">
              <span className="feature-icon">
                <feature.icon aria-hidden="true" />
              </span>
              <h3 className="h3">{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="fidelity">
          <div>
            <p className="eyebrow">Fidelity</p>
            <h2 className="h2">
              Nothing moves when you click. <em>That took work.</em>
            </h2>
            <p className="lede">
              The fonts a PDF embeds have no space glyph, so a browser draws every space from a fallback
              font and the line comes out narrower than it prints. {PRODUCT.name} measures each run in the
              page's face and fits its spacing to the width the page drew.
            </p>
            <ul className="checklist">
              <li>
                <Check aria-hidden="true" />
                <span>
                  <strong>Every line fitted to its printed width,</strong> with the PDF's own character and
                  word spacing read from the content stream.
                </span>
              </li>
              <li>
                <Check aria-hidden="true" />
                <span>
                  <strong>Every baseline where the page put it,</strong> measured in the browser rather
                  than computed, because browsers round font metrics.
                </span>
              </li>
              <li>
                <Check aria-hidden="true" />
                <span>
                  <strong>Colour read from the rendered pixels,</strong> and the background sampled so an
                  edit in a tinted cell still matches.
                </span>
              </li>
            </ul>
            <p className="actions">
              <Link to={ROUTES.post("exactly-as-the-page-prints-it")} className="link-arrow">
                Read how the fit is done →
              </Link>
            </p>
          </div>
          <div className="specimen" aria-label="The same line of text set three ways">
            <div className="specimen-row">
              <span className="specimen-label">The page</span>
              <span className="specimen-line page">
                Revenue grew nine per cent to $4.2 billion
                <span className="ruler" aria-hidden="true" />
              </span>
            </div>
            <div className="specimen-row">
              <span className="specimen-label">Fallback space</span>
              <span className="specimen-line fallback">Revenue grew nine per cent to $4.2 billion</span>
            </div>
            <div className="specimen-row">
              <span className="specimen-label">Fitted</span>
              <span className="specimen-line fitted">Revenue grew nine per cent to $4.2 billion</span>
            </div>
            <p className="specimen-note">
              The embedded fonts in our test documents set a space at 318 to 348 units; the fallback
              font's is about 250. Without fitting, a 10-point line with seven spaces opens five to seven
              points short.
            </p>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container band-inner">
          <div>
            <p className="eyebrow">Privacy</p>
            <h2 className="h2">Your document never leaves your device.</h2>
            <p className="lede">
              There is no server. The PDF is parsed by pdf.js in a web worker in your tab, edited there,
              and rewritten by pdf-lib in the same tab. The only network requests are for the app's own
              files.
            </p>
            <p className="actions">
              <Link to={ROUTES.privacy} className="link-arrow">
                What is stored, and where →
              </Link>
            </p>
          </div>
          <ol className="flow">
            <li className="flow-step">
              <span className="n">1</span>
              <div>
                <strong>Open</strong>
                <span>The file is read into memory and parsed in a worker on your machine.</span>
              </div>
            </li>
            <li className="flow-step">
              <span className="n">2</span>
              <div>
                <strong>Edit</strong>
                <span>Changes are kept as a list next to the file and saved to this browser's IndexedDB.</span>
              </div>
            </li>
            <li className="flow-step">
              <span className="n">3</span>
              <div>
                <strong>Download</strong>
                <span>A new PDF is built in the tab and saved through a temporary blob link.</span>
              </div>
            </li>
            <li className="flow-step off">
              <span className="n">×</span>
              <div>
                <strong>Upload</strong>
                <span>There is no step where the file is sent anywhere. The code has no endpoint to send it to.</span>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <p className="eyebrow">Compare</p>
          <h2 className="h2">How it stands against the tools you have used.</h2>
          <p className="lede">
            Honest comparisons with sources, checked {PRODUCT.comparisonsCheckedAt}. Where another tool is
            the better choice, the page says so.
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
        <p className="actions">
          <Link to={ROUTES.compare} className="btn btn-secondary">
            All comparisons
          </Link>
        </p>
      </section>

      <section className="section container">
        <div className="section-head">
          <p className="eyebrow">From the blog</p>
          <h2 className="h2">Engineering notes, not announcements.</h2>
        </div>
        <div className="card-grid">
          {posts.map((post) => (
            <Link key={post.slug} to={ROUTES.post(post.slug)} className="card">
              <div className="card-meta">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span>{readingTime(post.body)} min read</span>
              </div>
              <h3>{post.title}</h3>
              <p>{post.description}</p>
              <span className="link-arrow">Read →</span>
            </Link>
          ))}
        </div>
        <p className="actions">
          <Link to={ROUTES.blog} className="btn btn-secondary">
            All posts
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
            All questions →
          </Link>
        </p>
      </section>

      <section className="section container">
        <div className="cta">
          <FileText aria-hidden="true" style={{ width: 28, height: 28, opacity: 0.7 }} />
          <h2 className="display" style={{ marginTop: "var(--sp-4)" }}>
            Open a PDF and click a line.
          </h2>
          <p className="lede">Free, in your browser, with nothing to install and nothing to upload.</p>
          <p className="actions">
            <Link to={ROUTES.app} className="btn btn-primary btn-lg">
              Open the editor
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
