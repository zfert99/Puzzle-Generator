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
import { classifyKakuro } from './kakuro-logical-solver';
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
 * One layout attempt. Returns the mask, or `null` on a contradiction (a cell forced both ways,
 * or a mirror pair that disagrees) — the caller restarts.
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
    const twin = mirror(cell);
    if (cells[twin] !== -1 && cells[twin] !== value) return null;
    cells[cell] = value;
    cells[twin] = value;
  }
  return Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => cells[r * size + c] === 1));
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
  let blacks = 0;
  for (let tries = 0; blacks < wanted && tries < 40 * size * size; tries++) {
    const r = Math.floor(rng() * size);
    const c = Math.floor(rng() * size);
    if (!white[r][c]) continue;
    set(r, c, false);
    // Only the cells beside the two new blacks can have lost a run — the full validator waits.
    if (!neighboursKeepRuns(r, c) || !neighboursKeepRuns(size - 1 - r, size - 1 - c)) {
      set(r, c, true);
      continue;
    }
    blacks += white[r][c] === white[size - 1 - r][size - 1 - c] && r * size + c === (size - 1 - r) * size + (size - 1 - c) ? 1 : 2;
  }
  return blacks >= wanted ? white : null;
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
    coin = Math.min(0.95, Math.max(0.05, coin + (blackDensity - achieved) / 2));
  }
  return null;
}

/** Black density of a mask: black cells over all interior cells. */
export function blackDensityOf(white: readonly boolean[][]): number {
  const size = white.length;
  return 1 - white.flat().filter(Boolean).length / (size * size);
}

/** The runs of a bare mask — digits unknown, so sums are 0. */
function runsOfMask(white: readonly boolean[][]): Run[] {
  return deriveRuns(white.map((row) => row.map((w) => (w ? 1 : 0))));
}

/**
 * Give every white cell a digit so no run repeats one. A randomised DFS in reading order with a
 * used-digit mask per run; `null` only if the node budget runs out (a valid layout essentially
 * never does — the constraint is loose — but a budget keeps a pathological mask from hanging).
 */
export function fillKakuroLayout(white: readonly boolean[][], rng: () => number = Math.random, nodeBudget = 200_000): number[][] | null {
  const size = white.length;
  const runs = runsOfMask(white);
  const runsOfCell: number[][] = Array.from({ length: size * size }, () => []);
  runs.forEach((run, index) => run.cells.forEach((cell) => runsOfCell[cell].push(index)));
  const whites = runsOfCell.flatMap((owners, cell) => (owners.length > 0 ? [cell] : []));
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

export interface RepairOptions {
  rng?: () => number;
  /** Mutations tried before giving up. */
  stepCap?: number;
  /** Wall-clock cap — a spike needs one from the first run (L16). */
  msCap?: number;
  /** Solutions counted per objective evaluation; more than this scores as "many". */
  countLimit?: number;
  /** Node budget per objective evaluation; exhausting it also scores as "many". */
  countBudget?: number;
}

export interface RepairResult {
  solution: number[][];
  /** 1 when repaired; the last objective value otherwise. */
  solutions: number;
  steps: number;
  ms: number;
}

/**
 * Hill-climb a fill toward uniqueness one cell at a time. The objective is the solution count of
 * the clues the fill implies, capped at `countLimit`; a mutation is kept when the count does not
 * rise (plateau moves included — they are what lets the climb cross flat regions). Returns the
 * best fill reached either way; check `solutions === 1`.
 */
export function repairToUnique(start: readonly number[][], options: RepairOptions = {}): RepairResult {
  const size = start.length;
  // The wall-clock cap scales with the grid: a 6×6 that has not converged in a second is on a
  // plateau a fresh layout escapes faster than more steps would (measured, E4).
  const { rng = Math.random, stepCap = 4_000, msCap = 25 * size * size, countLimit = 50, countBudget = 20_000 } = options;
  const white = whiteMaskOf(start);
  const runs = runsOfMask(white);
  const runsOfCell: number[][] = Array.from({ length: size * size }, () => []);
  runs.forEach((run, index) => run.cells.forEach((cell) => runsOfCell[cell].push(index)));
  const whites = runsOfCell.flatMap((owners, cell) => (owners.length > 0 ? [cell] : []));

  const score = (solution: number[][]): number => {
    const count = countKakuroSolutions({ gridSize: size, runs: deriveRuns(solution) }, { limit: countLimit, nodeBudget: countBudget });
    return count.exhausted ? countLimit : count.solutions;
  };

  let current = start.map((row) => [...row]);
  let currentScore = score(current);
  let steps = 0;
  const started = performance.now();
  while (currentScore !== 1 && steps < stepCap && performance.now() - started < msCap) {
    steps++;
    const cell = whites[Math.floor(rng() * whites.length)];
    const r = Math.floor(cell / size);
    const c = cell % size;
    let taken = 0;
    for (const run of runsOfCell[cell]) {
      for (const other of runs[run].cells) if (other !== cell) taken |= 1 << current[Math.floor(other / size)][other % size];
    }
    const options = DIGITS.filter((digit) => (taken & (1 << digit)) === 0 && digit !== current[r][c]);
    if (options.length === 0) continue;
    const next = current.map((row) => [...row]);
    next[r][c] = options[Math.floor(rng() * options.length)];
    const nextScore = score(next);
    if (nextScore <= currentScore) {
      current = next;
      currentScore = nextScore;
    }
  }
  return { solution: current, solutions: currentScore, steps, ms: performance.now() - started };
}

export interface GenerateUniqueOptions {
  gridSize: number;
  blackDensity: number;
  method?: KakuroLayoutMethod;
  rng?: () => number;
  /** Layout+fill+repair rounds before giving up. */
  maxRounds?: number;
  repair?: RepairOptions;
}

/**
 * A fresh, unique Kakuro: layout → fill → repair → verify, labelled by the classifier with
 * whatever tier it came out as. `null` when every round failed to repair (the caller decides
 * whether to retry at another density or fall back).
 */
export function generateUniqueKakuro(options: GenerateUniqueOptions): KakuroPuzzle | null {
  const { gridSize, blackDensity, method, rng = Math.random, maxRounds = 5, repair } = options;
  for (let round = 0; round < maxRounds; round++) {
    const white = generateKakuroLayout({ gridSize, blackDensity, method, rng });
    if (!white) continue;
    const fill = fillKakuroLayout(white, rng);
    if (!fill) continue;
    const repaired = repairToUnique(fill, { rng, ...repair });
    if (repaired.solutions !== 1) continue;
    const runs = deriveRuns(repaired.solution);
    // The objective counted with a node budget; the final word is the exact verifier's.
    if (isKakuroUnique({ gridSize, runs }) !== true) continue;
    return {
      variant: 'kakuro',
      gridSize,
      grid: repaired.solution.map((row) => row.map(() => 0)),
      solution: repaired.solution,
      runs,
      difficulty: classifyKakuro({ gridSize, runs }).difficulty,
    };
  }
  return null;
}
