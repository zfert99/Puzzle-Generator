# Human Solver: Plain English Pseudocode

This document explains the core logic behind our `human-solver.ts` engine. Unlike the standard `sudoku.ts` backtracking solver which uses brute-force guessing to quickly find a solution, the `HumanSolver` uses pure logical deduction. This ensures that any "Expert" puzzle we generate can actually be solved by a human without blindly guessing.

---

## 1. Setup & Candidate Tracking

**Goal:** Initialize the puzzle state and keep track of "pencil marks" (possible candidates) for every cell.
**Steps:**

1. The class defines helper methods to reduce repetition across strategies:
   - `inSameBox()` / `sees()`: Check if two cells share a 3x3 box, or broadly "see" each other (same row, column, or box).
   - `getBoxCells(b)`: Returns all 9 cell coordinates for box `b` (0-8).
   - `getCellsWithNCandidates(n)`: Scans the grid and returns all empty cells with exactly `n` candidates.
   - `getCandidatePositions(num, axis)`: Builds a position map showing which columns (or rows) contain a given candidate for each row (or column).
   - `eliminateFromCellsSeeingAll(targets, cand, exclude?)`: Removes a candidate from every empty cell that "sees" all target cells.
   - `applyFishOnAxis(num, axis, size)`: Generic "fish" pattern detector. Given a candidate number, an axis (row or col), and a size (2 = X-Wing, 3 = Swordfish, 4 = Jellyfish), it finds groups of `size` primary lines whose candidate positions align into exactly `size` secondary lines, then eliminates the candidate from those secondary lines in all other primary lines. This single helper powers both X-Wing and Swordfish (and can trivially support Jellyfish in the future).
   - `combinations(arr, k)`: Generates all k-element combinations from an array. Used by the fish pattern detector to enumerate candidate line groupings.
   - `applyWingPattern(pivotSize)`: Generic "wing" pattern detector. Given a pivot size (2 = Y-Wing, 3 = XYZ-Wing), it finds pivot cells of that size, enumerates possible target candidates Z, finds bivalue pincer cells matching `{X, Z}` and `{Y, Z}` that see the pivot, and eliminates Z from the appropriate zone. The three pivot-size-dependent branches handle: where Z comes from (complement vs subset of pivot), pincer mutual visibility (Y-Wing only), and elimination zone (pincers only vs pivot + pincers).
2. When a new solver is created, it takes a copy of the current grid.
3. It creates a 9x9 grid of `Set`s, where every cell starts with candidates 1 through 9.
4. It iterates over the grid. If a cell already has a number, it places the number and immediately removes that number from the candidates of all other cells in its row, column, and 3x3 box. Each placement increments a `filledCount` counter, enabling O(1) completion checks via `isSolved()` (which simply tests `filledCount === 81` instead of scanning all 81 cells).

---

## 2. The Main Solving Loop

**Goal:** Continuously apply logical strategies from easiest to hardest until the puzzle is solved or we get stuck.
**Steps:**

1. Start a `while` loop that runs as long as the puzzle is not solved and we made at least one change in the last pass.
2. **Apply Basic Strategies:** Try to find a Naked Single or Hidden Single. If one is found, place the number, mark `changed = true`, and restart the loop.
3. **Apply Intermediate Strategies:** Try to find Naked Pairs, Hidden Pairs, or Pointing Pairs to eliminate candidates. If successful, mark `changed = true` and restart the loop.
4. **Apply Advanced Strategies:** If basic strategies fail, look for an **X-Wing**, **Swordfish**, **Y-Wing**, or **XYZ-Wing**. If found, flag that `usedAdvanced = true`, eliminate the candidates, and restart the loop.
5. If the loop finishes checking all strategies and nothing changed, we are stuck. The puzzle requires guessing or strategies we haven't programmed yet.
6. Return whether the puzzle was fully solved, and whether it explicitly required an advanced strategy to finish.

---

## 3. The Strategies Explained

### Naked Singles

**Logic:** If a cell has only one possible candidate left, it must be that number.

### Hidden Singles

**Logic:** If a specific number (like a 7) can only go in exactly one cell within a specific row, column, or 3x3 box, it must be placed there, even if that cell has other candidates.

### Naked Pairs

**Logic:** If two cells in the same row/col/box have the exact same two candidates (e.g., [2, 5]), those two numbers must go in those two cells. We can safely remove 2 and 5 from the candidates of every other cell in that row/col/box.

### Hidden Pairs

**Logic:** If two specific candidates (e.g., 2 and 5) are restricted to the exact same two cells within a row, column, or box, then those two cells must contain those two candidates. All other candidates can be safely eliminated from those two cells, turning them into a Naked Pair.

### Pointing Pairs (Box-Line Reduction)

**Logic:** If a candidate is restricted to a single row or column within a 3x3 box, it must appear in that box's row/col. Therefore, we can eliminate that candidate from the rest of the row or column outside the box.

### X-Wing (Fish Size 2)

**Logic:** Look for a specific candidate (like a 4). If there are exactly two rows where a 4 can be placed, and those placements align in the exact same two columns, then the 4s must form an 'X' shape. We can eliminate 4 from the candidates of all other cells in those two columns. Also checks column-based X-Wings (2 columns aligning into 2 rows). Delegates to the shared `applyFishOnAxis` helper with `size = 2`.

### Swordfish (Fish Size 3)

**Logic:** An extension of X-Wing from 2 rows/columns to 3. Look for a candidate that appears in exactly 2-3 positions within 3 different rows, and where all those positions fall into exactly 3 columns. The candidate must occupy one cell per column within those 3 rows, so we can eliminate it from all other rows in those 3 columns. Also checks column-based Swordfish. Delegates to the shared `applyFishOnAxis` helper with `size = 3`.

### Y-Wing (Wing Pattern, pivotSize 2)

**Logic:** Look for three bivalue cells. A "Pivot" cell [A, B], and two "Pincer" cells [A, C] and [B, C] that each see the pivot but NOT each other. Since the pivot must be A or B, one pincer is always forced to C. Any cell seeing BOTH pincers can therefore never be C. Delegates to the shared `applyWingPattern` helper with `pivotSize = 2`.

### XYZ-Wing (Wing Pattern, pivotSize 3)

**Logic:** A "Pivot" cell with THREE candidates [A, B, C] and two bivalue "Pincer" cells [A, C] and [B, C] that each see the pivot. Since the pivot must be A, B, or C — in every case, one of the three cells is C. The elimination zone is more restricted: candidate C can only be removed from cells that simultaneously see the pivot AND both pincers. Delegates to the shared `applyWingPattern` helper with `pivotSize = 3`.
