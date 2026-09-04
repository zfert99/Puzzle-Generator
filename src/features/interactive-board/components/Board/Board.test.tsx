// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from './Board';
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
  useBoardStore.getState().startNewGame(puzzle());
});

describe('Board', () => {
  it('renders one gridcell per square', () => {
    render(<Board />);
    expect(screen.getAllByRole('gridcell')).toHaveLength(16);
  });

  /**
   * F6: the ARIA grid pattern requires role="row" between grid and gridcell — gridcells used to
   * be direct children of role="grid", so screen readers could not announce row position. The
   * rows are display:contents, so this asserts the accessibility tree, not layout.
   */
  it('structures the grid as rows of gridcells with 1-based indices (F6)', () => {
    render(<Board />);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
    rows.forEach((row, i) => {
      expect(row).toHaveAttribute('aria-rowindex', String(i + 1));
      expect(within(row).getAllByRole('gridcell')).toHaveLength(4);
    });
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 2/i })).toHaveAttribute(
      'aria-colindex',
      '2',
    );
  });

  it('is reachable by keyboard before any selection exists (F4)', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // (0,0) is empty/editable in the fixture, so it seeds the roving tabindex.
    const entry = screen.getByRole('gridcell', { name: /empty, row 1, column 1/i });
    expect(entry).toHaveAttribute('tabindex', '0');

    await user.tab();
    expect(entry).toHaveFocus();

    // Focus selects the cell, so typing works immediately after tabbing in.
    await user.keyboard('1');
    expect(screen.getByRole('gridcell', { name: /value 1, row 1, column 1/i })).toBeInTheDocument();
  });

  it('seeds the entry Tab stop on the first editable cell, skipping givens', () => {
    const withGivenCorner = puzzle();
    withGivenCorner.grid[0][0] = 1; // (0,0) becomes a given; first editable is now (0,1)
    useBoardStore.getState().startNewGame(withGivenCorner);
    render(<Board />);

    expect(screen.getByRole('gridcell', { name: /given clue 1, row 1, column 1/i })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 2/i })).toHaveAttribute('tabindex', '0');
  });

  it('moves the selection with the arrow keys (roving tabindex)', async () => {
    const user = userEvent.setup();
    render(<Board />);

    const first = screen.getByRole('gridcell', { name: /row 1, column 1/i });
    await user.click(first);
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(first).toHaveAttribute('tabindex', '0');

    await user.keyboard('{ArrowRight}');

    const second = screen.getByRole('gridcell', { name: /row 1, column 2/i });
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(second).toHaveFocus();
    expect(first).toHaveAttribute('tabindex', '-1');
  });

  it('places a typed digit into the selected empty cell', async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.click(screen.getByRole('gridcell', { name: /row 1, column 1/i }));
    await user.keyboard('1');

    expect(screen.getByRole('gridcell', { name: /value 1, row 1, column 1/i })).toBeInTheDocument();
  });

  it('highlights every other cell holding the selected value', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // Select the given 3 at (0,2). The solution places 3 also at (1,0), (2,3), (3,1).
    await user.click(screen.getByRole('gridcell', { name: /given clue 3, row 1, column 3/i }));

    const otherThree = screen.getByRole('gridcell', { name: /given clue 3, row 2, column 1/i });
    expect(otherThree).toHaveAttribute('data-highlight', 'same');

    // A cell with a different value is not same-highlighted.
    const four = screen.getByRole('gridcell', { name: /given clue 4, row 1, column 4/i });
    expect(four).not.toHaveAttribute('data-highlight');
  });

  it('undoes and redoes placements with Ctrl+Z / Ctrl+Y', async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.click(screen.getByRole('gridcell', { name: /row 1, column 1/i }));
    await user.keyboard('1');
    expect(screen.getByRole('gridcell', { name: /value 1, row 1, column 1/i })).toBeInTheDocument();

    await user.keyboard('{Control>}z{/Control}'); // undo
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 1/i })).toBeInTheDocument();

    await user.keyboard('{Control>}y{/Control}'); // redo
    expect(screen.getByRole('gridcell', { name: /value 1, row 1, column 1/i })).toBeInTheDocument();
  });

  it('refuses to overwrite a given clue', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // (0,2) is a given with value 3.
    await user.click(screen.getByRole('gridcell', { name: /given clue 3, row 1, column 3/i }));
    await user.keyboard('9');

    expect(screen.getByRole('gridcell', { name: /given clue 3, row 1, column 3/i })).toBeInTheDocument();
  });
});
