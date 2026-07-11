import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireUserId } from '@/features/auth/session';
import { UnauthorizedError } from '@/features/auth/errors';
import { getDailyPuzzle } from '@/features/dailies/dailies.service';
import { startAttempt } from '@/features/leaderboards/solve.service';
import { isDailyDifficulty, toUtcDateString } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/daily/start — records the server-side start time for today's daily so a later
 * solve can be timed by the server clock (anti-cheat, 4.4). Sign-in required (ranked play).
 *
 * Idempotent: starting again does not reset the clock. Body: `{ difficulty }`.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();

    const body = await req.json().catch(() => null);
    const difficulty = body?.difficulty;
    if (!isDailyDifficulty(difficulty)) {
      return NextResponse.json({ error: 'Invalid or missing difficulty' }, { status: 400 });
    }

    const isoDate = toUtcDateString(new Date());
    const puzzle = await getDailyPuzzle(db, isoDate, difficulty);
    if (!puzzle) {
      return NextResponse.json({ error: `No daily puzzle for ${isoDate} (${difficulty})` }, { status: 404 });
    }

    const attempt = await startAttempt(db, userId, puzzle.id);

    return NextResponse.json(
      { puzzleId: puzzle.id, startedAt: attempt.createdAt, completed: attempt.completed },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const err = error as Error;
    logger.error({ event: 'daily_start_failure', error: err.message, stack: err.stack }, 'Failed to start daily');
    return NextResponse.json({ error: 'Internal server error while starting daily' }, { status: 500 });
  }
}
