# CageOverlay (`CageOverlay.tsx`)

The Killer cage layer for the interactive board — an SVG overlaid exactly on the grid, drawing
the dashed cage outlines and corner sum labels.

## Why an SVG overlay

The board is a CSS grid of `Cell`s. Rather than compute per-cell borders (which can't easily do
inset continuous lines or inner corners), a single absolutely-positioned `<svg>` covers the whole
board with `viewBox="0 0 size size"`, so the shared **`computeCageOutline`** geometry — cell-unit
coordinates, same as the PDF — drops straight in. `preserveAspectRatio="none"` fills the square
board; `pointer-events: none` lets cell clicks pass through; `aria-hidden` because it's decorative
(the sums are numbers on the grid, not interactive controls).

It renders only when `variant === 'killer'` (see `Board.tsx`), memoizing the outline so the SVG
is recomputed only when the cages change (a new game), never on a keystroke — INP stays low.

## Styling

`Board.module.css` sizes the strokes in **user units** (cells): a thin dashed `--ink` line for
cages, and small dimmed monospace sum labels tucked into each cage's anchor-cell corner. The
overlay sits at `z-index: 2` — above cell backgrounds/highlights, but cage lines hug cell edges so
placed digits (centred) stay readable.
