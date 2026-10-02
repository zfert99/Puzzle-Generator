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
 * (`SKYSCRAPERS_TIERS_BY_SIZE`, D12 — kept in `skyscrapers-types.ts` so the client-side pickers
 * can read it without this module's generator and solvers) and the routes refuse it up front.
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

import { generateUniqueSkyscrapers, tierOf, type GeneratedSkyscrapers } from './skyscrapers-generator';
import {
  SKYSCRAPERS_LADDER,
  SKYSCRAPERS_TIERS_BY_SIZE,
  isSkyscrapersLevelOffered,
  type SkyscrapersLevel,
  type SkyscrapersPuzzle,
  type SkyscrapersSize,
} from './skyscrapers-types';

export { SKYSCRAPERS_TIERS_BY_SIZE, isSkyscrapersLevelOffered };

/** The serving knobs. */
export interface GenerateSkyscrapersOptions {
  gridSize?: SkyscrapersSize;
  rng?: () => number;
  /** Wall-clock budget for the whole call — every square, repair and removal shares it. */
  timeBudgetMs?: number;
}

/** `error.name` when a level is asked for at a size that does not offer it — the caller's mistake, never a budget question. */
export const SKYSCRAPERS_LEVEL_NOT_OFFERED_ERROR = 'SkyscrapersLevelNotOfferedError';

export function isSkyscrapersLevelNotOfferedError(error: unknown): error is Error {
  return error instanceof Error && error.name === SKYSCRAPERS_LEVEL_NOT_OFFERED_ERROR;
}

/**
 * A fresh, unique Skyscrapers at exactly the requested tier, with the generator's cost
 * (`stats`: rounds drawn, repair swaps and restarts, clues kept, ms) for the route's log. Throws
 * `SKYSCRAPERS_LEVEL_NOT_OFFERED_ERROR` when the size does not offer the level (the routes refuse
 * it first) or a plain error when the budget runs out without a puzzle — measured at 0 failures
 * in the benchmark and the gate run, so that throw is a real fault, not a path the routes expect.
 */
export function generateSkyscrapersDetailed(difficulty: SkyscrapersLevel, options: GenerateSkyscrapersOptions = {}): GeneratedSkyscrapers {
  const { gridSize = 6, rng = Math.random, timeBudgetMs = 20_000 } = options;
  if (!isSkyscrapersLevelOffered(gridSize, difficulty)) {
    throw Object.assign(
      new Error(`Skyscrapers ${gridSize}×${gridSize} does not offer ${difficulty} (offered: ${SKYSCRAPERS_TIERS_BY_SIZE[gridSize].join(', ')})`),
      { name: SKYSCRAPERS_LEVEL_NOT_OFFERED_ERROR }
    );
  }
  const generated = generateUniqueSkyscrapers({ gridSize, rng, targetTier: tierOf(difficulty), exactTier: true, maxRounds: Infinity, timeBudgetMs });
  if (!generated) throw new Error(`Skyscrapers generation failed: no ${difficulty} ${gridSize}×${gridSize} within ${timeBudgetMs} ms`);
  return generated;
}

/** `generateSkyscrapersDetailed` without the stats — the puzzle alone, for callers that only serve it. */
export function generateSkyscrapers(difficulty: SkyscrapersLevel, options: GenerateSkyscrapersOptions = {}): SkyscrapersPuzzle {
  return generateSkyscrapersDetailed(difficulty, options).puzzle;
}

/** `error.name` of the batch's out-of-time error — a request too large for its budget, not a fault. */
export const SKYSCRAPERS_BUDGET_ERROR = 'SkyscrapersBudgetError';

export function isSkyscrapersBudgetError(error: unknown): error is Error {
  return error instanceof Error && error.name === SKYSCRAPERS_BUDGET_ERROR;
}

/** The batch's knobs: the serving knobs plus a seam for tests to stand in for the generator. */
export interface GenerateSkyscrapersBatchOptions extends GenerateSkyscrapersOptions {
  /** Per-puzzle floor on the fair share (5 s); tests lower it to exercise the retry path. */
  minShareMs?: number;
  /** The one-puzzle generator — `generateSkyscrapers` in production; tests inject a stand-in. */
  generateOne?: (difficulty: SkyscrapersLevel, options: GenerateSkyscrapersOptions) => SkyscrapersPuzzle;
}

/**
 * The puzzles for a `/api/generate` request, in ladder order — the Kakuro batch contract: **one
 * budget for the whole batch** (default 45 s, inside the route's 60 s `maxDuration` with the PDF
 * render to spare), each puzzle handed a fair share of what is left (up to four times the
 * average, at least `minShareMs`) so one slow generation is retried rather than allowed to starve
 * the rest, and the batch's own clock running out is the only out-of-time error. A level the size
 * does not offer is rethrown as it is — the caller's error, not a budget question.
 */
export function generateSkyscrapersBatch(counts: Partial<Record<SkyscrapersLevel, number>>, options: GenerateSkyscrapersBatchOptions = {}): SkyscrapersPuzzle[] {
  const { timeBudgetMs = 45_000, minShareMs = 5_000, generateOne = generateSkyscrapers, ...each } = options;
  const started = performance.now();
  const wanted = SKYSCRAPERS_LADDER.reduce((sum, level) => sum + (counts[level] ?? 0), 0);
  const puzzles: SkyscrapersPuzzle[] = [];
  const outOfTime = () =>
    Object.assign(new Error(`Skyscrapers batch ran out of time after ${puzzles.length} of ${wanted} puzzles (${timeBudgetMs} ms budget)`), { name: SKYSCRAPERS_BUDGET_ERROR });
  for (const level of SKYSCRAPERS_LADDER) {
    for (let i = 0; i < (counts[level] ?? 0); i++) {
      const remaining = timeBudgetMs - (performance.now() - started);
      if (remaining <= 0) throw outOfTime();
      const share = Math.min(remaining, Math.max(minShareMs, (4 * remaining) / (wanted - puzzles.length)));
      try {
        puzzles.push(generateOne(level, { ...each, timeBudgetMs: share }));
      } catch (error) {
        if (isSkyscrapersLevelNotOfferedError(error)) throw error;
        // A puzzle that missed its share is retried on the next share while the batch has time;
        // only the batch's own clock running out is the out-of-time error.
        if (timeBudgetMs - (performance.now() - started) <= 0) throw outOfTime();
        i--;
      }
    }
  }
  return puzzles;
}
