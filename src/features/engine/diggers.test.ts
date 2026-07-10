// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { countSolutions } from './diggers';
import { createEmptyGrid, fillGrid } from './grid-utils';
import { generateSudoku, getGridConfig } from './sudoku';

describe('countSolutions', () => {
  it('reports exactly one solution for a complete, valid grid', () => {
    const config = getGridConfig(9);
    const solved = createEmptyGrid(9);
    fillGrid(solved, config);
    expect(countSolutions(solved, config)).toBe(1);
  });

  it('detects multiple solutions for an under-constrained grid (capped at the limit)', () => {
    const config = getGridConfig(4);
    // A completely empty 4x4 grid has many solutions; countSolutions stops at the limit.
    expect(countSolutions(createEmptyGrid(4), config, 2)).toBe(2);
  });

  it('confirms a generated puzzle has a unique solution', () => {
    const config = getGridConfig(9);
    const puzzle = generateSudoku('easy', 9);
    expect(countSolutions(puzzle.grid, config)).toBe(1);
  });

  it('does not mutate the caller grid', () => {
    const config = getGridConfig(9);
    const puzzle = generateSudoku('easy', 9);
    const before = JSON.stringify(puzzle.grid);
    countSolutions(puzzle.grid, config);
    expect(JSON.stringify(puzzle.grid)).toBe(before);
  });
});
