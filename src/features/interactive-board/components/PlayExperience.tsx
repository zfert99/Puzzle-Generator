'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { GridSizeSelector } from '@/features/puzzle-configuration/components/GridSizeSelector';
import type { Difficulty } from '@/features/engine/sudoku';
import { useBoardStore } from '../store/useBoardStore';
import { usePuzzle } from '../hooks/usePuzzle';
import { Board } from './Board/Board';
import { Numpad } from './Controls/Numpad';
import { GameHeader } from './Header/GameHeader';
import { KeyboardHints } from './KeyboardHints';

const ALL_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'extreme'];

// Hydration-safe "are we on the client yet?" — false during SSR/hydration, true
// afterward — without a setState-in-effect. Gates rendering of persisted store state.
const noopSubscribe = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Client-side orchestrator for `/play`. It owns the config screen, fetches a puzzle
 * via `usePuzzle` (server-side generation — no puzzle computed during SSR), hands it
 * to the store, drives the per-second timer, and shows the solved modal. The `/play`
 * route itself stays a Server Component.
 *
 * A `mounted` guard defers rendering until the client has hydrated the persisted
 * store, so a resumed (localStorage-backed) game never causes an SSR/client mismatch.
 */
export default function PlayExperience() {
  const mounted = useHasMounted();
  const [gridSize, setGridSize] = useState<4 | 6 | 9>(9);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [viewingSolved, setViewingSolved] = useState(false);

  const { loading, error, fetchPuzzle } = usePuzzle();
  const { status } = useBoardStore(useShallow((s) => ({ status: s.status })));
  const startNewGame = useBoardStore((s) => s.startNewGame);
  const configure = useBoardStore((s) => s.configure);
  const tick = useBoardStore((s) => s.tick);

  // Timer: one interval, active only while playing.
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [status, tick]);

  const miniGrid = gridSize !== 9;

  const handleGridSizeChange = (size: 4 | 6 | 9) => {
    setGridSize(size);
    if (size !== 9 && (difficulty === 'expert' || difficulty === 'extreme')) setDifficulty('hard');
  };

  const handlePlay = async () => {
    const puzzle = await fetchPuzzle({ difficulty, gridSize });
    if (puzzle) {
      setViewingSolved(false);
      startNewGame(puzzle);
    }
  };

  const newPuzzle = () => {
    setViewingSolved(false);
    configure();
  };

  // Avoid a hydration mismatch: render a neutral placeholder until mounted.
  if (!mounted) {
    return <div className="glass-panel p-8 max-w-md w-full mx-auto h-48" aria-hidden="true" />;
  }

  // ---- Config screen ----
  if (status === 'configuring') {
    return (
      <div className="glass-panel p-8 max-w-md w-full mx-auto">
        <h2 className="text-2xl font-semibold mb-6 text-center">New Game</h2>

        <GridSizeSelector value={gridSize} onChange={handleGridSizeChange} />

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2 text-center">Difficulty</label>
          <div className="flex flex-wrap justify-center gap-2">
            {ALL_DIFFICULTIES.map((d) => {
              const disabled = miniGrid && (d === 'expert' || d === 'extreme');
              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-2 rounded-lg text-sm capitalize transition-all ${
                    difficulty === d ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/10 hover:bg-white/20'
                  } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {miniGrid && (
            <p className="text-xs text-gray-400 text-center mt-2">Expert and Extreme are only available for 9×9 grids.</p>
          )}
        </div>

        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        <button
          type="button"
          onClick={handlePlay}
          disabled={loading}
          className="btn-primary w-full text-lg flex justify-center items-center"
        >
          {loading ? 'Generating…' : 'Play'}
        </button>
      </div>
    );
  }

  // ---- Game ----
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-[520px] mx-auto mb-2">
        <button
          type="button"
          onClick={newPuzzle}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:underline"
        >
          ← New game
        </button>
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

      {status === 'solved' && !viewingSolved && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="solved-title"
        >
          <div className="celebrate rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-gray-900 p-8 max-w-sm w-full text-center shadow-2xl">
            <p className="text-5xl mb-2" aria-hidden="true">
              <span className="celebrate-emoji">🎉</span>
            </p>
            <h2 id="solved-title" className="text-2xl font-bold text-green-500 mb-2">
              Solved!
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {formatTime(useBoardStore.getState().elapsedTime)} · {useBoardStore.getState().mistakes}{' '}
              mistake{useBoardStore.getState().mistakes === 1 ? '' : 's'}
            </p>
            <div className="flex gap-3 justify-center">
              <button type="button" onClick={newPuzzle} className="btn-primary">
                New puzzle
              </button>
              <button
                type="button"
                onClick={() => setViewingSolved(true)}
                className="px-5 py-3 rounded-lg border border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
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
