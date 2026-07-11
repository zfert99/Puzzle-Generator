'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '@/features/interactive-board/store/useBoardStore';
import { Board } from '@/features/interactive-board/components/Board/Board';
import { Numpad } from '@/features/interactive-board/components/Controls/Numpad';
import { GameHeader } from '@/features/interactive-board/components/Header/GameHeader';
import { KeyboardHints } from '@/features/interactive-board/components/KeyboardHints';
import { DAILY_DIFFICULTIES, type DailyDifficulty } from '@/lib/db/daily-row';
import { useDaily } from '../hooks/useDaily';

// Same hydration-safe "mounted yet?" gate the play surface uses — the board store is
// persisted, so its state must not be read during SSR/hydration (AGENTS.md §1).
const noopSubscribe = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Human-friendly UTC date, e.g. "Saturday, 11 July 2026". */
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
 * Client orchestrator for `/daily`. Fetches today's shared puzzle from `/api/daily`
 * (never generated on the client — every player gets the identical stored board) and
 * hands it to the same Phase 3 board store, so the entire interactive board is reused.
 *
 * It keeps its own `phase` state ('select' | 'playing') rather than reading the store's
 * status, so an in-progress `/play` game persisted in localStorage does not leak the
 * daily straight into the board — the player explicitly picks a difficulty first.
 */
export default function DailyExperience() {
  const mounted = useHasMounted();
  const [phase, setPhase] = useState<'select' | 'playing'>('select');
  const [difficulty, setDifficulty] = useState<DailyDifficulty>('easy');
  const [dailyDate, setDailyDate] = useState<string>('');

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

  const handlePlay = async () => {
    const puzzle = await fetchDaily(difficulty);
    if (puzzle) {
      setDailyDate(puzzle.date);
      startNewGame(puzzle);
      setPhase('playing');
    }
  };

  const backToSelect = () => setPhase('select');

  // Neutral placeholder until hydrated, matching the play surface.
  if (!mounted) {
    return <div className="glass-panel p-8 max-w-md w-full mx-auto h-48" aria-hidden="true" />;
  }

  // ---- Difficulty picker ----
  if (phase === 'select') {
    return (
      <div className="glass-panel p-8 max-w-md w-full mx-auto">
        <h2 className="text-2xl font-semibold mb-1 text-center">Today&apos;s Daily</h2>
        <p className="text-xs text-gray-400 text-center mb-6">
          One shared puzzle per difficulty · resets at 00:00 UTC
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
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        <button
          type="button"
          onClick={handlePlay}
          disabled={loading}
          className="btn-primary w-full text-lg flex justify-center items-center"
        >
          {loading ? 'Loading…' : `Play ${difficulty}`}
        </button>
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

      <Numpad />

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
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {formatTime(useBoardStore.getState().elapsedTime)} · {useBoardStore.getState().mistakes}{' '}
              mistake{useBoardStore.getState().mistakes === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Leaderboards &amp; streaks arrive in a later update. Come back tomorrow for a new daily.
            </p>
            <button type="button" onClick={backToSelect} className="btn-primary">
              Back to difficulties
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
