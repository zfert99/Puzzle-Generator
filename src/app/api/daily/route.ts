import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { getDailyPuzzle } from '@/features/dailies/dailies.service';
import { isDailyDifficulty, toUtcDateString } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

// Touches the DB (Node-only driver) and reads server time — keep off the Edge runtime.
export const runtime = 'nodejs';
// Always compute "today" fresh; never let the platform cache a day-stale response.
export const dynamic = 'force-dynamic';

// ISO YYYY-MM-DD, loosely validated to keep obviously-bad input out of the query.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/daily?difficulty=…&date=YYYY-MM-DD
 *
 * Returns a shared daily puzzle for the requested difficulty, shaped so the board can consume
 * it via `startNewGame`. `date` defaults to today (UTC); a past date serves that day's puzzle
 * for the archive (unranked replay). Future dates are rejected.
 *
 * Anti-cheat note: the response includes `solution` (the board needs it locally for mistake
 * highlighting and hints). Ranked solves are validated server-side against the stored solution
 * in `/api/solve`, so serving it here is safe; archive replays are unranked anyway.
 */
export async function GET(req: NextRequest) {
  const startTime = performance.now();
  try {
    const difficulty = req.nextUrl.searchParams.get('difficulty');
    const dateParam = req.nextUrl.searchParams.get('date');

    if (!isDailyDifficulty(difficulty)) {
      return NextResponse.json(
        { error: 'Invalid or missing difficulty: must be easy, medium, hard, expert, or extreme' },
        { status: 400 },
      );
    }

    const todayIso = toUtcDateString(new Date());
    const isoDate = dateParam ?? todayIso;
    if (!ISO_DATE.test(isoDate)) {
      return NextResponse.json({ error: 'Invalid date: expected YYYY-MM-DD' }, { status: 400 });
    }
    if (isoDate > todayIso) {
      return NextResponse.json({ error: 'Cannot fetch a future daily' }, { status: 400 });
    }

    const puzzle = await getDailyPuzzle(db, isoDate, difficulty);

    if (!puzzle) {
      // The daily-generation cron has not run for today yet (or seed was skipped).
      return NextResponse.json(
        { error: `No daily puzzle for ${isoDate} (${difficulty}) yet` },
        { status: 404 },
      );
    }

    logger.info(
      {
        event: 'daily_fetch_success',
        date: isoDate,
        difficulty,
        durationMs: Math.round(performance.now() - startTime),
      },
      'Served daily puzzle',
    );

    return NextResponse.json(
      {
        date: puzzle.date,
        difficulty: puzzle.difficulty,
        gridSize: 9,
        grid: puzzle.grid,
        solution: puzzle.solution,
        clueCount: puzzle.clueCount,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(
      {
        event: 'daily_fetch_failure',
        error: err.message,
        stack: err.stack,
        durationMs: Math.round(performance.now() - startTime),
      },
      'Failed to serve daily puzzle',
    );
    // Generic 500 only — details stay in server logs, never on the wire (AGENTS.md §6).
    return NextResponse.json({ error: 'Internal server error while fetching daily puzzle' }, { status: 500 });
  }
}
