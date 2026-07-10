// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generatePuzzleBatch } from './generation.service';

describe('generatePuzzleBatch', () => {
  it('returns exactly the requested number of puzzles per difficulty', () => {
    const puzzles = generatePuzzleBatch({ easy: 2, medium: 1, hard: 1 });

    expect(puzzles).toHaveLength(4);
    const byDifficulty = puzzles.reduce<Record<string, number>>((acc, p) => {
      acc[p.difficulty] = (acc[p.difficulty] ?? 0) + 1;
      return acc;
    }, {});
    expect(byDifficulty).toEqual({ easy: 2, medium: 1, hard: 1 });
  });

  it('returns an empty array when no counts are provided', () => {
    expect(generatePuzzleBatch({})).toEqual([]);
  });

  it('honours the requested grid size', () => {
    const puzzles = generatePuzzleBatch({ easy: 1, gridSize: 4 });
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].gridSize).toBe(4);
    expect(puzzles[0].grid).toHaveLength(4);
  });
});
