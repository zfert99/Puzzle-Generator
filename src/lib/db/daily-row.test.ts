import { describe, expect, it } from 'vitest';
import { generateSudoku } from '@/features/engine/sudoku';
import { generateKillerSudoku } from '@/features/engine/killer/killer-sudoku';
import type { Grid } from './schema';
import {
  DAILY_BOARDS,
  countClues,
  formatDailyKey,
  isDailyDifficulty,
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
    const row = toDailyPuzzleRow(puzzle, '2026-07-11', 'easy');

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
    const row = toDailyPuzzleRow(puzzle, '2026-07-11', 'medium');
    expect(row.clueCount).toBeLessThan(countClues(puzzle.solution));
  });

  it('the board registry has three sections and keeps the legacy classic keys verbatim', () => {
    expect(DAILY_BOARDS.filter((b) => b.section === 'classic').map((b) => b.key))
      .toEqual(['easy', 'medium', 'hard', 'expert', 'extreme']);
    expect(DAILY_BOARDS.filter((b) => b.section === 'killer')).toHaveLength(5);
    expect(DAILY_BOARDS.filter((b) => b.section === 'minis')).toHaveLength(9);
    // Keys are unique — they are the UNIQUE(date, difficulty) idempotency handle.
    expect(new Set(DAILY_BOARDS.map((b) => b.key)).size).toBe(DAILY_BOARDS.length);
    // The legacy single-killer key stays readable (archived rows) but is not generated.
    expect(isDailyDifficulty('killer')).toBe(true);
    expect((DAILY_BOARDS.map((b) => b.key) as string[]).includes('killer')).toBe(false);
    expect(formatDailyKey('killer-expert')).toBe('killer expert');
    expect(formatDailyKey('mini6-hard')).toBe('6×6 hard');
  });

  it('maps a Killer puzzle to its board key, carrying cages and cage count', () => {
    const puzzle = generateKillerSudoku('medium');
    const row = toDailyPuzzleRow(puzzle, '2026-07-17', 'killer-medium');

    expect(row.difficulty).toBe('killer-medium'); // the board key, not the engine difficulty
    expect(row.cages).toBe(puzzle.cages);
    expect(row.clueCount).toBe(puzzle.cages.length);
    // Killer ships no givens — the grid the client sees is all zeros; cages are the clue.
    expect(row.grid.flat().every((v) => v === 0)).toBe(true);
    expect(countClues(row.solution)).toBe(81);
  });

  it('stores no cages for a classic row', () => {
    const row = toDailyPuzzleRow(generateSudoku('easy'), '2026-07-17', 'easy');
    expect(row.cages).toBeNull();
  });
});
