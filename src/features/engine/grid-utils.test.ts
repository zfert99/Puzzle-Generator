// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { popcount, createEmptyGrid, copyGrid, isValid, shuffle, fillGrid } from './grid-utils';
import { getGridConfig, GridSize } from './sudoku';

/** Rows and columns only — the boxless (Latin-square) invariant for KenKen sizes 5/7. */
function assertLatinSquare(grid: number[][], size: GridSize) {
  const expected = Array.from({ length: size }, (_, i) => i + 1).join(',');
  const sorted = (nums: number[]) => [...nums].sort((a, b) => a - b).join(',');
  for (let i = 0; i < size; i++) {
    expect(sorted(grid[i])).toBe(expected);
    expect(sorted(grid.map((row) => row[i]))).toBe(expected);
  }
}

function assertCompleteValidSolution(grid: number[][], size: GridSize) {
  const { boxWidth, boxHeight } = getGridConfig(size);
  const expected = Array.from({ length: size }, (_, i) => i + 1).join(',');
  const sorted = (nums: number[]) => [...nums].sort((a, b) => a - b).join(',');

  for (let i = 0; i < size; i++) {
    expect(sorted(grid[i])).toBe(expected);
    expect(sorted(grid.map(row => row[i]))).toBe(expected);
  }
  for (let boxRow = 0; boxRow < size; boxRow += boxHeight) {
    for (let boxCol = 0; boxCol < size; boxCol += boxWidth) {
      const cells: number[] = [];
      for (let dr = 0; dr < boxHeight; dr++) {
        for (let dc = 0; dc < boxWidth; dc++) cells.push(grid[boxRow + dr][boxCol + dc]);
      }
      expect(sorted(cells)).toBe(expected);
    }
  }
}

describe('popcount', () => {
  it('counts set bits', () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(0b1)).toBe(1);
    expect(popcount(0b1011)).toBe(3);
    expect(popcount((1 << 9) - 1)).toBe(9); // full 9-candidate mask
  });
});

describe('createEmptyGrid', () => {
  it('produces an NxN grid of zeros', () => {
    const g = createEmptyGrid(9);
    expect(g).toHaveLength(9);
    expect(g.every(row => row.length === 9 && row.every(v => v === 0))).toBe(true);
  });
});

describe('copyGrid', () => {
  it('returns a deep copy that does not alias the original', () => {
    const original = [[1, 2], [3, 4]];
    const copy = copyGrid(original);
    copy[0][0] = 99;
    expect(original[0][0]).toBe(1);
  });
});

describe('isValid', () => {
  const config = getGridConfig(9);
  const grid = createEmptyGrid(9);
  grid[0][0] = 5; // seed one clue

  it('rejects a duplicate in the same row', () => {
    expect(isValid(grid, 0, 4, 5, config)).toBe(false);
  });
  it('rejects a duplicate in the same column', () => {
    expect(isValid(grid, 4, 0, 5, config)).toBe(false);
  });
  it('rejects a duplicate in the same box', () => {
    expect(isValid(grid, 1, 1, 5, config)).toBe(false);
  });
  it('accepts a non-conflicting placement', () => {
    expect(isValid(grid, 4, 4, 5, config)).toBe(true);
  });
});

describe('shuffle', () => {
  it('preserves the multiset of elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const shuffled = shuffle([...arr]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(arr);
  });
});

describe('fillGrid', () => {
  it.each([9, 6, 4] as GridSize[])('fills an empty %ix%i grid into a valid complete solution', (size) => {
    const config = getGridConfig(size);
    const grid = createEmptyGrid(size);
    expect(fillGrid(grid, config)).toBe(true);
    assertCompleteValidSolution(grid, size);
  });

  // K0: on a boxless (Latin-square-only) size, the row-strip box sentinel makes the box mask
  // mirror the row mask, so fillGrid needs no special-casing yet still produces a pure Latin
  // square. This test is the guard that keeps the sentinel honest (grid-utils.ts fillGrid comment).
  it.each([5, 7] as GridSize[])('fills a boxless %ix%i grid into a valid Latin square', (size) => {
    const config = getGridConfig(size);
    expect(config.hasBoxes).toBe(false);
    const grid = createEmptyGrid(size);
    expect(fillGrid(grid, config)).toBe(true);
    assertLatinSquare(grid, size);
  });
});

describe('isValid (boxless)', () => {
  // On a boxless grid, only row/column conflicts matter — two cells sharing a "box sentinel"
  // strip but not a row/column must NOT conflict.
  const config = getGridConfig(5);
  it('rejects row/column duplicates but ignores the box constraint', () => {
    const grid = createEmptyGrid(5);
    grid[0][0] = 3;
    expect(isValid(grid, 0, 4, 3, config)).toBe(false); // same row
    expect(isValid(grid, 4, 0, 3, config)).toBe(false); // same column
    expect(isValid(grid, 2, 3, 3, config)).toBe(true); // different row AND column → legal
  });
});
