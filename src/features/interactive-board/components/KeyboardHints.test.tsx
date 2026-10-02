// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KeyboardHints } from './KeyboardHints';
import { useBoardStore } from '../store/useBoardStore';
import { SKYSCRAPERS_FIXTURE_5X5 } from '@/features/engine/skyscrapers/skyscrapers-fixtures';
import { generateSudoku } from '@/features/engine/sudoku';

describe('KeyboardHints', () => {
  beforeEach(() => {
    useBoardStore.getState().startNewGame(generateSudoku('easy', 4));
  });

  it('lists the shared board keys for a Sudoku-family board, and not the gutter keys', () => {
    render(<KeyboardHints />);
    expect(screen.getByText('Move selection')).toBeInTheDocument();
    expect(screen.queryByText('Jump to the clues')).not.toBeInTheDocument();
  });

  it('adds the Skyscrapers gutter keys while a Skyscrapers board is up (G8: the C key was only in the rules dialog)', () => {
    useBoardStore.getState().startNewGame(SKYSCRAPERS_FIXTURE_5X5);
    render(<KeyboardHints />);
    expect(screen.getByText('Jump to the clues')).toBeInTheDocument();
    expect(screen.getByText('Mark a clue done')).toBeInTheDocument();
    expect(screen.getByText('Back to the board')).toBeInTheDocument();
  });
});
