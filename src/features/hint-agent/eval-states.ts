import { HumanSolver } from '@/features/engine/human-solver';
import { generateSudoku, type Difficulty } from '@/features/engine/sudoku';
import { listDeductions } from '@/features/engine/deductions';
import { gridToString } from './hint-tools';

/** A grid the harness will ask for a hint on, plus what the oracle says about it. */
export interface EvalState {
  id: string;
  grid: string;
  /** `has_deduction`: at least one technique applies. `none`: the oracle is empty, so the only correct answer is a refusal. */
  kind: 'has_deduction' | 'none';
  difficulty: Difficulty;
}

export interface EvalStateOptions {
  seed?: number;
  /** Positions sampled per difficulty from solve walks. */
  perDifficulty?: number;
  /** Positions with no available deduction. */
  noneCount?: number;
  difficulties?: Difficulty[];
}

/** Deterministic PRNG so the state set is the same on every machine. */
export function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds the fixed state set. Two populations:
 *
 * - **has_deduction** — positions sampled along a human-solver walk of a
 *   generated puzzle, so they range from "opening position, singles everywhere"
 *   to "late, one technique left". The walk applies the first deduction each
 *   step (eliminations included) but only samples when the grid changed, since
 *   the harness identifies a state by its grid string and the oracle is
 *   recomputed from that string.
 * - **none** — a puzzle grid with clues removed until the oracle is empty. Every
 *   removal weakens the constraints, so singles disappear first and eventually
 *   nothing fires. These are where an agent that reasons from candidates instead
 *   of the tool will invent a move.
 */
export function buildEvalStates(options: EvalStateOptions = {}): EvalState[] {
  const seed = options.seed ?? 2026;
  const perDifficulty = options.perDifficulty ?? 10;
  const noneCount = options.noneCount ?? 12;
  const difficulties = options.difficulties ?? ['easy', 'medium', 'hard', 'expert'];
  const states: EvalState[] = [];

  difficulties.forEach((difficulty, index) => {
    const rng = mulberry32(seed + index);
    const { grid } = generateSudoku(difficulty, 9, rng);
    const walk = walkGrids(grid);
    const stride = Math.max(1, Math.floor(walk.length / perDifficulty));
    for (let i = 0; i < walk.length && states.filter(s => s.difficulty === difficulty).length < perDifficulty; i += stride) {
      states.push({ id: `${difficulty}-${i}`, grid: walk[i], kind: 'has_deduction', difficulty });
    }
  });

  const noneRng = mulberry32(seed + 100);
  let attempts = 0;
  while (states.filter(s => s.kind === 'none').length < noneCount && attempts < noneCount * 4) {
    attempts++;
    const { grid } = generateSudoku('medium', 9, noneRng);
    const stuck = digUntilStuck(grid, noneRng);
    if (stuck) states.push({ id: `none-${attempts}`, grid: stuck, kind: 'none', difficulty: 'medium' });
  }

  return states;
}

/** Every distinct grid string along a first-deduction walk, initial position first. */
function walkGrids(grid: number[][]): string[] {
  const solver = new HumanSolver(grid);
  const grids = [gridToString(solver.grid)];
  while (!solver.isSolved()) {
    const [next] = listDeductions(solver);
    if (!next) break;
    for (const { r, c, digit } of next.placements) solver.placeNumber(r, c, digit);
    for (const { r, c, digit } of next.eliminations) solver.removeCandidate(r, c, digit);
    if (next.placements.length > 0) grids.push(gridToString(solver.grid));
  }
  return grids;
}

function digUntilStuck(grid: number[][], rng: () => number): string | null {
  const work = grid.map(row => [...row]);
  const filled: [number, number][] = [];
  work.forEach((row, r) => row.forEach((v, c) => { if (v !== 0) filled.push([r, c]); }));
  for (let i = filled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [filled[i], filled[j]] = [filled[j], filled[i]];
  }
  for (const [r, c] of filled) {
    work[r][c] = 0;
    if (listDeductions(new HumanSolver(work)).length === 0) return gridToString(work);
  }
  return null;
}
