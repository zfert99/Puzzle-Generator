'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '@/features/interactive-board/store/useBoardStore';
import { useSavedGame } from '@/features/interactive-board/store/useSavedGame';
import { useBoardSlot } from '@/features/interactive-board/store/saved-slots';
import { SavedElapsed } from '@/features/interactive-board/components/SavedElapsed';
import { useGameClock } from '@/features/interactive-board/hooks/useGameClock';
import { useBoardReview } from '@/features/interactive-board/hooks/useBoardReview';
import { ReviewDialog } from '@/features/interactive-board/components/ReviewDialog';
import { Board } from '@/features/interactive-board/components/Board/Board';
import { Numpad } from '@/features/interactive-board/components/Controls/Numpad';
import { GameHeader } from '@/features/interactive-board/components/Header/GameHeader';
import { KeyboardHints } from '@/features/interactive-board/components/KeyboardHints';
import { ConfirmModal } from '@/features/interactive-board/components/ConfirmModal';
import { SolvedDialog } from '@/features/interactive-board/components/SolvedDialog';
import { UsernamePrompt } from '@/features/auth/components/UsernamePrompt';
import { Sticker } from '@/features/chaos/Sticker';
import { Tape } from '@/features/chaos/Tape';
import { MarqueeTicker } from '@/features/chaos/MarqueeTicker';
import { useSession } from '@/features/auth/auth-client';
import { apiPath } from '@/lib/base-path';
import { difficultyForKey, formatDailyKey, isDailyVariant, sectionForKey, toUtcDateString, type DailyDifficulty } from '@/lib/db/daily-row';
import { slotLabel, type DailySlotInfo } from '../slot-display';
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
  // This surface owns the daily slot (shared with archive replays, which are daily-shaped): the
  // store holds it from the first client render, so a parked free-play game never shows up here.
  useBoardSlot('daily');
  const searchParams = useSearchParams();
  const mounted = useHasMounted();
  const { data: session } = useSession();
  const [phase, setPhase] = useState<'select' | 'playing'>('select');
  const [difficulty, setDifficulty] = useState<DailyDifficulty>('easy');
  /**
   * `/archive` hands today's board off as `/daily?slot=<key>` so the player does not pick the same
   * board twice. Applied inside the slots effect below rather than seeded into state here: that is
   * the only place the key can be checked against the boards today actually rolled, so an
   * unvalidated value never enters state at all. Seeding directly looked equivalent but was not —
   * the reconciliation is behind `if (!d?.slots?.length) return;`, so a failed or empty slots fetch
   * would have left a garbage key sitting in state.
   */
  const wantedSlot = searchParams.get('slot');
  const [dailyDate, setDailyDate] = useState<string>('');
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' });
  const [warnOpen, setWarnOpen] = useState(false);
  const [resumeHandled, setResumeHandled] = useState(false);
  const wantsResume = searchParams.get('resume') === '1';
  const [pendingDifficulty, setPendingDifficulty] = useState<DailyDifficulty | null>(null);
  const [completedToday, setCompletedToday] = useState<
    Record<string, { timeMs: number; rank: number | null }>
  >({});
  const [slots, setSlots] = useState<DailySlotInfo[]>([]);
  /**
   * How the slots fetch settled. `loading` → `ready` (boards), `empty` (the day has none yet —
   * the roller has been late before) or `failed` (network / non-2xx). The failure used to be
   * swallowed, leaving a picker with no boards that still offered "Play Easy" for a board that
   * might not exist; now each outcome is told, and a failure can be retried.
   */
  const [slotsState, setSlotsState] = useState<'loading' | 'ready' | 'empty' | 'failed'>('loading');
  const [slotsAttempt, setSlotsAttempt] = useState(0);
  const submittedRef = useRef(false);

  const { loading, error, fetchDaily } = useDaily();
  // `variant`/`gridSize` describe the board actually loaded. They are read here so the playing
  // header can label the board in front of the player rather than looking its key up in TODAY's
  // slots — see `playingLabel` below.
  const { status, errorsRevealed, boardVariant, boardGridSize } = useBoardStore(
    useShallow((s) => ({
      status: s.status,
      errorsRevealed: s.errorsRevealed,
      boardVariant: s.variant,
      boardGridSize: s.gridSize,
    })),
  );
  const startNewGame = useBoardStore((s) => s.startNewGame);
  const resume = useBoardStore((s) => s.resume);
  const revealErrors = useBoardStore((s) => s.revealErrors);

  const saved = useSavedGame();
  const savedIsDaily = saved?.mode === 'daily';
  // `mode: 'daily'` means "a daily-shaped board" (no live error feedback), NOT "today's ranked
  // board". Archive replays and dailies left running across the UTC rollover both land here with
  // an older `dailyDate`, and only the date can tell them apart — see the picker copy below.
  const savedIsFromAnotherDay = Boolean(saved?.dailyDate && saved.dailyDate !== toUtcDateString(new Date()));

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

  // Dailies give no live error feedback, so completion is checked on FULLNESS, not correctness
  // (`useBoardReview`): when every editable cell is filled, either it's solved (the "you won"
  // modal) or the review dialog tells the player how many cells are wrong (without which).
  const { showReview, wrongCount, dismissReview } = useBoardReview(phase === 'playing');

  // Timer: active only while actively playing the daily (not on the picker), and only while the
  // tab is visible (see `useGameClock`).
  useGameClock(phase === 'playing' && status === 'playing');

  // Today's boards (type-as-slot: the type is rolled per day and stored, so the client must fetch
  // which type each slot holds today). Seeds the selected difficulty to the first real slot.
  useEffect(() => {
    let active = true;
    fetch(apiPath('/api/daily/slots'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`slots responded ${r.status}`))))
      .then((d) => {
        if (!active) return;
        if (!d?.slots?.length) {
          setSlotsState('empty');
          return;
        }
        setSlotsState('ready');
        setSlots(d.slots);
        const rolled = (key: string | null) => Boolean(key) && d.slots.some((s: DailySlotInfo) => s.key === key);
        // Precedence: an explicit, VALID `?slot=` wins; else keep the current key if today rolled
        // it; else fall back to the first real board. A stale, retired or garbage `slot` therefore
        // never survives — it is simply not preferred.
        setDifficulty((cur) => (rolled(wantedSlot) ? (wantedSlot as DailyDifficulty) : rolled(cur) ? cur : d.slots[0].key));
      })
      .catch(() => {
        if (active) setSlotsState('failed');
      });
    return () => {
      active = false;
    };
  // `wantedSlot` is a real dependency: a client-side nav that changes `?slot=` should re-apply
  // it. Refetching the day's slots alongside is cheap and keeps the two in step. `slotsAttempt`
  // is the Retry button.
  }, [wantedSlot, slotsAttempt]);

  // Which of today's dailies this user has already completed (one attempt per day).
  useEffect(() => {
    if (!session) return;
    let active = true;
    fetch(apiPath('/api/me/today'))
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
    fetch(apiPath('/api/solve'), {
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
    fetch(apiPath('/api/daily/start'), {
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

  // "Keep playing" — resume the parked daily (the only game this slot can hold).
  const keepPlaying = () => {
    dismissWarn();
    if (saved) handleContinue();
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

  // Label for the currently-selected board — the composed "Difficulty · Type" when today's slots
  // are loaded, falling back to the bare key label (e.g. resuming before the fetch resolves).
  // Correct for the PICKER, which only ever offers today's boards.
  const selectedSlot = slots.find((s) => s.key === difficulty);
  const selectedLabel = selectedSlot ? slotLabel(selectedSlot) : formatDailyKey(difficulty);

  /**
   * Label for the board being PLAYED, composed from the board itself rather than from today's
   * slots.
   *
   * These differ whenever `dailyDate` isn't today — an archive replay, or a daily left running
   * across the UTC rollover. A slot key is not an identity: `hard` holds a different *type* each
   * day, so looking the key up in today's list labelled a 3 August **Killer** board as
   * "Hard · Keisan" simply because that is what `hard` happens to be today. The board's own
   * `variant`/`gridSize` cannot drift like that. `difficultyForKey` strips any `mini-` prefix, and
   * `sectionForKey` files the board — by key, with size only for retired keys, since a 6×6 can be a
   * standard (Skyscrapers, D5) — the same rule `/api/daily/slots` uses.
   */
  // The board store can hold any `PuzzleVariant`, but a DAILY game is only ever started from a
  // daily row, so its variant is always a registered daily `Variant`. Kakuro is playable on
  // `/play` before it joins the daily registry (Kakuro plan slice R1), hence the runtime guard
  // — an unregistered variant here is a routing bug, and falling back to the key's own label
  // keeps it visible rather than inventing a type.
  const playingLabel = isDailyVariant(boardVariant)
    ? slotLabel({
        key: difficulty,
        variant: boardVariant,
    difficulty: difficultyForKey(difficulty),
        gridSize: boardGridSize,
        section: sectionForKey(difficulty, boardGridSize),
      })
    : formatDailyKey(difficulty);

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
            One puzzle per type, difficulty rolls daily · resets at 00:00 UTC
            {!session && ' · sign in to be ranked'}
          </p>

          {savedIsDaily && saved && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handleContinue}
                className="btn-primary w-full text-lg flex justify-center items-center"
              >
                Continue {formatDailyKey(saved.difficulty)} · <SavedElapsed />
              </button>
              {/*
                This button sits under "Today's Daily", but the parked board is only today's when
                its `dailyDate` says so — an archive replay and a daily left running across the UTC
                rollover are both stored as `mode: 'daily'` with an older date. Saying which day it
                is stops the picker implying that resuming it counts for today; it does not (the
                submit is dropped for any non-today board).
              */}
              <p className="text-xs text-ink-soft text-center mt-3">
                {savedIsFromAnotherDay
                  ? `— that's practice from ${formatUtcDate(saved.dailyDate!)}, not today's board —`
                  : '— or start a new one —'}
              </p>
            </div>
          )}

          {(
            [
              ['standard', 'Standard'],
              ['mini', 'Minis'],
            ] as const
          )
            .filter(([section]) => slots.some((s) => s.section === section))
            .map(([section, heading]) => (
            <div key={section} className="mb-4">
              {/* A span + aria-labelledby, not a <label> (which labelled nothing), and aria-pressed
                  so the selection is announced rather than carried by colour alone (QA F10). */}
              <span id={`daily-section-${section}`} className="block text-sm font-medium text-ink-soft mb-2 text-center">{heading}</span>
              <div role="group" aria-labelledby={`daily-section-${section}`} className="flex flex-wrap justify-center gap-2">
                {slots.filter((s) => s.section === section).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={difficulty === s.key}
                    onClick={() => setDifficulty(s.key)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      difficulty === s.key
                        ? 'bg-butterscotch text-on-butterscotch border-2 border-ink'
                        : 'bg-paper border-2 border-ink hover:bg-paper-2'
                    }`}
                  >
                    {slotLabel(s)}
                    {completedToday[s.key] && (
                      <>
                        <span className="ml-1 text-mint-text" aria-hidden="true">✓</span>
                        <span className="sr-only"> (solved)</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {error && <p role="alert" className="text-cherry text-sm mb-4 text-center">{error}</p>}

          {slotsState === 'failed' ? (
            <p role="alert" className="text-center text-sm text-ink-soft">
              Couldn&apos;t load today&apos;s boards.{' '}
              <button type="button" onClick={() => { setSlotsState('loading'); setSlotsAttempt((n) => n + 1); }} className="text-grape underline">
                Retry
              </button>
            </p>
          ) : slotsState === 'empty' ? (
            <p className="text-center text-sm text-ink-soft">
              Today&apos;s boards aren&apos;t available right now — check back shortly.
            </p>
          ) : completedToday[difficulty] ? (
            <div className="text-center">
              <p className="text-mint-text font-semibold mb-1">
                ✓ Solved in {formatTime(Math.round(completedToday[difficulty].timeMs / 1000))}
                {completedToday[difficulty].rank ? ` · ranked #${completedToday[difficulty].rank}` : ''}
              </p>
              <p className="text-xs text-ink-soft mb-4">
                One attempt per day — new puzzle at 00:00 UTC. Try another difficulty, or:
              </p>
              <Link href={`/leaderboard?difficulty=${difficulty}`} className="btn-primary w-full inline-flex justify-center">
                View leaderboard
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handlePlay(difficulty)}
              disabled={loading || slotsState === 'loading'}
              className="btn-primary w-full text-lg flex justify-center items-center"
            >
              {loading || slotsState === 'loading' ? 'Loading…' : `Play ${selectedLabel}`}
            </button>
          )}
        </div>

        <ConfirmModal
          open={warnOpen}
          title="Start a new puzzle?"
          message="You have a saved daily (or practice) board in progress. Starting a new one will erase it — one saved puzzle per mode (your free-play game is kept separately)."
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
          <span className="text-xs text-ink-soft">
            {playingLabel} · {formatUtcDate(dailyDate)}
            {isExpiredDaily && ' · practice'}
          </span>
        )}
      </div>

      <GameHeader />

      {status === 'paused' ? (
        <div className="w-[var(--board-width)] aspect-square flex items-center justify-center rounded-lg bg-paper text-ink-soft">
          Paused
        </div>
      ) : (
        <Board />
      )}

      <Numpad showHint={false} />

      <KeyboardHints />

      {status === 'solved' && (
        <SolvedDialog
          ariaLabel="Daily solved"
          stampLabel="Daily solved!"
          elapsedSeconds={useBoardStore.getState().elapsedTime}
          mistakes={useBoardStore.getState().mistakes}
          primaryLabel="Back to difficulties"
          onPrimary={backToSelect}
          secondaryAction={
            <Link
              href={`/leaderboard?difficulty=${difficulty}`}
              className="px-5 py-3 rounded-lg border border-ink hover:bg-paper-2 transition-colors"
            >
              Leaderboard
            </Link>
          }
        >
          {/* Ranked-flow result — derived from session + submit (no synchronous setState). A
              status region: it changes from "Submitting…" to "Ranked #N" after focus has landed
              on the dialog, and nothing re-reads it otherwise (WCAG 4.1.3). */}
          <div role="status" className="min-h-[1.5rem] text-sm">
            {isExpiredDaily ? (
              <span className="text-warn-text">This daily has expired — play today’s for a rank.</span>
            ) : !session ? (
              <span className="text-ink-soft">
                <Link href="/signin" className="text-grape underline">
                  Sign in
                </Link>{' '}
                to be ranked on the leaderboard.
              </span>
            ) : submit.status === 'done' ? (
              <span className="rank-reveal text-grape font-semibold">
                {submit.rank ? `🏆 Ranked #${submit.rank} today` : 'Time recorded!'}
              </span>
            ) : submit.status === 'error' ? (
              <span className="text-warn-text">{submit.message}</span>
            ) : (
              <span className="text-ink-soft">Submitting your time…</span>
            )}
          </div>
        </SolvedDialog>
      )}

      {/* Board full but not correct — the shared review dialog (see `ReviewDialog`): how many
          cells are wrong (not which), and an opt-in to highlighting for the rest of this attempt. */}
      <ReviewDialog
        open={showReview}
        wrongCount={wrongCount}
        errorsRevealed={errorsRevealed}
        onKeepLooking={dismissReview}
        onReveal={() => {
          revealErrors();
          dismissReview();
        }}
      />
    </div>
  );
}
