// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Numpad } from './Numpad';
import { useBoardStore } from '../../store/useBoardStore';
import type { SudokuPuzzle } from '@/features/engine/sudoku';

// All four 1s are already on the board; the single hole (0,3) wants a 4.
const puzzle = (): SudokuPuzzle => ({
  grid: [
    [1, 2, 3, 0],
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

describe('Numpad lockout', () => {
  it('disables a digit whose instances are all placed, leaving others enabled', () => {
    render(<Numpad />);
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled(); // all four 1s placed
    expect(screen.getByRole('button', { name: '4' })).toBeEnabled();   // one 4 still missing
  });
});
