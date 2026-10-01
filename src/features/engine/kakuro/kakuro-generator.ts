/**
 * Kakuro generation — plan slice E4: a layout, a fill, and the repair that makes it unique.
 *
 * Three stages, each a plain function so the yield spike's lessons stay testable on their own
 * (`Docs/research/kakuro-feasibility-findings.md`):
 *
 * 1. **Layout** — two methods behind one knob, both 180°-symmetric, both validated by the
 *    static rules (D9, G10) with a rejected layout simply retried (layouts are cheap, the
 *    solver is not). **`scatter`** (the default): start all white and drop black cells in
 *    mirror pairs at random until the target density, refusing any pair that leaves a white
 *    cell without a run. **`edges-inward`**: Mathimagics' method (research gap G3) — decide
 *    cells ring by ring from the outside in, a decided white that has one way left to get a run
 *    in some axis forcing that neighbour white, a cell that would orphan itself forced black,
 *    the rest a weighted coin. The plan prescribed edges-inward; measured against each other
 *    (`Docs/research/kakuro-layout-method-findings.md`), its no-orphan forcing lays 2-deep
 *    white bands along the edges — ~30% more all-white 2×2 blocks, the shape every
 *    sum-preserving swap needs — and its layouts repair to unique 2–5× less often. Scatter is
 *    what E3 measured with and what its design inputs assume.
 * 2. **Fill** — a randomised DFS that gives every white cell a digit with no repeat inside any
 *    run. Almost never fails on a valid layout; budgeted anyway.
 * 3. **Repair** — the E3 finding that replaced fill-and-retry: a random fill is unique about
 *    0.1% of the time at every size, but a one-cell-at-a-time hill-climb whose objective is the
 *    solution count (capped) converges in milliseconds at 6–9 (L7, L15). Mutate one white cell
 *    to a digit legal in both its runs; keep it if the count did not rise; stop at one.
 *
 * `generateUniqueKakuro` chains the three and labels the result with the classifier's tier
 * (`'unrated'` when the ladder cannot finish it — never a guess, D8). Targeting a *requested*
 * tier is `kakuro.ts`'s job (E4: bounded rejection; E5: the classifier in the objective).
 *
 * Every function takes an `rng` so a seed reproduces a puzzle end to end (the Keisan lesson).
 * See `kakuro-generator.md` for the "why" of each rule and the measured yields.
 */

import { shuffle } from '../grid-utils';
import { deriveRuns, validateKakuroLayout, whiteMaskOf } from './kakuro-layout';
import { classifyKakuro, KakuroLogicalSolver, TIER_DIFFICULTY, type KakuroTier } from './kakuro-logical-solver';
import { countKakuroSolutions, isKakuroUnique } from './kakuro-solver';
import { MAX_RUN_LENGTH, type KakuroPuzzle, type Run } from './kakuro-types';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export type KakuroLayoutMethod = 'scatter' | 'edges-inward';

export interface KakuroLayoutOptions {
  gridSize: number;
  /** See the module note: `scatter` repairs to unique far more often; `edges-inward` is kept for E5's experiments. */
  method?: KakuroLayoutMethod;
  /** Target black density (black cells / N²) of the finished layout. */
  blackDensity: number;
  /** How far the achieved density may sit from the target. */
  densityTolerance?: number;
  /** Probability a free cell that would complete an all-white 2×2 block is made black instead. */
  blockBreak?: number;
  rng?: () => number;
  /** Whole-layout restarts before giving up. */
  maxAttempts?: number;
}

type Decision = -1 | 0 | 1; // undecided, black, white

/** Interior cells in ring order, outside in — the edges-inward visiting order. */
function ringOrder(size: number): number[] {
  const cells: number[] = [];
  for (let ring = 0; ring <= Math.floor((size - 1) / 2); ring++) {
    const last = size - 1 - ring;
    for (let r = ring; r <= last; r++) {
      for (let c = ring; c <= last; c++) {
        if (r === ring || r === last || c === ring || c === last) cells.push(r * size + c);
      }
    }
  }
  return cells;
}

