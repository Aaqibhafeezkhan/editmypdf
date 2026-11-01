// Maps between character offsets in a mixed-face editor and DOM selection points.

export function textNodesOf(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

export function domText(root: HTMLElement): string {
  return textNodesOf(root)
    .map((node) => node.data)
    .join("");
}

// Character offset of a DOM boundary point inside the editor.
export function offsetAt(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  try {
    range.setEnd(node, offset);
  } catch {
    return domText(root).length;
  }
  return range.toString().length;
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

// Puts a collapsed caret at a character offset. Past the end lands after the last character.
export function placeCaret(root: HTMLElement, index: number): void {
  const selection = window.getSelection();
  if (!selection) return;
  let remaining = Math.max(0, index);
  const nodes = textNodesOf(root);
  for (const node of nodes) {
    if (remaining <= node.data.length) {
      selection.collapse(node, remaining);
      return;
    }
    remaining -= node.data.length;
  }
  const last = nodes[nodes.length - 1];
  if (last) selection.collapse(last, last.data.length);
  else selection.collapse(root, 0);
}
