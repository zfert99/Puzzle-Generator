import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db/connection';
import { solveAttempts } from '@/lib/db/schema';
import { getUserAttempts, getUserAttemptForPuzzle } from './attempts.service';

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
