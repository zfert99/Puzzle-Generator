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
`realTimeErrors`, `status` (`configuring | playing | paused | solved`), `mode`
(`play | daily`), `elapsedTime`, and `mistakes` (count of wrong placements).

### Why `mode`

The store is shared between `/play` and `/daily`. Persisting only `status` isn't enough
to keep the two surfaces separate: a persisted `status === 'playing'` daily would render
on `/play` (whose config gate keyed on `status` alone). `mode` records **which surface
owns the current game**, set by `startNewGame(puzzle, mode)` (defaults to `'play'`).
`PlayExperience` shows its config screen unless `status !== 'configuring' && mode === 'play'`,
so a daily never leaks onto free play — and "new game" always stays in the context you
came from. `DailyExperience` already gates on a local `phase`, so a `/play` game can't
leak the other way.

## Persistence

The store is wrapped in Zustand's `persist` middleware (key `sudoku-board`,
localStorage) so a refresh resumes the in-progress game. `partialize` saves the game
data (grid, candidates, givens, solution, difficulty, status, timer, mistakes, …) but
not `peers`, which are recomputed from `config` in `onRehydrateStorage`. `mode` is
persisted too, so a refresh keeps a daily contained to `/daily`. The store `version` is
`2` — bumped when `mode` was added, which discards any pre-`mode` persisted game on
update (a clean reset rather than a half-migrated board). Actions are dropped by JSON
serialization and re-supplied by the store creator. `persist` sits
*inside* `temporal`, so undo/redo still works and `useBoardStore.temporal` is intact.
Because the persisted state only exists on the client, `PlayExperience` gates its
first render on a mounted check to avoid an SSR/hydration mismatch.

## Key actions

```text
startNewGame(puzzle, mode='play'):
  load grid/solution; mark givens (cells that start non-zero); compute peers;
  status = playing; set mode (which surface owns this game); reset timer/selection;
  CLEAR undo history.

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
