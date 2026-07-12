import { describe, expect, it } from 'vitest';
import { generateSudoku } from '@/features/engine/sudoku';
import type { Grid } from './schema';
import {
  DAILY_DIFFICULTIES,
  countClues,
  toDailyPuzzleRow,
  toUtcDateString,
} from './daily-row';

describe('countClues', () => {
  it('counts only non-zero cells', () => {
    const grid: Grid = [
      [1, 0, 3],
      [0, 0, 0],
      [4, 5, 0],
    ];
    expect(countClues(grid)).toBe(4);
  });

  it('returns 0 for an empty grid', () => {
    expect(countClues([[0, 0], [0, 0]])).toBe(0);
  });
});

describe('toUtcDateString', () => {
  it('formats a Date as YYYY-MM-DD in UTC regardless of local offset', () => {
    // 23:30 UTC — a local-time formatter in a +hours zone would roll to the next day.
    const instant = new Date('2026-07-11T23:30:00.000Z');
    expect(toUtcDateString(instant)).toBe('2026-07-11');
  });
});

describe('toDailyPuzzleRow', () => {
  it('maps an engine puzzle to an insert row with a correct clue count', () => {
    const puzzle = generateSudoku('easy');
    const row = toDailyPuzzleRow(puzzle, '2026-07-11');

    expect(row.date).toBe('2026-07-11');
    expect(row.difficulty).toBe('easy');
    expect(row.grid).toBe(puzzle.grid);
    expect(row.solution).toBe(puzzle.solution);
    expect(row.clueCount).toBe(countClues(puzzle.grid));
    // A valid 9x9 puzzle keeps a plausible clue range (never empty, never full).
    expect(row.clueCount).toBeGreaterThan(16);
    expect(row.clueCount).toBeLessThan(81);
  });

  it('never emits solved cells in the grid it exposes to clients', () => {
    // The unsolved grid must have fewer givens than the full solution.
    const puzzle = generateSudoku('medium');
    const row = toDailyPuzzleRow(puzzle, '2026-07-11');
    expect(row.clueCount).toBeLessThan(countClues(puzzle.solution));
  });

  it('includes the full difficulty range for dailies', () => {
    expect([...DAILY_DIFFICULTIES]).toEqual(['easy', 'medium', 'hard', 'expert', 'extreme']);
  });
});
