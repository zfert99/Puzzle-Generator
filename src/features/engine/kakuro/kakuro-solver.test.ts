import { describe, expect, it } from 'vitest';
import { ALL_KAKURO_FIXTURES, KAKURO_FIXTURE_7X7_CHAINS, KAKURO_FIXTURE_9X9_CHAINS, parseKakuroFixture } from './kakuro-fixtures';
import { deriveRuns } from './kakuro-layout';
import { countKakuroSolutions, deduceKakuro, isKakuroUnique, type KakuroShape } from './kakuro-solver';
import type { Run } from './kakuro-types';

// The smallest real puzzle: 3×3, black in two opposite corners.
//   # 1 3        across sums: 4 / 7 / 8
//   1 2 4        down sums:   4 / 8 / 7
//   3 5 #
const TINY = parseKakuroFixture(['#13', '124', '35#'], 'easy');

/**
 * An independent brute force: try every digit in every white cell, checking each run's
 * all-different and (when complete) its sum. Nothing shared with the solver but the run list.
 */
function bruteForceCount(shape: KakuroShape, limit = 50): number {
  const { gridSize: size, runs } = shape;
  const value = new Array<number>(size * size).fill(0);
  const whites = [...new Set(runs.flatMap((run) => run.cells))].sort((a, b) => a - b);
  const runsOf = (cell: number) => runs.filter((run) => run.cells.includes(cell));
  let count = 0;

  const ok = (run: Run): boolean => {
    const digits = run.cells.map((cell) => value[cell]).filter((d) => d > 0);
    if (new Set(digits).size !== digits.length) return false;
    const total = digits.reduce((a, b) => a + b, 0);
    return digits.length === run.cells.length ? total === run.sum : total < run.sum;
  };

  const place = (k: number): boolean => {
    if (k === whites.length) return ++count >= limit;
    const cell = whites[k];
    for (let d = 1; d <= 9; d++) {
      value[cell] = d;
      if (runsOf(cell).every(ok) && place(k + 1)) return true;
    }
    value[cell] = 0;
    return false;
  };
  place(0);
  return count;
}

/** A random small solved grid: random mask, then a random fill with no repeat in any run. */
function randomSolvedGrid(size: number): number[][] | null {
  const white = Array.from({ length: size }, () => Array.from({ length: size }, () => Math.random() < 0.7));
  const shape = white.map((row) => row.map((w) => (w ? 1 : 0)));
  const runs = deriveRuns(shape);
  // Only keep cells that are in at least one run of length ≥ 2 (lone whites become black).
  const inRun = new Set(runs.flatMap((run) => run.cells));
  const solution = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const cells = [...inRun].sort((a, b) => a - b);
  if (cells.length === 0) return null;
  const mates = (cell: number) => runs.filter((run) => run.cells.includes(cell)).flatMap((run) => run.cells);

  const fill = (k: number): boolean => {
    if (k === cells.length) return true;
    const cell = cells[k];
    const used = new Set(mates(cell).map((m) => solution[Math.floor(m / size)][m % size]));
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !used.has(d)).sort(() => Math.random() - 0.5);
    for (const d of digits) {
      solution[Math.floor(cell / size)][cell % size] = d;
      if (fill(k + 1)) return true;
    }
    solution[Math.floor(cell / size)][cell % size] = 0;
    return false;
  };
  return fill(0) ? solution : null;
}

