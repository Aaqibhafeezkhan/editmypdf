import "@fontsource/great-vibes/latin-400.css";
import "@fontsource/great-vibes/latin-ext-400.css";
import "@fontsource/allura/latin-400.css";
import "@fontsource/allura/latin-ext-400.css";
import "@fontsource/sacramento/latin-400.css";
import "@fontsource/sacramento/latin-ext-400.css";
import "@fontsource/alex-brush/latin-400.css";
import "@fontsource/alex-brush/latin-ext-400.css";
import "@fontsource/dancing-script/latin-400.css";
import "@fontsource/dancing-script/latin-ext-400.css";
import "@fontsource/tangerine/latin-400.css";
import "@fontsource/pinyon-script/latin-400.css";
import "@fontsource/pinyon-script/latin-ext-400.css";
import "@fontsource/amita/latin-400.css";
import "@fontsource/amita/latin-ext-400.css";
import "@fontsource/amita/devanagari-400.css";
import "@fontsource/kalam/latin-400.css";
import "@fontsource/kalam/latin-ext-400.css";
import "@fontsource/kalam/devanagari-400.css";
import "@fontsource/dekko/latin-400.css";
import "@fontsource/dekko/latin-ext-400.css";
import "@fontsource/dekko/devanagari-400.css";

export type SignatureStyle = {
  id: string;
  label: string;
  fontFamily: string;
  group: "English" | "Hindi";
  sample: string;
};

export const SIGNATURE_STYLES: SignatureStyle[] = [
  { id: "great-vibes", label: "Great Vibes", fontFamily: "Great Vibes", group: "English", sample: "Your name" },
  { id: "allura", label: "Allura", fontFamily: "Allura", group: "English", sample: "Your name" },
  { id: "sacramento", label: "Sacramento", fontFamily: "Sacramento", group: "English", sample: "Your name" },
  { id: "alex-brush", label: "Alex Brush", fontFamily: "Alex Brush", group: "English", sample: "Your name" },
  { id: "dancing-script", label: "Dancing Script", fontFamily: "Dancing Script", group: "English", sample: "Your name" },
  { id: "tangerine", label: "Tangerine", fontFamily: "Tangerine", group: "English", sample: "Your name" },
  { id: "pinyon-script", label: "Pinyon Script", fontFamily: "Pinyon Script", group: "English", sample: "Your name" },
  { id: "amita", label: "Amita", fontFamily: "Amita", group: "Hindi", sample: "आपका नाम" },
  { id: "kalam", label: "Kalam", fontFamily: "Kalam", group: "Hindi", sample: "आपका नाम" },
  { id: "dekko", label: "Dekko", fontFamily: "Dekko", group: "Hindi", sample: "आपका नाम" },
];

const INK = "#1a1a1a";

export async function renderSignature(
  text: string,
  fontFamily: string,
): Promise<{ url: string; width: number; height: number }> {
  const size = 120;
  await document.fonts.load(`${size}px "${fontFamily}"`);
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Could not draw the signature");
  measure.font = `${size}px "${fontFamily}"`;
  const metrics = measure.measureText(text);
  const left = Math.ceil(metrics.actualBoundingBoxLeft || 0);
  const right = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
  const ascent = Math.ceil(metrics.actualBoundingBoxAscent || size * 0.8);
  const descent = Math.ceil(metrics.actualBoundingBoxDescent || size * 0.25);
  const pad = 12;
  const width = Math.max(1, left + right + pad * 2);
  const height = Math.max(1, ascent + descent + pad * 2);
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the signature");
  ctx.scale(scale, scale);
  ctx.font = `${size}px "${fontFamily}"`;
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, pad + left, pad + ascent);
  return { url: canvas.toDataURL("image/png"), width, height };
}

export async function imageFileToPng(file: File): Promise<{ url: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 800;
  const fitted = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * fitted));
  const height = Math.max(1, Math.round(bitmap.height * fitted));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { url: canvas.toDataURL("image/png"), width, height };
}
