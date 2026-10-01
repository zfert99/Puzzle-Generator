# kakuro-board: Plain English Pseudocode

The board-side helpers for Kakuro: how the store turns a puzzle's `runs` into what the board
needs (a black-cell mask, run-mate peers, and the clue each black cell shows), plus the clue
cell's accessible name. Pure functions, no React. Rules `D#` / `G#` are in
[kakuro-log.md](../../../Docs/kakuro-log.md).

## Display coordinates

The store's grid is the interior N×N (plan decision D2). What the player sees is (N+1)×(N+1):
a clue gutter along the top and left. `kakuroTracks(size)` is that `N + 1`, and a **display
index** is `row * tracks + col` in that larger grid, so interior (r, c) sits at display
(r + 1, c + 1). `clues` is the only store field in display coordinates, because the gutter
cells have no interior cell behind them.

## `buildBlocked(runs, size)`

Black = "belongs to no run" (D3). Start with everything black and whiten each run's cells. Empty
for a puzzle with no runs — which is every other variant, and lets callers use `blocked.length`
as "is this a Kakuro".

## `computeRunPeers(runs, size)`

Kakuro's only constraint is "no repeat within a run", so the cells a placed digit constrains are
the other cells of its across run and its down run — its **run-mates**. Those are what pencil
stripping and the peer highlight should reach; the row/column/box peers `computePeers` builds
would strip and highlight cells that share nothing. A black cell gets an empty list.

```text
for each run, for each cell in it: add every other cell of the run to that cell's set
```

## `buildClues(runs, size)`

A run's clue sits on the display cell just before its first cell — one step left for an across
run, one step up for a down run. In display coordinates that step always lands inside the grid,
because the gutter absorbs runs that start at the interior's edge. A cell heading both an across
and a down run carries both sums; a black cell heading nothing maps to `null`.

## `describeClue(clue)`

"Clue: across 17, down 23" (whichever sums exist, across first) or "Blocked cell" — the
`aria-label` of a `ClueCell`, so a screen reader hears both sums (research G7).
