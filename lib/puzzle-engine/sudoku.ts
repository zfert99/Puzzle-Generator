import { HumanSolver, canHumanSolveExtreme } from './human-solver';

// The five possible difficulty levels supported by the engine
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'extreme';

// Supported grid sizes for puzzle generation
export type GridSize = 4 | 6 | 9;

// Configuration derived from a grid size — box dimensions and total cells
export interface GridConfig {
  size: GridSize;
  boxWidth: number;   // How many columns per box
  boxHeight: number;  // How many rows per box
  totalCells: number; // size * size
  maxNum: number;     // Digits range from 1..maxNum (same as size)
}

/**
 * Returns the grid configuration for a given grid size.
 * Box dimensions:
 *   4x4 → 2 cols × 2 rows
 *   6x6 → 3 cols × 2 rows
 *   9x9 → 3 cols × 3 rows
 */
export function getGridConfig(size: GridSize): GridConfig {
  const configs: Record<GridSize, GridConfig> = {
    4: { size: 4, boxWidth: 2, boxHeight: 2, totalCells: 16, maxNum: 4 },
    6: { size: 6, boxWidth: 3, boxHeight: 2, totalCells: 36, maxNum: 6 },
    9: { size: 9, boxWidth: 3, boxHeight: 3, totalCells: 81, maxNum: 9 },
  };
  return configs[size];
}

// Defines the structure of a generated puzzle
export interface SudokuPuzzle {
  grid: number[][];       // NxN array representing the unsolved puzzle (0 means empty)
  solution: number[][];   // NxN array representing the fully solved puzzle
  difficulty: Difficulty;  // The requested difficulty level
  gridSize: GridSize;      // The size of the grid (4, 6, or 9)
}

/**
 * Creates an empty NxN Sudoku grid filled with 0s.
 * 0 is used throughout the engine to represent an empty cell.
 */
function createEmptyGrid(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0));
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
 * conflict with any existing numbers in its row, column, or subgrid.
 */
function isValid(grid: number[][], row: number, col: number, num: number, config: GridConfig): boolean {
  const { size, boxWidth, boxHeight } = config;

  // Check row and column simultaneously for repetition of the number
  for (let x = 0; x < size; x++) {
    if (grid[row][x] === num) return false;
    if (grid[x][col] === num) return false;
  }
  
  // Calculate the top-left corner of the subgrid that this cell belongs to
  const startRow = Math.floor(row / boxHeight) * boxHeight;
  const startCol = Math.floor(col / boxWidth) * boxWidth;
  
  // Check the subgrid for repetition of the number
  for (let i = 0; i < boxHeight; i++) {
    for (let j = 0; j < boxWidth; j++) {
      if (grid[startRow + i][startCol + j] === num) return false;
    }
  }
  
  // If no conflicts were found, it's a valid placement
  return true;
}

/**
 * Shuffles an array in place using the modern Fisher-Yates algorithm.
 * Used to randomize the order in which we test numbers (1-N) or dig cells,
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
function fillGrid(grid: number[][], config: GridConfig): boolean {
  const { size, totalCells, maxNum } = config;

  // Iterate through all cells in the NxN grid using a flat index
  for (let i = 0; i < totalCells; i++) {
    // Convert the flat index into 2D row and column coordinates
    const row = Math.floor(i / size);
    const col = i % size;
    
    // If the cell is empty, try to fill it
    if (grid[row][col] === 0) {
      // Shuffle the numbers 1-N to ensure the generated solution is completely random
      const numbers = shuffle(Array.from({ length: maxNum }, (_, k) => k + 1));
      
      // Try placing each number
      for (const num of numbers) {
        if (isValid(grid, row, col, num, config)) {
          // Place the number tentatively
          grid[row][col] = num;
          
          // Recursively attempt to fill the rest of the grid.
          // If the recursive call returns true, it means the grid was successfully filled.
          if (fillGrid(grid, config)) return true;
          
          // BACKTRACK: If the recursive call returned false, this placement led to a dead end.
          // Reset the cell to 0 and try the next number in the shuffled list.
          grid[row][col] = 0;
        }
      }
      // If we've tried all numbers and none led to a valid full grid, this branch is a dead end
      return false;
    }
  }
  // If we loop through all cells without finding a 0, the grid is completely filled
  return true;
}

/**
 * Counts how many valid solutions exist for a given partially-filled grid.
 * Used to ensure our generated puzzles have EXACTLY ONE unique solution.
 * We set a limit (default 2) because we only care if it has 1 solution or >1 solution.
 * Continuing to count past 2 would be a massive waste of CPU.
 */
