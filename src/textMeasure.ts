import { fontCss, type FontId } from "./types.ts";

type Measured = {
  text: string;
  fontId: FontId;
  fontSize: number;
  bold: boolean;
  italic: boolean;
};

let canvas: HTMLCanvasElement | null = null;

export function measureTextWidth(style: Measured): number {
  canvas ??= document.createElement("canvas");
  const context = canvas.getContext("2d");
  const caret = Math.max(2, style.fontSize * 0.45);
  if (!context) return Math.max(style.fontSize, caret);
  const weight = style.bold ? "700" : "400";
  const slant = style.italic ? "italic" : "normal";
  context.font = `${slant} ${weight} ${style.fontSize}px ${fontCss(style.fontId)}`;
  const lines = style.text.length > 0 ? style.text.split("\n") : ["Type here"];
  let widest = 0;
  for (const line of lines) {
    widest = Math.max(widest, context.measureText(line).width);
  }
  return Math.max(style.fontSize * 0.75, widest + caret);
}
