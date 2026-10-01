# Kakuro Layout (`kakuro-layout.ts`)

Two jobs, both reading only the black/white shape of the interior grid:

1. **`deriveRuns`** — turn a solved grid into its runs and clue sums.
2. **`validateKakuroLayout`** — decide whether a shape is a legal, shippable Kakuro layout.

The layout *generator* (plan slice E4) will be added to this module later. Rules `D#` and
research gaps `G#` are in [kakuro-log.md](../../../../Docs/kakuro-log.md).

## `whiteMaskOf(solution)`

A cell is white when it holds a digit, black when it holds `0` (D3). One line, but named so the
"what counts as white" rule lives in exactly one place.

## `scanStrips(white)` (internal)

Finds every maximal strip of white cells, across then down. It keeps **length-1 strips** on
purpose: a white cell with a black cell (or the edge) on both sides is an orphan, and that is
precisely what the validator has to report. `deriveRuns` drops them itself.

```text
for each row (across) and then each column (down):
    walk the line one cell past its end
        white cell  → add it to the strip being built
        black / end → if a strip is being built, emit it and start fresh
```

Walking one step past the end means the last strip is closed by the same branch as every other,
with no "flush after the loop" special case.

## `deriveRuns(solution)`

```text
strips = scanStrips(white mask of the solution)
keep strips of length 2 or more
each becomes a run: id = its position in that list, sum = total of its solution digits
```

The clues are **computed from the solution**, never stored beside it. A puzzle built this way
cannot carry a clue that disagrees with its own answer — one source of truth.

## `validateKakuroLayout(white)`

Every rule here is *static*: it needs no solver. That is the point. Checking uniqueness is the
expensive step in Kakuro (it is ASP-complete), so anything that can reject a hopeless layout
first is nearly free yield. Returns all problems as a list (empty = valid).

```text
not a non-empty square                         → stop, nothing else is meaningful
any strip of length 1                          → that cell has no run in that direction
any strip longer than 9                        → only nine digits exist, so it cannot be filled
white cells not one connected region           → it would be two separate puzzles
not equal to itself rotated 180°               → the aesthetic norm for published Kakuro (D9)
contains an all-white 2×9, 3×8, 4×7 or 5×5     → can never be unique (see below)
more whites / fewer HINTS than the size table   → outside what has ever been found unique
```

### Why those rectangles

In an all-white rectangle of those sizes there is always a set of digits that can be swapped
around a cycle without changing any row or column total — so whatever the clues are, a second
solution exists (Mathimagics, gap G10). Both orientations are checked. The check is on a real
contiguous window, not a bounding box: a 5×5 area with one black cell inside it is legal, and
there is a test pinning exactly that.

Checking each critical size as a fixed window also covers every *larger* rectangle for free,
since a 5×6 contains a 5×5.

### The size table

`UNIQUENESS_BOUNDS` is Mathimagics' table for interior sizes 5–16: the most white cells, and the
fewest interior **hint cells**, any uniquely-solvable layout has been found with. A hint cell
is a black cell that heads a run — a white cell directly to its right or below it. A black cell
heading nothing is dead space and does not count; the first draft counted every black cell,
which let a layout with a solid black blob pass the floor with zero actual hints (a review
finding, with a test pinning the 12-blacks-but-4-hints case). A size outside
the table just isn't bounded by this rule. These are empirical ceilings, not proofs — passing
them does not make a layout unique, it only means it has not been ruled out.

## `kakuroTracks(size)`, `KakuroClue`, `buildClues(runs, size)` — the display picture

Moved here from the interactive board in V3 because the PDF draws the same picture. A Kakuro's
display grid has one more track than its interior on each axis — the clue gutter as row 0 and
column 0 — so interior (r, c) is display (r + 1, c + 1). A run's clue sits on the display cell
just before its first cell (one step left for an across run, one step up for a down run); in
display coordinates that step always lands inside the grid, because the gutter absorbs runs
that start at the interior's edge. A cell heading both an across and a down run carries both
sums (`KakuroClue { across?, down? }`); a black cell heading nothing maps to `null`.

```text
clues = (N+1)² nulls
for each run: display cell before its first cell ← add run.sum under 'across' or 'down'
```

## What this does not do

Nothing here says a layout *is* uniquely solvable — only that it has not been statically ruled
out. Proving uniqueness needs the counting solver (slice E1).
