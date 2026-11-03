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
// sidebar. It replays one edit: a figure in the first paragraph is retyped and the paragraph
// reflows around it.
const BEFORE = "nine per cent";
const AFTER = "eleven per cent";

type Phase = "idle" | "deleting" | "typing" | "done";

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useTypedEdit(before = BEFORE, after = AFTER): { text: string; editing: boolean } {
  // The replay always starts from the original text, so prerendered markup matches the first render
  // in every browser; a viewer who prefers reduced motion is shown the finished edit straight away.
  const [text, setText] = useState(before);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (reducedMotion()) {
      setText(after);
      return;
    }
    let timer = 0;
    const schedule = (ms: number, next: () => void) => {
      timer = window.setTimeout(next, ms);
    };
    if (phase === "idle") schedule(2600, () => setPhase("deleting"));
    else if (phase === "deleting") {
      if (text.length > 0) schedule(50, () => setText((value) => value.slice(0, -1)));
      else schedule(300, () => setPhase("typing"));
    } else if (phase === "typing") {
      if (text.length < after.length) schedule(80, () => setText(after.slice(0, text.length + 1)));
      else schedule(4200, () => setPhase("done"));
    } else if (phase === "done") {
      schedule(0, () => {
        setText(before);
        setPhase("idle");
      });
    }
    return () => window.clearTimeout(timer);
  }, [phase, text, before, after]);

  return { text, editing: phase === "deleting" || phase === "typing" };
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
  const { text, editing } = useTypedEdit();
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
                <span className="ew-page-kicker">Annual letter · 2026</span>
              </div>
              <h4>Letter to shareholders</h4>
              <p className="ew-byline">From the chief executive · 14 March 2026</p>
              <p className={editing ? "ew-block selected editing" : "ew-block selected"}>
                <span className="ew-badge">1</span>
                <span className="ew-grip">
                  <GripVertical />
                </span>
                <span className="ew-grip resize">
                  <ChevronsLeftRight />
                </span>
                <strong>Revenue.</strong> Full-year revenue grew {text}
                <span className="ew-caret" /> to $4.2 billion, with growth in every region. Subscription
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
                    <td>18%</td>
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
                  <span className="ew-object-detail">Revenue. Full-year revenue grew {text} to $4.2 billion</span>
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
                      10<i>pt</i>
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
                <p className="ew-quote">
                  Revenue. Full-year revenue grew nine per cent to $4.2 billion, with growth in every region.
                  Subscription revenue now makes up two thirds of the total, up from half two years ago, and
                  renewal rates held above ninety per cent for the fourth consecutive year.
                </p>
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
