// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameHeader } from './GameHeader';
import { useBoardStore } from '../../store/useBoardStore';
import type { SudokuPuzzle } from '@/features/engine/sudoku';

const puzzle = (): SudokuPuzzle => ({
  grid: [
    [0, 0, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ],
  solution: [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ],
  difficulty: 'easy',
  gridSize: 4,
});

beforeEach(() => {
  localStorage.clear();
});

/**
 * QA Step 5b/5c: the first free-play game of a type auto-opens its rules (once, persisted per
 * type), dailies never auto-open (a modal on first paint taxes the running clock), and the
 * header's Rules button is the always-available entry point on every surface.
 */
describe('GameHeader rules integration', () => {
  it('auto-opens the rules on the first free-play game of a type, and not again once dismissed', async () => {
    const user = userEvent.setup();
    useBoardStore.getState().startNewGame(puzzle(), 'play');
    const first = render(<GameHeader />);
    expect(screen.getByRole('heading', { name: 'How to play Sudoku' })).toBeInTheDocument();

    // "Seen" persists on DISMISSAL — a player who reloads mid-dialog gets it again.
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    first.unmount();

    useBoardStore.getState().startNewGame(puzzle(), 'play');
    render(<GameHeader />);
    expect(screen.queryByRole('heading', { name: 'How to play Sudoku' })).not.toBeInTheDocument();
  });

  /**
   * Ultra-review finding on #92: `autoOpenedFor` must mark the variant as CHECKED on both
   * outcomes — set only on the auto-open path, a returning player's guard never short-circuits
   * and the localStorage read + JSON.parse re-runs on every render (once a second, via the
   * timer tick). This pins "at most one storage read per variant per mount".
   */
  it('reads the seen-flags from storage once per mount, not per render', async () => {
    const { markRulesSeen } = await import('../RulesDialog');
    markRulesSeen('classic');
    useBoardStore.getState().startNewGame(puzzle(), 'play');

    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const { rerender } = render(<GameHeader />);
    rerender(<GameHeader />);
    rerender(<GameHeader />);

    const seenReads = getItem.mock.calls.filter(([key]) => key === 'pl-rules-seen').length;
    getItem.mockRestore();
    expect(seenReads).toBe(1);
    expect(screen.queryByRole('heading', { name: /How to play/ })).not.toBeInTheDocument();
  });

  it('never auto-opens on a daily board, but keeps the Rules button available', () => {
    useBoardStore.getState().startNewGame(puzzle(), 'daily', '2026-09-04');
    render(<GameHeader />);

    expect(screen.queryByRole('heading', { name: /How to play/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rules' })).toBeInTheDocument();
  });
});
