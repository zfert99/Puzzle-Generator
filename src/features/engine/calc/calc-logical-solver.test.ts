// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CalcLogicalSolver } from './calc-logical-solver';
import { generateUniqueCalc } from './calc-generator';
import type { CalcCage } from './calc-types';
import type { GridSize } from '../sudoku';

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const flat = (r: number, c: number, size: number) => r * size + c;

describe('CalcLogicalSolver — givens & basics', () => {
  it('places every single-cell cage (given) at construction and solves an all-givens puzzle at tier 0', () => {
    const solution = [
      [1, 2, 3, 4],
      [2, 1, 4, 3],
      [3, 4, 1, 2],
      [4, 3, 2, 1],
    ];
    const cages: CalcCage[] = [];
    let id = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) cages.push({ id: id++, op: 'add', target: solution[r][c], cells: [flat(r, c, 4)] });
    }
    const result = new CalcLogicalSolver(cages, 4).solve();
    expect(result.solved).toBe(true);
    expect(result.hardestTier).toBe(0); // nothing beyond placing givens was needed
  });
});

describe('CalcLogicalSolver — soundness (fuzz vs the K2 exact solver)', () => {
  it('never places a wrong digit, and every full solve matches the exact solution', () => {
    const sizes: GridSize[] = [4, 6];
    let solvedCount = 0;
    let total = 0;
    for (const size of sizes) {
      for (let seed = 1; seed <= 24; seed++) {
        const { cages, solution } = generateUniqueCalc(size, { rng: seededRng(seed * 17 + size), maxSize: 3 });
        const solver = new CalcLogicalSolver(cages, size);
        const result = solver.solve();
        const grid = solver.grid2d;
        total += 1;

        // SOUNDNESS: every digit the logical solver placed must match the unique solution —
        // whether or not it finished. An unsound elimination would surface as a wrong placement.
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (grid[r][c] !== 0) expect(grid[r][c]).toBe(solution[r][c]);
          }
        }
        if (result.solved) {
          solvedCount += 1;
          for (let r = 0; r < size; r++) expect(grid[r]).toEqual(solution[r]);
        }
      }
    }
    // Gradable-share sanity: the technique set solves a healthy fraction of QuadOp puzzles at
    // maxSize 3 (the exact bands are calibrated in K4; this just guards against a broken ladder).
    expect(solvedCount / total).toBeGreaterThan(0.5);
  });
});

describe('CalcLogicalSolver — grading', () => {
  it('reports a hardest tier in 1..4 for a generated (non-trivial) puzzle it solves', () => {
    // Find a seed whose puzzle the logical solver fully solves, then check the grade is sane.
    for (let seed = 1; seed <= 40; seed++) {
      const { cages } = generateUniqueCalc(4, { rng: seededRng(seed * 13), maxSize: 3 });
      const result = new CalcLogicalSolver(cages, 4).solve();
      if (result.solved && result.hardestTier >= 1) {
        expect(result.hardestTier).toBeGreaterThanOrEqual(1);
        expect(result.hardestTier).toBeLessThanOrEqual(4);
        expect(result.passes).toBeGreaterThan(0);
        expect(result.avgOpenSingles).toBeGreaterThanOrEqual(0);
        return;
      }
    }
    throw new Error('expected at least one generated 4×4 to be logically solvable with tier ≥ 1');
  });

  it('respects a maxTier cap (a tier-capped solve never reports a higher tier)', () => {
    const { cages } = generateUniqueCalc(6, { rng: seededRng(555), maxSize: 3 });
    const capped = new CalcLogicalSolver(cages, 6).solve({ maxTier: 2 });
    expect(capped.hardestTier).toBeLessThanOrEqual(2);
  });
});

describe('CalcLogicalSolver — bounded-recursion tier (K7b, T5 = depth-1 Nishio)', () => {
  // Search seeds for a low-givens 9×9 board the named ladder (T4) can NOT finish but a single
  // depth-1 guess can — the exact population Expert/Extreme will draw from. Deterministic per seed.
  function findT4StuckUnique(): { cages: ReturnType<typeof generateUniqueCalc>['cages']; solution: number[][] } | null {
    for (let seed = 1; seed <= 120; seed++) {
      const { cages, solution } = generateUniqueCalc(9, { rng: seededRng(seed * 101 + 7), minSize: 2, maxSize: 3 });
      if (cages.filter((c) => c.cells.length === 1).length > 3) continue; // want the hard, low-givens regime
      const stuck = !new CalcLogicalSolver(cages, 9).solve({ maxTier: 4 }).solved;
      if (stuck && new CalcLogicalSolver(cages, 9).solve({ maxTier: 5 }).solved) return { cages, solution };
    }
    return null;
  }

  it('solves a T4-stuck 9×9 with depth-1 guessing, and the solution is CORRECT', () => {
    const found = findT4StuckUnique();
    expect(found).not.toBeNull();
    const { cages, solution } = found!;

    // T4 genuinely can't finish it (that's why it needs the guess tier).
    expect(new CalcLogicalSolver(cages, 9).solve({ maxTier: 4 }).solved).toBe(false);

    // T5 finishes it, needs exactly depth-1, and every placed digit matches the unique solution —
    // a wrong (unsound) elimination would surface here as a mismatched grid.
    const solver = new CalcLogicalSolver(cages, 9);
    const r5 = solver.solve({ maxTier: 5 });
    expect(r5.solved).toBe(true);
    expect(r5.hardestTier).toBe(5);
    expect(r5.maxGuessDepth).toBe(1);
    for (let r = 0; r < 9; r++) expect(solver.grid2d[r]).toEqual(solution[r]);
  });

  it('leaves maxGuessDepth 0 when the named ladder already solves the puzzle', () => {
    // A board T4 solves must never be charged a guess — the tier stays ≤ 4 even with maxTier 5.
    for (let seed = 1; seed <= 60; seed++) {
      const { cages } = generateUniqueCalc(6, { rng: seededRng(seed * 31), maxSize: 3 });
      const r = new CalcLogicalSolver(cages, 6).solve({ maxTier: 5 });
      if (r.solved && r.hardestTier <= 4) {
        expect(r.maxGuessDepth).toBe(0);
        return;
      }
    }
    throw new Error('expected a T4-solvable 6×6 in the seed range');
  });
});
