import { useEffect, useState } from "react";
import { CloudOff, Cpu, Database, FileDown, FileText, HardDrive } from "lucide-react";
import "@fontsource/great-vibes/latin-400.css";

// Small illustrations for the landing page. Each is HTML and CSS so it is sharp in both themes.

// Cycles a two-state demo until the viewer takes over with the control.
function useToggleCycle(period: number): [boolean, (next: boolean) => void] {
  const [on, setOn] = useState(false);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    if (manual) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setOn((value) => !value), period);
    return () => window.clearInterval(timer);
  }, [manual, period]);
  return [
    on,
    (next) => {
      setManual(true);
      setOn(next);
    },
  ];
}

function Segmented({
  value,
  options,
  onChange,
  label,
}: {
  value: boolean;
  options: [string, string];
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      <button type="button" className={value ? "seg-btn" : "seg-btn on"} aria-pressed={!value} onClick={() => onChange(false)}>
        {options[0]}
      </button>
      <button type="button" className={value ? "seg-btn on" : "seg-btn"} aria-pressed={value} onClick={() => onChange(true)}>
        {options[1]}
      </button>
    </div>
  );
}

// A paragraph before and after one word is retyped: the edit keeps the face and the paragraph
// reflows inside its own column.
export function BeforeAfter() {
  const [after, setAfter] = useToggleCycle(3200);
  return (
    <div className="vis">
      <div className="vis-page">
        <h5>Letter to shareholders</h5>
        <p>
          <strong>Revenue.</strong> Full-year revenue grew{" "}
          <mark className={after ? "edit on" : "edit"}>{after ? "eleven per cent" : "nine per cent"}</mark> to $4.2
          billion, with growth in every region. Subscription revenue now makes up two thirds of the total, up from
          half two years ago.
        </p>
        <p>
          <strong>Operating margin.</strong> Margin widened by 180 basis points as the cost of delivery fell and
          headcount grew more slowly than revenue.
        </p>
      </div>
      <div className="vis-foot">
        <Segmented value={after} options={["Before", "After"]} onChange={setAfter} label="Before or after the edit" />
        <span className="vis-note">{after ? "Same font, same column, lines reflowed." : "The page as it opened."}</span>
      </div>
    </div>
  );
}

const SPANS: { text: string; face: "bold" | "regular" | "italic" }[] = [
  { text: "Revenue.", face: "bold" },
  { text: " Full-year revenue grew nine per cent to $4.2 billion, with growth in ", face: "regular" },
  { text: "every", face: "italic" },
  { text: " region, and renewal rates held above ninety per cent.", face: "regular" },
];

// One paragraph made of styled spans, with the caret sweeping across the faces.
export function SpansVisual() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setStep((value) => (value + 1) % SPANS.length), 1400);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="vis">
      <div className="vis-page spans">
        <p>
          {SPANS.map((span, index) => (
            <span key={index} className={`span-${span.face}${index === step ? " live" : ""}`} data-face={span.face}>
              {span.text}
            </span>
          ))}
        </p>
      </div>
      <div className="vis-foot">
        <span className="vis-legend">
          <i className="sw bold" /> bold <i className="sw regular" /> regular <i className="sw italic" /> italic
        </span>
        <span className="vis-note">One block. Typing continues in the face under the caret.</span>
      </div>
    </div>
  );
}

