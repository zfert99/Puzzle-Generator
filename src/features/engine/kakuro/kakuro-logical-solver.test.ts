import { describe, expect, it } from 'vitest';
import { ALL_KAKURO_FIXTURES, KAKURO_FIXTURE_7X7_CHAINS, findKakuroFixture, parseKakuroFixture } from './kakuro-fixtures';
import { deriveRuns } from './kakuro-layout';
import {
  KakuroLogicalSolver,
  TECHNIQUE_TIER,
  classifyKakuro,
  explainKakuroHint,
  measureKakuro,
  type KakuroStep,
} from './kakuro-logical-solver';
import { scoreKakuroSolve } from './kakuro-score';
import { countKakuroSolutions } from './kakuro-solver';
import type { KakuroPuzzle } from './kakuro-types';

// The smallest real puzzle: 3×3, black in two opposite corners.
//   # 1 3        across sums: 4 / 7 / 8
//   1 2 4        down sums:   4 / 8 / 7
//   3 5 #
const TINY = parseKakuroFixture(['#13', '124', '35#'], 'unrated');

const easy7 = findKakuroFixture(7, 'easy') as KakuroPuzzle;
const medium7 = findKakuroFixture(7, 'medium') as KakuroPuzzle;
const hard7 = findKakuroFixture(7, 'hard') as KakuroPuzzle;

const digitAt = (puzzle: KakuroPuzzle, cell: number) =>
  puzzle.solution[Math.floor(cell / puzzle.gridSize)][cell % puzzle.gridSize];

/** Every placement must be the solution's digit; no elimination may remove the solution's digit. */
function assertSound(puzzle: KakuroPuzzle, steps: readonly KakuroStep[]) {
  for (const step of steps) {
    if (step.placed) expect(step.placed.digit, step.explanation).toBe(digitAt(puzzle, step.placed.cell));
    for (const { cell, mask } of step.eliminated) {
      expect(mask & (1 << (digitAt(puzzle, cell) - 1)), step.explanation).toBe(0);
    }
  }
}

describe('KakuroLogicalSolver', () => {
  it('solves the tiny puzzle at tier 1 with every step sound and explained', () => {
    const result = new KakuroLogicalSolver(TINY).solve({ recordSteps: true });

    expect(result.solved).toBe(true);
    expect(result.hardestTier).toBe(1);
    expect(result.techniqueCounts).toEqual({ comboRestriction: expect.any(Number), nakedSingle: 7 });
    expect(result.steps.length).toBe(result.passes);
    expect(result.steps.every((s) => s.explanation.length > 0)).toBe(true);
    assertSound(TINY, result.steps);
  });

  it('orders every technique by tier, so "first that fires" is the weakest that works', () => {
    const tiers = Object.values(TECHNIQUE_TIER);
    for (let i = 1; i < tiers.length; i++) expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]);
  });

  it('is sound on every baked puzzle, served or not', () => {
    for (const puzzle of ALL_KAKURO_FIXTURES) {
      const result = new KakuroLogicalSolver(puzzle).solve({ recordSteps: true });
      expect(result.contradiction, `${puzzle.gridSize}×${puzzle.gridSize} ${puzzle.difficulty}`).toBe(false);
      assertSound(puzzle, result.steps);
    }
  });

  it('is sound on random uniquely-solvable small grids', () => {
    let checked = 0;
    // Uniqueness is rare in random small grids (a few percent), so trials are capped high and
    // the loop stops early once enough unique ones have been checked; each trial is sub-ms.
    for (let trial = 0; trial < 1500 && checked < 30; trial++) {
      const size = 3 + Math.floor(Math.random() * 2);
      const white = Array.from({ length: size }, () => Array.from({ length: size }, () => Math.random() < 0.65));
      const runs = deriveRuns(white.map((row) => row.map((w) => (w ? 1 : 0))));
      const inRun = new Set(runs.flatMap((run) => run.cells));
      if (inRun.size === 0) continue;
      const solution = Array.from({ length: size }, () => Array<number>(size).fill(0));
      const cells = [...inRun].sort((a, b) => a - b);
      const mates = (cell: number) => runs.filter((run) => run.cells.includes(cell)).flatMap((run) => run.cells);
      const fill = (k: number): boolean => {
        if (k === cells.length) return true;
        const cell = cells[k];
        const used = new Set(mates(cell).map((m) => solution[Math.floor(m / size)][m % size]));
        for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => !used.has(x)).sort(() => Math.random() - 0.5)) {
          solution[Math.floor(cell / size)][cell % size] = d;
          if (fill(k + 1)) return true;
        }
        solution[Math.floor(cell / size)][cell % size] = 0;
        return false;
      };
      if (!fill(0)) continue;
      const puzzle: KakuroPuzzle = { variant: 'kakuro', gridSize: size, grid: [], solution, runs: deriveRuns(solution), difficulty: 'unrated' };
      if (countKakuroSolutions(puzzle).solutions !== 1) continue;
      const result = new KakuroLogicalSolver(puzzle).solve({ recordSteps: true });
      expect(result.contradiction, JSON.stringify(solution)).toBe(false);
      assertSound(puzzle, result.steps);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('separates the tiers: a harder served fixture is NOT finished by the tier below it', () => {
    expect(new KakuroLogicalSolver(easy7).solve({ maxTier: 1 }).solved).toBe(true);
    expect(new KakuroLogicalSolver(medium7).solve({ maxTier: 1 }).solved).toBe(false);
    expect(new KakuroLogicalSolver(medium7).solve({ maxTier: 2 }).solved).toBe(true);
    expect(new KakuroLogicalSolver(hard7).solve({ maxTier: 2 }).solved).toBe(false);
    expect(new KakuroLogicalSolver(hard7).solve({ maxTier: 3 }).solved).toBe(true);
  });

  it('reports a contradiction, never a guess, when the grid holds a wrong digit', () => {
    const grid = TINY.solution.map((row) => row.map(() => 0));
    grid[0][1] = 9; // the top across run is 4-in-two: {1,3}
    const result = new KakuroLogicalSolver(TINY, grid).solve();
    expect(result.contradiction).toBe(true);
    expect(result.solved).toBe(false);
  });

  it('stalls honestly on the chain fixture instead of guessing', () => {
    const result = new KakuroLogicalSolver(KAKURO_FIXTURE_7X7_CHAINS).solve({ recordSteps: true });
    expect(result.solved).toBe(false);
    expect(result.contradiction).toBe(false);
    assertSound(KAKURO_FIXTURE_7X7_CHAINS, result.steps);
  });
});

