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
