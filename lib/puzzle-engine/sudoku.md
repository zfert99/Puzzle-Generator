# Sudoku Engine: Plain English Pseudocode

This document explains the core logic behind our `sudoku.ts` puzzle engine. It breaks down the TypeScript syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Data Structures (The Blueprints)

**Difficulty Levels:**
We define exactly five allowed difficulty levels: 'easy', 'medium', 'hard', 'expert', or 'extreme'.

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
4. **Subgrid Check:**
   - Calculate the starting corner: `startRow = Math.floor(row / 3) * 3` and `startCol = Math.floor(col / 3) * 3`.
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

## 4. The Master Function & Diggers

### `generateSudoku(difficulty)`

**Goal:** Act as the "traffic cop" to prepare the puzzle and delegate to the right digging strategy.
**Steps:**

1. Create a blank 9x9 grid filled with 0s.
2. Call `fillGrid` to completely solve it with random numbers.
3. Save a copy of this full grid as the `solution`.
4. If `difficulty` is 'extreme', call `applyExtremeDigger()`.
5. If `difficulty` is 'expert', call `applyExhaustiveDigger()`.
6. Otherwise, call `applyQuotaDigger()`.
7. Return the final `{ grid, solution, difficulty }` object.

### `applyExhaustiveDigger(grid)`

**Goal:** Try to remove as many clues as possible for the Expert difficulty.
**Steps:**

1. Shuffle a list of all 81 positions on the board.
2. Loop through every position exactly once:
   - Save the current number as a backup.
   - Set the cell to 0 (dig the hole).
   - Pass the grid to the `HumanSolver` with `{ maxTier: 'advanced' }` (skipping extreme strategies). If it can solve the puzzle purely through logical deduction, the hole is valid — uniqueness is guaranteed because logical strategies never "guess" between ambiguous solutions.
   - If the human solver cannot solve it (meaning it requires guessing, has multiple solutions, or needs extreme/unprogrammed strategies), put the `backup` number back into the cell.
   - (No attempts counter is used; it aggressively checks every single cell to ensure a minimal, human-solvable expert puzzle).

### `applyQuotaDigger(grid, difficulty)`

**Goal:** Remove a specific quota of clues for Easy, Medium, or Hard difficulties.
**Steps:**

1. Determine how many numbers to erase based on the `difficulty`:
   - Easy: Remove 40 clues.
   - Medium: Remove 50 clues.
   - Hard: Remove 56 clues.
2. While we still need to remove more numbers (and haven't tried too many times):
   - Pick a random row and column.
   - If the cell is not already empty:
     - Save the current number as a backup.
     - Set the cell to 0 (dig the hole).
     - Call `countSolutions` on a copy of the grid.
     - If `countSolutions` does NOT equal 1:
       - The hole broke the puzzle! Put the `backup` number back into the cell.
     - Otherwise, the hole is safe. Decrement the "clues to remove" counter.

### `applyExtremeDigger(grid, solution)`

**Goal:** Generate a puzzle that requires extreme strategies (W-Wing, ALS-XZ, AICs) to solve.
**Steps:**

1. Set a maximum retry count (50 attempts).
2. For each attempt:
   - If this is a retry (attempt > 0), generate a completely new solution grid and copy it into both the `grid` and `solution` arrays.
   - Run the same exhaustive digging logic as `applyExhaustiveDigger` — try to remove every clue, keeping the hole only if the `HumanSolver` (with extreme strategies enabled) can still solve the puzzle.
   - After digging, validate that the resulting puzzle actually REQUIRES extreme strategies by calling `canHumanSolveExtreme()`.
   - If it does, return immediately (success).
   - If not (the puzzle was solvable with only expert-level techniques), retry with a fresh grid.
3. If all retries are exhausted, keep the last puzzle as a graceful degradation.
