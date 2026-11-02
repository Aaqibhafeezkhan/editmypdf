import type { CSSProperties } from "react";
import { Link } from "react-router";
import { ArrowRight, Laptop, TextCursorInput, Type } from "lucide-react";
import { OURS, TRI_LABEL, type Brand, type Competitor, type Tool, type Tri } from "../data/competitors.ts";
import { PRODUCT, publicUrl, ROUTES } from "../data/product.ts";
import { LogoMark } from "./Logo.tsx";
import { Price } from "./Price.tsx";
import "./compare.css";

// The three facts the thumbnail scores each side on.
const FACTS: { key: string; icon: typeof Laptop; label: string; value: (tool: Tool) => Tri }[] = [
  {
    key: "where",
    icon: Laptop,
    label: "runs in your browser",
    value: (tool) => (tool.processing.where === "browser" ? "yes" : tool.processing.where === "mixed" ? "partial" : "no"),
  },
  { key: "edits", icon: TextCursorInput, label: "edits existing text", value: (tool) => tool.textEditing.existing },
  { key: "font", icon: Type, label: "keeps the page's font", value: (tool) => tool.textEditing.keepsFont },
];

// Dark letters on a light hue, white on a dark one.
function onColor(hex: string): string {
  const channel = (index: number) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.4 ? "#101010" : "#ffffff";
}

// A one- or two-letter badge in the tool's colour: a stand-in for a mark, not its logo.
export function Monogram({ brand, size = 36 }: { brand: Brand; size?: number }) {
  const style: CSSProperties = { background: brand.color, color: onColor(brand.color), width: size, height: size, fontSize: size * 0.4 };
  return (
    <span className="monogram" style={style} aria-hidden="true">
      {brand.monogram}
    </span>
  );
}

// The tool's own icon when the data has one, the monogram otherwise. The name always sits beside
// it, so the image is decorative.
export function ToolMark({ brand, size = 28, className = "" }: { brand: Brand; size?: number; className?: string }) {
  if (!brand.logo) return <Monogram brand={brand} size={size} />;
  return (
    <img
      className={`tool-mark ${className}`.trim()}
      src={publicUrl(brand.logo)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ width: size, height: size }}
    />
  );
}

function scoreWords(tool: Tool): string {
  return FACTS.map((fact) => `${fact.label}: ${TRI_LABEL[fact.value(tool)].toLowerCase()}`).join(", ");
}

// The thumbnail: PDF Edit and the tool side by side, with a dot per fact for each.
export function Duel({ tool }: { tool: Tool }) {
  return (
    <div className="duel">
      <span className="sr-only">
        {PRODUCT.name}: {scoreWords(OURS)}. {tool.name}: {scoreWords(tool)}.
      </span>
      <span className="duel-spacer" aria-hidden="true" />
      {FACTS.map((fact) => (
        <span key={fact.key} className="duel-fact" aria-hidden="true" title={fact.label}>
          <fact.icon />
        </span>
      ))}
      <span className="duel-mark" aria-hidden="true">
        <LogoMark size={26} />
      </span>
      <span className="duel-name us" aria-hidden="true">
        {PRODUCT.name}
      </span>
      {FACTS.map((fact) => (
        <span key={fact.key} className={`duel-dot ${fact.value(OURS)}`} aria-hidden="true" />
      ))}
      <span className="duel-mark" aria-hidden="true">
        <ToolMark brand={tool.brand} size={26} />
      </span>
      <span className="duel-name" aria-hidden="true">
        {tool.name}
      </span>
      {FACTS.map((fact) => (
        <span key={fact.key} className={`duel-dot ${fact.value(tool)}`} aria-hidden="true" />
      ))}
    </div>
  );
}

// One comparison as a card: the thumbnail, vendor and starting price, title, summary.
export function CompareCard({ tool }: { tool: Competitor }) {
  return (
    <Link to={ROUTES.comparison(tool.slug)} className="card cmp-card">
      <Duel tool={tool} />
      <div className="card-meta">
        <span className="tag">{tool.vendor.split(",")[0]}</span>
        <Price price={tool.startingPrice} note={false} className="compact" />
      </div>
      <h3>
        {PRODUCT.name} vs {tool.name}
      </h3>
      <p>{tool.summary}</p>
      <span className="link-arrow">
        Read the comparison <ArrowRight aria-hidden="true" />
      </span>
    </Link>
  );
}
