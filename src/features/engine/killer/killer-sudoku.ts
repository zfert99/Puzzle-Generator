/**
 * The Killer Sudoku generation pipeline — assembles K1–K4 into a `generateKillerSudoku` that
 * emits a **uniquely-solvable, difficulty-graded** puzzle.
 *
 * Pipeline: solved grid (reuse `fillGrid`) → random cage partition (K3) → uniqueness gate via the
 * exact solver (K2) → difficulty grade via the logical solver (K4). Regenerate until a puzzle
 * grades to the requested tier.
 *
 * v1 offers three difficulties (easy/medium/hard → grading tiers 1/2/3), each tuned to a cage
 * size where that tier is both abundant and fast to hit. Expert/extreme (tier 4+) are deferred:
 * solvable tier-4 layouts are a thin band and larger cages are dominated by puzzles beyond the
 * current technique set — they need more Killer techniques first. See `killer-sudoku.md`.
 */

import { getGridConfig } from '../sudoku';
import { createEmptyGrid, copyGrid, fillGrid } from '../grid-utils';
import { generateCages } from './cage-generator';
import { KillerSolver } from './killer-solver';
import { KillerLogicalSolver, type KillerTier } from './killer-logical-solver';
import type { Cage, KillerPuzzle } from './killer-types';

const GRID_SIZE = 9;

export type KillerDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Per-difficulty target grading tier and the cage-size cap that makes that tier both common and
 * fast to hit (measured): easy is dense with magic cages (Tier 1); medium/hard live at maxSize 3
 * where Tiers 2/3 are abundant and larger-cage "beyond solver" puzzles are rare.
 */
const DIFFICULTY_CONFIG: Record<KillerDifficulty, { targetTier: KillerTier; maxSize: number }> = {
  easy: { targetTier: 1, maxSize: 2 },
  medium: { targetTier: 2, maxSize: 3 },
  hard: { targetTier: 3, maxSize: 3 },
};

export interface KillerGenOptions {
  /** RNG for cage generation (default `Math.random`). Inject a seeded PRNG for determinism. */
  rng?: () => number;
  /** A solved grid to build on. Default: a fresh random solution via `fillGrid` per attempt. */
  solution?: number[][];
  /** Grading attempts before giving up (default 800). */
  maxAttempts?: number;
}

/**
 * One uniquely-solvable Killer layout of the given max cage size (UNGRADED) — the building block.
 * A fresh solved grid per attempt (unless one is injected) avoids thrashing on an unlucky grid.
 */
export function generateUniqueKiller(
  maxSize: number,
  options: { rng?: () => number; solution?: number[][]; maxAttempts?: number } = {},
): { cages: Cage[]; solution: number[][] } {
  const config = getGridConfig(GRID_SIZE);
  const rng = options.rng ?? Math.random;
  const maxAttempts = options.maxAttempts ?? 200;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let solution: number[][];
    if (options.solution) {
      solution = copyGrid(options.solution);
    } else {
      solution = createEmptyGrid(config.size);
      fillGrid(solution, config);
    }
    const cages = generateCages(solution, GRID_SIZE, { rng, maxSize });
    if (new KillerSolver(cages, GRID_SIZE).countSolutions(2) === 1) return { cages, solution };
  }
  throw new Error(`Could not generate a unique Killer layout in ${maxAttempts} attempts`);
}

/**
 * Generate a uniquely-solvable, difficulty-graded 9×9 Killer. `grid` is all-zero (no givens);
 * the cages are the clue. The logical solver is capped at the target tier, so grading a would-be
 * "medium" never pays for expensive higher-tier strategies. Throws if no puzzle grades to the
 * requested difficulty within `maxAttempts` (astronomically unlikely at the tuned settings).
 */
export function generateKillerSudoku(
  difficulty: KillerDifficulty = 'medium',
  options: KillerGenOptions = {},
): KillerPuzzle {
  const { targetTier, maxSize } = DIFFICULTY_CONFIG[difficulty];
  const rng = options.rng ?? Math.random;
  const maxAttempts = options.maxAttempts ?? 800;
  const config = getGridConfig(GRID_SIZE);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { cages, solution } = generateUniqueKiller(maxSize, {
      rng,
      solution: options.solution,
      maxAttempts: 100,
    });

    const grade = new KillerLogicalSolver(cages, GRID_SIZE).solve({ maxTier: targetTier });
    if (grade.solved && grade.hardestTier === targetTier) {
      return {
        variant: 'killer',
        grid: createEmptyGrid(config.size),
        solution,
        cages,
        difficulty,
        gridSize: 9,
      };
    }
  }

  throw new Error(`Could not generate a ${difficulty} Killer in ${maxAttempts} attempts`);
}
