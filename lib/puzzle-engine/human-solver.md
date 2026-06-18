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
2. When a new solver is created, it takes a copy of the current grid.
3. It creates a 9x9 grid of `Set`s, where every cell starts with candidates 1 through 9.
4. It iterates over the grid. If a cell already has a number, it places the number and immediately removes that number from the candidates of all other cells in its row, column, and 3x3 box.

---

## 2. The Main Solving Loop

**Goal:** Continuously apply logical strategies from easiest to hardest until the puzzle is solved or we get stuck.
**Steps:**
1. Start a `while` loop that runs as long as the puzzle is not solved and we made at least one change in the last pass.
2. **Apply Basic Strategies:** Try to find a Naked Single or Hidden Single. If one is found, place the number, mark `changed = true`, and restart the loop.
3. **Apply Intermediate Strategies:** Try to find Naked Pairs or Pointing Pairs to eliminate candidates. If successful, mark `changed = true` and restart the loop.
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

### Pointing Pairs (Box-Line Reduction)
**Logic:** If a candidate is restricted to a single row or column within a 3x3 box, it must appear in that box's row/col. Therefore, we can eliminate that candidate from the rest of the row or column outside the box.

### X-Wing
**Logic:** Look for a specific candidate (like a 4). If there are exactly two rows where a 4 can be placed, and those placements align in the exact same two columns, then the 4s must form an 'X' shape. We can eliminate 4 from the candidates of all other cells in those two columns.

### Swordfish
**Logic:** An extension of X-Wing from 2 rows/columns to 3. Look for a candidate that appears in exactly 2-3 positions within 3 different rows, and where all those positions fall into exactly 3 columns. The candidate must occupy one cell per column within those 3 rows, so we can eliminate it from all other rows in those 3 columns. Also implemented in the reverse direction (3 columns mapping to 3 rows).

### Y-Wing (Bent Bivalue)
**Logic:** Look for three cells that only have two candidates each. One is a "Pivot" cell (candidates AB), and the other two are "Pincers" (candidates AC and BC). If the Pivot sees both Pincers, then regardless of whether the Pivot is A or B, one of the Pincers MUST be C. Therefore, any cell that sees BOTH Pincers can never be C, so we can remove C from their candidates.

### XYZ-Wing
**Logic:** An extension of Y-Wing where the pivot cell has 3 candidates (ABC) instead of 2. The two pincers are bivalue cells containing (AC) and (BC) respectively, and both must see the pivot. Because the pivot itself could also be C, the elimination zone is more restricted than a Y-Wing: candidate C can only be removed from cells that simultaneously see the pivot AND both pincers.