/**
 * One layout attempt. Returns the mask, or `null` on a contradiction (a cell forced both ways)
 * — the caller restarts.
 */
function attemptLayout(size: number, blackDensity: number, rng: () => number, blockBreak = 0): boolean[][] | null {
  const cells = new Int8Array(size * size).fill(-1); // a Decision per cell
  const at = (r: number, c: number): Decision => (r < 0 || c < 0 || r >= size || c >= size ? 0 : (cells[r * size + c] as Decision));
  const mirror = (cell: number) => size * size - 1 - cell;

  /**
   * A decided white neighbour whose only remaining partner in that axis is this cell forces it
   * white: the neighbour needs a run in both axes, and the far side is already black or off
   * the grid.
   */
  const forcedWhite = (r: number, c: number): boolean => {
    const needsMe = (nr: number, nc: number, farR: number, farC: number) => at(nr, nc) === 1 && at(farR, farC) === 0;
    return (
      needsMe(r - 1, c, r - 2, c) ||
      needsMe(r + 1, c, r + 2, c) ||
      needsMe(r, c - 1, r, c - 2) ||
      needsMe(r, c + 1, r, c + 2)
    );
  };

  /** White here would be an orphan in some axis (both partners already black), or overlong. */
  const forcedBlack = (r: number, c: number): boolean => {
    if ((at(r - 1, c) === 0 && at(r + 1, c) === 0) || (at(r, c - 1) === 0 && at(r, c + 1) === 0)) return true;
    const strip = (dr: number, dc: number) => {
      let length = 1;
      for (let k = 1; at(r - k * dr, c - k * dc) === 1; k++) length++;
      for (let k = 1; at(r + k * dr, c + k * dc) === 1; k++) length++;
      return length;
    };
    return strip(0, 1) > MAX_RUN_LENGTH || strip(1, 0) > MAX_RUN_LENGTH;
  };

  /** Would white here complete an all-white 2×2 block — the shape every sum-preserving swap needs? */
  const completesBlock = (r: number, c: number): boolean => {
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      if (at(r + dr, c) === 1 && at(r, c + dc) === 1 && at(r + dr, c + dc) === 1) return true;
    }
    return false;
  };

  for (const cell of ringOrder(size)) {
    if (cells[cell] !== -1) continue;
    const r = Math.floor(cell / size);
    const c = cell % size;
    const white = forcedWhite(r, c);
    const black = forcedBlack(r, c) || (!white && blockBreak > 0 && completesBlock(r, c) && rng() < blockBreak);
    if (white && black) return null;
    const value: Decision = white ? 1 : black ? 0 : rng() < blackDensity ? 0 : 1;
    // A cell and its mirror are always decided together, so the twin is still undecided here.
    cells[cell] = value;
    cells[mirror(cell)] = value;
  }
  return Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => cells[r * size + c] === 1));
}

/** A maximal white strip longer than `MAX_RUN_LENGTH`, or `null` — flat cells in order. */
function overlongStrip(white: readonly boolean[][]): { cells: number[] } | null {
  const size = white.length;
  for (let a = 0; a < size; a++) {
    for (const dir of ['across', 'down'] as const) {
      let strip: number[] = [];
      for (let b = 0; b <= size; b++) {
        const r = dir === 'across' ? a : b;
        const c = dir === 'across' ? b : a;
        if (b < size && white[r][c]) strip.push(r * size + c);
        else {
          if (strip.length > MAX_RUN_LENGTH) return { cells: strip };
          strip = [];
        }
      }
    }
  }
  return null;
}

/**
 * One scatter attempt: all white, then mirror pairs of black cells at random positions until
 * the target count, each pair refused if it leaves a white cell with no across or down run.
 * `null` when the pair budget runs out before the count is reached (dense targets on small
 * grids) — the caller restarts.
 */
