// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { HumanSolver } from '../human-solver';
import { generateSudoku } from '../sudoku';
import { createEmptyGrid } from '../grid-utils';
import { applyAIC } from './extreme';

/** Bitmask for a set of candidate digits. */
const mask = (...digits: number[]) => digits.reduce((m, d) => m | (1 << (d - 1)), 0);

/**
 * The extreme strategies (W-Wing, ALS-XZ, AIC) are validated over generated Extreme
 * puzzles by soundness+completeness and by necessity: an Extreme puzzle must NOT be
 * solvable at the advanced tier, which proves the extreme strategies did real work.
 * This also guards the ALS-XZ performance rewrite — an unsound elimination there
 * would produce a wrong solution or an unsolvable board here.
 */
describe('Extreme strategies (over generated Extreme puzzles)', () => {
  it('solve every Extreme puzzle to its true solution at the extreme tier', () => {
    for (let i = 0; i < 3; i++) {
      const puzzle = generateSudoku('extreme', 9);
      const solver = new HumanSolver(puzzle.grid);
      const result = solver.solve({ maxTier: 'extreme' });

      expect(result.solved).toBe(true);
      expect(solver.grid).toEqual(puzzle.solution);
    }
  }, 120_000);

  it('require extreme strategies — the advanced tier alone cannot solve them', () => {
    // Generation almost always yields an extreme-requiring puzzle on the first try;
    // the generous cap makes a flake effectively impossible even if the generator
    // occasionally degrades to an expert-level board.
    let verified = false;
    for (let i = 0; i < 12 && !verified; i++) {
      const puzzle = generateSudoku('extreme', 9);
      const full = new HumanSolver(puzzle.grid).solve({ maxTier: 'extreme' });

      if (full.requiresExtreme) {
        verified = true;
        expect(full.solved).toBe(true);
        // Necessity: capping at the advanced tier must leave it unsolved.
        const advancedOnly = new HumanSolver(puzzle.grid).solve({ maxTier: 'advanced' });
        expect(advancedOnly.solved).toBe(false);
      }
    }
    expect(verified).toBe(true);
  }, 120_000);
});

describe('applyAIC soundness', () => {
  // The counterexample behind the deleted weak-start/weak-end branch: r1c1 and r1c9 are the only
  // homes for 5 and 7 in row 1, both {5,7}. The chain (r1c1,5)-(r1c1,7)=(r1c9,7)-(r1c9,5) only
  // proves the two 5s are not BOTH true — one of them is the answer, so neither may be deleted.
  // The old branch would have removed 5 from both endpoints (it was masked only by the BFS
  // `visited` set); this pins the correct outcome against any future search rewrite.
  it('never eliminates a digit from both endpoints of a weak-ended same-digit chain', () => {
    const solver = new HumanSolver(createEmptyGrid(9));
    for (const row of solver.candidates) row.fill(0);
    solver.candidates[0][0] = mask(5, 7);
    solver.candidates[0][8] = mask(5, 7);

    expect(applyAIC(solver)).toBe(false);
    expect(solver.candidates[0][0]).toBe(mask(5, 7));
    expect(solver.candidates[0][8]).toBe(mask(5, 7));
  });
});
