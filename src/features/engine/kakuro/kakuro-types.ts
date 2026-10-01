/**
 * Core Kakuro (Cross Sums) data shapes and the validator that keeps a puzzle's runs honest
 * against its solution.
 *
 * Kakuro has no row, column or box constraint. The only constraint unit is the **run**: a
 * maximal horizontal or vertical strip of white cells whose digits (1–9, at every grid size)
 * must sum to the run's clue with no digit repeated.
 *
 * See `kakuro-types.md` for the "why" behind the storage decisions (D2, D3).
 */

import type { GridConfig, GridSize } from '../sudoku';

/**
 * The five published tiers, plus `'unrated'`: a puzzle the classifier (`kakuro-logical-solver`)
 * could not finish with the techniques built so far, or one that has not been graded yet. The
 * label comes from the classifier or not at all (plan decision D8) — never from a guess.
 */
export type KakuroDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'extreme' | 'unrated';

export type RunDirection = 'across' | 'down';

/**
 * One run. `cells` holds FLAT interior indices (`row * gridSize + col`) in reading order — left
 * to right for `across`, top to bottom for `down` — so `cells[0]` is the cell the clue sits
 * beside. Structurally a Killer `Cage` plus a direction, which is what lets runs reuse the
 * daily's `cages` jsonb column later without a migration.
 */
export interface Run {
  /** Stable id, unique within the puzzle. */
  id: number;
  dir: RunDirection;
  /** The clue: the total of the run's solution digits. */
  sum: number;
  /** Flat interior cell indices in reading order; length 2–9. */
  cells: number[];
}

/**
 * A Kakuro puzzle. `grid` and `solution` are the **interior** N×N only — the strip of clue cells
 * a player sees along the top and left is a rendering concern, so `grid.length === gridSize`
 * holds here as it does for every other puzzle type (D2).
 *
 * Black cells are `0` in both `grid` and `solution` (D3). Kakuro has no givens, so `grid` is
 * all-zero; a cell is black exactly when it belongs to no run.
 */
export interface KakuroPuzzle {
  variant: 'kakuro';
  /** Interior size. A plain number: Kakuro's sizes are its own (D11), not Sudoku's 4/6/9. */
  gridSize: number;
  grid: number[][];
  /** Solved interior grid, `0` on black cells. SERVER-ONLY for ranked dailies. */
  solution: number[][];
  runs: Run[];
  difficulty: KakuroDifficulty;
}

export const MIN_RUN_LENGTH = 2;
export const MAX_RUN_LENGTH = 9;

/**
 * The board configuration for a Kakuro of interior size N. Boxless (there are no houses at
 * all — the row-strip sentinel keeps any ungated box reader harmless, as for Keisan), and
 * `maxNum` is **9 at every size**: Kakuro's digits are always 1–9, so the numpad and pencil
 * marks must not shrink with the grid the way Sudoku's do.
 */
export function kakuroGridConfig(size: GridSize): GridConfig {
  return { size, hasBoxes: false, boxWidth: size, boxHeight: 1, totalCells: size * size, maxNum: 9 };
}

/**
 * Check every invariant a puzzle's runs must satisfy against its solution, returning a list of
 * human-readable problems (empty array = valid). All errors at once rather than throwing on the
 * first — the same choice `validateKillerCages` makes, for the same debugging reason.
 *
 * Invariants: each run is a straight, gap-free line of 2–9 white cells in its stated direction,
 * with no repeated digit and a `sum` equal to its solution total; every white cell lies in
 * exactly one across run and exactly one down run; no black cell lies in any run.
 *
 * It does not check that runs are *maximal* or that the layout is a legal Kakuro shape — that
 * is `validateKakuroLayout`'s job, from the black/white mask alone.
 */
export function validateKakuroRuns(runs: readonly Run[], solution: readonly number[][]): string[] {
  const size = solution.length;
  const cellCount = size * size;
  const acrossCoverage = new Array<number>(cellCount).fill(0);
  const downCoverage = new Array<number>(cellCount).fill(0);
  const errors: string[] = [];

  for (const run of runs) {
    const { id, cells, dir } = run;
    if (cells.length < MIN_RUN_LENGTH || cells.length > MAX_RUN_LENGTH) {
      errors.push(`run ${id}: length ${cells.length} is outside ${MIN_RUN_LENGTH}..${MAX_RUN_LENGTH}`);
    }

    const step = dir === 'across' ? 1 : size;
    const coverage = dir === 'across' ? acrossCoverage : downCoverage;
    const digits: number[] = [];

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell < 0 || cell >= cellCount) {
        errors.push(`run ${id}: cell index ${cell} is out of range`);
        continue;
      }
      if (i > 0) {
        const wrapsRow = dir === 'across' && cell % size === 0;
        if (cell - cells[i - 1] !== step || wrapsRow) {
          errors.push(`run ${id}: cells are not a gap-free ${dir} line`);
        }
      }
      coverage[cell] += 1;
      const digit = solution[Math.floor(cell / size)][cell % size];
      if (digit === 0) errors.push(`run ${id}: includes black cell ${cell}`);
      digits.push(digit);
    }

    if (new Set(digits).size !== digits.length) {
      errors.push(`run ${id}: a digit repeats within the run`);
    }
    const total = digits.reduce((sum, digit) => sum + digit, 0);
    if (total !== run.sum) {
      errors.push(`run ${id}: sum ${run.sum} != solution total ${total}`);
    }
  }

  for (let cell = 0; cell < cellCount; cell++) {
    if (solution[Math.floor(cell / size)][cell % size] === 0) continue;
    if (acrossCoverage[cell] !== 1) {
      errors.push(`cell ${cell}: in ${acrossCoverage[cell]} across runs (expected 1)`);
    }
    if (downCoverage[cell] !== 1) {
      errors.push(`cell ${cell}: in ${downCoverage[cell]} down runs (expected 1)`);
    }
  }

  return errors;
}
