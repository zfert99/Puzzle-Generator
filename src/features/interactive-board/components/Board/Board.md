# Board Component: Plain English Pseudocode

Renders the `size × size` grid and owns keyboard interaction. Client component.

## Why it centralizes keyboard handling

Per the WAI-ARIA grid pattern (research §6), a composite grid has ONE keyboard
handler, not 81. `Board` attaches a single `keydown` listener and implements a roving
tabindex: only the selected cell is tabbable (`tabIndex 0`); arrows move the selection;
DOM focus follows it.

```text
Render <div role="grid"> with a CSS variable --size, containing size*size <Cell>s.

On keydown:
  Arrow keys  -> move the selection one step (clamped), preventDefault (no scroll).
  Backspace / Delete / 0 -> clearCell.
  Space / P   -> toggle pencil mode, preventDefault.
  1..size     -> inputDigit.

Effect: whenever the selected cell changes, call .focus() on its DOM node so
keyboard and screen-reader focus track the selection.

Second effect: a window-level keydown listener for undo/redo, so they work no
matter which control has focus:
  Cmd/Ctrl+Z               -> undo
  Shift+Cmd/Ctrl+Z, Ctrl+Y -> redo
It requires a modifier key, so ordinary typing is never affected.
```
