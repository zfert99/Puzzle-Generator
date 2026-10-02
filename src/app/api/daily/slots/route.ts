import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { getDailySlotRows, PAST_DAY_CACHE_CONTROL } from '@/features/dailies/dailies.service';
import { toUtcDateString, difficultyForKey, isIsoDate, sectionForKey, STANDARD_RUNGS } from '@/lib/db/daily-row';
import { logger } from '@/lib/logger';

// Touches the DB (Node-only driver) and reads server time — keep off the Edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    // Existence, not just shape — a well-formed non-date (`2026-02-31`) used to reach the query
    // and 500 at the driver. See `isIsoDate`.
    if (!isIsoDate(isoDate)) {
      return NextResponse.json({ error: 'Invalid date: expected a real YYYY-MM-DD date' }, { status: 400 });
    }
    if (isoDate > todayIso) {
      return NextResponse.json({ error: 'Cannot fetch a future daily' }, { status: 400 });
    }

    const rows = await getDailySlotRows(db, isoDate);

    const slots = rows
      .map((r) => ({
        key: r.key,
        variant: r.variant,
        difficulty: difficultyForKey(r.key),
        gridSize: r.gridSize,
        // Section from the KEY for active boards, the grid size only for retired keys
        // (`sectionForKey`): a bare rung is standard even at 6×6 — Skyscrapers' standard is the 6×6
        // (D5) — while the retired minis (`mini4-*`, `killer6-*`, `calc4-*`) carry no `mini-` prefix
        // and are told apart by size, as before. Filing a legacy mini under Standard would render
        // duplicate ambiguous labels ("Medium · Classic" three times over).
        section: sectionForKey(r.key, r.gridSize),
      }))
      .sort((a, b) => sortIndex(a.key) - sortIndex(b.key));

    // A finished day's board list never changes, so it may sit in the CDN. Not when it is EMPTY: a
    // past day with no rows is a cron miss awaiting a backfill, and caching it would hide the fix.
    const cacheable = isoDate < todayIso && slots.length > 0;
    return NextResponse.json(
      { date: isoDate, slots },
      { status: 200, headers: cacheable ? { 'Cache-Control': PAST_DAY_CACHE_CONTROL } : undefined },
    );
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(
      { event: 'daily_slots_failure', error: err.message, stack: err.stack },
      'Failed to list daily slots',
    );
    return NextResponse.json({ error: 'Internal server error while listing daily slots' }, { status: 500 });
  }
}
