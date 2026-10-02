import { describe, expect, it } from 'vitest';
import {
  SKYSCRAPERS_FIXTURES,
  SKYSCRAPERS_FIXTURE_5X5,
  SKYSCRAPERS_FIXTURE_6X6,
  SKYSCRAPERS_FIXTURE_7X7,
  SKYSCRAPERS_NONUNIQUE_4X4,
  parseSkyscrapersFixture,
  selectSkyscrapersBatch,
} from './skyscrapers-fixtures';
import { isLatinSquare } from '../grid-utils';
import { deriveClues, presentClueCount, validateSkyscrapers } from './skyscrapers-types';

const SQUARE = ['1234', '2143', '3412', '4321'];
const ALL = { top: 'xxxx', bottom: 'xxxx', left: 'xxxx', right: 'xxxx' };

describe('parseSkyscrapersFixture', () => {
  it('builds the puzzle from solved-square text, deriving the kept clues', () => {
    const puzzle = parseSkyscrapersFixture(SQUARE, { top: 'x..x', bottom: '....', left: 'xxxx', right: '.x..' });

    expect(puzzle.variant).toBe('skyscrapers');
    expect(puzzle.gridSize).toBe(4);
    expect(puzzle.difficulty).toBe('unrated');
    expect(puzzle.solution[1]).toEqual([2, 1, 4, 3]);
    expect(puzzle.clues).toEqual({ top: [4, 0, 0, 1], bottom: [0, 0, 0, 0], left: [4, 2, 2, 1], right: [0, 2, 0, 0] });
  });

  it('starts the player grid empty — no givens (D3)', () => {
    const puzzle = parseSkyscrapersFixture(SQUARE, ALL);

    expect(puzzle.grid.flat().every((value) => value === 0)).toBe(true);
  });

  it('refuses a digit outside 1..N or a non-digit', () => {
    expect(() => parseSkyscrapersFixture(['1234', '2143', '3412', '4325'], ALL)).toThrow('unexpected "5" at row 3, column 3');
    expect(() => parseSkyscrapersFixture(['12.4', '2143', '3412', '4321'], ALL)).toThrow('unexpected "."');
  });

  it('refuses a row count that is not a supported grid size', () => {
    expect(() => parseSkyscrapersFixture(['123', '231', '312'], { top: 'xxx', bottom: 'xxx', left: 'xxx', right: 'xxx' })).toThrow(
      '3 rows is not a supported grid size'
    );
    const eight = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => ((r + c) % 8) + 1).join(''));
    const all8 = { top: 'x'.repeat(8), bottom: 'x'.repeat(8), left: 'x'.repeat(8), right: 'x'.repeat(8) };
    expect(() => parseSkyscrapersFixture(eight, all8)).toThrow('8 rows is not a supported grid size');
  });

  it('refuses a ragged row and names it', () => {
    expect(() => parseSkyscrapersFixture(['1234', '214', '3412', '4321'], ALL)).toThrow('row 1 has 3 cells, expected 4');
    expect(() => parseSkyscrapersFixture(['1234', '21433', '3412', '4321'], ALL)).toThrow('row 1 has 5 cells, expected 4');
  });

  it('refuses a square that is not Latin', () => {
    expect(() => parseSkyscrapersFixture(['1234', '2143', '3412', '4312'], ALL)).toThrow('not a Latin square');
  });

  it('refuses a mask of the wrong length or with an unknown character', () => {
    expect(() => parseSkyscrapersFixture(SQUARE, { ...ALL, top: 'xxx' })).toThrow('top mask "xxx" is not 4 characters');
    expect(() => parseSkyscrapersFixture(SQUARE, { ...ALL, left: 'xx?x' })).toThrow('unexpected "?" in left mask');
  });
});

describe('baked fixtures', () => {
  it.each(SKYSCRAPERS_FIXTURES.map((puzzle) => [`${puzzle.gridSize}×${puzzle.gridSize}`, puzzle] as const))(
    '%s is a Latin square whose kept clues match its solution',
    (_name, puzzle) => {
      expect(isLatinSquare(puzzle.solution)).toBe(true);
      expect(validateSkyscrapers(puzzle)).toEqual([]);
      expect(puzzle.solution).toHaveLength(puzzle.gridSize);
      expect(puzzle.difficulty).toBe('unrated');
    }
  );

  it('covers the three planned sizes, each with blank clues', () => {
    expect(SKYSCRAPERS_FIXTURES.map((puzzle) => puzzle.gridSize)).toEqual([5, 6, 7]);
    expect(presentClueCount(SKYSCRAPERS_FIXTURE_5X5.clues)).toBe(5);
    expect(presentClueCount(SKYSCRAPERS_FIXTURE_6X6.clues)).toBe(15);
    expect(presentClueCount(SKYSCRAPERS_FIXTURE_7X7.clues)).toBe(14);
  });
});

describe('SKYSCRAPERS_NONUNIQUE_4X4', () => {
  it('is two different Latin squares with identical full clue sets', () => {
    const [a, b] = SKYSCRAPERS_NONUNIQUE_4X4;

    expect(a.solution).not.toEqual(b.solution);
    expect(deriveClues(a.solution)).toEqual(deriveClues(b.solution));
    expect(a.clues).toEqual(b.clues);
    expect(validateSkyscrapers(a)).toEqual([]);
    expect(validateSkyscrapers(b)).toEqual([]);
  });
});

describe('selectSkyscrapersBatch (V3)', () => {
  it('returns the one fixture for the size when exactly one puzzle is asked for, whatever the level', () => {
    expect(selectSkyscrapersBatch({ easy: 1 }, { gridSize: 5 })).toEqual([SKYSCRAPERS_FIXTURE_5X5]);
    expect(selectSkyscrapersBatch({ extreme: 1 }, { gridSize: 7 })).toEqual([SKYSCRAPERS_FIXTURE_7X7]);
    expect(selectSkyscrapersBatch({ hard: 1 })).toEqual([SKYSCRAPERS_FIXTURE_6X6]);
  });

  it('refuses any other total, and a size with no fixture', () => {
    expect(() => selectSkyscrapersBatch({ easy: 1, medium: 1 }, { gridSize: 6 })).toThrow('2 requested');
    expect(() => selectSkyscrapersBatch({}, { gridSize: 6 })).toThrow('0 requested');
    expect(() => selectSkyscrapersBatch({ easy: 1 }, { gridSize: 9 })).toThrow('no fixture at 9×9');
  });
});
