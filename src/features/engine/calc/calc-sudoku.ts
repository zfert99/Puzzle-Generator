/**
 * The Keisan (Calcudoku) generation pipeline — assembles K1–K3 into `generateCalcSudoku`, which
 * emits a **uniquely-solvable, difficulty-graded** puzzle.
 *
 * Pipeline (cheapest gate first): random Latin square (boxless `fillGrid`) → cage shapes (K2) →
 * operator/target assignment (K2) → shape gate (single-cell-cage band) → logical solve capped at
 * the tier (K3) → two-factor score band (K4) → uniqueness (belt-and-braces; the logical solver is
 * sound, so full solvability already implies uniqueness). Regenerate until a puzzle lands in the
 * requested difficulty's band.
 *
 * v1 offers easy/medium/hard at 4×4 and 6×6. Difficulty rides the **two-factor score** far more
 * than the tier ceiling — K3 measured that most small-cage Keisan puzzles solve at tiers 1–2, so
 * the score does the real separating. Bands are cut from measured per-size distributions (they are
 * NOT comparable across sizes — a "hard 4×4" is not a "hard 6×6"; see `calc-sudoku.md`).
 *
 * See `calc-sudoku.md` for the "why".
 */

import type { GridSize } from '../sudoku';
import { createEmptyGrid, copyGrid, fillGrid } from '../grid-utils';
import {
  calcGridConfig,
  generateCalcCageShapes,
  assignCalcCages,
} from './calc-generator';
import { CalcSolver } from './calc-solver';
import { CalcLogicalSolver, type CalcTier } from './calc-logical-solver';
import { scoreCalcSolve } from './calc-score';
import type { CalcCage, CalcDifficulty, CalcOperator, CalcPuzzle } from './calc-types';

const QUAD_OP: readonly CalcOperator[] = ['add', 'sub', 'mul', 'div'];

interface CalcDifficultyConfig {
  /** Operators the generator may assign (a difficulty axis; QuadOp for all v1 tiers). */
  activeOps: readonly CalcOperator[];
  minSize: number;
  maxSize: number;
  /** Logical-solver tier ceiling the puzzle must be solvable within. */
  solveCap: CalcTier;
  /**
   * Single-cell-cage (given) count band — the review's min/max lever. `max` prevents degenerate
   * givens-heavy puzzles; `min` (easy tiers) keeps beginner boards from being anchor-free.
   */
  minSingles?: number;
  maxSingles: number;
  /**
   * Two-factor score band (`calc-score.ts`) the accepted puzzle must land in — the primary
   * differentiator. DISJOINT per size, cut from measured distributions (recalibrate whenever the
   * weights or shape gates change).
   */
  scoreBand?: { min?: number; max?: number };
  /** Node budget for the belt-and-braces uniqueness check. */
  verifyNodeBudget?: number;
}

/**
 * 4×4 Keisan bands — cut from a measured QuadOp/maxSize-3 distribution (min 1.0, p25 3.0, p50 4.2,
 * p75 5.9, p90 9.3). Compressed, as expected for a small grid; disjoint by construction.
 */
const DIFFICULTY_CONFIG_4: Record<CalcDifficulty, CalcDifficultyConfig> = {
  easy: { activeOps: QUAD_OP, minSize: 1, maxSize: 3, solveCap: 4, minSingles: 1, maxSingles: 6, scoreBand: { max: 3.5 } },
  medium: { activeOps: QUAD_OP, minSize: 1, maxSize: 3, solveCap: 4, maxSingles: 4, scoreBand: { min: 3.5, max: 6.5 } },
  hard: { activeOps: QUAD_OP, minSize: 1, maxSize: 3, solveCap: 4, maxSingles: 3, scoreBand: { min: 6.5 } },
};

/**
 * 6×6 Keisan bands — measured QuadOp/maxSize-3 distribution (min 2.9, p25 8.9, p50 11.6, p75 16.2,
 * p90 21.4). Wider spread than 4×4; disjoint. Cuts are per-size, never reused from 4×4.
 */
