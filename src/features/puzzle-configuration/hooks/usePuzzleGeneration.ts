import { useState } from 'react';

interface GenerationConfig {
  variant?: 'classic' | 'killer';
  gridSize?: number;
  easy: number;
  medium: number;
  hard: number;
  expert?: number;
  extreme?: number;
}

export function usePuzzleGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async (config: GenerationConfig) => {
    setError('');
    const total =
      config.easy + config.medium + config.hard + (config.expert ?? 0) + (config.extreme ?? 0);
    if (total === 0) {
      setError('Please select at least one puzzle to generate.');
      return false;
    }
    if (total > 50) {
      setError('Too many puzzles. Maximum is 50 per request.');
      return false;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.variant === 'killer' ? 'Killer_Sudoku.pdf' : 'Sudoku_Puzzles.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return true;
    } catch (err: unknown) {
      setError((err as Error).message || 'An unexpected error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, generate };
}
