import { describe, expect, it } from 'vitest';
import { generateUniqueKiller } from './killer-sudoku';
import { generateKillerSudoku, type KillerDifficulty } from './killer-sudoku';
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

  it('never corrupts a puzzle it works on, solved or stuck (maxSize-4 fuzz)', () => {
    // Historical note: this test once ALSO asserted that some maxSize-4 puzzles must stay
    // unsolved — true before E2, when ~86% were beyond the technique set. The E2 techniques
    // (combo restriction with Hall's condition, multi-cell pseudo-cages, box regions) solve
    // this fixture set outright, so the surviving invariant is the one that matters:
    // everything the solver derives, on any puzzle, must match the true solution.
    for (let seed = 1; seed <= 20; seed++) {
      const { cages } = generateUniqueKiller(4, { solution: SOL9, rng: mulberry32(seed * 7) });
      const ls = new KillerLogicalSolver(cages, 9);
      ls.solve();
      expect(unsoundPlacements(ls.grid, SOL9)).toBe(0);
    }
  });

  it('exposes the new tier-4/5 split: capability-toggling the E2 techniques changes solvability', () => {
    // Find a puzzle that SOLVES with the full technique set but STALLS when the two E2
    // killer-tough techniques are disabled — proving they are necessary (research's
    // capability-toggling necessity test), not merely present in a trace.
    let proven = false;
    for (let seed = 1; seed <= 60 && !proven; seed++) {
      const { cages } = generateUniqueKiller(4, { solution: SOL9, rng: mulberry32(seed * 13) });
      const withAll = new KillerLogicalSolver(cages, 9).solve();
      if (!withAll.solved || withAll.hardestTier < 4) continue;
      const without = new KillerLogicalSolver(cages, 9).solve({
        disable: ['cageComboRestriction', 'ruleOf45MultiCell'],
      });
      if (!without.solved) proven = true;
    }
    expect(proven).toBe(true);
  });
});

