import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireUserId } from '@/features/auth/session';
import { UnauthorizedError } from '@/features/auth/errors';
import { getDailyPuzzle } from '@/features/dailies/dailies.service';
import { recordSolve, SolveError } from '@/features/leaderboards/solve.service';
import { getUserRank } from '@/features/leaderboards/leaderboard.service';
import { isDailyDifficulty, toUtcDateString } from '@/lib/db/daily-row';
import type { Grid } from '@/lib/db/schema';
import type { GridSize } from '@/features/engine/sudoku';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_GRID_SIZES: readonly GridSize[] = [4, 6, 9];

/**
 * A valid submission grid is `size` rows × `size` cells of integers `1..size` (a completed
 * board) for one of this app's supported grid sizes — 4×4/6×6 minis or a 9×9 board. This used
 * to hardcode 9×9, which rejected every mini daily solve outright (400 "expected a completed
 * 9x9 board") before it ever reached `recordSolve`'s solution check, so mini completions never
 * made it onto the leaderboard or the dailies "completed" list.
 */
function isCompletedGrid(value: unknown): value is Grid {
  if (!Array.isArray(value) || !VALID_GRID_SIZES.includes(value.length as GridSize)) return false;
  const size = value.length;
  return value.every(
    (row) =>
      Array.isArray(row) &&
      row.length === size &&
      row.every((n) => Number.isInteger(n) && n >= 1 && n <= size),
  );
}

/**
 * POST /api/solve — submit a completed daily for ranking. Sign-in required.
 *
 * Ranking is timed by the CLIENT's in-game timer (`timeMs` in the body) so a player can pause
 * by leaving and resume without their away-time counting; the server still verifies the grid
 * against the stored solution, rejects implausibly fast times (the anti-cheat guard), and
 * allows one ranked attempt per user per puzzle. Body: `{ difficulty, grid, timeMs, mistakes? }`.
 * Returns `{ timeMs, rank }`.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();

    const body = await req.json().catch(() => null);
    const difficulty = body?.difficulty;
    const grid = body?.grid;
    const mistakes = typeof body?.mistakes === 'number' ? body.mistakes : 0;
    const clientTimeMs = typeof body?.timeMs === 'number' && Number.isFinite(body.timeMs) ? body.timeMs : null;

    if (!isDailyDifficulty(difficulty)) {
      return NextResponse.json({ error: 'Invalid or missing difficulty' }, { status: 400 });
    }
    if (!isCompletedGrid(grid)) {
      return NextResponse.json({ error: 'Invalid grid: expected a completed 4x4, 6x6, or 9x9 board' }, { status: 400 });
    }
    if (clientTimeMs === null || clientTimeMs < 0) {
      return NextResponse.json({ error: 'Invalid or missing timeMs' }, { status: 400 });
    }

    const isoDate = toUtcDateString(new Date());
    const puzzle = await getDailyPuzzle(db, isoDate, difficulty);
    if (!puzzle) {
      return NextResponse.json({ error: `No daily puzzle for ${isoDate} (${difficulty})` }, { status: 404 });
    }

    const attempt = await recordSolve(db, {
      userId,
      puzzle,
      difficulty,
      submittedGrid: grid,
      mistakes,
      clientTimeMs,
    });

    const rank = await getUserRank(db, puzzle.id, userId);

    logger.info(
      { event: 'solve_success', difficulty, timeMs: attempt.timeMs, rank: rank?.rank },
      'Recorded daily solve',
    );

    return NextResponse.json({ timeMs: attempt.timeMs, mistakes: attempt.mistakes, rank: rank?.rank ?? null }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (error instanceof SolveError) {
      // Expected rejections (wrong grid, too fast, not started, already done) — 4xx, not 500.
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const err = error as Error;
    logger.error({ event: 'solve_failure', error: err.message, stack: err.stack }, 'Failed to record solve');
    return NextResponse.json({ error: 'Internal server error while recording solve' }, { status: 500 });
  }
}
