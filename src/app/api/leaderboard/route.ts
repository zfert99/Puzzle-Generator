import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { getCurrentUserId } from '@/features/auth/session';
import { getDailyPuzzle } from '@/features/dailies/dailies.service';
import { getLeaderboard, getUserRank } from '@/features/leaderboards/leaderboard.service';
import { isDailyDifficulty, toUtcDateString } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ISO YYYY-MM-DD, loosely validated to keep obviously-bad input out of the query.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
    if (!ISO_DATE.test(isoDate)) {
      return NextResponse.json({ error: 'Invalid date: expected YYYY-MM-DD' }, { status: 400 });
    }

    const puzzle = await getDailyPuzzle(db, isoDate, difficulty);
    if (!puzzle) {
      return NextResponse.json({ error: `No daily puzzle for ${isoDate} (${difficulty})` }, { status: 404 });
    }

    const entries = await getLeaderboard(db, puzzle.id);

    // Own rank only if signed in; never from a client-supplied id.
    const userId = await getCurrentUserId();
    const me = userId ? await getUserRank(db, puzzle.id, userId) : null;

    logger.info({ event: 'leaderboard_success', date: isoDate, difficulty, count: entries.length }, 'Served leaderboard');

    return NextResponse.json({ date: isoDate, difficulty, entries, me }, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ event: 'leaderboard_failure', error: err.message, stack: err.stack }, 'Failed to serve leaderboard');
    return NextResponse.json({ error: 'Internal server error while fetching leaderboard' }, { status: 500 });
  }
}
