# Skyscrapers Types (`skyscrapers-types.ts`)

The first file of the Skyscrapers (Towers) engine module: the **display geometry** shared by
every surface that draws the puzzle. Plan:
[skyscrapers-implementation-plan.md](../../../../Docs/skyscrapers-implementation-plan.md)
(slice V0); decisions `D#` and learnings `L#` are in
[skyscrapers-log.md](../../../../Docs/skyscrapers-log.md). V1 adds the puzzle shape
(`SkyscrapersPuzzle`, the four clue arrays, `visibleCount`, `deriveClues`) here.

## Why the display helpers live in the engine (L2)

A puzzle is stored as the **interior** N×N only (D2) — the rest of the codebase keys on
`grid.length` being the puzzle's named size. A player, though, sees that play area inside a
one-cell clue gutter on all four sides. Kakuro kept its equivalent helpers in board code until
the PDF renderer became a second consumer and they had to move; Skyscrapers has the board (V2)
and the PDF (V3) as *known* consumers before V0 is finished, so the helpers start in the engine.

## `skyscrapersTracks(size)`

```text
tracks = N + 2        (one gutter cell on each side of the play area)
```

## `buildDisplayCells(size)`

Produces the (N+2)×(N+2) picture: display index 0 and N+1 on either axis are the gutter; the
four corners where two gutters meet hold nothing; everything else is a play cell. Unlike Kakuro
(clues inside the grid plus a top-and-left gutter), every Skyscrapers clue sits outside the play
area, so the gutter is symmetric and the corners are dead.

```text
last = tracks - 1
for each display row r, column c:
    both r and c on an edge → corner
    r == 0                  → gutter, side top,    index c - 1
    r == last               → gutter, side bottom, index c - 1
    c == 0                  → gutter, side left,   index r - 1
    c == last               → gutter, side right,  index r - 1
    otherwise               → play cell (r - 1, c - 1)
```

A gutter cell's `index` runs 0..N−1 along its own side, so a top clue at index `i` and a bottom
clue at index `i` both look at column `i` — the pairing the per-line permutation table (E1)
buckets by.