function scatterLayout(size: number, blackDensity: number, rng: () => number): boolean[][] | null {
  const white = Array.from({ length: size }, () => Array<boolean>(size).fill(true));
  const wanted = Math.round(blackDensity * size * size);
  const isWhite = (r: number, c: number) => r >= 0 && c >= 0 && r < size && c < size && white[r][c];
  /** A white cell keeps a run in each axis iff it still has a white neighbour on that axis. */
  const hasRuns = (r: number, c: number) =>
    !isWhite(r, c) || ((isWhite(r - 1, c) || isWhite(r + 1, c)) && (isWhite(r, c - 1) || isWhite(r, c + 1)));
  const neighboursKeepRuns = (r: number, c: number) => hasRuns(r - 1, c) && hasRuns(r + 1, c) && hasRuns(r, c - 1) && hasRuns(r, c + 1);
  const set = (r: number, c: number, value: boolean) => {
    white[r][c] = value;
    white[size - 1 - r][size - 1 - c] = value;
  };
  const isCentre = (r: number, c: number) => r === size - 1 - r && c === size - 1 - c;
  /** Black (r, c) and its mirror if no neighbour of either loses its last run partner. */
  const tryBlack = (r: number, c: number): boolean => {
    if (!white[r][c]) return false;
    set(r, c, false);
    // Only the cells beside the two new blacks can have lost a run — the full validator waits.
    if (!neighboursKeepRuns(r, c) || !neighboursKeepRuns(size - 1 - r, size - 1 - c)) {
      set(r, c, true);
      return false;
    }
    return true;
  };
  let blacks = 0;
  for (let tries = 0; blacks < wanted && tries < 40 * size * size; tries++) {
    const r = Math.floor(rng() * size);
    const c = Math.floor(rng() * size);
    if (tryBlack(r, c)) blacks += isCentre(r, c) ? 1 : 2;
  }
  if (blacks < wanted) return null;
  // Blacks only ever shorten runs, so an overlong run is one the scatter never touched — only
  // possible above 9×9. Break each with a black somewhere inside it (not at its ends, which
  // would just shorten it by one); density drifts up a little, the tolerance absorbs it.
  for (let guard = 0; guard < 4 * size; guard++) {
    const long = overlongStrip(white);
    if (!long) return white;
    const inner = long.cells.slice(1, -1);
    const pick = inner[Math.floor(rng() * inner.length)];
    if (!tryBlack(Math.floor(pick / size), pick % size)) continue;
  }
  return overlongStrip(white) ? null : white;
}

/**
 * A valid, 180°-symmetric layout whose black density is within `densityTolerance` of the
 * target, or `null` when `maxAttempts` restarts all failed (very dense or very sparse targets).
 *
 * Density is the generation lever E3 found (research findings §3b), so it is promised here,
 * not merely reported. Scatter hits it by construction (it places exactly the count, mirror
 * pairs permitting). Edges-inward's coin is not its density — forced whites make a layout
 * whiter than its coin, by an amount that depends on size — so the coin is steered: after each
 * attempt it moves half the gap between the achieved and the target density.
 */
export function generateKakuroLayout(options: KakuroLayoutOptions): boolean[][] | null {
  const { gridSize, blackDensity, method = 'scatter', densityTolerance = 0.03, blockBreak = 0, rng = Math.random, maxAttempts = 200 } = options;
  let coin = blackDensity;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const white = method === 'scatter' ? scatterLayout(gridSize, blackDensity, rng) : attemptLayout(gridSize, coin, rng, blockBreak);
    if (!white) continue;
    const achieved = blackDensityOf(white);
    if (Math.abs(achieved - blackDensity) <= densityTolerance && validateKakuroLayout(white).length === 0) return white;
    if (method === 'edges-inward') coin = Math.min(0.95, Math.max(0.05, coin + (blackDensity - achieved) / 2));
  }
  return null;
}