// What export does: the original string leaves the content stream, the edit is written in a
// subset of the same font.
export function ExportVisual() {
  return (
    <div className="vis export">
      <div className="export-step">
        <span className="export-label">1 · The page</span>
        <div className="vis-page tiny">
          <p>
            Full-year revenue grew <mark className="edit on">eleven per cent</mark> to $4.2 billion.
          </p>
        </div>
      </div>
      <div className="export-step">
        <span className="export-label">2 · Content stream</span>
        <pre className="vis-code">
          {"BT /F1 10.5 Tf\n[(Full-year) -278 (revenue) -278 (grew)\n "}
          <s>(nine per cent)</s>
          {" "}
          <b>-6213</b>
          {"\n -278 (to) -278 ($4.2) -278 (billion.)] TJ\nET"}
        </pre>
        <span className="vis-note">The old string becomes an equal advance, so nothing after it moves.</span>
      </div>
      <div className="export-step">
        <span className="export-label">3 · Written back</span>
        <pre className="vis-code">
          {"/F1-sub 10.5 Tf\n"}
          <b>[(eleven) -278 (per) -278 (cent)] TJ</b>
          {"\n% subset: 11 glyphs, 2.1 KB"}
        </pre>
        <span className="vis-note">Real text in the page's own font, searchable and sharp.</span>
      </div>
    </div>
  );
}

// Annotation tools on a page: a pencil stroke, a shape with handles, a text box and a signature.
export function AnnotateVisual() {
  return (
    <div className="vis">
      <div className="vis-page annotate">
        <h5>Service agreement</h5>
        <p>
          The supplier will deliver the services described in Schedule A from 1 January 2027 and will
          invoice monthly in arrears. Either party may end the agreement with ninety days' notice.
        </p>
        <svg className="ann-ink" viewBox="0 0 300 40" aria-hidden="true">
          <path
            d="M6 30 C 30 2, 60 2, 84 26 S 130 44, 160 18 S 220 -2, 250 22 S 285 38, 296 20"
            fill="none"
            stroke="var(--ann-pen)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <span className="ann-shape">
          <i className="h nw" />
          <i className="h ne" />
          <i className="h sw" />
          <i className="h se" />
        </span>
        <span className="ann-textbox">Approved · 3 Nov 2026</span>
        <span className="ann-sign">Maya Okafor</span>
        <span className="ann-sign-line">Signature</span>
      </div>
      <div className="vis-foot">
        <span className="vis-note">Pencil with seven brushes, seventy-plus shapes, text boxes, emoji, signatures. All movable, all undoable.</span>
      </div>
    </div>
  );
}

// The same line set over the page's own: fitted it sits exactly on top, with a fallback space it drifts.
export function FidelityDemo() {
  const [fitted, setFitted] = useToggleCycle(2800);
  const line = "Revenue grew nine per cent to $4.2 billion";
  return (
    <div className="vis fidelity-demo">
      <div className="overlay">
        <span className="overlay-page">{line}</span>
        <span className={fitted ? "overlay-edit fitted" : "overlay-edit"}>{line}</span>
      </div>
      <div className="vis-foot">
        <Segmented value={fitted} options={["Fallback space", "Fitted"]} onChange={setFitted} label="Spacing mode" />
        <span className="vis-note">
          {fitted ? "Every word lands on the page's own." : "The browser's space is narrower; the line drifts left."}
        </span>
      </div>
    </div>
  );
}

// Where the file goes: nowhere. Everything happens inside the browser box.
export function PrivacyDiagram() {
  return (
    <div className="pd" aria-label="Diagram: the PDF is parsed, edited, stored and written inside the browser; no server is involved">
      <div className="pd-browser">
        <span className="pd-browser-label">Your browser tab</span>
        <div className="pd-node">
          <FileText /> <span>Your PDF</span>
        </div>
        <span className="pd-arrow" />
        <div className="pd-node">
          <Cpu /> <span>pdf.js worker</span>
        </div>
        <span className="pd-arrow" />
        <div className="pd-node">
          <HardDrive /> <span>pdf-lib</span>
        </div>
        <span className="pd-arrow" />
        <div className="pd-node">
          <FileDown /> <span>Download</span>
        </div>
        <div className="pd-store">
          <Database /> <span>IndexedDB keeps the document between visits</span>
        </div>
      </div>
      <div className="pd-outside">
        <CloudOff />
        <span>No server. No upload. Nothing to breach.</span>
      </div>
    </div>
  );
}
