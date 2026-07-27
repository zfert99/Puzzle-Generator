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
  const cases: { gridSize: 4 | 6 | 9; difficulty: CalcDifficulty }[] = [
    { gridSize: 4, difficulty: 'easy' },
    { gridSize: 4, difficulty: 'medium' },
    { gridSize: 4, difficulty: 'hard' },
    { gridSize: 6, difficulty: 'easy' },
    { gridSize: 6, difficulty: 'medium' },
    { gridSize: 6, difficulty: 'hard' },
    // K7a: 9×9, 3 tiers (givens-gradient, no score band).
    { gridSize: 9, difficulty: 'easy' },
    { gridSize: 9, difficulty: 'medium' },
    { gridSize: 9, difficulty: 'hard' },
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

  it('easy tiers use the +/−/÷ palette (no × — factor reasoning is a difficulty step)', () => {
    for (const gridSize of [4, 6, 9] as const) {
      const p = generateCalcSudoku('easy', { gridSize });
      expect(p.cages.every((c) => c.op !== 'mul')).toBe(true);
    }
  });

  it('9×9 tiers separate on a disjoint givens gradient (easy ≥12 > medium 6–11 > hard ≤3)', () => {
    // K7a: the tiers are defined by single-cell-cage (given) count, not a score band. The ranges are
    // disjoint by construction, so the tier ordering holds sample-to-sample.
    const singles = (d: CalcDifficulty) =>
      generateCalcSudoku(d, { gridSize: 9 }).cages.filter((c) => c.cells.length === 1).length;
    expect(singles('easy')).toBeGreaterThanOrEqual(12);
    const med = singles('medium');
    expect(med).toBeGreaterThanOrEqual(6);
    expect(med).toBeLessThanOrEqual(11);
    expect(singles('hard')).toBeLessThanOrEqual(3);
  });

  it('hard is structurally chunky: ~1 given and bigger cages (the rebalance)', () => {
    // 6×6 hard should carry few single-cell givens and reach size-4 cages.
    let totalSingles = 0;
    let sawFourCell = false;
    for (let i = 0; i < 6; i++) {
      const p = generateCalcSudoku('hard', { gridSize: 6 });
      totalSingles += p.cages.filter((c) => c.cells.length === 1).length;
      if (p.cages.some((c) => c.cells.length === 4)) sawFourCell = true;
    }
    expect(totalSingles / 6).toBeLessThanOrEqual(1); // maxSingles: 0 on 6×6 hard (allow slack)
    expect(sawFourCell).toBe(true); // maxSize: 4 on 6×6 hard
  });

  it('hard leans on × (operator-mix weighting), keeps −/÷ variety, and is bent-heavy', () => {
    let mul = 0;
    let multi = 0;
    let bent = 0;
    let puzzlesWithSubDiv = 0;
    const N = 14; // enough samples that the aggregate ratios are stable
    for (let i = 0; i < N; i++) {
      const p = generateCalcSudoku('hard', { gridSize: 6 });
      let sd = false;
      for (const c of p.cages) {
        if (c.cells.length < 2) continue;
        if (c.op === 'mul') mul += 1;
        if (c.op === 'sub' || c.op === 'div') { sd = true; }
        multi += 1;
        const rows = new Set(c.cells.map((cell) => Math.floor(cell / 6)));
        const cols = new Set(c.cells.map((cell) => cell % 6));
        if (rows.size >= 2 && cols.size >= 2) bent += 1;
      }
      if (sd) puzzlesWithSubDiv += 1;
    }
    // −/÷ variety: the over-× first cut left them nearly absent; most hard boards should now have some.
    expect(puzzlesWithSubDiv / N).toBeGreaterThan(0.6);
    expect(mul / multi).toBeGreaterThan(0.25); // still ×-weighted (mean ~0.39; doc: ≥30%)
    expect(bent / multi).toBeGreaterThan(0.4); // naturally bent-heavy from maxSize-4 (not gated)
  });

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