/** Black density of a mask: black cells over all interior cells. */
export function blackDensityOf(white: readonly boolean[][]): number {
  const size = white.length;
  return 1 - white.flat().filter(Boolean).length / (size * size);
}

/**
 * The runs of a bare mask (digits unknown, so sums are 0), each cell's runs, and the white
 * cells in reading order — what the fill and the repair both index the layout by.
 */
function indexRuns(white: readonly boolean[][]): { runs: Run[]; runsOfCell: number[][]; whites: number[] } {
  const size = white.length;
  const runs = deriveRuns(white.map((row) => row.map((w) => (w ? 1 : 0))));
  const runsOfCell: number[][] = Array.from({ length: size * size }, () => []);
  runs.forEach((run, index) => run.cells.forEach((cell) => runsOfCell[cell].push(index)));
  const whites = runsOfCell.flatMap((owners, cell) => (owners.length > 0 ? [cell] : []));
  return { runs, runsOfCell, whites };
}

/**
 * Give every white cell a digit so no run repeats one. A randomised DFS in reading order with a
 * used-digit mask per run; `null` only if the node budget runs out (a valid layout essentially
 * never does — the constraint is loose — but a budget keeps a pathological mask from hanging).
 */
export function fillKakuroLayout(white: readonly boolean[][], rng: () => number = Math.random, nodeBudget = 200_000): number[][] | null {
  const size = white.length;
  const { runs, runsOfCell, whites } = indexRuns(white);
  const used = new Array<number>(runs.length).fill(0);
  const value = new Array<number>(size * size).fill(0);
  let nodes = 0;

  const place = (k: number): boolean => {
    if (++nodes > nodeBudget) return false;
    if (k === whites.length) return true;
    const cell = whites[k];
    for (const digit of shuffle([...DIGITS], rng)) {
      const bit = 1 << digit;
      if (runsOfCell[cell].some((run) => (used[run] & bit) !== 0)) continue;
      for (const run of runsOfCell[cell]) used[run] |= bit;
      value[cell] = digit;
      if (place(k + 1)) return true;
      for (const run of runsOfCell[cell]) used[run] &= ~bit;
    }
    value[cell] = 0;
    return false;
  };

  if (!place(0)) return null;
  return white.map((row, r) => row.map((_, c) => value[r * size + c]));
}

export interface ClimbOptions {
  rng?: () => number;
  /** Mutations tried before giving up. */
  stepCap?: number;
  /** Wall-clock cap — a spike needs one from the first run (L16). */
  msCap?: number;
  /** Mutations without a strict improvement before giving up — a plateau is left to a fresh start sooner. */
  stallCap?: number;
}

export interface ClimbResult {
  solution: number[][];
  /** 0 when the objective was reached; the last objective value otherwise. */
  score: number;
  steps: number;
  ms: number;
}

/**
 * The one hill-climb both the repair and the tier walk run: mutate one white cell to a digit
 * legal in both its runs, keep it when the objective does not rise (plateau moves included —
 * they are what lets the climb cross flat regions), stop at 0 or at a cap. The runs' cells never
 * change under a one-cell mutation — only the two sums through that cell do — so the sums are
 * kept in place and nudged by the digit's delta, and the objective sees the live `runs`.
 */
