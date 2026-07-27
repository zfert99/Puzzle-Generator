// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { HumanSolver } from './human-solver';
import { createEmptyGrid } from './grid-utils';

/**
 * K0 guard: HumanSolver is a box-Sudoku solver (4/6/9) only. The old constructor silently
 * assumed 3×3 boxes for any unrecognized size, which would quietly mis-solve a boxless 5×5/7×7
 * KenKen grid. It now throws instead — KenKen writes its own row/col technique functions and
 * must never route through HumanSolver. See `Docs/kenken-implementation-plan.md` K0.
 */
describe('HumanSolver size guard', () => {
  it.each([4, 6, 9])('constructs for the box-Sudoku size %i', (size) => {
    expect(() => new HumanSolver(createEmptyGrid(size))).not.toThrow();
  });

  it.each([5, 7])('throws for the boxless KenKen size %i', (size) => {
    expect(() => new HumanSolver(createEmptyGrid(size))).toThrow(/box-Sudoku sizes 4, 6, 9/);
  });
});
