import { priceFlags, type StartingPrice } from "../data/competitors.ts";

// A starting price as a figure with its caveats beside it: the flags from competitors.ts are
// shown as small tags so a regional or third-party figure is never mistaken for a list price.
export function Price({ price, note = true, className = "" }: { price: StartingPrice; note?: boolean; className?: string }) {
  const flags = priceFlags(price);
  return (
    <span className={`price ${className}`.trim()}>
      <span className="price-figure">
        {price.figure}
        {price.per && <small>/{price.per}</small>}
      </span>
      {flags.length > 0 && (
        <span className="price-flags">
          {flags.map((flag) => (
            <span key={flag} className="tag warn">
              {flag}
            </span>
          ))}
        </span>
      )}
      {note && price.note && <span className="cell-note">{price.note}</span>}
    </span>
  );
}
