/**
 * Kakuro's public entry point — `generateKakuro(difficulty, { gridSize })`, the counterpart of
 * `generateKillerSudoku` / `generateCalcSudoku` for `/api/puzzle` and `/api/generate`.
 *
 * **E5 form: the classifier in the objective.** `generateUniqueKakuro` makes a fresh unique
 * puzzle, then `walkToTier` climbs it — keeping it unique — until the logical solver's hardest
 * tier is exactly the one requested, and the classifier's label is the result. No fallback
 * and no fixture: every served puzzle is fresh and carries the grade it earned (D8), and the
 * request's tier is reached rather than waited for. E4's bounded rejection (which could not
 * reach easy — it is 1–3% of natural output) is gone. Measured per size and tier in
 * `benchmark-kakuro.ts`; the table is in `kakuro.md`.
 *
 * `DIFFICULTY_CONFIG` is one density per size: the tier walk makes per-tier layout bias
 * unnecessary at these sizes (every target is reached from the natural distribution in well
 * under a second), so the lever E3 found stays a size knob. Tiers are the solver's ordinal
 * levels (D5′, G9 — the weakest technique level that finishes the puzzle); there are no score
 * bands to calibrate, which is why none appear here.
 *
 * See `kakuro.md`.
 */

import { generateUniqueKakuro } from './kakuro-generator';
import { type KakuroTier } from './kakuro-logical-solver';
import { KAKURO_LADDER, type KakuroLevel, type KakuroPuzzle } from './kakuro-types';

/** The sizes Kakuro ships (D6′): the 6×6 mini, 7×7, and the 9×9 standard. */
export const KAKURO_SIZES = [6, 7, 9] as const;
export type KakuroSize = (typeof KAKURO_SIZES)[number];

/**
 * Per size: the black density the generator targets. Measured in E4 as the band where repair
 * converges fast at every size (findings §3b: a floor near 35% at 9×9; 6×6 likes it denser).
 */
export const DIFFICULTY_CONFIG: Record<KakuroSize, { blackDensity: number }> = {
  6: { blackDensity: 0.4 },
  7: { blackDensity: 0.37 },
  9: { blackDensity: 0.38 },
};

export interface GenerateKakuroOptions {
  gridSize?: KakuroSize;
  rng?: () => number;
  /** Wall-clock budget for the whole call — layout, fill, repair and the tier walk share it. */
  timeBudgetMs?: number;
}

/**
 * The puzzles for a `/api/generate` request — the Kakuro counterpart of `generateKillerBatch`,
 * in ladder order. **One budget for the whole batch:** each puzzle is handed what is left of
 * `timeBudgetMs` (default 45 s — inside the route's 60 s `maxDuration` with the PDF render to
 * spare), and when it runs out the batch throws rather than letting the function time out
 * half-way through a booklet (a review finding: 50 puzzles × a 20 s per-call budget was bounded
 * by construction at 1 000 s). At the measured averages a full 50-puzzle 9×9 batch is ~15–30 s.
 */
export function generateKakuroBatch(counts: Partial<Record<KakuroLevel, number>>, options: GenerateKakuroOptions = {}): KakuroPuzzle[] {
  const { timeBudgetMs = 45_000, ...each } = options;
  const started = performance.now();
  const puzzles: KakuroPuzzle[] = [];
  for (const level of KAKURO_LADDER) {
    for (let i = 0; i < (counts[level] ?? 0); i++) {
      const remaining = timeBudgetMs - (performance.now() - started);
      if (remaining <= 0) throw new Error(`Kakuro batch ran out of time after ${puzzles.length} puzzles (${timeBudgetMs} ms budget)`);
      puzzles.push(generateKakuro(level, { ...each, timeBudgetMs: remaining }));
    }
  }
  return puzzles;
}

/** The ladder's tier for a published level — `KAKURO_LADDER` is in tier order. */
export function tierOf(difficulty: KakuroLevel): KakuroTier {
  return (KAKURO_LADDER.indexOf(difficulty) + 1) as KakuroTier;
}

/**
 * A fresh, unique Kakuro at exactly the requested tier. Throws when the budget runs out
 * without one — measured at 0 failures in hundreds per tier and size, so a throw is a real
 * fault (a budget far too small, or a regression), not a path the route expects.
 */
export function generateKakuro(difficulty: KakuroLevel, options: GenerateKakuroOptions = {}): KakuroPuzzle {
  const { gridSize = 7, rng = Math.random, timeBudgetMs = 20_000 } = options;
  const { blackDensity } = DIFFICULTY_CONFIG[gridSize];
  const puzzle = generateUniqueKakuro({ gridSize, blackDensity, rng, timeBudgetMs, maxRounds: 50, targetTier: tierOf(difficulty) });
  if (!puzzle) throw new Error(`Kakuro generation failed: no ${difficulty} ${gridSize}×${gridSize} within ${timeBudgetMs} ms`);
  return puzzle;
}
