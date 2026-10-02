/**
 * Skyscrapers generation — plan slice E4: a Latin square, the repair that makes it unique, and
 * the clue removal that makes it a puzzle. Three plain functions plus `generateUniqueSkyscrapers`,
 * which chains them; every function takes an `rng`, so a seed reproduces a puzzle end to end
 * (the Keisan lesson, kept by Kakuro).
 *
 * The design is what E3 measured (`Docs/research/skyscrapers-feasibility-findings.md`):
 *
 * 1. **Fill** — `fillGrid` on the boxless config: a random Latin square.
 * 2. **Repair** — a random square is unique with all 4N clues 34% of the time at 5×5, 8% at
 *    6×6 and never at 7×7 (G4), so the square is **repaired**, not rejected: random intercalate
 *    swaps (a 2×2 sub-square `a b / b a` → `b a / a b`, which keeps the square Latin), each kept
 *    when the capped solution count does not rise, with a **restart** from a fresh square after a
 *    run of fruitless swaps — a square that starts at the count cap has no gradient to climb
 *    (L16; 7×7: 24/50 for the plain climb, 30/30 in a median 178 ms with restarts).
 * 3. **Remove** — blank clues one at a time in a tier-biased order, keeping a removal only if
 *    the puzzle stays unique (the exact solver) and, with a target tier, finishable by the
 *    ladder at or below it (the classifier — Tatham's bound). Removal only ever moves a puzzle
 *    *up* the ladder, so the all-clue square's own tier is the floor of what can come out (L17).
 *
 * The label is the classifier's word for whatever came out (D7); landing on *exactly* the
 * requested tier is E5's job (`generateSkyscrapers`), as it was Kakuro's. See
 * `skyscrapers-generator.md` for the "why" of each knob and the measured yields.
 */

import { createEmptyGrid, fillGrid, shuffle } from '../grid-utils';
import type { GridSize } from '../sudoku';
import { classifySkyscrapers, type SkyscrapersTier } from './skyscrapers-logical-solver';
import { countSkyscrapersSolutions, isSkyscrapersUnique } from './skyscrapers-solver';
import {
  GUTTER_SIDES,
  SKYSCRAPERS_LADDER,
  deriveClues,
  presentClueCount,
  skyscrapersGridConfig,
  type GutterSide,
  type SkyscraperClues,
  type SkyscrapersDifficulty,
  type SkyscrapersLevel,
  type SkyscrapersPuzzle,
} from './skyscrapers-types';

/** The ladder's tier for a published level — `SKYSCRAPERS_LADDER` is in tier order. */
export function tierOf(level: SkyscrapersLevel): SkyscrapersTier {
  return (SKYSCRAPERS_LADDER.indexOf(level) + 1) as SkyscrapersTier;
}

/**
 * A random Latin square of the given size — the solution every puzzle starts from. A boxless
 * fill cannot dead-end (a partial Latin square always extends), so a `false` from `fillGrid`
 * would be an engine fault; it throws rather than hand back a grid with holes.
 */
export function randomLatinSquare(size: GridSize, rng: () => number = Math.random): number[][] {
  const grid = createEmptyGrid(size);
  if (!fillGrid(grid, skyscrapersGridConfig(size), rng)) throw new Error(`skyscrapers: fillGrid failed on a boxless ${size}×${size}`);
  return grid;
}

/**
 * One random intercalate swap in place: find a 2×2 sub-square whose corners read `a b / b a` and
 * swap its rows' entries, which keeps every row and column a permutation. The pair is found by
 * sampling (two rows and a column fix the fourth corner), so a square with no intercalate at all
 * — vanishingly rare above 4×4 — returns `false` after a bounded number of tries.
 */
function intercalateSwap(grid: number[][], rng: () => number, tries = 200): boolean {
  const size = grid.length;
  for (let attempt = 0; attempt < tries; attempt++) {
    const r1 = Math.floor(rng() * size);
    const r2 = Math.floor(rng() * size);
    if (r1 === r2) continue;
    const c1 = Math.floor(rng() * size);
    const c2 = grid[r1].indexOf(grid[r2][c1]);
    if (c2 === c1 || grid[r2][c2] !== grid[r1][c1]) continue;
    [grid[r1][c1], grid[r1][c2]] = [grid[r1][c2], grid[r1][c1]];
    [grid[r2][c1], grid[r2][c2]] = [grid[r2][c2], grid[r2][c1]];
    return true;
  }
  return false;
}

/** The repair climb's knobs; the defaults are E3's measured policy. */
export interface RepairOptions {
  rng?: () => number;
  /** Solutions counted per objective evaluation; more than this scores as "many" (E3: 20). */
  countLimit?: number;
  /** Swaps without a strict improvement before a fresh square is started (E3: 40). */
  restartAfter?: number;
  /** Fresh squares started before giving up — the cap that holds even when no swap is ever made. */
  maxRestarts?: number;
  /** Swaps tried in total before giving up. */
  stepCap?: number;
  /** Wall-clock cap. */
  msCap?: number;
  /** Start from this square instead of a random one (tests; the restarts still draw fresh ones). */
  start?: readonly number[][];
}

