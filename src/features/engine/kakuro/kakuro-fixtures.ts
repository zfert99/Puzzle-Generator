/**
 * Hand-baked Kakuro puzzles: static, known-good boards the board serves and the engine slices
 * are tested against, until a generator exists (plan slices V1 → E2a).
 *
 * A fixture is authored as its **solved interior grid** in text — one string per row, a digit
 * for each white cell and `#` for each black one — and everything else (the empty player grid,
 * the runs and their clue sums) is derived from that. See `kakuro-fixtures.md` for why, and for
 * how the digits were found (a throwaway hill-climb with the repo's own solvers as the
 * objective — unique, and finishable by the logical ladder at the named tier).
 */

import { deriveRuns, validateKakuroLayout, whiteMaskOf } from './kakuro-layout';
import { validateKakuroRuns, type KakuroDifficulty, type KakuroPuzzle } from './kakuro-types';

const BLACK = '#';

/**
 * Build a `KakuroPuzzle` from solved-grid text, and refuse to build an illegal one: the layout
 * must pass `validateKakuroLayout` and the derived runs must pass `validateKakuroRuns` (which
 * is what catches a digit repeated within a run).
 *
 * `difficulty` is a label the caller vouches for — for the served fixtures below, the one the
 * classifier assigns (asserted by `kakuro-fixtures.test.ts`); `'unrated'` for anything else.
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

/**
 * The served set: one easy / medium / hard per size on the two hand-drawn layouts (7×7: 32
 * whites, 20 runs; 9×9: 55 whites, 38 runs). Each label is the tier the logical ladder needs to
 * finish the puzzle (T1 → easy, T2 → medium, T3 → hard) — the fills were searched for exactly
 * that, and the test suite re-classifies them so a label can never drift from the solver.
 */
export const KAKURO_FIXTURES: readonly KakuroPuzzle[] = [
  parseKakuroFixture(['##17###', '#456891', '839#964', '95###86', '123#152', '519247#', '###13##'], 'easy'),
  parseKakuroFixture(['##72###', '#783956', '431#412', '19###79', '281#345', '354712#', '###52##'], 'medium'),
  parseKakuroFixture(['##12###', '#826357', '763#124', '31###15', '876#149', '921356#', '###12##'], 'hard'),
  parseKakuroFixture(
    ['##19#79##', '#348#986#', '97#423#16', '812#46839', '##49316##', '48971#987', '86#689#71', '#213#791#', '##38#14##'],
    'easy'
  ),
  parseKakuroFixture(
    ['##56#91##', '#613#753#', '57#968#79', '897#25917', '##24361##', '82679#751', '27#675#95', '#849#831#', '##68#15##'],
    'medium'
  ),
  parseKakuroFixture(
    ['##17#13##', '#289#592#', '31#813#62', '876#36251', '##95271##', '81527#457', '45#342#19', '#621#896#', '##79#16##'],
    'hard'
  ),
];

/** The served fixture for a size and difficulty, if one exists. */
export function findKakuroFixture(gridSize: number, difficulty: KakuroDifficulty): KakuroPuzzle | undefined {
  return KAKURO_FIXTURES.find((p) => p.gridSize === gridSize && p.difficulty === difficulty);
}

/**
 * Unique, but NOT finishable by the tier 1–3 ladder: the first fills found (V1), hill-climbed
 * for uniqueness alone. They stall with ~27–29 cells undecided and will need the chain tiers
 * (plan slice E2b) — kept as the test material for exactly that, never served.
 */
export const KAKURO_FIXTURE_7X7_CHAINS: KakuroPuzzle = parseKakuroFixture(
  ['##64###', '#587964', '869#186', '72###42', '512#179', '476859#', '###43##'],
  'unrated'
);

export const KAKURO_FIXTURE_9X9_CHAINS: KakuroPuzzle = parseKakuroFixture(
  ['##18#24##', '#356#324#', '31#981#78', '528#98764', '##12549##', '31587#259', '42#318#87', '#437#214#', '##89#95##'],
  'unrated'
);

/** Every baked puzzle, served or not — for the uniqueness and soundness tests. */
export const ALL_KAKURO_FIXTURES: readonly KakuroPuzzle[] = [
  ...KAKURO_FIXTURES,
  KAKURO_FIXTURE_7X7_CHAINS,
  KAKURO_FIXTURE_9X9_CHAINS,
];
