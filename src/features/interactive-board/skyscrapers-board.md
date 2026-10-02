# skyscrapers-board: Plain English Pseudocode

The board-side helpers for Skyscrapers (plan slice V2): the accessible name of a clue cell and
the per-clue state read. The geometry (`skyscrapersTracks`, `buildDisplayCells`), the visibility
count and the clue verdict (`clueStatus`) live in the engine's `skyscrapers-types.ts`; this file
is only what the *board* adds — words for a screen reader and a one-line selector.

## `describeSkyscraperClue(side, index, clue, status, done)`

A screen-reader user cannot see which edge a clue sits on, so the name says the edge it reads
from (decision D9) — the direction follows — then its state:

```text
"Clue 3, from the top of column 2, unsolved"
"Clue 4, from the left of row 1, satisfied"
"Clue 1, from the right of row 3, violated"
"Clue 2, from the bottom of column 4, marked done"
"No clue, bottom of column 4"                      (a blank keeps its shape)
```

**The G8 pass (October 2026) shortened both forms and changed the state word.** The first draft
read "Clue cell, looking down from the top of column 2, blank" — ten words per blank cell, and
most gutter cells are blank, so arrowing along a gutter was mostly boilerplate; "from the top of
column 2" carries the same direction in half the words. The engine's status `open` became
"unsolved" in the name: a listener hears "open" as a disclosure state. The pass was made over the
accessibility tree the browser exposes (Chrome's, via the built-in browser's `read_page`) and the
existing axe journey, not with a live NVDA / JAWS / VoiceOver session — that listening pass is
still the honest next step.

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
