# SkyscraperClueCell: Plain English Pseudocode

One Skyscrapers edge clue in the board's gutter (plan slice V2 in
[skyscrapers-implementation-plan.md](../../../../../Docs/skyscrapers-implementation-plan.md);
clue UX is decision D9 in the log). Rendered by `Board.tsx` on all four sides; the dead corners
are plain read-only gridcells, not this component.

## Why it subscribes to one line only

Each clue cell's selector reads **its own line** from `grid` (`skyscraperClueState`: the clue
value, and the open / satisfied / violated verdict from the filled prefix) plus its "marked
done" flag. Judging one line is O(N); the 4N clue cells together cost O(N²) per keystroke — the
same order as the N² play cells — and a change to a cell re-renders only the two clue pairs whose
line it is on. A board-wide "recompute every clue state" selector would re-render all 4N on
every keystroke (INP, AGENTS.md §3). The verdict is never stored: the grid already says it.

## Why "violated" is provable, never predictive

The verdict follows Tatham's `check_errors` (gap-findings G10): only the cells from the clue's
edge up to the first empty one are judged, and a clue turns red only when those cells already
break it. So a line the player is still working on never flashes red, and a wrong line can
still read as satisfied only once it is complete — which is why a satisfied clue is **not**
tinted by default (no surveyed player does it; the `.clueSatisfied` hook is for an opt-in
setting).

## Done marks

Click, or Enter/Space while focused, calls `toggleClueDone` — a real move (undo-able,
persisted). Drawn **error > done > normal** as in `towers.c`: a clue wrongly marked done still
shows its violation. The cell is `tabIndex -1` (outside the roving tab order); the board's `C`
key brings focus here and arrow keys walk the gutter.

```text
selector: { clue, status } = skyscraperClueState(edgeClues, grid, side, index)
          done = doneClues[clueFlatIndex(side, index, size)]
          (no edgeClues yet — a rehydrating tick — → blank, never throw)
class:    gutterCell; then clueViolated if violated, else clueDone if done,
          else clueSatisfied if satisfied (a no-op colour by default)
name:     describeSkyscraperClue(side, index, clue, status, done)
          e.g. "Clue 3, looking down from the top of column 2, open"
data:     data-clue="side-index" on a present clue (the board's navigation hook),
          data-status for tests
content:  the digit, or nothing for a blank
click:    toggleClueDone(side, index) on a present clue
```
