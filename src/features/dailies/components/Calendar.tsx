'use client';

import { useState } from 'react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Format year/month(0-based)/day as an ISO `YYYY-MM-DD` string. */
function iso(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * A small dependency-free month calendar for picking a past daily. Dates are handled in UTC
 * (matching the daily's 00:00-UTC rollover) via explicit `Date.UTC` — never the local
 * timezone — so the highlighted "today" and the disabled future days line up with the server.
 * Future dates (after `maxDate`) are disabled; there is no hard lower bound (a date with no
 * stored daily simply 404s on fetch).
 */
export function Calendar({
  value,
  onChange,
  maxDate,
}: {
  value: string;
  onChange: (isoDate: string) => void;
  maxDate: string;
}) {
  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(value.slice(5, 7)) - 1);

  const firstWeekday = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

  const maxYear = Number(maxDate.slice(0, 4));
  const maxMonth = Number(maxDate.slice(5, 7)) - 1;
  const canGoNext = viewYear < maxYear || (viewYear === maxYear && viewMonth < maxMonth);

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goNext = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="glass-panel p-4 w-full max-w-xs mx-auto">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={goPrev} aria-label="Previous month" className="px-2 py-1 rounded hover:bg-paper-2">
          ‹
        </button>
        <span className="font-semibold text-sm">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          aria-label="Next month"
          className={`px-2 py-1 rounded hover:bg-paper-2 ${canGoNext ? '' : 'opacity-30 cursor-not-allowed'}`}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-soft mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const dateIso = iso(viewYear, viewMonth, day);
          const disabled = dateIso > maxDate;
          const selected = dateIso === value;
          return (
            <button
              key={dateIso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(dateIso)}
              className={`aspect-square rounded-md text-sm transition-colors ${
                selected
                  ? 'bg-butterscotch text-ink border-2 border-ink font-semibold'
                  : disabled
                    ? 'opacity-25 cursor-not-allowed'
                    : 'hover:bg-paper-2 border border-transparent'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
