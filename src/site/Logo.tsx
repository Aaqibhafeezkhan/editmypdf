import { PRODUCT } from "../data/product.ts";

// The mark: a document with a folded corner and "PDF" set inside it. public/favicon.svg,
// public/og.svg and public/apple-touch-icon.png are drawn from these same paths.
function DocumentPaths({ color }: { color: string }) {
  return (
    <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <g strokeWidth="2.4">
        <path d="M18 3H9a2 2 0 0 0-2 2v22a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10z" />
        <path d="M18 3v7h7" />
      </g>
      <g strokeWidth="1.8">
        <path d="M10.6 23.2v-7.2h1a1.8 1.8 0 0 1 0 3.6h-1" />
        <path d="M14.7 23.2v-7.2h0.9a1.9 3.6 0 0 1 0 7.2h-0.9z" />
        <path d="M21.5 16h-2.7v7.2M18.8 19.6h2.2" />
      </g>
    </g>
  );
}

// "mark" draws the document in the accent colour, for use beside the wordmark; "badge" sets it in
// white on an accent tile, the form the favicon and the touch icon use.
export function LogoMark({
  size = 28,
  className,
  variant = "mark",
}: {
  size?: number;
  className?: string;
  variant?: "mark" | "badge";
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      {variant === "badge" ? (
        <>
          <rect width="32" height="32" rx="8" fill="var(--accent)" />
          <g transform="translate(16 16) scale(0.78) translate(-16 -16)">
            <DocumentPaths color="var(--on-accent)" />
          </g>
        </>
      ) : (
        <DocumentPaths color="var(--accent)" />
      )}
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
