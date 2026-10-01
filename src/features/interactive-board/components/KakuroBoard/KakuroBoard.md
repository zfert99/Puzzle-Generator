# KakuroBoard: Plain English Pseudocode

The **looks-only** Kakuro board (plan slice V0 in
[kakuro-implementation-plan.md](../../../../../Docs/kakuro-implementation-plan.md)). It draws the
shape of a Kakuro — white cells, black cells, diagonal-split clue cells — and nothing else: no
sums, no selection, no input, no store. It exists so the visual design can be settled before any
puzzle logic is written; V2 replaces it with the interactive board on `useBoardStore`.

## Why a Server Component

There is no state to own and the layout is static data, so there is nothing to hydrate and no
server/client mismatch to worry about. It gains `"use client"` only when it becomes interactive.

## `buildDisplayCells(layout)`

The layout is stored as the **interior** N×N only (plan decision D2), because the rest of the
codebase keys on `grid.length` being the puzzle's named size. A player, though, sees an extra
strip of clue cells along the top and left. This helper produces that picture: an (N+1)×(N+1)
grid where display row/column 0 is the gutter.

A black cell gets the diagonal only if it actually starts a run — a white cell directly to its
right (across) or directly below it (down). Drawing a diagonal on every black cell would make
dead cells look like they are waiting for a clue. This is a *drawing* rule; the real run
derivation (with validation) is V1's job and lives in the engine.

```text
tracks = N + 1
isWhite(r, c) = r and c are both past the gutter AND layout[r-1][c-1] is "."

for each display row r, column c:
    if isWhite(r, c):            a white cell
    else:                        a block, with
        across = isWhite(r, c+1)
        down   = isWhite(r+1, c)
```

## `KakuroBoard({ layout })`

Renders the display cells as a CSS grid. It already uses the WAI-ARIA grid skeleton
(`grid` → `row` → `gridcell`, marked read-only) because V2 needs exactly that structure, and it
lets the tests query cells by role instead of by class name.

```text
render a grid labelled "Kakuro board", read-only, with --tracks = N + 1
for each display row:
    render a row wrapper (out of layout — cells stay direct grid items)
    for each cell:
        label it "Row r, column c, empty" / "Clue cell" / "Blocked cell"
        white → the plain cell style
        block → the block style, plus the diagonal if it starts a run
```

## Styling (`KakuroBoard.module.css`)

- **Grid lines come from the gap, not from borders.** The board has a 1px `gap` and its own
  background is the line colour, so every line — white/white, black/black, and the boundary
  between them — is drawn in one place. Per-cell borders would need a separate rule for each of
  those three cases.
- **The diagonal is a background gradient.** A `to top right` linear gradient's 50% line runs
  from the upper-left corner to the lower-right one, so a hard-stopped 1.5px band at 50% is the
  clue split. Convention (research G7): upper-right triangle = down sum, lower-left = across.
- **Dark theme overrides the block colour.** `--ink` is cream in the dark theme, so the
  light-theme mix would turn every black cell into a bright slab. Blocks become a muted step
  above the paper instead.
