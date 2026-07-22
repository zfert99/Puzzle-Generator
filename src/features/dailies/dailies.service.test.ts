import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/db/connection';
import { generateDailyPuzzles, getDailyPuzzle } from './dailies.service';
import { DAILY_BOARDS } from '@/lib/db/daily-row';
import { dailyPuzzles, solveAttempts } from '@/lib/db/schema';
import { user } from '@/lib/db/auth-schema';
import { BOT_USER_ID } from '@/features/leaderboards/bot-identity';

/**
 * The DB is mocked at the boundary (a stand-in Drizzle client), never by mocking
 * internal modules — the engine, row mapping, and service orchestration all run for
 * real. We assert the service builds the right rows and returns accurate counts.
 *
 * `generateDailyPuzzles` now does THREE inserts (bot user, daily puzzles, bot solves) plus
 * a select (today's puzzle rows, for bot-seeding) — the mock dispatches on the actual table
 * object identity Drizzle receives, so it doesn't depend on call order.
 */

interface BotAttemptRow {
  userId: string;
  puzzleId: string;
  timeMs: number;
  completed: boolean;
  mistakes: number;
}

/** A `db` stand-in covering every table `generateDailyPuzzles` touches this call. */
function makeDb(options: {
  puzzleReturning: () => Promise<{ id: string }[]>;
  selectRows: { id: string; key: string }[];
  onAttemptsValues?: (rows: BotAttemptRow[]) => void;
}) {
  const insert = vi.fn((table: unknown) => {
    if (table === user) {
      return { values: () => ({ onConflictDoNothing: async () => undefined }) };
    }
    if (table === dailyPuzzles) {
      return {
        values: () => ({
          onConflictDoNothing: () => ({ returning: async () => options.puzzleReturning() }),
        }),
      };
    }
    if (table === solveAttempts) {
      return {
        values: (rows: BotAttemptRow[]) => {
          options.onAttemptsValues?.(rows);
          return { onConflictDoNothing: async () => undefined };
        },
      };
    }
    throw new Error('unexpected table in insert()');
  });
  const select = vi.fn(() => ({ from: () => ({ where: async () => options.selectRows }) }));
  return { insert, select } as unknown as Database;
}

describe('generateDailyPuzzles', () => {
  // `rows` in the service is real puzzle generation for all 19 `DAILY_BOARDS` (killer-extreme
  // alone runs a ~5.5s real backtracking search) — the DB mock never touches that step, so
  // every call here pays the full cost regardless of what it's asserting. The two tests below
  // share ONE such call (identical mock config; they just inspect different parts of its
  // result), cutting this file's real generation work from three calls to two. That's the fix
  // for the occasional full-suite timeout: it was never nondeterministic, just CPU contention
  // from redundantly regenerating the same 19 real boards three times over under load.
  describe('happy path (fresh day, no conflicts)', () => {
    let result: Awaited<ReturnType<typeof generateDailyPuzzles>>;
    let insertMock: ReturnType<typeof vi.fn>;
    let attemptRows: BotAttemptRow[] = [];

    beforeAll(async () => {
      const db = makeDb({
        puzzleReturning: async () => DAILY_BOARDS.map((_, i) => ({ id: `id-${i}` })),
        selectRows: DAILY_BOARDS.map((b, i) => ({ id: `id-${i}`, key: b.key })),
        onAttemptsValues: (rows) => {
          attemptRows = rows;
        },
      });
      insertMock = db.insert as ReturnType<typeof vi.fn>;
      result = await generateDailyPuzzles(db, '2026-07-11');
    }, 60_000);

    it('generates one row per daily difficulty and upserts idempotently', () => {
      expect(result).toEqual({
        isoDate: '2026-07-11',
        requested: DAILY_BOARDS.length,
        inserted: DAILY_BOARDS.length,
      });

      // The daily-puzzle insert call is the second dispatched table (bot user is first);
      // find it by inspecting what was actually passed to insert().
      const puzzleCall = insertMock.mock.calls.find(([t]) => t === dailyPuzzles);
      expect(puzzleCall).toBeDefined();
    });

    it("seeds Sudoku Bot's solve on every board, at each board's tuned time", () => {
      // The bot user row was upserted.
      const userCall = insertMock.mock.calls.find(([t]) => t === user);
      expect(userCall).toBeDefined();

      // One clean, completed bot solve per board, at that board's tuned botTimeMs.
      expect(attemptRows).toHaveLength(DAILY_BOARDS.length);
      expect(attemptRows.every((r) => r.userId === BOT_USER_ID)).toBe(true);
      expect(attemptRows.every((r) => r.completed === true && r.mistakes === 0)).toBe(true);
      const timeByPuzzleId = new Map(attemptRows.map((r) => [r.puzzleId, r.timeMs]));
      DAILY_BOARDS.forEach((board, i) => {
        expect(timeByPuzzleId.get(`id-${i}`)).toBe(board.botTimeMs);
      });
    });
  });

  it('reports 0 inserted when today already exists (conflict)', async () => {
    const db = makeDb({
      puzzleReturning: async () => [], // conflict: nothing inserted
      selectRows: DAILY_BOARDS.map((b, i) => ({ id: `id-${i}`, key: b.key })),
    });

    const result = await generateDailyPuzzles(db, '2026-07-11');
    expect(result.inserted).toBe(0);
    expect(result.requested).toBe(DAILY_BOARDS.length);
  }, 60_000);
});

describe('getDailyPuzzle', () => {
  it('returns the row for a matching date + difficulty', async () => {
    const row = { id: 'p1', date: '2026-07-11', difficulty: 'medium' };
    const limit = vi.fn(async () => [row]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const db = { select: () => ({ from }) } as unknown as Database;

    const result = await getDailyPuzzle(db, '2026-07-11', 'medium');
    expect(result).toBe(row);
  });

  it('returns null when no puzzle exists for that day', async () => {
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    } as unknown as Database;

    const result = await getDailyPuzzle(db, '2026-07-11', 'expert');
    expect(result).toBeNull();
  });
});
