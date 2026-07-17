import { describe, expect, it } from 'vitest';
import { generateKillerSudoku } from './killer-sudoku';
import { KillerLogicalSolver } from './killer-logical-solver';

const SOL9 = [
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

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Count cells the solver placed that disagree with the (unique) solution. */
function unsoundPlacements(grid: number[][], solution: number[][]): number {
  let bad = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0 && grid[r][c] !== solution[r][c]) bad += 1;
    }
  }
  return bad;
}

describe('KillerLogicalSolver — Tier 1', () => {
  it('is SOUND: never places a wrong digit, across cage sizes', () => {
    // The most important property of a logical solver. A unique puzzle's every forced digit is
    // the solution's digit, so any placement that disagrees is an unsound deduction (a bug).
    for (const maxSize of [2, 3, 4]) {
      for (let seed = 1; seed <= 25; seed++) {
        const puzzle = generateKillerSudoku('medium', {
          solution: SOL9,
          rng: mulberry32(seed * 100 + maxSize),
          maxSize,
        });
        const ls = new KillerLogicalSolver(puzzle.cages, 9);
        ls.solve();
        expect(unsoundPlacements(ls.grid, SOL9)).toBe(0);
      }
    }
  });

  it('solves highly-constrained (small-cage) puzzles with Tier 1 alone', () => {
    // maxSize-2 puzzles are dense with magic (single-combination) cages — Tier 1 cracks them.
    for (let seed = 1; seed <= 15; seed++) {
      const puzzle = generateKillerSudoku('easy', { solution: SOL9, rng: mulberry32(seed), maxSize: 2 });
      const result = new KillerLogicalSolver(puzzle.cages, 9).solve();
      expect(result.solved).toBe(true);
      expect(result.hardestTier).toBe(1);
    }
  });

  it('reports the graded tier and the solved grid equals the solution', () => {
    const puzzle = generateKillerSudoku('easy', { solution: SOL9, rng: mulberry32(3), maxSize: 2 });
    const ls = new KillerLogicalSolver(puzzle.cages, 9);
    const result = ls.solve();
    expect(result.solved).toBe(true);
    expect(result.hardestTier).toBe(1);
    expect(ls.grid).toEqual(SOL9);
  });

  it('grades and soundly solves a puzzle that genuinely requires Tier 2', () => {
    // Search for a puzzle Tier 1 can't finish but Tier 2 can — proving the Tier 2 techniques
    // (cage consistent-digit + classic pairs) are exercised, necessary, and correct.
    let found = false;
    for (let seed = 1; seed <= 80 && !found; seed++) {
      const puzzle = generateKillerSudoku('medium', {
        solution: SOL9,
        rng: mulberry32(seed * 100 + 3),
        maxSize: 3,
      });
      const ls = new KillerLogicalSolver(puzzle.cages, 9);
      const result = ls.solve();
      if (result.solved && result.hardestTier === 2) {
        found = true;
        expect(unsoundPlacements(ls.grid, SOL9)).toBe(0);
        expect(ls.grid).toEqual(SOL9);
      }
    }
    expect(found).toBe(true);
  });

  it('grades and soundly solves a puzzle that genuinely requires Tier 3', () => {
    // Tier 3 = multi-unit Rule of 45 (innies/outies) + pointing pairs. Find a puzzle only Tier 3
    // finishes, proving those techniques are exercised, necessary, and correct.
    let found = false;
    for (let seed = 1; seed <= 120 && !found; seed++) {
      const puzzle = generateKillerSudoku('medium', {
        solution: SOL9,
        rng: mulberry32(seed * 100 + 3),
        maxSize: 3,
      });
      const ls = new KillerLogicalSolver(puzzle.cages, 9);
      const result = ls.solve();
      if (result.solved && result.hardestTier === 3) {
        found = true;
        expect(unsoundPlacements(ls.grid, SOL9)).toBe(0);
        expect(ls.grid).toEqual(SOL9);
      }
    }
    expect(found).toBe(true);
  });

  it('gets stuck (does not solve) on looser puzzles — without corrupting them', () => {
    // Larger cages generally need Tier 2+; Tier 1 should stop cleanly, never place a wrong digit.
    let anyUnsolved = false;
    for (let seed = 1; seed <= 20; seed++) {
      const puzzle = generateKillerSudoku('hard', { solution: SOL9, rng: mulberry32(seed * 7), maxSize: 4 });
      const ls = new KillerLogicalSolver(puzzle.cages, 9);
      if (!ls.solve().solved) anyUnsolved = true;
      expect(unsoundPlacements(ls.grid, SOL9)).toBe(0);
    }
    expect(anyUnsolved).toBe(true); // Tier 1 is genuinely insufficient for some puzzles
  });
});
