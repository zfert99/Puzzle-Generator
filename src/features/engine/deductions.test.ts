import { describe, it, expect } from 'vitest';
import { HumanSolver } from './human-solver';
import { generateSudoku, type Difficulty } from './sudoku';
import { listDeductions, cloneSolver, STRATEGY_NAMES, type Deduction } from './deductions';

/** Small seeded PRNG so every run enumerates the same puzzles. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Applies one deduction to the solver so the walk can advance to the next state. */
function applyDeduction(solver: HumanSolver, deduction: Deduction) {
  for (const { r, c, digit } of deduction.placements) solver.placeNumber(r, c, digit);
  for (const { r, c, digit } of deduction.eliminations) solver.removeCandidate(r, c, digit);
}

/** Every claim in every deduction must agree with the known solution. */
function expectGroundTruth(deductions: Deduction[], solution: number[][]) {
  for (const d of deductions) {
    expect(STRATEGY_NAMES).toContain(d.strategy);
    expect(d.placements.length > 0 || d.eliminations.length > 0).toBe(true);
    expect(d.placements.length > 0 && d.eliminations.length > 0).toBe(false);
    for (const { r, c, digit } of d.placements) expect(solution[r][c]).toBe(digit);
    for (const { r, c, digit } of d.eliminations) expect(solution[r][c]).not.toBe(digit);
  }
}

describe('listDeductions', () => {
  it('returns nothing for a solved grid', () => {
    const { solution } = generateSudoku('easy', 9, mulberry32(1));
    expect(listDeductions(new HumanSolver(solution))).toEqual([]);
  });

  it('does not mutate the solver it inspects', () => {
    const { grid } = generateSudoku('medium', 9, mulberry32(2));
    const solver = new HumanSolver(grid);
    const before = cloneSolver(solver);
    listDeductions(solver);
    expect(solver.grid).toEqual(before.grid);
    expect(solver.candidates).toEqual(before.candidates);
  });

  it('cloneSolver preserves candidate eliminations, not just the grid', () => {
    const { grid } = generateSudoku('easy', 9, mulberry32(3));
    const solver = new HumanSolver(grid);
    const cell = solver.getCellsWithNCandidates(2)[0];
    solver.removeCandidate(cell.r, cell.c, cell.cands[1]);
    const clone = cloneSolver(solver);
    expect(clone.candidateList(cell.r, cell.c)).toEqual([cell.cands[0]]);
  });

  const cases: [Difficulty, number][] = [['easy', 11], ['medium', 12], ['hard', 13], ['expert', 14]];

  it.each(cases)('every %s deduction agrees with the solution at every step of a walk', (difficulty, seed) => {
    const { grid, solution } = generateSudoku(difficulty, 9, mulberry32(seed));
    const solver = new HumanSolver(grid);
    let steps = 0;

    while (!solver.isSolved()) {
      const deductions = listDeductions(solver);
      expectGroundTruth(deductions, solution);
      if (deductions.length === 0) break;
      applyDeduction(solver, deductions[0]);
      steps++;
    }

    expect(steps).toBeGreaterThan(0);
    expect(solver.isSolved()).toBe(true);
  });

  it('reports elimination techniques on a puzzle that needs them', () => {
    const { grid, solution } = generateSudoku('expert', 9, mulberry32(21));
    const solver = new HumanSolver(grid);
    const strategiesSeen = new Set<string>();

    while (!solver.isSolved()) {
      const deductions = listDeductions(solver);
      expectGroundTruth(deductions, solution);
      if (deductions.length === 0) break;
      const hardest = deductions[deductions.length - 1];
      strategiesSeen.add(hardest.strategy);
      applyDeduction(solver, hardest);
    }

    const eliminationOnly = [...strategiesSeen].filter(s => !s.endsWith('Single'));
    expect(eliminationOnly.length).toBeGreaterThan(0);
  });

  it('works on 6×6 grids and skips 9×9-only techniques', () => {
    const { grid, solution } = generateSudoku('easy', 6, mulberry32(5));
    const deductions = listDeductions(new HumanSolver(grid));
    expectGroundTruth(deductions, solution);
    for (const d of deductions) expect(d.tier).toBe('basic');
  });
});