describe('KillerLogicalSolver — precomputed Rule-of-45 geometry grades exactly as before (October 2026)', () => {
  // Captured from the pre-change solver (region geometry rebuilt on every call) on seeded puzzles:
  // tier, pass count and every technique's application count must be identical. Hoisting the
  // geometry into the constructor is a performance change only; any drift here is semantic.
  const expected: { difficulty: KillerDifficulty; size: 6 | 9; seed: number; hardestTier: number; passes: number; counts: Record<string, number> }[] = [
    { difficulty: 'hard', size: 6, seed: 9100, hardestTier: 3, passes: 44, counts: {"cageArithmetic":7,"nakedSingle":30,"ruleOf45":3,"hiddenSingle":2,"cageConsistentDigits":1,"ruleOf45Regions":1} },
    { difficulty: 'hard', size: 6, seed: 9101, hardestTier: 2, passes: 47, counts: {"cageArithmetic":10,"hiddenSingle":9,"nakedSingle":26,"ruleOf45":1,"cageConsistentDigits":1} },
    { difficulty: 'hard', size: 6, seed: 9102, hardestTier: 3, passes: 45, counts: {"cageArithmetic":8,"nakedSingle":28,"ruleOf45":1,"hiddenSingle":5,"cageConsistentDigits":1,"ruleOf45Regions":2} },
    { difficulty: 'hard', size: 6, seed: 9103, hardestTier: 1, passes: 45, counts: {"cageArithmetic":9,"nakedSingle":26,"hiddenSingle":8,"ruleOf45":2} },
    { difficulty: 'hard', size: 6, seed: 9104, hardestTier: 3, passes: 44, counts: {"cageArithmetic":7,"nakedSingle":27,"ruleOf45":2,"hiddenSingle":6,"cageConsistentDigits":1,"ruleOf45Regions":1} },
    { difficulty: 'hard', size: 6, seed: 9105, hardestTier: 1, passes: 45, counts: {"cageArithmetic":9,"ruleOf45":3,"hiddenSingle":6,"nakedSingle":27} },
    { difficulty: 'hard', size: 9, seed: 9100, hardestTier: 3, passes: 114, counts: {"cageArithmetic":27,"nakedSingle":64,"hiddenSingle":11,"ruleOf45":3,"cageConsistentDigits":3,"ruleOf45Regions":3,"nakedPair":3} },
    { difficulty: 'hard', size: 9, seed: 9101, hardestTier: 3, passes: 104, counts: {"cageArithmetic":19,"nakedSingle":55,"ruleOf45":4,"hiddenSingle":21,"cageConsistentDigits":1,"nakedPair":2,"hiddenPair":1,"ruleOf45Regions":1} },
    { difficulty: 'hard', size: 9, seed: 9102, hardestTier: 3, passes: 114, counts: {"cageArithmetic":28,"nakedSingle":69,"ruleOf45":2,"cageConsistentDigits":1,"ruleOf45Regions":1,"hiddenSingle":9,"nakedPair":2,"pointingPairs":1,"hiddenPair":1} },
    { difficulty: 'hard', size: 9, seed: 9103, hardestTier: 3, passes: 110, counts: {"cageArithmetic":24,"nakedSingle":60,"ruleOf45":2,"hiddenSingle":17,"cageConsistentDigits":2,"nakedPair":2,"hiddenPair":1,"ruleOf45Regions":2} },
    { difficulty: 'hard', size: 9, seed: 9104, hardestTier: 3, passes: 109, counts: {"cageArithmetic":24,"nakedSingle":62,"cageConsistentDigits":2,"ruleOf45Regions":4,"hiddenPair":1,"hiddenSingle":15,"nakedPair":1} },
    { difficulty: 'hard', size: 9, seed: 9105, hardestTier: 3, passes: 106, counts: {"cageArithmetic":24,"nakedSingle":62,"ruleOf45":3,"cageConsistentDigits":1,"ruleOf45Regions":1,"hiddenSingle":15} },
    { difficulty: 'expert', size: 9, seed: 9100, hardestTier: 4, passes: 110, counts: {"cageArithmetic":18,"nakedSingle":57,"ruleOf45":1,"cageConsistentDigits":3,"ruleOf45Regions":2,"hiddenSingle":21,"pointingPairs":3,"cageComboRestriction":3,"nakedPair":1,"hiddenPair":1} },
    { difficulty: 'expert', size: 9, seed: 9101, hardestTier: 4, passes: 117, counts: {"cageArithmetic":20,"nakedSingle":58,"ruleOf45":1,"ruleOf45Regions":1,"pointingPairs":3,"cageComboRestriction":6,"nakedPair":4,"hiddenPair":2,"ruleOf45MultiCell":1,"hiddenSingle":21} },
    { difficulty: 'expert', size: 9, seed: 9102, hardestTier: 4, passes: 112, counts: {"cageArithmetic":13,"nakedSingle":64,"ruleOf45":1,"hiddenPair":2,"cageConsistentDigits":1,"nakedPair":5,"ruleOf45Regions":1,"pointingPairs":5,"cageComboRestriction":5,"hiddenSingle":15} },
    { difficulty: 'expert', size: 9, seed: 9103, hardestTier: 4, passes: 115, counts: {"cageArithmetic":18,"nakedSingle":58,"ruleOf45":1,"cageConsistentDigits":1,"cageComboRestriction":5,"nakedPair":5,"pointingPairs":3,"ruleOf45MultiCell":1,"hiddenSingle":22,"hiddenPair":1} },
  ];

  it('reproduces the captured grades, pass counts and technique counts', () => {
    for (const e of expected) {
      const puzzle = generateKillerSudoku(e.difficulty, { gridSize: e.size, rng: mulberry32(e.seed) });
      const result = new KillerLogicalSolver(puzzle.cages, e.size, puzzle.grid).solve();
      const label = `${e.difficulty} ${e.size}×${e.size} seed ${e.seed}`;
      expect(result.hardestTier, label).toBe(e.hardestTier);
      expect(result.passes, label).toBe(e.passes);
      expect(result.techniqueCounts, label).toEqual(e.counts);
    }
  });
});
