import { describe, expect, it } from 'vitest';
import { ALL_KAKURO_FIXTURES, KAKURO_FIXTURES, KAKURO_FIXTURE_7X7_CHAINS, KAKURO_FIXTURE_9X9_CHAINS, findKakuroFixture, parseKakuroFixture } from './kakuro-fixtures';
import { classifyKakuro } from './kakuro-logical-solver';
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
  it.each(ALL_KAKURO_FIXTURES.map((puzzle) => [`${puzzle.gridSize}×${puzzle.gridSize} ${puzzle.difficulty}`, puzzle] as const))(
    '%s is a legal layout whose runs match its solution',
    (_name, puzzle) => {
      expect(validateKakuroLayout(whiteMaskOf(puzzle.solution))).toEqual([]);
      expect(validateKakuroRuns(puzzle.runs, puzzle.solution)).toEqual([]);
      expect(puzzle.solution).toHaveLength(puzzle.gridSize);
    }
  );

  it('serves the full ladder at both sizes, on the two hand-drawn layouts', () => {
    const whites = (solution: number[][]) => solution.flat().filter((digit) => digit > 0).length;
    for (const size of [7, 9]) {
      for (const difficulty of ['easy', 'medium', 'hard', 'expert', 'extreme'] as const) {
        const puzzle = findKakuroFixture(size, difficulty);
        expect(puzzle, `${size}×${size} ${difficulty}`).toBeDefined();
        expect(whites(puzzle!.solution)).toBe(size === 7 ? 32 : 55);
        expect(puzzle!.runs).toHaveLength(size === 7 ? 20 : 38);
      }
    }
    expect(findKakuroFixture(6, 'easy')).toBeUndefined();
    expect(findKakuroFixture(7, 'unrated')).toBeUndefined();
  });

  it.each(KAKURO_FIXTURES.map((puzzle) => [`${puzzle.gridSize}×${puzzle.gridSize} ${puzzle.difficulty}`, puzzle] as const))(
    '%s carries exactly the label the classifier assigns',
    (_name, puzzle) => {
      const graded = classifyKakuro(puzzle);
      expect(graded.result.solved).toBe(true);
      expect(graded.difficulty).toBe(puzzle.difficulty);
    }
  );

  it('grades the two original chain fixtures expert: stuck at tier 3, finished by chains of length 4', () => {
    for (const puzzle of [KAKURO_FIXTURE_7X7_CHAINS, KAKURO_FIXTURE_9X9_CHAINS]) {
      const graded = classifyKakuro(puzzle);
      expect(graded.result.solved).toBe(true);
      expect(graded).toMatchObject({ tier: 4, difficulty: 'expert' });
      expect(graded.difficulty).toBe(puzzle.difficulty);
    }
  });
});
