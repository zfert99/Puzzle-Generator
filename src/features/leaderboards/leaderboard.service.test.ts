import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db/connection';
import { getLeaderboard, getUserRanksForPuzzles } from './leaderboard.service';
import { BOT_USER_ID } from './bot-identity';

/**
 * Covers the batched rank helper (the N+1 fix for /api/me/today). We mock the DB at the boundary —
 * capturing the WHERE filter and feeding rows into the `groupBy` tail — and assert both the rank
 * arithmetic (`faster + 1`) and that the query is scoped (a WHERE is applied, i.e. not an unfiltered
 * board scan). The self-join SQL itself is validated by the integration/DB layer, not here.
 */
function batchStub(rows: { puzzleId: string; faster: number }[]) {
  const captured: { where: unknown } = { where: undefined };
  const groupBy = async () => rows;
  const where = (filter: unknown) => {
    captured.where = filter;
    return { groupBy };
  };
  const leftJoin = () => ({ where });
  const from = () => ({ leftJoin });
  const db = { select: () => ({ from }) } as unknown as Database;
  return { db, captured };
}

describe('getUserRanksForPuzzles', () => {
  it('returns an empty map without touching the DB when there are no puzzleIds', async () => {
    let queried = false;
    const db = { select: () => { queried = true; return {}; } } as unknown as Database;

    const ranks = await getUserRanksForPuzzles(db, 'user-A', []);

    expect(ranks.size).toBe(0);
    expect(queried).toBe(false); // early return — no wasted round-trip
  });

  it('maps each puzzle to (faster + 1) and applies a user-scoped WHERE', async () => {
    const { db, captured } = batchStub([
      { puzzleId: 'p1', faster: 0 }, // nobody faster → rank 1
      { puzzleId: 'p2', faster: 3 }, // three faster → rank 4
    ]);

    const ranks = await getUserRanksForPuzzles(db, 'user-A', ['p1', 'p2']);

    expect(ranks.get('p1')).toBe(1);
    expect(ranks.get('p2')).toBe(4);
    // A compound WHERE (user_id + completed + puzzle_id IN …) was applied — not an unscoped read.
    expect(captured.where).toBeDefined();
  });

  it('omits puzzles the user has not completed (absent from the grouped rows)', async () => {
    const { db } = batchStub([{ puzzleId: 'p1', faster: 1 }]);

    const ranks = await getUserRanksForPuzzles(db, 'user-A', ['p1', 'p2']);

    expect(ranks.has('p1')).toBe(true);
    expect(ranks.has('p2')).toBe(false);
  });
});

/**
 * A DB stub for the board query: `select(...).from().innerJoin().where().orderBy().limit()`.
 * Rows are returned in the order given, standing in for `ORDER BY time_ms ASC`.
 */
function boardStub(rows: { userId: string; name: string; timeMs: number; mistakes: number }[]) {
  const limit = async () => rows;
  const orderBy = () => ({ limit });
  const where = () => ({ orderBy });
  const innerJoin = () => ({ where });
  const from = () => ({ innerJoin });
  return { select: () => ({ from }) } as unknown as Database;
}

const ROWS = [
  { userId: BOT_USER_ID, name: 'Puzzle Bot', timeMs: 60_000, mistakes: 0 },
  { userId: 'user-A', name: 'ada', timeMs: 63_000, mistakes: 2 },
  { userId: 'user-B', name: 'grace', timeMs: 90_000, mistakes: 1 },
];

describe('getLeaderboard', () => {
  /**
   * The reason this function exists in its current shape. `/api/leaderboard` is public and
   * unauthenticated, so anything returned here is world-readable — and `solve_attempts.user_id` is
   * the better-auth account id that sessions are keyed to. It used to be shipped so the client
   * could derive "is this me?" and "is this the bot?"; both are now decided server-side.
   */
  it('never returns a user id', async () => {
    const entries = await getLeaderboard(boardStub(ROWS), 'puzzle-1', 'user-A');

    for (const entry of entries) {
      expect(entry).not.toHaveProperty('userId');
      expect(Object.values(entry)).not.toContain('user-A');
      expect(Object.values(entry)).not.toContain(BOT_USER_ID);
    }
  });

  it('ranks by row order and carries only display fields plus the two flags', async () => {
    const entries = await getLeaderboard(boardStub(ROWS), 'puzzle-1', 'user-A');

    expect(entries.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(Object.keys(entries[0]).sort()).toEqual(['isBot', 'isMe', 'mistakes', 'name', 'rank', 'timeMs']);
  });

  it('marks the bot row, and only the bot row', async () => {
    const entries = await getLeaderboard(boardStub(ROWS), 'puzzle-1', 'user-A');
    expect(entries.map((e) => e.isBot)).toEqual([true, false, false]);
  });

  it("marks the viewer's own row from the id the ROUTE supplies (their session)", async () => {
    const asAda = await getLeaderboard(boardStub(ROWS), 'puzzle-1', 'user-A');
    expect(asAda.map((e) => e.isMe)).toEqual([false, true, false]);

    const asGrace = await getLeaderboard(boardStub(ROWS), 'puzzle-1', 'user-B');
    expect(asGrace.map((e) => e.isMe)).toEqual([false, false, true]);
  });

  it('marks nothing as "me" for a signed-out viewer', async () => {
    const entries = await getLeaderboard(boardStub(ROWS), 'puzzle-1', null);
    expect(entries.some((e) => e.isMe)).toBe(false);
  });

  it('defaults to signed-out when no viewer is passed, rather than matching a stray value', async () => {
    const entries = await getLeaderboard(boardStub(ROWS), 'puzzle-1');
    expect(entries.some((e) => e.isMe)).toBe(false);
  });
});
