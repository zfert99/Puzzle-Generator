# Cage Geometry (`cage-geometry.ts`)

The single, renderer-agnostic source of a Killer puzzle's **cage outlines and sum-label
positions**. Both the PDF (`pdf.service.ts`) and the interactive board render from this, so the
subtle corner logic exists — and is tested — in exactly one place.

## Why cell units

`computeCageOutline` returns coordinates in **cell units**: a cell is 1×1 and the grid spans
`0..size`. The PDF multiplies by its pixel cell size; the board drops them straight into an SVG
`viewBox="0 0 size size"`. Neither renderer re-derives the geometry.

## The three corner cases

Each cage-boundary edge is drawn as a line inset into the cage by `inset`. The tricky part is
where a line *ends*. For each endpoint we look at the in-line neighbour and the diagonal cell:

- **Convex** corner (in-line neighbour is a *different* cage) → inset the end. This is an outer
  corner of the cage.
- **Straight** run (in-line neighbour same cage, diagonal *outside* → that neighbour continues
  the same border) → run to the cell edge, so this segment and the neighbour's connect into a
  continuous line across cells.
- **Reflex / inner** corner (in-line neighbour same cage, diagonal *inside* → that neighbour has
  no matching border) → run **past** the cell edge by `inset`, so this line meets the
  perpendicular border turning the corner. This is what **closes the inner corner of L-shaped
  cages**, which otherwise left a visible gap.

Because reflex segments both extend to the same meeting point, an inner corner is a clean L-turn.

## Sums

Each cage's sum is anchored at its **lowest-indexed cell** (the top-left-most), returned as
`{ col, row, value }`; the renderer tucks it into that cell's corner.

The tests pin down a 1-cell cage (4 inset lines, all convex), the L-shape reflex meeting point,
and the anchor-cell sum position.
