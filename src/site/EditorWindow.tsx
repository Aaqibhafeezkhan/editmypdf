import { useEffect, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronsLeftRight,
  ChevronUp,
  Download,
  Eraser,
  FileText,
  FolderOpen,
  GripVertical,
  Italic,
  Maximize,
  Menu,
  Minus,
  Monitor,
  MousePointer2,
  PanelLeft,
  PanelRight,
  PanelRightClose,
  Pencil,
  Plus,
  Redo2,
  RotateCw,
  Signature,
  Smile,
  Square,
  Strikethrough,
  TextCursorInput,
  Trash2,
  Type,
  Underline,
  Undo2,
  UnfoldHorizontal,
} from "lucide-react";
import { PRODUCT } from "../data/product.ts";
import { LogoMark } from "./Logo.tsx";

// A faithful mock of the editor window, drawn with HTML so it is crisp in both themes. It follows
// the editor's own chrome (src/chrome.css): the app bar with its menus and the document's name, the
// labelled tool rail, the page on the canvas with its status bar, and the objects and properties
// sidebar. It replays a sequence of edits, one field at a time: last year's letter is brought up to
// date, from the year in the kicker down to a figure in the segment table, each stretch deleted and
// retyped while its field alone carries the selection. Then the document is restored and the
// sequence starts again.

interface Step {
  /** The stretch of text that is deleted and retyped, and what it becomes. */
  before: string;
  after: string;
  /** The field's whole text, as its entry in the Your edits list shows it. */
  line: (text: string) => string;
  /** The field's original text, as the properties pane quotes it. */
  quote: string;
  /** The field's type size in points, as the properties pane shows it. */
  size: number;
}

const REVENUE_QUOTE =
  "Revenue. Full-year revenue grew nine per cent to $4.2 billion, with growth in every region. " +
  "Subscription revenue now makes up two thirds of the total, up from half two years ago, and renewal " +
  "rates held above ninety per cent for the fourth consecutive year.";

const STEPS: readonly Step[] = [
  { before: "2026", after: "2027", line: (text) => `Annual letter · ${text}`, quote: "Annual letter · 2026", size: 8 },
  {
    before: "shareholders",
    after: "our shareholders",
    line: (text) => `Letter to ${text}`,
    quote: "Letter to shareholders",
    size: 18,
  },
  {
    before: "14 March 2026",
    after: "12 March 2027",
    line: (text) => `From the chief executive · ${text}`,
    quote: "From the chief executive · 14 March 2026",
    size: 9,
  },
  {
    before: "nine per cent",
    after: "eleven per cent",
    line: (text) => `Revenue. Full-year revenue grew ${text} to $4.2 billion`,
    quote: REVENUE_QUOTE,
    size: 10,
  },
  { before: "18%", after: "20%", line: (text) => text, quote: "18%", size: 9 },
];
const KICKER = 0;
const TITLE = 1;
const BYLINE = 2;
const REVENUE = 3;
const MARGIN = 4;

// Pauses in milliseconds: with the original document before the first step, with a field selected
// before its text changes, per character deleted and typed, between deleting and typing, and holding
// a finished edit before moving on.
const PAUSE = { idle: 1400, selected: 2000, delete: 50, gap: 300, type: 80, hold: 3200 } as const;

type Phase = "idle" | "selected" | "deleting" | "typing";

interface Replay {
  /** The step being played. While idle, 0 shows the original document and STEPS.length the finished one. */
  step: number;
  phase: Phase;
  /** The current text of the step's stretch. */
  text: string;
}

const ORIGINAL: Replay = { step: 0, phase: "idle", text: "" };
const FINISHED: Replay = { step: STEPS.length, phase: "idle", text: "" };

function select(step: number): Replay {
  return { step, phase: "selected", text: STEPS[step].before };
}

