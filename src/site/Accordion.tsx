import { useId, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";

export type AccordionItem = { id: string; title: string; body: ReactNode };

// A list of collapsible panels that open and close smoothly. One panel is open at a time; the
// height animates through grid-template-rows so no measurement is needed.
export function Accordion({
  items,
  initial = null,
  heading = "h3",
  className = "",
}: {
  items: AccordionItem[];
  initial?: string | null;
  heading?: "h2" | "h3";
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(initial);
  const base = useId();
  const Heading = heading;
  return (
    <div className={`acc ${className}`.trim()}>
      {items.map((item) => {
        const open = item.id === openId;
        const panelId = `${base}-${item.id}`;
        const triggerId = `${panelId}-trigger`;
        return (
          <div key={item.id} className={open ? "acc-item open" : "acc-item"}>
            <Heading className="acc-heading">
              <button
                type="button"
                id={triggerId}
                className="acc-trigger"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : item.id)}
              >
                <span>{item.title}</span>
                <Plus aria-hidden="true" className="acc-icon" />
              </button>
            </Heading>
            <div id={panelId} className="acc-panel" role="region" aria-labelledby={triggerId} inert={!open}>
              <div className="acc-panel-inner">{item.body}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
