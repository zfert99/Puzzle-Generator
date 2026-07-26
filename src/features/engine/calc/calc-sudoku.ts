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
import { calcCombosFor } from './calc-combinations';
import type { CalcCage, CalcDifficulty, CalcOperator, CalcPuzzle } from './calc-types';

const QUAD_OP: readonly CalcOperator[] = ['add', 'sub', 'mul', 'div'];
const TRI_OP: readonly CalcOperator[] = ['add', 'sub', 'div']; // easy tiers: no × (factor reasoning is a difficulty step)

// Score-band cuts (two-factor `final` score), placed on MEASURED distributions of each tier's SHAPE
// config so the bands are disjoint per size. Recalibrate whenever weights or shape gates change.
const SCORE_CUT_4_EASY_MED = 5;
const SCORE_CUT_4_MED_HARD = 9;
const SCORE_CUT_6_EASY_MED = 19;
const SCORE_CUT_6_MED_HARD = 31;

interface CalcDifficultyConfig {
  /**
   * Operators the generator may assign — a difficulty axis (the operator palette widens with
   * difficulty). Easy = `+ − ÷` (× forces prime-factorization reasoning, a difficulty step, so it's
   * gated to medium+); medium/hard = all four. See `kenken-difficulty-calibration.md`.
   */
  activeOps: readonly CalcOperator[];
  minSize: number;
  maxSize: number;
  /** Logical-solver tier ceiling the puzzle must be solvable within. */
  solveCap: CalcTier;
  /**
   * Single-cell-cage (given) count band — **the single strongest difficulty lever** (a given
   * collapses candidates with no deduction). Hard uses ~1; easy allows several. `min` (easy) keeps
   * beginner boards from being anchor-free.
   */
  minSingles?: number;
  maxSingles: number;
  /**
   * "Foothold" (gift-cage) cap — a foothold is a 2+-cell cage with exactly ONE valid multiset
   * (e.g. `3−` = {1,4}), a strong free anchor. The `maxCombos` lever from the research applied as a
   * COUNT: harder tiers permit fewer gift cages so the solver must earn its progress. `undefined` =
   * no cap.
   */
  maxFootholds?: number;
  /**
   * Which clue patterns count toward the `maxFootholds` gift cap (the definition broadens with
   * tier). Default `combos1`. See `GiftBanLevel`.
   */
  giftBanLevel?: GiftBanLevel;
  /**
   * Minimum fraction of MULTI-cell cages that must be "bent" (span ≥2 rows and columns). Bent cages
   * permit repeats → more combinations → harder, so hard tiers demand a floor. `undefined` = no floor.
   */
  minBentRatio?: number;
  /**
   * Technique FLOOR (Tatham's tier gate): the puzzle must NOT be solvable using only techniques ≤
   * this tier — i.e. it must genuinely require something harder than the tier below. This is what
   * keeps tiers from bleeding into each other (a "hard" that a "medium" solver cracks isn't hard).
   * `undefined` = no floor (easy).
   */
  techniqueFloor?: CalcTier;
  /**
   * Ceiling on how many valid multisets ANY single cage may admit (the `maxCombos` lever as a
   * ceiling). Bounds per-cage ambiguity so the puzzle stays solvable within `solveCap` (no
   * bifurcation/T5) and generation yield stays healthy. `undefined` = no ceiling.
   */
  maxCombosPerCage?: number;
  /**
   * Operator-MIX weights (the difficulty-calibration doc's target distribution): easy leans on
   * `+ − ÷` (~50/30/20), medium is even, hard is `×`-weighted (× ≥ ~30% forces factor reasoning).
   * A soft bias applied per cage, not a hard constraint. `undefined` = uniform.
   */
  operatorWeights?: Partial<Record<CalcOperator, number>>;
  /**
   * Two-factor score band (`calc-score.ts`) — the within-shape refinement. DISJOINT per size, cut
   * from measured distributions (recalibrate whenever the weights or shape gates change).
   */
  scoreBand?: { min?: number; max?: number };
  /** Node budget for the belt-and-braces uniqueness check. */
  verifyNodeBudget?: number;
}

// Operator-mix weight presets (see `operatorWeights`): easy 5/3/2 over +/−/÷; hard pushes ×.
const EASY_OP_WEIGHTS: Partial<Record<CalcOperator, number>> = { add: 5, sub: 3, div: 2 };
const HARD_OP_WEIGHTS: Partial<Record<CalcOperator, number>> = { mul: 4, add: 2, sub: 1, div: 1 };

