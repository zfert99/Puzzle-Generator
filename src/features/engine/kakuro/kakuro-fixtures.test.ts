import { describe, expect, it } from 'vitest';
import { KAKURO_FIXTURES, KAKURO_FIXTURE_7X7, KAKURO_FIXTURE_9X9, parseKakuroFixture } from './kakuro-fixtures';
import { validateKakuroLayout, whiteMaskOf } from './kakuro-layout';
import { validateKakuroRuns } from './kakuro-types';

describe('parseKakuroFixture', () => {
  it('builds the puzzle from solved-grid text', () => {
    const puzzle = parseKakuroFixture(['#13', '124', '35#'], 'easy');

    expect(puzzle.variant).toBe('kakuro');
    expect(puzzle.gridSize).toBe(3);
    expect(puzzle.difficulty).toBe('easy');
    expect(puzzle.solution).toEqual([
      [0, 1, 3],
      [1, 2, 4],
      [3, 5, 0],
    ]);
    expect(puzzle.runs).toHaveLength(6);
    expect(puzzle.runs[1]).toEqual({ id: 1, dir: 'across', cells: [3, 4, 5], sum: 7 });
  });

  it('starts the player grid empty — Kakuro has no givens', () => {
    const puzzle = parseKakuroFixture(['#13', '124', '35#'], 'easy');

    expect(puzzle.grid.flat().every((value) => value === 0)).toBe(true);
  });

  it('refuses a character that is neither a digit 1–9 nor #', () => {
    expect(() => parseKakuroFixture(['#13', '1.4', '35#'], 'easy')).toThrow(
      'unexpected "." at row 1, column 1'
    );
    expect(() => parseKakuroFixture(['#13', '104', '35#'], 'easy')).toThrow('unexpected "0"');
  });

  it('refuses a fill that repeats a digit within a run', () => {
    expect(() => parseKakuroFixture(['#13', '124', '33#'], 'easy')).toThrow(
      'a digit repeats within the run'
    );
  });

  it('refuses an illegal layout', () => {
    expect(() => parseKakuroFixture(['#13', '124', '356'], 'easy')).toThrow(
      'layout is not 180° rotationally symmetric'
    );
  });
});

describe('baked fixtures', () => {
  it.each(KAKURO_FIXTURES.map((puzzle) => [`${puzzle.gridSize}×${puzzle.gridSize}`, puzzle] as const))(
    '%s is a legal layout whose runs match its solution',
    (_name, puzzle) => {
      expect(validateKakuroLayout(whiteMaskOf(puzzle.solution))).toEqual([]);
      expect(validateKakuroRuns(puzzle.runs, puzzle.solution)).toEqual([]);
      expect(puzzle.solution).toHaveLength(puzzle.gridSize);
    }
  );

  it('carries the sizes and shapes the docs describe', () => {
    const whites = (solution: number[][]) => solution.flat().filter((digit) => digit > 0).length;

    expect(KAKURO_FIXTURE_7X7.gridSize).toBe(7);
    expect(whites(KAKURO_FIXTURE_7X7.solution)).toBe(32);
    expect(KAKURO_FIXTURE_7X7.runs).toHaveLength(20);

    expect(KAKURO_FIXTURE_9X9.gridSize).toBe(9);
    expect(whites(KAKURO_FIXTURE_9X9.solution)).toBe(55);
    expect(KAKURO_FIXTURE_9X9.runs).toHaveLength(38);
  });
});
