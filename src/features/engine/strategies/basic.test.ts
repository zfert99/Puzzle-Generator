// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { HumanSolver } from '../human-solver';
import { applyNakedSingle, applyHiddenSingle, applyNakedPair, applyPointingPairs, applyClaiming } from './basic';
import { createEmptyGrid } from '../grid-utils';

// A known-valid, fully solved 9x9 grid (the canonical Sudoku example).
const SOLVED = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

/** Bitmask for a set of candidate digits. */
const mask = (...digits: number[]) => digits.reduce((m, d) => m | (1 << (d - 1)), 0);

describe('applyNakedSingle', () => {
  it('places the sole remaining candidate of a lone empty cell', () => {
    const grid = SOLVED.map(r => [...r]);
    grid[4][4] = 0; // its peers force exactly one value back
    const solver = new HumanSolver(grid);

    expect(applyNakedSingle(solver)).toBe(true);
    expect(solver.grid[4][4]).toBe(SOLVED[4][4]);
  });

  it('returns false when no cell is down to a single candidate', () => {
    const solver = new HumanSolver(createEmptyGrid(9)); // every cell has 9 candidates
    expect(applyNakedSingle(solver)).toBe(false);
  });
});

describe('applyHiddenSingle', () => {
  it('places a digit that has only one legal home within a house', () => {
    const solver = new HumanSolver(createEmptyGrid(9));
    // Remove digit 5 from every cell of row 0 except column 3. Now 5 has exactly one
    // position in row 0 — a hidden single at (0,3), even though that cell still has
    // many candidates (so it is NOT a naked single).
    for (let c = 0; c < 9; c++) if (c !== 3) solver.removeCandidate(0, c, 5);

    expect(applyHiddenSingle(solver)).toBe(true);
    expect(solver.grid[0][3]).toBe(5);
  });
});

describe('applyNakedPair', () => {
  it('eliminates the pair digits from the rest of the shared house', () => {
    const solver = new HumanSolver(createEmptyGrid(9));
    // Two cells in row 0 / box 0 restricted to exactly {2,3}.
    solver.candidates[0][0] = mask(2, 3);
    solver.candidates[0][1] = mask(2, 3);

    expect(applyNakedPair(solver)).toBe(true);

    // Removed from another row-0 cell and another box-0 cell.
    expect(solver.hasCandidate(0, 4, 2)).toBe(false);
    expect(solver.hasCandidate(0, 4, 3)).toBe(false);
    expect(solver.hasCandidate(1, 0, 2)).toBe(false);
    // The pair cells keep their candidates.
    expect(solver.hasCandidate(0, 0, 2)).toBe(true);
    expect(solver.hasCandidate(0, 1, 3)).toBe(true);
  });
});

describe('applyPointingPairs', () => {
  it('eliminates a box-confined candidate from the rest of the line', () => {
    const solver = new HumanSolver(createEmptyGrid(9));
    // Confine digit 4 within box 0 to row 0 (only cells (0,0) and (0,1)).
    for (const [r, c] of [[1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [0, 2]] as [number, number][]) {
      solver.removeCandidate(r, c, 4);
    }

    expect(applyPointingPairs(solver)).toBe(true);

    // 4 is removed from row 0 cells outside box 0...
    expect(solver.hasCandidate(0, 5, 4)).toBe(false);
    // ...but kept in the pointing cells.
    expect(solver.hasCandidate(0, 0, 4)).toBe(true);
  });
});

describe('applyClaiming (box-line reduction, line → box)', () => {
  it('clears a digit from the rest of a box when its row positions all lie in that box', () => {
    const grid = createEmptyGrid(9);
    const solver = new HumanSolver(grid);
    // Row 0: remove 5 from every cell outside box 0, so the 5s of row 0 are confined to r0c0..r0c2.
    for (let c = 3; c < 9; c++) solver.removeCandidate(0, c, 5);
    expect(applyClaiming(solver)).toBe(true);
    // Box 0's other rows lost their 5s; row 0's own cells kept theirs.
    for (let r = 1; r < 3; r++) for (let c = 0; c < 3; c++) expect(solver.hasCandidate(r, c, 5), `r${r}c${c}`).toBe(false);
    for (let c = 0; c < 3; c++) expect(solver.hasCandidate(0, c, 5)).toBe(true);
    // Nothing outside box 0 was touched.
    expect(solver.hasCandidate(3, 0, 5)).toBe(true);
  });

  it('does the same for a column confined to one box, and does nothing when the digit spans two boxes', () => {
    const grid = createEmptyGrid(9);
    const solver = new HumanSolver(grid);
    for (let r = 3; r < 9; r++) solver.removeCandidate(r, 4, 7); // column 4's 7s sit in box 1 only
    expect(applyClaiming(solver)).toBe(true);
    for (let r = 0; r < 3; r++) for (const c of [3, 5]) expect(solver.hasCandidate(r, c, 7), `r${r}c${c}`).toBe(false);

    const spread = new HumanSolver(createEmptyGrid(9));
    for (let c = 1; c < 9; c++) if (c !== 4) spread.removeCandidate(2, c, 3); // row 2's 3s at c0 (box 0) and c4 (box 1)
    expect(applyClaiming(spread)).toBe(false);
  });
});
