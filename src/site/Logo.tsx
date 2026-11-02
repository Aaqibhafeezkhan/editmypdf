import { PRODUCT } from "../data/product.ts";

// The mark: a line of text left standing, with the proofreader's "stet" dots beneath it.
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <rect x="7" y="9.5" width="18" height="4" rx="2" fill="var(--on-accent)" />
      <circle cx="9.5" cy="21.5" r="2.1" fill="var(--on-accent)" />
      <circle cx="16" cy="21.5" r="2.1" fill="var(--on-accent)" />
      <circle cx="22.5" cy="21.5" r="2.1" fill="var(--on-accent)" />
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
