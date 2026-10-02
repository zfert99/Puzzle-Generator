/**
 * Skyscrapers' public entry point — `generateSkyscrapers(difficulty, { gridSize })`, the
 * counterpart of `generateKakuro` for `/api/puzzle` (and, from E5, `/api/generate` and the daily).
 *
 * **E4 form: the request bounds the removal, the label is the classifier's.** The clue removal
 * never exceeds the requested tier, but the puzzle may land below it; and a size may have no
 * square at the requested tier at all (E3: an easy 7×7 floor is one square in fifty), so after a
 * dozen squares whose fully clued floor sits above the target the request is served
 * **unbounded** — labelled honestly, flagged `fallback` for the log. Landing *exactly* on the
 * request and deciding which tiers a size offers is E5's job (the Kakuro E5 shape: the classifier
 * in the objective); this module is where that policy will live, so the route stays a controller
 * (AGENTS.md §1). See `skyscrapers.md`.
 */

import { generateUniqueSkyscrapers, tierOf, type GeneratedSkyscrapers } from './skyscrapers-generator';
import type { SkyscrapersLevel, SkyscrapersSize } from './skyscrapers-types';

/** The serving knobs; `timeBudgetMs` covers the bounded attempt and the fallback together. */
export interface GenerateSkyscrapersOptions {
  gridSize?: SkyscrapersSize;
  rng?: () => number;
  /** Wall-clock budget for both attempts; the bounded attempt gets three quarters of it. */
  timeBudgetMs?: number;
}

/** What was served: the puzzle, its cost, and whether the request's tier bound had to be dropped. */
export interface ServedSkyscrapers extends GeneratedSkyscrapers {
  /** `true` when no square at or below the requested tier was found and the puzzle was made unbounded. */
  fallback: boolean;
}

/** Squares whose all-clue floor sits above the target before the bounded attempt gives up (E4 gate run). */
const MAX_FLOOR_MISSES = 12;
const MAX_BOUNDED_ROUNDS = 40;

/**
 * A fresh, unique Skyscrapers no harder than the requested tier, or — when the size has none —
 * an unbounded one labelled as what it is. Throws only when both attempts exhaust the budget
 * (measured at 0 in 100 per size and level), so a throw is a real fault, not an expected path.
 */
export function generateSkyscrapers(difficulty: SkyscrapersLevel, options: GenerateSkyscrapersOptions = {}): ServedSkyscrapers {
  const { gridSize = 6, rng = Math.random, timeBudgetMs = 8_000 } = options;
  const started = performance.now();
  const bounded = generateUniqueSkyscrapers({
    gridSize,
    rng,
    targetTier: tierOf(difficulty),
    maxRounds: MAX_BOUNDED_ROUNDS,
    maxFloorMisses: MAX_FLOOR_MISSES,
    timeBudgetMs: timeBudgetMs * 0.75,
  });
  if (bounded) return { ...bounded, fallback: false };
  const unbounded = generateUniqueSkyscrapers({ gridSize, rng, timeBudgetMs: timeBudgetMs - (performance.now() - started) });
  if (!unbounded) throw new Error(`Skyscrapers generation failed: no ${gridSize}×${gridSize} within ${timeBudgetMs} ms`);
  return { ...unbounded, fallback: true };
}
