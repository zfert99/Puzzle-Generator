'use client';

import { useEffect, useState } from 'react';
import { DAILY_DIFFICULTIES, type DailyDifficulty } from '@/lib/db/daily-row';
import { useSession } from '@/features/auth/auth-client';

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
 * Client view for `/leaderboard`: difficulty tabs, today's board, and — when signed in —
 * the caller's own rank (highlighted) and current streak. Reads from the public
 * `/api/leaderboard` and `/api/me/streak`; all ranking/ownership is decided server-side.
 *
 * Fetch effects set state only inside async callbacks (never synchronously in the effect
 * body); the loading flash on tab-switch is driven from the click handler instead.
 */
export function LeaderboardView() {
  const { data: session } = useSession();
  const [difficulty, setDifficulty] = useState<DailyDifficulty>('easy');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/leaderboard?difficulty=${difficulty}`)
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
  }, [difficulty]);

  // Streak only when signed in; render gates on `session`, so no synchronous reset is needed.
  useEffect(() => {
    if (!session) return;
    let active = true;
    fetch('/api/me/streak')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setStreak(d?.streak ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session]);

  const selectDifficulty = (d: DailyDifficulty) => {
    if (d === difficulty) return;
    setLoading(true);
    setDifficulty(d);
  };

  return (
    <div className="glass-panel p-6 max-w-lg w-full mx-auto">
      <div className="flex flex-wrap justify-center gap-2 mb-5">
        {DAILY_DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => selectDifficulty(d)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-all ${
              difficulty === d ? 'bg-indigo-600 text-white' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {session && (streak !== null || me) && (
        <p className="text-center text-sm text-gray-400 mb-4">
          {streak !== null ? `🔥 ${streak}-day streak` : ''}
          {me ? `${streak !== null ? ' · ' : ''}Your rank: #${me.rank} (${formatMs(me.timeMs)})` : ''}
        </p>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-8">Loading…</p>
      ) : error ? (
        <p className="text-center text-red-500 py-8">{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-gray-400 py-8">No solves yet today — be the first!</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left">
              <th className="py-2 w-10">#</th>
              <th className="py-2">Player</th>
              <th className="py-2 text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const isMe = session?.user.id === e.userId;
              return (
                <tr
                  key={e.userId}
                  className={`border-t border-white/5 ${isMe ? 'bg-indigo-500/10 font-semibold' : ''}`}
                >
                  <td className="py-2">{e.rank}</td>
                  <td className="py-2">
                    {e.name}
                    {isMe && <span className="text-indigo-400"> (you)</span>}
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
