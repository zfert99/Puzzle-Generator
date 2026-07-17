import { describe, expect, it } from 'vitest';
import { generateUniqueKiller } from './killer-sudoku';
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

/** Find the first seed whose unique layout grades to exactly `tier`, and return its solver. */
function findGraded(tier: number, maxSize: number, maxSeeds = 200): KillerLogicalSolver | null {
  for (let seed = 1; seed <= maxSeeds; seed++) {
    const { cages } = generateUniqueKiller(maxSize, { solution: SOL9, rng: mulberry32(seed * 100 + maxSize) });
    const ls = new KillerLogicalSolver(cages, 9);
    if (ls.solve().hardestTier === tier) return new KillerLogicalSolver(cages, 9);
  }
  return null;
}

describe('KillerLogicalSolver — tiered grading', () => {
  it('is SOUND: never places a wrong digit, across cage sizes', () => {
    // The most important property of a logical solver. A unique puzzle's every forced digit is
    // the solution's digit, so any placement that disagrees is an unsound deduction (a bug).
    for (const maxSize of [2, 3, 4]) {
      for (let seed = 1; seed <= 25; seed++) {
        const { cages } = generateUniqueKiller(maxSize, { solution: SOL9, rng: mulberry32(seed * 100 + maxSize) });
        const ls = new KillerLogicalSolver(cages, 9);
        ls.solve();
        expect(unsoundPlacements(ls.grid, SOL9)).toBe(0);
      }
    }
  });

  it('solves highly-constrained (small-cage) puzzles with Tier 1 alone', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const { cages } = generateUniqueKiller(2, { solution: SOL9, rng: mulberry32(seed) });
      const result = new KillerLogicalSolver(cages, 9).solve();
      expect(result.solved).toBe(true);
      expect(result.hardestTier).toBe(1);
    }
  });

  // v1 grades tiers 1–3 (easy/medium/hard); tier-4 techniques are still exercised — soundly —
  // by the maxSize-4 soundness/stuck cases below and the classic strategy suites.
  it.each([2, 3])('grades and soundly solves a puzzle that genuinely requires Tier %i', (tier) => {
    // Find a puzzle only tier N finishes — proving those techniques are exercised, necessary,
    // and correct.
    const ls = findGraded(tier, 3);
    expect(ls).not.toBeNull();
    const result = (ls as KillerLogicalSolver).solve();
    expect(result.hardestTier).toBe(tier);
    expect(result.solved).toBe(true);
    expect((ls as KillerLogicalSolver).grid).toEqual(SOL9);
  });

  it('respects the maxTier cap: capping below a puzzle’s tier leaves it unsolved', () => {
    const ls = findGraded(3, 3);
    expect(ls).not.toBeNull();
    // The same puzzle, graded with a cap of 2, must NOT solve (it needs Tier 3).
    const capped = (ls as KillerLogicalSolver).solve({ maxTier: 2 });
    expect(capped.solved).toBe(false);
    expect(capped.hardestTier).toBeLessThanOrEqual(2);
  });

  it('gets stuck (does not solve) on looser puzzles — without corrupting them', () => {
    let anyUnsolved = false;
    for (let seed = 1; seed <= 20; seed++) {
      const { cages } = generateUniqueKiller(4, { solution: SOL9, rng: mulberry32(seed * 7) });
      const ls = new KillerLogicalSolver(cages, 9);
      if (!ls.solve().solved) anyUnsolved = true;
      expect(unsoundPlacements(ls.grid, SOL9)).toBe(0);
    }
    expect(anyUnsolved).toBe(true); // some maxSize-4 puzzles are beyond the implemented techniques
  });
});
