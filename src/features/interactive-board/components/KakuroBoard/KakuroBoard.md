# KakuroBoard: Plain English Pseudocode

The **static** Kakuro board (plan slices V0–V1 in
[kakuro-implementation-plan.md](../../../../../Docs/kakuro-implementation-plan.md)). It draws a
puzzle — white cells, black cells, and clue cells with their sums — and nothing else: no
selection, no input, no store, and never a solution digit. It exists so the visual design can be
settled before the board is interactive; V2 replaces it with the real one on `useBoardStore`.

## Why a Server Component

There is no state to own and the puzzle is static data, so there is nothing to hydrate and no
server/client mismatch to worry about. A side benefit: the puzzle object (which includes the
solution) never leaves the server — only the rendered cells do. It gains `"use client"` only when
it becomes interactive.

## `buildDisplayCells(puzzle)`

The puzzle stores the **interior** N×N only (plan decision D2). A player sees an extra strip of
clue cells along the top and left. This helper produces that picture: an (N+1)×(N+1) grid where
display row/column 0 is the gutter, so interior (r, c) is display (r + 1, c + 1).

It is driven entirely by the runs, in two passes:

```text
start with every display cell as a plain block

pass 1 — for each run, for each of its cells:
    mark that display cell white          (D3: a cell is black exactly when it is in no run)

pass 2 — for each run:
    find the display cell just before the run's first cell
        across run → one step left
        down run   → one step up
    store the run's sum on that cell as its across / down clue
```

Two passes because a clue cell must be looked up *after* all whites are known. The cell before a
run's first cell is always a block or the gutter — if it were white, the run would have started
one cell earlier. The `+1` gutter offset is what makes "one step left/up" always land inside the
display grid, even for runs that start at the interior's edge.

## `KakuroBoard({ puzzle })`

Renders the display cells as a CSS grid, using the WAI-ARIA grid skeleton (`grid` → `row` →
`gridcell`, marked read-only). V2 needs exactly that structure, and it lets the tests query
cells by role instead of by class name.

```text
render a grid labelled "Kakuro board, N by N", read-only, with --tracks = N + 1
for each display row:
    render a row wrapper (out of layout — cells stay direct grid items)
    for each cell:
        white → an empty cell labelled "Row r, column c, empty"
        block with a clue → the diagonal, the down sum and/or across sum,
                            labelled "Clue: across 17, down 23" (whichever exist)
        block without     → labelled "Blocked cell"
```

## Styling (`KakuroBoard.module.css`)

- **Grid lines come from the gap, not from borders.** The board has a 1px `gap` and its own
  background is the line colour, so every line — white/white, black/black, and the boundary
  between them — is drawn in one place. Per-cell borders would need a separate rule for each of
  those three cases.
- **The diagonal is a background gradient.** A `to top right` linear gradient's 50% line runs
  from the upper-left corner to the lower-right one, so a hard-stopped 1.5px band at 50% is the
  clue split.
- **Clue placement (research G7).** The down sum sits in the upper-right triangle, the across
  sum in the lower-left — each nearest the run it heads.
- **Clue text is sized from the cell, not the viewport.** The board is a size container, so
  `--cell-size` (`100cqw / tracks`) is one cell's width and the clue font is 30% of it. The
  numbers stay in proportion on a 7×7, a 9×9, or a phone, with no per-size rules.
- **Dark theme overrides the block colours.** `--ink` is cream in the dark theme, so the
  light-theme mix would turn every black cell into a bright slab. Blocks become a muted step
  above the paper instead, and the clue text takes the ink side.
