'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GridSizeSelector } from '@/features/puzzle-configuration/components/GridSizeSelector';
import type { Difficulty } from '@/features/engine/sudoku';
import { useBoardStore } from '../store/useBoardStore';
import { useSavedGame, formatElapsed } from '../store/useSavedGame';
import { usePuzzle } from '../hooks/usePuzzle';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { Board } from './Board/Board';
import { Numpad } from './Controls/Numpad';
import { GameHeader } from './Header/GameHeader';
import { KeyboardHints } from './KeyboardHints';
import { SolvedStamp } from '@/features/juice/SolvedStamp';
import { ConfirmModal } from './ConfirmModal';

const ALL_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'extreme'];

// Hydration-safe "are we on the client yet?" — false during SSR/hydration, true
// afterward — without a setState-in-effect. Gates rendering of persisted store state.
const noopSubscribe = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * Client-side orchestrator for `/play`. Menu-first: it always opens on the config screen,
 * which offers a **Continue** button when a saved free-play game exists (the board store
 * persists one game to localStorage) and warns before a new game erases it. A local `view`
 * ('config' | 'playing') drives which screen shows — decoupled from store `status`, so the
 * menu can display while an unsolved game is still parked in the store.
 *
 * The timer ticks only while actively on the board (`view === 'playing'`), so stepping back
 * to the menu — or leaving the page — freezes it, and Continue resumes from where it stopped.
 */
const KILLER_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'extreme'];
const CALC_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'extreme']; // expert/extreme are 9×9-only (gated below)

type PlayVariant = 'classic' | 'killer' | 'calc';

