import { Link } from "react-router";
import { Laptop, Type, TextCursorInput, Check, Minus, X, CircleHelp } from "lucide-react";
import { OURS, TRI_LABEL, type Tool, type Tri } from "../data/competitors.ts";
import { ROUTES } from "../data/product.ts";
import { ToolMark } from "./CompareCard.tsx";
import { LogoMark } from "./Logo.tsx";

// A table that answers three questions per tool with one icon each, Edit My PDF first and
// highlighted. The icons carry a visually hidden label and a tooltip, so a screen reader and a
// hover both get the words.
const COLUMNS: { key: string; icon: typeof Laptop; label: string; value: (tool: Tool) => Tri; words: Partial<Record<Tri, string>> }[] = [
  {
    key: "where",
    icon: Laptop,
    label: "In your browser",
    value: (tool) => (tool.processing.where === "browser" ? "yes" : tool.processing.where === "mixed" ? "partial" : "no"),
    words: { yes: "Runs in your browser", partial: "Mostly on your device", no: "Uploads your file to their servers" },
  },
  {
    key: "edits",
    icon: TextCursorInput,
    label: "Edits existing text",
    value: (tool) => tool.textEditing.existing,
    words: { yes: "Edits the text already on the page", partial: "Edits existing text partly", no: "Does not edit existing text", unknown: "Not stated" },
  },
  {
    key: "font",
    icon: Type,
    label: "Keeps the font",
    value: (tool) => tool.textEditing.keepsFont,
    words: { yes: "Keeps the page's original font", partial: "Keeps the font partly", no: "Substitutes the font", unknown: "Not stated whether the font is kept" },
  },
];

function Cell({ value, words }: { value: Tri; words: Partial<Record<Tri, string>> }) {
  const Icon = value === "yes" ? Check : value === "no" ? X : value === "partial" ? Minus : CircleHelp;
  const text = words[value] ?? TRI_LABEL[value];
  return (
    <span className={`glance-mark ${value}`} title={text}>
      <Icon aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </span>
  );
}

export function GlanceTable({ tools }: { tools: Tool[] }) {
  return (
    <div className="glance">
      <table className="glance-table">
        <caption className="sr-only">Three facts about each editor: whether it runs in your browser, edits existing text and keeps the page's font</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Tool</span>
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col">
                <column.icon aria-hidden="true" />
                <span>{column.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="us">
            <th scope="row">
              <span className="tool-cell">
                <LogoMark size={20} />
                <span>{OURS.name}</span>
              </span>
            </th>
            {COLUMNS.map((column) => (
              <td key={column.key}>
                <Cell value={column.value(OURS)} words={column.words} />
              </td>
            ))}
          </tr>
          {tools.map((tool) => (
            <tr key={tool.slug}>
              <th scope="row">
                <Link to={ROUTES.comparison(tool.slug)} className="tool-cell">
                  <ToolMark brand={tool.brand} size={20} />
                  <span>{tool.name}</span>
                </Link>
              </th>
              {COLUMNS.map((column) => (
                <td key={column.key}>
                  <Cell value={column.value(tool)} words={column.words} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="glance-legend" aria-hidden="true">
        <span className="glance-mark yes">
          <Check />
        </span>{" "}
        yes
        <span className="glance-mark partial">
          <Minus />
        </span>{" "}
        partly
        <span className="glance-mark no">
          <X />
        </span>{" "}
        no
        <span className="glance-mark unknown">
          <CircleHelp />
        </span>{" "}
        not stated
      </p>
    </div>
  );
}
