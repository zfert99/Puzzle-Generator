/**
 * Kakuro's public entry point — `generateKakuro(difficulty, { gridSize })`, the counterpart of
 * `generateKillerSudoku` / `generateCalcSudoku` for `/api/puzzle`.
 *
 * **E4 form (this file): targeting by bounded rejection.** `generateUniqueKakuro` makes a fresh
 * unique puzzle and the classifier says what tier it came out as; this loop keeps asking until
 * the tier is the one requested or the budget is spent. The natural distribution at these
 * densities is hard-heavy (research findings §3c: hard ≈ 45%, expert ≈ 25%, extreme ≈ 15%,
 * medium ≈ 10%, easy ≈ 1–3%), so hard/expert/extreme land in one or two tries and medium in a
 * handful, while easy usually exhausts the budget. When it does: a baked fixture of the exact
 * tier if the size has one (7×7 and 9×9 — the same puzzle every time, as before E4), else the
 * generated puzzle whose tier is nearest, **labelled with its real tier** (D8: a label comes
 * from the classifier or not at all — never the request dressed as a grade).
 *
 * **E5 replaces the loop**, not the contract: the classifier moves into the repair objective
 * (search *for* a tier rather than wait for one), density is biased per tier, and the fallback
 * disappears. `DIFFICULTY_CONFIG` below is the starting point that calibration rewrites.
 *
 * See `kakuro.md`.
 */

import { findKakuroFixture } from './kakuro-fixtures';
import { generateUniqueKakuro } from './kakuro-generator';
import { KAKURO_LADDER, type KakuroLevel, type KakuroPuzzle } from './kakuro-types';

/** The sizes Kakuro ships (D6′): the 6×6 mini, 7×7, and the 9×9 standard. */
export const KAKURO_SIZES = [6, 7, 9] as const;
export type KakuroSize = (typeof KAKURO_SIZES)[number];

/**
 * Per size: the black density the generator targets. Measured in E4 as the band where repair
 * converges fast at every size (findings §3b: a floor near 35% at 9×9; 6×6 likes it denser).
 * Per-tier bias is E5's.
 */
export const DIFFICULTY_CONFIG: Record<KakuroSize, { blackDensity: number }> = {
  6: { blackDensity: 0.4 },
  7: { blackDensity: 0.37 },
  9: { blackDensity: 0.38 },
};

export interface GenerateKakuroOptions {
  gridSize?: KakuroSize;
  rng?: () => number;
  /** Fresh puzzles to try for the requested tier before falling back. */
  attempts?: number;
  /** Wall-clock budget for those attempts. */
  timeBudgetMs?: number;
}

export interface GenerateKakuroResult {
  puzzle: KakuroPuzzle;
  /** `generated` with the requested tier; `fixture` when a baked one stood in; `nearest` when a generated puzzle of another tier did. */
  source: 'generated' | 'fixture' | 'nearest';
  attempts: number;
}

const tierIndex = (difficulty: string) => KAKURO_LADDER.indexOf(difficulty as KakuroLevel);

/** The puzzle, with where it came from — the route logs the source so E5 can see the fallback rate. */
export function generateKakuroDetailed(difficulty: KakuroLevel, options: GenerateKakuroOptions = {}): GenerateKakuroResult {
  const { gridSize = 7, rng = Math.random, attempts = 12, timeBudgetMs = 6_000 } = options;
  const { blackDensity } = DIFFICULTY_CONFIG[gridSize];
  const started = performance.now();
  let nearest: KakuroPuzzle | null = null;
  let tried = 0;
  while (tried < attempts && performance.now() - started < timeBudgetMs) {
    tried++;
    const puzzle = generateUniqueKakuro({ gridSize, blackDensity, rng });
    if (!puzzle) continue;
    if (puzzle.difficulty === difficulty) return { puzzle, source: 'generated', attempts: tried };
    if (puzzle.difficulty === 'unrated') continue;
    if (!nearest || Math.abs(tierIndex(puzzle.difficulty) - tierIndex(difficulty)) < Math.abs(tierIndex(nearest.difficulty) - tierIndex(difficulty))) {
      nearest = puzzle;
    }
  }
  const fixture = findKakuroFixture(gridSize, difficulty);
  if (fixture) return { puzzle: fixture, source: 'fixture', attempts: tried };
  if (nearest) return { puzzle: nearest, source: 'nearest', attempts: tried };
  // Every attempt failed to repair and the size has no fixtures: one more, unbounded by the
  // tier, so the caller always gets a playable puzzle (the generator's own rounds are bounded).
  const last = generateUniqueKakuro({ gridSize, blackDensity, rng, maxRounds: 20 });
  if (!last) throw new Error(`Kakuro generation failed at ${gridSize}×${gridSize}`);
  return { puzzle: last, source: 'nearest', attempts: tried + 1 };
}

/** A playable Kakuro at the requested tier where the budget allows — see the module note. */
export function generateKakuro(difficulty: KakuroLevel, options: GenerateKakuroOptions = {}): KakuroPuzzle {
  return generateKakuroDetailed(difficulty, options).puzzle;
}
