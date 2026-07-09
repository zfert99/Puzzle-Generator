import React from 'react';

const DIFFICULTIES_BY_SIZE: Record<number, string[]> = {
  4: ['easy', 'medium', 'hard'],
  6: ['easy', 'medium', 'hard'],
  9: ['easy', 'medium', 'hard', 'expert', 'extreme'],
};

interface Props {
  gridSize: 4 | 6 | 9;
  counts: Record<string, number>;
  onChange: (difficulty: string, value: number) => void;
}

export function DifficultyConfigurator({ gridSize, counts, onChange }: Props) {
  const availableDifficulties = DIFFICULTIES_BY_SIZE[gridSize];

  return (
    <div className="space-y-4 mb-8">
      {(['easy', 'medium', 'hard', 'expert', 'extreme'] as const).map(diff => {
        const isDisabled = !availableDifficulties.includes(diff);
        return (
          <div key={diff} className={`flex items-center justify-between ${isDisabled ? 'opacity-40' : ''}`}>
            <label className="capitalize font-medium text-lg w-1/3">
              {diff}
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={isDisabled ? 0 : counts[diff]}
              onChange={(e) => onChange(diff, parseInt(e.target.value) || 0)}
              disabled={isDisabled}
              className="input-field w-2/3 ml-4"
              placeholder="0"
            />
          </div>
        );
      })}
      <p className="text-sm text-gray-400 text-center mt-2">You can generate 1–50 puzzles total per request.</p>
      {gridSize !== 9 && (
        <p className="text-sm text-gray-400 text-center">
          Expert and Extreme are only available for 9×9 grids.
        </p>
      )}
      {counts.extreme > 0 && (
        <p className="text-red-500 text-sm font-medium mt-2 text-center px-4">
          Warning: Extreme puzzles require elite-tier strategies (W-Wing, ALS, AICs) and may take up to 5 seconds per puzzle to generate.
        </p>
      )}
    </div>
  );
}
