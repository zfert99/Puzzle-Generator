import { describe, expect, it } from 'vitest';
import { isCageConnected, validateKillerCages, type Cage } from './killer-types';

// A small 4×4 grid is enough to exercise the validators — they're size-agnostic (they read
// `solution.length`), and connectivity/partition logic doesn't depend on Sudoku validity.
const SOLUTION = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];
const SIZE = 4;

/** One cage per row — a trivially valid partition: connected, covers every cell once. */
function rowCages(): Cage[] {
  return SOLUTION.map((row, r) => ({
    id: r,
    cells: [0, 1, 2, 3].map((c) => r * SIZE + c),
    sum: row.reduce((a, b) => a + b, 0), // each row sums to 10
  }));
}

describe('isCageConnected', () => {
  it('accepts an orthogonally connected cage', () => {
    expect(isCageConnected([0, 1], SIZE)).toBe(true); // horizontal domino
    expect(isCageConnected([0, 4], SIZE)).toBe(true); // vertical domino
    expect(isCageConnected([0, 1, 5], SIZE)).toBe(true); // L-shape
  });

  it('rejects diagonal-only or separated cells', () => {
    expect(isCageConnected([0, 5], SIZE)).toBe(false); // (0,0)+(1,1) touch only at a corner
    expect(isCageConnected([0, 2], SIZE)).toBe(false); // (0,0)+(0,2) have a gap between them
  });

  it('does not wrap around row edges', () => {
    // index 3 = (0,3) and index 4 = (1,0) are adjacent in flat indices but NOT on the grid.
    expect(isCageConnected([3, 4], SIZE)).toBe(false);
  });
});

describe('validateKillerCages', () => {
  it('returns no errors for a valid partition', () => {
    expect(validateKillerCages(rowCages(), SOLUTION)).toEqual([]);
  });

  it('flags a cell covered by two cages (overlap)', () => {
    const cages = rowCages();
    cages[1].cells.push(0); // cell 0 now belongs to cage 0 AND cage 1
    const errors = validateKillerCages(cages, SOLUTION);
    expect(errors.some((e) => e.includes('cell 0') && e.includes('covered by 2'))).toBe(true);
  });

  it('flags a cell no cage covers (gap)', () => {
    const cages = rowCages();
    cages[0].cells = [1, 2, 3]; // drop cell 0
    cages[0].sum = 2 + 3 + 4;
    const errors = validateKillerCages(cages, SOLUTION);
    expect(errors.some((e) => e.includes('cell 0') && e.includes('not covered'))).toBe(true);
  });

  it('flags a disconnected cage', () => {
    const cages = rowCages();
    cages[0] = { id: 0, cells: [0, 2], sum: 1 + 3 }; // (0,0) and (0,2), a gap between
    // (still leaves cells 1 uncovered etc., but we only assert the connectivity error here)
    const errors = validateKillerCages(cages, SOLUTION);
    expect(errors.some((e) => e.includes('cage 0') && e.includes('not orthogonally connected'))).toBe(true);
  });

  it('flags a sum that disagrees with the solution', () => {
    const cages = rowCages();
    cages[2].sum = 99;
    const errors = validateKillerCages(cages, SOLUTION);
    expect(errors.some((e) => e.includes('cage 2') && e.includes('!= solution total'))).toBe(true);
  });

  it('flags a repeated digit within a cage', () => {
    // Cells 0 = (0,0) → 1 and 9 = (2,1) → 1 share a digit. (Also disconnected, but we assert
    // the repeat error specifically.)
    const cages: Cage[] = [{ id: 0, cells: [0, 9], sum: 2 }];
    const errors = validateKillerCages(cages, SOLUTION);
    expect(errors.some((e) => e.includes('digit repeats'))).toBe(true);
  });
});
