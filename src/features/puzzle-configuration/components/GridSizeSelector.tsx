import React from 'react';

/** Every size any picker can offer; a caller narrows it with `sizes`. */
export type SelectableSize = 4 | 5 | 6 | 7 | 9;

const GRID_SIZE_OPTIONS: readonly { value: SelectableSize; label: string }[] = [
  { value: 4, label: '4×4' },
  { value: 5, label: '5×5' },
  { value: 6, label: '6×6' },
  { value: 7, label: '7×7' },
  { value: 9, label: '9×9' },
];

/** The Sudoku-family default: 5 and 7 are Skyscrapers' / Kakuro's, offered only when a caller lists them. */
const DEFAULT_SIZES: readonly SelectableSize[] = [4, 6, 9];

interface Props<S extends SelectableSize> {
  value: S;
  onChange: (size: S) => void;
  /**
   * The sizes to offer, in the order of `GRID_SIZE_OPTIONS` (e.g. Killer has no 4×4; Kakuro is
   * 6/7/9; Skyscrapers 5/6/7). Defaults to the Sudoku-family 4/6/9. Generic in `S` so a caller whose state is a
   * narrower union (`4 | 6 | 9`) keeps a correctly-typed `onChange`.
   */
  sizes?: readonly S[];
}

export function GridSizeSelector<S extends SelectableSize = 4 | 6 | 9>({ value, onChange, sizes }: Props<S>) {
  const offered: readonly SelectableSize[] = sizes ?? DEFAULT_SIZES;
  const options = GRID_SIZE_OPTIONS.filter((o) => offered.includes(o.value));
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
            onClick={() => onChange(optionValue as S)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              value === optionValue
                ? 'bg-butterscotch text-on-butterscotch border-2 border-ink'
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
