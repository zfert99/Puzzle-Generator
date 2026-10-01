import { describe, expect, it } from 'vitest';
import { generateKakuro, generateKakuroBatch, KAKURO_SIZES, tierOf } from './kakuro';
import { classifyKakuro, KakuroLogicalSolver } from './kakuro-logical-solver';
import { isKakuroUnique } from './kakuro-solver';
import { KAKURO_LADDER, validateKakuroRuns } from './kakuro-types';

describe('generateKakuro (E5: the classifier in the objective)', () => {
  it.each(KAKURO_SIZES.flatMap((gridSize) => KAKURO_LADDER.map((difficulty) => [gridSize, difficulty] as const)))(
    'serves a fresh, unique %i×%i at exactly the requested tier: %s',
    (gridSize, difficulty) => {
      const puzzle = generateKakuro(difficulty, { gridSize, timeBudgetMs: 60_000 });
      expect(puzzle.gridSize).toBe(gridSize);
      expect(puzzle.difficulty).toBe(difficulty);
      // The label is the classifier's own, re-derived here rather than trusted.
      expect(classifyKakuro({ gridSize, runs: puzzle.runs }).difficulty).toBe(difficulty);
      expect(isKakuroUnique({ gridSize, runs: puzzle.runs })).toBe(true);
      expect(validateKakuroRuns(puzzle.runs, puzzle.solution)).toEqual([]);
      expect(puzzle.grid.flat().every((d) => d === 0)).toBe(true);
    },
    60_000
  );

  it('throws, rather than serving another tier, when the budget cannot be met', () => {
    // A budget of 0 is spent before any round starts — deterministic, unlike 1 ms, which let a
    // first round begin and (one time in ~10 000) hand back a fill already unique at the tier.
    expect(() => generateKakuro('extreme', { gridSize: 9, timeBudgetMs: 0 })).toThrow(/Kakuro generation failed/);
  });

  it('batches share one budget and throw cleanly when it is spent', () => {
    expect(() => generateKakuroBatch({ easy: 3 }, { gridSize: 6, timeBudgetMs: 0 })).toThrow(/ran out of time after 0 puzzles/);
    expect(generateKakuroBatch({ easy: 1, extreme: 1 }, { gridSize: 6, timeBudgetMs: 60_000 }).map((p) => p.difficulty)).toEqual(['easy', 'extreme']);
  }, 60_000);

  it('maps the ladder to the solver tiers in order', () => {
    expect(KAKURO_LADDER.map(tierOf)).toEqual([1, 2, 3, 4, 5]);
  });
});

/**
 * The CI-sized soundness fuzz over *generated* puzzles (E5): the full 500-per-size run is a
 * one-off recorded in the log; this keeps a sample of it green on every run.
 */
describe('generated Kakuro soundness (sampled)', () => {
  it('every solver step on generated 6×6 and 7×7 puzzles agrees with the solution', () => {
    for (const gridSize of [6, 7] as const) {
      for (const difficulty of KAKURO_LADDER) {
        const puzzle = generateKakuro(difficulty, { gridSize, timeBudgetMs: 60_000 });
        const solver = new KakuroLogicalSolver({ gridSize, runs: puzzle.runs });
        const result = solver.solve({ recordSteps: true });
        expect(result.solved).toBe(true);
        for (const step of result.steps) {
          if (step.placed) expect(puzzle.solution[Math.floor(step.placed.cell / gridSize)][step.placed.cell % gridSize]).toBe(step.placed.digit);
          for (const e of step.eliminated ?? []) {
            const truth = puzzle.solution[Math.floor(e.cell / gridSize)][e.cell % gridSize];
            expect(e.mask & (1 << (truth - 1))).toBe(0);
          }
        }
      }
    }
  }, 60_000);
});
