'use client';

import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { GridSizeSelector } from '@/features/puzzle-configuration/components/GridSizeSelector';
import type { Difficulty } from '@/features/engine/sudoku';
import { useBoardStore } from '../store/useBoardStore';
import { usePuzzle } from '../hooks/usePuzzle';
import { Board } from './Board/Board';
import { Numpad } from './Controls/Numpad';
import { GameHeader } from './Header/GameHeader';

const ALL_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'extreme'];

/**
 * Client-side orchestrator for `/play`. It owns the config screen, fetches a puzzle
 * via `usePuzzle` (server-side generation — no puzzle is computed during SSR, so no
 * hydration mismatch), hands it to the store, and drives the per-second timer while
 * the game is playing. The `/play` route itself stays a Server Component.
 */
export default function PlayExperience() {
  const [gridSize, setGridSize] = useState<4 | 6 | 9>(9);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

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
    if (puzzle) startNewGame(puzzle);
  };

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
          onClick={() => configure()}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:underline"
        >
          ← New game
        </button>
      </div>

      <GameHeader difficulty={difficulty} />

      {status === 'paused' ? (
        <div className="w-[min(92vw,520px)] aspect-square flex items-center justify-center rounded-lg bg-white/5 text-gray-400">
          Paused
        </div>
      ) : (
        <Board />
      )}

      <Numpad />

      {status === 'solved' && (
        <div role="status" className="celebrate mt-6 text-center">
          <p className="text-5xl mb-2" aria-hidden="true">
            <span className="celebrate-emoji">🎉</span>
          </p>
          <p className="text-2xl font-bold text-green-500 mb-3">Solved!</p>
          <button type="button" onClick={() => configure()} className="btn-primary">
            New Puzzle
          </button>
        </div>
      )}
    </div>
  );
}
