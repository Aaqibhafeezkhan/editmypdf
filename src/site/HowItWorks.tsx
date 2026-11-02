import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Ban,
  BookOpen,
  CaseSensitive,
  FileOutput,
  FileSearch,
  Layers,
  Lock,
  MemoryStick,
  Ruler,
  ScanLine,
  Scissors,
  TextCursorInput,
  Type,
  Workflow,
} from "lucide-react";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { useMeta } from "./useMeta.ts";
import "./how.css";

const STEPS = [
  {
    n: "01",
    short: "Read the page",
    icon: FileSearch,
    title: "The page is read, not just drawn",
    summary: "pdf.js renders the page and hands over its text items and the drawing operators that produced them.",
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
    short: "Fix the fonts",
    icon: CaseSensitive,
    title: "The fonts become typeable",
    summary: "A corrected copy of each embedded font is registered so every character maps to the glyph the page used.",
    body: (
      <p>
        pdf.js converts every embedded font to OpenType and registers it in the browser. In those
        converted fonts each glyph sits at a private-use code and the Unicode entries are only a courtesy,
        so a ligature can occupy a plain letter's slot. {PRODUCT.name} builds a corrected copy of each
        face from the glyphs the page actually used, with a Unicode table that maps every character to
        the glyph the page drew for it, and registers that copy as the face you type in.
      </p>
    ),
  },
  {
    n: "03",
    short: "Fit every line",
    icon: Ruler,
    title: "Every line is fitted to its printed width",
    summary: "Letter and word spacing are solved per line so the editor opens exactly as wide as the page drew it.",
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
    short: "Type in place",
    icon: TextCursorInput,
    title: "You type in the page's own face",
    summary: "A click samples the page's pixels, snapshots the neighbours and opens a styled-span editor in place.",
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
    short: "Write the PDF",
    icon: FileOutput,
    title: "The download is a real PDF with real text",
    summary: "The original strings leave the content stream and your words are written in a subset of the page's font.",
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
  { icon: ScanLine, text: "Scanned pages are images; there is no OCR, so their text cannot be edited, only covered." },
  { icon: Lock, text: "Password-protected PDFs are refused." },
  {
    icon: Type,
    text: "Text drawn by a Type 3 font or by a font the PDF did not embed opens in a fallback face and exports as an image.",
  },
  { icon: Layers, text: "Text inside form XObjects (reused drawing blocks) is covered on export rather than removed." },
  { icon: Scissors, text: "There is no merging, splitting, page reordering, compression, conversion or form filling." },
  { icon: MemoryStick, text: "Everything happens in memory, so a very large file is limited by what your browser can hold." },
];

// The site header's height; the step strip sticks under it.
const HEADER = 64;

// The five steps as a strip that sticks under the site header while the steps scroll past, the
// step on screen highlighted. A click scrolls so the step's card sits under the strip.
function StepStrip() {
  const [active, setActive] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = STEPS.map((step) => document.getElementById(`step-${step.n}`)).filter((node): node is HTMLElement => node !== null);
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = HEADER + (strip.current?.offsetHeight ?? 0) + 40;
      let current: string | null = null;
      for (const card of cards) {
        if (card.getBoundingClientRect().top <= line) current = card.id;
        else break;
      }
      // Past the last card the strip stays on the last step; above the first, nothing is marked.
      setActive(current);
      setStuck((sentinel.current?.getBoundingClientRect().bottom ?? 1) < HEADER);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // On a narrow screen the strip scrolls sideways; the active step is kept in view.
  useEffect(() => {
    if (!active || !strip.current) return;
    const row = strip.current.querySelector<HTMLElement>(".how-overview");
    const item = row?.querySelector<HTMLElement>(`[data-step="${active}"]`);
    if (!row || !item || row.scrollWidth <= row.clientWidth) return;
    const left = item.offsetLeft - (row.clientWidth - item.offsetWidth) / 2;
    row.scrollTo({ left, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active]);

  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const node = document.getElementById(id);
    if (!node) return;
    event.preventDefault();
    const offset = HEADER + (strip.current?.offsetHeight ?? 0) + 16;
    const top = node.getBoundingClientRect().top + window.scrollY - offset;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <>
      <div ref={sentinel} className="how-sentinel" aria-hidden="true" />
      <div ref={strip} className={stuck ? "how-sticky stuck" : "how-sticky"}>
        <div className="container">
          <ol className="how-overview" aria-label="The five steps">
            {STEPS.map((step) => {
              const id = `step-${step.n}`;
              const current = active === id;
              return (
                <li key={step.n} data-step={id} className={current ? "active" : undefined}>
                  <a href={`#${id}`} aria-current={current ? "step" : undefined} onClick={(event) => jump(event, id)}>
                    <span className="icon-tile" aria-hidden="true">
                      <step.icon />
                    </span>
                    <span className="how-overview-n">{step.n}</span>
                    <span className="how-overview-t">{step.short}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </>
  );
}

export function HowItWorks() {
  useMeta({
    title: "How it works",
    description: `How ${PRODUCT.name} reads a PDF, makes its fonts typeable, fits every line to its printed width, and writes edits back as real text, all inside the browser.`,
    keywords: ["how PDF editing works", "edit PDF in browser", "pdf.js", "embedded fonts", "content stream"],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `How ${PRODUCT.name} edits the text in a PDF`,
      description: "From a PDF's own glyphs to a cursor you can type with, and back to a PDF.",
      step: STEPS.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: step.summary,
      })),
    },
  });
  return (
    <>
      <section className="section container tone-violet how-intro">
        <div className="section-head">
          <p className="eyebrow">
            <Workflow aria-hidden="true" /> How it works
          </p>
          <h1 className="display">From a PDF's own glyphs to a cursor you can type with.</h1>
          <p className="lede">
            A PDF is not a document with paragraphs. It is a list of drawing instructions that happen to
            place glyphs. This is how {PRODUCT.name} turns those instructions back into text you can edit,
            and back again into a PDF.
          </p>
        </div>
      </section>

      {/* The strip and the steps share one wrapper: a sticky element can only stick within its
          parent's box, so the parent has to be as tall as the steps it follows. */}
      <div className="tone-violet how-flow">
        <StepStrip />
        <section className="container how-steps-section">
          <ol className="how-steps">
          {STEPS.map((step) => (
            <li key={step.n} id={`step-${step.n}`} className="how-step">
              <span className="how-step-marker" aria-hidden="true">
                <span className="icon-tile lg">
                  <step.icon />
                </span>
              </span>
              <div className="how-step-card">
                <span className="how-step-n">Step {step.n}</span>
                <h2>{step.title}</h2>
                <p className="how-step-summary">{step.summary}</p>
                <div className="how-step-body">{step.body}</div>
              </div>
            </li>
          ))}
          </ol>
        </section>
      </div>

      <section className="section container tone-coral">
        <div className="section-head">
          <p className="eyebrow">
            <Ban aria-hidden="true" /> Limits
          </p>
          <h2 className="h2">What it does not do</h2>
          <p className="lede">
            {PRODUCT.name} does one job, editing the text on the page. These are the cases it leaves alone,
            and the <Link to={ROUTES.compare}>comparisons</Link> say which tools do them well.
          </p>
        </div>
        <ul className="limits-grid">
          {LIMITS.map((limit) => (
            <li key={limit.text} className="card limit-card">
              <span className="icon-tile" aria-hidden="true">
                <limit.icon />
              </span>
              <span>{limit.text}</span>
            </li>
          ))}
        </ul>
        <p className="actions">
          <Link to={ROUTES.app} className="btn btn-primary btn-lg">
            Open a PDF <ArrowRight className="btn-arrow" aria-hidden="true" />
          </Link>
          <Link to={ROUTES.blog} className="btn btn-secondary btn-lg">
            <BookOpen className="btn-lead" aria-hidden="true" /> Read the engineering posts
          </Link>
        </p>
      </section>
    </>
  );
}
