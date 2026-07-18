/**
 * Two-factor difficulty scoring for Killer Sudoku — Andrew Stuart's architecture (see
 * `Docs/research/killer-difficulty-grading-systems.md`): a puzzle's difficulty is BOTH how much
 * of what work it demands (weighted technique sum) AND how bottlenecked that work is
 * (opportunity density). The hardest-technique tier stays the primary band (the generator's
 * `solveCap`); this score orders puzzles *within* a band, so a grindy, narrow tier-2 puzzle can
 * outrank a breezy tier-3 one — matching how the puzzles actually play.
 *
 * `final = raw × densityFactor`, where `raw = Σ weight(technique) × applications` and the
 * density factor scales up bottlenecked grids (few parallel moves) and down open ones.
 */

import type { KillerSolveResult, KillerTechnique } from './killer-logical-solver';

/**
 * Per-application weights on the Sudoku Explainer 1.0–11.9 scale (the community's defensible
 * backbone — see research), with the Killer-specific techniques slotted per SudokuWiki's
 * ordering: cage arithmetic is foundational (fires constantly, weighted like a basic
 * elimination), single-house Rule of 45 ≈ single-cell innies (3.5), multi-unit regions ≈
 * multi-cell innies/outies (4.5). Absolute values matter less than ratios: difficulty bands are
 * *relative* cuts over measured score distributions (Stuart's sextile approach), re-calibrated
 * whenever weights change.
 */
export const TECHNIQUE_WEIGHTS: Record<KillerTechnique, number> = {
  cageArithmetic: 1.0,
  nakedSingle: 0.2,
  hiddenSingle: 0.5,
  ruleOf45: 3.5,
  cageConsistentDigits: 3.0,
  nakedPair: 3.0,
  hiddenPair: 3.4,
  ruleOf45Regions: 4.5,
  pointingPairs: 2.6,
  xWing: 3.2,
  swordfish: 3.8,
  yWing: 4.2,
  xyzWing: 4.4,
  wWing: 4.4,
  alsXZ: 7.5,
  aic: 7.0,
};

export interface KillerScore {
  /** Σ weight × applications — total solving work, sophistication-weighted. */
  raw: number;
  /** Opportunity-density multiplier in [0.5, 2]: bottlenecked grids score up, open grids down. */
  densityFactor: number;
  /** `raw × densityFactor` — the two-factor difficulty score. */
  final: number;
}

/**
 * Score a solve. The density factor maps mean parallel-singles availability onto [0.5, 2]:
 * a grid averaging 0 open singles per pass (every step must be earned) doubles its raw score;
 * one averaging 6+ (moves everywhere) halves it. `2 / (1 + avgOpen / 2)` was chosen for shape —
 * monotone, gentle, centred near 1 at avgOpen ≈ 2 (the observed easy-tier norm) — and clamped;
 * band thresholds are calibrated against measured distributions, so only monotonicity is
 * load-bearing.
 */
export function scoreKillerSolve(result: KillerSolveResult): KillerScore {
  let raw = 0;
  for (const technique of Object.keys(result.techniqueCounts) as KillerTechnique[]) {
    raw += TECHNIQUE_WEIGHTS[technique] * (result.techniqueCounts[technique] ?? 0);
  }
  const densityFactor = Math.min(2, Math.max(0.5, 2 / (1 + result.avgOpenSingles / 2)));
  return { raw, densityFactor, final: raw * densityFactor };
}
