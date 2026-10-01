# Kakuro Types (`kakuro-types.ts`)

The data shapes for Kakuro (Cross Sums) and the validator that keeps a puzzle's runs honest
against its solution. Plan: [kakuro-implementation-plan.md](../../../../Docs/kakuro-implementation-plan.md)
(slice V1); decisions `D#` are in [kakuro-log.md](../../../../Docs/kakuro-log.md).

## What makes Kakuro different

`KakuroDifficulty` is the five published tiers plus `'unrated'` — a puzzle the classifier could
not finish with the techniques built so far (or has not graded). The label comes from the
classifier or not at all (D8); it is never a placeholder dressed as a grade. `KAKURO_LADDER`
is the five published tiers as a value, in order, with `KakuroLevel` as its element type — the
one list the generate form, the `/api/generate` route and the fixture selector iterate (review
follow-up 5: three hand-typed copies collapsed into it).

There is no row, column or box rule. The only constraint unit is the **run** — a maximal
horizontal or vertical strip of white cells. A run's digits must add up to its clue and must all
be different. Digits are 1–9 at every grid size, which is why `gridSize` is a plain `number`
here rather than the Sudoku `GridSize` union: Kakuro picks its own sizes (D11).

## Why the grid is the interior only (D2)

A player sees an extra strip of clue cells along the top and left, so a "7×7" is drawn 8×8.
That strip is *not* stored. `grid` and `solution` are the interior N×N, and the runs are an
explicit list. The rest of the codebase keys on `grid.length` being the puzzle's named size
(daily sizes, profiles, board config), and storing the border would silently turn every Kakuro
into a size nothing else recognises. The gutter is a rendering concern — see the board's
`kakuro-board.md` and `ClueCell`.

## Why black cells are `0` (D3)

A black cell is `0` in both `grid` and `solution`, and "black" is *defined* as "belongs to no
run". No `-1` sentinel: every existing consumer of a grid (the solved check, `gridsMatch`, clue
counting) treats it as plain numbers, and a sentinel would leak into all of them. The cost is
that any loop asking "is the board complete?" must skip cells that are in no run.

## Why a run looks like a Killer cage

`Run` is `{ id, dir, sum, cells }` with flat cell indices — a Killer `Cage` plus a direction.
That is deliberate: the daily stores cages in an untyped jsonb column, so runs can go in the same
column later with no migration. The cells are in **reading order**, so `cells[0]` is always the
cell the clue sits beside; the renderer relies on that.

## `validateKakuroRuns(runs, solution)`

Returns every problem it finds as a list of sentences (empty = valid), rather than throwing on
the first — when a hand-typed fixture is wrong it is usually wrong in more than one place.

```text
for each run:
    length must be 2..9
    walking its cells in order:
        each index must be in range
        each step must be exactly one cell along the run's direction
            (across: +1 and NOT wrapping onto the next row; down: +gridSize)
        count the cell against its direction's coverage
        a cell holding 0 is black — a run may not include it
    the digits must all differ
    the digits must total the run's sum

for each white cell (solution digit > 0):
    it must be in exactly one across run and exactly one down run
```

The row-wrap check exists because flat indices hide it: the last cell of one row and the first
cell of the next differ by exactly 1, which looks like a legal across step.

What it does **not** check: that runs are maximal, or that the black/white shape is a legal
Kakuro layout. Those need only the mask, not the clues, so they live in
`validateKakuroLayout` (`kakuro-layout.ts`).

## `kakuroGridConfig(size)`

The board configuration a Kakuro plays with: boxless (no houses at all — the row-strip sentinel
keeps any ungated box reader harmless, exactly as Keisan's `calcGridConfig` does) and
`maxNum: 9` **at every size**. Sudoku's digits shrink with the grid (1–4 on a 4×4); Kakuro's never
do, so the numpad and pencil grid must read `maxNum`, not `size`.
