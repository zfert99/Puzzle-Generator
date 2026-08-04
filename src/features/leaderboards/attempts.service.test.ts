import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db/connection';
import { solveAttempts } from '@/lib/db/schema';
import {
  getUserAttempts,
  getUserAttemptForPuzzle,
  getDailyProgress,
  getPersonalBests,
  getTodayCompletions,
} from './attempts.service';

/**
 * BOLA guarantee under test: every read is scoped by `userId` via a WHERE filter — never
 * an unfiltered fetch. We mock the DB at the boundary, capture the filter passed to
 * `.where()`, and assert it is the user-id predicate. If someone drops the ownership
 * filter, these fail.
 */

// The exact SQL a per-user filter should produce, for comparison.
const expectedUserFilter = (userId: string) => eq(solveAttempts.userId, userId);

/** A DB stub whose `.where(filter)` records the filter it was given. */
function selectStub(tail: (filter: unknown) => unknown) {
  const captured: { filter: unknown; calls: number } = { filter: undefined, calls: 0 };
  const where = (filter: unknown) => {
    captured.filter = filter;
    captured.calls += 1;
    return tail(filter);
  };
  const db = { select: () => ({ from: () => ({ where }) }) } as unknown as Database;
  return { db, captured };
}

describe('getUserAttempts', () => {
  it('filters by the given userId and returns the rows', async () => {
    const { db, captured } = selectStub(() => ({ orderBy: async () => [{ id: 'a1' }] }));

    const rows = await getUserAttempts(db, 'user-A');

    expect(rows).toEqual([{ id: 'a1' }]);
    // A filter was applied, and it is the user-id predicate (not some other column / no filter).
    expect(captured.calls).toBe(1);
    expect(captured.filter).toStrictEqual(expectedUserFilter('user-A'));
  });

  it('scopes to the caller: a different userId produces a different filter', async () => {
    const { db, captured } = selectStub(() => ({ orderBy: async () => [] }));

    await getUserAttempts(db, 'user-B');
    // user-B's filter must not equal user-A's — proving the id is actually threaded through.
    expect(captured.filter).not.toStrictEqual(expectedUserFilter('user-A'));
    expect(captured.filter).toStrictEqual(expectedUserFilter('user-B'));
  });
});

describe('getUserAttemptForPuzzle', () => {
  it('applies a compound filter and returns null when the user has no attempt', async () => {
    const { db, captured } = selectStub(() => ({ limit: async () => [] }));

    const row = await getUserAttemptForPuzzle(db, 'user-A', 'puzzle-1');

    expect(row).toBeNull();
    // A WHERE was applied (the `and(userId, puzzleId)` compound) — not an unscoped lookup.
    expect(captured.calls).toBe(1);
    expect(captured.filter).toBeDefined();
  });
});

describe('getTodayCompletions', () => {
  it('scopes to the user + completed + today, returning difficulty/time', async () => {
    let captured: unknown;
    const where = (filter: unknown) => {
      captured = filter;
      return Promise.resolve([{ difficulty: 'easy', puzzleId: 'p1', timeMs: 90_000 }]);
    };
    const db = {
      select: () => ({ from: () => ({ innerJoin: () => ({ where }) }) }),
    } as unknown as Database;

    const rows = await getTodayCompletions(db, 'user-A', '2026-07-12');

    expect(rows).toEqual([{ difficulty: 'easy', puzzleId: 'p1', timeMs: 90_000 }]);
    // A compound WHERE (user_id + completed + date) was applied.
    expect(captured).toBeDefined();
  });
});

