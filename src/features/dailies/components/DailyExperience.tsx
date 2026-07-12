'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '@/features/interactive-board/store/useBoardStore';
import { Board } from '@/features/interactive-board/components/Board/Board';
import { Numpad } from '@/features/interactive-board/components/Controls/Numpad';
import { GameHeader } from '@/features/interactive-board/components/Header/GameHeader';
import { KeyboardHints } from '@/features/interactive-board/components/KeyboardHints';
import { AccountBadge } from '@/features/auth/components/AccountBadge';
import { UsernamePrompt } from '@/features/auth/components/UsernamePrompt';
import { useSession } from '@/features/auth/auth-client';
import { DAILY_DIFFICULTIES, type DailyDifficulty } from '@/lib/db/daily-row';
import { useDaily } from '../hooks/useDaily';

const noopSubscribe = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatUtcDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Result of submitting a completed daily for ranking. "Submitting" and "signed out" are
 * derived in render (from `session` + `idle`) rather than stored, so the effect never
 * calls setState synchronously.
 */
type SubmitState =
  | { status: 'idle' }
  | { status: 'done'; rank: number | null }
  | { status: 'error'; message: string };

/**
 * Client orchestrator for `/daily`. Fetches today's shared puzzle, plays it on the reused
 * Phase 3 board, and — when signed in — drives the ranked flow: it records a server-side
 * start (`/api/daily/start`) when play begins and submits the completed grid
 * (`/api/solve`) once solved, showing the returned rank. Signed-out players can still play;
 * they're just prompted to sign in to compete.
 *
 * Keeps a local `phase` ('select' | 'playing') so a persisted `/play` game never leaks onto
 * the daily board. A submit guard ref ensures the solve is posted exactly once per game.
 */
