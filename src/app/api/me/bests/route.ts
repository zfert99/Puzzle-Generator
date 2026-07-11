import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireUserId } from '@/features/auth/session';
import { UnauthorizedError } from '@/features/auth/errors';
import { getPersonalBests } from '@/features/leaderboards/attempts.service';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/me/bests — the caller's all-time best time per difficulty. Sign-in required;
 * scoped to the session user (BOLA) — no `?userId=`.
 */
export async function GET() {
  try {
    const userId = await requireUserId();
    const bests = await getPersonalBests(db, userId);
    return NextResponse.json({ bests }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const err = error as Error;
    logger.error({ event: 'bests_failure', error: err.message, stack: err.stack }, 'Failed to fetch personal bests');
    return NextResponse.json({ error: 'Internal server error while fetching personal bests' }, { status: 500 });
  }
}
