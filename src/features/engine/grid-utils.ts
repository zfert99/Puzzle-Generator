import type { GridConfig } from './sudoku';

/**
 * Creates an empty NxN Sudoku grid filled with 0s.
 * 0 is used throughout the engine to represent an empty cell.
 */
export function createEmptyGrid(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

/**
 * Creates a deep copy of a 2D grid.
 * Essential when we want to test removing numbers without destroying the original array.
 */
export function copyGrid(grid: number[][]): number[][] {
  return grid.map(row => [...row]);
}

/**
 * Checks if placing `num` at `grid[row][col]` is valid according to Sudoku rules.
 * This does NOT mean `num` is the correct final answer, just that it doesn't currently
 * conflict with any existing numbers in its row, column, or subgrid.
 */
export function isValid(grid: number[][], row: number, col: number, num: number, config: GridConfig): boolean {
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
export function shuffle(array: number[]): number[] {
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
export function fillGrid(grid: number[][], config: GridConfig): boolean {
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