export default function DailyExperience() {
  const mounted = useHasMounted();
  const { data: session } = useSession();
  const [phase, setPhase] = useState<'select' | 'playing'>('select');
  const [difficulty, setDifficulty] = useState<DailyDifficulty>('easy');
  const [dailyDate, setDailyDate] = useState<string>('');
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' });
  const [completedToday, setCompletedToday] = useState<
    Record<string, { timeMs: number; rank: number | null }>
  >({});
  const submittedRef = useRef(false);

  const { loading, error, fetchDaily } = useDaily();
  const { status } = useBoardStore(useShallow((s) => ({ status: s.status })));
  const startNewGame = useBoardStore((s) => s.startNewGame);
  const tick = useBoardStore((s) => s.tick);

  // Timer: one interval, active only while the daily is being played.
  useEffect(() => {
    if (phase !== 'playing' || status !== 'playing') return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [phase, status, tick]);

  // Which of today's dailies this user has already completed (one attempt per day).
  useEffect(() => {
    if (!session) return;
    let active = true;
    fetch('/api/me/today')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.completed) setCompletedToday(d.completed);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session]);

  // Submit the solve exactly once, when the board reports 'solved' during a daily. All
  // setState happens inside async callbacks (never synchronously in the effect body); the
  // signed-out and in-flight cases are derived in render from `session` + the 'idle' state.
  useEffect(() => {
    if (phase !== 'playing' || status !== 'solved' || submittedRef.current) return;
    submittedRef.current = true;
    if (!session) return;

    const { grid, mistakes } = useBoardStore.getState();
    fetch('/api/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty, grid, mistakes }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setSubmit({ status: 'done', rank: data.rank ?? null });
          // Mark today's difficulty complete so the picker won't offer a replay.
          setCompletedToday((prev) => ({
            ...prev,
            [difficulty]: { timeMs: data.timeMs, rank: data.rank ?? null },
          }));
        } else {
          setSubmit({ status: 'error', message: data.error || 'Could not submit solve' });
        }
      })
      .catch(() => setSubmit({ status: 'error', message: 'Network error submitting solve' }));
  }, [phase, status, session, difficulty]);

  const handlePlay = async () => {
    const puzzle = await fetchDaily(difficulty);
    if (!puzzle) return;
    setDailyDate(puzzle.date);
    submittedRef.current = false;
    setSubmit({ status: 'idle' });
    startNewGame(puzzle);
    setPhase('playing');

    // Record the server-side start time so the solve can be timed by the server. Called
    // unconditionally, not gated on the client `session` (which may still be loading) — the
    // auth cookie is what matters; a signed-out caller just gets a harmless 401.
    fetch('/api/daily/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty }),
    }).catch(() => {});
  };

  const backToSelect = () => {
    submittedRef.current = false;
    setSubmit({ status: 'idle' });
    setPhase('select');
  };

  if (!mounted) {
    return <div className="glass-panel p-8 max-w-md w-full mx-auto h-48" aria-hidden="true" />;
  }

  // ---- Difficulty picker ----
  if (phase === 'select') {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="flex justify-between items-center mb-4 px-1">
          <Link href="/leaderboard" className="text-sm text-indigo-400 hover:underline">
            🏆 Leaderboard
          </Link>
          <AccountBadge />
        </div>
        <UsernamePrompt />
        <div className="glass-panel p-8">
          <h2 className="text-2xl font-semibold mb-1 text-center">Today&apos;s Daily</h2>
          <p className="text-xs text-gray-400 text-center mb-6">
            One shared puzzle per difficulty · resets at 00:00 UTC
            {!session && ' · sign in to be ranked'}
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2 text-center">Difficulty</label>
            <div className="flex flex-wrap justify-center gap-2">
              {DAILY_DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-2 rounded-lg text-sm capitalize transition-all ${
                    difficulty === d
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {d}
                  {completedToday[d] && <span className="ml-1 text-green-400">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

          {completedToday[difficulty] ? (
            <div className="text-center">
              <p className="text-green-500 font-semibold mb-1">
                ✓ Solved in {formatTime(Math.round(completedToday[difficulty].timeMs / 1000))}
                {completedToday[difficulty].rank ? ` · ranked #${completedToday[difficulty].rank}` : ''}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                One attempt per day — new puzzle at 00:00 UTC. Try another difficulty, or:
              </p>
              <Link href="/leaderboard" className="btn-primary w-full inline-flex justify-center">
                View leaderboard
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePlay}
              disabled={loading}
              className="btn-primary w-full text-lg flex justify-center items-center"
            >
              {loading ? 'Loading…' : `Play ${difficulty}`}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- Game ----
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-[520px] mx-auto mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={backToSelect}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:underline"
        >
          ← Difficulties
        </button>
        {dailyDate && (
          <span className="text-xs text-gray-400 capitalize">
            {difficulty} · {formatUtcDate(dailyDate)}
          </span>
        )}
      </div>

      <GameHeader />

      {status === 'paused' ? (
        <div className="w-[min(92vw,520px)] aspect-square flex items-center justify-center rounded-lg bg-white/5 text-gray-400">
          Paused
        </div>
      ) : (
        <Board />
      )}

      <Numpad showHint={false} />

      <KeyboardHints />

      {status === 'solved' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-solved-title"
        >
          <div className="celebrate rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-gray-900 p-8 max-w-sm w-full text-center shadow-2xl">
            <p className="text-5xl mb-2" aria-hidden="true">
              <span className="celebrate-emoji">🎉</span>
            </p>
            <h2 id="daily-solved-title" className="text-2xl font-bold text-green-500 mb-2">
              Daily solved!
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {formatTime(useBoardStore.getState().elapsedTime)} · {useBoardStore.getState().mistakes}{' '}
              mistake{useBoardStore.getState().mistakes === 1 ? '' : 's'}
            </p>

            {/* Ranked-flow result — derived from session + submit (no synchronous setState). */}
            <div className="mb-6 min-h-[1.5rem] text-sm">
              {!session ? (
                <span className="text-gray-400">
                  <Link href="/signin" className="text-indigo-400 hover:underline">
                    Sign in
                  </Link>{' '}
                  to be ranked on the leaderboard.
                </span>
              ) : submit.status === 'done' ? (
                <span className="rank-reveal text-indigo-400 font-semibold">
                  {submit.rank ? `🏆 Ranked #${submit.rank} today` : 'Time recorded!'}
                </span>
              ) : submit.status === 'error' ? (
                <span className="text-amber-500">{submit.message}</span>
              ) : (
                <span className="text-gray-400">Submitting your time…</span>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <button type="button" onClick={backToSelect} className="btn-primary">
                Back to difficulties
              </button>
              <Link
                href="/leaderboard"
                className="px-5 py-3 rounded-lg border border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                Leaderboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
