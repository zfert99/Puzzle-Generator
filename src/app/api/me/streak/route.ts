import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireUserId } from '@/features/auth/session';
import { UnauthorizedError } from '@/features/auth/errors';
import { getCurrentStreak } from '@/features/leaderboards/streak.service';
import { toUtcDateString } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/me/streak — the caller's current daily streak (consecutive UTC days completed).
 *
 * Sign-in required; scoped to the session user (BOLA) — no `?userId=`.
 */
export async function GET() {
  try {
    const userId = await requireUserId();
    const streak = await getCurrentStreak(db, userId, toUtcDateString(new Date()));
    return NextResponse.json({ streak }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const err = error as Error;
    logger.error({ event: 'streak_failure', error: err.message, stack: err.stack }, 'Failed to compute streak');
    return NextResponse.json({ error: 'Internal server error while computing streak' }, { status: 500 });
  }
}
