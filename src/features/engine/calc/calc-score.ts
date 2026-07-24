/**
 * Two-factor difficulty scoring for Keisan (Calcudoku) — the same architecture as Killer's
 * `killer-score.ts` (Andrew Stuart's model; see `Docs/research/killer-difficulty-grading-systems.md`):
 * a puzzle's difficulty is BOTH how much weighted work it demands AND how bottlenecked that work
 * is. The hardest-technique tier stays the primary ceiling (the generator's `solveCap`); this score
 * orders puzzles *within* a band.
 *
 * This matters more for Keisan than Killer: K3 measured that most small-cage Keisan puzzles solve at
 * tiers 1–2, so the tier ceiling barely separates difficulties — the score does the real work.
 *
 * `final = raw × densityFactor`, where `raw = Σ weight(technique) × applications` and the density
 * factor scales up bottlenecked grids (few parallel moves) and down open ones.
 */

import type { CalcSolveResult, CalcTechnique } from './calc-logical-solver';

/**
 * Per-application weights on the Sudoku-Explainer-ish scale (ratios matter more than absolutes —
 * bands are relative cuts over measured distributions, recalibrated whenever weights change). Cage
 * arithmetic is foundational (fires constantly, weighted like a basic elimination); cage-combo
 * restriction and the line-sum invariant are the multi-cell reasoning steps (≈ Killer's
 * multi-cell innies/outies); X-Wing matches its classic weight.
 */
export const CALC_TECHNIQUE_WEIGHTS: Record<CalcTechnique, number> = {
  cageArithmetic: 1.0,
  nakedSingle: 0.2,
  hiddenSingle: 0.5,
  nakedPair: 3.0,
  hiddenPair: 3.4,
  cageComboRestriction: 4.5,
  lineSum: 3.5,
  xWing: 3.2,
};

export interface CalcScore {
  /** Σ weight × applications — total solving work, sophistication-weighted. */
  raw: number;
  /** Opportunity-density multiplier in [0.5, 2]: bottlenecked grids score up, open grids down. */
  densityFactor: number;
  /** `raw × densityFactor` — the two-factor difficulty score. */
  final: number;
}

/**
 * Score a logical solve. The density factor maps mean parallel-singles availability onto [0.5, 2]:
 * a grid averaging 0 open singles per pass (every step must be earned) doubles its raw score; one
 * averaging 6+ (moves everywhere) halves it. `2 / (1 + avgOpen / 2)` is monotone, gentle, centred
 * near 1 at avgOpen ≈ 2, and clamped; only monotonicity is load-bearing since bands are calibrated
 * against measured distributions.
 */
export function scoreCalcSolve(result: CalcSolveResult): CalcScore {
  let raw = 0;
  for (const technique of Object.keys(result.techniqueCounts) as CalcTechnique[]) {
    raw += CALC_TECHNIQUE_WEIGHTS[technique] * (result.techniqueCounts[technique] ?? 0);
  }
  const densityFactor = Math.min(2, Math.max(0.5, 2 / (1 + result.avgOpenSingles / 2)));
  return { raw, densityFactor, final: raw * densityFactor };
}
