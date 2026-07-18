import { describe, expect, it } from 'vitest';
import { generateKillerSudoku, type KillerDifficulty } from './killer-sudoku';
import { combosFor } from './cage-combinations';
import { scoreKillerSolve } from './killer-score';
import { KillerSolver } from './killer-solver';
import { KillerLogicalSolver } from './killer-logical-solver';
import { validateKillerCages } from './killer-types';

const SOL9 = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Solver-tier CEILING per difficulty — difficulty is shaped by cage structure, capped by tier. */
const SOLVE_CAP: Record<KillerDifficulty, number> = { easy: 2, medium: 3, hard: 3 };

/** Max single-cell cages (givens) per difficulty — the structural lever that separates tiers. */
const MAX_SINGLES: Record<KillerDifficulty, number> = { easy: 12, medium: 4, hard: 1 };

describe('generateKillerSudoku', () => {
  it('emits a uniquely-solvable puzzle whose only solution is the source grid', () => {
    const puzzle = generateKillerSudoku('medium', { solution: SOL9, rng: mulberry32(1) });

    expect(puzzle.variant).toBe('killer');
    expect(puzzle.gridSize).toBe(9);
    expect(puzzle.solution).toEqual(SOL9);
    expect(puzzle.grid.flat().every((v) => v === 0)).toBe(true); // no givens

    expect(validateKillerCages(puzzle.cages, SOL9)).toEqual([]);
    expect(new KillerSolver(puzzle.cages, 9).countSolutions(2)).toBe(1);
    expect(new KillerSolver(puzzle.cages, 9).solve()).toEqual(SOL9);
  });

  it.each(['easy', 'medium', 'hard'] as const)('generates a %s puzzle solvable within its tier cap', (difficulty) => {
    const puzzle = generateKillerSudoku(difficulty, { solution: SOL9, rng: mulberry32(42) });
    expect(puzzle.difficulty).toBe(difficulty);
    expect(new KillerSolver(puzzle.cages, 9).countSolutions(2)).toBe(1);
    // Solvable within the difficulty's tier ceiling — cage shape, not exact tier, drives difficulty.
    const grade = new KillerLogicalSolver(puzzle.cages, 9).solve();
    expect(grade.solved).toBe(true);
    expect(grade.hardestTier).toBeLessThanOrEqual(SOLVE_CAP[difficulty]);
  });

  it.each(['easy', 'medium', 'hard'] as const)('respects the %s single-cage (given) budget', (difficulty) => {
    const puzzle = generateKillerSudoku(difficulty, { solution: SOL9, rng: mulberry32(3) });
    const singles = puzzle.cages.filter((c) => c.cells.length === 1).length;
    expect(singles).toBeLessThanOrEqual(MAX_SINGLES[difficulty]);
  });

  it.each([
    ['easy', undefined, 42],
    ['medium', 42, 62],
    ['hard', 62, undefined],
  ] as const)('lands %s in its two-factor score band [%s, %s)', (difficulty, min, max) => {
    const puzzle = generateKillerSudoku(difficulty, { solution: SOL9, rng: mulberry32(11) });
    const { final } = scoreKillerSolve(new KillerLogicalSolver(puzzle.cages, 9).solve());
    if (min !== undefined) expect(final).toBeGreaterThanOrEqual(min);
    if (max !== undefined) expect(final).toBeLessThan(max);
  });

  it('keeps the medium/hard foothold bands apart (medium ≥ 3 anchors, hard ≤ 3)', () => {
    const footholds = (puzzle: ReturnType<typeof generateKillerSudoku>) =>
      puzzle.cages.filter((c) => c.cells.length >= 2 && combosFor(c.cells.length, c.sum).length === 1).length;
    expect(footholds(generateKillerSudoku('medium', { solution: SOL9, rng: mulberry32(7) }))).toBeGreaterThanOrEqual(3);
    expect(footholds(generateKillerSudoku('hard', { solution: SOL9, rng: mulberry32(7) }))).toBeLessThanOrEqual(3);
  });

  it('throws if it cannot grade a puzzle within the attempt budget', () => {
    expect(() => generateKillerSudoku('hard', { solution: SOL9, maxAttempts: 0 })).toThrow();
  });

  it('works end-to-end with a real random solved grid (no injected solution)', () => {
    const puzzle = generateKillerSudoku('medium');
    expect(validateKillerCages(puzzle.cages, puzzle.solution)).toEqual([]);
    expect(new KillerSolver(puzzle.cages, 9).countSolutions(2)).toBe(1);
    expect(new KillerSolver(puzzle.cages, 9).solve()).toEqual(puzzle.solution);
  });
});
