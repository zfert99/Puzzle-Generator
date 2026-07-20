'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GridSizeSelector } from '@/features/puzzle-configuration/components/GridSizeSelector';
import type { Difficulty } from '@/features/engine/sudoku';
import { useBoardStore } from '../store/useBoardStore';
import { useSavedGame, formatElapsed } from '../store/useSavedGame';
import { usePuzzle } from '../hooks/usePuzzle';
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

export default function PlayExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useHasMounted();
  const [variant, setVariant] = useState<'classic' | 'killer'>('classic');
  const [gridSize, setGridSize] = useState<4 | 6 | 9>(9);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

  // Deep link from the hub's Killer card (`/play?variant=killer`): preselect the variant.
  // Runs before first paint is visible (the component renders a placeholder until mounted).
  useEffect(() => {
    if (searchParams.get('variant') === 'killer') {
      setVariant('killer');
      setGridSize(9); // Killer is 9×9 only
      setDifficulty((d) => (d === 'expert' || d === 'extreme' ? 'hard' : d));
    }
  }, [searchParams]);
  const [view, setView] = useState<'config' | 'playing'>('config');
  const [viewingSolved, setViewingSolved] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const isKiller = variant === 'killer';

  const { loading, error, fetchPuzzle } = usePuzzle();
  const status = useBoardStore((s) => s.status);
  const startNewGame = useBoardStore((s) => s.startNewGame);
  const resume = useBoardStore((s) => s.resume);
  const tick = useBoardStore((s) => s.tick);

  const saved = useSavedGame();
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

  const handleVariantChange = (v: 'classic' | 'killer') => {
    setVariant(v);
    if (v === 'killer' && gridSize === 4) setGridSize(9); // Killer comes in 6×6 and 9×9
    if (v === 'killer' && gridSize === 6 && (difficulty === 'expert' || difficulty === 'extreme')) {
      setDifficulty('hard'); // 6×6 Killer is easy/medium/hard only
    }
  };

  const handleKillerSizeChange = (size: 6 | 9) => {
    setGridSize(size);
    if (size === 6 && (difficulty === 'expert' || difficulty === 'extreme')) setDifficulty('hard');
  };

  const startFresh = async () => {
    const puzzle = await fetchPuzzle({ difficulty, gridSize, variant });
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
              Continue {saved.variant === 'killer' ? 'Killer' : `${saved.gridSize}×${saved.gridSize}`}{' '}
              {saved.difficulty} · {formatElapsed(saved.elapsedTime)}
            </button>
            <p className="text-xs text-ink-soft text-center mt-3">— or start a new game —</p>
          </div>
        )}

        {/* Puzzle type toggle */}
        <div className="flex gap-2 mb-6">
          {(['classic', 'killer'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => handleVariantChange(v)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 border-ink transition-all ${
                variant === v ? 'bg-butterscotch text-ink' : 'bg-paper hover:bg-paper-2'
              }`}
            >
              {v === 'classic' ? 'Sudoku' : 'Killer'}
            </button>
          ))}
        </div>

        {isKiller ? (
          <>
            <div className="flex gap-2 mb-3 justify-center">
              {([6, 9] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleKillerSizeChange(size)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border-2 border-ink transition-all ${
                    gridSize === size ? 'bg-butterscotch text-ink' : 'bg-paper hover:bg-paper-2'
                  }`}
                >
                  {size}×{size}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-soft text-center mb-6">
              No givens — the cage sums are the only clue.
              {gridSize === 6 && ' 6×6 is the friendly way in: digits 1–6, Rule of 21.'}
              {difficulty === 'extreme' && gridSize === 9 && ' Extreme puzzles are rare finds — generating one can take ~10 seconds.'}
            </p>
          </>
        ) : (
          <GridSizeSelector value={gridSize} onChange={handleGridSizeChange} />
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-ink-soft mb-2 text-center">Difficulty</label>
          <div className="flex flex-wrap justify-center gap-2">
            {(isKiller ? (gridSize === 6 ? KILLER_DIFFICULTIES.slice(0, 3) : KILLER_DIFFICULTIES) : ALL_DIFFICULTIES).map((d) => {
              const disabled = !isKiller && miniGrid && (d === 'expert' || d === 'extreme');
              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
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
          {!isKiller && miniGrid && (
            <p className="text-xs text-ink-soft text-center mt-2">Expert and Extreme are only available for 9×9 grids.</p>
          )}
        </div>

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
              <button type="button" onClick={() => setView('config')} className="btn-primary">
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
