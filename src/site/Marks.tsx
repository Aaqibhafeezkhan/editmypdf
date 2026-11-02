import { Check, CircleHelp, Minus, X } from "lucide-react";
import { TRI_LABEL, type Tri } from "../data/competitors.ts";

// A yes / no / partly / not-stated cell.
export function Mark({ value, labels }: { value: Tri; labels?: Partial<Record<Tri, string>> }) {
  const Icon = value === "yes" ? Check : value === "no" ? X : value === "partial" ? Minus : CircleHelp;
  return (
    <span className={`mark ${value}`}>
      <Icon aria-hidden="true" />
      <span>{labels?.[value] ?? TRI_LABEL[value]}</span>
    </span>
  );
}

export function Where({ where, short = false }: { where: "server" | "browser" | "mixed"; short?: boolean }) {
  if (where === "browser") return <Mark value="yes" labels={{ yes: short ? "Your browser" : "In your browser" }} />;
  if (where === "mixed") return <Mark value="partial" labels={{ partial: short ? "Mostly local" : "Mostly on your device" }} />;
  return <Mark value="no" labels={{ no: short ? "Their servers" : "Uploaded to their servers" }} />;
}
