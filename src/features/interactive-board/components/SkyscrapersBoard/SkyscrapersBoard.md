# SkyscrapersBoard: Plain English Pseudocode

The **looks-only** Skyscrapers board (plan slice V0 in
[skyscrapers-implementation-plan.md](../../../../../Docs/skyscrapers-implementation-plan.md)). It
draws the shape of a Skyscrapers puzzle — an empty N×N play area with a heavier frame, inside a
one-cell clue gutter on all four sides — and nothing else: no digits, no selection, no input, no
store. It exists so the four-sided gutter is designed once, on screen, before any puzzle logic is
written; V2 replaces it with the interactive board on `useBoardStore`.

## Why a Server Component

There is no state to own and the size is static data, so there is nothing to hydrate and no
server/client mismatch to worry about. It gains `"use client"` only when it becomes interactive.

## Where the geometry comes from

The (N+2)×(N+2) picture — play area, four gutter strips, four dead corners — is built by
`buildDisplayCells` in the engine's
[`skyscrapers-types.ts`](../../../engine/skyscrapers/skyscrapers-types.md), not here: the PDF
renderer (V3) is a known second consumer, so the helpers start in the engine (log learning L2)
instead of moving there later as Kakuro's did. This component only decides how each display cell
is drawn and named.

## `gutterLabel(side, index)`

A screen-reader user cannot see which edge a clue cell sits on, so its accessible name spells the
direction the clue reads in (plan decision D9): "Clue cell, looking down from the top of column 3,
blank". V0 has no clue values, so every gutter cell is "blank"; V1 replaces the last word with the
digit, and V2 adds the state (open / satisfied / violated / done).

## `SkyscrapersBoard({ size })`

Renders the display cells as a CSS grid. It already uses the WAI-ARIA grid skeleton (`grid` →
`row` → `gridcell`) because V2 needs exactly that structure, and it keeps the grid
**rectangular for assistive technology**: every row exposes the same N+2 gridcells. The corners
are empty read-only gridcells rather than hidden elements — hiding them would leave the first and
last rows with N accessible cells against N+2 in the middle rows, which a screen reader reports as
a malformed grid with column numbers that jump between rows (review finding on V0). `aria-rowcount`
/ `aria-colcount` on the grid and `aria-rowindex` / `aria-colindex` on every row and cell make the
geometry explicit (D9). Gutter cells are read-only and named by `gutterLabel`; play cells are
named by position and carry no `aria-readonly`, because in V2 they become editable while the
gutter stays read-only.

```text
render a grid labelled "Skyscrapers board, N by N", rowcount = colcount = N + 2,
       with --tracks = N + 2
for each display row r:
    render a row wrapper with aria-rowindex (out of layout — cells stay direct grid items)
    for each cell c, with aria-colindex:
        corner → an empty read-only gridcell, no label, no styling
        gutter → a read-only gridcell labelled by gutterLabel
        play   → a gridcell "Row r, column c, empty"; add the frame class(es) on the
                 edge cells of the play area (first/last play row and column)
```

## Styling (`SkyscrapersBoard.module.css`)

- **Lines live on the play cells, not on the board.** Each play cell draws a light right and
  bottom border, so every interior line is drawn once; the frame classes replace the edge cells'
  thin borders with the 3px frame and add the top/left edges that right/bottom-only borders leave
  open. The gutter cells and corners are transparent, so the clue digits (V1) will float on the
  page beside a framed play area — the way every publisher prints them (research §6: bold
  outline around the N×N, plain digits outside, no arrows).
- **Why not Kakuro's gap-as-line trick.** That draws a line between *every* pair of cells, which
  is right when the gutter cells are themselves black blocks and wrong here, where the gutter must
  read as open space.
- **The board is a size container.** `--cell-size` is one track's width in container units, so
  V1's clue digits can be sized as a fraction of a cell and stay in proportion at 5×5, 7×7, or on
  a phone (the gutter font size is already wired to it, at 0.4 of a cell).
- **No reserved rules.** Corners have no class at all and the gutter has no per-side class: a
  bare div is already transparent, and a per-side rule is added when a per-side difference
  exists, not before (review finding on V0).
- **Theme tokens only.** Line colours derive from `--ink` / `--paper`, so the board flips with
  `[data-theme]` without a dark override of its own — there are no filled blocks to re-tint, which
  is the case that forced Kakuro's dark-theme rule.
