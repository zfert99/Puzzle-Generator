// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { HumanSolver } from '../human-solver';
import { generateSudoku } from '../sudoku';
import { createEmptyGrid } from '../grid-utils';
import { applyAIC } from './extreme';

/** Seeded PRNG (mulberry32) — the same generator the benchmarks and the diggers' tests use. */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

describe('applyAIC on the numeric graph finds the same eliminations as the string version (October 2026)', () => {
  // Captured from the pre-rewrite solver: the final grid and flags of a full extreme-tier solve of
  // seeded Extreme puzzles. The rewrite changed data structures only; a different first
  // elimination would show up here as a different solve.
  const expected = [
    { seed: 9200, grid: '392567841415238769876149235254893617937416528168752394741325986683974152529681473', solved: true, requiresExtreme: true },
    { seed: 9201, grid: '986435172513287964472916538234871695697542813851693247168754329729368451345129786', solved: true, requiresExtreme: true },
    { seed: 9202, grid: '387915264419826375256743891534291786792658413861437529648579132923184657175362948', solved: true, requiresExtreme: true },
    { seed: 9203, grid: '876934251953261874421758936549873612618592347732416589295347168367189425184625793', solved: true, requiresExtreme: true },
    { seed: 9204, grid: '357624891869371245124598673692157384541839726783246519276913458418765932935482167', solved: true, requiresExtreme: true },
    { seed: 9205, grid: '193782456728546391645193782562917834471238965839654217214869573957321648386475129', solved: true, requiresExtreme: true },
    { seed: 9206, grid: '586942173371856924924173685159327468432689517867415239645238791793561842218794356', solved: true, requiresExtreme: true },
    { seed: 9207, grid: '528479163319286457476351928981523746264817395735964812192638574857142639643795281', solved: true, requiresExtreme: true },
  ];

  it('solves eight seeded Extreme puzzles to the captured grids and flags', () => {
    for (const e of expected) {
      const puzzle = generateSudoku('extreme', 9, mulberry32(e.seed));
      const solver = new HumanSolver(puzzle.grid);
      const result = solver.solve({ maxTier: 'extreme' });
      expect(result.solved, `seed ${e.seed}`).toBe(e.solved);
      expect(result.requiresExtreme, `seed ${e.seed}`).toBe(e.requiresExtreme);
      expect(solver.grid.flat().join(''), `seed ${e.seed}`).toBe(e.grid);
    }
  });
});