export default function PlayExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useHasMounted();
  // Deep link from a hub card (`/play?variant=killer|calc`): preselect the variant as the initial
  // state (not via a setState-in-effect). Keisan (`calc`) comes in 4/6/9; it seeds 6 (the friendly
  // mid size) rather than the classic default of 9.
  const initialVariant: PlayVariant =
    searchParams.get('variant') === 'killer' ? 'killer' : searchParams.get('variant') === 'calc' ? 'calc' : 'classic';
  const [variant, setVariant] = useState<PlayVariant>(initialVariant);
  const [gridSize, setGridSize] = useState<4 | 6 | 9>(initialVariant === 'calc' ? 6 : 9);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [mystery, setMystery] = useState(false); // Keisan Mystery (no-op) toggle — hide operators
  const [view, setView] = useState<'config' | 'playing'>('config');
  const [viewingSolved, setViewingSolved] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [resumeHandled, setResumeHandled] = useState(false);
  const isKiller = variant === 'killer';
  const isCalc = variant === 'calc';
  const wantsResume = searchParams.get('resume') === '1';

  const { loading, error, fetchPuzzle } = usePuzzle();
  const status = useBoardStore((s) => s.status);
  const startNewGame = useBoardStore((s) => s.startNewGame);
  const resume = useBoardStore((s) => s.resume);
  const tick = useBoardStore((s) => s.tick);

  const saved = useSavedGame();

  // F7: the solved dialog must take focus when it appears — without this the active element
  // stays on a gridcell behind the backdrop and keyboard/screen-reader users are never told.
  const solvedPrimaryRef = useDialogFocus<HTMLButtonElement>(status === 'solved' && !viewingSolved);

  // Deep link from the hub's Continue banner (`/play?resume=1`): jump straight into the saved
  // free-play game instead of the menu. Adjust state during render (once, after mount, when the
  // persisted game is readable) — the sanctioned prev-value pattern, not a setState-in-effect.
  // Only honor it for a play-mode game so a daily in the shared store never opens here.
  if (mounted && wantsResume && !resumeHandled) {
    setResumeHandled(true);
    if (saved?.mode === 'play') setView('playing');
  }
  // Unpause the resumed game (store action, not React state).
  useEffect(() => {
    if (view === 'playing' && wantsResume && useBoardStore.getState().status === 'paused') resume();
  }, [view, wantsResume, resume]);
  const savedIsPlay = saved?.mode === 'play';

  // Timer: active only while actively playing on the board — never on the menu or when paused.
  useEffect(() => {
    if (view !== 'playing' || status !== 'playing') return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [view, status, tick]);

  const miniGrid = gridSize !== 9;

  const handleGridSizeChange = (size: 4 | 6 | 9) => {
    setGridSize(size);
    if (size !== 9 && (difficulty === 'expert' || difficulty === 'extreme')) setDifficulty('hard');
  };

  const handleVariantChange = (v: PlayVariant) => {
    setVariant(v);
    if (v === 'killer' && gridSize === 4) setGridSize(9); // Killer comes in 6×6 and 9×9
    // Keisan comes in 4×4 / 6×6 / 9×9 — every size is valid, so no size clamp on switch. Expert and
    // Extreme are 9×9-only for EVERY variant, so the guard is uniform: clamp them off any non-9 grid.
    if (gridSize !== 9 && (difficulty === 'expert' || difficulty === 'extreme')) setDifficulty('hard');
  };

  const startFresh = async () => {
    const puzzle = await fetchPuzzle({ difficulty, gridSize, variant, noOp: isCalc && mystery });
    if (puzzle) {
      setViewingSolved(false);
      startNewGame(puzzle); // mode defaults to 'play'; variant/cages come from the puzzle
      setView('playing');
    }
  };

  // New game erases the single saved slot (play OR daily) — warn first if one exists.
  const handlePlay = () => {
    if (saved) setWarnOpen(true);
    else void startFresh();
  };

  const confirmNew = () => {
    setWarnOpen(false);
    void startFresh();
  };

  const handleContinue = () => {
    if (status === 'paused') resume();
    setViewingSolved(false);
    setView('playing');
  };

  // "Keep playing" — take the player to their saved game: resume it here if it's a free-play
  // game, otherwise go to the surface that owns it (a saved daily lives on /daily).
  const keepPlaying = () => {
    setWarnOpen(false);
    if (saved?.mode === 'play') handleContinue();
    else if (saved) router.push('/daily');
  };

  // Avoid a hydration mismatch: render a neutral placeholder until mounted.
  if (!mounted) {
    return <div className="glass-panel p-8 max-w-md w-full mx-auto h-48" aria-hidden="true" />;
  }

  // ---- Config / menu screen ----
  if (view !== 'playing') {
    return (
      <div className="glass-panel p-8 max-w-md w-full mx-auto">
        <h2 className="text-2xl font-semibold mb-6 text-center">New Game</h2>

        {savedIsPlay && saved && (
          <div className="mb-6">
            <button
              type="button"
              onClick={handleContinue}
              className="btn-primary w-full text-lg flex justify-center items-center"
            >
              Continue{' '}
              {saved.variant === 'killer'
                ? 'Killer'
                : saved.variant === 'calc'
                  ? 'Keisan'
                  : `${saved.gridSize}×${saved.gridSize}`}{' '}
              {saved.difficulty} · {formatElapsed(saved.elapsedTime)}
            </button>
            <p className="text-xs text-ink-soft text-center mt-3">— or start a new game —</p>
          </div>
        )}

        {/* Puzzle type toggle. role=group + aria-pressed (QA F10): selection must be announced,
            not carried by background colour alone. */}
        <div role="group" aria-label="Puzzle type" className="flex gap-2 mb-6">
          {(['classic', 'killer', 'calc'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={variant === v}
              onClick={() => handleVariantChange(v)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 border-ink transition-all ${
                variant === v ? 'bg-butterscotch text-ink' : 'bg-paper hover:bg-paper-2'
              }`}
            >
              {v === 'classic' ? 'Sudoku' : v === 'killer' ? 'Killer' : 'Keisan'}
            </button>
          ))}
        </div>

        {/* One selector, per-variant size list: Killer is 6/9, Keisan (Calcudoku) is 4/6/9. */}
        <GridSizeSelector
          value={gridSize}
          onChange={handleGridSizeChange}
          sizes={isKiller ? [6, 9] : isCalc ? [4, 6, 9] : undefined}
        />

        <div className="mb-6">
          {/* Span + aria-labelledby + aria-pressed (QA F10) — same reasoning as GridSizeSelector. */}
          <span id="play-difficulty-label" className="block text-sm font-medium text-ink-soft mb-2 text-center">
            Difficulty
          </span>
          <div role="group" aria-labelledby="play-difficulty-label" className="flex flex-wrap justify-center gap-2">
            {(isCalc ? CALC_DIFFICULTIES : isKiller ? KILLER_DIFFICULTIES : ALL_DIFFICULTIES).map((d) => {
              const disabled = miniGrid && (d === 'expert' || d === 'extreme');
              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  aria-pressed={difficulty === d}
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-2 rounded-lg text-sm capitalize transition-all ${
                    difficulty === d ? 'bg-butterscotch text-ink border-2 border-ink' : 'bg-paper border-2 border-ink hover:bg-paper-2'
                  } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {miniGrid && (
            <p className="text-xs text-ink-soft text-center mt-2">Expert and Extreme are only available for 9×9 grids.</p>
          )}
          {isKiller && difficulty === 'extreme' && (
            <p className="text-xs text-ink-soft text-center mt-2">Extreme Killers are rare finds — generating one can take ~10 seconds.</p>
          )}
          {isCalc && difficulty === 'extreme' && (
            <p className="text-xs text-ink-soft text-center mt-2">Extreme Keisan needs many hypothesis steps — generating one can take a few seconds.</p>
          )}
        </div>

        {/* Mystery / No-Op toggle — Keisan only. Hides the cage operators; an orthogonal modifier over
            any size/difficulty (the operator becomes part of the puzzle). */}
        {isCalc && (
          <div className="mb-6">
            <button
              type="button"
              role="switch"
              aria-checked={mystery}
              onClick={() => setMystery((m) => !m)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border-2 border-ink transition-all ${
                mystery ? 'bg-butterscotch text-ink' : 'bg-paper hover:bg-paper-2'
              }`}
            >
              <span className="text-sm font-medium">🔮 Mystery mode</span>
              <span className={`text-xs px-2 py-0.5 rounded ${mystery ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-soft'}`}>
                {mystery ? 'ON' : 'OFF'}
              </span>
            </button>
            <p className="text-xs text-ink-soft text-center mt-2">
              Operators are hidden — deduce whether each cage is + − × ÷ as well as its digits.
            </p>
          </div>
        )}

        {error && <p className="text-cherry text-sm mb-4 text-center">{error}</p>}

        <button
          type="button"
          onClick={handlePlay}
          disabled={loading}
          className="btn-primary w-full text-lg flex justify-center items-center"
        >
          {loading ? 'Generating…' : 'Play'}
        </button>

        <ConfirmModal
          open={warnOpen}
          title="Start a new puzzle?"
          message="You have a saved puzzle in progress. Starting a new one will erase it — you can only save one puzzle at a time."
          confirmLabel="Start new"
          cancelLabel="Keep playing"
          onConfirm={confirmNew}
          onCancel={keepPlaying}
          onDismiss={() => setWarnOpen(false)}
        />
      </div>
    );
  }

  // ---- Game ----
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-[520px] mx-auto mb-2">
        <button
          type="button"
          onClick={() => setView('config')}
          className="text-sm text-ink-soft hover:text-ink hover:underline"
        >
          ← Menu
        </button>
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

      {status === 'solved' && !viewingSolved && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Solved"
        >
          <div className="rounded-2xl border-[3px] border-ink bg-paper-2 p-8 max-w-sm w-full text-center shadow-chunky">
            <SolvedStamp label="Solved!" />
            <p className="text-sm text-ink-soft mb-6">
              {formatElapsed(useBoardStore.getState().elapsedTime)} · {useBoardStore.getState().mistakes}{' '}
              mistake{useBoardStore.getState().mistakes === 1 ? '' : 's'}
            </p>
            <div className="flex gap-3 justify-center">
              <button ref={solvedPrimaryRef} type="button" onClick={() => setView('config')} className="btn-primary">
                New puzzle
              </button>
              <button
                type="button"
                onClick={() => setViewingSolved(true)}
                className="px-5 py-3 rounded-lg border border-ink hover:bg-paper-2 transition-colors"
              >
                View puzzle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
