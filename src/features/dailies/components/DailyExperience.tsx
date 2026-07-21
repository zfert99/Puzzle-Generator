'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '@/features/interactive-board/store/useBoardStore';
import { useSavedGame, formatElapsed } from '@/features/interactive-board/store/useSavedGame';
import { Board } from '@/features/interactive-board/components/Board/Board';
import { Numpad } from '@/features/interactive-board/components/Controls/Numpad';
import { GameHeader } from '@/features/interactive-board/components/Header/GameHeader';
import { KeyboardHints } from '@/features/interactive-board/components/KeyboardHints';
import { ConfirmModal } from '@/features/interactive-board/components/ConfirmModal';
import { UsernamePrompt } from '@/features/auth/components/UsernamePrompt';
import { SolvedStamp } from '@/features/juice/SolvedStamp';
import { Sticker } from '@/features/chaos/Sticker';
import { Tape } from '@/features/chaos/Tape';
import { MarqueeTicker } from '@/features/chaos/MarqueeTicker';
import { useSession } from '@/features/auth/auth-client';
import { DAILY_BOARDS, formatDailyKey, toUtcDateString, type DailyDifficulty } from '@/lib/db/daily-row';
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
 * board, and — when signed in — drives the ranked flow. Ranking is timed by the CLIENT
 * (`elapsedTime`, which only advances while actively playing), so a player can pause by
 * leaving and resume later without inflating their time; the server keeps a plausibility
 * floor as the anti-cheat guard.
 *
 * Keeps a local `phase` ('select' | 'playing') so the picker always shows first, offering a
 * **Continue** button when a daily is parked in the store and a warning before a new game
 * erases it. A submit guard ref ensures the solve is posted exactly once per game.
 */
