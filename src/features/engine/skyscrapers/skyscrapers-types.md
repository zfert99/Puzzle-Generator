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
at all (D7); `SKYSCRAPERS_SIZES` (5 / 6 / 7 — D4, settled by E3's measurement: 9×9 failed both
gates, 4×4 has no expert tier) is the one list of served sizes the route and the pickers read;
`SKYSCRAPERS_LADDER` is the five tiers as a value, in order, the one list every
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

`lineFor` returns the heights a clue reads, in reading order (first element nearest the clue).
It is built on **`lineCells(size, side, index)`** — the flat cell indices (`row × size + column`)
of that line from the clue's edge inward — which is the **one line convention every solver
shares**: the exact solver compiles its lines through it, the logical solver builds its clued
lines and houses from it, and `lineFor` maps it over a grid. One helper, so a clue can never mean
different cells to different engines (the E2 review's reuse finding: three solvers had grown
three private copies).

## `clueAt(clues, side, index)` and `presentClueCount(clues)`

`clueAt` reads one clue and returns 0 for blank **and** for absent (a short or missing side
array). The validator is the boundary that rejects a malformed clue set; a renderer reading
through `clueAt` degrades to empty gutter cells on purpose instead of crashing a Server
Component on `undefined[index]`. `presentClueCount` is the number of non-zero clues — the
blank-clue difficulty lever (research §3) read the same way by the workbench, the fixtures'
tests, and later E3/E4 instrumentation and E5 bands, so no two consumers can count it
differently.

## `clueStatus(line, clue)` and `clueFlatIndex(side, index, size)`

`clueStatus` is the board's verdict on one clue, judged on the **filled prefix** only — the cells
from the clue's edge up to the first empty one (Tatham's `check_errors`, gap-findings G10,
decision D9). It is `violated` when the prefix already shows more towers than the clue; when the
tallest tower is in the prefix with fewer visible than the clue (nothing behind N is ever seen);
when the count has reached the clue but N is still to come (it will be seen); or when the cells
left cannot make up the shortfall. It is `satisfied` only when the line is complete and the count
matches, and `open` otherwise — a blank clue is always open. Provable, never predictive: a line
the player is still working on never turns red.

```text
walk the line from the clue end, stopping at the first empty cell:
    filled += 1; if height > tallest: tallest = height, seen += 1
complete        → satisfied if seen == clue else violated
seen > clue     → violated
tallest == N and seen < clue → violated
seen == clue and tallest != N → violated
seen + (N - filled) < clue    → violated
otherwise       → open
```

`clueFlatIndex` packs the four sides into one 4N-long array (top, bottom, left, right, each in
index order) — the board's "marked done" flags live in that order.

## `deriveClues(solution)`

All 4N clues a solved square implies — `visibleCount(lineFor(solution, side, i))` for every side
and index. The generator's starting point (E4) and the one source of truth for fixtures: a
fixture's kept clues are derived from its square, never typed.

## `validateSkyscrapers(puzzle)`

The Latin-square check itself is `grid-utils.isLatinSquare` (shared with Keisan). The validator
returns every problem at once as readable strings (empty = valid), the same choice
`validateKillerCages` and `validateKakuroRuns` make, for the same debugging reason. It checks the
solution is an N×N Latin square with N = `gridSize`, that `grid` is N×N and any non-zero entry
agrees with the solution (there are no givens in v1, but a wrong one must not pass), that each
clue array has length N, and that every present clue is 1..N and equals the count the solution
implies on that line. If the solution itself is unsound it stops there, because the clue checks
derive from it. It does **not** check uniqueness — that is the exact solver's job (E1).
