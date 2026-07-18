# Board Component: Plain English Pseudocode

Renders the `size × size` grid and owns keyboard interaction. Client component.

## Killer cage overlay

When the store's `variant === 'killer'`, the board renders a `CageOverlay` (an SVG over the grid)
after the cells, drawing the dashed cage borders + sums from the shared `computeCageOutline`
geometry. The `.board` is `position: relative` so the absolutely-positioned overlay anchors to it.
See `CageOverlay.md`.

## Uniform cell sizing (`Board.module.css`)

The board is a CSS grid with BOTH `grid-template-columns` **and** `grid-template-rows` set to
`repeat(var(--size), 1fr)`, inside a `1/1` aspect-ratio box. Both axes are required: with only
columns defined, rows size to their content, so an empty row/column (no digit) collapses —
visible on 4×4/6×6 and any empty line on 9×9. Explicit `1fr` tracks on both axes make every
cell an equal square regardless of content.

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
