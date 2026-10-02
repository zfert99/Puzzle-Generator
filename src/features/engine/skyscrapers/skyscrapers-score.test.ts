import { describe, expect, it } from 'vitest';
import { SKYSCRAPERS_FIXTURE_5X5, SKYSCRAPERS_FIXTURE_7X7 } from './skyscrapers-fixtures';
import { SkyscrapersLogicalSolver } from './skyscrapers-logical-solver';
import { TECHNIQUE_WEIGHTS, scoreSkyscrapersSolve } from './skyscrapers-score';

describe('scoreSkyscrapersSolve', () => {
  it('weights grow with the tier, and the density factor stays in [0.5, 2]', () => {
    expect(TECHNIQUE_WEIGHTS.clueN).toBeLessThan(TECHNIQUE_WEIGHTS.lineFilter);
    expect(TECHNIQUE_WEIGHTS.lineFilter).toBeLessThan(TECHNIQUE_WEIGHTS.forcingChain);
    for (const puzzle of [SKYSCRAPERS_FIXTURE_5X5, SKYSCRAPERS_FIXTURE_7X7]) {
      const score = scoreSkyscrapersSolve(new SkyscrapersLogicalSolver(puzzle).solve());
      expect(score.densityFactor).toBeGreaterThanOrEqual(0.5);
      expect(score.densityFactor).toBeLessThanOrEqual(2);
      expect(score.final).toBeCloseTo(score.raw * score.densityFactor, 6);
    }
  });

  it('scores the chain-tier 7×7 above the line-filter-tier 5×5', () => {
    const five = scoreSkyscrapersSolve(new SkyscrapersLogicalSolver(SKYSCRAPERS_FIXTURE_5X5).solve());
    const seven = scoreSkyscrapersSolve(new SkyscrapersLogicalSolver(SKYSCRAPERS_FIXTURE_7X7).solve());
    expect(seven.final).toBeGreaterThan(five.final);
  });
});
