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
import { combosFor } from './cage-combinations';
import { scoreKillerSolve } from './killer-score';
import { KillerSolver } from './killer-solver';
import { KillerLogicalSolver, type KillerTier } from './killer-logical-solver';
import type { Cage, KillerPuzzle } from './killer-types';

const GRID_SIZE = 9;

export type KillerDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface DifficultyConfig {
  /**
   * Solver tier the puzzle must be solvable WITHIN (a ceiling, not an exact match). Difficulty is
   * driven mainly by cage SHAPE (below); the cap just guarantees the puzzle is logically solvable
   * without techniques we don't have, and bounds grading cost. (Exact-tier matching craters yield
   * once shape is constrained — measured; the two-factor score in #3 will refine within-cap.)
   */
  solveCap: KillerTier;
  /** Cage-size window; `minSize ≥ 2` suppresses intentional single-cell "given" cages. */
  minSize: number;
  maxSize: number;
  /** Cap on 1-cell cages (givens) — the biggest difficulty lever (research: Hard ≈ 0). */
  maxSingles: number;
  /**
   * Foothold caps — a "foothold" is a single-combination cage of 2+ cells (e.g. a 3-in-2 = {1,2}),
   * the research's lever (d): strong starting points, so fewer = harder. `minFootholds` guarantees
   * medium keeps anchors (cuts its accidentally-hardest tail); `maxFootholds` denies hard easy
   * starts (accepted-hard median is ~4 footholds; capping at 3 keeps the harder 38%).
   */
  minFootholds?: number;
  maxFootholds?: number;
  /**
   * Two-factor score band (`killer-score.ts`) the accepted puzzle must land in — the within-band
   * refinement the tier ceiling can't provide. Cuts are DISJOINT across difficulties and placed
   * on measured distributions (Stuart's relative-cut approach), so a grindy bottlenecked "medium"
   * can no longer out-play a breezy "hard". Recalibrate whenever weights or shape gates change.
   */
  scoreBand?: { min?: number; max?: number };
  /**
   * Band-level necessity: the puzzle must NOT be solvable with `maxTier: minTier − 1` — the
   * capability-toggling check (research: a trace's hardestTier is order-dependent and can't
   * prove necessity). Expert uses it so the label is honest: solvable at tier 4, stuck at 3.
   * Measured nearly free for expert shapes (283 of 284 cap-4-solvable layouts pass).
   */
  minTier?: KillerTier;
  /**
   * Node budget for the uniqueness verification (E1/P3). Expert's big-cage layouts can
   * pathologically thrash `countSolutions`; the budget bounds each check (~100 ms worst) at a
   * small yield cost, never a correctness cost (budget exhaustion rejects).
   */
  verifyNodeBudget?: number;
}

/**
 * Per-difficulty cage-shape levers, tuned from the difficulty research (`Docs/research/…`) and
 * calibrated by measurement. The generator was over-producing single-cell cages (givens) —
 * ~52%/33% — making puzzles far too easy and medium/hard structurally identical. The four cage
 * levers (single-cage count, size, sum, combination ambiguity) now separate the tiers: easy keeps
 * givens; medium/hard shed them and grow cages (bigger sums), harder needing real deduction.
 */
const DIFFICULTY_CONFIG: Record<KillerDifficulty, DifficultyConfig> = {
  // easy keeps givens (it needs them to stay beginner-solvable) but far fewer than the old 52%,
  // with bigger cages/sums. medium/hard suppress intentional singles (minSize 2) and tighten the
  // forced-single cap — givens are the strongest lever, so the ladder rides on shedding them.
  // Foothold bands (see DifficultyConfig) then split medium/hard from both sides: medium keeps
  // ≥ 3 anchors, hard ≤ 3. All three stay at maxSize 3 and a 2-cell-heavy mix — measured walls:
  // maxSize 4 makes `countSolutions` thrash (6–160+ s/puzzle), and shifting the mix toward
  // 3-cell cages (maxSizeBias) collapses the tier-3-solvable rate to ~1% (the current technique
  // set gets its traction from tight 2-cell cages). Both return with the expert tier: exact
  // solver needs tighter cage-sum pruning, logical solver needs cage splitting/hard combos.
  // A per-cage `maxCombos` gate was tried and dropped (no-op at maxSize 3, fatal at 4); the
  // COUNT of single-combination cages (footholds) is the workable form of that lever.
  // Score cuts (42/62/90) sit on measured distributions (E3 recalibration): easy p75 ≈ 40,
  // medium median 56, hard median 72 / p85 89, expert median 121 / p15 94 — the 90 cut keeps
  // ~85% of both hard and expert while staying disjoint.
  easy: { solveCap: 2, minSize: 1, maxSize: 3, maxSingles: 12, scoreBand: { max: 42 } },
  medium: {
    solveCap: 3, minSize: 2, maxSize: 3, maxSingles: 4, minFootholds: 3,
    scoreBand: { min: 42, max: 62 },
  },
  hard: {
    solveCap: 3, minSize: 2, maxSize: 3, maxSingles: 1, maxFootholds: 3,
    scoreBand: { min: 62, max: 90 },
  },
  // Expert (E3): the tier the E1 pruning + E2 techniques unlocked. maxSize 4 → the big cages
  // and > 24 sums the lower tiers can't have (max4 layouts are ~never tier-3-solvable, so big
  // cages are expert's signature). No maxSizeBias — measured 3× worse yield for no difficulty
  // gain. Extreme (tier 5) was measured and DEFERRED: 0 tier-5-necessary layouts in a 40 s
  // sweep — needs more tier-5 techniques before it has a band to live in.
  expert: {
    solveCap: 4, minTier: 4, minSize: 2, maxSize: 4, maxSingles: 1, maxFootholds: 1,
    scoreBand: { min: 90 }, verifyNodeBudget: 100_000,
  },
};

