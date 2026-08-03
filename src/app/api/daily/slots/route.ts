import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { dailyPuzzles } from '@/lib/db/schema';
import { toUtcDateString, difficultyForKey, STANDARD_RUNGS } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

// Touches the DB (Node-only driver) and reads server time — keep off the Edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Stable picker order: standard rungs in ladder order, then the mini tiers, then anything else
// (retired keys on archived dates, which have no defined position). The parentheses are load-bearing
// for readability — `??` binds looser than `+`, so the unparenthesised form grouped as
// `RUNG_ORDER.get(key) ?? (100 + …)`, which happens to be equivalent here but reads like a bug.
const RUNG_ORDER = new Map(STANDARD_RUNGS.map((r, i) => [r as string, i]));
const MINI_ORDER = new Map([['mini-easy', 0], ['mini-medium', 1], ['mini-hard', 2]]);
function sortIndex(key: string): number {
  const rung = RUNG_ORDER.get(key);
  if (rung !== undefined) return rung;
  const mini = MINI_ORDER.get(key);
  if (mini !== undefined) return 100 + mini;
  return 200; // retired/legacy keys — archive-only, order among themselves is not meaningful
}

/**
 * GET /api/daily/slots?date=YYYY-MM-DD
 *
 * Lists the daily boards for a day (default today, UTC) — the metadata the `/daily` picker and the
 * leaderboard tabs need to render exactly that day's boards with a "Difficulty · Type" label.
 * The type is rolled per day and stored in `daily_puzzles.variant`, so the client cannot derive it
 * from the key; this endpoint surfaces it. Never returns `grid`/`solution` (that's `/api/daily`).
 */
export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get('date');
    const todayIso = toUtcDateString(new Date());
    const isoDate = dateParam ?? todayIso;
    if (!ISO_DATE.test(isoDate)) {
      return NextResponse.json({ error: 'Invalid date: expected YYYY-MM-DD' }, { status: 400 });
    }
    if (isoDate > todayIso) {
      return NextResponse.json({ error: 'Cannot fetch a future daily' }, { status: 400 });
    }

    const rows = await db
      .select({ key: dailyPuzzles.difficulty, variant: dailyPuzzles.variant, grid: dailyPuzzles.grid })
      .from(dailyPuzzles)
      .where(eq(dailyPuzzles.date, isoDate));

    const slots = rows
      .map((r) => ({
        key: r.key,
        variant: r.variant,
        difficulty: difficultyForKey(r.key),
        gridSize: r.grid.length,
        // Section is derived from the GRID SIZE, not the key prefix: a board is a mini iff it is
        // smaller than 9×9. That holds for the active slot keys (standard is always 9×9, `mini-*`
        // never is) AND for retired keys on archived dates — keying off the `mini-` prefix instead
        // would file every legacy mini (`mini4-*`, `killer6-*`, `calc4-*`) under Standard and, since
        // `slotLabel` only shows the size for minis, render them with duplicate ambiguous labels
        // ("Medium · Classic" three times over).
        section: r.grid.length < 9 ? ('mini' as const) : ('standard' as const),
      }))
      .sort((a, b) => sortIndex(a.key) - sortIndex(b.key));

    return NextResponse.json({ date: isoDate, slots }, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(
      { event: 'daily_slots_failure', error: err.message, stack: err.stack },
      'Failed to list daily slots',
    );
    return NextResponse.json({ error: 'Internal server error while listing daily slots' }, { status: 500 });
  }
}