function hillClimb(start: readonly number[][], objective: (runs: readonly Run[]) => number, options: ClimbOptions = {}): ClimbResult {
  const size = start.length;
  // The wall-clock cap scales with the grid: a 6×6 that has not converged in a second is on a
  // plateau a fresh layout escapes faster than more steps would (measured, E4).
  const { rng = Math.random, stepCap = 4_000, msCap = 25 * size * size, stallCap = Infinity } = options;
  const { runs, runsOfCell, whites } = indexRuns(whiteMaskOf(start));
  const current = start.map((row) => [...row]);
  for (const run of runs) run.sum = run.cells.reduce((sum, cell) => sum + current[Math.floor(cell / size)][cell % size], 0);

  let currentScore = objective(runs);
  let steps = 0;
  let stalled = 0;
  const started = performance.now();
  while (currentScore !== 0 && steps < stepCap && stalled < stallCap && performance.now() - started < msCap) {
    steps++;
    stalled++;
    const cell = whites[Math.floor(rng() * whites.length)];
    const r = Math.floor(cell / size);
    const c = cell % size;
    let taken = 0;
    for (const run of runsOfCell[cell]) {
      for (const other of runs[run].cells) if (other !== cell) taken |= 1 << current[Math.floor(other / size)][other % size];
    }
    const previous = current[r][c];
    const options = DIGITS.filter((digit) => (taken & (1 << digit)) === 0 && digit !== previous);
    if (options.length === 0) continue;
    const digit = options[Math.floor(rng() * options.length)];
    current[r][c] = digit;
    for (const run of runsOfCell[cell]) runs[run].sum += digit - previous;
    const nextScore = objective(runs);
    if (nextScore <= currentScore) {
      if (nextScore < currentScore) stalled = 0;
      currentScore = nextScore;
    } else {
      current[r][c] = previous;
      for (const run of runsOfCell[cell]) runs[run].sum -= digit - previous;
    }
  }
  return { solution: current, score: currentScore, steps, ms: performance.now() - started };
}

export interface RepairOptions extends ClimbOptions {
  /** Solutions counted per objective evaluation; more than this scores as "many". */
  countLimit?: number;
  /** Node budget per objective evaluation; exhausting it also scores as "many". */
  countBudget?: number;
}

export interface RepairResult extends ClimbResult {
  /** 1 when repaired; the last solution count otherwise. */
  solutions: number;
}

/**
 * Hill-climb a fill toward uniqueness. The objective is the solution count of the clues the fill
 * implies minus one, capped at `countLimit` — 0 exactly when the puzzle is unique. Returns the
 * best fill reached either way; check `solutions === 1`.
 */
export function repairToUnique(start: readonly number[][], options: RepairOptions = {}): RepairResult {
  // Measured on 30 identical seeded 9×9 fills (E5): a count limit of 50 plateaus — every
  // neighbour of a many-solution fill scores the same — and 17/30 repaired at 2.0 s per accepted
  // puzzle; 200 keeps a gradient (24/30), and giving up after 600 steps without improvement cuts
  // the rest short: 0.77 s per accepted puzzle. Larger limits pay more per step than they return.
  const { countLimit = 200, countBudget = 20_000, stallCap = 600, ...climb } = options;
  const size = start.length;
  const result = hillClimb(
    start,
    (runs) => {
      const count = countKakuroSolutions({ gridSize: size, runs }, { limit: countLimit, nodeBudget: countBudget });
      return (count.exhausted ? countLimit : count.solutions) - 1;
    },
    { ...climb, stallCap }
  );
  return { ...result, solutions: result.score + 1 };
}

export interface WalkOptions extends ClimbOptions {
  /** Node budget for the uniqueness check each step. */
  countBudget?: number;
}

/**
 * Hill-climb a *unique* puzzle toward a target tier, keeping it unique. The objective orders
 * every fill by how far it is from "unique and exactly this tier":
 *
 * ```text
 * not unique                      → 1000            (never kept over a unique fill)
 * unique, ladder cannot finish it → 500 + undecided cells
 * unique, harder than the target  → 100 + steps above the target tier   ← fewer is closer
 * unique, easier than the target  → 50 − cells the tier-below ladder leaves undecided  ← more is closer
 * unique, exactly the target      → 0
 * ```
 *
 * The gradients inside each band are what make it a climb rather than a lottery: a hard
 * puzzle walking to easy sheds its above-tier steps one by one; an easy one walking to expert
 * gets harder for the tier-3 ladder step by step until a chain is needed. Measured (E5): 9×9
 * easy in ~0.2 s, extreme in ~0.5 s, every target at every size reached — see
 * `kakuro-generator.md`.
 */
