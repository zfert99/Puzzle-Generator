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

## PDF-parity sums (July 2026)

Sums render exactly like the PDF's: tucked into the anchor cell's top-left corner at
0.2 cell-units. The label needs to visibly **break the dashed cage line** instead of colliding
with it. Sum width (for both the mask gap below and the text's own position) is estimated from
the mono font (~0.13 cell-units per digit) — reliable because the sum label uses `--font-mono`.

## Mask-based line gap, not a painted pad (July 2026, revised)

Originally the "break the line" gap was a small `rect` painted in `--cell-bg` (the resting
paper color) sitting behind each sum, matching the PDF's plain-white pad. That reads fine on a
plain board, but this SVG is ONE shared overlay layer for the whole board — it has no idea a
given cage's anchor cell might currently be selected/peer/cage-peer/same-number highlighted
underneath (`Cell.tsx` resolves that per-cell precedence separately, in JS). A flat opaque pad
just reasserted the plain resting color over whatever highlight was actually showing, reading
as a mismatched floating box (reported via user screenshot). Dropping the pad to partial
opacity let the highlight color show through, but revealed a second problem — the dashed cage
line sitting UNDER the pad in SVG paint order started ghosting through it too (also reported
via screenshot): fixing the color-mismatch by fading the pad broke the pad's actual job of
fully hiding the line.

Both problems share one root cause: painting a pad means picking some fixed appearance, and no
single fixed appearance is right for every highlight state a cell can be in. The fix removes
the pad entirely and uses an SVG `<mask>` instead: a `<defs><mask>` containing a full white
rect (mask = fully visible) with black rects punched out at each sum's position (mask = fully
hidden), applied to the `<g>` wrapping the dashed `<line>` elements only. The lines are
genuinely absent in that rectangle — not faded, not painted over — so whatever the cell
underneath actually looks like (any highlight, any theme) is simply what renders, correctly,
without this component ever needing to know what that is. The sum `<text>` then draws directly
on top with no background element at all. `useId()` gives each `CageOverlay` instance its own
mask id, since SVG `id`/`url()` references resolve against the whole document, not just this
component's subtree — cheap insurance against two boards ever existing on the same page.
