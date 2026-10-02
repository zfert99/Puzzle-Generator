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

## `skyscrapersTracks(size)` and `buildDisplayCells(size)`

A puzzle is stored as the **interior** N×N only (plan decision D2), because the rest of the
codebase keys on `grid.length` being the puzzle's named size. A player, though, sees a strip of
clue cells on every side. These helpers produce that picture: an (N+2)×(N+2) grid where display
index 0 and N+1 on either axis are the gutter and the four corners are dead.

This differs from Kakuro's gutter (top and left only, plus clues inside the grid): every
Skyscrapers clue sits *outside* the play area, so the gutter is symmetric and the corners hold
nothing. The display-coordinate helpers live beside the board for V0; V1 moves them into the
engine's `skyscrapers-types.ts` because the PDF renderer (V3) is a known second consumer
(log learning L2).

```text
tracks = N + 2; last = tracks - 1
for each display row r, column c:
    both r and c on an edge           → corner
    r == 0                            → gutter, side top,    index c - 1
    r == last                         → gutter, side bottom, index c - 1
    c == 0                            → gutter, side left,   index r - 1
    c == last                         → gutter, side right,  index r - 1
    otherwise                         → play cell (r - 1, c - 1)
```

## `gutterLabel(side, index)`

A screen-reader user cannot see which edge a clue cell sits on, so its accessible name spells the
direction the clue reads in (plan decision D9): "Clue cell, looking down from the top of column 3,
blank". V0 has no clue values, so every gutter cell is "blank"; V1 replaces the last word with the
digit, and V2 adds the state (open / satisfied / violated / done).

## `SkyscrapersBoard({ size })`

Renders the display cells as a CSS grid. It already uses the WAI-ARIA grid skeleton (`grid` →
`row` → `gridcell`) because V2 needs exactly that structure: play cells are gridcells named by
position, gutter cells are **read-only** gridcells named by `gutterLabel`, and the corners are
`role="presentation"` + `aria-hidden` so they are never announced.

```text
render a grid labelled "Skyscrapers board, N by N", read-only, with --tracks = N + 2
for each display row:
    render a row wrapper (out of layout — cells stay direct grid items)
    for each cell:
        corner → a hidden, presentational div
        gutter → a read-only gridcell, labelled by gutterLabel, styled by its side
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
- **Theme tokens only.** Line colours derive from `--ink` / `--paper`, so the board flips with
  `[data-theme]` without a dark override of its own — there are no filled blocks to re-tint, which
  is the case that forced Kakuro's dark-theme rule.
