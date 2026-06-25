import { HumanSolver, canHumanSolveExtreme } from './human-solver';

// The five possible difficulty levels supported by the engine
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'extreme';

// Defines the structure of a generated puzzle
export interface SudokuPuzzle {
  grid: number[][]; // 9x9 array representing the unsolved puzzle (0 means empty)
  solution: number[][]; // 9x9 array representing the fully solved puzzle
  difficulty: Difficulty; // The requested difficulty level
}

/**
 * Creates an empty 9x9 Sudoku grid filled with 0s.
 * 0 is used throughout the engine to represent an empty cell.
 */
function createEmptyGrid(): number[][] {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

/**
 * Creates a deep copy of a 2D grid.
 * Essential when we want to test removing numbers without destroying the original array.
 */
function copyGrid(grid: number[][]): number[][] {
  return grid.map(row => [...row]);
}

/**
 * Checks if placing `num` at `grid[row][col]` is valid according to Sudoku rules.
 * This does NOT mean `num` is the correct final answer, just that it doesn't currently
 * conflict with any existing numbers in its row, column, or 3x3 subgrid.
 */
function isValid(grid: number[][], row: number, col: number, num: number): boolean {
  // Check row and column simultaneously for repetition of the number
  for (let x = 0; x < 9; x++) {
    if (grid[row][x] === num) return false;
    if (grid[x][col] === num) return false;
  }
  
  // Calculate the top-left corner of the 3x3 subgrid that this cell belongs to
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  
  // Check the 3x3 subgrid for repetition of the number
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (grid[startRow + i][startCol + j] === num) return false;
    }
  }
  
  // If no conflicts were found, it's a valid placement
  return true;
}

/**
 * Shuffles an array in place using the modern Fisher-Yates algorithm.
 * Used to randomize the order in which we test numbers (1-9) or dig cells,
 * ensuring every generated puzzle is completely unique.
 */