export default function DailyExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useHasMounted();
  const { data: session } = useSession();
  const [phase, setPhase] = useState<'select' | 'playing'>('select');
  const [difficulty, setDifficulty] = useState<DailyDifficulty>('easy');
  const [dailyDate, setDailyDate] = useState<string>('');
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' });
  const [warnOpen, setWarnOpen] = useState(false);
  const [resumeHandled, setResumeHandled] = useState(false);
  const wantsResume = searchParams.get('resume') === '1';
  const [pendingDifficulty, setPendingDifficulty] = useState<DailyDifficulty | null>(null);
  const [completedToday, setCompletedToday] = useState<
    Record<string, { timeMs: number; rank: number | null }>
  >({});
  const submittedRef = useRef(false);

  const { loading, error, fetchDaily } = useDaily();
  const { status, grid, solution } = useBoardStore(
    useShallow((s) => ({ status: s.status, grid: s.grid, solution: s.solution })),
  );
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const startNewGame = useBoardStore((s) => s.startNewGame);
  const resume = useBoardStore((s) => s.resume);
  const tick = useBoardStore((s) => s.tick);

  const saved = useSavedGame();
  const savedIsDaily = saved?.mode === 'daily';

  // Deep link from the hub's Continue banner (`/daily?resume=1`): jump straight into the parked
  // daily instead of the picker. Adjust state during render (once, after mount) — restoring the
  // difficulty/date the playing view needs, exactly as handleContinue does. Store actions (like
  // resume) run in the effect below, not during render.
  if (mounted && wantsResume && !resumeHandled) {
    setResumeHandled(true);
    if (saved?.mode === 'daily') {
      setDifficulty(saved.difficulty as DailyDifficulty);
      setDailyDate(saved.dailyDate ?? '');
      setSubmit({ status: 'idle' });
      setPhase('playing');
    }
  }
  useEffect(() => {
    if (phase === 'playing' && wantsResume && useBoardStore.getState().status === 'paused') resume();
  }, [phase, wantsResume, resume]);
  const todayIso = toUtcDateString(new Date());
  // A daily left running across the UTC rollover is no longer today's — finishable for fun,
  // but not rankable. Derived here so the solved modal can say so without a setState-in-effect.
  const isExpiredDaily = dailyDate !== '' && dailyDate !== todayIso;

  // Dailies give no live error feedback, so completion is checked on FULLNESS, not correctness:
  // when every cell is filled, either it's solved (the "you won" modal) or we tell the player
  // how many cells are wrong (without which). `wrongCount` counts currently-incorrect cells.
  const isFull = grid.length > 0 && grid.every((row) => row.every((v) => v !== 0));
  const wrongCount = isFull
    ? grid.reduce((acc, row, r) => acc + row.reduce((a, v, c) => a + (v !== solution[r][c] ? 1 : 0), 0), 0)
    : 0;
  // Let the review modal re-appear each time the board is re-filled: clear the dismissal once
  // the board is no longer full (adjust-state-during-render, keyed on the previous fullness).
  const [wasFull, setWasFull] = useState(isFull);
  if (isFull !== wasFull) {
    setWasFull(isFull);
    if (!isFull) setReviewDismissed(false);
  }
  const showReview = phase === 'playing' && isFull && status !== 'solved' && !reviewDismissed;

  // Timer: one interval, active only while actively playing the daily (not on the picker).
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

  // Submit the solve exactly once, when the board reports 'solved' during a daily. Ranking
  // uses the CLIENT timer (`elapsedTime`), and only today's daily is rankable — a daily left
  // over the UTC rollover (dailyDate ≠ today) is finished for fun but not submitted.
  useEffect(() => {
    if (phase !== 'playing' || status !== 'solved' || submittedRef.current) return;
    submittedRef.current = true;
    // Only today's daily is rankable; an expired (rollover) daily is derived in render, not
    // submitted — no synchronous setState here (react-hooks/set-state-in-effect).
    if (!session || dailyDate !== todayIso) return;

    const { grid, mistakes, elapsedTime } = useBoardStore.getState();
    fetch('/api/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty, grid, mistakes, timeMs: elapsedTime * 1000 }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setSubmit({ status: 'done', rank: data.rank ?? null });
          setCompletedToday((prev) => ({
            ...prev,
            [difficulty]: { timeMs: data.timeMs, rank: data.rank ?? null },
          }));
        } else {
          setSubmit({ status: 'error', message: data.error || 'Could not submit solve' });
        }
      })
      .catch(() => setSubmit({ status: 'error', message: 'Network error submitting solve' }));
  }, [phase, status, session, difficulty, dailyDate, todayIso]);

  const beginDaily = async (chosen: DailyDifficulty) => {
    const puzzle = await fetchDaily(chosen);
    if (!puzzle) return;
    setDifficulty(chosen);
    setDailyDate(puzzle.date);
    submittedRef.current = false;
    setSubmit({ status: 'idle' });
    startNewGame(puzzle, 'daily', puzzle.date);
    setPhase('playing');

    // Record the server-side start (marks the attempt + one-per-day lock). Called
    // unconditionally; a signed-out caller just gets a harmless 401.
    fetch('/api/daily/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty: chosen }),
    }).catch(() => {});
  };

  // Start a new daily; warn first if it would erase a parked game (any surface — one slot).
  const handlePlay = (chosen: DailyDifficulty) => {
    if (saved) {
      setPendingDifficulty(chosen);
      setWarnOpen(true);
    } else {
      void beginDaily(chosen);
    }
  };

  const confirmNew = () => {
    setWarnOpen(false);
    if (pendingDifficulty) void beginDaily(pendingDifficulty);
    setPendingDifficulty(null);
  };

  const dismissWarn = () => {
    setWarnOpen(false);
    setPendingDifficulty(null);
  };

  // "Keep playing" — take the player to their saved game: resume it here if it's a daily,
  // otherwise go to the surface that owns it (a saved free-play game lives on /play).
  const keepPlaying = () => {
    dismissWarn();
    if (saved?.mode === 'daily') handleContinue();
    else if (saved) router.push('/play');
  };

  // Resume the parked daily — restore its difficulty/date from the store, no re-fetch.
  const handleContinue = () => {
    if (!saved) return;
    if (status === 'paused') resume();
    setDifficulty(saved.difficulty as DailyDifficulty);
    setDailyDate(saved.dailyDate ?? '');
    submittedRef.current = false;
    setSubmit({ status: 'idle' });
    setPhase('playing');
  };

  const backToSelect = () => {
    submittedRef.current = false;
    setSubmit({ status: 'idle' });
    setPhase('select');
  };

  if (!mounted) {
    return <div className="glass-panel p-8 max-w-md md:max-w-2xl w-full mx-auto h-48" aria-hidden="true" />;
  }

  // ---- Difficulty picker ----
  if (phase === 'select') {
    return (
      <div className="w-full max-w-md md:max-w-2xl mx-auto">
        <div className="mb-4">
          <MarqueeTicker
            items={['new puzzle daily', 'easy → extreme', 'beat your streak', 'no cookies, only biscuits']}
          />
        </div>
        <UsernamePrompt />
        <div className="glass-panel p-8 relative">
          {/* Chaos decoration (chrome only — the board itself stays clean). */}
          <Tape rotate={-8} className="absolute -top-2 left-1/2 -translate-x-1/2" />
          <Sticker color="pink" rotate={-12} className="absolute -top-3 -right-3 z-10">
            play me!
          </Sticker>
          <h2 className="text-2xl font-semibold mb-1 text-center">Today&apos;s Daily</h2>
          <p className="text-xs text-ink-soft text-center mb-6">
            One shared puzzle per difficulty · resets at 00:00 UTC
            {!session && ' · sign in to be ranked'}
          </p>

          {savedIsDaily && saved && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handleContinue}
                className="btn-primary w-full text-lg flex justify-center items-center"
              >
                Continue {formatDailyKey(saved.difficulty)} · {formatElapsed(saved.elapsedTime)}
              </button>
              <p className="text-xs text-ink-soft text-center mt-3">— or start a new one —</p>
            </div>
          )}

          {(
            [
              ['classic', 'Classic 9×9'],
              ['killer', 'Killer 9×9'],
              ['minis', 'Minis'],
            ] as const
          ).map(([section, heading]) => (
            <div key={section} className="mb-4">
              <label className="block text-sm font-medium text-ink-soft mb-2 text-center">{heading}</label>
              <div className="flex flex-wrap justify-center gap-2">
                {DAILY_BOARDS.filter((b) => b.section === section).map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setDifficulty(b.key)}
                    className={`px-3 py-2 rounded-lg text-sm capitalize transition-all ${
                      difficulty === b.key
                        ? 'bg-butterscotch text-ink border-2 border-ink'
                        : 'bg-paper border-2 border-ink hover:bg-paper-2'
                    }`}
                  >
                    {b.label}
                    {completedToday[b.key] && <span className="ml-1 text-green-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {error && <p className="text-cherry text-sm mb-4 text-center">{error}</p>}

          {completedToday[difficulty] ? (
            <div className="text-center">
              <p className="text-mint font-semibold mb-1">
                ✓ Solved in {formatTime(Math.round(completedToday[difficulty].timeMs / 1000))}
                {completedToday[difficulty].rank ? ` · ranked #${completedToday[difficulty].rank}` : ''}
              </p>
              <p className="text-xs text-ink-soft mb-4">
                One attempt per day — new puzzle at 00:00 UTC. Try another difficulty, or:
              </p>
              <Link href="/leaderboard" className="btn-primary w-full inline-flex justify-center">
                View leaderboard
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handlePlay(difficulty)}
              disabled={loading}
              className="btn-primary w-full text-lg flex justify-center items-center"
            >
              {loading ? 'Loading…' : `Play ${formatDailyKey(difficulty)}`}
            </button>
          )}
        </div>

        <ConfirmModal
          open={warnOpen}
          title="Start a new puzzle?"
          message="You have a saved puzzle in progress. Starting a new one will erase it — you can only save one puzzle at a time."
          confirmLabel="Start new"
          cancelLabel="Keep playing"
          onConfirm={confirmNew}
          onCancel={keepPlaying}
          onDismiss={dismissWarn}
        />
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
          className="text-sm text-ink-soft hover:text-ink hover:underline"
        >
          ← Difficulties
        </button>
        {dailyDate && (
          <span className="text-xs text-ink-soft capitalize">
            {formatDailyKey(difficulty)} · {formatUtcDate(dailyDate)}
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

      <Numpad showHint={false} />

      <KeyboardHints />

      {status === 'solved' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Daily solved"
        >
          <div className="rounded-2xl border-[3px] border-ink bg-paper-2 p-8 max-w-sm w-full text-center shadow-chunky">
            <SolvedStamp label="Daily solved!" />
            <p className="text-sm text-ink-soft mb-3">
              {formatTime(useBoardStore.getState().elapsedTime)} · {useBoardStore.getState().mistakes}{' '}
              mistake{useBoardStore.getState().mistakes === 1 ? '' : 's'}
            </p>

            {/* Ranked-flow result — derived from session + submit (no synchronous setState). */}
            <div className="mb-6 min-h-[1.5rem] text-sm">
              {isExpiredDaily ? (
                <span className="text-butterscotch-dark">This daily has expired — play today’s for a rank.</span>
              ) : !session ? (
                <span className="text-ink-soft">
                  <Link href="/signin" className="text-grape hover:underline">
                    Sign in
                  </Link>{' '}
                  to be ranked on the leaderboard.
                </span>
              ) : submit.status === 'done' ? (
                <span className="rank-reveal text-grape font-semibold">
                  {submit.rank ? `🏆 Ranked #${submit.rank} today` : 'Time recorded!'}
                </span>
              ) : submit.status === 'error' ? (
                <span className="text-butterscotch-dark">{submit.message}</span>
              ) : (
                <span className="text-ink-soft">Submitting your time…</span>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <button type="button" onClick={backToSelect} className="btn-primary">
                Back to difficulties
              </button>
              <Link
                href="/leaderboard"
                className="px-5 py-3 rounded-lg border border-ink hover:bg-paper-2 transition-colors"
              >
                Leaderboard
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Board full but not correct — tell the player how many cells are wrong (not which), and
          let them go back to fix them. Dailies have no live error feedback, so this is the
          moment they learn their count. */}
      {showReview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Board full"
        >
          <div className="rounded-2xl border-[3px] border-ink bg-paper-2 p-8 max-w-sm w-full text-center shadow-chunky">
            <div className="text-4xl mb-2" aria-hidden="true">🔍</div>
            <h2 className="font-display text-2xl mb-1">Not quite!</h2>
            <p className="text-sm text-ink-soft mb-6">
              The board is full, but{' '}
              <strong className="text-ink">
                {wrongCount} cell{wrongCount === 1 ? ' is' : 's are'}
              </strong>{' '}
              still incorrect. Find and fix {wrongCount === 1 ? 'it' : 'them'} to solve the daily.
            </p>
            <button type="button" onClick={() => setReviewDismissed(true)} className="btn-primary w-full">
              Keep looking
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
