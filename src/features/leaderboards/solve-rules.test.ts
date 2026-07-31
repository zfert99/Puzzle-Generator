import { describe, expect, it } from 'vitest';
import type { Grid } from '@/lib/db/schema';
import { gridsMatch, isImplausiblyFast } from './solve-rules';
import { getProfile } from '@/lib/db/daily-row';

const solved: Grid = Array.from({ length: 9 }, (_, r) =>
  Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1),
);

describe('gridsMatch', () => {
  it('true for identical grids', () => {
    expect(gridsMatch(solved, solved.map((row) => [...row]))).toBe(true);
  });

  it('false when a single cell differs', () => {
    const off = solved.map((row) => [...row]);
    off[4][4] = off[4][4] === 9 ? 1 : off[4][4] + 1;
    expect(gridsMatch(solved, off)).toBe(false);
  });

  it('false for a mismatched shape', () => {
    expect(gridsMatch(solved, [[1, 2, 3]])).toBe(false);
  });
});

describe('isImplausiblyFast', () => {
  const classicEasy9 = getProfile('classic', 9, 'easy')!.minSolveMs;

  it('rejects times below the board floor', () => {
    expect(isImplausiblyFast('classic', 9, 'easy', classicEasy9 - 1)).toBe(true);
    expect(isImplausiblyFast('classic', 9, 'expert', 1000)).toBe(true);
  });

  it('accepts times at or above the floor', () => {
    expect(isImplausiblyFast('classic', 9, 'easy', classicEasy9)).toBe(false);
    expect(isImplausiblyFast('classic', 9, 'hard', 120_000)).toBe(false);
  });

  it('floors increase with difficulty', () => {
    expect(classicEasy9).toBeLessThan(getProfile('classic', 9, 'expert')!.minSolveMs);
  });

  /**
   * The point of moving the floor off the slot key (Step 3b): a rung key like `hard` holds a
   * different TYPE and SIZE each day, so the floor must follow the board, not the key. A time
   * that's plausible for a 4×4 mini is implausible for a 9×9 Keisan.
   */
  it('varies by variant and size for the same difficulty', () => {
    const time = 8_000;
    expect(isImplausiblyFast('classic', 4, 'hard', time)).toBe(false); // fine for a 4×4 mini
    expect(isImplausiblyFast('calc', 9, 'hard', time)).toBe(true); // way too fast for 9×9 Keisan
  });

  it('falls back to a permissive floor for a board with no profile', () => {
    // Not an eligible board (Killer 4×4 is easy-only), so no profile row exists.
    expect(isImplausiblyFast('killer', 4, 'hard', 60_000)).toBe(false);
    expect(isImplausiblyFast('killer', 4, 'hard', 10)).toBe(true);
  });
});
