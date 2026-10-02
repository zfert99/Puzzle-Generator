import { generateSudoku, SUDOKU_BUDGET_ERROR, SudokuPuzzle, GridSize, Difficulty } from '../sudoku';

/**
 * Service function to generate a single playable puzzle. Backs the interactive
 * board's `/api/puzzle` route so the heavy generator stays server-side (out of the
 * client bundle and off the browser's main thread). Returns the puzzle and its
 * solution so the client can drive optional real-time error checking.
 */
export function generateSinglePuzzle(difficulty: Difficulty, gridSize: GridSize = 9): SudokuPuzzle {
  return generateSudoku(difficulty, gridSize);
}

export interface GenerationRequest {
  easy?: number;
  medium?: number;
  hard?: number;
  expert?: number;
  extreme?: number;
  gridSize?: GridSize;
}

/**
 * Service function to synchronously generate a batch of Sudoku puzzles
 * based on the requested difficulties and grid size.
 *
 * @param options.timeBudgetMs One wall-clock budget for the WHOLE batch (default: none). Each
 *   puzzle is handed what is left of it, and the batch throws an error named
 *   `SUDOKU_BUDGET_ERROR` (see `isSudokuBudgetError`) once it is spent — so a route can return a
 *   clean "request too large" instead of hitting its own function timeout half-way through.
 */
export function generatePuzzleBatch(request: GenerationRequest, options: { timeBudgetMs?: number } = {}): SudokuPuzzle[] {
  const { easy = 0, medium = 0, hard = 0, expert = 0, extreme = 0, gridSize = 9 } = request;
  const size = gridSize as GridSize;
  const ladder: readonly [Difficulty, number][] = [
    ['easy', easy], ['medium', medium], ['hard', hard], ['expert', expert], ['extreme', extreme],
  ];
  const started = performance.now();
  const puzzles: SudokuPuzzle[] = [];

  for (const [difficulty, count] of ladder) {
    for (let i = 0; i < count; i++) {
      if (options.timeBudgetMs === undefined) {
        puzzles.push(generateSudoku(difficulty, size));
        continue;
      }
      const remaining = options.timeBudgetMs - (performance.now() - started);
      if (remaining <= 0) {
        throw Object.assign(new Error(`Sudoku batch ran out of time after ${puzzles.length} puzzles (${options.timeBudgetMs} ms budget)`), { name: SUDOKU_BUDGET_ERROR });
      }
      puzzles.push(generateSudoku(difficulty, size, Math.random, { timeBudgetMs: remaining }));
    }
  }

  return puzzles;
}
