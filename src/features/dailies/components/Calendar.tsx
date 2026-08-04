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

/** A day's completion tally across all of that day's boards — the calendar's X/N marker. */
export interface DayTally {
  done: number;
  total: number;
}

/**
 * A small dependency-free month calendar for picking a past daily. Dates are handled in UTC
 * (matching the daily's 00:00-UTC rollover) via explicit `Date.UTC` — never the local
 * timezone — so the highlighted "today" and the disabled future days line up with the server.
 * Future dates (after `maxDate`) are disabled; there is no hard lower bound (a date with no
 * stored daily simply 404s on fetch).
 *
 * Optionally marks each day with the caller's completion progress (`tallies`), and reports month
 * navigation (`onMonthChange`) so the parent can fetch the newly-visible month's tallies.
 */
export function Calendar({
  value,
  onChange,
  maxDate,
  tallies,
  onMonthChange,
}: {
  value: string;
  onChange: (isoDate: string) => void;
  maxDate: string;
  /** ISO date → that day's completed/total across every board it held. Omit for no markers. */
  tallies?: Record<string, DayTally>;
  /** Fires with the newly-visible `YYYY-MM` when the user pages months. */
  onMonthChange?: (month: string) => void;
}) {
  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(value.slice(5, 7)) - 1);

  const firstWeekday = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

  const maxYear = Number(maxDate.slice(0, 4));
  const maxMonth = Number(maxDate.slice(5, 7)) - 1;
  const canGoNext = viewYear < maxYear || (viewYear === maxYear && viewMonth < maxMonth);

  // Month paging is reported to the parent from the click handlers rather than an effect on
  // the view state: picking a day can never change the visible month (only in-month days are
  // clickable), so navigation is the one event that invalidates the parent's fetched tallies.
  const showMonth = (year: number, month0: number) => {
    setViewYear(year);
    setViewMonth(month0);
    onMonthChange?.(`${year}-${String(month0 + 1).padStart(2, '0')}`);
  };
  const goPrev = () => {
    if (viewMonth === 0) showMonth(viewYear - 1, 11);
    else showMonth(viewYear, viewMonth - 1);
  };
  const goNext = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) showMonth(viewYear + 1, 0);
    else showMonth(viewYear, viewMonth + 1);
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
          // A day with no stored dailies has no tally at all — no marker, rather than "0/0".
          const tally = tallies?.[dateIso];
          const marked = tally && tally.total > 0;
          const allDone = marked && tally.done === tally.total;
          return (
            <button
              key={dateIso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(dateIso)}
              // The number alone doesn't say what the dot means, and colour must not be the only
              // channel carrying it (WCAG 1.4.1), so the count goes in the accessible name.
              aria-label={
                marked
                  ? `${day} ${MONTHS[viewMonth]} ${viewYear} — ${tally.done} of ${tally.total} completed`
                  : undefined
              }
              className={`aspect-square rounded-md text-sm transition-colors flex flex-col items-center justify-center gap-0.5 ${
                selected
                  ? 'bg-butterscotch text-ink border-2 border-ink font-semibold'
                  : disabled
                    ? 'opacity-25 cursor-not-allowed'
                    : 'hover:bg-paper-2 border border-transparent'
              }`}
            >
              <span className="leading-none">{day}</span>
              {/* Reserved either way so the numbers don't jump between marked and unmarked days. */}
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  !marked
                    ? 'opacity-0'
                    : allDone
                      ? 'bg-ink'
                      : tally.done > 0
                        ? 'bg-ink/40'
                        : 'border border-ink/40'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
