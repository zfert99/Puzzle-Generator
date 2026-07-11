import { and, asc, eq, lt, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/connection';
import { solveAttempts } from '@/lib/db/schema';
import { user } from '@/lib/db/auth-schema';

/**
 * Leaderboard reads for a single daily puzzle. Ordering is served by the
 * `(puzzle_id, time_ms)` index; only completed attempts count.
 *
 * These are public reads (the board is shared), so no ownership filter — but a caller's
 * *own* rank (`getUserRank`) is still derived from their session id by the route, never a
 * client-supplied one.
 */

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  timeMs: number;
  mistakes: number;
}

/** Top `limit` fastest completed solves for a puzzle, ascending by time. */
export async function getLeaderboard(
  db: Database,
  puzzleId: string,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      userId: solveAttempts.userId,
      name: user.name,
      timeMs: solveAttempts.timeMs,
      mistakes: solveAttempts.mistakes,
    })
    .from(solveAttempts)
    .innerJoin(user, eq(solveAttempts.userId, user.id))
    .where(and(eq(solveAttempts.puzzleId, puzzleId), eq(solveAttempts.completed, true)))
    .orderBy(asc(solveAttempts.timeMs))
    .limit(limit);

  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

export interface UserRank {
  rank: number;
  timeMs: number;
  mistakes: number;
}

/**
 * A user's rank on a puzzle, or null if they haven't completed it. Rank is `1 + (number of
 * completed attempts strictly faster)`, so ties share a rank. Computed with a COUNT rather
 * than scanning the whole board, so it stays cheap as the board grows.
 */
export async function getUserRank(
  db: Database,
  puzzleId: string,
  userId: string,
): Promise<UserRank | null> {
  const [me] = await db
    .select({ timeMs: solveAttempts.timeMs, mistakes: solveAttempts.mistakes })
    .from(solveAttempts)
    .where(
      and(
        eq(solveAttempts.userId, userId),
        eq(solveAttempts.puzzleId, puzzleId),
        eq(solveAttempts.completed, true),
      ),
    )
    .limit(1);

  if (!me) return null;

  const [{ faster }] = await db
    .select({ faster: sql<number>`count(*)`.mapWith(Number) })
    .from(solveAttempts)
    .where(
      and(
        eq(solveAttempts.puzzleId, puzzleId),
        eq(solveAttempts.completed, true),
        lt(solveAttempts.timeMs, me.timeMs),
      ),
    );

  return { rank: faster + 1, timeMs: me.timeMs, mistakes: me.mistakes };
}
