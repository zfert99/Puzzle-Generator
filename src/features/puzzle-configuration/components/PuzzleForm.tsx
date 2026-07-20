'use client';

import { useState } from 'react';
import { usePuzzleGeneration } from '../hooks/usePuzzleGeneration';
import { GridSizeSelector } from './GridSizeSelector';
import { DifficultyConfigurator } from './DifficultyConfigurator';

const KILLER_DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'];

export default function PuzzleForm() {
  const [variant, setVariant] = useState<'classic' | 'killer'>('classic');
  const [gridSize, setGridSize] = useState<4 | 6 | 9>(9);
  const [counts, setCounts] = useState({
    easy: 2, medium: 2, hard: 2, expert: 0, extreme: 0
  });

  const { loading, error, generate } = usePuzzleGeneration();
  const isKiller = variant === 'killer';

  const handleGridSizeChange = (size: 4 | 6 | 9) => {
    setGridSize(size);
    if (size !== 9) {
      setCounts(prev => ({ ...prev, expert: 0, extreme: 0 }));
    }
  };

  const handleDifficultyChange = (diff: string, value: number) => {
    setCounts(prev => ({ ...prev, [diff]: value }));
  };

  const handleGenerate = async () => {
    if (isKiller) {
      await generate({ variant: 'killer', easy: counts.easy, medium: counts.medium, hard: counts.hard, expert: counts.expert });
    } else {
      await generate({ ...counts, gridSize });
    }
  };

  return (
    <div className="glass-panel p-8 max-w-md w-full mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">
        {isKiller ? 'Killer Sudoku' : 'Sudoku'} Configuration
      </h2>

      {/* Puzzle type toggle */}
      <div className="flex gap-2 mb-6">
        {(['classic', 'killer'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVariant(v)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 border-ink transition-all ${
              variant === v ? 'bg-butterscotch text-ink' : 'bg-paper hover:bg-paper-2'
            }`}
          >
            {v === 'classic' ? 'Sudoku' : 'Killer'}
          </button>
        ))}
      </div>

      {isKiller ? (
        <p className="text-xs text-ink-soft text-center mb-6">
          9×9 · no givens — the cage sums are the only clue.
        </p>
      ) : (
        <GridSizeSelector value={gridSize} onChange={handleGridSizeChange} />
      )}

      <DifficultyConfigurator
        gridSize={gridSize}
        counts={counts}
        onChange={handleDifficultyChange}
        difficulties={isKiller ? KILLER_DIFFICULTIES : undefined}
      />

      {error && <p className="text-cherry text-sm mb-4 text-center">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="btn-primary w-full text-lg flex justify-center items-center"
      >
        {loading ? (
          <span className="flex items-center space-x-2">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Generating...</span>
          </span>
        ) : (
          'Generate PDF'
        )}
      </button>
    </div>
  );
}
