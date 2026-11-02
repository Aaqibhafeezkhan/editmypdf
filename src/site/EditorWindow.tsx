import { useEffect, useState } from "react";
import {
  ChevronDown,
  Download,
  Eraser,
  Minus,
  Monitor,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  RotateCw,
  Shapes,
  Signature,
  Smile,
  Trash2,
  Type,
  Undo2,
  UnfoldHorizontal,
  UnfoldVertical,
} from "lucide-react";
import { PRODUCT } from "../data/product.ts";
import { LogoMark } from "./Logo.tsx";

// A faithful mock of the editor window, drawn with HTML so it is crisp in both themes. It replays
// one edit: a figure in the first paragraph is retyped and the paragraph reflows around it.
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

function RailButton({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return <span className={active ? "ew-rail-btn active" : "ew-rail-btn"}>{children}</span>;
}

export function EditorWindow() {
  const { text, editing } = useTypedEdit();
  return (
    <div className="ew" aria-hidden="true">
      <div className="ew-top">
        <span className="ew-brand">
          <LogoMark size={22} />
          <span className="ew-brand-word">{PRODUCT.name}</span>
        </span>
        <span className="ew-file">
          annual-letter.pdf <ChevronDown />
        </span>
        <span className="ew-top-actions">
          <span className="ew-icon">
            <Undo2 />
          </span>
          <span className="ew-icon dim">
            <Redo2 />
          </span>
          <span className="ew-icon">
            <Monitor />
          </span>
          <span className="ew-btn outline">Edit another PDF</span>
          <span className="ew-btn primary">
            <Download /> Download
          </span>
        </span>
      </div>
      <div className="ew-body">
        <div className="ew-rail">
          <RailButton active>
            <MousePointer2 />
          </RailButton>
          <RailButton>
            <Pencil />
          </RailButton>
          <RailButton>
            <Type />
          </RailButton>
          <RailButton>
            <Eraser />
          </RailButton>
          <span className="ew-rail-gap" />
          <RailButton>
            <Shapes />
          </RailButton>
          <RailButton>
            <Smile />
          </RailButton>
          <RailButton>
            <Signature />
          </RailButton>
        </div>
        <div className="ew-canvas">
          <div className="ew-page">
            <div className="ew-page-head">
              <span className="ew-page-rule" />
              <span className="ew-page-kicker">Annual letter · 2026</span>
            </div>
            <h4>Letter to shareholders</h4>
            <p className="ew-byline">From the chief executive · 14 March 2026</p>
            <p className={editing ? "ew-block selected editing" : "ew-block selected"}>
              <span className="ew-tag">Paragraph</span>
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
          <div className="ew-footer">
          <div className="ew-zoom">
            <Minus />
            <span>100%</span>
            <Plus />
            <span className="ew-slider">
              <span />
            </span>
          </div>
          <div className="ew-arrange">
            <UnfoldVertical />
            <UnfoldHorizontal />
            <span className="ew-arrange-gap" />
            <RotateCw />
          </div>
          </div>
          <div className="ew-count">1 / 3</div>
        </div>
        <div className="ew-inspector">
          <div className="ew-inspector-head">
            <strong>Paragraph</strong>
            <span>Click the paragraph and type. Text wraps inside the paragraph and keeps its font, size and colour.</span>
          </div>
          <div className="ew-inspector-text">
            Revenue. Full-year revenue grew {text} to $4.2 billion, with growth in every region.
            Subscription revenue now makes up two thirds of the total…
          </div>
          <span className="ew-btn outline danger">
            <Trash2 /> Delete selection
          </span>
        </div>
      </div>
    </div>
  );
}
