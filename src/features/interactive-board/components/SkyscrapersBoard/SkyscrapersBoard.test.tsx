// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkyscrapersBoard, buildDisplayCells, gutterLabel, skyscrapersTracks } from './SkyscrapersBoard';

describe('buildDisplayCells', () => {
  it('adds a one-cell gutter on every side, so size N draws N+2 tracks', () => {
    const cells = buildDisplayCells(5);

    expect(skyscrapersTracks(5)).toBe(7);
    expect(cells).toHaveLength(7);
    expect(cells.every((row) => row.length === 7)).toBe(true);
  });

  it('classifies corners, gutter strips and play cells by display position', () => {
    const cells = buildDisplayCells(4);
    const flat = cells.flat();

    expect(flat.filter((cell) => cell.kind === 'corner')).toHaveLength(4);
    expect(flat.filter((cell) => cell.kind === 'gutter')).toHaveLength(16);
    expect(flat.filter((cell) => cell.kind === 'play')).toHaveLength(16);
    expect(cells[0][1]).toEqual({ kind: 'gutter', side: 'top', index: 0 });
    expect(cells[5][4]).toEqual({ kind: 'gutter', side: 'bottom', index: 3 });
    expect(cells[2][0]).toEqual({ kind: 'gutter', side: 'left', index: 1 });
    expect(cells[3][5]).toEqual({ kind: 'gutter', side: 'right', index: 2 });
    expect(cells[1][1]).toEqual({ kind: 'play', row: 0, col: 0 });
    expect(cells[4][4]).toEqual({ kind: 'play', row: 3, col: 3 });
  });
});

describe('gutterLabel', () => {
  it('spells the direction a clue on that side reads in', () => {
    expect(gutterLabel('top', 2)).toBe('Clue cell, looking down from the top of column 3, blank');
    expect(gutterLabel('bottom', 0)).toBe('Clue cell, looking up from the bottom of column 1, blank');
    expect(gutterLabel('left', 4)).toBe('Clue cell, looking right from the left of row 5, blank');
    expect(gutterLabel('right', 1)).toBe('Clue cell, looking left from the right of row 2, blank');
  });
});

describe('SkyscrapersBoard (looks-only, V0)', () => {
  it('renders an N×N play area of empty gridcells inside 4N read-only gutter cells', () => {
    render(<SkyscrapersBoard size={6} />);

    expect(screen.getByRole('grid', { name: 'Skyscrapers board, 6 by 6' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(8);
    expect(screen.getAllByRole('gridcell', { name: /empty$/ })).toHaveLength(36);
    expect(screen.getAllByRole('gridcell', { name: /^Clue cell/ })).toHaveLength(24);
    expect(screen.getAllByRole('gridcell')).toHaveLength(60);
  });

  it('hides the four corners from assistive technology', () => {
    const { container } = render(<SkyscrapersBoard size={5} />);

    const corners = container.querySelectorAll('[aria-hidden="true"]');
    expect(corners).toHaveLength(4);
    corners.forEach((corner) => expect(corner).toHaveAttribute('role', 'presentation'));
  });

  it('exposes the track count to CSS and the size to tests', () => {
    render(<SkyscrapersBoard size={7} />);

    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('data-size', '7');
    expect(grid.getAttribute('style')).toContain('--tracks: 9');
  });
});
