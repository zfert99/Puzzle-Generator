# Grid Utils

This module provides pure, stateless utility functions for manipulating and verifying Sudoku grids. It ensures that common operations like deep copying, validation, and randomized filling are centralized and easily testable.

## `createEmptyGrid(size)`

**Why:** We need a standardized way to generate the initial state of a Sudoku puzzle. We use `0` to represent empty cells rather than `null` or `undefined` because it's easier to serialize and process mathematically in the solver logic.

**Bounded size (`MAX_GRID_SIZE`):** both `createEmptyGrid` and `fillGrid` bound `size` with an *inline*
`size < 1 || size > 9` check (throwing `RangeError`) right before they allocate. The API routes already
validate `gridSize ∈ {4, 6, 9}` before any generation, so this never fires in practice — it's
defense-in-depth so no engine allocation (`Array(size)`, the per-line bitmask arrays in `fillGrid`) is
ever sized by an unbounded external value (a resource-exhaustion DoS path; CodeQL
`js/resource-exhaustion`, which only recognises the bound when it's in-function, not delegated to a
helper). Hard guard, not a clamp: an out-of-range size is a bug, not something to coerce into a
wrong-sized grid.

```text
Assert size is an integer in 1..9 (throw RangeError otherwise).
Initialize a 2D array of the given size.
Fill every cell with the integer 0.
Return the 2D array.
```

## `copyGrid(grid)`

**Why:** JavaScript passes arrays by reference. When algorithms like our diggers test whether removing a clue breaks the puzzle, they must operate on a clone. If they mutated the original grid, we would lose the solved state.

```text
Map over every row in the input grid.
For each row, spread its contents into a new array to create a shallow copy of the row.
Return the new 2D array containing the copied rows.
```

## `isValid(grid, row, col, num, config)`

**Why:** The fundamental rule of Sudoku. Before we can tentatively place a number during generation or counting, we must ensure it doesn't immediately violate the rules.

**Boxless (K0):** on a 5×5/7×7 Latin-square grid (`config.hasBoxes === false`) there is no box —
rows and columns are the whole rule — so we short-circuit to `true` right after the row/column
scan, never touching the box sentinel dims.

```text
Extract the box dimensions and hasBoxes from the config.
For every cell in the target row and target column:
  If the cell contains the number, return false.
If hasBoxes is false (boxless Latin-square grid): return true (rows/columns are the whole rule).
Calculate the top-left coordinate of the subgrid that contains the target cell.
For every cell in that subgrid:
  If the cell contains the number, return false.
If no conflicts are found, return true.
```

## `shuffle(array, rng = Math.random)`

**Why:** Sudoku generation requires randomness so we don't generate the exact same puzzle every time. The Fisher-Yates algorithm is the industry standard for an unbiased, O(n) in-place shuffle.

**Injectable `rng`:** defaults to `Math.random` (so every existing caller is unchanged), but accepts
any `() => number` in `[0, 1)`. This is what makes the whole Sudoku generator **seedable**: pass a
seeded PRNG and generation becomes reproducible (deterministic tests). Previously `shuffle`/`fillGrid`
hard-called `Math.random` and could not be reproduced — the `calc/`/`killer/` engines already thread
an `rng`, so this brings the Sudoku core in line. Passing an rng changes nothing about correctness,
only which of the equally valid outputs is produced.

```text
For each index i from the end of the array down to 1:
  Pick a random index j between 0 and i inclusive, using rng().
  Swap the elements at index i and index j.
Return the shuffled array.
```

## `popcount(mask)`

**Why:** Counts the set bits in a candidate bitmask (Brian Kernighan's algorithm).
It is the metric the MRV heuristic minimises — "how many digits are still legal for
this cell?" — and is shared by `fillGrid` and `countSolutions`.

## `fillGrid(grid, config, rng = Math.random)`

**Why:** We generate puzzles by starting with a completely solved, valid grid, and then digging holes into it. The `rng` is forwarded to the candidate `shuffle` so seeded, reproducible generation flows all the way through (see `shuffle` above). It uses **bitmask-based backtracking with a Minimum Remaining Values (MRV) heuristic**. The old version filled cells in index order and rescanned the whole row/column/box (`isValid`) for every candidate — O(size) per test. Instead we keep a used-digit bitmask per row, column, and box (so each legality test is a single O(1) bit-AND) and always branch on the empty cell with the FEWEST legal digits first. Most-constrained-first collapses the search tree, and this is the representation AGENTS.md Section 1 mandates for the generator core.

**Boxless (K0):** for a 5×5/7×7 Latin-square grid the row-strip box sentinel (`boxWidth = size`,
`boxHeight = 1`) makes `boxOf(r, c)` collapse to `r`, so `boxMask[r]` simply mirrors `rowMask[r]`.
The box term becomes a redundant no-op and the fill is a pure Latin square — with **no** branch
added to this hot loop (protecting the AGENTS.md §3 benchmark). The K0 Latin-square test at 5/7 is
the guard: if the sentinel ever changes, that test fails.

```text
Seed rowMask/colMask/boxMask from any pre-placed clues.
recurse():
  MRV scan: over all empty cells, compute allowed = full & ~(rowMask | colMask | boxMask).
    If any cell has 0 allowed digits → dead end, return false.
    Track the cell with the fewest allowed digits; a cell with exactly 1 is unbeatable, stop scanning.
  If there were no empty cells → the grid is full, return true.
  Extract the chosen cell's allowed digits from its mask and shuffle them (keeps solutions random).
  For each candidate digit:
    Place it; set the bit in rowMask/colMask/boxMask.
    If recurse() succeeds, return true.
    Otherwise backtrack: clear the cell and the three mask bits.
  Return false (dead end).
```
