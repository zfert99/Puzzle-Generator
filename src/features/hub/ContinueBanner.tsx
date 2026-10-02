'use client';

import Link from 'next/link';
import { useSavedGame, formatElapsed } from '@/features/interactive-board/store/useSavedGame';
import { difficultyForKey, formatDailyKey, isDailyVariant, sectionForKey, toUtcDateString } from '@/lib/db/daily-row';
import { slotLabel } from '@/features/dailies/slot-display';

/**
 * Front-door "continue" affordance. Reads the single saved game from the board store and, if
 * one exists, links to the surface that owns it (`/daily` or `/play`), where the Continue
 * button resumes it. Renders nothing when there's no game to continue (also the SSR default,
 * since `useSavedGame` returns null until mounted — so no hydration flash).
 */
export function ContinueBanner() {
  const saved = useSavedGame();
  if (!saved) return null;

  // `?resume=1` tells the surface to jump straight into the parked game, not its menu.
  const href = saved.mode === 'daily' ? '/daily?resume=1' : '/play?resume=1';

  /**
   * `mode: 'daily'` means "a daily-shaped board", not "today's ranked daily". An archive replay
   * (`ArchiveExperience` starts boards as `startNewGame(puzzle, 'daily', thatDate)`) and a daily
   * left running past 00:00 UTC both carry an older `dailyDate`, and this banner used to call
   * both of them "Daily" — telling a player their parked *practice* board was the ranked daily
   * they still had to play. The date is the only thing that separates them.
   */
  const isAnotherDaysDaily = Boolean(saved.dailyDate && saved.dailyDate !== toUtcDateString(new Date()));
  // "Hard 6×6 · Kakuro" — the same difficulty · size · type composition the daily picker uses,
  // from the saved board's own variant and size. With four types a bare "6×6 · hard" could be any
  // of them (a review finding on R1); the key-only form stays as the fallback for an
  // unregistered variant, visible rather than invented.
  const board = isDailyVariant(saved.variant)
    ? slotLabel({
        key: saved.difficulty,
        variant: saved.variant,
        difficulty: difficultyForKey(saved.difficulty),
        gridSize: saved.gridSize,
        section: sectionForKey(saved.difficulty, saved.gridSize),
      })
    : formatDailyKey(saved.difficulty);
  const what = saved.mode === 'daily' ? (isAnotherDaysDaily ? `Practice · ${board}` : `Daily · ${board}`) : board;

  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border-[3px] border-ink bg-butterscotch px-5 py-3 text-ink shadow-chunky pressable mb-4"
    >
      <span className="font-semibold">▶ Continue your puzzle</span>
      <span className="text-sm capitalize">
        {what} · {formatElapsed(saved.elapsedTime)}
      </span>
    </Link>
  );
}
