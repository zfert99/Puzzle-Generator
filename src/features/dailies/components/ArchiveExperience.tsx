'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
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
import { useSession } from '@/features/auth/auth-client';
import { apiPath } from '@/lib/base-path';
import { formatDailyKey, toUtcDateString, type DailyDifficulty } from '@/lib/db/daily-row';
import { slotLabel, reconcileSelectedKey, type DailySlotInfo } from '../slot-display';
import { useDaily } from '../hooks/useDaily';
import { Calendar, type DayTally } from './Calendar';
// Type-only import of the endpoint's own response shape (erased at build — no server code is
// pulled into the bundle). Redeclaring it here would let the two drift silently: renaming a set
// server-side would still compile, then throw on the first render that reads the missing key.
import type { DayProgress } from '@/app/api/me/progress/route';

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
 *
 * **Today is browsable but not playable here (Aug 2026).** The calendar still reaches today, so
 * today's leaderboard stays visible beside the calendar — but pressing Play on today hands off to
 * `/daily` instead of starting a board. It used to start an *unranked* practice run of the board
 * you still had to play ranked, and, because a replay calls `startNewGame`, could erase an
 * in-progress ranked attempt at that same board from the one saved slot. Nothing on screen said so.
 *
 * The hand-off carries the chosen slot (`/daily?slot=<key>`) so the player does not pick twice.
 * Rankability stays entirely in `DailyExperience`, which already posts `/api/daily/start` on begin
 * and submits only when `dailyDate === today` — this surface still has no `/api/solve` caller, and
 * `· practice` remains unconditionally true for everything it does start.
 */
export default function ArchiveExperience() {
  const router = useRouter();
  const mounted = useHasMounted();
  const todayIso = toUtcDateString(new Date());

  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [difficulty, setDifficulty] = useState<DailyDifficulty>('easy');
  const [slots, setSlots] = useState<DailySlotInfo[]>([]);
  const [view, setView] = useState<'browse' | 'playing'>('browse');
  const [playedDate, setPlayedDate] = useState('');
  const [warnOpen, setWarnOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => todayIso.slice(0, 7));
  const [progress, setProgress] = useState<Record<string, DayProgress>>({});

  /**
   * Reconcile the selected board against the day actually being viewed. Only 3 of the 5 standard
   * rungs are drawn per day, so neither the initial `'easy'` default nor a key carried over from a
   * previously-viewed date is guaranteed to exist here — leaving it unchecked showed a bare
   * "No daily puzzle for <date> (easy)". `LeaderboardView` already fetches the day's boards, so it
   * hands them over rather than us fetching the same endpoint twice.
   */
  const handleSlotsLoaded = useCallback((loaded: DailySlotInfo[]) => {
    setSlots(loaded);
    setDifficulty((cur) => reconcileSelectedKey(loaded, cur));
  }, []);

  // "Hard · Killer" once the day's boards are known; the bare key label until then (and for a
  // date whose boards predate the restructure, where the key still carries its own type).
  const selectedSlot = slots.find((s) => s.key === difficulty);
  const selectedLabel = selectedSlot ? slotLabel(selectedSlot) : formatDailyKey(difficulty);

  const { data: session } = useSession();

  // The visible month's X/N counts, fetched a month at a time (the calendar shows a month, and
  // per-day fetching would fire on every click). Signed-in only: the counts are personal, so a
  // signed-out visitor gets no markers rather than a wall of "0/3".
  useEffect(() => {
    if (!session) return;
    let active = true;
    fetch(apiPath(`/api/me/progress?month=${visibleMonth}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // Accumulate across months so paging back and forth doesn't blank out what's already
        // loaded (each response is keyed by ISO date, so months can't collide).
        if (active && d?.days) setProgress((cur) => ({ ...cur, ...d.days }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session, visibleMonth]);

  // Both readings are gated on the session at RENDER time, not cleared in an effect: signing out
  // must drop the previous user's counts immediately (the tab is shared), and clearing state from
  // an effect body is both a render-pass late and banned by `react-hooks/set-state-in-effect`.
  const visible = session ? progress : {};

  // The calendar marker is one dot per day, so it needs the two sets combined; the selected-day
  // line below keeps them apart.
  const tallies: Record<string, DayTally> = Object.fromEntries(
    Object.entries(visible).map(([date, p]) => [
      date,
      { done: p.standard.done + p.mini.done, total: p.standard.total + p.mini.total },
    ]),
  );
  // "Standard 2/3 · Minis 1/3" for the day being viewed. A set with no boards that day is left
  // out entirely rather than shown as "0/0" — the denominator is per-date, and early dates (or a
  // future day with more types) need not hold both sets.
  const selectedProgress = visible[selectedDate];
  /** Today is browsable here, but playing it belongs to `/daily` — see the component doc. */
  const isToday = selectedDate === todayIso;
  const selectedSummary = selectedProgress
    ? ([
        ['Standard', selectedProgress.standard],
        ['Minis', selectedProgress.mini],
      ] as const)
        .filter(([, set]) => set.total > 0)
        .map(([label, set]) => `${label} ${set.done}/${set.total}`)
        .join(' · ')
    : '';

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
            <span className="text-xs text-ink-soft">
              {selectedLabel} · {formatUtcDate(playedDate)} · practice
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
            <Calendar
              value={selectedDate}
              onChange={setSelectedDate}
              maxDate={todayIso}
              tallies={tallies}
              onMonthChange={setVisibleMonth}
            />
            <p className="text-center text-sm mt-2 font-medium">{formatUtcDate(selectedDate)}</p>
            {selectedSummary && (
              <p className="text-center text-xs text-ink-soft mt-1 tabular-nums">{selectedSummary}</p>
            )}
          </div>

          {error && <p className="text-cherry text-sm mb-4 text-center">{error}</p>}

          {isToday ? (
            /* Today is browsable (its leaderboard is right there) but must not be STARTED here —
               that is what used to hand out an unranked run of the live board. Hand off to the
               ranked surface, carrying the slot so the player does not pick twice. */
            <Link
              href={`/daily?slot=${encodeURIComponent(difficulty)}`}
              className="btn-primary w-full text-lg flex justify-center items-center mb-6 md:mb-0"
            >
              Play {selectedLabel} on the Daily (ranked)
            </Link>
          ) : (
            <button
              type="button"
              onClick={handlePlay}
              disabled={loading}
              className="btn-primary w-full text-lg flex justify-center items-center mb-6 md:mb-0"
            >
              {loading ? 'Loading…' : `Play ${selectedLabel} (practice)`}
            </button>
          )}
        </div>

        <LeaderboardView
          date={selectedDate}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          onSlotsLoaded={handleSlotsLoaded}
        />
      </div>

      <ConfirmModal
        open={warnOpen}
        title="Start a new puzzle?"
        message="You have a saved puzzle in progress. Playing this archived puzzle will erase it — you can only save one puzzle at a time, and an archived replay is practice, so it will not be ranked."
        confirmLabel="Play it"
        cancelLabel="Keep playing"
        onConfirm={confirmNew}
        onCancel={keepPlaying}
        onDismiss={() => setWarnOpen(false)}
      />
    </div>
  );
}