/** What the repair climb reached, and what it cost. */
export interface RepairResult {
  solution: number[][];
  /** 1 when repaired; the last capped solution count otherwise. */
  solutions: number;
  swaps: number;
  restarts: number;
  ms: number;
}

/**
 * Hill-climb a Latin square toward all-clue uniqueness. The objective is the solution count of
 * the clues the square implies, capped at `countLimit`; a swap is kept when the count does not
 * rise (plateau moves included — they are what lets the climb cross flat regions), and the
 * climb restarts from a fresh square after `restartAfter` swaps without a strict improvement:
 * the cap exists only to give the climb a gradient, and a square that starts above it has none
 * (L16). Returns the best square reached either way; check `solutions === 1`.
 */
export function repairToUnique(size: GridSize, options: RepairOptions = {}): RepairResult {
  const { rng = Math.random, countLimit = 20, restartAfter = 40, maxRestarts = 100, stepCap = 5_000, msCap = 10_000, start } = options;
  const started = performance.now();
  const countOf = (grid: number[][]): number => {
    const result = countSkyscrapersSolutions({ gridSize: size, clues: deriveClues(grid) }, { limit: countLimit });
    return result.exhausted ? countLimit : result.solutions;
  };
  let square = start ? start.map((row) => [...row]) : randomLatinSquare(size, rng);
  let count = countOf(square);
  let swaps = 0;
  let restarts = 0;
  let fruitless = 0;
  // A fresh square: the climb's escape from a plateau, and from a square with nothing to swap.
  const restart = (): void => {
    square = randomLatinSquare(size, rng);
    count = countOf(square);
    restarts += 1;
    fruitless = 0;
  };
  while (count !== 1 && swaps < stepCap && restarts < maxRestarts && performance.now() - started < msCap) {
    if (fruitless >= restartAfter) {
      restart();
      continue;
    }
    const trial = square.map((row) => [...row]);
    if (!intercalateSwap(trial, rng)) {
      // A square with no intercalate at all (the cyclic squares of prime order — which happen to
      // be all-clue unique at 5 and 7, so this path needs a rarer square) cannot be climbed; it is
      // left for a fresh one, and the restart cap bounds a run of them even when no swap counts.
      restart();
      continue;
    }
    swaps += 1;
    const next = countOf(trial);
    if (next <= count) {
      fruitless = next < count ? 0 : fruitless + 1;
      count = next;
      square = trial;
    } else {
      fruitless += 1;
    }
  }
  return { solution: square, solutions: count, swaps, restarts, ms: performance.now() - started };
}

/** Which clues go first: 1s and Ns resolve a cell in one move, so easy keeps them and hard sheds them. */
export type RemovalOrder = 'random' | 'trivialLast' | 'trivialFirst';

/** The clue removal's knobs: the tier it may not exceed, and the order clues are tried in. */
export interface RemovalOptions {
  rng?: () => number;
  /** Keep a removal only if the ladder still finishes the puzzle at or below this tier (Tatham's bound). */
  targetTier?: SkyscrapersTier;
  /** Defaults from the target: `trivialLast` for tiers 1–2, `trivialFirst` for 3+, `random` without a target. */
  order?: RemovalOrder;
}

/** What the removal left: the clues, how many, and the classifier's own grade of the result. */
export interface RemovalResult {
  clues: SkyscraperClues;
  /** Clues still present, of 4N. */
  kept: number;
  /** The classifier's tier for what came out (`null` when the ladder cannot finish it). */
  tier: SkyscrapersTier | null;
  /** The classifier's label for what came out — `'unrated'` exactly when `tier` is `null`. */
  difficulty: SkyscrapersDifficulty;
  ms: number;
}

/**
 * Blank clues one at a time, in a random order biased by the target, keeping a blank only if the
 * puzzle stays unique and — with a target — finishable at ≤ the target tier. Removal never moves
 * a puzzle down the ladder, so with a target the first check is whether the fully clued square
 * already sits at or below it; if not, nothing is removed and the caller tries another square.
 */
