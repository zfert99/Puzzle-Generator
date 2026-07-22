'use client';

import { useEffect, useState } from 'react';
import { DAILY_BOARDS, formatDailyKey, type DailyDifficulty } from '@/lib/db/daily-row';
import { useSession } from '@/features/auth/auth-client';
import { useCountUp } from '@/features/juice/useCountUp';
import { BOT_USER_ID } from '@/features/leaderboards/bot-identity';

interface Entry {
  rank: number;
  userId: string;
  name: string;
  timeMs: number;
  mistakes: number;
}
interface Me {
  rank: number;
  timeMs: number;
  mistakes: number;
}

/** ms → "m:ss". */
function formatMs(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/**
 * Client view for the leaderboard: difficulty tabs, a day's board, and — when signed in —
 * the caller's own rank (highlighted) and current streak. Reads from the public
 * `/api/leaderboard` and `/api/me/streak`; all ranking/ownership is decided server-side.
 *
 * Pass `date` (YYYY-MM-DD) to show a PAST day's board (the archive); omit it for today. For a
 * past board the "current" panels (streak + personal bests) are hidden, since they're
 * today-relative concepts, while the caller's own historical rank still shows.
 *
 * Fetch effects set state only inside async callbacks (never synchronously in the effect
 * body); the loading flash on tab-switch is driven from the click handler instead.
 */
export function LeaderboardView({
  date,
  difficulty: controlledDifficulty,
  onDifficultyChange,
  initialDifficulty,
}: {
  date?: string;
  /** Control the difficulty externally (the archive drives one selector for board + play). */
  difficulty?: DailyDifficulty;
  onDifficultyChange?: (d: DailyDifficulty) => void;
  /** Seed the (uncontrolled) initial tab — e.g. deep-linking from "just solved X" to X's board. */
  initialDifficulty?: DailyDifficulty;
} = {}) {
  const { data: session } = useSession();
  const [internalDifficulty, setInternalDifficulty] = useState<DailyDifficulty>(initialDifficulty ?? 'easy');
  const difficulty = controlledDifficulty ?? internalDifficulty;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const shownStreak = useCountUp(streak); // rolls up from 0 when the streak loads
  const [bests, setBests] = useState<{ difficulty: string; bestMs: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/leaderboard?difficulty=${difficulty}${date ? `&date=${date}` : ''}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok) {
          setEntries(data.entries);
          setMe(data.me);
          setError('');
        } else {
          setError(data.error || 'Failed to load leaderboard');
          setEntries([]);
          setMe(null);
        }
      })
      .catch(() => {
        if (active) {
          setError('Failed to load leaderboard');
          setEntries([]);
          setMe(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [difficulty, date]);

  // Streak + personal bests, only when signed in and viewing TODAY (they're today-relative,
  // meaningless for an archived board). Render gates on `session`, so no synchronous reset.
  useEffect(() => {
    if (!session || date) return;
    let active = true;
    fetch('/api/me/streak')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setStreak(d?.streak ?? null);
      })
      .catch(() => {});
    fetch('/api/me/bests')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setBests(d?.bests ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session, date]);

  const selectDifficulty = (d: DailyDifficulty) => {
    if (d === difficulty) return;
    setLoading(true);
    if (onDifficultyChange) onDifficultyChange(d);
    else setInternalDifficulty(d);
  };

  return (
    <div className="glass-panel p-6 max-w-lg w-full mx-auto">
      <div className="mb-5 space-y-2">
        {(
          [
            ['classic', 'Classic'],
            ['killer', 'Killer'],
            ['minis', 'Minis'],
          ] as const
        ).map(([section, heading]) => (
          <div key={section} className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-ink-soft w-14 text-right">{heading}</span>
            {DAILY_BOARDS.filter((b) => b.section === section).map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => selectDifficulty(b.key)}
                className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-all ${
                  difficulty === b.key ? 'bg-butterscotch text-ink' : 'bg-paper border-2 border-ink hover:bg-paper-2'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {session && (streak !== null || me) && (
        <p className="text-center text-sm text-ink-soft mb-3">
          {streak !== null ? `🔥 ${shownStreak ?? streak}-day streak` : ''}
          {me ? `${streak !== null ? ' · ' : ''}Your rank: #${me.rank} (${formatMs(me.timeMs)})` : ''}
        </p>
      )}

      {session && bests.length > 0 && (
        <div className="mb-4 text-center">
          <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">Your personal bests</p>
          <div className="flex flex-wrap justify-center gap-2">
            {bests.map((best) => (
              <span key={best.difficulty} className="px-2 py-1 rounded-md bg-paper text-xs">
                <span className="capitalize text-ink-soft">{formatDailyKey(best.difficulty)}</span>{' '}
                <span className="tabular-nums font-medium">{formatMs(best.bestMs)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-ink-soft py-8">Loading…</p>
      ) : error ? (
        <p className="text-center text-cherry py-8">{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-ink-soft py-8">
          {date ? 'No solves were recorded for this day.' : 'No solves yet today — be the first!'}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ink-soft text-left">
              <th className="py-2 w-10">#</th>
              <th className="py-2">Player</th>
              <th className="py-2 text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const isMe = session?.user.id === e.userId;
              const isBot = e.userId === BOT_USER_ID;
              return (
                <tr
                  key={e.userId}
                  className={`border-t border-white/5 ${isMe ? 'bg-butterscotch/25 font-semibold' : ''}`}
                >
                  <td className="py-2">{e.rank}</td>
                  <td className="py-2">
                    {isBot && <span aria-hidden="true">🤖 </span>}
                    {e.name}
                    {isBot && <span className="text-ink-soft text-xs"> (bot — beat it!)</span>}
                    {isMe && <span className="text-grape"> (you)</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatMs(e.timeMs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
