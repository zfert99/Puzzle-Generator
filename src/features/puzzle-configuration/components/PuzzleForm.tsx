'use client';

import { useState } from 'react';
import { usePuzzleGeneration } from '../hooks/usePuzzleGeneration';
import { GridSizeSelector } from './GridSizeSelector';
import { DifficultyConfigurator } from './DifficultyConfigurator';

export default function PuzzleForm() {
  const [gridSize, setGridSize] = useState<4 | 6 | 9>(9);
  const [counts, setCounts] = useState({
    easy: 2, medium: 2, hard: 2, expert: 0, extreme: 0
  });

  const { loading, error, generate } = usePuzzleGeneration();

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
    await generate({ ...counts, gridSize });
  };

  return (
    <div className="glass-panel p-8 max-w-md w-full mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">Sudoku Configuration</h2>

      <GridSizeSelector value={gridSize} onChange={handleGridSizeChange} />
      
      <DifficultyConfigurator 
        gridSize={gridSize} 
        counts={counts} 
        onChange={handleDifficultyChange} 
      />

      {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

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
