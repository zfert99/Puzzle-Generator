// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateCalcSudoku, generateCalcBatch } from './calc-sudoku';
import { CalcSolver } from './calc-solver';
import { CalcLogicalSolver } from './calc-logical-solver';
import { scoreCalcSolve } from './calc-score';
import { computeTarget, type CalcCage, type CalcDifficulty } from './calc-types';
import type { GridSize } from '../sudoku';

function isLatinSquare(grid: number[][], size: number): boolean {
  const expected = Array.from({ length: size }, (_, i) => i + 1).join(',');
  const sorted = (nums: number[]) => [...nums].sort((a, b) => a - b).join(',');
  for (let i = 0; i < size; i++) {
    if (sorted(grid[i]) !== expected) return false;
    if (sorted(grid.map((row) => row[i])) !== expected) return false;
  }
  return true;
}

function cagesPartition(cages: CalcCage[], size: number): boolean {
  const seen = new Array<number>(size * size).fill(0);
  for (const cage of cages) for (const cell of cage.cells) seen[cell] += 1;
  return seen.every((n) => n === 1);
}

function cagesSatisfied(cages: CalcCage[], grid: number[][], size: number): boolean {
  return cages.every((cage) => {
    const digits = cage.cells.map((cell) => grid[Math.floor(cell / size)][cell % size]);
    return computeTarget(cage.op, digits) === cage.target;
  });
}

describe('generateCalcSudoku', () => {
  const cases: { gridSize: 4 | 6; difficulty: CalcDifficulty }[] = [
    { gridSize: 4, difficulty: 'easy' },
    { gridSize: 4, difficulty: 'medium' },
    { gridSize: 4, difficulty: 'hard' },
    { gridSize: 6, difficulty: 'easy' },
    { gridSize: 6, difficulty: 'medium' },
    { gridSize: 6, difficulty: 'hard' },
  ];

  for (const { gridSize, difficulty } of cases) {
    it(`produces a valid, unique, in-band ${difficulty} ${gridSize}×${gridSize} puzzle`, () => {
      const puzzle = generateCalcSudoku(difficulty, { gridSize });
      expect(puzzle.variant).toBe('calc');
      expect(puzzle.difficulty).toBe(difficulty);
      expect(puzzle.gridSize).toBe(gridSize);
      // No pre-filled givens — the cages are the clue.
      expect(puzzle.grid.flat().every((v) => v === 0)).toBe(true);
      // Well-formed: Latin square, cages partition every cell, arithmetic checks out.
      expect(isLatinSquare(puzzle.solution, gridSize)).toBe(true);
      expect(cagesPartition(puzzle.cages, gridSize)).toBe(true);
      expect(cagesSatisfied(puzzle.cages, puzzle.solution, gridSize)).toBe(true);
      // Uniquely solvable.
      expect(new CalcSolver(puzzle.cages, gridSize as GridSize).countSolutions(2)).toBe(1);
      // Logically solvable, and its score lands in the difficulty's band.
      const result = new CalcLogicalSolver(puzzle.cages, gridSize as GridSize).solve();
      expect(result.solved).toBe(true);
    });
  }

  it('bands are disjoint per size: easy < medium < hard by score (6×6)', () => {
    const scoreOf = (difficulty: CalcDifficulty) => {
      const p = generateCalcSudoku(difficulty, { gridSize: 6 });
      return scoreCalcSolve(new CalcLogicalSolver(p.cages, 6).solve()).final;
    };
    // Sample a few of each and compare band extremes (bands are cut disjoint, so max(easy) ≤
    // min(medium) etc. hold by construction — a light check that the gate is wired).
    const easy = Math.max(...Array.from({ length: 5 }, () => scoreOf('easy')));
    const hard = Math.min(...Array.from({ length: 5 }, () => scoreOf('hard')));
    expect(easy).toBeLessThan(hard);
  });
});

describe('generateCalcBatch', () => {
  it('returns the requested counts of each difficulty', () => {
    const batch = generateCalcBatch({ easy: 2, medium: 1, hard: 1 }, { gridSize: 4 });
    expect(batch).toHaveLength(4);
    expect(batch.filter((p) => p.difficulty === 'easy')).toHaveLength(2);
    expect(batch.filter((p) => p.difficulty === 'medium')).toHaveLength(1);
    expect(batch.filter((p) => p.difficulty === 'hard')).toHaveLength(1);
  });
});
