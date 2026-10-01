import { describe, expect, it } from 'vitest';
import { blackDensityOf, fillKakuroLayout, generateKakuroLayout, generateUniqueKakuro, repairToUnique } from './kakuro-generator';
import { deriveRuns, validateKakuroLayout } from './kakuro-layout';
import { isKakuroUnique } from './kakuro-solver';
import { validateKakuroRuns } from './kakuro-types';

/** A small seeded PRNG (mulberry32) so a failing case can be replayed. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('generateKakuroLayout', () => {
  it.each([
    ['scatter', 6, 0.4],
    ['scatter', 7, 0.37],
    ['scatter', 9, 0.38],
    ['edges-inward', 7, 0.36],
    ['edges-inward', 9, 0.36],
  ] as const)('%s at %i×%i passes the static validator and lands within 3% of the target density', (method, gridSize, blackDensity) => {
    const rng = seeded(gridSize * 100 + Math.round(blackDensity * 100));
    for (let i = 0; i < 5; i++) {
      const white = generateKakuroLayout({ gridSize, blackDensity, method, rng });
      expect(white).not.toBeNull();
      expect(validateKakuroLayout(white!)).toEqual([]);
      expect(Math.abs(blackDensityOf(white!) - blackDensity)).toBeLessThanOrEqual(0.03 + 1e-9);
    }
  });

  it('returns null rather than a bad layout when the target is unreachable', () => {
    // 6×6 at 90% black cannot keep every white cell in two runs.
    expect(generateKakuroLayout({ gridSize: 6, blackDensity: 0.9, rng: seeded(1), maxAttempts: 20 })).toBeNull();
  });

  it('is reproducible from a seed', () => {
    const a = generateKakuroLayout({ gridSize: 7, blackDensity: 0.37, rng: seeded(42) });
    const b = generateKakuroLayout({ gridSize: 7, blackDensity: 0.37, rng: seeded(42) });
    expect(a).toEqual(b);
  });
});

describe('fillKakuroLayout', () => {
  it('gives every white cell a digit 1–9 with no repeat inside any run, and black cells 0', () => {
    const rng = seeded(7);
    const white = generateKakuroLayout({ gridSize: 9, blackDensity: 0.38, rng })!;
    const fill = fillKakuroLayout(white, rng)!;
    expect(fill).not.toBeNull();
    fill.forEach((row, r) => row.forEach((digit, c) => expect(white[r][c] ? digit >= 1 && digit <= 9 : digit === 0).toBe(true)));
    expect(validateKakuroRuns(deriveRuns(fill), fill)).toEqual([]);
  });
});

describe('repairToUnique', () => {
  it('climbs a random fill to a uniquely solvable one on the 7×7, keeping the layout', () => {
    const rng = seeded(3);
    const white = generateKakuroLayout({ gridSize: 7, blackDensity: 0.37, rng })!;
    const fill = fillKakuroLayout(white, rng)!;
    const repaired = repairToUnique(fill, { rng, msCap: 10_000 });
    expect(repaired.solutions).toBe(1);
    expect(isKakuroUnique({ gridSize: 7, runs: deriveRuns(repaired.solution) })).toBe(true);
    repaired.solution.forEach((row, r) => row.forEach((digit, c) => expect(digit !== 0).toBe(white[r][c])));
    expect(validateKakuroRuns(deriveRuns(repaired.solution), repaired.solution)).toEqual([]);
  });

  it('stops at the wall-clock cap and reports the count it reached', () => {
    const rng = seeded(5);
    const white = generateKakuroLayout({ gridSize: 9, blackDensity: 0.38, rng })!;
    const fill = fillKakuroLayout(white, rng)!;
    const result = repairToUnique(fill, { rng, msCap: 1, stepCap: 3 });
    expect(result.steps).toBeLessThanOrEqual(3);
    expect(result.solutions).toBeGreaterThanOrEqual(1);
  });
});

describe('generateUniqueKakuro', () => {
  it.each([6, 7, 9] as const)('makes a unique, legal, solver-graded %i×%i', (gridSize) => {
    const puzzle = generateUniqueKakuro({ gridSize, blackDensity: gridSize === 6 ? 0.4 : 0.38, rng: seeded(gridSize) });
    expect(puzzle).not.toBeNull();
    expect(puzzle!.variant).toBe('kakuro');
    expect(puzzle!.grid.flat().every((d) => d === 0)).toBe(true);
    expect(validateKakuroRuns(puzzle!.runs, puzzle!.solution)).toEqual([]);
    expect(isKakuroUnique({ gridSize, runs: puzzle!.runs })).toBe(true);
    expect(['easy', 'medium', 'hard', 'expert', 'extreme', 'unrated']).toContain(puzzle!.difficulty);
  });
});
