import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireUserId } from '@/features/auth/session';
import { UnauthorizedError } from '@/features/auth/errors';
import { getUserAttempts } from '@/features/leaderboards/attempts.service';
import { logger } from '@/lib/logger';

// DB driver + session are Node-only; never Edge. Per-request (per-user) — never cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/me/attempts — the caller's own solve attempts.
 *
 * The BOLA reference implementation (AGENTS.md §6, 4.3.1): identity comes from
 * `requireUserId()` (the session), NOT from any request parameter, and the query filters
 * by that id at the data layer. There is no `?userId=` — a caller cannot request another
 * user's data because the id is never taken from the request.
 */
export async function GET() {
  const startTime = performance.now();
  try {
    const userId = await requireUserId();
    const attempts = await getUserAttempts(db, userId);

    logger.info(
      { event: 'my_attempts_success', count: attempts.length, durationMs: Math.round(performance.now() - startTime) },
      'Served user attempts',
    );

    return NextResponse.json({ attempts }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const err = error as Error;
    logger.error(
      { event: 'my_attempts_failure', error: err.message, stack: err.stack },
      'Failed to serve user attempts',
    );
    return NextResponse.json({ error: 'Internal server error while fetching attempts' }, { status: 500 });
  }
}