const DIFFICULTY_CONFIG_6: Record<CalcDifficulty, CalcDifficultyConfig> = {
  easy: { activeOps: QUAD_OP, minSize: 1, maxSize: 3, solveCap: 4, minSingles: 2, maxSingles: 12, scoreBand: { max: 9 } },
  medium: { activeOps: QUAD_OP, minSize: 1, maxSize: 3, solveCap: 4, maxSingles: 9, scoreBand: { min: 9, max: 16 } },
  hard: { activeOps: QUAD_OP, minSize: 1, maxSize: 3, solveCap: 4, maxSingles: 7, scoreBand: { min: 16 } },
};

const DIFFICULTY_CONFIGS: Record<4 | 6, Record<CalcDifficulty, CalcDifficultyConfig>> = {
  4: DIFFICULTY_CONFIG_4,
  6: DIFFICULTY_CONFIG_6,
};

/** Reject a cage set whose single-cell-cage count is out of the difficulty's band. */
function shapeOk(cages: CalcCage[], config: CalcDifficultyConfig): boolean {
  let singles = 0;
  for (const cage of cages) if (cage.cells.length === 1) singles += 1;
  if (singles > config.maxSingles) return false;
  if (config.minSingles !== undefined && singles < config.minSingles) return false;
  return true;
}

export interface CalcGenPipelineOptions {
  /** 4 (default) or 6 for v1. */
  gridSize?: 4 | 6;
  rng?: () => number;
  /** A solved Latin square to build on (deterministic tests). Default: a fresh one per attempt. */
  solution?: number[][];
  /** Grading attempts before giving up (default 4000). */
  maxAttempts?: number;
}

/**
 * Generate a uniquely-solvable, difficulty-graded Keisan puzzle. `grid` is all-zero (the cages are
 * the clue). Throws if no puzzle lands in the requested band within `maxAttempts` — or immediately
 * if the difficulty/size pair is unsupported (v1 is 4×4 and 6×6, easy/medium/hard).
 */
export function generateCalcSudoku(
  difficulty: CalcDifficulty = 'easy',
  options: CalcGenPipelineOptions = {},
): CalcPuzzle {
  const gridSize = options.gridSize ?? 4;
  const config = DIFFICULTY_CONFIGS[gridSize]?.[difficulty];
  if (!config) {
    throw new Error(`Keisan difficulty '${difficulty}' is not available at ${gridSize}×${gridSize}`);
  }
  const rng = options.rng ?? Math.random;
  const maxAttempts = options.maxAttempts ?? 4000;
  const latinConfig = calcGridConfig(gridSize as GridSize);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let solution: number[][];
    if (options.solution) {
      solution = copyGrid(options.solution);
    } else {
      solution = createEmptyGrid(gridSize);
      fillGrid(solution, latinConfig);
    }

    const shapes = generateCalcCageShapes(gridSize, { minSize: config.minSize, maxSize: config.maxSize, rng });
    const cages = assignCalcCages(shapes, solution, { activeOps: config.activeOps, rng });
    if (!cages) continue;
    if (!shapeOk(cages, config)) continue;

    const result = new CalcLogicalSolver(cages, gridSize as GridSize).solve({ maxTier: config.solveCap });
    if (!result.solved) continue;

    if (config.scoreBand) {
      const { final } = scoreCalcSolve(result);
      if (config.scoreBand.min !== undefined && final < config.scoreBand.min) continue;
      if (config.scoreBand.max !== undefined && final >= config.scoreBand.max) continue;
    }

    // Belt-and-braces: the logical solver is sound, so full solvability already implies a unique
    // solution — this guards only against a technique bug, off the hot path.
    if (new CalcSolver(cages, gridSize as GridSize).countSolutions(2, config.verifyNodeBudget) !== 1) continue;

    return { variant: 'calc', grid: createEmptyGrid(gridSize), solution, cages, difficulty, gridSize: gridSize as GridSize };
  }

  throw new Error(`Could not generate a ${difficulty} Keisan (${gridSize}×${gridSize}) in ${maxAttempts} attempts`);
}

/** Generate a batch of graded Keisan puzzles — `counts[difficulty]` of each, easy→hard order. */
export function generateCalcBatch(
  counts: Partial<Record<CalcDifficulty, number>>,
  options: { gridSize?: 4 | 6 } = {},
): CalcPuzzle[] {
  const puzzles: CalcPuzzle[] = [];
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const n = counts[difficulty] ?? 0;
    for (let i = 0; i < n; i++) puzzles.push(generateCalcSudoku(difficulty, options));
  }
  return puzzles;
}
