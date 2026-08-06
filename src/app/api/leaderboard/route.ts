import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { getCurrentUserId } from '@/features/auth/session';
import { getDailyPuzzle } from '@/features/dailies/dailies.service';
import { getLeaderboard, getUserRank } from '@/features/leaderboards/leaderboard.service';
import { isDailyDifficulty, isIsoDate, toUtcDateString } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/leaderboard?difficulty=…&date=YYYY-MM-DD — the day's board for a difficulty.
 *
 * Public (viewable signed out): returns the top solves. If the caller is signed in, their
 * own rank is included — derived from the session id, never a query param (BOLA). `date`
 * defaults to today (UTC).
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const difficulty = params.get('difficulty');
    const dateParam = params.get('date');

    if (!isDailyDifficulty(difficulty)) {
      return NextResponse.json({ error: 'Invalid or missing difficulty' }, { status: 400 });
    }
    const isoDate = dateParam ?? toUtcDateString(new Date());
    // Existence, not just shape: `2026-02-31` matches `YYYY-MM-DD` and 500s at the driver.
    // This route has no future-date guard either, so it is the one place a `9999-99-99` also
    // reached the query — see `isIsoDate`.
    if (!isIsoDate(isoDate)) {
      return NextResponse.json({ error: 'Invalid date: expected a real YYYY-MM-DD date' }, { status: 400 });
    }

    const puzzle = await getDailyPuzzle(db, isoDate, difficulty);
    if (!puzzle) {
      return NextResponse.json({ error: `No daily puzzle for ${isoDate} (${difficulty})` }, { status: 404 });
    }

    // Resolved BEFORE the board is built: `getLeaderboard` needs it to mark the viewer's own row
    // (`isMe`), now that entries no longer carry a `userId` for the client to compare against.
    // Session-derived, never a client-supplied id — that is what keeps `isMe` unspoofable (BOLA).
    const userId = await getCurrentUserId();

    const entries = await getLeaderboard(db, puzzle.id, userId);
    const me = userId ? await getUserRank(db, puzzle.id, userId) : null;

    logger.info({ event: 'leaderboard_success', date: isoDate, difficulty, count: entries.length }, 'Served leaderboard');

    return NextResponse.json({ date: isoDate, difficulty, entries, me }, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ event: 'leaderboard_failure', error: err.message, stack: err.stack }, 'Failed to serve leaderboard');
    return NextResponse.json({ error: 'Internal server error while fetching leaderboard' }, { status: 500 });
  }
}
