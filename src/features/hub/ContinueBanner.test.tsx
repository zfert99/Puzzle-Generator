// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContinueBanner } from './ContinueBanner';
import { toUtcDateString } from '@/lib/db/daily-row';

/**
 * The banner's job is to say what the parked game *is*. That is harder than it looks because
 * `mode: 'daily'` does not mean "today's ranked daily" — it means "a daily-shaped board". Two
 * things land in that mode with an older `dailyDate`: an archive replay (`ArchiveExperience`
 * starts boards as `startNewGame(puzzle, 'daily', thatDate)`) and a daily left running past
 * 00:00 UTC. Calling either of those "Daily" tells a player their practice board is the ranked
 * daily they still owe today.
 *
 * The saved-game hook is the boundary (AGENTS.md Section 4) — it reads the persisted board store,
 * which has no meaningful shape in jsdom.
 */
const h = vi.hoisted(() => ({
  saved: null as null | {
    mode: string;
    difficulty: string;
    variant: string;
    gridSize: number;
    elapsedTime: number;
    dailyDate: string | null;
  },
}));

vi.mock('@/features/interactive-board/store/useSavedGame', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/interactive-board/store/useSavedGame')>()),
  useSavedGame: () => h.saved,
}));

/**
 * Assertions below match the DOM text, which is lower-case: `formatDailyKey` returns the raw rung
 * (`hard`) and the capital H a user sees comes from a CSS `capitalize` class, not from the markup.
 */
const today = toUtcDateString(new Date());

afterEach(() => {
  h.saved = null;
  vi.clearAllMocks();
});

describe('ContinueBanner', () => {
  it('renders nothing when there is no parked game', () => {
    const { container } = render(<ContinueBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("calls today's parked daily a Daily", () => {
    h.saved = { mode: 'daily', difficulty: 'hard', variant: 'killer', gridSize: 9, elapsedTime: 23, dailyDate: today };

    render(<ContinueBanner />);

    expect(screen.getByText(/Daily · hard/)).toBeInTheDocument();
    expect(screen.queryByText(/Practice/)).not.toBeInTheDocument();
  });

  /**
   * The regression. Before, this rendered "Daily · hard" for a board from another day — the hub's
   * front door advertising a 3-August practice replay as the daily.
   */
  it('calls a board from another day Practice, not Daily', () => {
    h.saved = {
      mode: 'daily',
      difficulty: 'hard',
      variant: 'killer',
      gridSize: 9,
      elapsedTime: 23,
      dailyDate: '2026-08-03',
    };

    render(<ContinueBanner />);

    expect(screen.getByText(/Practice · hard/)).toBeInTheDocument();
    expect(screen.queryByText(/Daily ·/)).not.toBeInTheDocument();
  });

  it('leaves free play alone — it has no date and was never mislabelled', () => {
    h.saved = { mode: 'play', difficulty: 'medium', variant: 'killer', gridSize: 9, elapsedTime: 10, dailyDate: null };

    render(<ContinueBanner />);

    expect(screen.getByText(/Killer · medium/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/play?resume=1');
  });
});
