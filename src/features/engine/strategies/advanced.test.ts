// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { HumanSolver } from '../human-solver';
import { applyXWing } from './advanced';
import { createEmptyGrid } from '../grid-utils';
import { generateSudoku } from '../sudoku';

describe('applyXWing', () => {
  it('eliminates a candidate locked into an X-Wing rectangle', () => {
    // Craft a classic X-Wing on digit 5: rows 0 and 3 each hold 5 in exactly the
    // same two columns (1 and 5). 5 is therefore locked to those columns in those
    // rows, so it can be eliminated from columns 1 and 5 in every other row.
    const solver = new HumanSolver(createEmptyGrid(9));
    for (let c = 0; c < 9; c++) {
      if (c !== 1 && c !== 5) {
        solver.removeCandidate(0, c, 5);
        solver.removeCandidate(3, c, 5);
      }
    }

    expect(applyXWing(solver)).toBe(true);

    // Eliminated from the X-Wing columns in a non-defining row...
    expect(solver.hasCandidate(6, 1, 5)).toBe(false);
    expect(solver.hasCandidate(6, 5, 5)).toBe(false);
    // ...but untouched in a column outside the X-Wing, and in the defining corners.
    expect(solver.hasCandidate(6, 3, 5)).toBe(true);
    expect(solver.hasCandidate(0, 1, 5)).toBe(true);
  });
});

/**
 * Broader soundness+completeness of the advanced tier over generated Expert
 * puzzles: the digger guarantees each Expert puzzle is solvable at the advanced
 * tier, so any unsound elimination in X-Wing/Swordfish/Y-Wing/XYZ-Wing would
 * surface here as a wrong solution or a stuck solver.
 */
describe('Advanced tier (over generated Expert puzzles)', () => {
  it('solves every generated Expert puzzle to its true solution', () => {
    for (let i = 0; i < 5; i++) {
      const puzzle = generateSudoku('expert', 9);
      const solver = new HumanSolver(puzzle.grid);
      const result = solver.solve({ maxTier: 'advanced' });

      expect(result.solved).toBe(true);
      expect(solver.grid).toEqual(puzzle.solution);
    }
  }, 60_000);
});
