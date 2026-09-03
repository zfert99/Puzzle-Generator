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
 *
 * **A day with no boards is disabled, not merely unhelpful (September 2026).** Only future days used
 * to be blocked, so every date before the project existed was clickable and dead-ended on a "no
 * daily puzzle" message. `minDate` (the archive's first board) sets the floor and stops paging past
 * it; `availableDays` handles the holes *inside* the range, which are real — 2026-07-24 holds
 * nothing because the cron missed it, so a floor alone would leave a clickable gap mid-calendar.
 *
 * **`loadedMonths` exists to avoid lying while the fetch is in flight.** Availability arrives
 * asynchronously, so an empty `availableDays` is ambiguous: it means either "this month has no
 * boards" or "we haven't heard yet". Treating unknown as unavailable would grey the whole month on
 * first paint and then un-grey it — so a day is disabled only once its month is known.
 *
 * Optionally marks each day with the caller's completion progress (`tallies`), and reports month
 * navigation (`onMonthChange`) so the parent can fetch the newly-visible month's data.
 */
export function Calendar({
  value,
  onChange,
  maxDate,
  minDate,
  availableDays,
  loadedMonths,
  tallies,
  onMonthChange,
}: {
  value: string;
  onChange: (isoDate: string) => void;
  maxDate: string;
  /** Earliest selectable date (the archive's first board). Omit for no lower bound. */
  minDate?: string;
  /** ISO dates known to hold boards. Only consulted for months listed in `loadedMonths`. */
  availableDays?: ReadonlySet<string>;
  /** `YYYY-MM` values whose availability has been fetched. */
  loadedMonths?: ReadonlySet<string>;
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
  // Paging stops at the month holding the first board — there is nothing behind it but empty
  // calendars, and an endless "‹" invites the user to go looking for content that cannot exist.
  // Absent `minDate` means genuinely unbounded (the component's original behaviour); a caller whose
  // bound is still loading passes a provisional floor rather than nothing — see ArchiveExperience.
  const minYear = minDate ? Number(minDate.slice(0, 4)) : null;
  const minMonth = minDate ? Number(minDate.slice(5, 7)) - 1 : null;
  const canGoPrev =
    minYear === null || minMonth === null || viewYear > minYear || (viewYear === minYear && viewMonth > minMonth);

  // Month paging is reported to the parent from the click handlers rather than an effect on
  // the view state: picking a day can never change the visible month (only in-month days are
  // clickable), so navigation is the one event that invalidates the parent's fetched tallies.
  const showMonth = (year: number, month0: number) => {
    setViewYear(year);
    setViewMonth(month0);
    onMonthChange?.(`${year}-${String(month0 + 1).padStart(2, '0')}`);
  };
  const goPrev = () => {
    if (!canGoPrev) return;
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
        <button
          type="button"
          onClick={goPrev}
          disabled={!canGoPrev}
          aria-label="Previous month"
          className={`px-2 py-1 rounded hover:bg-paper-2 ${canGoPrev ? '' : 'opacity-30 cursor-not-allowed'}`}
        >
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
          const month = dateIso.slice(0, 7);
          // Unknown-until-fetched is treated as available (see the `loadedMonths` note above), so a
          // slow month renders normally and settles, rather than flashing fully greyed.
          const monthKnown = loadedMonths?.has(month) ?? false;
          const hasBoards = !monthKnown || !availableDays || availableDays.has(dateIso);
          const outOfRange = dateIso > maxDate || (minDate !== undefined && dateIso < minDate);
          const disabled = outOfRange || !hasBoards;
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
              // A greyed-out day must say WHY in its accessible name: opacity alone carries the
              // "nothing here" meaning visually, and `disabled` alone doesn't distinguish "no
              // puzzles that day" from "in the future" (WCAG 1.4.1).
              aria-label={
                marked
                  ? `${day} ${MONTHS[viewMonth]} ${viewYear} — ${tally.done} of ${tally.total} completed`
                  : !outOfRange && !hasBoards
                    ? `${day} ${MONTHS[viewMonth]} ${viewYear} — no puzzles`
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
