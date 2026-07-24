import { createEmptyGrid, fillGrid, copyGrid } from './grid-utils';
import { applyExtremeDigger, applyExhaustiveDigger, applyQuotaDigger } from './diggers';

/**
 * The five possible difficulty levels supported by the engine
 */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'extreme';

/**
 * Supported grid sizes.
 *
 * 4/6/9 are the box-tileable Sudoku/Killer sizes; 5/7 are **boxless** (Latin-square-only)
 * sizes that only KenKen can use — a prime N has no rectangular box tiling, which is exactly
 * why box-Sudoku can't offer them and KenKen can (see `Docs/kenken-implementation-plan.md` K0
 * and the grid-size research). Widening this union does NOT auto-enable 5/7 anywhere: classic
 * and Killer surfaces keep their own narrower `4 | 6 | 9` pickers, so this only makes 5/7
 * *representable* for the KenKen work that follows.
 */
export type GridSize = 4 | 5 | 6 | 7 | 9;

/**
 * Configuration derived from a grid size — box dimensions and total cells.
 *
 * `hasBoxes` is the boxless flag: `false` for prime sizes (5, 7) that have no box constraint,
 * only rows and columns. Every consumer that draws or reasons about boxes (grid renderers,
 * `isValid`/`fillGrid`'s box mask) MUST branch on it — for a boxless grid `boxWidth`/`boxHeight`
 * are set to a harmless row-strip sentinel (`size × 1`, so an ungated reader degenerates the box
 * constraint to the row constraint it already enforces) rather than a value that would corrupt a
 * Latin square. Prefer `hasBoxes` over inspecting the sentinel.
 */
export interface GridConfig {
  size: GridSize;
  hasBoxes: boolean;  // false for boxless (Latin-square-only) sizes: 5, 7
  boxWidth: number;   // How many columns per box (row-strip sentinel = size when boxless)
  boxHeight: number;  // How many rows per box (row-strip sentinel = 1 when boxless)
  totalCells: number; // size * size
  maxNum: number;     // Digits range from 1..maxNum (same as size)
}

/**
 * Returns the grid configuration for a given grid size.
 * Box dimensions:
 *   4x4 → 2 cols × 2 rows
 *   6x6 → 3 cols × 2 rows
 *   9x9 → 3 cols × 3 rows
 *   5x5, 7x7 → boxless (Latin-square-only; `hasBoxes: false`)
 *
 * @param size The grid size to get configuration for (4, 5, 6, 7, or 9)
 * @returns The generated GridConfig
 */
export function getGridConfig(size: GridSize): GridConfig {
  const configs: Record<GridSize, GridConfig> = {
    4: { size: 4, hasBoxes: true, boxWidth: 2, boxHeight: 2, totalCells: 16, maxNum: 4 },
    5: { size: 5, hasBoxes: false, boxWidth: 5, boxHeight: 1, totalCells: 25, maxNum: 5 },
    6: { size: 6, hasBoxes: true, boxWidth: 3, boxHeight: 2, totalCells: 36, maxNum: 6 },
    7: { size: 7, hasBoxes: false, boxWidth: 7, boxHeight: 1, totalCells: 49, maxNum: 7 },
    9: { size: 9, hasBoxes: true, boxWidth: 3, boxHeight: 3, totalCells: 81, maxNum: 9 },
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
 * Main entry point for generating a puzzle of a specific difficulty and size.
 * The process:
 * 1. Generate a complete, valid Sudoku solution using backtracking.
 * 2. Dig holes (replace numbers with 0s) while ensuring the puzzle remains uniquely solvable.
 * 3. Use different digging strategies based on difficulty (quota vs logical deduction).
 * 
 * @param difficulty The requested difficulty level for the puzzle.
 * @param gridSize The dimensions of the grid (defaults to 9 for 9x9).
 * @returns A fully generated Sudoku puzzle and its solution.
 */
export function generateSudoku(difficulty: Difficulty, gridSize: GridSize = 9): SudokuPuzzle {
  const config = getGridConfig(gridSize);

  const solution = createEmptyGrid(config.size);
  fillGrid(solution, config);
  const grid = copyGrid(solution);

  // Apply the appropriate digging strategy based on requested difficulty
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

  return { grid, solution, difficulty, gridSize };
}
