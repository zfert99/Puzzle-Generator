import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db/client';
import { generateDailyPuzzles } from '@/features/dailies/dailies.service';
import { toUtcDateString } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

// Uses node:crypto + the DB driver — must run on the Node.js runtime, never the Edge.
export const runtime = 'nodejs';
// 19 boards/day; classic extreme + killer-extreme are the slow ones (~seconds each).
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * Constant-time equality that never early-returns on a length difference. Both inputs
 * are SHA-256'd first so `timingSafeEqual` always compares two fixed-length (32-byte)
 * digests — this avoids both the "throws on unequal length" footgun and leaking the
 * secret's length through timing.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * GET /api/cron/daily — Vercel Cron target (scheduled 00:00 UTC in vercel.json).
 *
 * Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET
 * env var is set; we verify it in constant time and reject anything else with 401. The
 * job generates today's daily puzzle for every eligible difficulty and is idempotent, so
 * a retry (or an accidental double-fire) inserts nothing extra.
 */
export async function GET(req: NextRequest) {
  const startTime = performance.now();

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: an unset secret means the endpoint is unguarded, so refuse to run.
    logger.error({ event: 'cron_daily_misconfigured' }, 'CRON_SECRET is not set; refusing to run');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provided = req.headers.get('authorization') ?? '';
  if (!safeEqual(provided, `Bearer ${secret}`)) {
    logger.warn({ event: 'cron_daily_unauthorized' }, 'Rejected unauthorized cron invocation');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await generateDailyPuzzles(db, toUtcDateString(new Date()));

    logger.info(
      {
        event: 'cron_daily_success',
        date: result.isoDate,
        requested: result.requested,
        inserted: result.inserted,
        durationMs: Math.round(performance.now() - startTime),
      },
      'Generated daily puzzles',
    );

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(
      {
        event: 'cron_daily_failure',
        error: err.message,
        stack: err.stack,
        durationMs: Math.round(performance.now() - startTime),
      },
      'Failed to generate daily puzzles',
    );
    return NextResponse.json({ error: 'Internal server error while generating daily puzzles' }, { status: 500 });
  }
}
