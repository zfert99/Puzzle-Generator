import React from 'react';

const GRID_SIZE_OPTIONS = [
  { value: 4, label: '4×4' },
  { value: 6, label: '6×6' },
  { value: 9, label: '9×9' },
] as const;

interface Props {
  value: 4 | 6 | 9;
  onChange: (size: 4 | 6 | 9) => void;
  /** Restrict the offered sizes (e.g. Killer has no 4×4). Defaults to all three. */
  sizes?: readonly (4 | 6 | 9)[];
}

export function GridSizeSelector({ value, onChange, sizes }: Props) {
  const options = sizes ? GRID_SIZE_OPTIONS.filter((o) => sizes.includes(o.value)) : GRID_SIZE_OPTIONS;
  return (
    <div className="mb-6">
      {/* QA F10: the heading is a span (a <label> without a control is itself an a11y smell) tied
          to the button group via aria-labelledby, and each button carries aria-pressed so the
          selection is announced rather than conveyed by background colour alone. */}
      <span id="grid-size-label" className="block text-sm font-medium text-ink-soft mb-2 text-center">
        Grid Size
      </span>
      <div role="group" aria-labelledby="grid-size-label" className="flex justify-center gap-2">
        {options.map(({ value: optionValue, label }) => (
          <button
            key={optionValue}
            type="button"
            aria-pressed={value === optionValue}
            onClick={() => onChange(optionValue)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              value === optionValue
                ? 'bg-butterscotch text-ink border-2 border-ink'
                : 'bg-paper text-ink-soft hover:bg-paper'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
