import { describe, expect, it } from 'vitest';
import { generateKillerSudoku } from './killer-sudoku';
import { KillerSolver } from './killer-solver';
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

describe('generateKillerSudoku', () => {
  it('emits a uniquely-solvable puzzle whose only solution is the source grid', () => {
    const puzzle = generateKillerSudoku('medium', { solution: SOL9, rng: mulberry32(1) });

    expect(puzzle.variant).toBe('killer');
    expect(puzzle.gridSize).toBe(9);
    expect(puzzle.solution).toEqual(SOL9);

    // Killer has no givens — the grid is empty; the cages carry all the information.
    expect(puzzle.grid.flat().every((v) => v === 0)).toBe(true);

    // Cages are a valid partition of the solution…
    expect(validateKillerCages(puzzle.cages, SOL9)).toEqual([]);

    // …and the layout is genuinely unique, with that unique solution being SOL9.
    const solver = new KillerSolver(puzzle.cages, 9);
    expect(solver.countSolutions(2)).toBe(1);
    expect(new KillerSolver(puzzle.cages, 9).solve()).toEqual(SOL9);
  });

  it('produces unique puzzles across difficulties', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const puzzle = generateKillerSudoku(difficulty, { solution: SOL9, rng: mulberry32(7) });
      expect(puzzle.difficulty).toBe(difficulty);
      expect(new KillerSolver(puzzle.cages, 9).countSolutions(2)).toBe(1);
    }
  });

  it('easier difficulties use smaller cages', () => {
    const easy = generateKillerSudoku('easy', { solution: SOL9, rng: mulberry32(3) });
    const maxEasyCage = Math.max(...easy.cages.map((c) => c.cells.length));
    expect(maxEasyCage).toBeLessThanOrEqual(3);
  });

  it('throws if it cannot find a unique layout within the attempt budget', () => {
    expect(() => generateKillerSudoku('medium', { solution: SOL9, maxAttempts: 0 })).toThrow();
  });

  it('works end-to-end with a real random solved grid (no injected solution)', () => {
    const puzzle = generateKillerSudoku('medium');
    expect(validateKillerCages(puzzle.cages, puzzle.solution)).toEqual([]);
    expect(new KillerSolver(puzzle.cages, 9).countSolutions(2)).toBe(1);
    // The unique solution the solver finds must equal the puzzle's stated solution.
    expect(new KillerSolver(puzzle.cages, 9).solve()).toEqual(puzzle.solution);
  });
});
