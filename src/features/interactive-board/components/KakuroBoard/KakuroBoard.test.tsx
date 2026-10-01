// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KAKURO_FIXTURE_7X7, parseKakuroFixture } from '@/features/engine/kakuro/kakuro-fixtures';
import { KakuroBoard } from './KakuroBoard';

// The smallest real puzzle: 3×3, black in two opposite corners.
//   # 1 3        across sums: 4 / 7 / 8
//   1 2 4        down sums:   4 / 8 / 7
//   3 5 #
const TINY = parseKakuroFixture(['#13', '124', '35#'], 'easy');

describe('KakuroBoard (static)', () => {
  it('adds a one-cell clue gutter, so an N×N puzzle draws N+1 rows of N+1 cells', () => {
    render(<KakuroBoard puzzle={TINY} />);

    expect(screen.getByRole('grid', { name: 'Kakuro board, 3 by 3' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getAllByRole('gridcell')).toHaveLength(16);
  });

  it('puts each clue on the cell just before its run', () => {
    render(<KakuroBoard puzzle={TINY} />);

    // The interior black corner heads the top across run (4) and the left down run (4).
    expect(screen.getAllByRole('gridcell', { name: 'Clue: across 4, down 4' })).toHaveLength(1);
    // Gutter cells head one run each.
    expect(screen.getAllByRole('gridcell', { name: 'Clue: down 8' })).toHaveLength(1);
    expect(screen.getAllByRole('gridcell', { name: 'Clue: down 7' })).toHaveLength(1);
    expect(screen.getAllByRole('gridcell', { name: 'Clue: across 7' })).toHaveLength(1);
    expect(screen.getAllByRole('gridcell', { name: 'Clue: across 8' })).toHaveLength(1);
    expect(screen.getAllByRole('gridcell', { name: /^Clue/ })).toHaveLength(5);
  });

  it('shows the sums as text and leaves plain blocks unlabelled', () => {
    render(<KakuroBoard puzzle={TINY} />);

    // 6 runs → 6 sums drawn: 4, 4, 7, 7, 8, 8.
    expect(screen.getAllByText('4')).toHaveLength(2);
    expect(screen.getAllByText('7')).toHaveLength(2);
    expect(screen.getAllByText('8')).toHaveLength(2);
    // 16 cells − 7 white − 5 clue cells = 4 plain blocks (3 gutter + the bottom-right corner).
    expect(screen.getAllByRole('gridcell', { name: 'Blocked cell' })).toHaveLength(4);
  });

  it('never draws a solution digit — white cells are empty', () => {
    render(<KakuroBoard puzzle={KAKURO_FIXTURE_7X7} />);

    const whites = screen.getAllByRole('gridcell', { name: /empty$/ });
    expect(whites).toHaveLength(32);
    expect(whites.every((cell) => cell.textContent === '')).toBe(true);
  });
});
