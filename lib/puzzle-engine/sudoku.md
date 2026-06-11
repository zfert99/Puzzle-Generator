# Sudoku Engine: Plain English Pseudocode

This document explains the core logic behind our `sudoku.ts` puzzle engine. It breaks down the TypeScript syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Data Structures (The Blueprints)

**Difficulty Levels:**
We define exactly three allowed difficulty levels: 'easy', 'medium', or 'hard'.

**Sudoku Puzzle Object:**
When the engine finishes, it hands back a package containing:
- `grid`: The playable 9x9 board (with holes dug, represented by 0s).
- `solution`: The completed 9x9 board (the answer key).
- `difficulty`: The requested difficulty level.

---

## 2. Core Helper Functions

### `isValid(grid, row, col, number)`
**Goal:** Check if placing a specific number in a specific cell breaks any Sudoku rules.
**Steps:**
1. Loop 9 times (index `i` from 0 to 8).
2. **Row Check:** If the `grid` at `[row][i]` equals the `number`, return FALSE.
3. **Column Check:** If the `grid` at `[i][col]` equals the `number`, return FALSE.
4. **Subgrid Check:** - Calculate the starting corner: `startRow = Math.floor(row / 3) * 3` and `startCol = Math.floor(col / 3) * 3`.
   - Use `i` to check the 3x3 box: If the `grid` at `[startRow + Math.floor(i / 3)][startCol + (i % 3)]` equals the `number`, return FALSE.
5. If no rules are broken after all 9 checks, return TRUE.

### `shuffle(array)`
**Goal:** Randomize an array of numbers (1-9) using the Fisher-Yates algorithm.
**Steps:**
1. Start at the end of the array and work backwards to the beginning.
2. Pick a random index between 0 and the current position.
3. Swap the number at the current position with the number at the random index.
4. Move one step left and repeat until the whole array is shuffled.

---

## 3. The Generators & Solvers

### `fillGrid(grid)`
**Goal:** Fill a completely blank 9x9 grid with valid, random numbers (Recursive Backtracking).
**Steps:**
1. Loop through all 81 cells (index 0 to 80).
2. Calculate the 2D coordinates: `row = Math.floor(i / 9)` and `col = i % 9`.
3. If the cell at `[row][col]` is empty (equals 0):
   - Shuffle an array of numbers [1 through 9].
   - Loop through each shuffled number:
     - If `isValid(number)` is TRUE:
       - Place the number in the cell.
       - **RECURSE:** Call `fillGrid(grid)` again to try and fill the next empty cell.
       - If the recursion eventually returns TRUE, it means the board is full! Return TRUE.
       - **BACKTRACK:** If the recursion returns FALSE (dead end), reset the cell to 0 and try the next number in the loop.
   - If we tried all 9 numbers and none worked, return FALSE (tell the previous step to backtrack).
4. If the loop finishes checking all 81 cells and finds no empty ones, return TRUE (Puzzle solved!).

### `countSolutions(grid)`
**Goal:** Prove a puzzle has exactly one valid solution.
**Steps:**
1. Keep a `count` variable starting at 0.
2. Define a recursive `solve` function (almost identical to `fillGrid`).
   - If `count` is 2 or more, STOP immediately (the puzzle is broken).
   - Loop through all 81 cells looking for a 0.
   - Try numbers 1-9. If valid, place it and recurse.
   - **Crucial Difference:** When the board is full, do NOT return true. Instead, increment `count` by 1 and return nothing. This forces the function to step back, erase the last number, and keep looking for alternative paths.
3. Call `solve(grid)`.
4. Return the final `count` (1 means perfect, 2 means broken).

---

## 4. The Master Function

### `generateSudoku(difficulty)`
**Goal:** Create the final puzzle object to send to the frontend/PDF generator.
**Steps:**
1. Create a blank 9x9 grid filled with 0s.
2. Call `fillGrid` to completely solve it with random numbers.
3. Save a copy of this full grid as the `solution`.
4. Determine how many numbers to erase based on the `difficulty`:
   - Easy: Remove ~30 numbers.
   - Medium: Remove ~40 numbers.
   - Hard: Remove ~50 numbers.
5. **The Digging Loop:** While we still need to remove more numbers (and haven't tried too many times):
   - Pick a random row and column.
   - If the cell is not already empty:
     - Save the current number as a backup.
     - Set the cell to 0 (dig the hole).
     - Call `countSolutions` on a copy of the grid.
     - If `countSolutions` does NOT equal 1 (meaning 2+ solutions exist):
       - The hole broke the puzzle! Put the `backup` number back into the cell.
     - Otherwise, the hole is safe. Decrement the "clues to remove" counter.
6. Return the final `{ grid, solution, difficulty }` object.