export function walkToTier(start: readonly number[][], target: KakuroTier, options: WalkOptions = {}): ClimbResult {
  const { countBudget = 20_000, ...climb } = options;
  const size = start.length;
  const undecided = (solver: KakuroLogicalSolver) => {
    let cells = 0;
    for (let cell = 0; cell < size * size; cell++) {
      const mask = solver.candidatesOf(cell);
      if (mask !== 0 && (mask & (mask - 1)) !== 0) cells++;
    }
    return cells;
  };
  return hillClimb(
    start,
    (runs) => {
      const count = countKakuroSolutions({ gridSize: size, runs }, { limit: 2, nodeBudget: countBudget });
      if (count.exhausted || count.solutions !== 1) return 1000;
      const solver = new KakuroLogicalSolver({ gridSize: size, runs });
      const result = solver.solve({ recordSteps: true });
      if (!result.solved) return 500 + undecided(solver);
      const hardest = result.hardestTier === 0 ? 1 : result.hardestTier;
      if (hardest === target) return 0;
      if (hardest > target) return 100 + result.steps.filter((step) => step.tier > target).length;
      const below = new KakuroLogicalSolver({ gridSize: size, runs });
      below.solve({ maxTier: (target - 1) as KakuroTier });
      return 50 - Math.min(49, undecided(below));
    },
    climb
  );
}

export interface GenerateUniqueOptions {
  gridSize: number;
  blackDensity: number;
  method?: KakuroLayoutMethod;
  rng?: () => number;
  /** Layout+fill+repair rounds before giving up. */
  maxRounds?: number;
  /** Wall-clock budget for all rounds together; each round's repair gets what is left of it. */
  timeBudgetMs?: number;
  repair?: RepairOptions;
  /** Walk the repaired fill to this tier before accepting it (E5); absent = accept whatever tier came out. */
  targetTier?: KakuroTier;
}

/**
 * A fresh, unique Kakuro: layout → fill → repair → verify, labelled by the classifier with
 * whatever tier it came out as. `null` when every round failed to repair (the caller decides
 * whether to retry at another density or fall back).
 */
export function generateUniqueKakuro(options: GenerateUniqueOptions): KakuroPuzzle | null {
  const { gridSize, blackDensity, method, rng = Math.random, maxRounds = 5, timeBudgetMs = Infinity, repair, targetTier } = options;
  const started = performance.now();
  for (let round = 0; round < maxRounds; round++) {
    const remaining = timeBudgetMs - (performance.now() - started);
    if (remaining <= 0) break;
    const white = generateKakuroLayout({ gridSize, blackDensity, method, rng });
    if (!white) continue;
    const fill = fillKakuroLayout(white, rng);
    if (!fill) continue;
    // One clock for every stage: a round's repair never runs past what the budget has left.
    const msCap = Math.min(repair?.msCap ?? 25 * gridSize * gridSize, remaining);
    const repaired = repairToUnique(fill, { rng, ...repair, msCap });
    if (repaired.solutions !== 1) continue;
    let solution = repaired.solution;
    if (targetTier !== undefined) {
      const left = timeBudgetMs - (performance.now() - started);
      const walked = walkToTier(solution, targetTier, { rng, msCap: Math.min(repair?.msCap ?? 25 * gridSize * gridSize, left) });
      if (walked.score !== 0) continue;
      solution = walked.solution;
    }
    const runs = deriveRuns(solution);
    // The objectives counted with a node budget; the final word is the exact verifier's.
    if (isKakuroUnique({ gridSize, runs }) !== true) continue;
    const difficulty = classifyKakuro({ gridSize, runs }).difficulty;
    if (targetTier !== undefined && difficulty !== TIER_DIFFICULTY[targetTier as Exclude<KakuroTier, 0>]) continue;
    return {
      variant: 'kakuro',
      gridSize,
      grid: solution.map((row) => row.map(() => 0)),
      solution,
      runs,
      difficulty,
    };
  }
  return null;
}
