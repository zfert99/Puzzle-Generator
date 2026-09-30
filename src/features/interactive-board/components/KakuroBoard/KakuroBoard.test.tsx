// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KakuroBoard } from './KakuroBoard';
import { KAKURO_SAMPLE_7X7 } from './sample-layout';

describe('KakuroBoard (looks-only, V0)', () => {
  it('adds a one-cell clue gutter, so an N×N layout draws N+1 rows of N+1 cells', () => {
    render(<KakuroBoard layout={['..', '..']} />);

    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getAllByRole('gridcell')).toHaveLength(9);
  });

  it('draws the diagonal only on black cells that start a run', () => {
    // Clue cells: the interior black cell (white to its right and below), the gutter cell above
    // the second column, and the gutter cell left of the second row. The other three gutter
    // cells touch no white cell on their right or below, so they stay plain.
    render(<KakuroBoard layout={['#.', '..']} />);

    expect(screen.getAllByRole('gridcell', { name: 'Clue cell' })).toHaveLength(3);
    expect(screen.getAllByRole('gridcell', { name: 'Blocked cell' })).toHaveLength(3);
    expect(screen.getAllByRole('gridcell', { name: /empty$/ })).toHaveLength(3);
  });

  it('renders the 7×7 sample with all 32 white cells empty', () => {
    render(<KakuroBoard layout={KAKURO_SAMPLE_7X7} />);

    expect(screen.getByRole('grid', { name: 'Kakuro board' })).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
    expect(screen.getAllByRole('gridcell', { name: /empty$/ })).toHaveLength(32);
  });
});

describe('KAKURO_SAMPLE_7X7', () => {
  it('is square and 180° rotationally symmetric', () => {
    const n = KAKURO_SAMPLE_7X7.length;

    for (let r = 0; r < n; r++) {
      expect(KAKURO_SAMPLE_7X7[r]).toHaveLength(n);
      for (let c = 0; c < n; c++) {
        expect(KAKURO_SAMPLE_7X7[r][c]).toBe(KAKURO_SAMPLE_7X7[n - 1 - r][n - 1 - c]);
      }
    }
  });
});
