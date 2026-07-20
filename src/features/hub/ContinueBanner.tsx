'use client';

import Link from 'next/link';
import { useSavedGame, formatElapsed } from '@/features/interactive-board/store/useSavedGame';
import { formatDailyKey } from '@/lib/db/daily-row';

/**
 * Front-door "continue" affordance. Reads the single saved game from the board store and, if
 * one exists, links to the surface that owns it (`/daily` or `/play`), where the Continue
 * button resumes it. Renders nothing when there's no game to continue (also the SSR default,
 * since `useSavedGame` returns null until mounted — so no hydration flash).
 */
export function ContinueBanner() {
  const saved = useSavedGame();
  if (!saved) return null;

  const href = saved.mode === 'daily' ? '/daily' : '/play';
  const what =
    saved.mode === 'daily'
      ? `Daily · ${formatDailyKey(saved.difficulty)}`
      : saved.variant === 'killer'
        ? `Killer · ${saved.difficulty}`
        : `${saved.gridSize}×${saved.gridSize} · ${saved.difficulty}`;

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
