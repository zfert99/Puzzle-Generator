import { describe, expect, it } from 'vitest';
import { generateCages } from './cage-generator';
import { KillerSolver } from './killer-solver';
import { validateKillerCages, isCageConnected } from './killer-types';

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

const SOL4 = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];

/** A tiny seeded PRNG (mulberry32) so each test run is deterministic and reproducible. */
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

describe('generateCages', () => {
  it('produces a valid partition for many random seeds (fuzz)', () => {
    // The K1 validator lets us assert the invariants over LOTS of random layouts at once:
    // covers every cell exactly once, each cage connected & 1..9, no repeats, sums match.
    for (let seed = 1; seed <= 50; seed++) {
      const cages = generateCages(SOL9, 9, { rng: mulberry32(seed) });
      expect(validateKillerCages(cages, SOL9)).toEqual([]);
    }
  });

  it('respects maxSize', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cages = generateCages(SOL9, 9, { maxSize: 4, rng: mulberry32(seed) });
      expect(cages.every((cage) => cage.cells.length <= 4)).toBe(true);
    }
  });

  it('maxSize 1 yields all single-cell cages (one per cell)', () => {
    const cages = generateCages(SOL9, 9, { maxSize: 1, rng: mulberry32(7) });
    expect(cages).toHaveLength(81);
    expect(cages.every((cage) => cage.cells.length === 1)).toBe(true);
    expect(validateKillerCages(cages, SOL9)).toEqual([]);
  });

  it('every cage is orthogonally connected and has no repeated solution digit', () => {
    const cages = generateCages(SOL9, 9, { rng: mulberry32(42) });
    for (const cage of cages) {
      expect(isCageConnected(cage.cells, 9)).toBe(true);
      const digits = cage.cells.map((cell) => SOL9[Math.floor(cell / 9)][cell % 9]);
      expect(new Set(digits).size).toBe(digits.length);
    }
  });

  it('works on a 4×4 grid too (size-generic)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cages = generateCages(SOL4, 4, { rng: mulberry32(seed) });
      expect(validateKillerCages(cages, SOL4)).toEqual([]);
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = generateCages(SOL9, 9, { rng: mulberry32(123) });
    const b = generateCages(SOL9, 9, { rng: mulberry32(123) });
    expect(a).toEqual(b);
  });

  it('generates solvable puzzles (K2 finds a valid solution over K3 cages)', () => {
    // The source solution always satisfies the cages, so there is at least one solution — and
    // whatever the solver returns must satisfy every cage. (Uniqueness is NOT guaranteed here;
    // that's the K5 pipeline's gate. This just proves K2 and K3 fit together.)
    for (let seed = 1; seed <= 10; seed++) {
      const cages = generateCages(SOL9, 9, { rng: mulberry32(seed) });
      expect(new KillerSolver(cages, 9).countSolutions(2)).toBeGreaterThanOrEqual(1);
      const solved = new KillerSolver(cages, 9).solve();
      expect(solved).not.toBeNull();
      expect(validateKillerCages(cages, solved as number[][])).toEqual([]);
    }
  });
});