/**
 * Gift-clue ban level — which clue patterns count as a "gift" (near-freebie). The definition
 * broadens with tier (cumulative): `combos1` = only fully-determined sets; `twoCell` adds keen.c's
 * degenerate 2-cell patterns; `mulLowFactor` adds `×` clues that factor into ≤ 2 sets. Harder tiers
 * use a broader definition AND a tighter `maxFootholds` count, so freebies get scarce.
 */
type GiftBanLevel = 'combos1' | 'twoCell' | 'mulLowFactor';

/** Is a multi-cell cage a "gift" clue at the given ban level? (keen.c patterns; see the doc.) */
function isGiftCage(cage: CalcCage, gridSize: number, level: GiftBanLevel): boolean {
  const size = cage.cells.length;
  if (size < 2) return false; // single-cell givens are handled by the singles band
  const N = gridSize;
  const combos = calcCombosFor(cage.op, size, cage.target, N).length;
  if (combos <= 1) return true; // fully-determined multiset — banned at every level
  if (level === 'combos1') return false;
  if (size === 2) {
    // keen.c 2-cell freebies: + with tiny/huge sums, − with the max difference, ÷ with a big quotient.
    if (cage.op === 'add' && (cage.target <= 4 || cage.target >= 2 * N - 2)) return true;
    if (cage.op === 'sub' && cage.target === N - 1) return true;
    if (cage.op === 'div' && cage.target > N / 2) return true;
  }
  if (level === 'twoCell') return false;
  if (cage.op === 'mul' && combos <= 2) return true; // × that factors into ≤2 sets ≈ a given
  return false;
}

/**
 * Is a cage "bent" — does it span ≥2 rows AND ≥2 columns? A straight (single-row/column) cage
 * can't hold repeats (Latin rule), so its combinations are all distinct-digit sets → fewer, easier;
 * a bent cage permits repeats → more combinations → harder. Harder tiers want a higher bent ratio.
 */
function isBentCage(cells: number[], gridSize: number): boolean {
  const rows = new Set(cells.map((c) => Math.floor(c / gridSize)));
  const cols = new Set(cells.map((c) => c % gridSize));
  return rows.size >= 2 && cols.size >= 2;
}

/**
 * 4×4 Keisan (16 cells) — full lever spec (`Docs/research/keisan-difficulty-levers.md`, see also
 * `calc-sudoku.md`). Difficulty rides SHAPE first (givens → hard 0; cage size; gift-cage cap; combo
 * ceiling; operator palette + mix), score band refines. Cuts 5 / 9 (measured, disjoint). 4×4 hard
 * takes `maxSize: 4` per the doc (a size-4 cage is a quarter of the board — the doc flags 4×4 hard as
 * the tier most likely to need adjustment; kept per playtest OK).
 */
const DIFFICULTY_CONFIG_4: Record<CalcDifficulty, CalcDifficultyConfig> = {
  easy: { activeOps: TRI_OP, minSize: 1, maxSize: 2, solveCap: 4, minSingles: 2, maxSingles: 4, maxCombosPerCage: 3, operatorWeights: EASY_OP_WEIGHTS, giftBanLevel: 'combos1', scoreBand: { max: SCORE_CUT_4_EASY_MED } },
  medium: { activeOps: QUAD_OP, minSize: 1, maxSize: 3, solveCap: 4, maxSingles: 2, maxCombosPerCage: 5, giftBanLevel: 'twoCell', scoreBand: { min: SCORE_CUT_4_EASY_MED, max: SCORE_CUT_4_MED_HARD } },
  hard: { activeOps: QUAD_OP, minSize: 2, maxSize: 4, solveCap: 4, maxSingles: 0, maxFootholds: 2, maxCombosPerCage: 8, operatorWeights: HARD_OP_WEIGHTS, giftBanLevel: 'mulLowFactor', techniqueFloor: 1, scoreBand: { min: SCORE_CUT_4_MED_HARD } },
};

/**
 * 6×6 Keisan (36 cells) — full lever spec (the flagship size; calibrate here first). Hard: **0
 * givens, `maxSize: 4`** (~4.7 four-cell cages/puzzle, verifies ~0.2 ms avg — no Killer thrash),
 * ×-weighted, ~61% bent, `maxCombos ≤ 15`, gift cap 3, `techniqueFloor > T1`. Easy keeps small cages
 * + several givens, `+ − ÷` only. Cuts 19 / 31 (measured, disjoint). Gen ≤ ~104 ms avg on hard.
 */