/** Reject a partition whose shape is wrong for the tier: given count or foothold count out of band. */
function cageShapeOk(cages: Cage[], config: DifficultyConfig): boolean {
  let singles = 0;
  let footholds = 0;
  for (const cage of cages) {
    if (cage.cells.length === 1) singles += 1;
    else if (combosFor(cage.cells.length, cage.sum).length === 1) footholds += 1;
  }
  if (singles > config.maxSingles) return false;
  if (config.minFootholds !== undefined && footholds < config.minFootholds) return false;
  if (config.maxFootholds !== undefined && footholds > config.maxFootholds) return false;
  return true;
}

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
  options: {
    minSize?: number;
    rng?: () => number;
    solution?: number[][];
    maxAttempts?: number;
    /** Optional cage-shape gate applied BEFORE the (costlier) uniqueness check. */
    shapeOk?: (cages: Cage[]) => boolean;
  } = {},
): { cages: Cage[]; solution: number[][] } {
  const config = getGridConfig(GRID_SIZE);
  const rng = options.rng ?? Math.random;
  const maxAttempts = options.maxAttempts ?? 200;
  const shapeOk = options.shapeOk ?? (() => true);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let solution: number[][];
    if (options.solution) {
      solution = copyGrid(options.solution);
    } else {
      solution = createEmptyGrid(config.size);
      fillGrid(solution, config);
    }
    const cages = generateCages(solution, GRID_SIZE, { rng, maxSize, minSize: options.minSize });
    if (!shapeOk(cages)) continue; // cheap reject before the uniqueness check
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
  const difficultyConfig = DIFFICULTY_CONFIG[difficulty];
  const { solveCap, minSize, maxSize } = difficultyConfig;
  const rng = options.rng ?? Math.random;
  // Attempts are cheap now that grading precedes uniqueness (~0.5 ms each); a high cap makes
  // exhaustion astronomically unlikely (hard accepts ~1 in 500) at a bounded worst case (~10 s).
  const maxAttempts = options.maxAttempts ?? 20000;
  const config = getGridConfig(GRID_SIZE);

  // One flat loop, cheapest gates first: shape (µs) → logical solve (~0.5 ms) → uniqueness
  // (~10 ms, runs ONCE per accepted puzzle). The order matters: the logical solver makes only
  // sound deductions (facts true in every solution), so a completed grid is necessarily the
  // unique solution — solvability-within-cap implies uniqueness. The exact-solver check stays as
  // a belt-and-braces verification against a strategy bug, but off the hot path. Reordering cut
  // hard generation ~5× (measured; the old order paid ~10 ms uniqueness on every shape-passing
  // candidate only to reject ~90% of them at the cheap grading step).
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let solution: number[][];
    if (options.solution) {
      solution = copyGrid(options.solution);
    } else {
      solution = createEmptyGrid(config.size);
      fillGrid(solution, config);
    }

    const cages = generateCages(solution, GRID_SIZE, { rng, maxSize, minSize });
    if (!cageShapeOk(cages, difficultyConfig)) continue;

    const solveResult = new KillerLogicalSolver(cages, GRID_SIZE).solve({ maxTier: solveCap });
    if (!solveResult.solved) continue;
    // Band-level necessity (expert): a fresh solve capped one tier below must STALL.
    if (
      difficultyConfig.minTier !== undefined &&
      new KillerLogicalSolver(cages, GRID_SIZE).solve({
        maxTier: (difficultyConfig.minTier - 1) as KillerTier,
      }).solved
    ) {
      continue;
    }
    const band = difficultyConfig.scoreBand;
    if (band) {
      const { final } = scoreKillerSolve(solveResult);
      if (band.min !== undefined && final < band.min) continue;
      if (band.max !== undefined && final >= band.max) continue;
    }

    if (new KillerSolver(cages, GRID_SIZE).countSolutions(2, difficultyConfig.verifyNodeBudget) !== 1) continue;

    return {
      variant: 'killer',
      grid: createEmptyGrid(config.size),
      solution,
      cages,
      difficulty,
      gridSize: 9,
    };
  }

  throw new Error(`Could not generate a ${difficulty} Killer in ${maxAttempts} attempts`);
}

/** Generate a batch of graded Killers — `counts[difficulty]` puzzles of each, easy→hard order. */
export function generateKillerBatch(counts: Partial<Record<KillerDifficulty, number>>): KillerPuzzle[] {
  const puzzles: KillerPuzzle[] = [];
  for (const difficulty of ['easy', 'medium', 'hard', 'expert'] as const) {
    const n = counts[difficulty] ?? 0;
    for (let i = 0; i < n; i++) puzzles.push(generateKillerSudoku(difficulty));
  }
  return puzzles;
}
