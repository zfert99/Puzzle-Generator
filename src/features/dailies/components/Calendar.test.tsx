// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Calendar } from './Calendar';

const tallies = {
  '2026-08-03': { done: 6, total: 6 },
  '2026-08-04': { done: 2, total: 6 },
  '2026-08-05': { done: 0, total: 6 },
};

describe('Calendar completion markers', () => {
  /**
   * The dot alone can't convey the count, and colour must not be the only channel carrying the
   * distinction (WCAG 1.4.1) — so the tally has to reach the accessible name.
   */
  it('puts each day’s X/N in the accessible name', () => {
    render(<Calendar value="2026-08-03" onChange={() => {}} maxDate="2026-08-31" tallies={tallies} />);

    expect(screen.getByRole('button', { name: '3 August 2026 — 6 of 6 completed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4 August 2026 — 2 of 6 completed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 August 2026 — 0 of 6 completed' })).toBeInTheDocument();
  });

  // A day with no stored dailies has no tally, so it must stay a plain day — never "0 of 0".
  it('leaves a day with no boards unmarked', () => {
    render(<Calendar value="2026-08-03" onChange={() => {}} maxDate="2026-08-31" tallies={tallies} />);

    expect(screen.getByRole('button', { name: '6' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /0 of 0/ })).not.toBeInTheDocument();
  });

  it('renders without markers when no tallies are supplied (signed out)', () => {
    render(<Calendar value="2026-08-03" onChange={() => {}} maxDate="2026-08-31" />);

    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /completed/ })).not.toBeInTheDocument();
  });

  /**
   * Paging months is the only event that invalidates the parent's fetched tallies — picking a day
   * can't, since only in-month days are clickable. Without this the archive would show one month's
   * markers on another month's grid.
   */
  it('reports the newly-visible month when paging', async () => {
    const onMonthChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Calendar value="2026-01-15" onChange={() => {}} maxDate="2026-08-31" onMonthChange={onMonthChange} />,
    );

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(onMonthChange).toHaveBeenLastCalledWith('2025-12'); // year rolls back

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onMonthChange).toHaveBeenLastCalledWith('2026-01');
  });
});

describe('Calendar availability bounds', () => {
  const loadedMonths = new Set(['2026-07']);
  const availableDays = new Set(['2026-07-11', '2026-07-12', '2026-07-25']);

  /**
   * The live archive is not contiguous — boards begin 2026-07-11 and 2026-07-24 holds none — so a
   * lower bound alone cannot express which days are offerable.
   */
  it('disables days with no boards, inside and below the range', () => {
    render(
      <Calendar
        value="2026-07-12"
        onChange={() => {}}
        maxDate="2026-07-31"
        minDate="2026-07-11"
        availableDays={availableDays}
        loadedMonths={loadedMonths}
      />,
    );

    expect(screen.getByRole('button', { name: '10' })).toBeDisabled(); // before the first board
    expect(screen.getByRole('button', { name: '11' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '12' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '25' })).toBeEnabled();
  });

  // Opacity is the only visual cue, and `disabled` alone doesn't say WHY (WCAG 1.4.1).
  it('says "no puzzles" in the accessible name of an empty day inside the range', () => {
    render(
      <Calendar
        value="2026-07-12"
        onChange={() => {}}
        maxDate="2026-07-31"
        minDate="2026-07-11"
        availableDays={availableDays}
        loadedMonths={loadedMonths}
      />,
    );

    expect(screen.getByRole('button', { name: '24 July 2026 — no puzzles' })).toBeDisabled();
  });

  /**
   * Availability is fetched per month, so an empty set means "no boards" OR "not heard yet".
   * Treating unknown as unavailable would grey the whole month on first paint, then un-grey it.
   */
  it('leaves an unfetched month fully selectable rather than greying it on spec', () => {
    render(
      <Calendar
        value="2026-07-12"
        onChange={() => {}}
        maxDate="2026-07-31"
        availableDays={new Set()}
        loadedMonths={new Set()}
      />,
    );

    expect(screen.getByRole('button', { name: '24' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '11' })).toBeEnabled();
  });

  it('stops paging back at the month holding the first board', () => {
    render(
      <Calendar value="2026-07-12" onChange={() => {}} maxDate="2026-08-31" minDate="2026-07-11" />,
    );

    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled();
  });

  /**
   * The parent passes the visible month as a provisional floor while the real one loads, so "‹"
   * is inert until the bound is known — otherwise a fast double-click strands the user in a month
   * that then greys out AND locks, leaving only "›" as an escape.
   */
  it('a provisional floor of the visible month blocks paging back', () => {
    render(
      <Calendar value="2026-08-05" onChange={() => {}} maxDate="2026-08-31" minDate="2026-08-01" />,
    );

    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
  });

  it('still pages back freely when no bound is given at all', () => {
    render(<Calendar value="2026-08-05" onChange={() => {}} maxDate="2026-08-31" />);

    expect(screen.getByRole('button', { name: 'Previous month' })).toBeEnabled();
  });
});