const DIFFICULTY_CONFIG_6: Record<CalcDifficulty, CalcDifficultyConfig> = {
  easy: { activeOps: TRI_OP, minSize: 1, maxSize: 3, solveCap: 4, minSingles: 3, maxSingles: 6, maxCombosPerCage: 6, operatorWeights: EASY_OP_WEIGHTS, giftBanLevel: 'combos1', scoreBand: { max: SCORE_CUT_6_EASY_MED } },
  medium: { activeOps: QUAD_OP, minSize: 2, maxSize: 3, solveCap: 4, maxSingles: 3, maxCombosPerCage: 10, giftBanLevel: 'twoCell', scoreBand: { min: SCORE_CUT_6_EASY_MED, max: SCORE_CUT_6_MED_HARD } },
  // No `minBentRatio` gate: maxSize-4 already yields ~61% bent naturally, so forcing a floor only
  // crushed generation yield (dropped the accept rate ~2×) for no structural gain. The bent lever
  // stays available in the config for tiers that need it.
  hard: { activeOps: QUAD_OP, minSize: 2, maxSize: 4, solveCap: 4, maxSingles: 0, maxFootholds: 3, maxCombosPerCage: 15, operatorWeights: HARD_OP_WEIGHTS, giftBanLevel: 'mulLowFactor', techniqueFloor: 1, scoreBand: { min: SCORE_CUT_6_MED_HARD } },
};

const DIFFICULTY_CONFIGS: Record<4 | 6, Record<CalcDifficulty, CalcDifficultyConfig>> = {
  4: DIFFICULTY_CONFIG_4,
  6: DIFFICULTY_CONFIG_6,
};

/** Reject a cage set whose shape is wrong for the tier: givens, gift cages, combo ceiling, or bent ratio. */
function shapeOk(cages: CalcCage[], config: CalcDifficultyConfig, gridSize: number): boolean {
  const giftLevel = config.giftBanLevel ?? 'combos1';
  const checkBent = config.minBentRatio !== undefined;
  let singles = 0;
  let footholds = 0;
  let multiCell = 0;
  let bent = 0;
  for (const cage of cages) {
    const size = cage.cells.length;
    if (size === 1) {
      singles += 1;
      continue;
    }
    multiCell += 1;
    if (checkBent && isBentCage(cage.cells, gridSize)) bent += 1;
    if (isGiftCage(cage, gridSize, giftLevel)) footholds += 1;
    if (config.maxCombosPerCage !== undefined) {
      const combos = calcCombosFor(cage.op, size, cage.target, gridSize).length;
      if (combos > config.maxCombosPerCage) return false;
    }
  }
  if (singles > config.maxSingles) return false;
  if (config.minSingles !== undefined && singles < config.minSingles) return false;
  if (config.maxFootholds !== undefined && footholds > config.maxFootholds) return false;
  if (checkBent && multiCell > 0 && bent / multiCell < config.minBentRatio!) return false;
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
  // Attempts are cheap (~0.07 ms — most are rejected by the shape gate before the logical solve),
  // so a high cap makes exhaustion astronomically unlikely even for the tightest tier (6×6 hard's
  // accept rate is ~0.1%, ~1k attempts avg → ~100 ms). 40k keeps the worst case bounded while
  // never realistically throwing.
  const maxAttempts = options.maxAttempts ?? 40000;
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
    const cages = assignCalcCages(shapes, solution, { activeOps: config.activeOps, operatorWeights: config.operatorWeights, rng });
    if (!cages) continue;
    if (!shapeOk(cages, config, gridSize)) continue;

    const result = new CalcLogicalSolver(cages, gridSize as GridSize).solve({ maxTier: config.solveCap });
    if (!result.solved) continue;

    // Technique floor (Tatham's tier gate): reject a puzzle a lower-tier solver could already crack,
    // so the tier is the MINIMUM sufficient difficulty and tiers don't bleed. A fresh solve capped at
    // the floor must fail.
    if (
      config.techniqueFloor !== undefined &&
      new CalcLogicalSolver(cages, gridSize as GridSize).solve({ maxTier: config.techniqueFloor }).solved
    ) {
      continue;
    }

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
