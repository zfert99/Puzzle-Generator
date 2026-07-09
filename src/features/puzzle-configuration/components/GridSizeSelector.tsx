import React from 'react';

const GRID_SIZE_OPTIONS = [
  { value: 4, label: '4×4' },
  { value: 6, label: '6×6' },
  { value: 9, label: '9×9' },
] as const;

interface Props {
  value: 4 | 6 | 9;
  onChange: (size: 4 | 6 | 9) => void;
}

export function GridSizeSelector({ value, onChange }: Props) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-300 mb-2 text-center">Grid Size</label>
      <div className="flex justify-center gap-2">
        {GRID_SIZE_OPTIONS.map(({ value: optionValue, label }) => (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              value === optionValue
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