// What follows a moment of the replay, and after how long.
function following(replay: Replay): [delay: number, next: Replay] {
  const { step, phase, text } = replay;
  if (phase === "idle") return [PAUSE.idle, select(0)];
  if (phase === "selected") return [PAUSE.selected, { ...replay, phase: "deleting" }];
  if (phase === "deleting") {
    if (text.length > 0) return [PAUSE.delete, { ...replay, text: text.slice(0, -1) }];
    return [PAUSE.gap, { ...replay, phase: "typing" }];
  }
  const { after } = STEPS[step];
  if (text.length < after.length) return [PAUSE.type, { ...replay, text: after.slice(0, text.length + 1) }];
  return [PAUSE.hold, step + 1 < STEPS.length ? select(step + 1) : ORIGINAL];
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The replay always starts from the original document with no field being edited, so prerendered
// markup matches the first render in every browser, and one timer at a time carries it from step to
// step. A viewer who prefers reduced motion is shown the finished edits straight away.
function useReplay(): { values: string[]; active: number; editing: boolean } {
  const [replay, setReplay] = useState<Replay>(ORIGINAL);

  useEffect(() => {
    if (reducedMotion()) {
      setReplay(FINISHED);
      return;
    }
    const [delay, next] = following(replay);
    const timer = window.setTimeout(() => setReplay(next), delay);
    return () => window.clearTimeout(timer);
  }, [replay]);

  const { step, phase, text } = replay;
  const active = phase === "idle" ? -1 : step;
  return {
    values: STEPS.map((field, index) => (index < step ? field.after : index === active ? text : field.before)),
    active,
    editing: phase === "deleting" || phase === "typing",
  };
}

// The selection's number badge and its move and resize grips.
function Handles() {
  return (
    <>
      <span className="ew-badge">1</span>
      <span className="ew-grip">
        <GripVertical />
      </span>
      <span className="ew-grip resize">
        <ChevronsLeftRight />
      </span>
    </>
  );
}

function Tool({ active, label, children }: { active?: boolean; label: string; children: React.ReactNode }) {
  return (
    <span className={active ? "ew-tool active" : "ew-tool"}>
      <span className="ew-tool-icon">{children}</span>
      <span className="ew-tool-label">{label}</span>
    </span>
  );
}

function Icon({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={className ? `ew-icon ${className}` : "ew-icon"}>{children}</span>;
}

function StatusIcon({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={className ? `ew-status-icon ${className}` : "ew-status-icon"}>{children}</span>;
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ew-prop">
      <span className="ew-prop-label">{label}</span>
      <span className="ew-prop-control">{children}</span>
    </div>
  );
}

export function EditorWindow() {
  const { values, active, editing } = useReplay();
  // The sidebar follows the field being edited, and the Revenue paragraph while none is; that
  // paragraph also keeps the selection between cycles, as the prerendered page shows it.
  const shown = active === -1 ? REVENUE : active;
  const field = (index: number, base: string) => {
    const selected = index === shown;
    const live = selected && editing;
    const className = `${base}ew-edit${selected ? " selected" : ""}${live ? " editing" : ""}`;
    return { className, selected, live };
  };
  const kicker = field(KICKER, "ew-page-kicker ");
  const title = field(TITLE, "");
  const byline = field(BYLINE, "ew-byline ");
  const revenue = field(REVENUE, "ew-block ");
  const margin = field(MARGIN, "");
  return (
    <div className="ew" aria-hidden="true">
      <div className="ew-bar">
        <div className="ew-bar-start">
          <span className="ew-brand">
            <LogoMark size={24} />
            <span className="ew-brand-word">{PRODUCT.name}</span>
          </span>
          <span className="ew-menus">
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Insert</span>
          </span>
          <Icon className="ew-menu-button">
            <Menu />
          </Icon>
        </div>
        <div className="ew-bar-center">
          <span className="ew-doc">
            <FileText />
            <span className="ew-doc-name">annual-letter.pdf</span>
          </span>
          <span className="ew-doc-meta">3 pages</span>
        </div>
        <div className="ew-bar-end">
          <span className="ew-group ew-history">
            <Icon>
              <Undo2 />
            </Icon>
            <Icon className="dim">
              <Redo2 />
            </Icon>
          </span>
          <span className="ew-sep" />
          <span className="ew-group ew-panels">
            <Icon>
              <Monitor />
            </Icon>
            <Icon className="pressed">
              <PanelRight />
            </Icon>
          </span>
          <span className="ew-sep" />
          <span className="ew-btn outline ew-open">
            <FolderOpen />
            <span className="ew-btn-label">Open</span>
          </span>
          <span className="ew-btn primary ew-download">
            <Download />
            <span className="ew-btn-label">Download</span>
          </span>
        </div>
      </div>

      <div className="ew-body">
        <div className="ew-rail">
          <span className="ew-rail-group">
            <Tool active label="Select">
              <MousePointer2 />
            </Tool>
          </span>
          <span className="ew-rail-group">
            <Tool label="Text">
              <Type />
            </Tool>
            <Tool label="Pencil">
              <Pencil />
            </Tool>
            <Tool label="Shapes">
              <Square />
            </Tool>
            <Tool label="Emoji">
              <Smile />
            </Tool>
            <Tool label="Sign">
              <Signature />
            </Tool>
          </span>
          <span className="ew-rail-group">
            <Tool label="Eraser">
              <Eraser />
            </Tool>
          </span>
        </div>

        <div className="ew-work">
          <div className="ew-canvas">
            <div className="ew-page">
              <div className="ew-page-head">
                <span className="ew-page-rule" />
                <span className={kicker.className}>
                  {kicker.selected && <Handles />}
                  Annual letter · {values[KICKER]}
                  {kicker.live && <span className="ew-caret" />}
                </span>
              </div>
              <h4 className={title.className}>
                {title.selected && <Handles />}
                Letter to {values[TITLE]}
                {title.live && <span className="ew-caret" />}
              </h4>
              <p className={byline.className}>
                {byline.selected && <Handles />}
                From the chief executive · {values[BYLINE]}
                {byline.live && <span className="ew-caret" />}
              </p>
              <p className={revenue.className}>
                {revenue.selected && <Handles />}
                <strong>Revenue.</strong> Full-year revenue grew {values[REVENUE]}
                {revenue.live && <span className="ew-caret" />} to $4.2 billion, with growth in every region. Subscription
                revenue now makes up two thirds of the total, up from half two years ago, and renewal
                rates held above ninety per cent for the fourth consecutive year.
              </p>
              <p>
                <strong>Operating margin.</strong> Margin widened by 180 basis points as the cost of
                delivery fell and headcount grew more slowly than revenue. We expect this trend to
                continue into the coming year as the platform investments of the last two years mature.
              </p>
              <table className="ew-table">
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th>Revenue</th>
                    <th>Growth</th>
                    <th>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Subscriptions</td>
                    <td>$2.8bn</td>
                    <td>+14%</td>
                    <td>31%</td>
                  </tr>
                  <tr>
                    <td>Services</td>
                    <td>$1.4bn</td>
                    <td>+6%</td>
                    <td>
                      <span className={margin.className}>
                        {margin.selected && <Handles />}
                        {values[MARGIN]}
                        {margin.live && <span className="ew-caret" />}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Total</td>
                    <td>$4.2bn</td>
                    <td>+11%</td>
                    <td>27%</td>
                  </tr>
                </tbody>
              </table>
              <p>
                <strong>Outlook.</strong> We enter the year with a record order book and a balance sheet
                that lets us keep investing through the cycle.
              </p>
            </div>
            <span className="ew-page-number">Page 1</span>
          </div>

          <div className="ew-status">
            <span className="ew-status-group ew-status-pages">
              <StatusIcon>
                <PanelLeft />
              </StatusIcon>
              <span className="ew-status-sep" />
              <StatusIcon className="dim">
                <ChevronUp />
              </StatusIcon>
              <span className="ew-page-field">
                <span className="ew-page-input">1</span>
                <span className="ew-page-total">/ 3</span>
              </span>
              <StatusIcon>
                <ChevronDown />
              </StatusIcon>
            </span>
            <span className="ew-status-spacer" />
            <span className="ew-status-group ew-status-view">
              <StatusIcon>
                <UnfoldHorizontal />
              </StatusIcon>
              <StatusIcon>
                <Maximize />
              </StatusIcon>
              <span className="ew-status-sep" />
              <StatusIcon>
                <RotateCw />
              </StatusIcon>
            </span>
            <span className="ew-status-group ew-status-zoom">
              <StatusIcon>
                <Minus />
              </StatusIcon>
              <span className="ew-zoom-value">
                100%
                <ChevronDown />
              </span>
              <StatusIcon>
                <Plus />
              </StatusIcon>
              <span className="ew-slider ew-zoom-slider">
                <span className="ew-slider-range" />
                <span className="ew-slider-thumb" />
              </span>
            </span>
          </div>
        </div>

        <div className="ew-side">
          <div className="ew-pane ew-objects">
            <div className="ew-pane-head">
              <span className="ew-pane-text">
                <strong className="ew-pane-title">
                  Your edits
                  <span className="ew-count">3</span>
                </strong>
                <span className="ew-pane-detail">On 2 pages, in the order added</span>
              </span>
              <Icon className="sm">
                <PanelRightClose />
              </Icon>
            </div>
            <ul className="ew-object-list">
              <li className="ew-object selected">
                <span className="ew-object-n">1</span>
                <span className="ew-object-icon">
                  <TextCursorInput />
                </span>
                <span className="ew-object-text">
                  <span className="ew-object-title">Edited text</span>
                  <span className="ew-object-detail">{STEPS[shown].line(values[shown])}</span>
                </span>
                <span className="ew-object-page">p.1</span>
              </li>
              <li className="ew-object">
                <span className="ew-object-n">2</span>
                <span className="ew-object-icon">
                  <Type />
                </span>
                <span className="ew-object-text">
                  <span className="ew-object-title">Text</span>
                  <span className="ew-object-detail">Approved · 14 March 2026</span>
                </span>
                <span className="ew-object-page">p.3</span>
              </li>
              <li className="ew-object">
                <span className="ew-object-n">3</span>
                <span className="ew-object-icon">
                  <Signature />
                </span>
                <span className="ew-object-text">
                  <span className="ew-object-title">Signature</span>
                </span>
                <span className="ew-object-page">p.3</span>
              </li>
            </ul>
          </div>

          <span className="ew-splitter" />

          <div className="ew-pane ew-props">
            <div className="ew-pane-head">
              <span className="ew-pane-text">
                <strong className="ew-pane-title">Properties</strong>
                <span className="ew-pane-detail">
                  Click the paragraph and type. Text wraps inside the paragraph and keeps its font, size and colour
                </span>
              </span>
              <span className="ew-chip">Paragraph</span>
            </div>
            <div className="ew-pane-body">
              <section className="ew-section">
                <h5 className="ew-eyebrow">Text</h5>
                <PropRow label="Size">
                  <span className="ew-number-slider">
                    <span className="ew-field">
                      {STEPS[shown].size}
                      <i>pt</i>
                    </span>
                    <span className="ew-slider">
                      <span className="ew-slider-range" />
                      <span className="ew-slider-thumb" />
                    </span>
                  </span>
                </PropRow>
                <PropRow label="Style">
                  <span className="ew-segmented">
                    <span>
                      <Bold />
                    </span>
                    <span>
                      <Italic />
                    </span>
                    <span>
                      <Underline />
                    </span>
                    <span>
                      <Strikethrough />
                    </span>
                  </span>
                </PropRow>
                <PropRow label="Align">
                  <span className="ew-segmented">
                    <span>
                      <AlignLeft />
                    </span>
                    <span>
                      <AlignCenter />
                    </span>
                    <span>
                      <AlignRight />
                    </span>
                    <span className="on">
                      <AlignJustify />
                    </span>
                  </span>
                </PropRow>
                <PropRow label="Colour">
                  <span className="ew-color">
                    <span className="ew-color-well">A</span>
                    <span className="ew-color-hex">#1a1a1a</span>
                  </span>
                </PropRow>
              </section>
              <section className="ew-section">
                <h5 className="ew-eyebrow">On the page</h5>
                <p className="ew-quote">{STEPS[shown].quote}</p>
              </section>
            </div>
            <div className="ew-pane-foot">
              <span className="ew-btn outline danger">
                <Trash2 /> Delete selection <kbd>⌫</kbd>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
