# Skyscrapers Types (`skyscrapers-types.ts`)

The data shapes for Skyscrapers (Towers), the display geometry every surface shares, the
visibility count, and the validator that keeps a puzzle's clues honest against its solution.
Plan: [skyscrapers-implementation-plan.md](../../../../Docs/skyscrapers-implementation-plan.md)
(slices V0–V1); decisions `D#` and learnings `L#` are in
[skyscrapers-log.md](../../../../Docs/skyscrapers-log.md).

## What makes Skyscrapers different

Two rules and nothing else: every row and column holds each height 1..N once (a **Latin square**
— no boxes, so `skyscrapersGridConfig` is boxless at every size, unlike `getGridConfig(6)`), and
each present edge clue equals the number of towers **visible** from that edge, a taller tower
hiding every shorter one behind it. `SkyscrapersDifficulty` is the five published tiers plus
`'unrated'` — a puzzle the classifier has not graded. The label comes from the classifier or not
at all (D7); `SKYSCRAPERS_LADDER` is the five tiers as a value, in order, the one list every
form, route and fixture iterates.

## Why the grid is the interior only (D2)

A player sees the N×N play area inside a one-cell clue gutter on all four sides, so a "6×6" is
drawn 8×8. That gutter is *not* stored: `grid` and `solution` are the interior N×N, and the clues
are four length-N arrays (`SkyscraperClues`), **0 meaning blank**. `top[c]` and `bottom[c]` both
look at column `c`; `left[r]` and `right[r]` both look at row `r` — the pairing the per-line
permutation table (E1) buckets by. The rest of the codebase keys on `grid.length` being the
puzzle's named size, and this keeps that true. There are no givens at any published tier (D3), so
`grid` is all-zero; the slot exists so a fixture or a future "givens" lever round-trips.

## Why the display helpers live in the engine (L2)

Kakuro kept its clue-picture helpers in board code until the PDF renderer became a second
consumer and they had to move. Skyscrapers has the board (V2) and the PDF (V3) as *known*
consumers before V0 was finished, so `skyscrapersTracks` and `buildDisplayCells` start here.

```text
skyscrapersTracks(N) = N + 2            (one gutter cell on each side of the play area)

buildDisplayCells(N): last = N + 1
  for each display row r, column c:
    both r and c on an edge → corner
    r == 0                  → gutter, side top,    index c - 1
    r == last               → gutter, side bottom, index c - 1
    c == 0                  → gutter, side left,   index r - 1
    c == last               → gutter, side right,  index r - 1
    otherwise               → play cell (r - 1, c - 1)
```

## `visibleCount(line)` and `lineFor(grid, side, index)`

The visibility count is the number of **strict running maxima** reading inward from the clue:
the first tower always counts, and a tower counts exactly when it is taller than everything
before it. A `0` (an empty cell) never counts and never raises the running maximum, which makes
the same function the "visible so far" count of a partially filled line — what V2's clue-state
check and E2's `nearlyFilledClue` rule read.

```text
tallest = 0, seen = 0
for each height in the line:
    if height > tallest: tallest = height, seen += 1
return seen
```

`lineFor` returns the cells a clue reads, in reading order (first element nearest the clue):
`left` is the row as stored, `right` the row reversed, `top` the column downward, `bottom` the
column upward.

## `deriveClues(solution)`

All 4N clues a solved square implies — `visibleCount(lineFor(solution, side, i))` for every side
and index. The generator's starting point (E4) and the one source of truth for fixtures: a
fixture's kept clues are derived from its square, never typed.

## `isLatinSquare(grid)` and `validateSkyscrapers(puzzle)`

The validator returns every problem at once as readable strings (empty = valid), the same choice
`validateKillerCages` and `validateKakuroRuns` make, for the same debugging reason. It checks the
solution is an N×N Latin square with N = `gridSize`, that `grid` is N×N and any non-zero entry
agrees with the solution (there are no givens in v1, but a wrong one must not pass), that each
clue array has length N, and that every present clue is 1..N and equals the count the solution
implies on that line. If the solution itself is unsound it stops there, because the clue checks
derive from it. It does **not** check uniqueness — that is the exact solver's job (E1).
