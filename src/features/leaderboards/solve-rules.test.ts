import { describe, expect, it } from 'vitest';
import type { Grid } from '@/lib/db/schema';
import { gridsMatch, isImplausiblyFast, maxPlausibleMistakes } from './solve-rules';
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

/**
 * The bound answers "could a real client have produced this count?", which only the board can
 * answer — so these cases pin it to board shapes the app actually stores, including the two that
 * a flat constant got wrong: a Killer daily (no givens at all) and a 4×4 mini (tiny).
 */
describe('maxPlausibleMistakes', () => {
  /** A `size`×`size` grid with the first `blanks` cells empty and the rest filled with givens. */
  const board = (size: number, blanks: number): Grid =>
    Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => (r * size + c < blanks ? 0 : 1)),
    );

  it('counts every empty cell against every digit that is not its answer', () => {
    expect(maxPlausibleMistakes(board(9, 40))).toBe(320); // classic 9×9, 41 givens
    expect(maxPlausibleMistakes(board(6, 30))).toBe(150); // 6×6 mini, above the floor
  });

  it('treats a Killer/Keisan board — no givens, cages are the clue — as fully open', () => {
    expect(maxPlausibleMistakes(board(9, 81))).toBe(648);
    expect(maxPlausibleMistakes(board(6, 36))).toBe(180);
  });

  /**
   * The floor exists for exactly these boards. A 4×4 admits only 30 distinct wrong placements
   * (10 blanks × 3), which a flailing beginner can pass inside one bad session by re-entering the
   * same wrong digit — and truncating a real player's count is the failure the bound is sized to
   * avoid. Every 4×4 lands on the floor. So do 6×6 *easy* and *medium* (measured at 16 and 20
   * blanks) — they escape it today only because `rollDailyAssignment` rolls a size for the
   * `mini-hard` slot alone, so every 6×6 daily is the `hard` tier. That is a property of the
   * roller, not of the size, and this pins it.
   */
  it('floors the smallest boards at 100 rather than their tight distinct count', () => {
    expect(maxPlausibleMistakes(board(4, 10))).toBe(100); // would be 30
    expect(maxPlausibleMistakes(board(4, 16))).toBe(100); // a caged 4×4 — would be 48
    expect(maxPlausibleMistakes(board(6, 16))).toBe(100); // 6×6 easy — would be 80
    expect(maxPlausibleMistakes(board(6, 20))).toBe(100); // 6×6 medium — exactly 100 anyway
  });

  it('leaves every board that clears the floor board-derived', () => {
    expect(maxPlausibleMistakes(board(6, 26))).toBe(130); // 6×6 hard — the only 6×6 daily tier
    expect(maxPlausibleMistakes(board(9, 40))).toBe(320); // 9×9 never needs the floor
  });

  it('ignores givens, which are not editable and so cannot be got wrong', () => {
    // Unreachable for a real daily, but it must degrade to the floor rather than to zero.
    expect(maxPlausibleMistakes(board(9, 0))).toBe(100);
  });

  /**
   * The number this replaces. 100 000 is not a count any board in this app can generate — the
   * largest board tops out at 648 — yet it was stored verbatim and served on the public
   * leaderboard.
   */
  it('is orders of magnitude below the flat ceiling it replaces', () => {
    expect(maxPlausibleMistakes(board(9, 81))).toBeLessThan(100_000);
  });
});
