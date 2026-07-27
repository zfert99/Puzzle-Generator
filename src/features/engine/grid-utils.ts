import type { GridConfig } from './sudoku';

/**
 * Population count (number of set bits) via Brian Kernighan's algorithm. Used to
 * measure how many digits are still legal for a cell (popcount over a candidate
 * bitmask) — the metric the MRV heuristic minimises. See AGENTS.md Section 1.
 */
export function popcount(mask: number): number {
  let count = 0;
  while (mask !== 0) {
    mask &= mask - 1;
    count++;
  }
  return count;
}

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
  const { size, boxWidth, boxHeight, hasBoxes } = config;

  // Check row and column simultaneously for repetition of the number
  for (let x = 0; x < size; x++) {
    if (grid[row][x] === num) return false;
    if (grid[x][col] === num) return false;
  }

  // Boxless (Latin-square-only) sizes have no box constraint — rows + columns are the whole
  // rule (KenKen at 5/7). Skip the subgrid scan entirely rather than trust the box sentinel.
  if (!hasBoxes) return true;

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
 * Uses bitmask-based backtracking with a Minimum Remaining Values (MRV) heuristic
 * to generate a fully solved, valid Sudoku grid in place. Rather than filling
 * cells in index order and rescanning row/col/box on every candidate test (the
 * old O(size) `isValid` approach), we maintain a used-digit bitmask per row,
 * column, and box and always branch on the empty cell with the FEWEST legal
 * digits first. Most-constrained-first collapses the search tree dramatically and
 * bit operations make each legality test O(1). Digits are still tried in random
 * order so every generated solution is unique. See AGENTS.md Section 1.
 */
export function fillGrid(grid: number[][], config: GridConfig): boolean {
  const { size, boxWidth, boxHeight, maxNum } = config;
  const fullMask = (1 << maxNum) - 1;
  const boxesPerRow = size / boxWidth;
  // Boxless (Latin-square-only) sizes carry a row-strip box sentinel (boxWidth = size,
  // boxHeight = 1), so `boxOf(r, c)` collapses to `r` and `boxMask[r]` simply mirrors
  // `rowMask[r]` — the box term becomes a redundant no-op and the result is a pure Latin
  // square, with NO branch added to this hot loop (AGENTS.md §3). The K0 Latin-square test at
  // 5×5/7×7 guards this: if the sentinel ever changes, that test fails.
  const boxOf = (r: number, c: number) =>
    Math.floor(r / boxHeight) * boxesPerRow + Math.floor(c / boxWidth);

  const rowMask = new Array<number>(size).fill(0);
  const colMask = new Array<number>(size).fill(0);
  const boxMask = new Array<number>(size).fill(0);

  // Seed the masks from any pre-placed clues (usually none for a blank grid).
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid[r][c];
      if (v !== 0) {
        const bit = 1 << (v - 1);
        rowMask[r] |= bit;
        colMask[c] |= bit;
        boxMask[boxOf(r, c)] |= bit;
      }
    }
  }

  const recurse = (): boolean => {
    // MRV: find the empty cell with the fewest legal candidates.
    let bestR = -1, bestC = -1, bestAllowed = 0, bestCount = maxNum + 1;
    search:
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== 0) continue;
        const allowed = fullMask & ~(rowMask[r] | colMask[c] | boxMask[boxOf(r, c)]);
        const count = popcount(allowed);
        if (count === 0) return false; // dead end — this branch cannot be completed
        if (count < bestCount) {
          bestCount = count; bestR = r; bestC = c; bestAllowed = allowed;
          if (count === 1) break search; // cannot do better than a forced cell
        }
      }
    }

    if (bestR === -1) return true; // no empty cells remain → grid is full

    // Try the legal digits in random order so solutions stay uniformly varied.
    const candidates: number[] = [];
    let m = bestAllowed;
    while (m !== 0) {
      const lowestBit = m & -m;
      candidates.push(31 - Math.clz32(lowestBit) + 1);
      m &= m - 1;
    }
    shuffle(candidates);

    const b = boxOf(bestR, bestC);
    for (const num of candidates) {
      const bit = 1 << (num - 1);
      grid[bestR][bestC] = num;
      rowMask[bestR] |= bit; colMask[bestC] |= bit; boxMask[b] |= bit;

      if (recurse()) return true;

      grid[bestR][bestC] = 0;
      rowMask[bestR] &= ~bit; colMask[bestC] &= ~bit; boxMask[b] &= ~bit;
    }
    return false;
  };

  return recurse();
}
