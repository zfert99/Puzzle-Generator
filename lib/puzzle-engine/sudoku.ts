export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

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
  // Check row and column for repetition of the number
  for (let x = 0; x < 9; x++) {
    if (grid[row][x] === num) return false;
    if (grid[x][col] === num) return false;
  }
  // Find the 3x3 subgrid for the given row and col
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  // Check 3x3 subgrid for repetition of the number
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      // If the number is found in the 3x3 subgrid, return false
      if (grid[startRow + i][startCol + j] === num) return false;
    }
  }
  // Return true if the number is valid 
  return true;
}

// Shuffle array using Fisher-Yates algorithm
function shuffle(array: number[]): number[] {
  // Iterate through the array starting at the last element and ending at the second element
  for (let i = array.length - 1; i > 0; i--) {
    // Generate a random index j less than or equal to i
    const j = Math.floor(Math.random() * (i + 1));
    // Swap the elements at indices i and j
    [array[i], array[j]] = [array[j], array[i]];
  }
  // Return the shuffled array
  return array;
}

// Generate a full valid Sudoku grid
function fillGrid(grid: number[][]): boolean {
  // Iterate through all the cells in the grid
  for (let i = 0; i < 81; i++) {
    // Calculate the row and column from the index
    const row = Math.floor(i / 9);
    const col = i % 9;
    // If the cell is empty, try to fill it
    if (grid[row][col] === 0) {
      // Shuffle the numbers 1-9 to ensure randomness
      const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      // Try each number in the shuffled list
      for (const num of numbers) {
        if (isValid(grid, row, col, num)) {
          // Place the number in the cell 
          grid[row][col] = num;
          // Recursively call fillGrid to fill the next empty cell
          if (fillGrid(grid)) return true;
          // Backtrack: if the recursive call returns false, reset the cell to 0
          grid[row][col] = 0;
        }
      }
      // If no number can be placed in the current cell, return false
      return false;
    }
  }
  // If all cells are filled, return true
  return true;
}

// Count solutions to check for uniqueness
function countSolutions(grid: number[][], limit = 2): number {
  let count = 0;
  // Recursive function to count solutions
  function solve(g: number[][]) {
    // If the count is already greater than or equal to the limit, return
    if (count >= limit) return;
    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      // If the cell is empty, try to fill it
      if (g[row][col] === 0) {
        // Try each number from 1 to 9
        for (let num = 1; num <= 9; num++) {
          // If the number is valid, place it in the cell
          if (isValid(g, row, col, num)) {
            // Place the number in the cell
            g[row][col] = num;
            // Recursively call solve to fill the next empty cell
            solve(g);
            // Backtrack: if the recursive call returns false, reset the cell to 0
            g[row][col] = 0;
          }
        }
        // If no number can be placed in the current cell, return false
        return;
      }
    }
    // Increment the solution count
    count++;
  }
  // Call the solve function to count solutions 
  solve(grid);
  // Return the number of solutions 
  return count;
}

export function generateSudoku(difficulty: Difficulty): SudokuPuzzle {
  // Create an empty grid 
  const solution = createEmptyGrid();
  // Fill the grid with a valid Sudoku solution
  fillGrid(solution);

  // Create a copy of the solution to be used as the puzzle grid
  const grid = copyGrid(solution);

  if (difficulty === 'expert') {
    applyExhaustiveDigger(grid);
  } else {
    applyQuotaDigger(grid, difficulty);
  }

  // Return the puzzle and solution as a SudokuPuzzle object
  return { grid, solution, difficulty };
}

// Helper Function for Expert
function applyExhaustiveDigger(grid: number[][]): void {
  // get all the positions in the grid
  const positions = shuffle(Array.from({ length: 81 }, (_, i) => i));
  // loop through each position
  for (const pos of positions) {
    const row = Math.floor(pos / 9);
    const col = pos % 9;

    // Store the value of the cell
    const backup = grid[row][col];
    // If the cell is empty, continue
    if (backup === 0) continue;
    // Remove the value from the cell
    grid[row][col] = 0;
    // Check if the puzzle still has a unique solution
    const copy = copyGrid(grid);
    if (countSolutions(copy) !== 1) {
      // If not unique, put it back
      grid[row][col] = backup;
    }
  }
}

// Helper Function for Easy/Med/Hard
function applyQuotaDigger(grid: number[][], difficulty: Difficulty): void {
  // Basic difficulty heuristic by number of clues to remove
  // Easy: ~40 clues remaining (remove ~41)
  // Medium: ~30 clues remaining (remove ~51)
  // Hard: ~24 clues remaining (remove ~57)
  let cluesToRemove = 40;
  if (difficulty === 'medium') cluesToRemove = 50;
  if (difficulty === 'hard') cluesToRemove = 56;
  
  let attempts = 0;

  // Remove clues until the desired number of clues is reached  
  while (cluesToRemove > 0 && attempts < 100) {
    // Pick a random cell
    let row = Math.floor(Math.random() * 9);
    let col = Math.floor(Math.random() * 9);
    // If the cell is empty, pick another cell
    while (grid[row][col] === 0) {
      row = Math.floor(Math.random() * 9);
      col = Math.floor(Math.random() * 9);
    }

    // Store the value of the cell
    const backup = grid[row][col];
    grid[row][col] = 0;

    // Check if the puzzle still has a unique solution
    const copy = copyGrid(grid);
    if (countSolutions(copy) !== 1) {
      // If not, put the value back and try again
      grid[row][col] = backup;
      attempts++;
    } else {
      // If it has a unique solution, remove the clue
      cluesToRemove--;
    }
  }
}
