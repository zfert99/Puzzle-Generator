/**
 * Hand-baked Kakuro puzzles: static, known-good boards for the UI to render and for later
 * engine slices to be tested against, until a generator exists (plan slice V1).
 *
 * A fixture is authored as its **solved interior grid** in text — one string per row, a digit
 * for each white cell and `#` for each black one — and everything else (the empty player grid,
 * the runs and their clue sums) is derived from that. See `kakuro-fixtures.md` for why.
 */

import { deriveRuns, validateKakuroLayout, whiteMaskOf } from './kakuro-layout';
import { validateKakuroRuns, type KakuroDifficulty, type KakuroPuzzle } from './kakuro-types';

const BLACK = '#';

/**
 * Build a `KakuroPuzzle` from solved-grid text, and refuse to build an illegal one: the layout
 * must pass `validateKakuroLayout` and the derived runs must pass `validateKakuroRuns` (which
 * is what catches a digit repeated within a run).
 *
 * @throws if a row contains anything but `1`–`9` and `#`, or if either validator reports a
 * problem — the message lists every problem found.
 */
export function parseKakuroFixture(rows: readonly string[], difficulty: KakuroDifficulty): KakuroPuzzle {
  const solution = rows.map((row, r) =>
    [...row].map((char, c) => {
      if (char === BLACK) return 0;
      if (char >= '1' && char <= '9') return Number(char);
      throw new Error(`kakuro fixture: unexpected "${char}" at row ${r}, column ${c}`);
    })
  );

  const runs = deriveRuns(solution);
  const problems = [...validateKakuroLayout(whiteMaskOf(solution)), ...validateKakuroRuns(runs, solution)];
  if (problems.length > 0) {
    throw new Error(`kakuro fixture is invalid:\n${problems.join('\n')}`);
  }

  return {
    variant: 'kakuro',
    gridSize: solution.length,
    grid: solution.map((row) => row.map(() => 0)),
    solution,
    runs,
    difficulty,
  };
}

// The `difficulty` on both fixtures is a PLACEHOLDER. Nothing can grade a Kakuro until the
// classifier exists (slice E2), which then assigns the real label.

/** 7×7 — 32 white cells, 20 runs. */
export const KAKURO_FIXTURE_7X7: KakuroPuzzle = parseKakuroFixture(
  [
    '##64###',
    '#587964',
    '869#186',
    '72###42',
    '512#179',
    '476859#',
    '###43##',
  ],
  'medium'
);

/** 9×9 — 55 white cells, 38 runs. */
export const KAKURO_FIXTURE_9X9: KakuroPuzzle = parseKakuroFixture(
  [
    '##18#24##',
    '#356#324#',
    '31#981#78',
    '528#98764',
    '##12549##',
    '31587#259',
    '42#318#87',
    '#437#214#',
    '##89#95##',
  ],
  'medium'
);

export const KAKURO_FIXTURES: readonly KakuroPuzzle[] = [KAKURO_FIXTURE_7X7, KAKURO_FIXTURE_9X9];
