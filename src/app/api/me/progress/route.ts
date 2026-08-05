import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireUserId } from '@/features/auth/session';
import { UnauthorizedError } from '@/features/auth/errors';
import { getDailyProgress } from '@/features/leaderboards/attempts.service';
import { isIsoDate, toUtcDateString } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

// DB driver + session are Node-only; never Edge. Per-request (per-user) — never cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** One day's X/N for both sets. `total` is the number of boards that day actually held. */
interface SetProgress {
  done: number;
  total: number;
}
export interface DayProgress {
  standard: SetProgress;
  mini: SetProgress;
}

/**
 * Last calendar day of `YYYY-MM`, in UTC (day 0 of the next month).
 *
 * `setUTCFullYear` rather than `Date.UTC(year, …)`: `Date.UTC` maps years 0–99 to 1900–1999, so
 * `0000-02` asked it for February **1900** — 28 days — where year 0 is a leap year with 29.
 *
 * **This runs before the route's year check, not after.** The route rejects year 0 by validating
 * this function's *output* (`isIsoDate(toIso)`), so a day count is computed for every month the
 * shape regex admits, year 0 included — it just never reaches the query. Which is exactly why the
 * check downstream cannot be dropped as redundant: these derived strings are the only thing
 * examining the year at all.
 *
 * Year 0 is the only year in 0–99 where the mapping disagrees about leapness, so correcting it is
 * defence-in-depth rather than an observable fix today. It costs two lines and stops the trap
 * re-arming if that bound ever moves.
 */
function lastDayOfMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const month0 = Number(month.slice(5, 7)) - 1;
  const endOfMonth = new Date(0);
  endOfMonth.setUTCFullYear(year, month0 + 1, 0);
  return `${month}-${String(endOfMonth.getUTCDate()).padStart(2, '0')}`;
}

/**
 * GET /api/me/progress?month=YYYY-MM — how many of each day's dailies the caller has completed,
 * for one month. Sign-in required; scoped to the session user (BOLA) — no `?userId=`.
 *
 * Backs the archive's **X/N** counts. A whole month per request rather than per-day, because the
 * calendar shows a month at a time and clicking around it would otherwise fire a fetch per day.
 *
 * **The denominator is per-date, not a constant.** Only 3 of the 5 standard rungs are drawn on a
 * given day, that count changes as puzzle types are added (3 → 5 per set), and archived dates
 * predating the restructure hold their own historical board counts (a pre-cutover day held 30).
 * So `total` is counted from the rows the day actually has — never assumed.
 *
 * A board is filed under **minis iff its grid is smaller than 9×9** — the same rule
 * `/api/daily/slots` derives `section` from. Retired mini keys (`mini4-*`, `killer6-*`,
 * `calc4-*`) carry no usable prefix, and archived dates are full of them, so size is the only
 * classifier that stays correct backwards.
 *
 * Days with no stored dailies are simply absent from `days` — the client shows no marker rather
 * than a misleading `0/0`.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();

    const monthParam = req.nextUrl.searchParams.get('month');
    const month = monthParam ?? toUtcDateString(new Date()).slice(0, 7);
    if (!ISO_MONTH.test(month)) {
      return NextResponse.json({ error: 'Invalid month: expected YYYY-MM' }, { status: 400 });
    }

    // The regex above checks the month's SHAPE; these two strings are what actually reach the
    // `date` column, so they get the existence check. `ISO_MONTH` admits `0000`, and the SQL
    // calendar has no year zero — `0000-01` used to clear validation and 500 at the driver, the
    // same failure this branch removed from the three `?date=` routes.
    const fromIso = `${month}-01`;
    const toIso = lastDayOfMonth(month);
    if (!isIsoDate(fromIso) || !isIsoDate(toIso)) {
      return NextResponse.json({ error: 'Invalid month: expected a real YYYY-MM month' }, { status: 400 });
    }

    const rows = await getDailyProgress(db, userId, fromIso, toIso);

    const days: Record<string, DayProgress> = {};
    for (const row of rows) {
      const day = (days[row.date] ??= { standard: { done: 0, total: 0 }, mini: { done: 0, total: 0 } });
      const set = row.gridSize < 9 ? day.mini : day.standard;
      set.done += row.done;
      set.total += row.total;
    }

    return NextResponse.json({ month, days }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const err = error as Error;
    logger.error(
      { event: 'me_progress_failure', error: err.message, stack: err.stack },
      'Failed to fetch daily progress',
    );
    return NextResponse.json({ error: 'Internal server error while fetching progress' }, { status: 500 });
  }
}
