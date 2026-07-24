// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateSudoku, getGridConfig, GridSize } from './sudoku';

/**
 * Asserts a fully-filled grid is a legal Sudoku solution: every row, column, and
 * box contains each of 1..n exactly once. This is the property the generator must
 * uphold, so it doubles as the oracle for the tests below.
 */
function assertValidSolution(grid: number[][], size: GridSize) {
  const { boxWidth, boxHeight } = getGridConfig(size);
  const expected = Array.from({ length: size }, (_, i) => i + 1).join(',');

  const sorted = (nums: number[]) => [...nums].sort((a, b) => a - b).join(',');

  // Rows and columns
  for (let i = 0; i < size; i++) {
    expect(sorted(grid[i])).toBe(expected);
    expect(sorted(grid.map(row => row[i]))).toBe(expected);
  }

  // Boxes
  for (let boxRow = 0; boxRow < size; boxRow += boxHeight) {
    for (let boxCol = 0; boxCol < size; boxCol += boxWidth) {
      const cells: number[] = [];
      for (let dr = 0; dr < boxHeight; dr++) {
        for (let dc = 0; dc < boxWidth; dc++) {
          cells.push(grid[boxRow + dr][boxCol + dc]);
        }
      }
      expect(sorted(cells)).toBe(expected);
    }
  }
}

describe('getGridConfig', () => {
  it('returns the correct box geometry for each box-tileable size', () => {
    expect(getGridConfig(4)).toMatchObject({ hasBoxes: true, boxWidth: 2, boxHeight: 2, totalCells: 16, maxNum: 4 });
    expect(getGridConfig(6)).toMatchObject({ hasBoxes: true, boxWidth: 3, boxHeight: 2, totalCells: 36, maxNum: 6 });
    expect(getGridConfig(9)).toMatchObject({ hasBoxes: true, boxWidth: 3, boxHeight: 3, totalCells: 81, maxNum: 9 });
  });

  // K0: boxless (Latin-square-only) sizes for KenKen. `hasBoxes` is false and the box dims are a
  // harmless row-strip sentinel (size × 1) so ungated box math degenerates to the row constraint.
  it('returns a valid boxless config for the prime KenKen sizes 5 and 7', () => {
    expect(getGridConfig(5)).toMatchObject({ hasBoxes: false, boxWidth: 5, boxHeight: 1, totalCells: 25, maxNum: 5 });
    expect(getGridConfig(7)).toMatchObject({ hasBoxes: false, boxWidth: 7, boxHeight: 1, totalCells: 49, maxNum: 7 });
  });
});

describe('generateSudoku', () => {
  // Keep the matrix fast: exercise every grid size on cheap difficulties. Expert
  // and extreme (slow, 9x9-only) are covered end-to-end by the route tests.
  const cases: { size: GridSize; difficulty: 'easy' | 'medium' | 'hard' }[] = [
    { size: 9, difficulty: 'easy' },
    { size: 9, difficulty: 'medium' },
    { size: 6, difficulty: 'easy' },
    { size: 4, difficulty: 'easy' },
  ];

  for (const { size, difficulty } of cases) {
    it(`produces a valid ${size}x${size} ${difficulty} puzzle`, () => {
      const { grid, solution, gridSize, difficulty: reported } = generateSudoku(difficulty, size);

      expect(gridSize).toBe(size);
      expect(reported).toBe(difficulty);

      // The solution must be a legal, fully-filled grid.
      expect(solution).toHaveLength(size);
      assertValidSolution(solution, size);

      // The puzzle must have at least one dug hole and every given must match the
      // solution — the grid is always a subset of its own solution.
      let holes = 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (grid[r][c] === 0) holes++;
          else expect(grid[r][c]).toBe(solution[r][c]);
        }
      }
      expect(holes).toBeGreaterThan(0);
    });
  }
});
