import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { getDailyPuzzle } from '@/features/dailies/dailies.service';
import { isDailyDifficulty, toUtcDateString } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

// Touches the DB (Node-only driver) and reads server time — keep off the Edge runtime.
export const runtime = 'nodejs';
// Always compute "today" fresh; never let the platform cache a day-stale response.
export const dynamic = 'force-dynamic';

/**
 * GET /api/daily?difficulty=easy|medium|hard|expert
 *
 * Returns today's (00:00-UTC) shared daily puzzle for the requested difficulty, shaped
 * so the Phase 3 board can consume it directly via `startNewGame`.
 *
 * Anti-cheat note (4.2 scope): play is anonymous and UNRANKED here, so the response
 * includes `solution` — the interactive board needs it locally for mistake highlighting
 * and hints, and there is no leaderboard to protect yet. When ranked solves land in 4.4,
 * the solution must stop being served for an unranked/unsolved daily and the solve is
 * validated server-side instead (see phase4-implementation-plan.md, anti-cheat).
 */
export async function GET(req: NextRequest) {
  const startTime = performance.now();
  try {
    const difficulty = req.nextUrl.searchParams.get('difficulty');

    if (!isDailyDifficulty(difficulty)) {
      return NextResponse.json(
        { error: 'Invalid or missing difficulty: must be easy, medium, hard, or expert' },
        { status: 400 },
      );
    }

    const isoDate = toUtcDateString(new Date());
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
