// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ContinueBanner } from './ContinueBanner';
import { SLOT_KEYS, type BoardMode } from '@/features/interactive-board/store/useBoardStore';
import { toUtcDateString } from '@/lib/db/daily-row';

/**
 * The banner's job is to say what each parked game *is*. That is harder than it looks because
 * `mode: 'daily'` does not mean "today's ranked daily" — it means "a daily-shaped board". Two
 * things land in that mode with an older `dailyDate`: an archive replay (`ArchiveExperience`
 * starts boards as `startNewGame(puzzle, 'daily', thatDate)`) and a daily left running past
 * 00:00 UTC. Calling either of those "Daily" tells a player their practice board is the ranked
 * daily they still owe today.
 *
 * Since the two-slot save (October 2026) the banner reads the slots straight from localStorage
 * — that is the boundary (AGENTS.md Section 4), so the tests seed it the way `persist` writes it.
 */
function park(mode: BoardMode, game: { difficulty: string; variant: string; gridSize: number; elapsedTime: number; dailyDate: string | null }) {
  localStorage.setItem(SLOT_KEYS[mode], JSON.stringify({ state: { status: 'playing', mode, ...game }, version: 6 }));
}

/**
 * Assertions below match the DOM text, which is lower-case: `formatDailyKey` returns the raw rung
 * (`hard`) and the capital H a user sees comes from a CSS `capitalize` class, not from the markup.
 */
const today = toUtcDateString(new Date());

beforeEach(() => {
  localStorage.clear();
});

describe('ContinueBanner', () => {
  it('renders nothing when there is no parked game', () => {
    const { container } = render(<ContinueBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("calls today's parked daily a Daily", () => {
    park('daily', { difficulty: 'hard', variant: 'killer', gridSize: 9, elapsedTime: 23, dailyDate: today });

    render(<ContinueBanner />);

    expect(screen.getByText(/Daily · Hard · Killer/)).toBeInTheDocument();
    expect(screen.queryByText(/Practice/)).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/daily?resume=1');
  });

  /**
   * The regression. Before, this rendered "Daily · hard" for a board from another day — the hub's
   * front door advertising a 3-August practice replay as the daily.
   */
  it('calls a board from another day Practice, not Daily', () => {
    park('daily', { difficulty: 'hard', variant: 'killer', gridSize: 9, elapsedTime: 23, dailyDate: '2026-08-03' });

    render(<ContinueBanner />);

    expect(screen.getByText(/Practice · Hard · Killer/)).toBeInTheDocument();
    expect(screen.queryByText(/Daily ·/)).not.toBeInTheDocument();
  });

  it('labels free play as such', () => {
    park('play', { difficulty: 'medium', variant: 'killer', gridSize: 9, elapsedTime: 10, dailyDate: null });

    render(<ContinueBanner />);

    expect(screen.getByText(/Free play · Medium · Killer/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/play?resume=1');
  });

  it('shows one banner per parked slot, the daily first', () => {
    park('play', { difficulty: 'medium', variant: 'classic', gridSize: 9, elapsedTime: 10, dailyDate: null });
    park('daily', { difficulty: 'hard', variant: 'killer', gridSize: 9, elapsedTime: 23, dailyDate: today });

    render(<ContinueBanner />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/daily?resume=1');
    expect(links[1]).toHaveAttribute('href', '/play?resume=1');
  });

  it('ignores a slot whose game is over', () => {
    localStorage.setItem(SLOT_KEYS.play, JSON.stringify({ state: { status: 'solved', mode: 'play' }, version: 6 }));

    const { container } = render(<ContinueBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
