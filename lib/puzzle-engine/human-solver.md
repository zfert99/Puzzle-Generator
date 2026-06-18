# Human Solver: Plain English Pseudocode

This document explains the core logic behind our `human-solver.ts` engine. Unlike the standard `sudoku.ts` backtracking solver which uses brute-force guessing to quickly find a solution, the `HumanSolver` uses pure logical deduction. This ensures that any "Expert" puzzle we generate can actually be solved by a human without blindly guessing.

---

## 1. Setup & Candidate Tracking

**Goal:** Initialize the puzzle state and keep track of "pencil marks" (possible candidates) for every cell.
**Steps:**
1. The class defines a private `sees()` method that checks if two cells share a row, column, or 3x3 box. This is reused by multiple strategies.
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
4. **Apply Advanced Strategies:** If basic strategies fail, look for an **X-Wing** or **Y-Wing**. If found, flag that `usedAdvanced = true`, eliminate the candidates, and restart the loop.
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

### Y-Wing (Bent Bivalue)
**Logic:** Look for three cells that only have two candidates each. One is a "Pivot" cell (candidates AB), and the other two are "Pincers" (candidates AC and BC). If the Pivot sees both Pincers, then regardless of whether the Pivot is A or B, one of the Pincers MUST be C. Therefore, any cell that sees BOTH Pincers can never be C, so we can remove C from their candidates.
