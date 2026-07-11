# useBoardStore: Plain English Pseudocode

The interactive board's single source of truth — a Zustand store wrapped in the
`zundo` temporal middleware for undo/redo.

## Why Zustand + zundo

- **Zustand** lets each `Cell` subscribe (via `useShallow`) to only its own slice, so
  moving the selection or typing a digit re-renders a handful of cells, not all 81.
  This granular subscription is what keeps input latency (INP) low (research §2).
- **zundo** gives snapshot undo/redo for free. It is `partialize`d to track **only**
  `grid` and `candidates` — never the timer, status, or selection. That way a
  per-second timer tick creates no history entry, and an undo reverts a move without
  rewinding the clock (research §3.2).

## State

`grid`, `candidates` (bitmask/cell), `givens` (immutable clues), `solution`, `peers`
(precomputed), plus session state `difficulty`, `selectedCell`, `pencilMode`,
`realTimeErrors`, `status` (`configuring | playing | paused | solved`), `elapsedTime`,
and `mistakes` (count of wrong placements).

## Persistence

The store is wrapped in Zustand's `persist` middleware (key `sudoku-board`,
localStorage) so a refresh resumes the in-progress game. `partialize` saves the game
data (grid, candidates, givens, solution, difficulty, status, timer, mistakes, …) but
not `peers`, which are recomputed from `config` in `onRehydrateStorage`. Actions are
dropped by JSON serialization and re-supplied by the store creator. `persist` sits
*inside* `temporal`, so undo/redo still works and `useBoardStore.temporal` is intact.
Because the persisted state only exists on the client, `PlayExperience` gates its
first render on a mounted check to avoid an SSR/hydration mismatch.

## Key actions

```text
startNewGame(puzzle):
  load grid/solution; mark givens (cells that start non-zero); compute peers;
  status = playing; reset timer/selection; CLEAR undo history.

configure(): status = configuring (return to the new-game screen).

selectCell(r, c): set the selection.

inputDigit(digit):
  ignore unless playing with a selected, non-given cell.
  IF pencil mode AND the cell is empty: toggle that candidate bit.
  ELSE (pen): if the cell already holds this digit, clear it; otherwise place it —
    UNLESS all `size` instances of that digit are already on the board (lockout:
    matches the grayed-out numpad button) — clear its pencil marks, and strip the
    digit from every peer's candidates. A placement that doesn't match the solution
    increments `mistakes`. Then, if the grid equals the solution, status = solved
    (which locks the board — the play actions all require status === 'playing').

clearCell(): empty the selected non-given cell (value + candidates).

hint():
  reveal one correct cell — the selected empty cell if there is one, else the first
  empty cell. Place its value from the solution (stripping peers' candidates, same as
  a normal placement) and re-check for completion. (A strategy-aware "why" hint is a
  Phase 5 concern; this reveal-a-cell hint keeps the heavy solver out of the client.)

togglePencilMode / toggleRealTimeErrors: flip the respective flag.

tick(): +1 second, but only while playing.
pause() / resume(): toggle between playing and paused.
```

Undo/redo are read from `useBoardStore.temporal` (zundo's sibling store), not the main
store.
