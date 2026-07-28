import { describe, expect, it } from 'vitest';
import { scoreCalcSolve, CALC_TECHNIQUE_WEIGHTS } from './calc-score';
import type { CalcSolveResult, CalcTechnique } from './calc-logical-solver';

/**
 * Mirrors `killer-score.test.ts` — the two scorers share Andrew Stuart's two-factor architecture,
 * so the invariants under test (weighted sum, monotone density factor, clamp) are the same. The
 * extra `no NaN` case guards the runtime footgun the sibling doesn't have: an unknown technique key.
 */
function solveResult(overrides: Partial<CalcSolveResult>): CalcSolveResult {
  return {
    solved: true,
    hardestTier: 2,
    techniqueCounts: {},
    passes: 10,
    avgOpenSingles: 2,
    maxGuessDepth: 0,
    guessSteps: 0,
    ...overrides,
  };
}

describe('scoreCalcSolve', () => {
  it('sums technique applications by weight', () => {
    const result = solveResult({ techniqueCounts: { cageArithmetic: 10, nakedPair: 2, xWing: 1 } });
    const expectedRaw =
      10 * CALC_TECHNIQUE_WEIGHTS.cageArithmetic +
      2 * CALC_TECHNIQUE_WEIGHTS.nakedPair +
      1 * CALC_TECHNIQUE_WEIGHTS.xWing;
    expect(scoreCalcSolve(result).raw).toBeCloseTo(expectedRaw);
  });

  it('scores bottlenecked solves above open ones (density factor is monotone decreasing)', () => {
    const counts = { cageArithmetic: 20 };
    const bottlenecked = scoreCalcSolve(solveResult({ techniqueCounts: counts, avgOpenSingles: 0 }));
    const middling = scoreCalcSolve(solveResult({ techniqueCounts: counts, avgOpenSingles: 2 }));
    const open = scoreCalcSolve(solveResult({ techniqueCounts: counts, avgOpenSingles: 8 }));
    expect(bottlenecked.final).toBeGreaterThan(middling.final);
    expect(middling.final).toBeGreaterThan(open.final);
  });

  it('clamps the density factor to [0.5, 2]', () => {
    const counts = { cageArithmetic: 1 };
    expect(scoreCalcSolve(solveResult({ techniqueCounts: counts, avgOpenSingles: 0 })).densityFactor).toBeLessThanOrEqual(2);
    expect(scoreCalcSolve(solveResult({ techniqueCounts: counts, avgOpenSingles: 100 })).densityFactor).toBe(0.5);
  });

  it('treats an unweighted technique as 0 rather than poisoning the score with NaN', () => {
    // Simulate the solver reporting a technique the weights map doesn't cover (a future technique
    // added without updating CALC_TECHNIQUE_WEIGHTS). The known technique must still score cleanly.
    const result = solveResult({
      techniqueCounts: { cageArithmetic: 5, ['newTechnique' as CalcTechnique]: 3 },
    });
    const score = scoreCalcSolve(result);
    expect(Number.isNaN(score.raw)).toBe(false);
    expect(Number.isNaN(score.final)).toBe(false);
    expect(score.raw).toBeCloseTo(5 * CALC_TECHNIQUE_WEIGHTS.cageArithmetic);
  });
});
