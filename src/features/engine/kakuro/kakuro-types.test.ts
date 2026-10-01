import { describe, expect, it } from 'vitest';
import { validateKakuroRuns, type Run } from './kakuro-types';

// The smallest board that exercises every rule: 3×3, black in two opposite corners.
//   # 1 3
//   1 2 4
//   3 5 #
const SOLUTION = [
  [0, 1, 3],
  [1, 2, 4],
  [3, 5, 0],
];

function validRuns(): Run[] {
  return [
    { id: 0, dir: 'across', cells: [1, 2], sum: 4 },
    { id: 1, dir: 'across', cells: [3, 4, 5], sum: 7 },
    { id: 2, dir: 'across', cells: [6, 7], sum: 8 },
    { id: 3, dir: 'down', cells: [3, 6], sum: 4 },
    { id: 4, dir: 'down', cells: [1, 4, 7], sum: 8 },
    { id: 5, dir: 'down', cells: [2, 5], sum: 7 },
  ];
}

describe('validateKakuroRuns', () => {
  it('accepts a correct set of runs', () => {
    expect(validateKakuroRuns(validRuns(), SOLUTION)).toEqual([]);
  });

  it('reports a clue that disagrees with the solution', () => {
    const runs = validRuns();
    runs[0].sum = 5;

    expect(validateKakuroRuns(runs, SOLUTION)).toEqual(['run 0: sum 5 != solution total 4']);
  });

  it('reports a digit repeated within a run', () => {
    const repeated = [
      [0, 1, 3],
      [1, 2, 4],
      [3, 3, 0], // bottom row is now 3,3
    ];
    const runs = validRuns();
    runs[2].sum = 6;
    runs[4].sum = 6;

    expect(validateKakuroRuns(runs, repeated)).toEqual(['run 2: a digit repeats within the run']);
  });

  it('reports a white cell missing from a direction', () => {
    const runs = validRuns().filter((run) => run.id !== 5); // drop the right-hand down run

    expect(validateKakuroRuns(runs, SOLUTION)).toEqual([
      'cell 2: in 0 down runs (expected 1)',
      'cell 5: in 0 down runs (expected 1)',
    ]);
  });

  it('reports a run that reaches into a black cell', () => {
    const runs = validRuns();
    runs[0] = { id: 0, dir: 'across', cells: [0, 1, 2], sum: 4 };

    expect(validateKakuroRuns(runs, SOLUTION)).toContain('run 0: includes black cell 0');
  });

  it('reports a run that is not a gap-free line', () => {
    const runs = validRuns();
    runs[1] = { id: 1, dir: 'across', cells: [3, 5], sum: 5 }; // skips the middle cell

    expect(validateKakuroRuns(runs, SOLUTION)).toContain('run 1: cells are not a gap-free across line');
  });

  it('does not let an across run wrap from one row onto the next', () => {
    // Flat indices 2 and 3 are consecutive numbers but sit at opposite ends of different rows.
    const runs = validRuns();
    runs[0] = { id: 0, dir: 'across', cells: [2, 3], sum: 4 };

    expect(validateKakuroRuns(runs, SOLUTION)).toContain('run 0: cells are not a gap-free across line');
  });

  it('reports a run shorter than two cells', () => {
    const runs = validRuns();
    runs[0] = { id: 0, dir: 'across', cells: [1], sum: 1 };

    expect(validateKakuroRuns(runs, SOLUTION)).toContain('run 0: length 1 is outside 2..9');
  });
});
