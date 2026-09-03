import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { getArchiveMonth } from '@/features/dailies/dailies.service';
import { isIsoMonth, toUtcDateString } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

// Touches the DB (Node-only driver) and reads server time — keep off the Edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/daily/days?month=YYYY-MM — which days of a month actually hold daily boards, plus the
 * archive's first date overall.
 *
 * Backs the archive calendar's **greying**. The calendar previously disabled only future days, so
 * every day before the project existed was clickable and led to a dead end — and the live range is
 * not contiguous (boards start 2026-07-11; 2026-07-24 holds none), so a lower bound alone would
 * still leave a clickable hole. `first` drives the bound, `days` handles the holes.
 *
 * Public and unauthenticated, unlike `/api/me/progress`: *whether a day exists* is not personal
 * information, and a signed-out visitor needs the same greying a signed-in one gets. The response
 * is dates only — no board contents, no per-user data.
 */
export async function GET(req: NextRequest) {
  try {
    const monthParam = req.nextUrl.searchParams.get('month');
    const month = monthParam ?? toUtcDateString(new Date()).slice(0, 7);
    if (!isIsoMonth(month)) {
      return NextResponse.json({ error: 'Invalid month: expected YYYY-MM' }, { status: 400 });
    }

    const { days, first } = await getArchiveMonth(db, month);

    return NextResponse.json({ month, first, days }, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(
      { event: 'daily_days_failure', error: err.message, stack: err.stack },
      'Failed to list archive days',
    );
    return NextResponse.json({ error: 'Internal server error while listing archive days' }, { status: 500 });
  }
}
