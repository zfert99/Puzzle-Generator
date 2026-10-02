import { describe, expect, it } from 'vitest';
import {
  SKYSCRAPERS_TIERS_BY_SIZE,
  generateSkyscrapers,
  generateSkyscrapersBatch,
  isSkyscrapersBudgetError,
  isSkyscrapersLevelOffered,
} from './skyscrapers';
import { classifySkyscrapers } from './skyscrapers-logical-solver';
import { isSkyscrapersUnique } from './skyscrapers-solver';
import { SKYSCRAPERS_SIZES, validateSkyscrapers } from './skyscrapers-types';

describe('SKYSCRAPERS_TIERS_BY_SIZE', () => {
  it('offers easy/medium/hard at the 5×5 mini, the full ladder at 6×6, and medium upward at 7×7 (D12)', () => {
    expect(SKYSCRAPERS_TIERS_BY_SIZE[5]).toEqual(['easy', 'medium', 'hard']);
    expect(SKYSCRAPERS_TIERS_BY_SIZE[6]).toEqual(['easy', 'medium', 'hard', 'expert', 'extreme']);
    expect(SKYSCRAPERS_TIERS_BY_SIZE[7]).toEqual(['medium', 'hard', 'expert', 'extreme']);
    expect(isSkyscrapersLevelOffered(7, 'easy')).toBe(false);
    expect(isSkyscrapersLevelOffered(5, 'expert')).toBe(false);
    expect(isSkyscrapersLevelOffered(6, 'extreme')).toBe(true);
  });
});

describe('generateSkyscrapers', () => {
  it('serves exactly the requested tier at every offered cell, unique and valid', () => {
    for (const gridSize of SKYSCRAPERS_SIZES) {
      for (const level of SKYSCRAPERS_TIERS_BY_SIZE[gridSize]) {
        const puzzle = generateSkyscrapers(level, { gridSize });
        expect(puzzle.gridSize).toBe(gridSize);
        expect(puzzle.difficulty).toBe(level);
        expect(validateSkyscrapers(puzzle)).toEqual([]);
        expect(isSkyscrapersUnique({ gridSize, clues: puzzle.clues })).toBe(true);
        // The label is re-derived from the finished puzzle, never taken from the request (D7).
        expect(classifySkyscrapers({ gridSize, clues: puzzle.clues }).difficulty).toBe(level);
      }
    }
  }, 120_000);

  it('refuses a level the size does not offer instead of serving something else', () => {
    expect(() => generateSkyscrapers('easy', { gridSize: 7 })).toThrow(/does not offer easy/);
    expect(() => generateSkyscrapers('extreme', { gridSize: 5 })).toThrow(/does not offer extreme/);
  });

  it('throws, not a wrong-tier puzzle, when the budget is spent', () => {
    expect(() => generateSkyscrapers('hard', { gridSize: 6, timeBudgetMs: 0 })).toThrow(/within 0 ms/);
  });
});

describe('generateSkyscrapersBatch', () => {
  it('returns the requested counts in ladder order, each at its level', () => {
    const puzzles = generateSkyscrapersBatch({ easy: 1, medium: 2 }, { gridSize: 5 });
    expect(puzzles.map((p) => p.difficulty)).toEqual(['easy', 'medium', 'medium']);
    for (const p of puzzles) expect(validateSkyscrapers(p)).toEqual([]);
  }, 30_000);

  it('reports its own clock running out as the budget error, and a level the size lacks as a plain error', () => {
    try {
      generateSkyscrapersBatch({ hard: 3 }, { gridSize: 6, timeBudgetMs: 0 });
      expect.unreachable('a zero budget must throw');
    } catch (error) {
      expect(isSkyscrapersBudgetError(error)).toBe(true);
      expect((error as Error).message).toMatch(/after 0 of 3/);
    }
    expect(() => generateSkyscrapersBatch({ easy: 1 }, { gridSize: 7 })).toThrow(/does not offer/);
    expect(isSkyscrapersBudgetError(new Error('x'))).toBe(false);
  });
});
