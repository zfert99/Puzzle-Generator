# Board Component: Plain English Pseudocode

Renders the `size × size` grid and owns keyboard interaction. Client component.

## Killer cage overlay

When the store's `variant === 'killer'`, the board renders a `CageOverlay` (an SVG over the grid)
after the cells, drawing the dashed cage borders + sums from the shared `computeCageOutline`
geometry. The `.board` is `position: relative` so the absolutely-positioned overlay anchors to it.
See `CageOverlay.md`.

`.board` also carries `data-variant={variant}` — a plain DOM attribute, not a CSS-module class —
specifically so `Board.module.css` can style descendants (currently just `.candidates`; see
below) differently for Killer vs. classic with a pure CSS selector, no per-cell JS needed.

## Candidate grid: consistent positioning, no drawn gridlines (July 2026, revised)

The pencil-mark 3×3 layout inside each cell went through two rounds:

- **v1 added faint gridlines** between the 3×3 slots (thin borders on `.candidates span`) to
  make the grid structure visible. **Reverted per direct user feedback** — referencing
  sudoku.com's plainer style, drawn lines next to tiny digits read as visually busy; consistent
  positioning alone (the fixed `grid-template-columns`/`grid-template-rows` tracks) is enough to
  read as an organized layout without needing lines drawn between the slots.
- **Killer clearance, top-only, applied uniformly.** `.board[data-variant='killer'] .candidates`
  reserves a top margin (not top-*and*-left) on the candidate grid, via a plain CSS descendant
  selector keyed on the board's `data-variant` — **every** cell in a Killer game gets the same
  offset, not just cells that happen to be a cage's anchor (an even earlier, per-cell
  `hasCageSum`-driven version made candidate positions inconsistent across the board — see git
  history). The top-only inset is a geometric observation, not just a smaller version of the old
  top-left one: the cage sum's background pad (`cage-geometry.ts`) is only ~21% of the cell tall
  *regardless of how many digits the sum has* — a 2-digit sum is wider, not taller — so clearing
  the top alone fully clears it without also sacrificing horizontal space. This reads closer to
  sudoku.com's own layout, which reserves a plain top strip for the sum rather than a top-left
  corner block, and lets the candidate grid use the cell's full width. Classic games are
  unaffected (no `data-variant='killer'` match, so no offset, no reserved space).
- **Third pass: more top margin, smaller font (Killer only).** 25% top inset still let digit 1
  graze the cage sum on 2-digit sums — direct user feedback with a screenshot. Bumped to 30%
  and dropped the Killer candidate font to `0.4em` (classic stays at the base `0.46em`, which
  the same feedback confirmed already reads well — this tweak is deliberately Killer-only, not
  a global shrink).

## Uniform cell sizing (`Board.module.css`)

The board is a CSS grid with BOTH `grid-template-columns` **and** `grid-template-rows` set to
`repeat(var(--size), 1fr)`, inside a `1/1` aspect-ratio box. Both axes are required: with only
columns defined, rows size to their content, so an empty row/column (no digit) collapses —
visible on 4×4/6×6 and any empty line on 9×9. Explicit `1fr` tracks on both axes make every
cell an equal square regardless of content.

## Outer border, all four sides (July 2026)

`.board` sets a thick `border-*` on all four sides. Previously only `border-top`/`border-left`
were set, relying on the last row/column's own cells to supply the right/bottom edge — but
`Cell.tsx`'s `thickRight`/`thickBottom` flags deliberately exclude the outermost row/column
(they mark *box* boundaries, not the board's own edge), so the right and bottom edges fell
back to the thin per-cell grid line instead of the strong outer border. Setting all four sides
directly on `.board` fixes it without touching that per-cell logic.

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
