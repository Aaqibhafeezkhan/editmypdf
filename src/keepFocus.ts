// Keeps the focus (and so the selection) where it is when a control is pressed: for the
// mousedown of buttons that act on an open editor.
export function keepFocus(event: { preventDefault: () => void }) {
  event.preventDefault();
}
