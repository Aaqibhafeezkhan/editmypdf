import { Link } from "react-router";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { useMeta } from "./useMeta.ts";

const STEPS = [
  {
    n: "01",
    title: "The page is read, not just drawn",
    body: (
      <>
        <p>
          pdf.js renders each page to a canvas and, alongside it, hands over two things: the page's text
          items with their positions and fonts, and the list of drawing operators the page used. From the
          operator list {PRODUCT.name} walks the glyph stream and records, for every glyph, the character
          and word spacing in force when it was drawn and the font size it was selected at.
        </p>
        <p>
          Lines, filled boxes and images are collected too. Rules that cross form tables; a box painted
          after a run of text hides it, so that text is not offered for editing.
        </p>
      </>
    ),
  },
  {
    n: "02",
    title: "The fonts become typeable",
    body: (
      <>
        <p>
          pdf.js converts every embedded font to OpenType and registers it in the browser. In those
          converted fonts each glyph sits at a private-use code and the Unicode entries are only a courtesy,
          so a ligature can occupy a plain letter's slot. {PRODUCT.name} builds a corrected copy of each
          face from the glyphs the page actually used, with a Unicode table that maps every character to
          the glyph the page drew for it, and registers that copy as the face you type in.
        </p>
      </>
    ),
  },
  {
    n: "03",
    title: "Every line is fitted to its printed width",
    body: (
      <>
        <p>
          Text items are grouped into lines and lines into blocks: a heading, a single line, or a
          paragraph. For each line the editor measures its text in the page's face and compares it with
          the width the page drew. Letter spacing takes the PDF's own character spacing plus any mismatch
          between the font's advances and the page's; word spacing takes the rest. The converted fonts have
          no space glyph, so without this step every line with spaces would open a few points narrower
          than it prints.
        </p>
        <p>
          A paragraph keeps the page's line breaks, each line's own baseline and its own indent, so it
          opens looking exactly as printed. The baseline of the editor's first line is measured on a hidden
          line box rather than computed, because browsers round font metrics to whole pixels.
        </p>
      </>
    ),
  },
  {
    n: "04",
    title: "You type in the page's own face",
    body: (
      <>
        <p>
          Clicking a text element samples the page's pixels under it for the background colour and any
          underline, snapshots the runs to its right that would have to move, and opens an editor at the
          exact position. A paragraph that mixes bold, italic and regular text is one editable block made
          of styled spans; typing continues in whatever face the caret sits in.
        </p>
        <p>
          Until you change a line, it stays as the page set it. From the first edit onward the paragraph's
          soft line breaks turn back into spaces so the text flows again inside the paragraph's own
          column, while the lines above the edit keep their printed layout.
        </p>
      </>
    ),
  },
  {
    n: "05",
    title: "The download is a real PDF with real text",
    body: (
      <>
        <p>
          On export the original strings under each edit are removed from the page's content stream and
          replaced by an equal advance, so nothing else on the page moves. The edited words are written as
          text in a subset of the page's font, positioned word by word where the editor showed them. Pencil
          strokes, shapes, text boxes, emoji and signatures are written as vector or image content with
          pdf-lib.
        </p>
        <p>
          When a face cannot be embedded, or a typed character has no glyph in it, that one edit is painted
          as an image at three times resolution instead. The file you opened is never modified.
        </p>
      </>
    ),
  },
];

const LIMITS = [
  "Scanned pages are images; there is no OCR, so their text cannot be edited, only covered.",
  "Password-protected PDFs are refused.",
  "Text drawn by a Type 3 font or by a font the PDF did not embed opens in a fallback face and exports as an image.",
  "Text inside form XObjects (reused drawing blocks) is covered on export rather than removed.",
  "There is no merging, splitting, page reordering, compression, conversion or form filling.",
  "Everything happens in memory, so a very large file is limited by what your browser can hold.",
];

export function HowItWorks() {
  useMeta({
    title: "How it works",
    description: `How ${PRODUCT.name} reads a PDF, makes its fonts typeable, fits every line to its printed width, and writes edits back as real text, all inside the browser.`,
  });
  return (
    <>
      <section className="section container page-narrow">
        <p className="eyebrow">How it works</p>
        <h1 className="display">From a PDF's own glyphs to a cursor you can type with.</h1>
        <p className="lede">
          A PDF is not a document with paragraphs. It is a list of drawing instructions that happen to
          place glyphs. This is how {PRODUCT.name} turns those instructions back into text you can edit,
          and back again into a PDF.
        </p>
      </section>
      <section className="container page-narrow">
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.n} className="step">
              <span className="step-n" aria-hidden="true">
                {step.n}
              </span>
              <div className="step-body">
                <h2>{step.title}</h2>
                {step.body}
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="section container page-narrow">
        <h2 className="h2">What it does not do</h2>
        <ul className="limits">
          {LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        <p className="actions">
          <Link to={ROUTES.app} className="btn btn-primary btn-lg">
            Open a PDF
          </Link>
          <Link to={ROUTES.blog} className="btn btn-secondary btn-lg">
            Read the engineering posts
          </Link>
        </p>
      </section>
    </>
  );
}