function countSolutions(grid: number[][], config: GridConfig, limit = 2): number {
  const { size, totalCells, maxNum } = config;
  let count = 0;
  
  // Inner recursive solver
  function solve(g: number[][]) {
    // Optimization: Stop immediately if we've already found more solutions than our limit
    if (count >= limit) return;
    
    for (let i = 0; i < totalCells; i++) {
      const row = Math.floor(i / size);
      const col = i % size;
      
      if (g[row][col] === 0) {
        // Try each number 1-N in standard order (randomness isn't needed for counting)
        for (let num = 1; num <= maxNum; num++) {
          if (isValid(g, row, col, num, config)) {
            g[row][col] = num; // Tentative placement
            solve(g);          // Recurse deeper
            g[row][col] = 0;   // Backtrack
          }
        }
        // After trying all numbers, if we reach this point, we must backtrack
        return;
      }
    }
    // If we make it through all cells without finding a 0, we found a valid solution!
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
export function generateSudoku(difficulty: Difficulty, gridSize: GridSize = 9): SudokuPuzzle {
  const config = getGridConfig(gridSize);

  // Step 1: Create an empty grid
  const solution = createEmptyGrid(config.size);
  
  // Step 2: Use backtracking to fill the grid with a random, valid solution
  fillGrid(solution, config);

  // Step 3: Create a copy of the solution that we will "dig" holes into to create the puzzle
  const grid = copyGrid(solution);

  // Step 4: Apply the appropriate digging strategy based on requested difficulty
  if (difficulty === 'extreme' && gridSize === 9) {
    // Extreme puzzles require the most advanced strategies (W-Wing, ALS, AICs)
    // Only supported on 9x9 grids
    applyExtremeDigger(grid, solution, config);
  } else if (difficulty === 'expert' && gridSize === 9) {
    // Expert puzzles use logical deduction to guarantee they require advanced strategies
    // Only supported on 9x9 grids
    applyExhaustiveDigger(grid, config);
  } else {
    // Easier puzzles (and all mini puzzles) remove a set number of clues
    // while maintaining a unique solution
    applyQuotaDigger(grid, difficulty, config);
  }

  // Return the complete package
  return { grid, solution, difficulty, gridSize };
}

/**
 * Expert Digger:
 * Tries to remove AS MANY CLUES AS POSSIBLE while guaranteeing the puzzle can still be solved
 * by a human using pure logic (without guessing).
 * It achieves this by utilizing the `HumanSolver`.
 */
function applyExhaustiveDigger(grid: number[][], config: GridConfig): void {
  // Create an array of all positions and shuffle it
  const positions = shuffle(Array.from({ length: config.totalCells }, (_, i) => i));
  
  // Attempt to "dig" (remove) the number at each position one by one
  for (const pos of positions) {
    const row = Math.floor(pos / config.size);
    const col = pos % config.size;

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
    const res = solver.solve({ maxTier: 'advanced' });
    
    // If the HumanSolver gets stuck (requires guessing or unprogrammed strategies),
    // we put the clue back and move on to the next position.
    if (!res.solved) {
      grid[row][col] = backup;
    }
  }
}

/**
 * Standard Digger (Easy/Medium/Hard for all grid sizes):
 * Removes a specific number of clues from the grid to hit a target difficulty.
 * Uses brute-force uniqueness checking (`countSolutions`) rather than logical deduction,
 * because we aren't trying to force advanced logical techniques, we just want a specific clue density.
 *
 * Clue quotas (how many givens to LEAVE):
 *   4x4: Easy=9, Medium=6, Hard=4
 *   6x6: Easy=20, Medium=16, Hard=10
 *   9x9: Easy=41(removes 40), Medium=31(removes 50), Hard=26(removes 55)
 */
function applyQuotaDigger(grid: number[][], difficulty: Difficulty, config: GridConfig): void {
  const quotas: Record<GridSize, Record<string, number>> = {
    4: { easy: 7, medium: 10, hard: 12 },
    6: { easy: 16, medium: 20, hard: 26 },
    9: { easy: 40, medium: 50, hard: 55 },
  };

  // How many clues to REMOVE
  let cluesToRemove = quotas[config.size][difficulty] ?? 40;

  // Fail-safe to prevent infinite loops if we get a grid layout where it's 
  // mathematically difficult to reach the target quota while maintaining uniqueness
  let attempts = 0;

  // Keep digging until we've removed enough clues OR we've failed 100 times
  while (cluesToRemove > 0 && attempts < 100) {
    // Pick a completely random cell
    let row = Math.floor(Math.random() * config.size);
    let col = Math.floor(Math.random() * config.size);
    
    // If the cell is already empty, keep picking until we hit a filled one
    while (grid[row][col] === 0) {
      row = Math.floor(Math.random() * config.size);
      col = Math.floor(Math.random() * config.size);
    }

    // Backup the value
    const backup = grid[row][col];
    
    // Tentatively remove the clue
    grid[row][col] = 0;

    // Check if the puzzle still has exactly ONE unique solution
    const copy = copyGrid(grid);
    if (countSolutions(copy, config) !== 1) {
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
function applyExtremeDigger(grid: number[][], solution: number[][], config: GridConfig): void {
  const MAX_RETRIES = 50;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // On retry, generate a completely new solution and start fresh
    if (attempt > 0) {
      const newSolution = createEmptyGrid(config.size);
      fillGrid(newSolution, config);
      // Copy the new solution into both the grid and solution arrays
      for (let r = 0; r < config.size; r++) {
        for (let c = 0; c < config.size; c++) {
          grid[r][c] = newSolution[r][c];
          solution[r][c] = newSolution[r][c];
        }
      }
    }

    // Step 1: Exhaustively dig holes (same logic as expert digger)
    const positions = shuffle(Array.from({ length: config.totalCells }, (_, i) => i));
    for (const pos of positions) {
      const row = Math.floor(pos / config.size);
      const col = pos % config.size;
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
