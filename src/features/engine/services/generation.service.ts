import { generateSudoku, SudokuPuzzle, GridSize } from '../sudoku';

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
 */
export function generatePuzzleBatch(request: GenerationRequest): SudokuPuzzle[] {
  const { easy = 0, medium = 0, hard = 0, expert = 0, extreme = 0, gridSize = 9 } = request;
  const puzzles: SudokuPuzzle[] = [];
  const size = gridSize as GridSize;

  for (let i = 0; i < easy; i++) {
    puzzles.push(generateSudoku('easy', size));
  }

  for (let i = 0; i < medium; i++) {
    puzzles.push(generateSudoku('medium', size));
  }

  for (let i = 0; i < hard; i++) {
    puzzles.push(generateSudoku('hard', size));
  }

  for (let i = 0; i < expert; i++) {
    puzzles.push(generateSudoku('expert', size));
  }

  for (let i = 0; i < extreme; i++) {
    puzzles.push(generateSudoku('extreme', size));
  }

  return puzzles;
}
