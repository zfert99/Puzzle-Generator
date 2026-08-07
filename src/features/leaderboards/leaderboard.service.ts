import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Database } from '@/lib/db/connection';
import { solveAttempts } from '@/lib/db/schema';
import { user } from '@/lib/db/auth-schema';
import { BOT_USER_ID } from './bot-identity';

/**
 * Leaderboard reads for a single daily puzzle. Ordering is served by the
 * `(puzzle_id, time_ms)` index; only completed attempts count.
 *
 * These are public reads (the board is shared), so no ownership filter — but a caller's
 * *own* rank (`getUserRank`) is still derived from their session id by the route, never a
 * client-supplied one.
 */

/**
 * One public row of a daily board.
 *
 * **No `userId`.** This endpoint is unauthenticated, so every field here is world-readable, and
 * `solve_attempts.user_id` is the better-auth account id that sessions are keyed to. It was being
 * shipped purely so the client could derive two booleans from it — "is this row me?" and "is this
 * the bot?" — which the server can answer without handing out the identifier. Not an exploitable
 * hole on its own (no route accepts a `userId`; ownership always comes from the session), but
 * handing out internal ids to anyone who asks is the enumeration surface OWASP A01 warns about,
 * and DTOs are the standard answer.
 */
export interface LeaderboardEntry {
  rank: number;
  name: string;
  timeMs: number;
  mistakes: number;
  /** Puzzle Bot's row — the client draws the 🤖 badge from this, not from an id comparison. */
  isBot: boolean;
  /** The viewer's own row, resolved from their SESSION id — never from a request parameter. */
  isMe: boolean;
}

/**
 * Top `limit` fastest completed solves for a puzzle, ascending by time.
 *
 * `viewerId` is the caller's **session** id (or `null` when signed out) and exists only to set
 * `isMe`. It is deliberately a parameter rather than something the client sends: the route reads
 * it from the session, so a caller cannot ask "which row is <someone else>?" and get an answer.
 */
export async function getLeaderboard(
  db: Database,
  puzzleId: string,
  viewerId: string | null = null,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      userId: solveAttempts.userId,
      // Prefer the chosen public handle; fall back to the account name if unset.
      name: sql<string>`coalesce(${user.username}, ${user.name})`,
      timeMs: solveAttempts.timeMs,
      mistakes: solveAttempts.mistakes,
    })
    .from(solveAttempts)
    .innerJoin(user, eq(solveAttempts.userId, user.id))
    .where(and(eq(solveAttempts.puzzleId, puzzleId), eq(solveAttempts.completed, true)))
    .orderBy(asc(solveAttempts.timeMs))
    .limit(limit);

  // `userId` is destructured out here and never reaches the returned object — that omission is the
  // point of this function's shape, so keep it explicit rather than spreading `...r`.
  return rows.map(({ userId, name, timeMs, mistakes }, i) => ({
    rank: i + 1,
    name,
    timeMs,
    mistakes,
    isBot: userId === BOT_USER_ID,
    isMe: viewerId !== null && userId === viewerId,
  }));
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

/**
 * `getUserRank` for **many puzzles at once**, in a single query instead of two-per-puzzle. For each
 * puzzle the user has completed among `puzzleIds`, computes `rank = 1 + (completed attempts strictly
 * faster)` — the same tie semantics as `getUserRank`, via a self-join counting the faster rows. A
 * `LEFT JOIN` keeps rank-1 puzzles (zero faster attempts) in the result. Returns a map
 * `puzzleId → rank`; a puzzle the user hasn't completed is simply absent.
 *
 * Exists to kill the N+1 in `/api/me/today`, which needs the caller's rank on each of the day's
 * completed dailies — previously one `getUserRank` (two queries) per completion.
 */
export async function getUserRanksForPuzzles(
  db: Database,
  userId: string,
  puzzleIds: string[],
): Promise<Map<string, number>> {
  if (puzzleIds.length === 0) return new Map();

  // `me` = the caller's own attempt per puzzle (one, by the UNIQUE(user_id, puzzle_id) constraint);
  // `faster` = any completed attempt on the same puzzle with a strictly smaller time.
  const faster = alias(solveAttempts, 'faster');
  const rows = await db
    .select({
      puzzleId: solveAttempts.puzzleId,
      faster: sql<number>`count(${faster.id})`.mapWith(Number),
    })
    .from(solveAttempts)
    .leftJoin(
      faster,
      and(
        eq(faster.puzzleId, solveAttempts.puzzleId),
        eq(faster.completed, true),
        lt(faster.timeMs, solveAttempts.timeMs),
      ),
    )
    .where(
      and(
        eq(solveAttempts.userId, userId),
        eq(solveAttempts.completed, true),
        inArray(solveAttempts.puzzleId, puzzleIds),
      ),
    )
    .groupBy(solveAttempts.puzzleId);

  return new Map(rows.map((r) => [r.puzzleId, r.faster + 1]));
}
