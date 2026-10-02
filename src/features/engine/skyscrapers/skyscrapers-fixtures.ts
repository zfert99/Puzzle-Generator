/**
 * Hand-baked Skyscrapers puzzles: static, known-good boards the workbench serves and the engine
 * slices are tested against, until a generator exists (plan slices V1 → E4).
 *
 * A fixture is authored as its **solved Latin square** in text — one string per row, one digit
 * per cell — plus a **clue mask** per side saying which of the 4N clues are kept (`x`) and which
 * are blank (`.`). The clue values themselves are derived from the solution, never typed, so a
 * clue that disagrees with its square cannot exist. See `skyscrapers-fixtures.md` for how the
 * squares and masks were found (a throwaway script: random Latin square → all clues → greedy
 * uniqueness-preserving removal with a counting solver) and what E1 still owes them.
 */

import { isGridSize, type GridSize } from '../sudoku';
import {
  GUTTER_SIDES,
  SKYSCRAPERS_LADDER,
  deriveClues,
  validateSkyscrapers,
  type SkyscraperClues,
  type SkyscrapersDifficulty,
  type SkyscrapersLevel,
  type SkyscrapersPuzzle,
} from './skyscrapers-types';

/** Which clues a fixture keeps, one string per side: `x` = kept, `.` = blank. */
export type ClueMask = Record<keyof SkyscraperClues, string>;

const KEEP = 'x';
const BLANK = '.';

/**
 * Build a `SkyscrapersPuzzle` from solved-square text and a clue mask, and refuse to build an
 * illegal one: the square must be a Latin square of the right size and the mask must match it.
 *
 * `difficulty` is a label the caller vouches for — `'unrated'` until the classifier (E2)
 * assigns one, so no fixture ever carries a grade the solver did not give it (D7).
 *
 * @throws if the row count is not a supported `GridSize`, if a row has the wrong length or
 * contains anything but the digits `1`–`N`, if a mask has the wrong length or an unknown
 * character, or if the validator reports a problem — the message lists every one.
 */
export function parseSkyscrapersFixture(
  rows: readonly string[],
  mask: ClueMask,
  difficulty: SkyscrapersDifficulty = 'unrated'
): SkyscrapersPuzzle {
  const size = rows.length;
  if (!isGridSize(size)) {
    throw new Error(`skyscrapers fixture: ${size} rows is not a supported grid size`);
  }
  const solution = rows.map((row, r) => {
    if (row.length !== size) {
      throw new Error(`skyscrapers fixture: row ${r} has ${row.length} cells, expected ${size}`);
    }
    return [...row].map((char, c) => {
      const digit = Number(char);
      if (!/^[1-9]$/.test(char) || digit > size) {
        throw new Error(`skyscrapers fixture: unexpected "${char}" at row ${r}, column ${c}`);
      }
      return digit;
    });
  });

  const all = deriveClues(solution);
  const clues = { top: [], bottom: [], left: [], right: [] } as SkyscraperClues;
  for (const side of GUTTER_SIDES) {
    const sideMask = mask[side];
    if (sideMask.length !== size) {
      throw new Error(`skyscrapers fixture: ${side} mask "${sideMask}" is not ${size} characters`);
    }
    clues[side] = [...sideMask].map((char, index) => {
      if (char === KEEP) return all[side][index];
      if (char === BLANK) return 0;
      throw new Error(`skyscrapers fixture: unexpected "${char}" in ${side} mask`);
    });
  }

  const puzzle: SkyscrapersPuzzle = {
    variant: 'skyscrapers',
    gridSize: size,
    grid: solution.map((row) => row.map(() => 0)),
    solution,
    clues,
    difficulty,
  };
  const problems = validateSkyscrapers(puzzle);
  if (problems.length > 0) {
    throw new Error(`skyscrapers fixture is invalid:\n${problems.join('\n')}`);
  }
  return puzzle;
}

