/**
 * Two-factor difficulty scoring for Kakuro — the same architecture as `killer-score.ts`
 * (Andrew Stuart's): a puzzle's difficulty is BOTH how much of what work it demands (weighted
 * technique sum) AND how bottlenecked that work is (opportunity density). The hardest-tier grade
 * from the logical solver stays the primary band; this score orders puzzles *within* a band.
 *
 * `final = raw × densityFactor`, where `raw = Σ weight(technique) × applications` and the
 * density factor scales up bottlenecked grids (few parallel moves) and down open ones.
 */

import type { KakuroSolveResult, KakuroTechnique } from './kakuro-logical-solver';

/**
 * Per-application weights, seeded from the ladder order (plan E2: "weights seeded from the
 * ladder order; re-fit in E5"). Absolute values matter less than ratios — bands are relative
 * cuts over measured distributions, recalibrated whenever weights change. Tier 1 work is
 * near-free (the opening every player makes), tier 2 is routine, tier 3 is where the puzzle is.
 */
export const TECHNIQUE_WEIGHTS: Record<KakuroTechnique, number> = {
  comboRestriction: 0.3,
  nakedSingle: 0.2,
  hiddenSingle: 1.0,
  feasibleCombos: 1.5,
  nakedSubset: 3.0,
  hiddenSubset: 3.4,
  sumBounds: 3.0,
  runAssignments: 4.0,
};

export interface KakuroScore {
  /** Σ weight × applications — total solving work, sophistication-weighted. */
  raw: number;
  /** Opportunity-density multiplier in [0.5, 2]: bottlenecked grids score up, open grids down. */
  densityFactor: number;
  /** `raw × densityFactor` — the two-factor difficulty score. */
  final: number;
}

/**
 * Score a solve. The density mapping is the one `scoreKillerSolve` uses — `2 / (1 + avgOpen / 2)`,
 * clamped to [0.5, 2] — kept identical so the two engines' within-band orderings are comparable
 * in spirit; only monotonicity is load-bearing (bands are calibrated against measurements).
 */
export function scoreKakuroSolve(result: KakuroSolveResult): KakuroScore {
  let raw = 0;
  for (const technique of Object.keys(result.techniqueCounts) as KakuroTechnique[]) {
    raw += TECHNIQUE_WEIGHTS[technique] * (result.techniqueCounts[technique] ?? 0);
  }
  const densityFactor = Math.min(2, Math.max(0.5, 2 / (1 + result.avgOpenSingles / 2)));
  return { raw, densityFactor, final: raw * densityFactor };
}
