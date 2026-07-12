import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireUserId } from '@/features/auth/session';
import { UnauthorizedError } from '@/features/auth/errors';
import { getTodayCompletions } from '@/features/leaderboards/attempts.service';
import { getUserRank } from '@/features/leaderboards/leaderboard.service';
import { toUtcDateString } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/me/today — which of today's dailies the caller has already completed, with
 * their time and rank. Sign-in required; scoped to the session user (BOLA).
 *
 * Powers the daily UI's "you already solved this — come back tomorrow" state, so a
 * one-attempt daily is not offered for replay.
 */
export async function GET() {
  try {
    const userId = await requireUserId();
    const isoDate = toUtcDateString(new Date());
    const completions = await getTodayCompletions(db, userId, isoDate);

    const entries = await Promise.all(
      completions.map(async (c) => {
        const rank = await getUserRank(db, c.puzzleId, userId);
        return [c.difficulty, { timeMs: c.timeMs, rank: rank?.rank ?? null }] as const;
      }),
    );

    return NextResponse.json({ completed: Object.fromEntries(entries) }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const err = error as Error;
    logger.error({ event: 'me_today_failure', error: err.message, stack: err.stack }, 'Failed to fetch today status');
    return NextResponse.json({ error: 'Internal server error while fetching today status' }, { status: 500 });
  }
}