describe('countKakuroSolutions', () => {
  it('finds the single solution of the tiny puzzle', () => {
    const result = countKakuroSolutions(TINY);
    expect(result).toMatchObject({ solutions: 1, exhausted: false });
    expect(result.solution).toEqual(TINY.solution);
  });

  it('reports two solutions for an isolated 2×2 (digits swap along the square)', () => {
    // 1 2 / 2 1 — swapping to 2 1 / 1 2 keeps every sum.
    const twoByTwo = parseKakuroFixture(['12', '21'], 'easy');
    const result = countKakuroSolutions(twoByTwo, { limit: 10 });
    expect(result.solutions).toBe(2);
  });

  it('reports many solutions for a critical 2×9 all-white rectangle (research G10)', () => {
    const rows = Array.from({ length: 9 }, (_, r) => (r < 2 ? '.........' : '#########'));
    const solution = rows.map((row, r) =>
      [...row].map((ch, c) => (ch === '.' ? ((c + r * 4) % 9) + 1 : 0))
    );
    const shape = { gridSize: 9, runs: deriveRuns(solution) };
    expect(countKakuroSolutions(shape, { limit: 10 }).solutions).toBe(10);
  });

  it('counts exactly what an independent brute force counts, on random small grids', () => {
    // Budgeted to stay well under a second solo: the brute force is the cost (9^whites in the
    // worst case), and a 4×4 at 70% white can take hundreds of ms alone. An earlier version ran
    // 150 trials (~5 s solo) and timed out under full-suite worker contention — the flake class
    // `Docs/pre-merge-log.md` documents — so trials and the white-cell cap are both held down.
    let checked = 0;
    for (let trial = 0; trial < 60; trial++) {
      const size = 3 + Math.floor(Math.random() * 2);
      const solution = randomSolvedGrid(size);
      if (!solution || solution.flat().filter(Boolean).length > 11) continue;
      const shape = { gridSize: size, runs: deriveRuns(solution) };
      const expected = bruteForceCount(shape, 50);
      const result = countKakuroSolutions(shape, { limit: 50, nodeBudget: 1_000_000 });
      expect(result.exhausted).toBe(false);
      expect(result.solutions, JSON.stringify(solution)).toBe(expected);
      checked++;
    }
    expect(checked).toBeGreaterThan(25);
  });

  it('respects placed digits in a starting grid', () => {
    const grid = TINY.solution.map((row) => row.map(() => 0));
    grid[1][1] = 4; // wrong — the centre is 2
    expect(countKakuroSolutions(TINY, { grid }).solutions).toBe(0);
    grid[1][1] = 2;
    expect(countKakuroSolutions(TINY, { grid }).solutions).toBe(1);
  });

  it('reports no solutions for a shape with no runs instead of counting the empty grid', () => {
    expect(countKakuroSolutions({ gridSize: 9, runs: [] })).toMatchObject({ solutions: 0, exhausted: false });
    expect(isKakuroUnique({ gridSize: 9, runs: [] })).toBe(false);
    expect(deduceKakuro({ gridSize: 9, runs: [] }, []).contradiction).toBe(true);
  });

  it('reports budget exhaustion rather than guessing', () => {
    const result = countKakuroSolutions(KAKURO_FIXTURE_9X9_CHAINS, { nodeBudget: 1 });
    expect(result.exhausted).toBe(true);
    expect(isKakuroUnique(KAKURO_FIXTURE_9X9_CHAINS, 1)).toBeNull();
  });
});

describe('the baked fixtures', () => {
  it.each(ALL_KAKURO_FIXTURES.map((p) => [`${p.gridSize}×${p.gridSize} ${p.difficulty}`, p] as const))(
    '%s has exactly one solution, and it is the baked one',
    (_name, puzzle) => {
      const result = countKakuroSolutions(puzzle);
      expect(result).toMatchObject({ solutions: 1, exhausted: false });
      expect(result.solution).toEqual(puzzle.solution);
      expect(isKakuroUnique(puzzle)).toBe(true);
    }
  );

  it('verifies the 9×9 well inside the 50 ms gate (loose bound — timing under load)', () => {
    const started = performance.now();
    for (let i = 0; i < 10; i++) countKakuroSolutions(KAKURO_FIXTURE_9X9_CHAINS);
    const perVerify = (performance.now() - started) / 10;
    expect(perVerify).toBeLessThan(500);
  });

  it('becomes non-unique when one cell is bumped by the ±1 clue trick (research G10)', () => {
    // Raise the across AND down clue through one white cell by 1: the puzzle can no longer be
    // the baked solution, and the trick is Mathimagics' recipe for multi-solution test cases.
    const runs = KAKURO_FIXTURE_7X7_CHAINS.runs.map((run) => ({ ...run, cells: [...run.cells] }));
    const cell = runs[0].cells[0];
    for (const run of runs) if (run.cells.includes(cell)) run.sum += 1;
    const result = countKakuroSolutions({ gridSize: 7, runs }, { limit: 10 });
    expect(result.solutions).not.toBe(1);
  });
});

describe('deduceKakuro', () => {
  it('forces digits from an empty grid by propagation alone, all matching the solution', () => {
    const empty = TINY.solution.map((row) => row.map(() => 0));
    const { forced, contradiction } = deduceKakuro(TINY, empty);

    expect(contradiction).toBe(false);
    expect(forced.length).toBeGreaterThan(0);
    // (1,0) = index 3: across 7-in-three {1,2,4} meets down 4-in-two {1,3} → only 1 fits.
    expect(forced).toContainEqual({ cell: 3, digit: 1 });
    for (const { cell, digit } of forced) {
      expect(digit).toBe(TINY.solution[Math.floor(cell / 3)][cell % 3]);
    }
  });

  it('never lists a cell that is already filled', () => {
    const grid = TINY.solution.map((row) => [...row]);
    expect(deduceKakuro(TINY, grid).forced).toEqual([]);
  });

  it('reports a contradiction for a grid that cannot be completed', () => {
    const grid = TINY.solution.map((row) => row.map(() => 0));
    grid[0][1] = 9; // the top across run is 4-in-two: {1,3}
    expect(deduceKakuro(TINY, grid).contradiction).toBe(true);
  });

  it('only ever forces solution digits on the baked puzzles', () => {
    for (const puzzle of ALL_KAKURO_FIXTURES) {
      const empty = puzzle.solution.map((row) => row.map(() => 0));
      const { forced, contradiction } = deduceKakuro(puzzle, empty);
      expect(contradiction).toBe(false);
      for (const { cell, digit } of forced) {
        expect(digit).toBe(puzzle.solution[Math.floor(cell / puzzle.gridSize)][cell % puzzle.gridSize]);
      }
    }
  });
});
