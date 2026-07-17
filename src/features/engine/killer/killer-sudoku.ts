/**
 * The Killer Sudoku generation pipeline — assembles K1–K3 into a `generateKillerSudoku` that
 * emits a **uniquely-solvable** puzzle.
 *
 * Pipeline: solved grid (reuse the classic engine's `fillGrid`) → random cage partition (K3) →
 * uniqueness gate via the exact solver (K2). Repeat until unique — measured to converge in a
 * few attempts (~38–83% of random partitions are already unique, depending on cage size), so a
 * plain regenerate loop suffices; no ambiguity-repair machinery needed.
 *
 * NOTE: difficulty is not yet GRADED — that's K4. Here `difficulty` only tunes generation
 * params (cage size) and is stamped provisionally; it is not a verified band. See
 * `killer-sudoku.md`.
 */

import { getGridConfig, type Difficulty } from '../sudoku';
import { createEmptyGrid, copyGrid, fillGrid } from '../grid-utils';
import { generateCages } from './cage-generator';
import { KillerSolver } from './killer-solver';
import type { KillerPuzzle } from './killer-types';

const GRID_SIZE = 9;

/**
 * Provisional cage-size cap per difficulty (smaller cages → more sum clues → easier and more
 * often unique). A rough lever until K4 grades puzzles by the techniques they actually need.
 */
const MAX_SIZE_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 4,
  expert: 4,
  extreme: 4,
};

export interface KillerGenOptions {
  /** RNG for cage generation (default `Math.random`). Inject a seeded PRNG for determinism. */
  rng?: () => number;
  /** A solved grid to build on. Default: a fresh random solution via `fillGrid` per attempt. */
  solution?: number[][];
  /** Attempts to find a unique layout before giving up (default 100). */
  maxAttempts?: number;
  /** Override the difficulty→cage-size mapping. */
  maxSize?: number;
}

/**
 * Generate a uniquely-solvable 9×9 Killer puzzle. `grid` is all-zero (Killer has no givens);
 * the cages are the clue. Throws if no unique layout is found within `maxAttempts` (astronomically
 * unlikely given the measured uniqueness rate).
 */
export function generateKillerSudoku(
  difficulty: Difficulty = 'medium',
  options: KillerGenOptions = {},
): KillerPuzzle {
  const config = getGridConfig(GRID_SIZE);
  const rng = options.rng ?? Math.random;
  const maxAttempts = options.maxAttempts ?? 100;
  const maxSize = options.maxSize ?? MAX_SIZE_BY_DIFFICULTY[difficulty];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // A fresh solved grid per attempt (unless one is injected). Counterintuitively this beats
    // reusing one grid: `fillGrid` is cheap (~1.5ms), while a single unlucky grid whose
    // partitions are often ambiguous makes the retry loop thrash. Re-rolling the grid avoids
    // getting stuck and keeps generation time low-variance.
    let solution: number[][];
    if (options.solution) {
      solution = copyGrid(options.solution);
    } else {
      solution = createEmptyGrid(config.size);
      fillGrid(solution, config);
    }

    const cages = generateCages(solution, GRID_SIZE, { rng, maxSize });

    if (new KillerSolver(cages, GRID_SIZE).countSolutions(2) === 1) {
      return {
        variant: 'killer',
        grid: createEmptyGrid(config.size), // no givens — the cages are the clue
        solution,
        cages,
        difficulty,
        gridSize: 9,
      };
    }
  }

  throw new Error(`Could not generate a unique Killer (${difficulty}) in ${maxAttempts} attempts`);
}
