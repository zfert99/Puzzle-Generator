// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CalcSolver } from './calc-solver';
import { computeTarget, type CalcCage } from './calc-types';
import type { GridSize } from '../sudoku';

/** A known 4×4 Latin square (rows/cols each hold 1..4 once). */
const SOLUTION_4: number[][] = [
  [1, 2, 3, 4],
  [2, 1, 4, 3],
  [3, 4, 1, 2],
  [4, 3, 2, 1],
];

const flat = (r: number, c: number, size: number) => r * size + c;

/** Is every cage's digit set consistent with its (op, target) on this grid? */
function cagesSatisfied(cages: CalcCage[], grid: number[][], size: number): boolean {
  return cages.every((cage) => {
    const digits = cage.cells.map((cell) => grid[Math.floor(cell / size)][cell % size]);
    return computeTarget(cage.op, digits) === cage.target;
  });
}

function isLatinSquare(grid: number[][], size: number): boolean {
  const expected = Array.from({ length: size }, (_, i) => i + 1).join(',');
  const sorted = (nums: number[]) => [...nums].sort((a, b) => a - b).join(',');
  for (let i = 0; i < size; i++) {
    if (sorted(grid[i]) !== expected) return false;
    if (sorted(grid.map((row) => row[i])) !== expected) return false;
  }
  return true;
}

/** Build all-single-cell cages (every cell a given) from a solution — a fully-determined puzzle. */
function allGivens(solution: number[][], size: number): CalcCage[] {
  const cages: CalcCage[] = [];
  let id = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      cages.push({ id: id++, op: 'add', target: solution[r][c], cells: [flat(r, c, size)] });
    }
  }
  return cages;
}

describe('CalcSolver.solve', () => {
  it('solves a valid layout to a Latin square satisfying every cage', () => {
    // Cages hand-built from SOLUTION_4: two-cell dominoes + one L-shaped cage that holds a repeat.
    const cages: CalcCage[] = [
      { id: 0, op: 'add', target: 3, cells: [flat(0, 0, 4), flat(0, 1, 4)] }, // {1,2}
      { id: 1, op: 'sub', target: 1, cells: [flat(0, 2, 4), flat(0, 3, 4)] }, // {3,4}
      { id: 2, op: 'sub', target: 1, cells: [flat(1, 0, 4), flat(1, 1, 4)] }, // {2,1}
      { id: 3, op: 'div', target: 3, cells: [flat(1, 2, 4), flat(1, 3, 4)] }, // {4,3}? 4/3 no → recompute
    ];
    // Fix cage 3 to a real relationship for these digits ({4,3}): difference 1.
    cages[3] = { id: 3, op: 'sub', target: 1, cells: [flat(1, 2, 4), flat(1, 3, 4)] };
    // Remaining 8 cells as single-cell givens so the puzzle is fully pinned to SOLUTION_4.
    let id = 4;
    for (let r = 2; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        cages.push({ id: id++, op: 'add', target: SOLUTION_4[r][c], cells: [flat(r, c, 4)] });
      }
    }
    const grid = new CalcSolver(cages, 4).solve();
    expect(grid).not.toBeNull();
    expect(isLatinSquare(grid!, 4)).toBe(true);
    expect(cagesSatisfied(cages, grid!, 4)).toBe(true);
  });

  it('handles a cage that legitimately holds a repeated digit (L-shape, non-collinear)', () => {
    // An L-shaped 3-cell cage spanning two rows/cols can hold a repeat. On SOLUTION_4, cells
    // (0,0)=1,(1,0)=2,(1,1)=1 → digits {1,2,1}, a 6× product cage with two non-collinear 1s.
    const cage6x: CalcCage = {
      id: 0,
      op: 'mul',
      target: 2, // 1*2*1
      cells: [flat(0, 0, 4), flat(1, 0, 4), flat(1, 1, 4)],
    };
    const cages: CalcCage[] = [cage6x];
    let id = 1;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (cage6x.cells.includes(flat(r, c, 4))) continue;
        cages.push({ id: id++, op: 'add', target: SOLUTION_4[r][c], cells: [flat(r, c, 4)] });
      }
    }
    const grid = new CalcSolver(cages, 4).solve();
    expect(grid).not.toBeNull();
    expect(cagesSatisfied(cages, grid!, 4)).toBe(true);
    // The two 1s are indeed placed non-collinearly (different rows AND columns).
    expect(grid![0][0]).toBe(1);
    expect(grid![1][1]).toBe(1);
  });
});

describe('CalcSolver.countSolutions', () => {
  it('an all-givens puzzle has exactly one solution', () => {
    expect(new CalcSolver(allGivens(SOLUTION_4, 4), 4).countSolutions(2)).toBe(1);
  });

  it('detects ambiguity: a single cage covering the whole tiny grid is far from unique', () => {
    // One 2-cell "1−" cage on a 2-cell... use 4×4 with almost no constraint: a board that is all
    // one big cage can't be unique. Cover the grid with four 4-cell row cages (each a permutation
    // sum of 1..4 = 10) — many Latin squares satisfy that, so ≥ 2 solutions.
    const size: GridSize = 4;
    const cages: CalcCage[] = [];
    for (let r = 0; r < 4; r++) {
      cages.push({
        id: r,
        op: 'add',
        target: 10, // 1+2+3+4
        cells: [flat(r, 0, 4), flat(r, 1, 4), flat(r, 2, 4), flat(r, 3, 4)],
      });
    }
    expect(new CalcSolver(cages, size).countSolutions(2)).toBe(2);
  });

  it('returns -1 when the node budget is exhausted before finishing', () => {
    // The barely-constrained board above needs many nodes; a budget of 1 can't finish.
    const cages: CalcCage[] = [];
    for (let r = 0; r < 4; r++) {
      cages.push({ id: r, op: 'add', target: 10, cells: [flat(r, 0, 4), flat(r, 1, 4), flat(r, 2, 4), flat(r, 3, 4)] });
    }
    expect(new CalcSolver(cages, 4).countSolutions(2, 1)).toBe(-1);
  });
});
