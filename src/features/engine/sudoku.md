# Sudoku Engine: Plain English Pseudocode

This document explains the core logic behind our `sudoku.ts` puzzle engine. It breaks down the TypeScript syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Data Structures (The Blueprints)

**Difficulty Levels:**
We define exactly five allowed difficulty levels: 'easy', 'medium', 'hard', 'expert', or 'extreme'.

**Grid Size:**
We support three grid sizes: 4, 6, or 9. Each maps to a `GridConfig`:

| Size | Box Width | Box Height | Total Cells | Digits |
| :---: | :---: | :---: | :---: | :---: |
| 4 | 2 | 2 | 16 | 1-4 |
| 6 | 3 | 2 | 36 | 1-6 |
| 9 | 3 | 3 | 81 | 1-9 |

**Sudoku Puzzle Object:**
When the engine finishes, it hands back a package containing:

- `grid`: The playable NxN board (with holes dug, represented by 0s).
- `solution`: The completed NxN board (the answer key).
- `difficulty`: The requested difficulty level.
- `gridSize`: The size of the grid (4, 6, or 9).

---

## 2. Core Helper Functions

### `getGridConfig(size)`

**Goal:** Return the configuration (boxWidth, boxHeight, totalCells, maxNum) for a given grid size.

### `isValid(grid, row, col, number, config)`

**Goal:** Check if placing a specific number in a specific cell breaks any Sudoku rules.
**Steps:**

1. Loop `size` times (index `i` from 0 to size-1).
2. **Row Check:** If the `grid` at `[row][i]` equals the `number`, return FALSE.
3. **Column Check:** If the `grid` at `[i][col]` equals the `number`, return FALSE.
4. **Subgrid Check:**
   - Calculate the starting corner using `boxHeight` and `boxWidth`.
   - Loop through all cells in the box. If any equals the `number`, return FALSE.
5. If no rules are broken, return TRUE.

### `shuffle(array)`

**Goal:** Randomize an array of numbers using the Fisher-Yates algorithm.
**Steps:**

1. Start at the end of the array and work backwards to the beginning.
2. Pick a random index between 0 and the current position.
3. Swap the number at the current position with the number at the random index.
4. Move one step left and repeat until the whole array is shuffled.

---

## 3. The Generators & Solvers

### `fillGrid(grid, config)`

**Goal:** Fill a completely blank NxN grid with valid, random numbers (Recursive Backtracking).
**Steps:**

1. Loop through all `totalCells` cells.
2. Calculate the 2D coordinates: `row = Math.floor(i / size)` and `col = i % size`.
3. If the cell at `[row][col]` is empty (equals 0):
   - Shuffle an array of numbers [1 through maxNum].
   - Loop through each shuffled number:
     - If `isValid(number)` is TRUE:
       - Place the number in the cell.
       - **RECURSE:** Call `fillGrid(grid, config)` again to try and fill the next empty cell.
       - If the recursion eventually returns TRUE, it means the board is full! Return TRUE.
       - **BACKTRACK:** If the recursion returns FALSE (dead end), reset the cell to 0 and try the next number.
   - If we tried all numbers and none worked, return FALSE (tell the previous step to backtrack).
4. If the loop finishes checking all cells and finds no empty ones, return TRUE (Puzzle solved!).

### `countSolutions(grid, config)`

**Goal:** Prove a puzzle has exactly one valid solution.
**Steps:**

1. Keep a `count` variable starting at 0.
2. Define a recursive `solve` function (almost identical to `fillGrid`).
   - If `count` is 2 or more, STOP immediately (the puzzle is broken).
   - Loop through all `totalCells` cells looking for a 0.
   - Try numbers 1 through maxNum. If valid, place it and recurse.
   - **Crucial Difference:** When the board is full, do NOT return true. Instead, increment `count` by 1 and return nothing. This forces the function to step back, erase the last number, and keep looking for alternative paths.
3. Call `solve(grid)`.
4. Return the final `count` (1 means perfect, 2 means broken).

---

## 4. The Master Function & Diggers

### `generateSudoku(difficulty, gridSize = 9)`

**Goal:** Act as the "traffic cop" to prepare the puzzle and delegate to the right digging strategy.
**Steps:**

1. Get the `GridConfig` for the requested `gridSize`.
2. Create a blank NxN grid filled with 0s.
3. Call `fillGrid` to completely solve it with random numbers.
4. Save a copy of this full grid as the `solution`.
5. If `difficulty` is 'extreme' AND `gridSize` is 9, call `applyExtremeDigger()`.
6. If `difficulty` is 'expert' AND `gridSize` is 9, call `applyExhaustiveDigger()`.
7. Otherwise, call `applyQuotaDigger()`.
8. Return the final `{ grid, solution, difficulty, gridSize }` object.

### `applyExhaustiveDigger(grid, config)`

**Goal:** Try to remove as many clues as possible for the Expert difficulty.
**Steps:**

1. Shuffle a list of all `totalCells` positions on the board.
2. Loop through every position exactly once:
   - Save the current number as a backup.
   - Set the cell to 0 (dig the hole).
   - Pass the grid to the `HumanSolver` with `{ maxTier: 'advanced' }`. If it can solve the puzzle purely through logical deduction, the hole is valid.
   - If the human solver cannot solve it, put the `backup` number back.

### `applyQuotaDigger(grid, difficulty, config)`

**Goal:** Remove a specific quota of clues based on grid size and difficulty.
**Clue Removal Quotas:**

| Size | Easy | Medium | Hard |
| :---: | :---: | :---: | :---: |
| 4x4 | 7 | 10 | 12 |
| 6x6 | 16 | 20 | 26 |
| 9x9 | 40 | 50 | 55 |

**Steps:**

1. Look up how many clues to remove from the quota table.
2. While we still need to remove more numbers (and haven't tried too many times):
   - Pick a random row and column.
   - If the cell is not already empty:
     - Save the current number as a backup.
     - Set the cell to 0 (dig the hole).
     - Call `countSolutions` on a copy of the grid.
     - If `countSolutions` does NOT equal 1: put the `backup` number back.
     - Otherwise, the hole is safe. Decrement the counter.

### `applyExtremeDigger(grid, solution, config)`

**Goal:** Generate a puzzle that requires extreme strategies (W-Wing, ALS-XZ, AICs) to solve. Only used for 9x9 grids.
**Steps:**

1. Set a maximum retry count (50 attempts).
2. For each attempt:
   - If this is a retry, generate a completely new solution grid.
   - Run the same exhaustive digging logic as `applyExhaustiveDigger`.
   - Validate that the resulting puzzle actually REQUIRES extreme strategies by calling `canHumanSolveExtreme()`.
   - If it does, return immediately (success).
   - If not, retry with a fresh grid.
3. If all retries are exhausted, keep the last puzzle as a graceful degradation.
