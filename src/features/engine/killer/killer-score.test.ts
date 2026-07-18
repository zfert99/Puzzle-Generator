import { describe, expect, it } from 'vitest';
import { scoreKillerSolve, TECHNIQUE_WEIGHTS } from './killer-score';
import type { KillerSolveResult } from './killer-logical-solver';

function solveResult(overrides: Partial<KillerSolveResult>): KillerSolveResult {
  return { solved: true, hardestTier: 2, techniqueCounts: {}, passes: 10, avgOpenSingles: 2, ...overrides };
}

describe('scoreKillerSolve', () => {
  it('sums technique applications by weight', () => {
    const result = solveResult({ techniqueCounts: { cageArithmetic: 10, nakedPair: 2, aic: 1 } });
    const expectedRaw =
      10 * TECHNIQUE_WEIGHTS.cageArithmetic + 2 * TECHNIQUE_WEIGHTS.nakedPair + 1 * TECHNIQUE_WEIGHTS.aic;
    expect(scoreKillerSolve(result).raw).toBeCloseTo(expectedRaw);
  });

  it('scores bottlenecked solves above open ones (density factor is monotone decreasing)', () => {
    const counts = { cageArithmetic: 20 };
    const bottlenecked = scoreKillerSolve(solveResult({ techniqueCounts: counts, avgOpenSingles: 0 }));
    const middling = scoreKillerSolve(solveResult({ techniqueCounts: counts, avgOpenSingles: 2 }));
    const open = scoreKillerSolve(solveResult({ techniqueCounts: counts, avgOpenSingles: 8 }));
    expect(bottlenecked.final).toBeGreaterThan(middling.final);
    expect(middling.final).toBeGreaterThan(open.final);
  });

  it('clamps the density factor to [0.5, 2]', () => {
    const counts = { cageArithmetic: 1 };
    expect(scoreKillerSolve(solveResult({ techniqueCounts: counts, avgOpenSingles: 0 })).densityFactor).toBeLessThanOrEqual(2);
    expect(scoreKillerSolve(solveResult({ techniqueCounts: counts, avgOpenSingles: 100 })).densityFactor).toBe(0.5);
  });
});
