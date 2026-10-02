# Diggers

This module is responsible for transforming a fully solved Sudoku grid into a playable puzzle by selectively removing clues ("digging"). Different difficulties require fundamentally different digging strategies.

## `countSolutions(grid, config, limit)`

**Why:** A valid Sudoku puzzle must have exactly ONE unique solution. Every digger calls this after every clue removal (the Expert/Extreme diggers as a cheap gate in front of `HumanSolver`), so it is a hot path. It uses the same **bitmask + MRV backtracking** as `fillGrid` (see `grid-utils.md`): O(1) legality tests via row/column/box bitmasks and always branching on the most-constrained empty cell first. We set a limit (default 2) because counting all solutions for a sparse grid would be a massive waste of CPU; the moment we see a second solution the puzzle is non-unique and we abort early.

```text
Seed rowMask/colMask/boxMask from the grid's existing clues.
Initialize a counter to 0.

solve():
  If the counter has reached the limit, stop early.
  MRV scan over empty cells: allowed = full & ~(rowMask | colMask | boxMask).
    If any empty cell has 0 allowed digits → dead end, return.
    Pick the empty cell with the fewest allowed digits (stop early on a forced single).
  If there were no empty cells → a complete solution; increment the counter and return.
  For each allowed digit of the chosen cell:
    Place it and set the row/column/box mask bits.
    Recurse.
    Backtrack: clear the cell and mask bits.
    If the counter reached the limit, return.

Start the recursion and return the counter.
```

