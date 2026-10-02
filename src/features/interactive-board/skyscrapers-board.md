# skyscrapers-board: Plain English Pseudocode

The board-side helpers for Skyscrapers (plan slice V2): the accessible name of a clue cell and
the per-clue state read. The geometry (`skyscrapersTracks`, `buildDisplayCells`), the visibility
count and the clue verdict (`clueStatus`) live in the engine's `skyscrapers-types.ts`; this file
is only what the *board* adds — words for a screen reader and a one-line selector.

## `describeSkyscraperClue(side, index, clue, status, done)`

A screen-reader user cannot see which edge a clue sits on, so the name spells the direction it
reads in (decision D9), then its state:

```text
"Clue 3, looking down from the top of column 2, open"
"Clue 4, looking right from the left of row 1, satisfied"
"Clue 1, looking left from the right of row 3, violated"
"Clue 2, looking up from the bottom of column 4, marked done"
"Clue cell, looking up from the bottom of column 4, blank"     (a blank keeps its shape)
```

"marked done" wins over the status word in the name because it is the player's own act; the
visual draws error over done (`SkyscraperClueCell`), so the eye and the ear differ on purpose —
the eye needs the warning, the ear needs to know the mark took.

## `skyscraperClueState(clues, grid, side, index)`

```text
clue   = clueAt(clues, side, index)                 (0 for blank or absent)
status = clueStatus(lineFor(grid, side, index), clue)
```

One line, read the way the engine reads it (first element nearest the clue). This is the whole
of a clue cell's selector — O(N) for one line, never a pass over all 4N clues per keystroke.