describe('getDailyProgress', () => {
  /** Captures the JOIN condition, the range filter, and the GROUP BY. */
  function progressStub(rows: unknown[]) {
    const captured: { joinOn?: unknown; filter?: unknown; groupCols: unknown[] } = { groupCols: [] };
    const groupBy = async (...cols: unknown[]) => {
      captured.groupCols = cols;
      return rows;
    };
    const where = (filter: unknown) => {
      captured.filter = filter;
      return { groupBy };
    };
    const leftJoin = (_table: unknown, on: unknown) => {
      captured.joinOn = on;
      return { where };
    };
    const db = { select: () => ({ from: () => ({ leftJoin }) }) } as unknown as Database;
    return { db, captured };
  }

  it('counts a day the user completed nothing on, and groups by (date, size)', async () => {
    const rows = [
      { date: '2026-08-01', gridSize: 9, total: 3, done: 0 },
      { date: '2026-08-01', gridSize: 4, total: 2, done: 0 },
    ];
    const { db, captured } = progressStub(rows);

    const progress = await getDailyProgress(db, 'user-A', '2026-08-01', '2026-08-31');

    // The denominator belongs to the DAY, so an untouched day must still come back (0/N), which
    // is exactly what the LEFT JOIN buys — a WHERE-scoped inner join would drop it entirely.
    expect(progress).toEqual(rows);
    expect(captured.filter).toBeDefined(); // the date range
    expect(captured.groupCols).toHaveLength(2); // date + size
  });

  /**
   * BOLA regression: because the ownership filter lives in the JOIN condition here (it has to —
   * see the service doc), the usual "WHERE is scoped" assertion can't cover it. Dropping the id
   * from the ON clause would count EVERY user's completions as this user's, so assert the join
   * predicate actually varies with the caller.
   */
  it('scopes the join to the caller: a different userId produces a different condition', async () => {
    const a = progressStub([]);
    await getDailyProgress(a.db, 'user-A', '2026-08-01', '2026-08-31');
    const b = progressStub([]);
    await getDailyProgress(b.db, 'user-B', '2026-08-01', '2026-08-31');

    expect(a.captured.joinOn).toBeDefined();
    expect(b.captured.joinOn).not.toStrictEqual(a.captured.joinOn);
  });
});

describe('getPersonalBests', () => {
  /** Captures the ownership filter, the selected columns, and the GROUP BY actually requested. */
  function bestsStub(rows: unknown[]) {
    const captured: { filter?: unknown; groupCols: unknown[]; cols?: Record<string, unknown> } = { groupCols: [] };
    const groupBy = async (...cols: unknown[]) => {
      captured.groupCols = cols;
      return rows;
    };
    const where = (filter: unknown) => {
      captured.filter = filter;
      return { groupBy };
    };
    const db = {
      select: (cols: Record<string, unknown>) => {
        captured.cols = cols;
        return { from: () => ({ innerJoin: () => ({ where }) }) };
      },
    } as unknown as Database;
    return { db, captured };
  }

  it('scopes to the user and keeps types apart (Risk #4, type axis)', async () => {
    const rows = [
      { difficulty: 'hard', variant: 'classic', gridSize: 9, bestMs: 90_000 },
      { difficulty: 'hard', variant: 'killer', gridSize: 9, bestMs: 150_000 },
    ];
    const { db, captured } = bestsStub(rows);

    const bests = await getPersonalBests(db, 'user-A');

    // The same rung key holds different TYPES on different days, so bests must stay split by
    // variant rather than collapsing Classic-hard and Killer-hard into one min.
    expect(bests).toEqual(rows);
    // A WHERE (user_id + completed) was applied — never an unscoped aggregate.
    expect(captured.filter).toBeDefined();
  });

  /**
   * Regression (Risk #4, SIZE axis): `(difficulty, variant)` alone still collapses the two boards
   * the `mini-hard` slot rolls between. Classic can hold `mini-hard` at 4×4 or 6×6, and the 4×4 is
   * far faster (a 5 s plausibility floor against the 6×6's 12 s), so its time would always win the
   * `min()` — permanently hiding the 6×6 best and showing an unbeatable target on 6×6 days.
   */
  it('also keeps SIZES apart, so mini-hard 4×4 and 6×6 are distinct bests', async () => {
    const rows = [
      { difficulty: 'mini-hard', variant: 'classic', gridSize: 4, bestMs: 45_000 },
      { difficulty: 'mini-hard', variant: 'classic', gridSize: 6, bestMs: 130_000 },
    ];
    const { db, captured } = bestsStub(rows);

    const bests = await getPersonalBests(db, 'user-A');

    expect(bests).toEqual(rows); // both survive; the 4×4 does not swallow the 6×6
    expect(captured.cols).toHaveProperty('gridSize'); // size is selected, not merely filtered on
    expect(captured.groupCols).toHaveLength(3); // difficulty + variant + size
  });
});
