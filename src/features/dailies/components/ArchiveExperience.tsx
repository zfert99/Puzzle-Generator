'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '@/features/interactive-board/store/useBoardStore';
import { useSavedGame, formatElapsed } from '@/features/interactive-board/store/useSavedGame';
import { Board } from '@/features/interactive-board/components/Board/Board';
import { Numpad } from '@/features/interactive-board/components/Controls/Numpad';
import { GameHeader } from '@/features/interactive-board/components/Header/GameHeader';
import { KeyboardHints } from '@/features/interactive-board/components/KeyboardHints';
import { ConfirmModal } from '@/features/interactive-board/components/ConfirmModal';
import { SolvedStamp } from '@/features/juice/SolvedStamp';
import { LeaderboardView } from '@/features/leaderboards/components/LeaderboardView';
import { formatDailyKey, toUtcDateString, type DailyDifficulty } from '@/lib/db/daily-row';
import { useDaily } from '../hooks/useDaily';
import { Calendar } from './Calendar';

const noopSubscribe = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function formatUtcDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Client orchestrator for `/archive` — browse a past day (calendar), see that day's final
 * leaderboard, and replay its puzzle as **unranked practice** (no `/api/solve` submit here).
 * Replays reuse the shared board via `startNewGame(puzzle, 'daily', date)`; the difficulty is
 * lifted here so the one `LeaderboardView` selector also drives the Play button.
 */
export default function ArchiveExperience() {
  const router = useRouter();
  const mounted = useHasMounted();
  const todayIso = toUtcDateString(new Date());

  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [difficulty, setDifficulty] = useState<DailyDifficulty>('easy');
  const [view, setView] = useState<'browse' | 'playing'>('browse');
  const [playedDate, setPlayedDate] = useState('');
  const [warnOpen, setWarnOpen] = useState(false);

  const { loading, error, fetchDaily } = useDaily();
  const { status } = useBoardStore(useShallow((s) => ({ status: s.status })));
  const startNewGame = useBoardStore((s) => s.startNewGame);
  const tick = useBoardStore((s) => s.tick);
  const saved = useSavedGame();

  // Timer runs only while actively replaying (unranked, but still shown).
  useEffect(() => {
    if (view !== 'playing' || status !== 'playing') return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [view, status, tick]);

  const beginPlay = async () => {
    const puzzle = await fetchDaily(difficulty, selectedDate);
    if (!puzzle) return;
    setPlayedDate(puzzle.date);
    startNewGame(puzzle, 'daily', puzzle.date);
    setView('playing');
  };

  const handlePlay = () => {
    if (saved) setWarnOpen(true);
    else void beginPlay();
  };

  const confirmNew = () => {
    setWarnOpen(false);
    void beginPlay();
  };

  // "Keep playing" — a saved game always lives on another surface from here, so go to it.
  const keepPlaying = () => {
    setWarnOpen(false);
    if (saved?.mode === 'daily') router.push('/daily');
    else if (saved) router.push('/play');
  };

  if (!mounted) {
    return <div className="glass-panel p-8 max-w-md w-full mx-auto h-48" aria-hidden="true" />;
  }

  // ---- Replay (unranked) ----
  if (view === 'playing') {
    return (
      <div className="w-full flex flex-col items-center">
        <div className="w-full max-w-[520px] mx-auto mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setView('browse')}
            className="text-sm text-ink-soft hover:text-ink hover:underline"
          >
            ← Archive
          </button>
          {playedDate && (
            <span className="text-xs text-ink-soft capitalize">
              {difficulty} · {formatUtcDate(playedDate)} · practice
            </span>
          )}
        </div>

        <GameHeader />

        {status === 'paused' ? (
          <div className="w-[min(92vw,520px)] aspect-square flex items-center justify-center rounded-lg bg-paper text-ink-soft">
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
            aria-label="Practice solved"
          >
            <div className="rounded-2xl border-[3px] border-ink bg-paper-2 p-8 max-w-sm w-full text-center shadow-chunky">
              <SolvedStamp label="Solved!" />
              <p className="text-sm text-ink-soft mb-2">
                {formatElapsed(useBoardStore.getState().elapsedTime)} ·{' '}
                {useBoardStore.getState().mistakes} mistake
                {useBoardStore.getState().mistakes === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-ink-soft mb-6">Practice replay — not ranked.</p>
              <button type="button" onClick={() => setView('browse')} className="btn-primary">
                Back to archive
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- Browse ----
  // Desktop: calendar + practice button beside the board picker/leaderboard (two columns, no
  // page scroll). Mobile: the same order stacked — calendar, button, then the types.
  return (
    <div className="w-full max-w-lg md:max-w-4xl mx-auto">
      <p className="text-center text-sm text-ink-soft mb-4">
        Pick a past day to replay its puzzle (unranked) or view that day&apos;s final board.
      </p>

      <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
        <div>
          <div className="mb-4">
            <Calendar value={selectedDate} onChange={setSelectedDate} maxDate={todayIso} />
            <p className="text-center text-sm mt-2 font-medium">{formatUtcDate(selectedDate)}</p>
          </div>

          {error && <p className="text-cherry text-sm mb-4 text-center">{error}</p>}

          <button
            type="button"
            onClick={handlePlay}
            disabled={loading}
            className="btn-primary w-full text-lg flex justify-center items-center mb-6 md:mb-0"
          >
            {loading ? 'Loading…' : `Play ${formatDailyKey(difficulty)} (practice)`}
          </button>
        </div>

        <LeaderboardView
          date={selectedDate}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
        />
      </div>

      <ConfirmModal
        open={warnOpen}
        title="Start a new puzzle?"
        message="You have a saved puzzle in progress. Playing this archived puzzle will erase it — you can only save one puzzle at a time."
        confirmLabel="Play it"
        cancelLabel="Keep playing"
        onConfirm={confirmNew}
        onCancel={keepPlaying}
        onDismiss={() => setWarnOpen(false)}
      />
    </div>
  );
}
