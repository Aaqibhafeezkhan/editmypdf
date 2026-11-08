/// <reference types="vite/client" />

// The folder under assets/ that vite.config.ts (pdfjsResources) copies pdf.js's runtime resources into,
// relative to the base path and ending in a slash: "assets/pdfjs-<hash>/".
declare module "virtual:pdfjs-resources" {
  export const PDFJS_RESOURCES: string;
}