/**
 * The served set, one per planned size (D4): each kept-clue set determined its square uniquely
 * under the throwaway counting solver that produced it — E1 proves that in-repo. The 5×5 keeps
 * only 5 of 20 clues (one more than the N−1 conjecture's floor, G5); the 6×6 keeps 15 of 24;
 * the 7×7 keeps 14 of 28. The 7×7 square had to be **repaired** into uniqueness (no random
 * 7×7 was unique with all 28 clues in 94,962 tries — log measurement, G4); see the `.md`.
 *
 * Each label is **the classifier's word** (E2, decision D7: a served label is the logical solver's
 * or `'unrated'`, never a guess) — written here rather than computed at import, because this
 * module sits in the client bundle via `usePuzzle` and three full solves plus the permutation
 * tables (~30 ms) would run on every `/play` load for a value that never changes.
 * `skyscrapers-fixtures.test.ts` re-grades every fixture and fails if a label drifts from the
 * solver. Thinning clues to the uniqueness floor makes hard puzzles, so the set grades
 * hard / extreme / extreme; the generator (E4/E5) makes the easy ones.
 */
export const SKYSCRAPERS_FIXTURE_5X5 = parseSkyscrapersFixture(
  ['45213', '54321', '12534', '31452', '23145'],
  { top: '..xx.', bottom: '.x...', left: '.....', right: '.xx..' },
  'hard'
);

export const SKYSCRAPERS_FIXTURE_6X6 = parseSkyscrapersFixture(
  ['132546', '561234', '214365', '356412', '423651', '645123'],
  { top: 'x.x.x.', bottom: '.x.x..', left: 'xxx.xx', right: '.xxxxx' },
  'extreme'
);

export const SKYSCRAPERS_FIXTURE_7X7 = parseSkyscrapersFixture(
  ['7146253', '5213476', '4351762', '6574321', '1762534', '2435617', '3627145'],
  { top: '.xx.x..', bottom: 'x.x.xx.', left: '.xx..xx', right: 'x..xx..' },
  'extreme'
);

export const SKYSCRAPERS_FIXTURES: readonly SkyscrapersPuzzle[] = [
  SKYSCRAPERS_FIXTURE_5X5,
  SKYSCRAPERS_FIXTURE_6X6,
  SKYSCRAPERS_FIXTURE_7X7,
];

/**
 * The research's 4×4 counterexample (G4): two different Latin squares that imply the **same**
 * 16 clues, so the fully clued puzzle has two solutions. Kept as the canonical non-unique case
 * for the exact solver's tests (E1) — a counting solver that reports 1 here is wrong.
 */
export const SKYSCRAPERS_NONUNIQUE_4X4: readonly SkyscrapersPuzzle[] = [
  parseSkyscrapersFixture(['1234', '2143', '3412', '4321'], { top: 'xxxx', bottom: 'xxxx', left: 'xxxx', right: 'xxxx' }),
  parseSkyscrapersFixture(['1234', '2413', '3142', '4321'], { top: 'xxxx', bottom: 'xxxx', left: 'xxxx', right: 'xxxx' }),
];

/**
 * What `/api/generate` prints until the generator exists (plan slice V3; the Kakuro counterpart was
 * `selectKakuroBatch`, replaced by `generateKakuroBatch` in E5): there is exactly **one** fixture
 * per size and its grade is whatever the classifier gave it, so a request is answered with that
 * fixture once — whatever levels the counts name — and only when exactly one puzzle is asked for. Asking for more would
 * print the same page twice; the route refuses it with the reason.
 */
export function selectSkyscrapersBatch(
  counts: Partial<Record<SkyscrapersLevel, number>>,
  options: { gridSize?: GridSize } = {}
): SkyscrapersPuzzle[] {
  const total = SKYSCRAPERS_LADDER.reduce((sum, level) => sum + (counts[level] ?? 0), 0);
  if (total !== 1) {
    throw new Error(`skyscrapers fixtures: one hand-made puzzle per size until the generator lands — ${total} requested`);
  }
  const size = options.gridSize ?? SKYSCRAPERS_FIXTURE_6X6.gridSize;
  const fixture = SKYSCRAPERS_FIXTURES.find((puzzle) => puzzle.gridSize === size);
  if (!fixture) throw new Error(`skyscrapers fixtures: no fixture at ${size}×${size}`);
  return [fixture];
}