describe('classifyKakuro', () => {
  it('grades the served 7×7s easy / medium / hard and leaves the chain fixture unrated', () => {
    expect(classifyKakuro(easy7)).toMatchObject({ tier: 1, difficulty: 'easy' });
    expect(classifyKakuro(medium7)).toMatchObject({ tier: 2, difficulty: 'medium' });
    expect(classifyKakuro(hard7)).toMatchObject({ tier: 3, difficulty: 'hard' });
    expect(classifyKakuro(KAKURO_FIXTURE_7X7_CHAINS)).toMatchObject({ tier: null, difficulty: 'unrated' });
  });
});

describe('measureKakuro', () => {
  it('reports the structural metrics of the 7×7 layout', () => {
    const metrics = measureKakuro(easy7);
    expect(metrics.whiteCells).toBe(32);
    expect(metrics.maxRunLength).toBe(6);
    expect(metrics.blackDensity).toBeCloseTo(17 / 49, 5);
    expect(metrics.runLengthHistogram.reduce((a, b) => a + b, 0)).toBe(20);
    expect(metrics.avgCellRunLength).toBeGreaterThan(2);
  });

  it("tracks Mathimagics' fixed / implied / rating: 1.0 means shaving alone solves it", () => {
    expect(measureKakuro(easy7)).toMatchObject({ fixed: 32, implied: 32, rating: 1 });
    const medium = measureKakuro(medium7);
    expect(medium.fixed).toBeLessThan(32);
    expect(medium).toMatchObject({ implied: 32, rating: 1 });
    const hard = measureKakuro(hard7);
    expect(hard.implied).toBeLessThan(32);
    expect(hard.rating).toBeGreaterThan(1);
  });
});

describe('explainKakuroHint', () => {
  it('names the technique and the reason for the first placement from an empty grid', () => {
    const empty = easy7.solution.map((row) => row.map(() => 0));
    const hint = explainKakuroHint(easy7, empty);

    expect(hint).not.toBeNull();
    expect(hint!.technique).toBe('nakedSingle');
    expect(hint!.digit).toBe(digitAt(easy7, hint!.cell));
    expect(hint!.explanation).toMatch(/^Only \d fits at row \d, column \d \(/);
    expect(hint!.leadUp.length).toBeGreaterThan(0);
    expect(hint!.leadUp[0]).toMatch(/-in-\w+ (across \(row \d\)|down \(column \d\)): /);
  });

  it('prefers the selected cell when the ladder reaches it within a short detour', () => {
    const empty = easy7.solution.map((row) => row.map(() => 0));
    const first = explainKakuroHint(easy7, empty)!;
    // Find a cell the ladder places soon after the first one, and ask for it by preference.
    const solver = new KakuroLogicalSolver(easy7);
    const placedOrder: number[] = [];
    while (placedOrder.length < 3) {
      const step = solver.step();
      if (!step) break;
      if (step.placed) placedOrder.push(step.placed.cell);
    }
    const third = placedOrder[2];
    const preferred = explainKakuroHint(easy7, empty, { preferCell: third })!;

    expect(preferred.cell).toBe(third);
    expect(preferred.cell).not.toBe(first.cell);
    expect(preferred.digit).toBe(digitAt(easy7, third));
    expect(preferred.leadUp.some((line) => line.startsWith('Only'))).toBe(true); // the earlier placements are in the lead-up
  });

  it('falls back to the first placement when the preferred cell is out of reach', () => {
    const empty = easy7.solution.map((row) => row.map(() => 0));
    const first = explainKakuroHint(easy7, empty)!;
    const lastCell = easy7.runs[easy7.runs.length - 1].cells.at(-1) as number;
    const hint = explainKakuroHint(easy7, empty, { preferCell: lastCell, maxDetour: 0 })!;
    expect(hint.cell).toBe(first.cell);
  });

  it('returns null for a contradictory grid', () => {
    const grid = TINY.solution.map((row) => row.map(() => 0));
    grid[0][1] = 9;
    expect(explainKakuroHint(TINY, grid)).toBeNull();
  });
});

describe('scoreKakuroSolve', () => {
  it('orders the served 7×7s easy < medium < hard, with the density factor in [0.5, 2]', () => {
    const scores = [easy7, medium7, hard7].map((p) => scoreKakuroSolve(new KakuroLogicalSolver(p).solve()));
    expect(scores[0].final).toBeLessThan(scores[1].final);
    expect(scores[1].final).toBeLessThan(scores[2].final);
    for (const s of scores) {
      expect(s.densityFactor).toBeGreaterThanOrEqual(0.5);
      expect(s.densityFactor).toBeLessThanOrEqual(2);
      expect(s.final).toBeCloseTo(s.raw * s.densityFactor, 10);
    }
  });
});
