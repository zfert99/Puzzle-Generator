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
 * POST /api/daily/start — stamps the server-side start time for today's daily and enforces the
 * one-ranked-attempt lock (4.4). Sign-in required (ranked play).
 *
 * **The stamp is recorded but not yet read at submit** (September 2026 review): `recordSolve`
 * ranks on the client's in-game timer per the documented solve-time posture
 * (`Docs/research/daily-solve-time-trust.md`), so nothing currently compares `timeMs` against
 * wall-clock-since-stamp. The stamp exists so the Phase 9 time-trust gate (checks A + B in that
 * research doc) has a server-side anchor to build on — this doc used to claim the solve "can be
 * timed by the server clock", which overstated what the code does.
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
