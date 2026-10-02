/**
 * Two-factor difficulty scoring for Skyscrapers — the `kakuro-score.ts` / `killer-score.ts`
 * architecture (Andrew Stuart's): a puzzle's difficulty is BOTH how much of what work it demands
 * (weighted technique sum) AND how bottlenecked that work is (opportunity density — Pelánek's
 * dependency structure). The hardest-tier grade from the logical solver stays the primary band;
 * this score orders puzzles *within* a band.
 *
 * `final = raw × densityFactor`, where `raw = Σ weight(technique) × applications` and the
 * density factor scales up bottlenecked grids (few parallel moves) and down open ones.
 */

import type { SkyscrapersSolveResult, SkyscrapersTechnique } from './skyscrapers-logical-solver';

/**
 * Per-application weights, seeded from the ladder order (plan E2: "weights seeded from the
 * ladder order; re-fit in E5"). Absolute values matter less than ratios — bands are relative
 * cuts over measured distributions, recalibrated whenever weights change. The one-move clues
 * are near-free (the opening every player makes), the clue-2 patterns routine, line filtering
 * is where a hard puzzle lives — and the one-line arrangement scan is priced by its band (E3
 * findings §3c): a scan of ≤ 3 arrangements near tier-1 work, ≤ 12 as a routine enumeration.
 */
export const TECHNIQUE_WEIGHTS: Record<SkyscrapersTechnique, number> = {
  clueN: 0.2,
  clue1: 0.2,
  facingSum: 0.3,
  positionBound: 0.3,
  nearlyFilledClue: 0.6,
  nakedSingle: 0.2,
  hiddenSingle: 0.8,
  lineScan: 0.6,
  clue2Pattern: 1.2,
  reachability: 1.5,
  lineEnumeration: 1.6,
  lineFilter: 3.0,
  nakedSubset: 3.0,
  hiddenSubset: 3.4,
  xWing: 5.0,
  forcingChain: 8.0,
};

export interface SkyscrapersScore {
  /** Σ weight × applications — total solving work, sophistication-weighted. */
  raw: number;
  /** Opportunity-density multiplier in [0.5, 2]: bottlenecked grids score up, open grids down. */
  densityFactor: number;
  /** `raw × densityFactor` — the two-factor difficulty score. */
  final: number;
}

/** Score a solve — the same density mapping as the Killer and Kakuro scorers, for comparability. */
export function scoreSkyscrapersSolve(result: SkyscrapersSolveResult): SkyscrapersScore {
  let raw = 0;
  for (const technique of Object.keys(result.techniqueCounts) as SkyscrapersTechnique[]) {
    raw += TECHNIQUE_WEIGHTS[technique] * (result.techniqueCounts[technique] ?? 0);
  }
  const densityFactor = Math.min(2, Math.max(0.5, 2 / (1 + result.avgOpenSingles / 2)));
  return { raw, densityFactor, final: raw * densityFactor };
}