export function removeClues(solution: readonly number[][], options: RemovalOptions = {}): RemovalResult {
  const started = performance.now();
  const size = solution.length;
  const { rng = Math.random, targetTier } = options;
  const order = options.order ?? (targetTier === undefined ? 'random' : targetTier <= 2 ? 'trivialLast' : 'trivialFirst');
  const clues = deriveClues(solution);
  const shape = { gridSize: size, clues };
  let graded = classifySkyscrapers(shape);
  if (targetTier !== undefined && (graded.tier === null || graded.tier > targetTier)) {
    return { clues, kept: presentClueCount(clues), tier: graded.tier, difficulty: graded.difficulty, ms: performance.now() - started };
  }
  const slots = shuffle(
    GUTTER_SIDES.flatMap((side) => Array.from({ length: size }, (_, i) => [side, i] as [GutterSide, number])),
    rng
  );
  if (order !== 'random') {
    const trivial = ([side, i]: [GutterSide, number]) => clues[side][i] === 1 || clues[side][i] === size;
    // A stable partition keeps the shuffle's order inside each group.
    const first = slots.filter((slot) => trivial(slot) === (order === 'trivialFirst'));
    const rest = slots.filter((slot) => trivial(slot) !== (order === 'trivialFirst'));
    slots.splice(0, slots.length, ...first, ...rest);
  }
  for (const [side, i] of slots) {
    const kept = clues[side][i];
    clues[side][i] = 0;
    if (isSkyscrapersUnique(shape) !== true) {
      clues[side][i] = kept;
      continue;
    }
    if (targetTier !== undefined) {
      const after = classifySkyscrapers(shape);
      if (after.tier === null || after.tier > targetTier) {
        clues[side][i] = kept;
        continue;
      }
      graded = after;
    }
  }
  // With a target, `graded` is the classification of the last accepted state — the state being
  // returned; without one the result is graded once here.
  if (targetTier === undefined) graded = classifySkyscrapers(shape);
  return { clues, kept: presentClueCount(clues), tier: graded.tier, difficulty: graded.difficulty, ms: performance.now() - started };
}

/** One generation's knobs: size, the tier bound, and the budgets each stage shares. */
export interface GenerateUniqueOptions {
  gridSize: GridSize;
  rng?: () => number;
  /** Removal never exceeds this tier; the result may land below it unless `exactTier` is set. */
  targetTier?: SkyscrapersTier;
  /** With `targetTier`: accept only a puzzle whose classifier tier is exactly the target (E5); a round that lands below it is another round. */
  exactTier?: boolean;
  /** Fill+repair+remove rounds before giving up. */
  maxRounds?: number;
  /**
   * Rounds whose fully clued square already sits above `targetTier` before giving up. A size
   * may have no squares at a tier at all (E3: no 7×7 has an easy floor), and that is cheaper to
   * learn from a dozen floors than from a whole time budget of repairs.
   */
  maxFloorMisses?: number;
  /** Wall-clock budget for all rounds together; each round's repair gets what is left of it. */
  timeBudgetMs?: number;
  /** The repair's knobs. `rng` is the generator's — one seed, one puzzle. */
  repair?: Omit<RepairOptions, 'rng' | 'start'>;
  order?: RemovalOrder;
}

/** What a round cost — the production counterpart of E3's measurements, for the route's log. */
export interface GenerationStats {
  rounds: number;
  repair: { swaps: number; restarts: number; ms: number };
  removal: { kept: number; ms: number };
  totalMs: number;
}

/** A generated puzzle with the cost of making it. */
export interface GeneratedSkyscrapers {
  puzzle: SkyscrapersPuzzle;
  stats: GenerationStats;
}

/**
 * A fresh, unique Skyscrapers: fill → repair → remove → label. Uniqueness is the exact solver's
 * word already — the repair stops at an exact count of one and every accepted removal passed
 * `isSkyscrapersUnique` with the full node budget, so no second verify is run. The label is the
 * classifier's for whatever came out (`'unrated'` only if the ladder cannot finish it, which the
 * removal's own checks make impossible when a target is set). Every stage shares `timeBudgetMs`;
 * `null` when the rounds or the budget run out.
 */
export function generateUniqueSkyscrapers(options: GenerateUniqueOptions): GeneratedSkyscrapers | null {
  const { gridSize, rng = Math.random, targetTier, exactTier = false, maxRounds = 30, maxFloorMisses = Infinity, timeBudgetMs = Infinity, repair, order } = options;
  const started = performance.now();
  let floorMisses = 0;
  for (let round = 1; round <= maxRounds; round++) {
    const remaining = timeBudgetMs - (performance.now() - started);
    if (remaining <= 0) break;
    const repaired = repairToUnique(gridSize, { ...repair, rng, msCap: Math.min(repair?.msCap ?? 10_000, remaining) });
    if (repaired.solutions !== 1) continue;
    const removed = removeClues(repaired.solution, { rng, targetTier, order });
    if (targetTier !== undefined && (removed.tier === null || removed.tier > targetTier)) {
      // The square's floor was above the target: nothing was removed, another square is needed.
      if (++floorMisses >= maxFloorMisses) break;
      continue;
    }
    // Landing below the target is honest but not exact: E5 asks for the tier itself, and the next
    // square (another floor, another removal order) is the cheapest way to a different landing.
    if (exactTier && targetTier !== undefined && removed.tier !== targetTier) continue;
    return {
      puzzle: {
        variant: 'skyscrapers',
        gridSize,
        grid: repaired.solution.map((row) => row.map(() => 0)),
        solution: repaired.solution,
        clues: removed.clues,
        difficulty: removed.difficulty,
      },
      stats: {
        rounds: round,
        repair: { swaps: repaired.swaps, restarts: repaired.restarts, ms: Math.round(repaired.ms) },
        removal: { kept: removed.kept, ms: Math.round(removed.ms) },
        totalMs: Math.round(performance.now() - started),
      },
    };
  }
  return null;
}
