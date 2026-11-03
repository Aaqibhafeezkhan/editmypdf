// Maps between character offsets in a mixed-face editor and DOM selection points. The editor's
// root holds one <div> per line of text, each made of <span>s; the newline between two lines has
// no node of its own.

export function textNodesOf(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

function lineDivs(root: HTMLElement): HTMLElement[] {
  return [...root.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "DIV");
}

function lineText(line: Node): string {
  return textNodesOf(line)
    .map((node) => node.data)
    .join("");
}

export function domText(root: HTMLElement): string {
  const lines = lineDivs(root);
  if (lines.length === 0) return lineText(root);
  return lines.map(lineText).join("\n");
}

// Characters between the start of `container` and a DOM boundary point inside it.
function rangeLength(container: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(container, 0);
  try {
    range.setEnd(node, offset);
  } catch {
    return lineText(container).length;
  }
  return range.toString().length;
}

// Character offset of a DOM boundary point inside the editor.
export function offsetAt(root: HTMLElement, node: Node, offset: number): number {
  const lines = lineDivs(root);
  if (lines.length === 0) return rangeLength(root, node, offset);
  if (node === root) {
    let total = 0;
    for (let index = 0; index < Math.min(offset, lines.length); index += 1) {
      total += lineText(lines[index] as HTMLElement).length + 1;
    }
    return Math.min(total, domText(root).length);
  }
  let total = 0;
  for (const line of lines) {
    if (line === node || line.contains(node)) return total + rangeLength(line, node, offset);
    total += lineText(line).length + 1;
  }
  return domText(root).length;
}

export function selectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = offsetAt(root, range.startContainer, range.startOffset);
  const end = offsetAt(root, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

// The DOM boundary point of a character offset. Past the end lands after the last character.
export function pointAt(root: HTMLElement, index: number): { node: Node; offset: number } {
  const lines = lineDivs(root);
  const targets: HTMLElement[] = lines.length > 0 ? lines : [root];
  let remaining = Math.max(0, index);
  for (let lineIndex = 0; lineIndex < targets.length; lineIndex += 1) {
    const line = targets[lineIndex] as HTMLElement;
    const length = lineText(line).length;
    if (remaining > length && lineIndex < targets.length - 1) {
      remaining -= length + 1;
      continue;
    }
    remaining = Math.min(remaining, length);
    const nodes = textNodesOf(line);
    for (const node of nodes) {
      if (remaining <= node.data.length) return { node, offset: remaining };
      remaining -= node.data.length;
    }
    const last = nodes[nodes.length - 1];
    if (last) return { node: last, offset: last.data.length };
    return { node: line, offset: 0 };
  }
  return { node: root, offset: 0 };
}

// Puts a collapsed caret at a character offset.
export function placeCaret(root: HTMLElement, index: number): void {
  const selection = window.getSelection();
  if (!selection) return;
  const point = pointAt(root, index);
  selection.collapse(point.node, point.offset);
}

// Selects text[start, end), or puts the caret at `end` when the two are equal.
export function selectRange(root: HTMLElement, start: number, end: number): void {
  if (start === end) {
    placeCaret(root, end);
    return;
  }
  const selection = window.getSelection();
  if (!selection) return;
  const from = pointAt(root, Math.min(start, end));
  const to = pointAt(root, Math.max(start, end));
  const range = document.createRange();
  try {
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
  } catch {
    placeCaret(root, end);
    return;
  }
  selection.removeAllRanges();
  selection.addRange(range);
}
