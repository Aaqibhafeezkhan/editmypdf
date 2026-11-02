// Facts about the product that the site repeats in many places. Change them here.

export const PRODUCT = {
  // Working name; the repository and the package are still called "pdf-editor".
  name: "Stet",
  nameIsProvisional: true,
  tagline: "Edit the text in a PDF without disturbing the page.",
  description:
    "Stet is a free PDF editor that runs entirely in your browser. Click any heading, line or paragraph and retype it in the page's own font, size, colour and spacing. Nothing is uploaded, and no account is needed.",
  shortDescription: "Free browser PDF editor that edits the page's own text in its own font. No uploads, no account.",
  repository: "https://github.com/vr-patel/pdf-editor",
  // The stack the privacy claims rest on. Verified against the source: pdf.js parses and renders in
  // a web worker, pdf-lib writes the file, IndexedDB and localStorage hold the sessions, and the
  // download is a blob URL. The only fetch() in the app loads its own emoji images.
  libraries: {
    reader: { name: "pdf.js", version: "6", url: "https://mozilla.github.io/pdf.js/" },
    writer: { name: "pdf-lib", version: "1.17", url: "https://pdf-lib.js.org/" },
  },
  // Month the comparison facts were last checked.
  comparisonsCheckedAt: "November 2026",
} as const;

export const ROUTES = {
  home: "/",
  app: "/app",
  edit: (id: string) => `/edit/${id}`,
  blog: "/blog",
  post: (slug: string) => `/blog/${slug}`,
  compare: "/compare",
  comparison: (slug: string) => `/compare/${slug}`,
  howItWorks: "/how-it-works",
  privacy: "/privacy",
  faq: "/faq",
} as const;

export function siteOrigin(): string {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