function shuffle(array: number[]): number[] {
  // Iterate backwards from the last element to the second element
  for (let i = array.length - 1; i > 0; i--) {
    // Generate a random index j between 0 and i (inclusive)
    const j = Math.floor(Math.random() * (i + 1));
    // Swap the elements at indices i and j
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Uses a backtracking algorithm to generate a fully solved, valid Sudoku grid.
 * It randomly tries numbers in empty cells and backtracks when it hits a dead end.
 * Modifies the `grid` argument in place.
 */
function fillGrid(grid: number[][]): boolean {
  // Iterate through all 81 cells in the 9x9 grid using a flat index (0-80)
  for (let i = 0; i < 81; i++) {
    // Convert the flat index into 2D row and column coordinates
    const row = Math.floor(i / 9);
    const col = i % 9;
    
    // If the cell is empty, try to fill it
    if (grid[row][col] === 0) {
      // Shuffle the numbers 1-9 to ensure the generated solution is completely random
      const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      
      // Try placing each number
      for (const num of numbers) {
        if (isValid(grid, row, col, num)) {
          // Place the number tentatively
          grid[row][col] = num;
          
          // Recursively attempt to fill the rest of the grid.
          // If the recursive call returns true, it means the grid was successfully filled.
          if (fillGrid(grid)) return true;
          
          // BACKTRACK: If the recursive call returned false, this placement led to a dead end.
          // Reset the cell to 0 and try the next number in the shuffled list.
          grid[row][col] = 0;
        }
      }
      // If we've tried all 9 numbers and none led to a valid full grid, this branch is a dead end
      return false;
    }
  }
  // If we loop through all 81 cells without finding a 0, the grid is completely filled
  return true;
}

/**
 * Counts how many valid solutions exist for a given partially-filled grid.
 * Used to ensure our generated puzzles have EXACTLY ONE unique solution.
 * We set a limit (default 2) because we only care if it has 1 solution or >1 solution.
 * Continuing to count past 2 would be a massive waste of CPU.
 */
function countSolutions(grid: number[][], limit = 2): number {
  let count = 0;
  
  // Inner recursive solver
  function solve(g: number[][]) {
    // Optimization: Stop immediately if we've already found more solutions than our limit
    if (count >= limit) return;
    
    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      
      if (g[row][col] === 0) {
        // Try each number 1-9 in standard order (randomness isn't needed for counting)
        for (let num = 1; num <= 9; num++) {
          if (isValid(g, row, col, num)) {
            g[row][col] = num; // Tentative placement
            solve(g);          // Recurse deeper
            g[row][col] = 0;   // Backtrack
          }
        }
        // After trying all 9 numbers, if we reach this point, we must backtrack
        return;
      }
    }
    // If we make it through all 81 cells without finding a 0, we found a valid solution!
    count++;
  }
  
  // Kick off the recursion
  solve(grid);
  return count;
}

/**
 * Main entry point for generating a puzzle of a specific difficulty.
 * The process:
 * 1. Generate a complete, valid Sudoku solution.
 * 2. Dig holes (replace numbers with 0s) while ensuring the puzzle remains uniquely solvable.
 * 3. Use different digging strategies based on difficulty.
 */
export function generateSudoku(difficulty: Difficulty): SudokuPuzzle {
  // Step 1: Create an empty grid
  const solution = createEmptyGrid();
  
  // Step 2: Use backtracking to fill the grid with a random, valid solution
  fillGrid(solution);

  // Step 3: Create a copy of the solution that we will "dig" holes into to create the puzzle
  const grid = copyGrid(solution);

  // Step 4: Apply the appropriate digging strategy based on requested difficulty
  if (difficulty === 'extreme') {
    // Extreme puzzles require the most advanced strategies (W-Wing, ALS, AICs)
    applyExtremeDigger(grid, solution);
  } else if (difficulty === 'expert') {
    // Expert puzzles use logical deduction to guarantee they require advanced strategies
    applyExhaustiveDigger(grid);
  } else {
    // Easier puzzles just remove a set number of clues while maintaining a unique solution
    applyQuotaDigger(grid, difficulty);
  }

  // Return the complete package
  return { grid, solution, difficulty };
}

/**
 * Expert Digger:
 * Tries to remove AS MANY CLUES AS POSSIBLE while guaranteeing the puzzle can still be solved
 * by a human using pure logic (without guessing).
 * It achieves this by utilizing the `HumanSolver`.
 */
function applyExhaustiveDigger(grid: number[][]): void {
  // Create an array of all 81 positions and shuffle it
  const positions = shuffle(Array.from({ length: 81 }, (_, i) => i));
  
  // Attempt to "dig" (remove) the number at each position one by one
  for (const pos of positions) {
    const row = Math.floor(pos / 9);
    const col = pos % 9;

    // Backup the value in case removing it breaks the puzzle
    const backup = grid[row][col];
    if (backup === 0) continue; // Already empty (shouldn't happen here, but safe)
    
    // Tentatively remove the clue
    grid[row][col] = 0;

    // Verify a human can solve the resulting puzzle without guessing.
    // We use `HumanSolver` instead of `countSolutions` because `countSolutions` uses brute-force backtracking
    // and would successfully solve puzzles that require guessing. We want to guarantee it's logically solvable.
    // Additionally, because `HumanSolver` relies purely on logic, if it can solve the puzzle,
    // the puzzle is inherently guaranteed to have a UNIQUE solution.
    const solver = new HumanSolver(copyGrid(grid));
    const res = solver.solve();
    
    // If the HumanSolver gets stuck (requires guessing or unprogrammed strategies),
    // we put the clue back and move on to the next position.
    if (!res.solved) {
      grid[row][col] = backup;
    }
  }
}

/**
 * Standard Digger (Easy/Medium/Hard):
 * Removes a specific number of clues from the grid to hit a target difficulty.
 * Uses brute-force uniqueness checking (`countSolutions`) rather than logical deduction,
 * because we aren't trying to force advanced logical techniques, we just want a specific clue density.
 */
function applyQuotaDigger(grid: number[][], difficulty: Difficulty): void {
  // Target how many clues we want to REMOVE to achieve the difficulty
  // Note: A full grid has 81 clues.
  let cluesToRemove = 40; // Easy: removes 40 (leaves 41)
  if (difficulty === 'medium') cluesToRemove = 50; // Medium: removes 50 (leaves 31)
  if (difficulty === 'hard') cluesToRemove = 55;   // Hard: removes 55 (leaves 26)

  // Fail-safe to prevent infinite loops if we get a grid layout where it's 
  // mathematically difficult to reach the target quota while maintaining uniqueness
  let attempts = 0;

  // Keep digging until we've removed enough clues OR we've failed 100 times
  while (cluesToRemove > 0 && attempts < 100) {
    // Pick a completely random cell
    let row = Math.floor(Math.random() * 9);
    let col = Math.floor(Math.random() * 9);
    
    // If the cell is already empty, keep picking until we hit a filled one
    while (grid[row][col] === 0) {
      row = Math.floor(Math.random() * 9);
      col = Math.floor(Math.random() * 9);
    }

    // Backup the value
    const backup = grid[row][col];
    
    // Tentatively remove the clue
    grid[row][col] = 0;

    // Check if the puzzle still has exactly ONE unique solution
    const copy = copyGrid(grid);
    if (countSolutions(copy) !== 1) {
      // Removing this clue created multiple valid solutions.
      // Put the clue back and log a failed attempt.
      grid[row][col] = backup;
      attempts++;
    } else {
      // Removing this clue kept the puzzle unique!
      // Decrement our remaining quota and continue.
      cluesToRemove--;
    }
  }
}

/**
 * Extreme Digger:
 * Generates puzzles that require extreme strategies (W-Wing, ALS-XZ, AICs) to solve.
 * Uses the same exhaustive digging approach as the expert digger, but then validates
 * that the resulting puzzle actually REQUIRES extreme strategies. If the puzzle can be
 * solved with only expert-level strategies, the entire process is retried with a fresh
 * solution grid.
 */
function applyExtremeDigger(grid: number[][], solution: number[][]): void {
  const MAX_RETRIES = 50;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // On retry, generate a completely new solution and start fresh
    if (attempt > 0) {
      const newSolution = createEmptyGrid();
      fillGrid(newSolution);
      // Copy the new solution into both the grid and solution arrays
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          grid[r][c] = newSolution[r][c];
          solution[r][c] = newSolution[r][c];
        }
      }
    }

    // Step 1: Exhaustively dig holes (same logic as expert digger)
    const positions = shuffle(Array.from({ length: 81 }, (_, i) => i));
    for (const pos of positions) {
      const row = Math.floor(pos / 9);
      const col = pos % 9;
      const backup = grid[row][col];
      if (backup === 0) continue;

      grid[row][col] = 0;

      // Verify the puzzle is still solvable by the full solver (including extreme strategies)
      const solver = new HumanSolver(copyGrid(grid));
      const res = solver.solve();

      if (!res.solved) {
        grid[row][col] = backup;
      }
    }

    // Step 2: Validate that the puzzle actually REQUIRES extreme strategies
    if (canHumanSolveExtreme(copyGrid(grid))) {
      return; // Success! The puzzle requires extreme strategies.
    }

    // If it didn't require extreme strategies, retry with a new grid
  }

  // If we exhausted all retries, keep the last puzzle even if it's only expert-level.
  // This is a graceful degradation — the puzzle is still valid and logically solvable.
}
