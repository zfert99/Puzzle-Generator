export type Difficulty = 'easy' | 'medium' | 'hard';

export interface SudokuPuzzle {
  grid: number[][]; // 9x9, 0 represents empty
  solution: number[][];
  difficulty: Difficulty;
}

// Helper to create empty 9x9 grid
function createEmptyGrid(): number[][] {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

// Deep copy a grid
function copyGrid(grid: number[][]): number[][] {
  return grid.map(row => [...row]);
}

// Check if placing num at grid[row][col] is valid
function isValid(grid: number[][], row: number, col: number, num: number): boolean {
  for (let x = 0; x < 9; x++) {
    if (grid[row][x] === num) return false;
    if (grid[x][col] === num) return false;
  }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (grid[startRow + i][startCol + j] === num) return false;
    }
  }
  return true;
}

// Shuffle array
function shuffle(array: number[]): number[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Generate a full valid Sudoku grid
function fillGrid(grid: number[][]): boolean {
  for (let i = 0; i < 81; i++) {
    const row = Math.floor(i / 9);
    const col = i % 9;
    if (grid[row][col] === 0) {
      const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const num of numbers) {
        if (isValid(grid, row, col, num)) {
          grid[row][col] = num;
          if (fillGrid(grid)) return true;
          grid[row][col] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

// Count solutions to check for uniqueness
function countSolutions(grid: number[][], limit = 2): number {
  let count = 0;
  function solve(g: number[][]) {
    if (count >= limit) return;
    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      if (g[row][col] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(g, row, col, num)) {
            g[row][col] = num;
            solve(g);
            g[row][col] = 0;
          }
        }
        return;
      }
    }
    count++;
  }
  solve(grid);
  return count;
}

export function generateSudoku(difficulty: Difficulty): SudokuPuzzle {
  const solution = createEmptyGrid();
  fillGrid(solution);

  const grid = copyGrid(solution);
  let attempts = 0;
  
  // Basic difficulty heuristic by number of clues to remove
  // Easy: ~40 clues remaining (remove ~41)
  // Medium: ~30 clues remaining (remove ~51)
  // Hard: ~24 clues remaining (remove ~57)
  let cluesToRemove = 40;
  if (difficulty === 'medium') cluesToRemove = 50;
  if (difficulty === 'hard') cluesToRemove = 56;

  while (cluesToRemove > 0 && attempts < 100) {
    let row = Math.floor(Math.random() * 9);
    let col = Math.floor(Math.random() * 9);
    while (grid[row][col] === 0) {
      row = Math.floor(Math.random() * 9);
      col = Math.floor(Math.random() * 9);
    }

    const backup = grid[row][col];
    grid[row][col] = 0;

    const copy = copyGrid(grid);
    if (countSolutions(copy) !== 1) {
      grid[row][col] = backup;
      attempts++;
    } else {
      cluesToRemove--;
    }
  }

  return { grid, solution, difficulty };
}
