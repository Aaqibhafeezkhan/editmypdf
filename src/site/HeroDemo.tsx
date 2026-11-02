import { useEffect, useState } from "react";
import { LogoMark } from "./Logo.tsx";

// A mock of the editor, drawn with HTML so it is crisp in both themes. It replays one edit:
// the figure in the first paragraph is retyped and the rest of the paragraph reflows around it.
const BEFORE = "nine per cent";
const AFTER = "eleven per cent";

type Phase = "idle" | "deleting" | "typing" | "done";

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useTypedEdit(): string {
  const [text, setText] = useState(() => (reducedMotion() ? AFTER : BEFORE));
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (reducedMotion()) return;
    let timer = 0;
    const schedule = (ms: number, next: () => void) => {
      timer = window.setTimeout(next, ms);
    };
    if (phase === "idle") schedule(2200, () => setPhase("deleting"));
    else if (phase === "deleting") {
      if (text.length > 0) schedule(55, () => setText((value) => value.slice(0, -1)));
      else schedule(260, () => setPhase("typing"));
    } else if (phase === "typing") {
      if (text.length < AFTER.length) schedule(85, () => setText(AFTER.slice(0, text.length + 1)));
      else schedule(3600, () => setPhase("done"));
    } else if (phase === "done") {
      schedule(0, () => {
        setText(BEFORE);
        setPhase("idle");
      });
    }
    return () => window.clearTimeout(timer);
  }, [phase, text]);

  return text;
}

export function HeroDemo() {
  const typed = useTypedEdit();
  return (
    <div className="demo" aria-hidden="true">
      <div className="demo-top">
        <LogoMark size={18} />
        <span className="demo-file">annual-letter.pdf</span>
        <div className="demo-top-actions">
          <span className="demo-icon" />
          <span className="demo-icon" />
          <span className="demo-pill">Download</span>
        </div>
      </div>
      <div className="demo-body">
        <div className="demo-rail">
          <span className="active" />
          <span />
          <span />
          <span />
        </div>
        <div className="demo-canvas">
          <div className="demo-page">
            <h4>Letter to shareholders</h4>
            <span className="demo-block">
              <span className="demo-tag">Paragraph</span>
              <strong>Revenue.</strong> Full-year revenue grew {typed}
              <span className="demo-caret" /> to $4.2 billion, with growth in every region. Subscription
              revenue now makes up two thirds of the total, up from half two years ago, and renewal rates
              held above ninety per cent for the fourth consecutive year.
            </span>
            <p>
              <strong>Operating margin.</strong> Margin widened by 180 basis points as the cost of delivery
              fell and headcount grew more slowly than revenue. We expect this trend to continue into the
              coming year.
            </p>
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Revenue</th>
                  <th>Growth</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Subscriptions</td>
                  <td>$2.8bn</td>
                  <td>+14%</td>
                </tr>
                <tr>
                  <td>Services</td>
                  <td>$1.4bn</td>
                  <td>+6%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="demo-inspector">
          <h5>Paragraph</h5>
          <p>Click the paragraph and type. Text wraps inside the paragraph and keeps its font, size and colour.</p>
          <div className="demo-text">
            Revenue. Full-year revenue grew {typed} to $4.2 billion, with growth in every region. Subscription
            revenue now makes up two thirds of the total…
          </div>
          <div className="demo-delete">Delete selection</div>
        </div>
      </div>
      <div className="demo-zoom">100%</div>
    </div>
  );
}