> **Injectable `rng` (all three diggers).** `applyExhaustiveDigger`, `applyQuotaDigger`, and
> `applyExtremeDigger` each take a trailing `rng: () => number = Math.random`, forwarded to `shuffle`
> / `fillGrid` (and the quota digger's cell pick). It defaults to `Math.random` — existing behavior
> unchanged — but lets `generateSudoku` thread a seeded PRNG through the whole pipeline for
> reproducible generation, matching the `calc/`/`killer/` convention.

## Time budget (`deadline`) and `SUDOKU_BUDGET_ERROR`

**Why:** the Expert and Extreme diggers loop over whole re-digs, so their worst case is unbounded
in wall-clock terms (Extreme: up to 50 fresh grids). Both take a trailing `deadline` — an absolute
`performance.now()` value, default `Infinity` — and throw an `Error` whose `name` is
`SUDOKU_BUDGET_ERROR` (`'SudokuBudgetError'`, test with `isSudokuBudgetError`) once it passes.
This is the Kakuro/Skyscrapers contract (a name-tagged error, not a subclass) so a route treats
every engine's budget error the same way. `generateSudoku` turns its `timeBudgetMs` option into the
deadline. With the default `Infinity` the clock is never read, so unbudgeted callers behave exactly
as before. The quota digger has no deadline: it is bounded by its 100-failure cap and runs in
milliseconds.

## `digExhaustively(grid, config, rng, maxTier, deadline = Infinity)`

**Why:** the shared core of the Expert and Extreme diggers — try removing every clue in a shuffled
order and keep a removal only if `HumanSolver` (capped at `maxTier`) can still finish the puzzle by
pure logic. Brute-force uniqueness alone is not enough for these tiers: a unique puzzle may still
require guessing.

**The uniqueness gate.** A sound logical solver can never complete a grid that has two solutions,
so every removal that breaks uniqueness is rejected — and in practice almost every rejection is
exactly that. The old pass found this out the expensive way: a failing `HumanSolver` run grinds
through every strategy up to ALS-XZ and AIC before giving up. `countSolutions` (limit 2) answers
the same question in ~0.1 ms, so it runs first and `HumanSolver` only sees grids that are still
unique. The output is **byte-identical** to the ungated pass for the same seed: neither check
consumes `rng`, and the gate only skips solver runs that could not have succeeded
(`diggers.test.ts` pins this against an ungated reference implementation). Measured on 10 seeded
grids (October 2026): one Extreme-tier dig pass went from ~445 ms to ~36 ms (12×); one
advanced-tier pass from ~17 ms to ~9 ms (2×) — the advanced solver gives up much sooner, so it had
less waste to cut.

`countSolutions` backtracks in place and restores every cell it touches, so the gate passes the
live grid without copying it.

```text
Shuffle all cell positions with rng.
For each position:
  If the deadline has passed, throw SUDOKU_BUDGET_ERROR.
  If the cell is already empty, continue.
  Remove the clue.
  If countSolutions(grid) is not exactly 1:
    Put the clue back and continue (non-unique — no sound solver could finish it).
  Run HumanSolver capped at maxTier on a copy.
  If it does not finish the grid, put the clue back.
```

## `applyExhaustiveDigger(grid, config, rng = Math.random, deadline = Infinity)`

**Why:** Used for Expert puzzles. Expert must *need* an advanced strategy (X-Wing, Swordfish,
Y-Wing, XYZ-Wing), not merely be solvable with one available. The digger used to stop after one
dig pass capped at the advanced tier, and that guaranteed nothing about necessity: a minimal
advanced-solvable puzzle almost always turns out to be basic-solvable (measured **180 of 200**,
and 38 of 40 in the review that found it), so "Expert" was mostly a Hard with fewer clues, and
`canHumanSolveExpert` sat unused. It now mirrors the Extreme digger: dig, check
`canHumanSolveExpert` (solved at the advanced cap **and** `requiresAdvanced`), and retry until the
check passes.

A retry restores the original solution and re-digs it in a fresh shuffled order, rather than
drawing a new solution as the Extreme digger does: the function only receives the grid (which *is*
the solution when it is called), and a new dig order alone already lands on an advanced-requiring
puzzle ~10% of the time. `EXPERT_MAX_RETRIES = 60` leaves ~0.2% (0.9⁶⁰) of calls falling back to the
last, unverified puzzle — still unique and logically solvable, as before. Cost: ~10 passes on
average, so Expert generation went from ~17 ms to ~95 ms per puzzle (the uniqueness gate halves
the price of each pass).

**Known gap — Claiming is not implemented.** The basic tier has *pointing* pairs/triples (box →
line) but not *claiming* / box-line reduction (line → box); see `strategies/basic.md`. A puzzle
whose only "advanced" step is really a claiming move is therefore accepted as Expert here, because
`HumanSolver` reaches it through an advanced strategy instead. Adding claiming would re-grade every
tier, so it is recorded rather than slipped into this change.

```text
Snapshot the solution (the grid as passed in).
Repeat up to EXPERT_MAX_RETRIES times:
  If this is a retry, copy the solution back into the grid.
  digExhaustively(grid, maxTier = 'advanced', deadline).
  If canHumanSolveExpert(grid) — solvable at the advanced cap AND needed an advanced strategy:
    Return (success).
If every attempt failed, keep the last puzzle (graceful degradation).
```

## `applyQuotaDigger(grid, difficulty, config, rng = Math.random)`

**Why:** Used for Easy, Medium, and Hard puzzles. These difficulties just need a specific number of clues removed to feel right. It's much faster to randomly poke holes and check brute-force uniqueness than to run the full `HumanSolver` simulation.

**Bounded cell pick:** the cell to dig is chosen by collecting the currently-filled positions and
indexing into them with `rng()`. The earlier version re-rolled a random `(row, col)` in an inner
`while (grid[row][col] === 0)` loop until it hit a filled cell — uniform, but with **no** iteration
bound; it terminated only by the invariant that a filled cell always remains. Picking from the filled
list is the same uniform choice, but bounded (O(cells) per attempt, negligible beside `countSolutions`).

```text
Determine the target number of clues to remove based on the grid size and difficulty.
Set an attempts counter to 0.
While we still need to remove clues AND we haven't failed 100 times:
  Collect all currently-filled cell positions; if none remain, stop (defensive).
  Pick one of those filled positions at random via rng().
  Save the value and empty the cell.
  Create a copy of the grid.
  If countSolutions on the copy returns exactly 1:
    The puzzle is still unique!
    Decrement the number of clues to remove.
  Else:
    Removing the clue created multiple solutions.
    Restore the saved value.
    Increment the attempts counter.
```

## `applyExtremeDigger(grid, solution, config, rng = Math.random, deadline = Infinity)`

**Why:** Extreme puzzles must explicitly *require* advanced techniques (like AICs). Standard exhaustive digging often results in Expert puzzles by chance. We wrap the exhaustive dig in a retry loop: if the resulting puzzle doesn't actually trigger the extreme logic paths in our solver, we throw it away and start over with a fresh solution grid. The uniqueness gate in `digExhaustively` is where this tier gains most: a full Extreme generation went from ~880 ms to ~150 ms average in the benchmark (October 2026, 5 puzzles each — the per-pass seeded comparison above is the steadier number).

```text
Loop up to 50 times (MAX_RETRIES):
  If this is a retry attempt (not the first loop):
    If the deadline has passed, throw SUDOKU_BUDGET_ERROR.
    Generate a completely new solved grid and overwrite the current grid and solution.

  digExhaustively(grid, maxTier = 'extreme', deadline).

  Once all possible clues are removed:
    Call canHumanSolveExtreme to verify the puzzle ACTUALLY requires extreme strategies.
    If it does:
      Return immediately (success).

  If it doesn't, the loop continues to the next attempt.
```
