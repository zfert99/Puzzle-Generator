/**
 * Skyscrapers' public entry point — `generateSkyscrapers(difficulty, { gridSize })` and
 * `generateSkyscrapersBatch(counts, { gridSize })`, the counterparts of `generateKakuro` /
 * `generateKakuroBatch` for `/api/puzzle`, `/api/generate` and (R1) the daily.
 *
 * **E5 form: exactly the requested tier, from the tiers the size offers.** `generateUniqueSkyscrapers`
 * makes a fresh unique puzzle with its clue removal bounded by the requested tier; with
 * `exactTier` it keeps drawing squares until the classifier's tier *is* the request — a square's
 * fully clued floor and a removal order decide where a puzzle lands, and a fresh square is the
 * cheapest way to a different landing (E4 measured the exact-hit rate per round at 6–100% by
 * cell; see `skyscrapers.md`). The label is the classifier's own (D7), so it equals the request
 * by construction. E4's unbounded fallback is gone: a tier a size cannot produce is not offered
 * (`SKYSCRAPERS_TIERS_BY_SIZE`, D12) and the routes refuse it up front instead of serving
 * something else.
 *
 * **Why no score bands or removal-order configs per size (the plan's E5 list).** As for Kakuro's
 * E5: the tiers are the solver's ordinal levels (D6 — the weakest technique level that finishes
 * the puzzle), so there are no bands to calibrate, and the order bias (trivial clues last for
 * easy/medium, first for hard+) already lives in `removeClues`' defaults; a per-size table would
 * hold the same two words three times. The research's Stage-4 tier-flip rules are the
 * classifier's own definition (hardest rung needed), not a post-pass.
 *
 * See `skyscrapers.md`.
 */

import { generateUniqueSkyscrapers, tierOf } from './skyscrapers-generator';
import { SKYSCRAPERS_LADDER, type SkyscrapersLevel, type SkyscrapersPuzzle, type SkyscrapersSize } from './skyscrapers-types';

/**
 * The tiers each size offers (D12, settled by E3/E4's measurements). The 5×5 mini ships
 * easy / medium / hard — hard is the rare one there (8% of squares) but reachable in tens of
 * milliseconds; expert and extreme are locked as on every other mini. The 6×6 standard offers
 * the full ladder. The 7×7 large starts at medium: an easy 7×7 floor is one square in fifty
 * (3.5 s per puzzle, E4), not a tier to promise.
 */
export const SKYSCRAPERS_TIERS_BY_SIZE: Record<SkyscrapersSize, readonly SkyscrapersLevel[]> = {
  5: ['easy', 'medium', 'hard'],
  6: ['easy', 'medium', 'hard', 'expert', 'extreme'],
  7: ['medium', 'hard', 'expert', 'extreme'],
};

/** Whether a size offers a level — the one check the routes and the pickers share. */
export function isSkyscrapersLevelOffered(gridSize: SkyscrapersSize, level: SkyscrapersLevel): boolean {
  return SKYSCRAPERS_TIERS_BY_SIZE[gridSize].includes(level);
}

/** The serving knobs. */
export interface GenerateSkyscrapersOptions {
  gridSize?: SkyscrapersSize;
  rng?: () => number;
  /** Wall-clock budget for the whole call — every square, repair and removal shares it. */
  timeBudgetMs?: number;
}

/**
 * A fresh, unique Skyscrapers at exactly the requested tier, labelled by the classifier. Throws
 * when the size does not offer the level (a caller's fault — the routes refuse it first) or when
 * the budget runs out without one (measured at 0 failures in 20 per offered cell with the default
 * budget, so a throw is a real fault, not a path the routes expect).
 */
export function generateSkyscrapers(difficulty: SkyscrapersLevel, options: GenerateSkyscrapersOptions = {}): SkyscrapersPuzzle {
  const { gridSize = 6, rng = Math.random, timeBudgetMs = 20_000 } = options;
  if (!isSkyscrapersLevelOffered(gridSize, difficulty)) {
    throw new Error(`Skyscrapers ${gridSize}×${gridSize} does not offer ${difficulty} (offered: ${SKYSCRAPERS_TIERS_BY_SIZE[gridSize].join(', ')})`);
  }
  const generated = generateUniqueSkyscrapers({ gridSize, rng, targetTier: tierOf(difficulty), exactTier: true, maxRounds: Infinity, timeBudgetMs });
  if (!generated) throw new Error(`Skyscrapers generation failed: no ${difficulty} ${gridSize}×${gridSize} within ${timeBudgetMs} ms`);
  return generated.puzzle;
}

/** `error.name` of the batch's out-of-time error — a request too large for its budget, not a fault. */
export const SKYSCRAPERS_BUDGET_ERROR = 'SkyscrapersBudgetError';

export function isSkyscrapersBudgetError(error: unknown): error is Error {
  return error instanceof Error && error.name === SKYSCRAPERS_BUDGET_ERROR;
}

/**
 * The puzzles for a `/api/generate` request, in ladder order — the Kakuro batch contract: **one
 * budget for the whole batch** (default 45 s, inside the route's 60 s `maxDuration` with the PDF
 * render to spare), each puzzle handed a fair share of what is left (up to four times the
 * average, at least 5 s) so one slow generation is retried rather than allowed to starve the
 * rest, and the batch's own clock running out is the only out-of-time error.
 */
export function generateSkyscrapersBatch(counts: Partial<Record<SkyscrapersLevel, number>>, options: GenerateSkyscrapersOptions = {}): SkyscrapersPuzzle[] {
  const { timeBudgetMs = 45_000, ...each } = options;
  const started = performance.now();
  const wanted = SKYSCRAPERS_LADDER.reduce((sum, level) => sum + (counts[level] ?? 0), 0);
  const puzzles: SkyscrapersPuzzle[] = [];
  const outOfTime = () =>
    Object.assign(new Error(`Skyscrapers batch ran out of time after ${puzzles.length} of ${wanted} puzzles (${timeBudgetMs} ms budget)`), { name: SKYSCRAPERS_BUDGET_ERROR });
  for (const level of SKYSCRAPERS_LADDER) {
    for (let i = 0; i < (counts[level] ?? 0); i++) {
      const remaining = timeBudgetMs - (performance.now() - started);
      if (remaining <= 0) throw outOfTime();
      const share = Math.min(remaining, Math.max(5_000, (4 * remaining) / (wanted - puzzles.length)));
      try {
        puzzles.push(generateSkyscrapers(level, { ...each, timeBudgetMs: share }));
      } catch (error) {
        // A level the size does not offer is the caller's error, not a budget question.
        if (error instanceof Error && error.message.includes('does not offer')) throw error;
        if (timeBudgetMs - (performance.now() - started) <= 0) throw outOfTime();
        i--;
      }
    }
  }
  return puzzles;
}
