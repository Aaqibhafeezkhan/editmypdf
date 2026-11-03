import { PRODUCT } from "../data/product.ts";

// The mark: a rounded tile in the brand blue carrying a white page with a folded corner, three
// text lines in the tile's blue and a coral pencil writing the last one, its graphite tip on the
// page. public/favicon.svg, public/og.svg and the rendered PNGs next to them are drawn from these
// same shapes with the colours written out, so a change here is repeated there (see the brand
// render script named in the hand-over note).
//
// The tile's corner radius, the page's radius and the rounded line ends share one proportion, and
// the wordmark beside it (.logo-word in index.css) is set in the interface sans at a matching
// weight, so the two read as one brand.
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="var(--logo-tile)" />
      <path d="M11 6.5h7.25L23 11.25V23.5a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z" fill="#ffffff" />
      <path d="M18.25 6.5v4.75H23Z" fill="var(--logo-fold)" />
      <g fill="var(--logo-tile)">
        <rect x="11.75" y="14.5" width="6.5" height="1.9" rx="0.95" />
        <rect x="11.75" y="18.4" width="7" height="1.9" rx="0.95" />
        <rect x="11.75" y="22.3" width="3.5" height="1.9" rx="0.95" />
      </g>
      <g transform="translate(19.74 20.26) rotate(45)">
        <rect x="-2" y="-8" width="4" height="11" rx="2" fill="var(--coral)" />
        <path d="M-2 2.6h4L0 6.2Z" fill="#3b2a22" />
      </g>
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">{PRODUCT.name}</span>
    </span>
  );
}
