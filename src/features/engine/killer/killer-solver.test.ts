import { describe, expect, it } from 'vitest';
import { KillerSolver } from './killer-solver';
import { validateKillerCages, type Cage } from './killer-types';

// A valid solved 4×4 (2×2 boxes) and 9×9 grid — deterministic fixtures (no RNG in tests).
const SOL4 = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];

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

/** One 1-cell cage per cell (each pinned to its solution digit) — a forced, unique puzzle. */
function oneCellCages(solution: number[][]): Cage[] {
  const size = solution.length;
  const cages: Cage[] = [];
  let id = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      cages.push({ id: id++, sum: solution[r][c], cells: [r * size + c] });
    }
  }
  return cages;
}

describe('KillerSolver — solving & uniqueness', () => {
  it('solves an all-1-cell (fully forced) 4×4 to the pinned grid', () => {
    const cages = oneCellCages(SOL4);
    expect(new KillerSolver(cages, 4).countSolutions()).toBe(1);
    expect(new KillerSolver(cages, 4).solve()).toEqual(SOL4);
  });

  it('solves a real 2-cell cage against the classic constraints (4×4)', () => {
    // Merge (0,0)+(0,1) into one cage of 3 = {1,2}; the rest stay pinned. The cage's two
    // cells must be 1 and 2, and the classic column/box rules force which goes where.
    const cages: Cage[] = [{ id: 0, sum: SOL4[0][0] + SOL4[0][1], cells: [0, 1] }];
    let id = 1;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (r === 0 && (c === 0 || c === 1)) continue;
        cages.push({ id: id++, sum: SOL4[r][c], cells: [r * 4 + c] });
      }
    }
    expect(new KillerSolver(cages, 4).countSolutions()).toBe(1);
    expect(new KillerSolver(cages, 4).solve()).toEqual(SOL4);
  });

  it('reports ambiguity (≥2, capped) for an under-constrained layout', () => {
    // Four cages, each a full row summing to 10 — every valid 4×4 row sums to 10, so these
    // add no real constraint and the grid has many solutions. The cap returns exactly 2.
    const rowCages: Cage[] = [0, 1, 2, 3].map((r) => ({
      id: r,
      sum: 10,
      cells: [0, 1, 2, 3].map((c) => r * 4 + c),
    }));
    expect(new KillerSolver(rowCages, 4).countSolutions(2)).toBe(2);
  });

  it('solves an all-1-cell 9×9 (scale check)', () => {
    const cages = oneCellCages(SOL9);
    expect(new KillerSolver(cages, 9).countSolutions()).toBe(1);
    expect(new KillerSolver(cages, 9).solve()).toEqual(SOL9);
  });

  it('produces a valid solution over a real cage partition (9×9)', () => {
    // Horizontal-domino partition of the 9×9: (r,0)-(r,1), (r,2)-(r,3), … and a single (r,8).
    const cages: Cage[] = [];
    let id = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c += 2) {
        const cells = c + 1 < 9 ? [r * 9 + c, r * 9 + c + 1] : [r * 9 + c];
        const sum = cells.reduce((s, cell) => s + SOL9[Math.floor(cell / 9)][cell % 9], 0);
        cages.push({ id: id++, sum, cells });
      }
    }
    const solved = new KillerSolver(cages, 9).solve();
    expect(solved).not.toBeNull();
    // Whatever solution it finds must satisfy every cage invariant against itself.
    expect(validateKillerCages(cages, solved as number[][])).toEqual([]);
    // And it must be a complete grid (no zeros).
    expect((solved as number[][]).flat().every((d) => d >= 1 && d <= 9)).toBe(true);
  });

  it('correctly solves a cage spanning two boxes (the arithmetic-vs-classic scenario)', () => {
    // (0,1) is in the left box, (0,2) in the right box. Cage sum 5 = {1,4} or {2,3}
    // ARITHMETICALLY — candidateMaskFor(2,5) allows 1,2,3,4. Only the surrounding classic
    // constraints pick 2 and 3. This is the review's "intersection" case: the cage's
    // arithmetic mask under-prunes (it allows 1 and 4), but the backtracking search rules
    // those out, so the result is correct regardless. Tighter pruning is a perf optimization,
    // not a correctness fix — see killer-solver.md.
    const cages: Cage[] = [{ id: 0, sum: SOL4[0][1] + SOL4[0][2], cells: [1, 2] }];
    let id = 1;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (r === 0 && (c === 1 || c === 2)) continue;
        cages.push({ id: id++, sum: SOL4[r][c], cells: [r * 4 + c] });
      }
    }
    expect(new KillerSolver(cages, 4).countSolutions()).toBe(1);
    expect(new KillerSolver(cages, 4).solve()).toEqual(SOL4);
  });

  it('returns -1 (reject, never a false unique) when the node budget is exhausted', () => {
    // One cage per row, each summing to 45, no givens — a massively ambiguous layout whose
    // search cannot possibly finish inside a 5-node budget.
    const cages: Cage[] = Array.from({ length: 9 }, (_, r) => ({
      id: r,
      sum: 45,
      cells: Array.from({ length: 9 }, (_, c) => r * 9 + c),
    }));
    const solver = new KillerSolver(cages, 9);
    expect(solver.countSolutions(2, 5)).toBe(-1);
    // And an un-budgeted solve on a fresh instance still works (budget never leaks state).
    expect(solver.solve()).not.toBeNull();
  });

  it('reports 0 solutions for an impossible cage sum', () => {
    // A 2-cell cage summing to 3 = {1,2}, but pin a neighbor to 1 in the same row so the cage
    // cannot be completed — no solution.
    const cages: Cage[] = [
      { id: 0, sum: 3, cells: [0, 1] }, // (0,0)+(0,1) must be {1,2}
      { id: 1, sum: 1, cells: [2] }, // (0,2) = 1  → forces a 1 in row 0 outside the cage
      { id: 2, sum: 2, cells: [3] }, // (0,3) = 2  → and a 2, so the cage can't be {1,2}
    ];
    // rows 1..3 left uncaged would be an incomplete partition, but the row-0 clash alone makes
    // even the first row unsolvable — countSolutions must be 0.
    let id = 3;
    for (let r = 1; r < 4; r++) {
      for (let c = 0; c < 4; c++) cages.push({ id: id++, sum: SOL4[r][c], cells: [r * 4 + c] });
    }
    expect(new KillerSolver(cages, 4).countSolutions()).toBe(0);
  });
});
