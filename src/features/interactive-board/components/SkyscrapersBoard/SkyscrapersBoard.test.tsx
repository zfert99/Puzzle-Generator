// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkyscrapersBoard, gutterLabel } from './SkyscrapersBoard';

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
  });

  it('exposes one rectangular grid to assistive technology: every row has N+2 cells, indexed', () => {
    render(<SkyscrapersBoard size={5} />);

    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-rowcount', '7');
    expect(grid).toHaveAttribute('aria-colcount', '7');
    const rows = screen.getAllByRole('row');
    rows.forEach((row, r) => {
      expect(row).toHaveAttribute('aria-rowindex', String(r + 1));
      const cells = row.querySelectorAll('[role="gridcell"]');
      expect(cells).toHaveLength(7);
      cells.forEach((cell, c) => expect(cell).toHaveAttribute('aria-colindex', String(c + 1)));
    });
    // The four corners are empty read-only cells, not hidden elements.
    const corners = [rows[0], rows[6]].flatMap((row) => {
      const cells = row.querySelectorAll('[role="gridcell"]');
      return [cells[0], cells[6]];
    });
    corners.forEach((corner) => {
      expect(corner).toHaveAttribute('aria-readonly', 'true');
      expect(corner).not.toHaveAttribute('aria-label');
    });
  });

  it('draws the frame on the play cells that touch the gutter, and nowhere else', () => {
    render(<SkyscrapersBoard size={4} />);

    const play = (r: number, c: number) =>
      screen.getByRole('gridcell', { name: `Row ${r}, column ${c}, empty` }).className;
    const frames = (cls: string) => (cls.match(/frame(Top|Bottom|Left|Right)/g) ?? []).sort();

    expect(frames(play(1, 1))).toEqual(['frameLeft', 'frameTop']);
    expect(frames(play(1, 4))).toEqual(['frameRight', 'frameTop']);
    expect(frames(play(4, 1))).toEqual(['frameBottom', 'frameLeft']);
    expect(frames(play(4, 4))).toEqual(['frameBottom', 'frameRight']);
    expect(frames(play(1, 2))).toEqual(['frameTop']);
    expect(frames(play(3, 4))).toEqual(['frameRight']);
    expect(frames(play(2, 3))).toEqual([]);
  });

  it('sizes the CSS grid from the track count', () => {
    render(<SkyscrapersBoard size={7} />);

    expect(screen.getByRole('grid').getAttribute('style')).toContain('--tracks: 9');
  });
});
