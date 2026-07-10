// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
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

  it('refuses to overwrite a given clue', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // (0,2) is a given with value 3.
    await user.click(screen.getByRole('gridcell', { name: /given clue 3, row 1, column 3/i }));
    await user.keyboard('9');

    expect(screen.getByRole('gridcell', { name: /given clue 3, row 1, column 3/i })).toBeInTheDocument();
  });
});
