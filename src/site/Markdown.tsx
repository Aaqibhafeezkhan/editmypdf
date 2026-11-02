import { useMemo } from "react";
import { marked } from "./markdown.ts";

export function Markdown({ source, className = "prose" }: { source: string; className?: string }) {
  const html = useMemo(() => marked.parse(source, { async: false }), [source]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
