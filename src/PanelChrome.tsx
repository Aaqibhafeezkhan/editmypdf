import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// The pieces every side panel is built from, so the tool options, the object list and the
// properties read as one family: a header row, titled sections and label-and-control rows.

export function PanelHead({
  title,
  detail,
  count,
  children,
}: {
  title: string;
  detail?: string | null;
  count?: number | string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <div className="panel-head-text">
        <h2 className="panel-title">
          {title}
          {count !== undefined && <span className="panel-count">{count}</span>}
        </h2>
        {detail && <p className="panel-detail">{detail}</p>}
      </div>
      {children}
    </div>
  );
}

export function PanelSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="panel-section">
      {title && <h3 className="panel-eyebrow">{title}</h3>}
      {children}
    </section>
  );
}

// A property's label on the left, its control on the right.
export function PropRow({
  label,
  htmlFor,
  top = false,
  children,
}: {
  label: string;
  htmlFor?: string;
  // Aligns the label with the first line of a tall control instead of its middle.
  top?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={top ? "prop-row top" : "prop-row"}>
      {htmlFor ? (
        <label className="prop-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="prop-label">{label}</span>
      )}
      <div className="prop-control">{children}</div>
    </div>
  );
}

export function PanelClose({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="panel-close" aria-label={label} onClick={onClick}>
          <X />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// A short, centred message for a panel with nothing to show.
export function PanelEmpty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="panel-empty">
      {icon && (
        <span className="panel-empty-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
